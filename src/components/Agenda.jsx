import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { addDias, inicioDaSemana, inicioDoDia, dataLonga, hora, mesmoDia, DIA, HORA } from '../lib/dates.js';
import { horariosLivres } from '../lib/freeTime.js';
import { expandir, descreverRepeticao } from '../lib/recorrencia.js';
import { useCalendars } from '../hooks/useCalendars.js';
import { useEvents } from '../hooks/useEvents.js';
import { useReminders } from '../hooks/useReminders.js';
import PushButton from './PushButton.jsx';
import NotifPrompt from './NotifPrompt.jsx';
import { usePush } from '../hooks/usePush.js';
import WeekStrip from './WeekStrip.jsx';
import DayView from './DayView.jsx';
import WeekGrid from './WeekGrid.jsx';
import WeekList from './WeekList.jsx';
import EventModal from './EventModal.jsx';
import QuickAdd from './QuickAdd.jsx';
import InlineAdd from './InlineAdd.jsx';
import TogetherView from './TogetherView.jsx';
import AccountSheet from './AccountSheet.jsx';
import ProposalSheet from './ProposalSheet.jsx';
import ProposalCard from './ProposalCard.jsx';
import { useProposals } from '../hooks/useProposals.js';

const fmtMesAno = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const fmtMes = new Intl.DateTimeFormat('pt-BR', { month: 'long' });

const ABAS = [
  { id: 'dia', nome: 'Dia', icone: 'M4 7h16M4 12h10M4 17h7' },
  { id: 'semana', nome: 'Semana', icone: 'M4 5h16v15H4zM4 10h16M9 5v15M14 5v15' },
  { id: 'novo' },
  { id: 'juntos', nome: 'Juntos', icone: 'M9 12a4 4 0 1 0 0-.01M15 12a4 4 0 1 0 0-.01' },
  { id: 'assistente', nome: 'Assistente', icone: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z' },
];

function Icone({ d }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

// true no computador (tela larga), false no celular
function useTelaLarga() {
  const consulta = '(min-width: 900px)';
  const [larga, setLarga] = useState(() => window.matchMedia(consulta).matches);
  useEffect(() => {
    const m = window.matchMedia(consulta);
    const mudar = () => setLarga(m.matches);
    m.addEventListener('change', mudar);
    return () => m.removeEventListener('change', mudar);
  }, []);
  return larga;
}

export default function Agenda({ usuario }) {
  const telaLarga = useTelaLarga();
  const [dia, setDia] = useState(() => inicioDoDia(new Date()));
  const semanaMs = inicioDaSemana(dia).getTime();
  const semana = useMemo(() => new Date(semanaMs), [semanaMs]);
  const de = semana;
  const ate = useMemo(() => addDias(semana, 7), [semana]);

  const cal = useCalendars(usuario);
  const { eventos, salvar, apagar, apagarOcorrencia } = useEvents(de, ate);

  // eventos das próximas 48h, para os lembretes funcionarem em qualquer semana
  const [agoraRef] = useState(() => new Date());
  const ateLembretes = useMemo(() => new Date(agoraRef.getTime() + 2 * DIA), [agoraRef]);
  const { eventos: proximos } = useEvents(agoraRef, ateLembretes);

  const [aba, setAba] = useState(() => {
    const pedida = new URLSearchParams(window.location.search).get('aba');
    if (pedida) window.history.replaceState(null, '', window.location.pathname);
    return ['dia', 'semana', 'juntos', 'assistente'].includes(pedida) ? pedida : 'dia';
  });
  const prop = useProposals(usuario);
  const [propondo, setPropondo] = useState(null); // { inicial } ou { contra }

  // tocar numa notificação com o app já aberto: o service worker avisa qual aba abrir
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const ouvir = (e) => {
      const pedida = e.data?.abrir && new URL(e.data.abrir, window.location.origin).searchParams.get('aba');
      if (pedida) setAba(pedida);
    };
    navigator.serviceWorker.addEventListener('message', ouvir);
    return () => navigator.serviceWorker.removeEventListener('message', ouvir);
  }, []);
  const [ocultas, setOcultas] = useState(new Set());
  const [modal, setModal] = useState(null);
  const [criando, setCriando] = useState(false);
  const [menu, setMenu] = useState(false);
  const [toasts, setToasts] = useState([]);
  const push = usePush();
  const [notifAberto, setNotifAberto] = useState(false);
  const chaveConvite = `agenda-convite-notif-${usuario.id}`;

  // logo depois de entrar: se as notificações não estão ativas, convida (no máximo a cada 3 dias)
  useEffect(() => {
    if (push.estado !== 'ativar' && push.estado !== 'instalar') return;
    let ultimo = 0;
    try {
      ultimo = Number(localStorage.getItem(chaveConvite) || 0);
    } catch {
      /* sem armazenamento: convida mesmo assim */
    }
    if (Date.now() - ultimo < 3 * DIA) return;
    const id = setTimeout(() => setNotifAberto(true), 900);
    return () => clearTimeout(id);
  }, [push.estado]);

  function adiarConvite() {
    try {
      localStorage.setItem(chaveConvite, String(Date.now()));
    } catch {
      /* tudo bem */
    }
    setNotifAberto(false);
  }

  // ----- horários livres em comum -----
  const compartilhadas = cal.agendas.filter((a) => a.compartilhada);
  const [agendaLivreId, setAgendaLivreId] = useState(null);
  // prefere a agenda em que os dois já estão
  const agendaLivre =
    compartilhadas.find((a) => a.id === agendaLivreId) ||
    compartilhadas.find((a) => (a.membros?.length || 0) >= 2) ||
    compartilhadas[0];
  const [opcoesLivre, setOpcoesLivre] = useState({ minimoMin: 60, inicioDia: 8, fimDia: 23 });
  const [mostrarLivres, setMostrarLivres] = useState(false);
  const [ocupados, setOcupados] = useState([]);
  const doisMembros = (agendaLivre?.membros?.length || 0) >= 2;

  useEffect(() => {
    if (!agendaLivre) return setOcupados([]);
    supabase
      .rpc('horarios_ocupados', { cal: agendaLivre.id, de: de.toISOString(), ate: ate.toISOString() })
      .then(({ data, error }) => {
        if (error) console.error(error);
        else setOcupados(data || []);
      });
  }, [agendaLivre?.id, de, ate, eventos]);

  // guarda o fuso horário deste aparelho no perfil (as notificações saem no horário de cada um)
  const meuPerfil = cal.perfis[usuario.id];
  useEffect(() => {
    const fuso = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (meuPerfil && meuPerfil.fuso !== undefined && meuPerfil.fuso !== fuso) {
      supabase.from('profiles').update({ fuso }).eq('id', usuario.id).then(() => {});
    }
  }, [meuPerfil?.fuso]);

  // horários ocupados da semana: calcula as repetições e ignora eventos de dia inteiro
  // (um aniversário não deixa ninguém ocupado o dia todo)
  const ocupadosSemana = useMemo(
    () =>
      expandir(
        ocupados
          .filter((o) => {
            const a = new Date(o.inicio);
            const diaInteiro = new Date(o.fim) - a >= DIA && a.getHours() === 0 && a.getMinutes() === 0;
            return !diaInteiro;
          })
          .map((o, i) => ({ ...o, id: `o${i}` })),
        de,
        ate
      ),
    [ocupados, de, ate]
  );

  const livres = useMemo(
    () => (agendaLivre ? horariosLivres(ocupadosSemana, de, 7, opcoesLivre) : []),
    [ocupadosSemana, de, opcoesLivre, agendaLivre]
  );

  // ----- utilidades -----
  const avisar = useCallback((texto) => {
    const id = Math.random();
    setToasts((t) => [...t, { id, texto }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  useReminders(proximos, avisar, !push.ativo);

  const porId = useMemo(() => Object.fromEntries(cal.agendas.map((a) => [a.id, a])), [cal.agendas]);
  const agendaDe = (ev) => porId[ev.calendar_id];
  const corDe = (ev) => porId[ev.calendar_id]?.cor || '#888';
  const autorDe = (ev) => cal.perfis[ev.criado_por]?.nome || null;
  const iniciaisDe = (ev) => (porId[ev.calendar_id]?.compartilhada ? (autorDe(ev) || '').slice(0, 1).toUpperCase() : null);

  const pessoal = cal.agendas.find((a) => !a.compartilhada);
  const visiveis = eventos.filter((e) => !ocultas.has(e.calendar_id));

  function abrirNovo({ compartilhar, ...dados } = {}) {
    const inicio = dados.inicio || new Date(dia.getTime() + 19 * HORA);
    setModal({
      calendar_id: compartilhar && agendaLivre ? agendaLivre.id : pessoal?.id,
      ...dados,
      inicio,
      fim: dados.fim || new Date(inicio.getTime() + HORA),
    });
  }

  // propor um programa no horário livre (ou criar direto, se o recurso ainda não estiver no banco)
  function propor(slot) {
    const inicio = slot?.inicio ? new Date(slot.inicio) : new Date(dia.getTime() + 19 * HORA);
    const fim = slot?.fim ? new Date(Math.min(new Date(slot.fim), inicio.getTime() + 2 * HORA)) : new Date(inicio.getTime() + 2 * HORA);
    if (!prop.disponivel || !agendaLivre) return abrirNovo({ inicio, fim, compartilhar: true });
    setPropondo({ inicial: { inicio, fim } });
  }

  async function criarRapido(ev) {
    try {
      await salvar(ev);
      // pula para o dia do evento, para você ver onde ele foi parar
      setDia(inicioDoDia(new Date(ev.inicio)));
      setAba((a) => (a === 'semana' ? 'semana' : 'dia'));
      const regra = ev.repete ? `, ${descreverRepeticao(ev.repete, ev.repete_dias, ev.inicio)}` : '';
      avisar(`Adicionado: ${ev.titulo}, ${dataLonga(ev.inicio).toLowerCase()}${ev.dia_inteiro ? '' : ' às ' + hora(ev.inicio)}${regra}`);
    } catch (err) {
      avisar('Não foi possível adicionar: ' + err.message);
    }
  }

  function alternar(id) {
    const n = new Set(ocultas);
    n.has(id) ? n.delete(id) : n.add(id);
    setOcultas(n);
  }

  function mudarSemana(n) {
    setDia(addDias(dia, 7 * n));
  }

  const hoje = inicioDoDia(new Date());
  const ehEstaSemana = mesmoDia(inicioDaSemana(hoje), semana);
  const meuNome = cal.perfis[usuario.id]?.nome || usuario.email;

  // dados da faixa do casal (só quando os dois estão na agenda compartilhada)
  const parMembro = agendaLivre?.membros?.find((m) => m.user_id !== usuario.id);
  const nomePar = parMembro ? cal.perfis[parMembro.user_id]?.nome || 'Par' : null;
  const casal =
    doisMembros && parMembro
      ? {
          eu: { id: usuario.id, nome: meuNome, inicial: meuNome.charAt(0).toUpperCase(), cor: 'var(--voce)' },
          par: { id: parMembro.user_id, nome: nomePar, inicial: nomePar.charAt(0).toUpperCase(), cor: agendaLivre.cor || 'var(--par)' },
          ocupados: ocupadosSemana,
        }
      : null;

  if (cal.carregando) return <div className="carregando">Carregando…</div>;

  // título do topo: "Novembro" (ou "Novembro de 2027" se não for o ano atual)
  const titulo = (dia.getFullYear() === hoje.getFullYear() ? fmtMes : fmtMesAno).format(dia);

  return (
    <div className="app">
      <nav className="trilho" aria-label="Seções">
        <span className="trilho-logo" aria-hidden="true"><i /><i /></span>
        {ABAS.map((a) =>
          a.id === 'novo' ? (
            <button key="novo" className="trilho-novo" onClick={() => setCriando(true)} aria-label="Novo evento">
              <Icone d="M12 5v14M5 12h14" />
            </button>
          ) : (
            <button
              key={a.id}
              className={`trilho-item ${aba === a.id ? 'ativo' : ''}`}
              onClick={() => setAba(a.id)}
              aria-current={aba === a.id ? 'page' : undefined}
            >
              <Icone d={a.icone} />
              <span>{a.nome}</span>
              {a.id === 'dia' && prop.paraResponder.length > 0 && (
                <em className="trilho-contador" aria-label={`${prop.paraResponder.length} propostas para responder`}>
                  {prop.paraResponder.length}
                </em>
              )}
            </button>
          )
        )}
      </nav>

      <div className="conteudo">
        <header className="topo">
          {(aba === 'dia' || aba === 'semana') ? (
            <div className="topo-mes">
              <h1>{titulo.charAt(0).toUpperCase() + titulo.slice(1)}</h1>
              <button className="btn-icone" onClick={() => mudarSemana(-1)} aria-label="Semana anterior">‹</button>
              <button className="btn-icone" onClick={() => mudarSemana(1)} aria-label="Próxima semana">›</button>
              {(!ehEstaSemana || !mesmoDia(dia, hoje)) && (
                <button className="btn pequeno" onClick={() => setDia(hoje)}>Hoje</button>
              )}
            </div>
          ) : (
            <h1>{aba === 'juntos' ? 'Juntos' : 'Assistente'}</h1>
          )}
          <div className="topo-acoes">
            <PushButton push={push} onAbrir={() => setNotifAberto(true)} />
            <button className="avatar" onClick={() => setMenu(true)} aria-label="Sua conta">
              {meuNome.slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>

        {aba === 'dia' && (
          <div className="pagina">
            <WeekStrip semana={semana} dia={dia} eventos={visiveis} corDe={corDe} onEscolher={setDia} />
            <InlineAdd dia={dia} agendas={cal.agendas} agendaPadrao={pessoal?.id} onCriar={criarRapido} />
            {prop.paraResponder.map((p) => (
              <ProposalCard
                key={p.id}
                proposta={p}
                tipo="receber"
                nomeAutor={cal.perfis[p.criado_por]?.nome || 'Seu par'}
                nomePar={nomePar}
                onAceitar={async () => {
                  await prop.aceitar(p.id);
                  avisar(`Combinado: ${p.titulo} está na agenda de vocês.`);
                }}
                onOutroHorario={() => setPropondo({ contra: p })}
                onRecusar={async (recado) => {
                  await prop.recusar(p.id, recado);
                  avisar(`${cal.perfis[p.criado_por]?.nome || 'Seu par'} vai saber que você não pode.`);
                }}
              />
            ))}
            <DayView
              dia={dia}
              eventos={visiveis}
              livres={doisMembros ? livres : []}
              casal={casal}
              corDe={corDe}
              agendaDe={agendaDe}
              autorDe={autorDe}
              onAbrir={setModal}
              onNovo={abrirNovo}
              onPropor={propor}
              propostas={[...prop.paraResponder, ...prop.aguardando]}
              usuarioId={usuario.id}
              nomePar={nomePar}
            />
          </div>
        )}

        {aba === 'semana' &&
          (telaLarga ? (
            <div className="pagina-larga">
              <WeekGrid
                semana={semana}
                eventos={visiveis}
                livres={mostrarLivres ? livres : null}
                corDe={corDe}
                iniciaisDe={iniciaisDe}
                onNovo={abrirNovo}
                onAbrir={setModal}
              />
            </div>
          ) : (
            <WeekList
              semana={semana}
              ocultas={ocultas}
              corDe={corDe}
              agendaDe={agendaDe}
              onAbrir={setModal}
              onAbrirDia={(d) => {
                setDia(inicioDoDia(d));
                setAba('dia');
              }}
            />
          ))}

        {aba === 'juntos' && (
          <div className="pagina">
            <TogetherView
              usuario={usuario}
              agendas={cal.agendas}
              perfis={cal.perfis}
              ocultas={ocultas}
              onAlternar={alternar}
              agendaCasal={agendaLivre}
              setAgendaCasalId={setAgendaLivreId}
              livres={livres}
              opcoes={opcoesLivre}
              setOpcoes={setOpcoesLivre}
              mostrarNaGrade={mostrarLivres}
              setMostrarNaGrade={setMostrarLivres}
              semana={semana}
              onCriar={cal.criarCompartilhada}
              onEntrar={cal.entrarComCodigo}
              onSair={cal.sair}
              onApagar={cal.apagar}
              onMarcar={propor}
              avisar={avisar}
              propostas={prop}
            />
          </div>
        )}

        {aba === 'assistente' && (
          <div className="pagina">
            <section className="cartao em-breve">
              <span className="em-breve-selo">Em desenvolvimento</span>
              <p className="explica">
                Estamos preparando um assistente que vai olhar a agenda de vocês dois e ajudar a planejar a semana.
              </p>
              <ul className="em-breve-lista">
                <li>Sugerir programas a dois nos horários em que vocês estão livres.</li>
                <li>Organizar a semana e avisar quando ela estiver cheia demais.</li>
                <li>Encaixar atividades, como treinos ou estudos, sem bater com outros compromissos.</li>
              </ul>
              <p className="dica">Por enquanto, use a escrita rápida na aba Dia e a lista de horários livres em Juntos.</p>
            </section>
          </div>
        )}
      </div>

      {notifAberto && (
        <NotifPrompt
          push={push}
          nomePar={nomePar}
          avisar={avisar}
          onFechar={() => setNotifAberto(false)}
          onAgoraNao={adiarConvite}
        />
      )}

      {propondo && (
        <ProposalSheet
          inicial={propondo.inicial}
          contra={propondo.contra}
          nomePar={nomePar || 'Seu par'}
          onFechar={() => setPropondo(null)}
          onEnviar={async (dados) => {
            if (propondo.contra) {
              await prop.contrapropor(propondo.contra.id, dados);
              avisar(`Outro horário enviado para ${nomePar}.`);
            } else {
              await prop.propor({ ...dados, calendar_id: agendaLivre.id });
              avisar(`Proposta enviada para ${nomePar}.`);
            }
          }}
        />
      )}

      {criando && (
        <QuickAdd
          agendas={cal.agendas}
          agendaPadrao={pessoal?.id}
          onCriar={criarRapido}
          onDetalhes={(ev) => {
            setCriando(false);
            abrirNovo(ev);
          }}
          onFechar={() => setCriando(false)}
        />
      )}

      {menu && (
        <AccountSheet
          usuario={usuario}
          nome={meuNome}
          push={push}
          onAbrirNotif={() => {
            setMenu(false);
            setNotifAberto(true);
          }}
          perfil={cal.perfis[usuario.id]}
          onPerfilSalvo={cal.recarregar}
          avisar={avisar}
          onFechar={() => setMenu(false)}
        />
      )}

      {modal && (
        <EventModal
          evento={modal}
          agendas={cal.agendas}
          perfis={cal.perfis}
          onSalvar={salvar}
          onApagar={apagar}
          onApagarOcorrencia={apagarOcorrencia}
          onFechar={() => setModal(null)}
        />
      )}

      <div className="toasts" role="status">
        {toasts.map((t) => (
          <div key={t.id} className="toast">{t.texto}</div>
        ))}
      </div>
    </div>
  );
}
