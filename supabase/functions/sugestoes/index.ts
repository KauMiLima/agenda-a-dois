// Edge Function "sugestoes" — conversa com a IA (Claude) usando a agenda do usuário.
// A chave da API fica só aqui no servidor (secret ANTHROPIC_API_KEY).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const chave = Deno.env.get('ANTHROPIC_API_KEY');
    if (!chave) return json({ erro: 'ANTHROPIC_API_KEY não configurada no Supabase.' }, 500);

    // cliente com o token do usuário => RLS garante que ele só lê o que pode
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ erro: 'Não autenticado' }, 401);

    const { pedido, de, ate, agora, fuso, calendarId, livres = [] } = await req.json();

    const [{ data: eventos }, { data: agendas }, { data: perfis }] = await Promise.all([
      supabase.from('events').select('titulo, inicio, fim, dia_inteiro, local, calendar_id').lt('inicio', ate).gt('fim', de).order('inicio').limit(150),
      supabase.from('calendars').select('id, nome, compartilhada'),
      supabase.from('profiles').select('id, nome'),
    ]);

    const nomeAgenda = Object.fromEntries((agendas ?? []).map((a) => [a.id, `${a.nome}${a.compartilhada ? ' (compartilhada)' : ''}`]));
    const fmt = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: fuso, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

    const listaEventos = (eventos ?? []).map((e) =>
      `- ${e.titulo} | ${e.dia_inteiro ? 'dia inteiro ' + fmt(e.inicio).split(',')[0] : fmt(e.inicio) + ' até ' + fmt(e.fim)} | agenda: ${nomeAgenda[e.calendar_id] ?? '?'}${e.local ? ' | local: ' + e.local : ''}`
    ).join('\n') || '(nenhum evento)';

    const listaLivres = livres.map((l: { inicio: string; fim: string }) => `- ${fmt(l.inicio)} até ${fmt(l.fim)}`).join('\n') || '(não calculado)';
    const eu = (perfis ?? []).find((p) => p.id === user.id)?.nome ?? 'usuário';
    const outros = (perfis ?? []).filter((p) => p.id !== user.id).map((p) => p.nome).join(', ') || 'ninguém ainda';

    const sistema = `Você é o assistente de uma agenda compartilhada de um casal. Responda em português do Brasil, de forma calorosa e objetiva.
Fuso horário do usuário: ${fuso}. Agora: ${fmt(agora)} (ISO ${agora}).
Responda SOMENTE com um JSON válido, sem texto fora dele, no formato:
{"resumo": "1 a 3 frases", "sugestoes": [{"titulo": "...", "inicio": "ISO 8601 com offset do fuso", "fim": "ISO 8601 com offset", "motivo": "frase curta", "a_dois": true}]}
Regras: no máximo 5 sugestões; nunca sobreponha eventos existentes; para programas a dois use só os horários livres em comum; "a_dois" = true quando a sugestão é para o casal; não sugira nada no passado.`;

    const mensagem = `Usuário: ${eu}. Divide agenda com: ${outros}.
Período: ${fmt(de)} até ${fmt(ate)}.

Eventos visíveis para o usuário:
${listaEventos}

Horários livres em comum do casal${calendarId ? '' : ' (sem agenda compartilhada)'}:
${listaLivres}

Pedido: ${pedido}`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': chave,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-5-5',
        max_tokens: 1200,
        system: sistema,
        messages: [{ role: 'user', content: mensagem }],
      }),
    });

    if (!resp.ok) return json({ erro: `IA respondeu ${resp.status}: ${await resp.text()}` }, 502);
    const dados = await resp.json();
    const texto: string = dados.content?.find((c: { type: string }) => c.type === 'text')?.text ?? '';

    // extrai o JSON mesmo que venha cercado por ```json
    const inicioJson = texto.indexOf('{');
    const fimJson = texto.lastIndexOf('}');
    try {
      return json(JSON.parse(texto.slice(inicioJson, fimJson + 1)));
    } catch {
      return json({ resumo: texto, sugestoes: [] });
    }
  } catch (err) {
    return json({ erro: String(err?.message ?? err) }, 500);
  }
});
