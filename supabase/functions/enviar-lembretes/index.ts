// Edge Function "enviar-lembretes" — chamada a cada minuto pelo pg_cron.
// 1) Lembrete X minutos antes de cada evento, para cada membro da agenda.
// 2) Aviso quando seu par cria um evento na agenda compartilhada.
// Cada pessoa recebe de acordo com AS PRÓPRIAS preferências e no PRÓPRIO fuso horário.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:agenda@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!
);

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const FUSO_PADRAO = Deno.env.get('APP_TIMEZONE') ?? 'America/Fortaleza';

type Perfil = {
  id: string;
  nome: string;
  fuso: string | null;
  notif_lembretes: boolean;
  notif_par: boolean;
  silencio_inicio: number | null;
  silencio_fim: number | null;
};
type Inscricao = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };

const fmtHora = (iso: string, fuso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { timeZone: fuso, hour: '2-digit', minute: '2-digit' });
const fmtDia = (iso: string, fuso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { timeZone: fuso, weekday: 'short', day: '2-digit', month: '2-digit' });

// a pessoa está no horário de silêncio dela agora?
function emSilencio(p: Perfil) {
  if (p.silencio_inicio == null || p.silencio_fim == null) return false;
  const h = Number(new Date().toLocaleString('en-US', { timeZone: p.fuso || FUSO_PADRAO, hour: 'numeric', hour12: false })) % 24;
  const ini = p.silencio_inicio;
  const fim = p.silencio_fim;
  return ini < fim ? h >= ini && h < fim : h >= ini || h < fim; // ex.: 22 -> 7 atravessa a meia-noite
}

async function membrosDe(calendarId: string): Promise<string[]> {
  const { data } = await db.from('calendar_members').select('user_id').eq('calendar_id', calendarId);
  return (data ?? []).map((m) => m.user_id);
}

async function perfisDe(ids: string[]): Promise<Perfil[]> {
  if (!ids.length) return [];
  const { data } = await db
    .from('profiles')
    .select('id, nome, fuso, notif_lembretes, notif_par, silencio_inicio, silencio_fim')
    .in('id', ids);
  return (data ?? []) as Perfil[];
}

// envia para TODOS os aparelhos de uma pessoa; a mensagem é montada no fuso dela
async function enviarPara(perfil: Perfil, payload: Record<string, unknown>) {
  const { data: inscricoes } = await db.from('push_subscriptions').select('*').eq('user_id', perfil.id);
  let enviados = 0;
  for (const s of (inscricoes ?? []) as Inscricao[]) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 }
      );
      enviados++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      // aparelho desinstalou o app ou tirou a permissão: apaga a inscrição
      if (status === 404 || status === 410) await db.from('push_subscriptions').delete().eq('id', s.id);
      else console.error('push falhou', status, (err as Error).message);
    }
  }
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
    for (const p of await perfisDe(await membrosDe(ev.calendar_id))) {
      if (!p.notif_lembretes) continue; // essa pessoa desligou os lembretes
      const fuso = p.fuso || FUSO_PADRAO;
      const quando = faltam >= 60 * 20 ? `${fmtDia(ev.inicio, fuso)} às ${fmtHora(ev.inicio, fuso)}` : `às ${fmtHora(ev.inicio, fuso)}`;
      lembretes += await enviarPara(p, {
        title: ev.titulo,
        body: `${quando}${faltam < 60 ? ` (em ${faltam} min)` : ''}${ev.local ? ', ' + ev.local : ''}`,
        tag: `lembrete-${ev.id}`,
      });
    }
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

    const ids = await membrosDe(ev.calendar_id);
    const perfis = await perfisDe(ids);
    const autor = perfis.find((p) => p.id === ev.criado_por)?.nome ?? 'Seu par';

    for (const p of perfis) {
      if (p.id === ev.criado_por) continue; // quem criou não precisa ser avisado
      if (!p.notif_par || emSilencio(p)) continue; // desligou, ou está no horário de silêncio
      const fuso = p.fuso || FUSO_PADRAO;
      avisos += await enviarPara(p, {
        title: `${autor} adicionou um evento`,
        body: `${ev.titulo}, ${fmtDia(ev.inicio, fuso)}${ev.dia_inteiro ? '' : ' às ' + fmtHora(ev.inicio, fuso)} (${cal.nome})`,
        tag: `novo-${ev.id}`,
      });
    }
  }

  return new Response(JSON.stringify({ lembretes, avisos }), { headers: { 'Content-Type': 'application/json' } });
});
