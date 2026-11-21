import { useEffect, useRef, useState } from 'react';
import { addDias, diaSemana, hora, inicioDoDia, mesmoDia, MIN } from '../lib/dates.js';
import { posicionarNoDia } from '../lib/layout.js';

const PX_POR_MIN = 0.8; // 48px por hora
const HORAS = Array.from({ length: 24 }, (_, i) => i);

export default function WeekGrid({ semana, eventos, livres, corDe, iniciaisDe, onNovo, onAbrir }) {
  const dias = Array.from({ length: 7 }, (_, i) => addDias(semana, i));
  const corpo = useRef(null);
  const [agora, setAgora] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // começa rolado nas 7h
  useEffect(() => {
    if (corpo.current) corpo.current.scrollTop = 7 * 60 * PX_POR_MIN;
  }, []);

  const doDiaInteiro = (dia) =>
    eventos.filter((e) => {
      if (!e.dia_inteiro) return false;
      const a = new Date(e.inicio);
      const b = new Date(e.fim);
      return a < addDias(inicioDoDia(dia), 1) && b > inicioDoDia(dia);
    });

  const comHora = eventos.filter((e) => !e.dia_inteiro);

  function cliqueNaColuna(e, dia) {
    if (e.target !== e.currentTarget) return;
    const y = e.nativeEvent.offsetY;
    const min = Math.floor(y / PX_POR_MIN / 30) * 30;
    const inicio = new Date(inicioDoDia(dia).getTime() + min * MIN);
    onNovo({ inicio, fim: new Date(inicio.getTime() + 60 * MIN) });
  }

  return (
    <div className="grade">
      <div className="grade-cabecalho">
        <div className="canto" />
        {dias.map((d) => (
          <div key={d.toISOString()} className={`cab-dia ${mesmoDia(d, agora) ? 'hoje' : ''}`}>
            <span className="cab-nome">{diaSemana(d)}</span>
            <span className="cab-num">{d.getDate()}</span>
          </div>
        ))}
      </div>

      <div className="grade-dia-inteiro">
        <div className="canto rotulo">dia todo</div>
        {dias.map((d) => (
          <div
            key={d.toISOString()}
            className="cel-dia-inteiro"
            onDoubleClick={() => onNovo({ inicio: inicioDoDia(d), fim: addDias(inicioDoDia(d), 1), dia_inteiro: true })}
          >
            {doDiaInteiro(d).map((ev) => (
              <button
                key={ev.id}
                className="chip-evento"
                style={{ '--cor': corDe(ev) }}
                onClick={() => onAbrir(ev)}
              >
                {ev.titulo}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="grade-corpo" ref={corpo}>
        <div className="coluna-horas">
          {HORAS.map((h) => (
            <div key={h} className="rotulo-hora" style={{ height: 60 * PX_POR_MIN }}>
              {h > 0 && <span>{String(h).padStart(2, '0')}:00</span>}
            </div>
          ))}
        </div>

        {dias.map((dia) => {
          const posicionados = posicionarNoDia(comHora, dia);
          const livresDoDia = (livres || []).filter((l) => mesmoDia(new Date(l.inicio), dia));
          const ehHoje = mesmoDia(dia, agora);
          return (
            <div
              key={dia.toISOString()}
              className={`coluna-dia ${ehHoje ? 'hoje' : ''}`}
              style={{ height: 24 * 60 * PX_POR_MIN }}
              onClick={(e) => cliqueNaColuna(e, dia)}
            >
              {livresDoDia.map((l) => {
                const topo = (new Date(l.inicio) - inicioDoDia(dia)) / MIN;
                const alt = (new Date(l.fim) - new Date(l.inicio)) / MIN;
                return (
                  <div
                    key={l.inicio.toString()}
                    className="bloco-livre"
                    style={{ top: topo * PX_POR_MIN, height: alt * PX_POR_MIN }}
                    title="Vocês dois estão livres"
                    onClick={() =>
                      onNovo({ inicio: new Date(l.inicio), fim: new Date(Math.min(new Date(l.fim), new Date(l.inicio).getTime() + 60 * MIN)), compartilhar: true })
                    }
                  >
                    <span>livres</span>
                  </div>
                );
              })}

              {posicionados.map(({ ev, topoMin, alturaMin, coluna, colunas }) => (
                <button
                  key={ev.id}
                  className={`evento ${alturaMin < 40 ? 'curto' : ''}`}
                  style={{
                    '--cor': corDe(ev),
                    top: topoMin * PX_POR_MIN,
                    height: alturaMin * PX_POR_MIN - 2,
                    left: `calc(${(coluna / colunas) * 100}% + 2px)`,
                    width: `calc(${100 / colunas}% - 4px)`,
                  }}
                  onClick={() => onAbrir(ev)}
                >
                  <strong>{ev.titulo}</strong>
                  <span>
                    {hora(ev.inicio)}–{hora(ev.fim)}
                    {iniciaisDe(ev) && <em className="iniciais">{iniciaisDe(ev)}</em>}
                  </span>
                </button>
              ))}

              {ehHoje && (
                <div
                  className="linha-agora"
                  style={{ top: ((agora - inicioDoDia(agora)) / MIN) * PX_POR_MIN }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
