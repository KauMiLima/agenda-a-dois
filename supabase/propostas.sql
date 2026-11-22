-- =====================================================================
-- Propor um programa — rode no SQL Editor (depois dos outros .sql)
-- =====================================================================

create table if not exists public.propostas (
  id             uuid primary key default gen_random_uuid(),
  calendar_id    uuid not null references public.calendars on delete cascade,
  criado_por     uuid not null default auth.uid() references auth.users on delete cascade,
  titulo         text not null,
  local          text,
  descricao      text,
  mensagem       text,                -- recado de quem propôs ("bora ver aquele filme?")
  inicio         timestamptz not null,
  fim            timestamptz not null,
  status         text not null default 'pendente'
                 check (status in ('pendente', 'aceita', 'recusada', 'contraproposta', 'cancelada')),
  resposta       text,                -- recado de quem respondeu
  respondida_por uuid references auth.users on delete set null,
  respondida_em  timestamptz,
  proposta_pai   uuid references public.propostas on delete set null,  -- "outro horário" aponta para a anterior
  event_id       uuid references public.events on delete set null,     -- evento criado ao aceitar
  aviso_enviado          boolean not null default false,  -- já avisou o par da proposta?
  aviso_resposta_enviado boolean not null default true,   -- já avisou quem propôs da resposta?
  created_at     timestamptz not null default now(),
  constraint proposta_fim_depois check (fim > inicio)
);

create index if not exists propostas_calendar_idx on public.propostas (calendar_id, status);

alter table public.propostas enable row level security;

-- membros da agenda veem e criam propostas; responder é só pelas funções abaixo
drop policy if exists "ver propostas" on public.propostas;
create policy "ver propostas" on public.propostas for select to authenticated
using (public.is_member(calendar_id));

drop policy if exists "criar propostas" on public.propostas;
create policy "criar propostas" on public.propostas for insert to authenticated
with check (criado_por = auth.uid() and public.is_member(calendar_id) and status = 'pendente');

-- ---------- Aceitar: cria o evento na agenda compartilhada ----------
create or replace function public.aceitar_proposta(pid uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  p public.propostas;
  eid uuid;
begin
  select * into p from propostas where id = pid for update;
  if p.id is null or not is_member(p.calendar_id) then raise exception 'Proposta não encontrada'; end if;
  if p.status <> 'pendente' then raise exception 'Essa proposta já foi respondida'; end if;
  if p.criado_por = auth.uid() then raise exception 'Quem propôs não pode aceitar a própria proposta'; end if;

  insert into events (calendar_id, criado_por, titulo, local, descricao, inicio, fim, lembrete_min, aviso_criacao_enviado)
  values (p.calendar_id, p.criado_por, p.titulo, p.local, p.descricao, p.inicio, p.fim, 30, true)
  returning id into eid;

  update propostas
     set status = 'aceita', respondida_por = auth.uid(), respondida_em = now(),
         event_id = eid, aviso_resposta_enviado = false
   where id = pid;
  return eid;
end;
$$;

-- ---------- Recusar (quem recebeu) ou cancelar (quem propôs) ----------
create or replace function public.responder_proposta(pid uuid, acao text, recado text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  p public.propostas;
begin
  select * into p from propostas where id = pid for update;
  if p.id is null or not is_member(p.calendar_id) then raise exception 'Proposta não encontrada'; end if;
  if p.status <> 'pendente' then raise exception 'Essa proposta já foi respondida'; end if;

  if acao = 'recusar' then
    if p.criado_por = auth.uid() then raise exception 'Use cancelar para a sua própria proposta'; end if;
    update propostas set status = 'recusada', resposta = nullif(trim(recado), ''),
           respondida_por = auth.uid(), respondida_em = now(), aviso_resposta_enviado = false
     where id = pid;
  elsif acao = 'cancelar' then
    if p.criado_por <> auth.uid() then raise exception 'Só quem propôs pode cancelar'; end if;
    update propostas set status = 'cancelada', respondida_por = auth.uid(), respondida_em = now() where id = pid;
  else
    raise exception 'Ação inválida';
  end if;
end;
$$;

-- ---------- Outro horário: fecha a proposta e manda uma nova de volta ----------
create or replace function public.contrapropor(pid uuid, novo_inicio timestamptz, novo_fim timestamptz, recado text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  p public.propostas;
  nid uuid;
begin
  select * into p from propostas where id = pid for update;
  if p.id is null or not is_member(p.calendar_id) then raise exception 'Proposta não encontrada'; end if;
  if p.status <> 'pendente' then raise exception 'Essa proposta já foi respondida'; end if;
  if p.criado_por = auth.uid() then raise exception 'Para mudar a sua proposta, cancele e proponha de novo'; end if;
  if novo_fim <= novo_inicio then raise exception 'O fim precisa ser depois do início'; end if;

  update propostas set status = 'contraproposta', resposta = nullif(trim(recado), ''),
         respondida_por = auth.uid(), respondida_em = now()
   where id = pid;

  insert into propostas (calendar_id, criado_por, titulo, local, descricao, mensagem, inicio, fim, proposta_pai)
  values (p.calendar_id, auth.uid(), p.titulo, p.local, p.descricao, nullif(trim(recado), ''), novo_inicio, novo_fim, pid)
  returning id into nid;
  return nid;
end;
$$;

-- tempo real: a proposta aparece na hora no celular do outro
do $$
begin
  alter publication supabase_realtime add table public.propostas;
exception when duplicate_object then null;
end $$;
