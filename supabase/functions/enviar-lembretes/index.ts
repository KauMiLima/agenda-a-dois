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
type Evento = {
  id: string; calendar_id: string; titulo: string; local: string | null;
  inicio: string; fim: string; lembrete_min: number; lembrete_enviado_inicio: string | null;
  repete: 'diario' | 'semanal' | 'mensal' | 'anual' | null; repete_dias: number[] | null;
  repete_ate: string | null; excecoes: string[] | null; fuso: string | null;
};

// dia/mês/dia-da-semana de um instante, no fuso do evento
function partes(ms: number, fuso: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })
      .formatToParts(new Date(ms)).map((x) => [x.type, x.value])
  );
  const semana = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { chave: `${p.year}-${p.month}-${p.day}`, dia: Number(p.day), mes: Number(p.month), semana };
}

// vezes (início em ms) de um evento repetido entre `de` e `ate`
function proximasVezes(ev: Evento, de: number, ate: number): number[] {
  const fuso = ev.fuso || FUSO_PADRAO;
  const base = Date.parse(ev.inicio);
  const b = partes(base, fuso);
  const excecoes = new Set(ev.excecoes ?? []);
  const dias = ev.repete_dias?.length ? ev.repete_dias : [b.semana];
  const saida: number[] = [];
  let k = Math.max(0, Math.floor((de - base) / 864e5) - 1);
  for (let i = 0; i < 10; i++, k++) {
    const t = base + k * 864e5; // mesma hora todo dia
    if (t > ate) break;
    if (t < de) continue;
    const p = partes(t, fuso);
    if (ev.repete_ate && p.chave > ev.repete_ate) break;
    if (excecoes.has(p.chave)) continue;
    const cai =
      ev.repete === 'diario' ||
      (ev.repete === 'semanal' && dias.includes(p.semana)) ||
      (ev.repete === 'mensal' && p.dia === b.dia) ||
      (ev.repete === 'anual' && p.dia === b.dia && p.mes === b.mes);
    if (cai) saida.push(t);
  }
  return saida;
}

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
  const janelaFim = agora + 2 * 24 * 3600e3;
  const campos = 'id, calendar_id, titulo, local, inicio, fim, lembrete_min, lembrete_enviado_inicio, repete, repete_dias, repete_ate, excecoes, fuso';
  const [{ data: normais }, { data: repetidos }] = await Promise.all([
    db.from('events').select(campos).eq('dia_inteiro', false).not('lembrete_min', 'is', null).is('repete', null)
      .gt('inicio', new Date(agora).toISOString()).lte('inicio', new Date(janelaFim).toISOString()),
    db.from('events').select(campos).eq('dia_inteiro', false).not('lembrete_min', 'is', null).not('repete', 'is', null)
      .lte('inicio', new Date(janelaFim).toISOString()),
  ]);

  // cada evento vira a lista de vezes que começam entre agora e daqui a 2 dias
  const vezes: { ev: Evento; inicio: number }[] = [];
  for (const ev of (normais ?? []) as Evento[]) vezes.push({ ev, inicio: Date.parse(ev.inicio) });
  for (const ev of (repetidos ?? []) as Evento[]) {
    for (const t of proximasVezes(ev, agora, janelaFim)) vezes.push({ ev, inicio: t });
  }

  for (const { ev, inicio } of vezes) {
    const jaEnviado = ev.lembrete_enviado_inicio && Date.parse(ev.lembrete_enviado_inicio) === inicio;
    if (jaEnviado || agora < inicio - ev.lembrete_min * 60e3) continue;

    // marca antes de enviar, para nunca mandar duas vezes (guarda QUAL vez foi avisada)
    const inicioIso = new Date(inicio).toISOString();
    await db.from('events').update({ lembrete_enviado_inicio: inicioIso }).eq('id', ev.id);

    const faltam = Math.max(1, Math.round((inicio - agora) / 60e3));
    for (const p of await perfisDe(await membrosDe(ev.calendar_id))) {
      if (!p.notif_lembretes) continue; // essa pessoa desligou os lembretes
      const fuso = p.fuso || FUSO_PADRAO;
      const quando = faltam >= 60 * 20 ? `${fmtDia(inicioIso, fuso)} às ${fmtHora(inicioIso, fuso)}` : `às ${fmtHora(inicioIso, fuso)}`;
      lembretes += await enviarPara(p, {
        title: ev.titulo,
        body: `${quando}${faltam < 60 ? ` (em ${faltam} min)` : ''}${ev.local ? ', ' + ev.local : ''}`,
        tag: `lembrete-${ev.id}-${inicioIso}`,
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

  // ---------- 3) PROPOSTAS DE PROGRAMA ----------
  let propostas = 0;

  // 3a) proposta nova (ou "outro horário"): avisa o par
  const { data: novasPropostas } = await db
    .from('propostas')
    .select('id, calendar_id, criado_por, titulo, inicio, mensagem, proposta_pai')
    .eq('aviso_enviado', false)
    .eq('status', 'pendente')
    .limit(50);

  for (const pr of novasPropostas ?? []) {
    await db.from('propostas').update({ aviso_enviado: true }).eq('id', pr.id);
    const perfis = await perfisDe(await membrosDe(pr.calendar_id));
    const autor = perfis.find((p) => p.id === pr.criado_por)?.nome ?? 'Seu par';
    for (const p of perfis) {
      if (p.id === pr.criado_por || !p.notif_par || emSilencio(p)) continue;
      const fuso = p.fuso || FUSO_PADRAO;
      propostas += await enviarPara(p, {
        title: pr.proposta_pai ? `${autor} sugeriu outro horário` : `${autor} propôs um programa`,
        body: `${pr.titulo}, ${fmtDia(pr.inicio, fuso)} às ${fmtHora(pr.inicio, fuso)}.${pr.mensagem ? ` "${pr.mensagem}"` : ''} Toque para responder.`,
        tag: `proposta-${pr.id}`,
        url: '/?aba=dia',
      });
    }
  }

  // 3b) resposta (aceitou / não pode): avisa quem propôs
  const { data: respondidas } = await db
    .from('propostas')
    .select('id, criado_por, respondida_por, titulo, inicio, status, resposta')
    .eq('aviso_resposta_enviado', false)
    .in('status', ['aceita', 'recusada'])
    .limit(50);

  for (const pr of respondidas ?? []) {
    await db.from('propostas').update({ aviso_resposta_enviado: true }).eq('id', pr.id);
    const [quemPropos] = await perfisDe([pr.criado_por]);
    const [quemRespondeu] = await perfisDe([pr.respondida_por]);
    if (!quemPropos || !quemPropos.notif_par) continue; // respostas contam como "avisos do par"
    const fuso = quemPropos.fuso || FUSO_PADRAO;
    const nome = quemRespondeu?.nome ?? 'Seu par';
    propostas += await enviarPara(quemPropos, {
      title: pr.status === 'aceita' ? `${nome} aceitou: ${pr.titulo}` : `${nome} não pode: ${pr.titulo}`,
      body:
        pr.status === 'aceita'
          ? `Está na agenda de vocês: ${fmtDia(pr.inicio, fuso)} às ${fmtHora(pr.inicio, fuso)}.`
          : pr.resposta ? `"${pr.resposta}"` : 'Que tal propor outro horário?',
      tag: `resposta-${pr.id}`,
      url: '/?aba=juntos',
    });
  }

  return new Response(JSON.stringify({ lembretes, avisos, propostas }), { headers: { 'Content-Type': 'application/json' } });
});
