// Edge Function "enviar-lembretes" — chamada a cada minuto pelo pg_cron.
// 1) Envia o lembrete X minutos antes de cada evento para todos os membros da agenda.
// 2) Avisa seu par quando você cria um evento na agenda compartilhada.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const FUSO = Deno.env.get('APP_TIMEZONE') ?? 'America/Fortaleza';

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:agenda@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!
);

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const fmtHora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' });
const fmtDia = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { timeZone: FUSO, weekday: 'short', day: '2-digit', month: '2-digit' });

type Inscricao = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };

async function inscricoesDe(userIds: string[]): Promise<Inscricao[]> {
  if (!userIds.length) return [];
  const { data } = await db.from('push_subscriptions').select('*').in('user_id', userIds);
  return data ?? [];
}

async function membrosDe(calendarId: string): Promise<string[]> {
  const { data } = await db.from('calendar_members').select('user_id').eq('calendar_id', calendarId);
  return (data ?? []).map((m) => m.user_id);
}

async function enviar(inscricoes: Inscricao[], payload: Record<string, unknown>) {
  let enviados = 0;
  await Promise.all(
    inscricoes.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 }
        );
        enviados++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // aparelho desinstalou o app ou revogou a permissão: apaga a inscrição
        if (status === 404 || status === 410) await db.from('push_subscriptions').delete().eq('id', s.id);
        else console.error('push falhou', status, (err as Error).message);
      }
    })
  );
  return enviados;
}

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return new Response('não autorizado', { status: 401 });
  }

  const agora = Date.now();
  let lembretes = 0;
  let avisos = 0;

  // ---------- 1) LEMBRETES ----------
  const { data: proximos } = await db
    .from('events')
    .select('id, calendar_id, titulo, local, inicio, lembrete_min, lembrete_enviado_inicio')
    .eq('dia_inteiro', false)
    .not('lembrete_min', 'is', null)
    .gt('inicio', new Date(agora).toISOString())
    .lte('inicio', new Date(agora + 2 * 24 * 3600e3).toISOString());

  for (const ev of proximos ?? []) {
    const inicio = new Date(ev.inicio).getTime();
    const jaEnviado = ev.lembrete_enviado_inicio && new Date(ev.lembrete_enviado_inicio).getTime() === inicio;
    if (jaEnviado || agora < inicio - ev.lembrete_min * 60e3) continue;

    // marca antes de enviar, para nunca mandar duas vezes
    await db.from('events').update({ lembrete_enviado_inicio: ev.inicio }).eq('id', ev.id);

    const faltam = Math.max(1, Math.round((inicio - agora) / 60e3));
    const quando = faltam >= 60 * 20 ? `${fmtDia(ev.inicio)} às ${fmtHora(ev.inicio)}` : `às ${fmtHora(ev.inicio)}`;
    lembretes += await enviar(await inscricoesDe(await membrosDe(ev.calendar_id)), {
      title: ev.titulo,
      body: `${quando}${faltam < 60 ? ` (em ${faltam} min)` : ''}${ev.local ? ' · ' + ev.local : ''}`,
      tag: `lembrete-${ev.id}`,
    });
  }

  // ---------- 2) AVISO DE EVENTO NOVO NA AGENDA COMPARTILHADA ----------
  const { data: novos } = await db
    .from('events')
    .select('id, calendar_id, criado_por, titulo, inicio, dia_inteiro, calendars(nome, compartilhada)')
    .eq('aviso_criacao_enviado', false)
    .limit(50);

  for (const ev of novos ?? []) {
    await db.from('events').update({ aviso_criacao_enviado: true }).eq('id', ev.id);
    // deno-lint-ignore no-explicit-any
    const cal = ev.calendars as any;
    if (!cal?.compartilhada) continue;

    const outros = (await membrosDe(ev.calendar_id)).filter((u) => u !== ev.criado_por);
    if (!outros.length) continue;

    const { data: autor } = await db.from('profiles').select('nome').eq('id', ev.criado_por).single();
    avisos += await enviar(await inscricoesDe(outros), {
      title: `${autor?.nome ?? 'Seu par'} adicionou um evento`,
      body: `${ev.titulo} · ${fmtDia(ev.inicio)}${ev.dia_inteiro ? '' : ' às ' + fmtHora(ev.inicio)} (${cal.nome})`,
      tag: `novo-${ev.id}`,
    });
  }

  return new Response(JSON.stringify({ lembretes, avisos }), { headers: { 'Content-Type': 'application/json' } });
});
