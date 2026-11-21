import { useMemo, useState } from 'react';
import { interpretarTexto } from '../lib/parser.js';
import { dataLonga, hora } from '../lib/dates.js';
import { descreverRepeticao } from '../lib/recorrencia.js';

const EXEMPLOS = ['jantar sexta 20h', 'cinema sábado das 19h às 21h30', 'dentista amanhã 14:30 por 45 min', 'aniversário 12/12'];

// Folha que sobe de baixo: escreva o evento como fala e o app entende
export default function QuickAdd({ agendas, agendaPadrao, onCriar, onDetalhes, onFechar }) {
  const [texto, setTexto] = useState('');
  const [agendaId, setAgendaId] = useState(agendaPadrao);
  const [exemplo] = useState(() => EXEMPLOS[Math.floor(Math.random() * EXEMPLOS.length)]);

  const previa = useMemo(() => (texto.trim() ? interpretarTexto(texto) : null), [texto]);

  const comoEvento = () => ({
    titulo: previa.titulo,
    inicio: previa.inicio,
    fim: previa.fim,
    dia_inteiro: previa.diaInteiro,
    calendar_id: agendaId,
    lembrete_min: previa.diaInteiro ? null : 30,
    ...(previa.repete ? { repete: previa.repete, repete_dias: previa.repeteDias } : {}),
  });

  async function enviar(e) {
    e.preventDefault();
    if (!previa) return;
    await onCriar(comoEvento());
    onFechar();
  }

  return (
    <div className="fundo-folha" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <form className="folha" onSubmit={enviar}>
        <span className="folha-alca" aria-hidden="true" />
        <h2>Novo evento</h2>
        <input
          className="folha-input"
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={`Ex.: ${exemplo}`}
          aria-label="Descreva o evento"
        />

        <p className={`folha-previa ${previa ? '' : 'vazia'}`}>
          {previa ? (
            <>
              <strong>{previa.titulo}</strong>
              <span>
                {dataLonga(previa.inicio)}
                {previa.diaInteiro ? ', dia todo' : `, ${hora(previa.inicio)} às ${hora(previa.fim)}`}
                {previa.repete && `, ${descreverRepeticao(previa.repete, previa.repeteDias, previa.inicio)}`}
              </span>
            </>
          ) : (
            'Escreva o que, quando e a que horas. Eu entendo o resto.'
          )}
        </p>

        {agendas.length > 1 && (
          <div className="escolha-agenda" role="radiogroup" aria-label="Agenda">
            {agendas.map((a) => (
              <button
                type="button"
                key={a.id}
                role="radio"
                aria-checked={agendaId === a.id}
                className={agendaId === a.id ? 'ativa' : ''}
                style={{ '--cor': a.cor }}
                onClick={() => setAgendaId(a.id)}
              >
                <i />
                {a.nome}
              </button>
            ))}
          </div>
        )}

        <div className="acoes">
          <button
            type="button"
            className="btn"
            onClick={() => onDetalhes(previa ? comoEvento() : { calendar_id: agendaId })}
          >
            Mais detalhes
          </button>
          <span className="espaco" />
          <button className="btn primario" disabled={!previa}>
            Adicionar
          </button>
        </div>
      </form>
    </div>
  );
}
