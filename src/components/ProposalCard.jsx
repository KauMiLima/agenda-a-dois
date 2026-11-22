import { useState } from 'react';
import { dataLonga, hora } from '../lib/dates.js';

/**
 * Cartão de uma proposta.
 *  tipo="receber"  -> o par propôs: Aceitar / Outro horário / Não posso
 *  tipo="aguardar" -> você propôs e está esperando: Cancelar
 *  tipo="historico"-> já respondida (aceita, recusada, outro horário, cancelada)
 */
export default function ProposalCard({ proposta, tipo, nomeAutor, nomePar, onAceitar, onOutroHorario, onRecusar, onCancelar }) {
  const [ocupado, setOcupado] = useState(null);
  const [recusando, setRecusando] = useState(false);
  const [recado, setRecado] = useState('');
  const [erro, setErro] = useState(null);

  async function fazer(qual, acao) {
    setOcupado(qual);
    setErro(null);
    try {
      await acao();
    } catch (err) {
      setErro(err.message);
    } finally {
      setOcupado(null);
    }
  }

  const quando = `${dataLonga(proposta.inicio)}, ${hora(proposta.inicio)} às ${hora(proposta.fim)}`;
  const ehContra = Boolean(proposta.proposta_pai);

  const cabecalho = {
    receber: ehContra ? `${nomeAutor} sugeriu outro horário` : `${nomeAutor} propôs`,
    aguardar: `Esperando ${nomePar} responder`,
    historico: {
      aceita: proposta.criado_por_mim ? `${nomePar} aceitou` : 'Você aceitou',
      recusada: proposta.criado_por_mim ? `${nomePar} não pode` : 'Você recusou',
      contraproposta: proposta.criado_por_mim ? `${nomePar} sugeriu outro horário` : 'Você sugeriu outro horário',
      cancelada: proposta.criado_por_mim ? 'Você cancelou' : `${nomeAutor} cancelou`,
    }[proposta.status],
  }[tipo];

  return (
    <article className={`proposta proposta-${tipo} status-${proposta.status}`}>
      <p className="proposta-quem">{cabecalho}</p>
      <h3>{proposta.titulo}</h3>
      <p className="proposta-quando">
        {quando}
        {proposta.local ? `, ${proposta.local}` : ''}
      </p>
      {proposta.mensagem && <p className="proposta-recado">“{proposta.mensagem}”</p>}
      {tipo === 'historico' && proposta.resposta && <p className="proposta-recado">“{proposta.resposta}”</p>}
      {erro && <p className="msg erro">{erro}</p>}

      {tipo === 'receber' && !recusando && (
        <div className="proposta-acoes">
          <button className="btn primario" disabled={Boolean(ocupado)} onClick={() => fazer('aceitar', onAceitar)}>
            {ocupado === 'aceitar' ? <><span className="girando" /> Aceitando…</> : 'Aceitar'}
          </button>
          <button className="btn" disabled={Boolean(ocupado)} onClick={onOutroHorario}>Outro horário</button>
          <button className="btn btn-texto" disabled={Boolean(ocupado)} onClick={() => setRecusando(true)}>Não posso</button>
        </div>
      )}

      {tipo === 'receber' && recusando && (
        <div className="proposta-recusa">
          <input value={recado} onChange={(e) => setRecado(e.target.value)} placeholder="Recado (opcional)" maxLength={140} autoFocus />
          <div className="proposta-acoes">
            <button className="btn perigo" disabled={Boolean(ocupado)} onClick={() => fazer('recusar', () => onRecusar(recado))}>
              {ocupado === 'recusar' ? <><span className="girando" /> Enviando…</> : 'Avisar que não posso'}
            </button>
            <button className="btn btn-texto" onClick={() => setRecusando(false)}>Voltar</button>
          </div>
        </div>
      )}

      {tipo === 'aguardar' && (
        <div className="proposta-acoes">
          <button className="btn btn-texto" disabled={Boolean(ocupado)} onClick={() => confirm(`Cancelar a proposta "${proposta.titulo}"?`) && fazer('cancelar', onCancelar)}>
            {ocupado === 'cancelar' ? 'Cancelando…' : 'Cancelar proposta'}
          </button>
        </div>
      )}
    </article>
  );
}
