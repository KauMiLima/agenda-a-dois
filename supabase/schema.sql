-- =====================================================================
-- Agenda a Dois — schema do Supabase
-- Cole tudo isto no SQL Editor do Supabase e clique em "Run".
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Tabelas ----------

create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  nome       text not null default '',
  cor        text not null default '#6366f1',
  created_at timestamptz not null default now()
);

create table if not exists public.calendars (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  cor            text not null default '#ec4899',
  owner_id       uuid not null default auth.uid() references auth.users on delete cascade,
  compartilhada  boolean not null default false,
  codigo_convite text unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  created_at     timestamptz not null default now()
);

create table if not exists public.calendar_members (
  calendar_id uuid not null references public.calendars on delete cascade,
  user_id     uuid not null references auth.users on delete cascade,
  papel       text not null default 'membro', -- 'dono' | 'membro'
  created_at  timestamptz not null default now(),
  primary key (calendar_id, user_id)
);

create table if not exists public.events (
  id           uuid primary key default gen_random_uuid(),
  calendar_id  uuid not null references public.calendars on delete cascade,
  criado_por   uuid not null default auth.uid() references auth.users on delete cascade,
  titulo       text not null,
  descricao    text,
  local        text,
  inicio       timestamptz not null,
  fim          timestamptz not null,
  dia_inteiro  boolean not null default false,
  lembrete_min int default 30,            -- null = sem lembrete
  created_at   timestamptz not null default now(),
  constraint fim_depois_do_inicio check (fim > inicio)
);

create index if not exists events_calendar_inicio_idx on public.events (calendar_id, inicio);
create index if not exists members_user_idx on public.calendar_members (user_id);

-- ---------- Funções auxiliares ----------

-- O usuário logado é membro dessa agenda?
-- (security definer evita recursão nas políticas de RLS)
create or replace function public.is_member(cal uuid)
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from calendar_members
    where calendar_id = cal and user_id = auth.uid()
  );
$$;

-- Quem criou a agenda vira membro "dono" automaticamente
create or replace function public.tg_calendar_owner_member()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into calendar_members (calendar_id, user_id, papel)
  values (new.id, new.owner_id, 'dono')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists calendar_owner_member on public.calendars;
create trigger calendar_owner_member
after insert on public.calendars
for each row execute function public.tg_calendar_owner_member();

-- Novo cadastro: cria perfil + agenda "Pessoal"
create or replace function public.tg_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)));

  insert into calendars (nome, cor, owner_id, compartilhada)
  values ('Pessoal', '#6366f1', new.id, false);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.tg_new_user();

-- Entrar numa agenda compartilhada pelo código de convite
create or replace function public.entrar_na_agenda(codigo text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  cal_id uuid;
begin
  select id into cal_id
  from calendars
  where codigo_convite = upper(trim(codigo)) and compartilhada = true;

  if cal_id is null then
    raise exception 'Código de convite inválido';
  end if;

  insert into calendar_members (calendar_id, user_id, papel)
  values (cal_id, auth.uid(), 'membro')
  on conflict do nothing;

  return cal_id;
end;
$$;

-- Horários OCUPADOS de cada membro de uma agenda compartilhada,
-- considerando TODAS as agendas de cada um (inclusive a pessoal).
-- Só devolve início/fim — nunca o título — então a privacidade
-- da agenda pessoal de cada um é preservada.
create or replace function public.horarios_ocupados(cal uuid, de timestamptz, ate timestamptz)
returns table (user_id uuid, inicio timestamptz, fim timestamptz)
language sql security definer stable set search_path = public as $$
  select distinct m.user_id, e.inicio, e.fim
  from calendar_members m
  join calendar_members m2 on m2.user_id = m.user_id
  join events e on e.calendar_id = m2.calendar_id
  where m.calendar_id = cal
    and public.is_member(cal)
    and e.inicio < ate
    and e.fim > de;
$$;

-- ---------- Row Level Security ----------

alter table public.profiles         enable row level security;
alter table public.calendars        enable row level security;
alter table public.calendar_members enable row level security;
alter table public.events           enable row level security;

-- profiles: vejo o meu e de quem divide agenda comigo
drop policy if exists "ver perfis" on public.profiles;
create policy "ver perfis" on public.profiles for select to authenticated
using (
  id = auth.uid() or exists (
    select 1 from calendar_members a
    join calendar_members b on a.calendar_id = b.calendar_id
    where a.user_id = auth.uid() and b.user_id = profiles.id
  )
);

drop policy if exists "editar meu perfil" on public.profiles;
create policy "editar meu perfil" on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

-- calendars
drop policy if exists "ver agendas" on public.calendars;
create policy "ver agendas" on public.calendars for select to authenticated
using (public.is_member(id) or owner_id = auth.uid());

drop policy if exists "criar agenda" on public.calendars;
create policy "criar agenda" on public.calendars for insert to authenticated
with check (owner_id = auth.uid());

drop policy if exists "editar agenda" on public.calendars;
create policy "editar agenda" on public.calendars for update to authenticated
using (owner_id = auth.uid());

drop policy if exists "apagar agenda" on public.calendars;
create policy "apagar agenda" on public.calendars for delete to authenticated
using (owner_id = auth.uid());

-- calendar_members (entrar só pela função entrar_na_agenda)
drop policy if exists "ver membros" on public.calendar_members;
create policy "ver membros" on public.calendar_members for select to authenticated
using (public.is_member(calendar_id));

drop policy if exists "sair da agenda" on public.calendar_members;
create policy "sair da agenda" on public.calendar_members for delete to authenticated
using (user_id = auth.uid() and papel <> 'dono');

-- events: qualquer membro da agenda vê e edita
drop policy if exists "ver eventos" on public.events;
create policy "ver eventos" on public.events for select to authenticated
using (public.is_member(calendar_id));

drop policy if exists "criar eventos" on public.events;
create policy "criar eventos" on public.events for insert to authenticated
with check (public.is_member(calendar_id) and criado_por = auth.uid());

drop policy if exists "editar eventos" on public.events;
create policy "editar eventos" on public.events for update to authenticated
using (public.is_member(calendar_id)) with check (public.is_member(calendar_id));

drop policy if exists "apagar eventos" on public.events;
create policy "apagar eventos" on public.events for delete to authenticated
using (public.is_member(calendar_id));

-- ---------- Tempo real ----------
-- Quando um de vocês cria/edita um evento, a tela do outro atualiza sozinha.
do $$
begin
  alter publication supabase_realtime add table public.events;
exception when duplicate_object then null;
end $$;
