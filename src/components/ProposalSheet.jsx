import { useState } from 'react';
import { paraInputLocal } from '../lib/dates.js';

const IDEIAS = ['Cinema', 'Jantar fora', 'Passeio', 'Filme em casa', 'Praia'];

/**
 * Folha para propor um programa (ou sugerir outro horário).
 * `contra` = a proposta que está recebendo "outro horário": aí o título fica fixo.
 */
export default function ProposalSheet({ inicial, contra, nomePar, onEnviar, onFechar }) {
  const [titulo, setTitulo] = useState(contra?.titulo || inicial?.titulo || '');
  const [inicio, setInicio] = useState(new Date(contra?.inicio || inicial?.inicio || Date.now()));
  const [fim, setFim] = useState(new Date(contra?.fim || inicial?.fim || Date.now() + 3600e3));
  const [local, setLocal] = useState(contra?.local || inicial?.local || '');
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  function mudarInicio(valor) {
    if (!valor) return;
    const novo = new Date(valor);
    setFim(new Date(novo.getTime() + (fim - inicio))); // mantém a duração
    setInicio(novo);
  }

  async function enviar(e) {
    e.preventDefault();
    if (!titulo.trim()) return setErro('Diga qual é o programa.');
    if (fim <= inicio) return setErro('O fim precisa ser depois do início.');
    setErro(null);
    setEnviando(true);
    try {
      await onEnviar({ titulo: titulo.trim(), inicio, fim, local: local.trim(), mensagem: mensagem.trim() });
      onFechar();
    } catch (err) {
      setErro(err.message);
      setEnviando(false);
    }
  }

  return (
    <div className="fundo-folha" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <form className="folha proposta-folha" onSubmit={enviar}>
        <span className="folha-alca" aria-hidden="true" />
        <h2>{contra ? 'Sugerir outro horário' : 'Propor um programa'}</h2>
        <p className="dica">
          {contra
            ? `Escolha um horário melhor para "${contra.titulo}". ${nomePar} recebe e responde.`
            : `${nomePar} recebe uma notificação e pode aceitar, sugerir outro horário ou dizer que não pode.`}
        </p>

        {!contra && (
          <>
            <input
              className="folha-input"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="O que vocês vão fazer?"
              aria-label="Programa"
              autoFocus
            />
            <div className="ideias-programa">
              {IDEIAS.map((i) => (
                <button type="button" key={i} className={titulo === i ? 'ativa' : ''} onClick={() => setTitulo(i)}>
                  {i}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="linha-2">
          <label>
            Começa
            <input type="datetime-local" value={paraInputLocal(inicio)} onChange={(e) => mudarInicio(e.target.value)} />
          </label>
          <label>
            Termina
            <input type="datetime-local" value={paraInputLocal(fim)} onChange={(e) => e.target.value && setFim(new Date(e.target.value))} />
          </label>
        </div>

        {!contra && (
          <label>
            Onde (opcional)
            <input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex.: Shopping da Ilha" />
          </label>
        )}

        <label>
          Recado (opcional)
          <input
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder={contra ? 'Ex.: nesse horário eu saio do trabalho' : 'Ex.: bora ver aquele filme?'}
            maxLength={140}
          />
        </label>

        {erro && <p className="msg erro">{erro}</p>}

        <div className="acoes">
          <button type="button" className="btn" onClick={onFechar} disabled={enviando}>Cancelar</button>
          <span className="espaco" />
          <button className="btn primario" disabled={enviando}>
            {enviando ? <><span className="girando" /> Enviando…</> : contra ? 'Enviar outro horário' : 'Enviar proposta'}
          </button>
        </div>
      </form>
    </div>
  );
}
