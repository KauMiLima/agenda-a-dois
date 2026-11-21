-- =====================================================================
-- Eventos que se repetem — rode no SQL Editor (depois dos outros .sql)
-- =====================================================================

-- 'diario' | 'semanal' | 'mensal' | 'anual'  (null = não repete)
alter table public.events add column if not exists repete text
  check (repete in ('diario', 'semanal', 'mensal', 'anual'));

-- dias da semana para 'semanal' (0 = domingo ... 6 = sábado)
alter table public.events add column if not exists repete_dias smallint[];

-- último dia em que ainda repete (null = para sempre)
alter table public.events add column if not exists repete_ate date;

-- dias em que a repetição foi apagada ("apagar só este dia")
alter table public.events add column if not exists excecoes date[] not null default '{}';

-- fuso de quem criou (para calcular o dia da semana certo no servidor)
alter table public.events add column if not exists fuso text;

create index if not exists events_repete_idx on public.events (calendar_id) where repete is not null;

-- Horários ocupados agora devolvem também a regra de repetição,
-- para o app calcular os horários livres com os eventos repetidos.
drop function if exists public.horarios_ocupados(uuid, timestamptz, timestamptz);
create function public.horarios_ocupados(cal uuid, de timestamptz, ate timestamptz)
returns table (
  user_id uuid, inicio timestamptz, fim timestamptz,
  repete text, repete_dias smallint[], repete_ate date, excecoes date[]
)
language sql security definer stable set search_path = public as $$
  select distinct m.user_id, e.inicio, e.fim, e.repete, e.repete_dias, e.repete_ate, e.excecoes
  from calendar_members m
  join calendar_members m2 on m2.user_id = m.user_id
  join events e on e.calendar_id = m2.calendar_id
  where m.calendar_id = cal
    and public.is_member(cal)
    and (
      (e.repete is null and e.inicio < ate and e.fim > de)
      or (e.repete is not null and e.inicio < ate and (e.repete_ate is null or e.repete_ate >= de::date))
    );
$$;
