-- =====================================================================
-- Preferências de notificação de CADA usuário — rode no SQL Editor
-- (depois do schema.sql e do push.sql)
-- =====================================================================

-- Receber lembretes antes dos eventos?
alter table public.profiles add column if not exists notif_lembretes boolean not null default true;

-- Receber aviso quando o par cria um evento na agenda compartilhada?
alter table public.profiles add column if not exists notif_par boolean not null default true;

-- Horário de silêncio para os avisos do par (ex.: 22 -> 7). null = sem silêncio
alter table public.profiles add column if not exists silencio_inicio smallint check (silencio_inicio between 0 and 23);
alter table public.profiles add column if not exists silencio_fim smallint check (silencio_fim between 0 and 23);

-- Fuso horário de cada pessoa (o app preenche sozinho pelo celular)
alter table public.profiles add column if not exists fuso text not null default 'America/Fortaleza';
