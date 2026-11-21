import { useState } from 'react';
import { dataLonga, duracaoTexto, hora, mesmoDia, addDias } from '../lib/dates.js';

const CORES = ['#f0607a', '#f97316', '#14b8a6', '#8b5cf6', '#0ea5e9', '#eab308'];
const fmtCurto = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' });

// Tela "Juntos": muda conforme a situação do casal
// 1) ainda não tem agenda compartilhada  -> criar ou entrar com código
// 2) tem, mas o par ainda não entrou      -> convidar
// 3) os dois estão na agenda              -> horários livres em comum
export default function TogetherView({
  usuario, agendas, perfis, ocultas, onAlternar,
  agendaCasal, setAgendaCasalId, livres, opcoes, setOpcoes, mostrarNaGrade, setMostrarNaGrade,
  semana, onCriar, onEntrar, onSair, onApagar, onMarcar, avisar,
}) {
  const compartilhadas = agendas.filter((a) => a.compartilhada);
  const membros = agendaCasal?.membros || [];
  const par = membros.find((m) => m.user_id !== usuario.id);
  const nomePar = par ? perfis[par.user_id]?.nome || 'seu par' : null;
  const meuNome = perfis[usuario.id]?.nome || 'Você';

  return (
    <div className="juntos-tela">
      {!agendaCasal && <Comecar onCriar={onCriar} onEntrar={onEntrar} avisar={avisar} />}

      {agendaCasal && !par && <Convidar agenda={agendaCasal} avisar={avisar} />}

      {agendaCasal && par && (
        <>
          <section className="cartao casal">
            <div className="casal-avatares" aria-hidden="true">
              <span className="avatar">{meuNome.charAt(0).toUpperCase()}</span>
              <span className="avatar par" style={{ background: agendaCasal.cor }}>{nomePar.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <h2>{agendaCasal.nome}</h2>
              <p className="explica">Agenda de você e {nomePar}. O que um de vocês marca aqui aparece para o outro.</p>
            </div>
            {compartilhadas.length > 1 && (
              <label className="campo-compacto">
                Ver horários de
                <select value={agendaCasal.id} onChange={(e) => setAgendaCasalId(e.target.value)}>
                  {compartilhadas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </select>
              </label>
            )}
          </section>

          <Livres
            livres={livres}
            semana={semana}
            opcoes={opcoes}
            setOpcoes={setOpcoes}
            mostrarNaGrade={mostrarNaGrade}
            setMostrarNaGrade={setMostrarNaGrade}
            onMarcar={onMarcar}
          />
        </>
      )}

      <Gerenciar
        usuario={usuario}
        agendas={agendas}
        perfis={perfis}
        ocultas={ocultas}
        onAlternar={onAlternar}
        onCriar={onCriar}
        onEntrar={onEntrar}
        onSair={onSair}
        onApagar={onApagar}
        avisar={avisar}
        temCasal={Boolean(agendaCasal)}
      />
    </div>
  );
}

/* ---------- 1) Ainda não tem agenda do casal ---------- */
function Comecar({ onCriar, onEntrar, avisar }) {
  return (
    <section className="cartao destaque-cartao">
      <h2>Comece por aqui</h2>
      <p className="explica">
        Crie uma agenda para vocês dois. Tudo o que um de vocês marcar nela aparece no celular do outro, e o app mostra quando os dois estão livres.
      </p>
      <FormCriar onCriar={onCriar} avisar={avisar} textoBotao="Criar agenda do casal" />
      <div className="separador"><span>ou</span></div>
      <p className="explica">Seu par já criou a agenda e te mandou um código? Digite aqui:</p>
      <FormCodigo onEntrar={onEntrar} avisar={avisar} />
    </section>
  );
}

/* ---------- 2) Agenda criada, esperando o par ---------- */
function Convidar({ agenda, avisar }) {
  const mensagem = `Criei uma agenda pra gente no Agenda a Dois. Abre ${window.location.origin}, cria sua conta, vai em "Juntos" e digita o código ${agenda.codigo_convite}`;

  async function enviar() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Agenda a Dois', text: mensagem });
        return;
      } catch {
        /* cancelou o compartilhamento */
        return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, '_blank');
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(agenda.codigo_convite);
      avisar('Código copiado.');
    } catch {
      avisar(`Código: ${agenda.codigo_convite}`);
    }
  }

  return (
    <section className="cartao destaque-cartao">
      <h2>Convide seu par</h2>
      <p className="explica">
        A agenda <b>{agenda.nome}</b> está pronta, mas só você está nela. Mande o código abaixo para seu par.
      </p>
      <button className="codigo-grande" onClick={copiar} title="Toque para copiar">
        {agenda.codigo_convite}
        <small>toque para copiar</small>
      </button>
      <button className="btn primario largo" onClick={enviar}>Enviar convite</button>
      <ol className="passos">
        <li>Seu par abre o app e cria a conta dele.</li>
        <li>Na aba <b>Juntos</b>, toca em <b>Entrar com código</b> e digita o código.</li>
        <li>Pronto: os eventos dessa agenda aparecem para os dois, e aqui vão aparecer os horários em que vocês estão livres.</li>
      </ol>
    </section>
  );
}

/* ---------- 3) Horários livres em comum ---------- */
function Livres({ livres, semana, opcoes, setOpcoes, mostrarNaGrade, setMostrarNaGrade, onMarcar }) {
  const grupos = [];
  for (const l of livres) {
    const ult = grupos[grupos.length - 1];
    if (ult && mesmoDia(ult.dia, l.inicio)) ult.itens.push(l);
    else grupos.push({ dia: l.inicio, itens: [l] });
  }
  const fimSemana = addDias(semana, 6);

  return (
    <section className="cartao">
      <h2>Quando vocês estão livres</h2>
      <p className="explica">
        Horários de {fmtCurto.format(semana)} a {fmtCurto.format(fimSemana)} em que nenhum dos dois tem compromisso, contando também a agenda pessoal de cada um. Toque em um horário para marcar algo juntos.
      </p>

      {grupos.length === 0 ? (
        <p className="vazio-texto">Nenhum horário livre em comum nesta semana. Tente diminuir a duração mínima em "Ajustar".</p>
      ) : (
        <div className="lista-livres">
          {grupos.map((g) => (
            <div key={g.dia.toISOString()}>
              <p className="dia-livre">{dataLonga(g.dia)}</p>
              {g.itens.map((l) => (
                <button key={l.inicio.toISOString()} className="slot" onClick={() => onMarcar(l)}>
                  <span>{hora(l.inicio)} às {hora(l.fim)}</span>
                  <em>{duracaoTexto(l.fim - l.inicio)} livres</em>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <details className="ajustes">
        <summary>Ajustar a busca</summary>
        <div className="ajuste">
          <label>
            Duração mínima
            <select value={opcoes.minimoMin} onChange={(e) => setOpcoes({ ...opcoes, minimoMin: Number(e.target.value) })}>
              <option value={30}>30 minutos</option>
              <option value={60}>1 hora</option>
              <option value={120}>2 horas</option>
              <option value={180}>3 horas</option>
            </select>
          </label>
          <p className="explica">Esconde horários livres mais curtos que isso.</p>
        </div>
        <div className="ajuste">
          <div className="linha-2">
            <label>
              A partir de
              <select value={opcoes.inicioDia} onChange={(e) => setOpcoes({ ...opcoes, inicioDia: Number(e.target.value) })}>
                {[6, 7, 8, 9, 10, 12, 14, 17, 18].map((h) => <option key={h} value={h}>{h}h</option>)}
              </select>
            </label>
            <label>
              Até
              <select value={opcoes.fimDia} onChange={(e) => setOpcoes({ ...opcoes, fimDia: Number(e.target.value) })}>
                {[18, 20, 21, 22, 23, 24].map((h) => <option key={h} value={h}>{h}h</option>)}
              </select>
            </label>
          </div>
          <p className="explica">A parte do dia em que vale procurar. Ex.: das 18h às 23h para programas à noite.</p>
        </div>
        <label className="check">
          <input type="checkbox" checked={mostrarNaGrade} onChange={(e) => setMostrarNaGrade(e.target.checked)} />
          Pintar esses horários de verde na aba Semana
        </label>
      </details>
    </section>
  );
}

/* ---------- Gerenciar agendas (escondido por padrão) ---------- */
function Gerenciar({ usuario, agendas, perfis, ocultas, onAlternar, onCriar, onEntrar, onSair, onApagar, avisar, temCasal }) {
  const [apagando, setApagando] = useState(null);

  async function apagar(a) {
    if (!confirm(`Apagar a agenda "${a.nome}"? Todos os eventos dela também serão apagados, para vocês dois.`)) return;
    setApagando(a.id);
    try {
      await onApagar(a.id);
      avisar(`Agenda "${a.nome}" apagada.`);
    } catch (err) {
      avisar('Não foi possível apagar: ' + err.message);
    } finally {
      setApagando(null);
    }
  }

  return (
    <details className="cartao ajustes gerenciar">
      <summary>Gerenciar agendas</summary>

      <p className="explica">
        Desmarque uma agenda para esconder os eventos dela nas telas Dia e Semana. Nada é apagado.
      </p>
      <ul className="lista-agendas">
        {agendas.map((a) => {
          const outros = a.membros.filter((m) => m.user_id !== usuario.id);
          const dono = a.owner_id === usuario.id;
          return (
            <li key={a.id} className="agenda-linha">
              <label className="agenda-item">
                <input type="checkbox" checked={!ocultas.has(a.id)} onChange={() => onAlternar(a.id)} />
                <span className="bolinha" style={{ background: a.cor }} />
                <span>
                  <span className="agenda-nome">{a.nome}</span>
                  <small className="agenda-sub">
                    {!a.compartilhada
                      ? 'Só você vê'
                      : outros.length
                        ? `Com ${outros.map((m) => perfis[m.user_id]?.nome || 'alguém').join(', ')}`
                        : `Esperando seu par (código ${a.codigo_convite})`}
                  </small>
                </span>
              </label>
              {a.compartilhada && dono && (
                <button className="btn-apagar" onClick={() => apagar(a)} disabled={apagando === a.id} aria-label={`Apagar a agenda ${a.nome}`} title="Apagar agenda">
                  {apagando === a.id ? <span className="girando" /> : (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
                  )}
                </button>
              )}
              {a.compartilhada && !dono && (
                <button className="link pequeno" onClick={() => confirm(`Sair da agenda "${a.nome}"?`) && onSair(a.id)}>Sair</button>
              )}
            </li>
          );
        })}
      </ul>

      {temCasal && (
        <>
          <h3>Outra agenda compartilhada</h3>
          <p className="explica">Útil para separar assuntos, como "Viagem" ou "Casa". Cada uma tem seu próprio código.</p>
          <FormCriar onCriar={onCriar} avisar={avisar} textoBotao="Criar agenda" nomePadrao="" />
          <h3>Entrar com código</h3>
          <p className="explica">Para entrar numa agenda que outra pessoa criou.</p>
          <FormCodigo onEntrar={onEntrar} avisar={avisar} />
        </>
      )}
    </details>
  );
}

/* ---------- formulários reutilizados ---------- */
function FormCriar({ onCriar, avisar, textoBotao, nomePadrao = 'Nós dois' }) {
  const [nome, setNome] = useState(nomePadrao);
  const [cor, setCor] = useState(CORES[0]);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);

  async function enviar(e) {
    e.preventDefault();
    if (ocupado || !nome.trim()) return;
    setOcupado(true);
    setErro(null);
    try {
      await onCriar(nome.trim(), cor);
      avisar(`Agenda "${nome.trim()}" criada.`);
      setNome('');
    } catch (err) {
      setErro(err.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form className="form-criar" onSubmit={enviar}>
      <label>
        Nome da agenda
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Kauã e Laiza" />
      </label>
      <div className="cores" role="radiogroup" aria-label="Cor">
        {CORES.map((c) => (
          <button type="button" key={c} role="radio" aria-checked={c === cor} className={`cor ${c === cor ? 'ativa' : ''}`} style={{ background: c }} onClick={() => setCor(c)} aria-label={`Cor ${c}`} />
        ))}
      </div>
      {erro && <p className="msg erro">{erro}</p>}
      <button className="btn primario largo" disabled={ocupado || !nome.trim()}>
        {ocupado ? <><span className="girando" /> Criando…</> : textoBotao}
      </button>
    </form>
  );
}

function FormCodigo({ onEntrar, avisar }) {
  const [codigo, setCodigo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);

  async function enviar(e) {
    e.preventDefault();
    if (ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      await onEntrar(codigo);
      setCodigo('');
      avisar('Pronto, vocês agora dividem essa agenda.');
    } catch (err) {
      setErro(err.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form className="form-codigo" onSubmit={enviar}>
      <input
        value={codigo}
        onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
        placeholder="ABC123"
        maxLength={6}
        autoCapitalize="characters"
        aria-label="Código de convite"
      />
      <button className="btn" disabled={ocupado || codigo.length < 6}>
        {ocupado ? <><span className="girando" /> Entrando…</> : 'Entrar com código'}
      </button>
      {erro && <p className="msg erro">{erro}</p>}
    </form>
  );
}
