import { useState } from 'react';

const CORES = ['#ec4899', '#f97316', '#14b8a6', '#8b5cf6', '#0ea5e9', '#eab308'];

export default function CalendarsPanel({ usuario, agendas, perfis, ocultas, onAlternar, onCriar, onEntrar, onSair, onApagar, avisar }) {
  const [modo, setModo] = useState(null); // 'criar' | 'entrar'
  const [nome, setNome] = useState('Nós dois');
  const [cor, setCor] = useState(CORES[0]);
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState(null);
  const [ocupado, setOcupado] = useState(false); // evita clique duplo enquanto salva
  const [apagando, setApagando] = useState(null);

  async function criar(e) {
    e.preventDefault();
    if (ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      await onCriar(nome.trim() || 'Nós dois', cor);
      setModo(null);
      avisar('Agenda criada. Envie o código de convite para seu par.');
    } catch (err) {
      setErro(err.message);
    } finally {
      setOcupado(false);
    }
  }

  async function entrar(e) {
    e.preventDefault();
    if (ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      await onEntrar(codigo);
      setModo(null);
      setCodigo('');
      avisar('Pronto, vocês agora dividem essa agenda.');
    } catch (err) {
      setErro(err.message);
    } finally {
      setOcupado(false);
    }
  }

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

  async function copiar(c) {
    try {
      await navigator.clipboard.writeText(c);
      avisar('Código copiado.');
    } catch {
      avisar(`Código: ${c}`);
    }
  }

  return (
    <section className="painel">
      <h3>Agendas</h3>
      <ul className="lista-agendas">
        {agendas.map((a) => {
          const outros = a.membros.filter((m) => m.user_id !== usuario.id);
          return (
            <li key={a.id}>
              <label className="agenda-item">
                <input type="checkbox" checked={!ocultas.has(a.id)} onChange={() => onAlternar(a.id)} />
                <span className="bolinha" style={{ background: a.cor }} />
                <span className="agenda-nome">{a.nome}</span>
              </label>
              {a.compartilhada && (
                <div className="agenda-extra">
                  {outros.length ? (
                    <span>com {outros.map((m) => perfis[m.user_id]?.nome || 'alguém').join(', ')}</span>
                  ) : (
                    <span>esperando seu par entrar</span>
                  )}
                  {a.owner_id === usuario.id ? (
                    <span className="agenda-botoes">
                      <button className="codigo" onClick={() => copiar(a.codigo_convite)} title="Copiar código de convite">
                        {a.codigo_convite} ⧉
                      </button>
                      <button
                        className="btn-apagar"
                        onClick={() => apagar(a)}
                        disabled={apagando === a.id}
                        aria-label={`Apagar a agenda ${a.nome}`}
                        title="Apagar agenda"
                      >
                        {apagando === a.id ? <span className="girando" /> : (
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
                        )}
                      </button>
                    </span>
                  ) : (
                    <button className="link pequeno" onClick={() => confirm(`Sair da agenda "${a.nome}"?`) && onSair(a.id)}>
                      sair
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {!modo && (
        <div className="botoes-linha">
          <button className="btn pequeno" onClick={() => { setErro(null); setModo('criar'); }}>+ Compartilhada</button>
          <button className="btn pequeno" onClick={() => { setErro(null); setModo('entrar'); }}>Tenho um código</button>
        </div>
      )}

      {modo === 'criar' && (
        <form className="mini-form" onSubmit={criar}>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da agenda" />
          <div className="cores">
            {CORES.map((c) => (
              <button
                type="button"
                key={c}
                className={`cor ${c === cor ? 'ativa' : ''}`}
                style={{ background: c }}
                onClick={() => setCor(c)}
                aria-label={`Cor ${c}`}
              />
            ))}
          </div>
          {erro && <p className="msg erro">{erro}</p>}
          <div className="botoes-linha">
            <button type="button" className="btn pequeno" onClick={() => setModo(null)} disabled={ocupado}>Cancelar</button>
            <button className="btn primario pequeno" disabled={ocupado}>
              {ocupado ? <><span className="girando" /> Criando…</> : 'Criar'}
            </button>
          </div>
        </form>
      )}

      {modo === 'entrar' && (
        <form className="mini-form" onSubmit={entrar}>
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder="Código de 6 letras"
            maxLength={6}
          />
          {erro && <p className="msg erro">{erro}</p>}
          <div className="botoes-linha">
            <button type="button" className="btn pequeno" onClick={() => setModo(null)} disabled={ocupado}>Cancelar</button>
            <button className="btn primario pequeno" disabled={ocupado || codigo.length < 6}>
              {ocupado ? <><span className="girando" /> Entrando…</> : 'Entrar'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
