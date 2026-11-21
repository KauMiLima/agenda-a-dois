import { useEffect, useMemo, useRef, useState } from 'react';
import { addDias, hora, inicioDoDia, mesmoDia } from '../lib/dates.js';
import { useEvents } from '../hooks/useEvents.js';

const fmtSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });
const fmtCurto = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
const MAX_SEMANAS = 12;

// Lista contínua para o celular: um dia embaixo do outro, e as próximas semanas
// vão carregando conforme você rola.
export default function WeekList({ semana, ocultas, corDe, agendaDe, onAbrir, onAbrirDia }) {
  const [semanas, setSemanas] = useState(2);
  const fim = useMemo(() => addDias(semana, 7 * semanas), [semana, semanas]);
  const { eventos } = useEvents(semana, fim);
  const sentinela = useRef(null);
  const hoje = inicioDoDia(new Date());

  // trocou de semana pelas setas: volta a mostrar 2 semanas a partir dela
  useEffect(() => setSemanas(2), [semana.getTime()]);

  // chegou perto do fim da lista: carrega mais uma semana
  useEffect(() => {
    const alvo = sentinela.current;
    if (!alvo || !('IntersectionObserver' in window)) return;
    const obs = new IntersectionObserver(
      (entradas) => entradas[0].isIntersecting && setSemanas((n) => Math.min(n + 1, MAX_SEMANAS)),
      { rootMargin: '300px' }
    );
    obs.observe(alvo);
    return () => obs.disconnect();
  }, []);

  const visiveis = eventos.filter((e) => !ocultas.has(e.calendar_id));
  const dias = Array.from({ length: semanas * 7 }, (_, i) => addDias(semana, i));

  return (
    <div className="semana-lista">
      {dias.map((dia, i) => {
        const fimDia = addDias(dia, 1);
        const doDia = visiveis
          .filter((e) => new Date(e.inicio) < fimDia && new Date(e.fim) > dia)
          .sort((a, b) => Number(b.dia_inteiro) - Number(a.dia_inteiro) || new Date(a.inicio) - new Date(b.inicio));
        const ehHoje = mesmoDia(dia, hoje);
        const passou = dia < hoje;

        return (
          <div key={dia.toISOString()}>
            {i % 7 === 0 && (
              <p className="semana-separador">
                {fmtCurto.format(dia)} a {fmtCurto.format(addDias(dia, 6))}
              </p>
            )}
            <section className={`sl-dia ${ehHoje ? 'hoje' : ''} ${passou ? 'passou' : ''} ${doDia.length ? '' : 'vazio'}`}>
              <button className="sl-data" onClick={() => onAbrirDia(dia)} aria-label={`Abrir ${dia.toLocaleDateString('pt-BR')}`}>
                <span className="sl-semana">{fmtSemana.format(dia).replace('.', '')}</span>
                <span className="sl-num">{dia.getDate()}</span>
              </button>

              <div className="sl-eventos">
                {doDia.length === 0 ? (
                  <button className="sl-livre" onClick={() => onAbrirDia(dia)}>Livre</button>
                ) : (
                  doDia.map((ev) => {
                    const agenda = agendaDe(ev);
                    return (
                      <button key={ev.id} className="sl-evento" style={{ '--cor': corDe(ev) }} onClick={() => onAbrir(ev)}>
                        <span className="sl-hora">{ev.dia_inteiro ? 'dia todo' : hora(ev.inicio)}</span>
                        <span className="sl-titulo">
                          {ev.titulo}
                          {ev.serie_id && <span className="repete-icone"> ↻</span>}
                        </span>
                        {agenda?.compartilhada && <span className="sl-par" title={agenda.nome} />}
                      </button>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        );
      })}
      <div ref={sentinela} className="sl-fim">
        {semanas >= MAX_SEMANAS ? 'Use as setas lá em cima para ver mais adiante.' : 'Carregando…'}
      </div>
    </div>
  );
}
