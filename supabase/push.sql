-- =====================================================================
-- Notificações push — rode DEPOIS do schema.sql (SQL Editor > Run)
-- =====================================================================

-- Cada aparelho que ativou notificações vira uma linha aqui
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "minhas inscricoes" on public.push_subscriptions;
create policy "minhas inscricoes" on public.push_subscriptions for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Controle do que já foi avisado (evita notificação repetida)
alter table public.events add column if not exists lembrete_enviado_inicio timestamptz;

-- Eventos que já existem não geram aviso de "novo evento"; só os criados daqui pra frente
alter table public.events add column if not exists aviso_criacao_enviado boolean not null default true;
alter table public.events alter column aviso_criacao_enviado set default false;

create index if not exists events_aviso_idx on public.events (aviso_criacao_enviado) where aviso_criacao_enviado = false;

-- Extensões para rodar a verificação a cada minuto
create extension if not exists pg_net;
create extension if not exists pg_cron;
