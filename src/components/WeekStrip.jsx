import { addDias, mesmoDia } from '../lib/dates.js';

const LETRAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

// Faixa com os 7 dias da semana; cada dia mostra pontinhos com as cores das agendas que têm evento
export default function WeekStrip({ semana, dia, eventos, corDe, onEscolher }) {
  const hoje = new Date();
  const dias = Array.from({ length: 7 }, (_, i) => addDias(semana, i));

  function coresDoDia(d) {
    const ini = d.getTime();
    const fim = addDias(d, 1).getTime();
    const cores = new Set();
    for (const ev of eventos) {
      if (new Date(ev.inicio) < fim && new Date(ev.fim) > ini) cores.add(corDe(ev));
      if (cores.size >= 3) break;
    }
    return [...cores];
  }

  return (
    <div className="faixa" role="tablist" aria-label="Dias da semana">
      {dias.map((d, i) => {
        const ativo = mesmoDia(d, dia);
        return (
          <button
            key={d.toISOString()}
            role="tab"
            aria-selected={ativo}
            className={`faixa-dia ${ativo ? 'ativo' : ''} ${mesmoDia(d, hoje) ? 'hoje' : ''}`}
            onClick={() => onEscolher(d)}
          >
            <span className="faixa-letra">{LETRAS[i]}</span>
            <span className="faixa-num">{d.getDate()}</span>
            <span className="faixa-pontos">
              {coresDoDia(d).map((c) => (
                <i key={c} style={{ background: c }} />
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
