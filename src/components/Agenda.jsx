import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { addDias, inicioDaSemana, inicioDoDia, dataLonga, hora, mesmoDia, DIA, HORA } from '../lib/dates.js';
import { horariosLivres } from '../lib/freeTime.js';
import { useCalendars } from '../hooks/useCalendars.js';
import { useEvents } from '../hooks/useEvents.js';
import { useReminders } from '../hooks/useReminders.js';
import PushButton from './PushButton.jsx';
import WeekStrip from './WeekStrip.jsx';
import DayView from './DayView.jsx';
import WeekGrid from './WeekGrid.jsx';
import EventModal from './EventModal.jsx';
import QuickAdd from './QuickAdd.jsx';
import InlineAdd from './InlineAdd.jsx';
import TogetherView from './TogetherView.jsx';
import AccountSheet from './AccountSheet.jsx';
import AIPanel from './AIPanel.jsx';

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

export default function Agenda({ usuario }) {
  const [dia, setDia] = useState(() => inicioDoDia(new Date()));
  const semanaMs = inicioDaSemana(dia).getTime();
  const semana = useMemo(() => new Date(semanaMs), [semanaMs]);
  const de = semana;
  const ate = useMemo(() => addDias(semana, 7), [semana]);

  const cal = useCalendars(usuario);
  const { eventos, salvar, apagar } = useEvents(de, ate);

  // eventos das próximas 48h, para os lembretes funcionarem em qualquer semana
  const [agoraRef] = useState(() => new Date());
  const ateLembretes = useMemo(() => new Date(agoraRef.getTime() + 2 * DIA), [agoraRef]);
  const { eventos: proximos } = useEvents(agoraRef, ateLembretes);

  const [aba, setAba] = useState('dia');
  const [ocultas, setOcultas] = useState(new Set());
  const [modal, setModal] = useState(null);
  const [criando, setCriando] = useState(false);
  const [menu, setMenu] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [pushAtivo, setPushAtivo] = useState(false);

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

  const livres = useMemo(
    () => (agendaLivre ? horariosLivres(ocupados, de, 7, opcoesLivre) : []),
    [ocupados, de, opcoesLivre, agendaLivre]
  );

  // ----- utilidades -----
  const avisar = useCallback((texto) => {
    const id = Math.random();
    setToasts((t) => [...t, { id, texto }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  useReminders(proximos, avisar, !pushAtivo);

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

  async function criarRapido(ev) {
    try {
      await salvar(ev);
      // pula para o dia do evento, para você ver onde ele foi parar
      setDia(inicioDoDia(new Date(ev.inicio)));
      setAba((a) => (a === 'semana' ? 'semana' : 'dia'));
      avisar(`Adicionado: ${ev.titulo}, ${dataLonga(ev.inicio).toLowerCase()}${ev.dia_inteiro ? '' : ' às ' + hora(ev.inicio)}`);
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
            <PushButton avisar={avisar} onMudar={setPushAtivo} />
            <button className="avatar" onClick={() => setMenu(true)} aria-label="Sua conta">
              {meuNome.slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>

        {aba === 'dia' && (
          <div className="pagina">
            <WeekStrip semana={semana} dia={dia} eventos={visiveis} corDe={corDe} onEscolher={setDia} />
            <InlineAdd dia={dia} agendas={cal.agendas} agendaPadrao={pessoal?.id} onCriar={criarRapido} />
            <DayView
              dia={dia}
              eventos={visiveis}
              livres={doisMembros ? livres : []}
              corDe={corDe}
              agendaDe={agendaDe}
              autorDe={autorDe}
              onAbrir={setModal}
              onNovo={abrirNovo}
            />
          </div>
        )}

        {aba === 'semana' && (
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
        )}

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
              onMarcar={(l) => abrirNovo({ inicio: l.inicio, fim: new Date(Math.min(l.fim, l.inicio.getTime() + HORA)), compartilhar: true })}
              avisar={avisar}
            />
          </div>
        )}

        {aba === 'assistente' && (
          <div className="pagina">
            <AIPanel de={de} ate={ate} agendaCompartilhadaId={agendaLivre?.id} livres={livres} onAdicionar={abrirNovo} />
          </div>
        )}
      </div>

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
