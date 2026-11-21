import { useMemo, useState } from 'react';
import { interpretarTexto } from '../lib/parser.js';
import { dataLonga, hora, inicioDoDia, mesmoDia } from '../lib/dates.js';

const EXEMPLOS = ['almoço amanhã 12h', 'cinema sábado 19h às 21h', 'academia 7h por 1h30'];

// Campo da tela inicial: escreva o evento como fala e aperte Enter.
// Se você não disser o dia, o evento vai para o dia que está aberto na tela.
export default function InlineAdd({ dia, agendas, agendaPadrao, onCriar }) {
  const [texto, setTexto] = useState('');
  const [agendaId, setAgendaId] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [focado, setFocado] = useState(false);

  const alvo = agendas.find((a) => a.id === agendaId) || agendas.find((a) => a.id === agendaPadrao) || agendas[0];

  const previa = useMemo(() => {
    if (!texto.trim()) return null;
    const p = interpretarTexto(texto);
    const hoje = inicioDoDia(new Date());
    // sem data escrita e com outro dia aberto na tela: leva para esse dia
    if (!p.temData && !mesmoDia(dia, hoje)) {
      const desloc = inicioDoDia(dia).getTime() - inicioDoDia(p.inicio).getTime();
      return { ...p, inicio: new Date(p.inicio.getTime() + desloc), fim: new Date(p.fim.getTime() + desloc) };
    }
    return p;
  }, [texto, dia]);

  // toca na bolinha para trocar de agenda (Pessoal ↔ compartilhada)
  function trocarAgenda() {
    const i = agendas.findIndex((a) => a.id === alvo?.id);
    setAgendaId(agendas[(i + 1) % agendas.length].id);
  }

  async function enviar(e) {
    e.preventDefault();
    if (!previa || enviando) return;
    setEnviando(true);
    await onCriar({
      titulo: previa.titulo,
      inicio: previa.inicio,
      fim: previa.fim,
      dia_inteiro: previa.diaInteiro,
      calendar_id: alvo.id,
      lembrete_min: previa.diaInteiro ? null : 30,
    });
    setTexto('');
    setEnviando(false);
  }

  return (
    <form className="rapido" onSubmit={enviar}>
      <div className="rapido-campo">
        <span className="rapido-raio" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18"><path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="currentColor" /></svg>
        </span>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onFocus={() => setFocado(true)}
          onBlur={() => setTimeout(() => setFocado(false), 150)}
          placeholder="Escrita rápida"
          aria-label="Adicionar evento escrevendo"
          enterKeyHint="done"
          autoComplete="off"
        />
        {agendas.length > 1 && alvo && (
          <button
            type="button"
            className="rapido-agenda"
            style={{ '--cor': alvo.cor }}
            onClick={trocarAgenda}
            title={`Agenda: ${alvo.nome} (toque para trocar)`}
          >
            <i />
            {alvo.nome}
          </button>
        )}
      </div>
      {!previa && focado && (
        <div className="rapido-dicas">
          <p>Escreva como você fala: o que, o dia e a hora.</p>
          <div>
            {EXEMPLOS.map((ex) => (
              <button type="button" key={ex} onMouseDown={(e) => e.preventDefault()} onClick={() => setTexto(ex)}>
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {previa && (
        <div className="rapido-previa">
          <span>
            <strong>{previa.titulo}</strong>, {dataLonga(previa.inicio).toLowerCase()}
            {previa.diaInteiro ? ', dia todo' : `, ${hora(previa.inicio)} às ${hora(previa.fim)}`}
          </span>
          <button className="btn primario pequeno" disabled={enviando}>Adicionar</button>
        </div>
      )}
    </form>
  );
}
