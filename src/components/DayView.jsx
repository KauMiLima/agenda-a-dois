import { addDias, hora, inicioDoDia, mesmoDia, MIN } from '../lib/dates.js';
import CoupleStrip from './CoupleStrip.jsx';

const fmtNomeDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' });

const maiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// "em 3 dias", "há 2 dias"
function distancia(dia) {
  const dias = Math.round((inicioDoDia(dia) - inicioDoDia(new Date())) / 86400000);
  if (dias > 0) return dias === 1 ? 'em 1 dia' : `em ${dias} dias`;
  return dias === -1 ? 'há 1 dia' : `há ${-dias} dias`;
}

function rotuloRelativo(dia) {
  const hoje = inicioDoDia(new Date());
  if (mesmoDia(dia, hoje)) return 'Hoje';
  if (mesmoDia(dia, addDias(hoje, 1))) return 'Amanhã';
  if (mesmoDia(dia, addDias(hoje, -1))) return 'Ontem';
  return null;
}

// Mostra UM dia: título grande, aviso de horário livre em comum e a lista de eventos
export default function DayView({ dia, eventos, livres, casal, corDe, agendaDe, autorDe, onAbrir, onNovo }) {
  const ini = inicioDoDia(dia);
  const fim = addDias(ini, 1);
  const doDia = eventos
    .filter((e) => new Date(e.inicio) < fim && new Date(e.fim) > ini)
    .sort((a, b) => Number(b.dia_inteiro) - Number(a.dia_inteiro) || new Date(a.inicio) - new Date(b.inicio));
  const livresDoDia = livres.filter((l) => mesmoDia(new Date(l.inicio), dia));
  const relativo = rotuloRelativo(dia);
  const agora = new Date();

  return (
    <section className="dia" aria-live="polite">
      <header className="dia-cabecalho">
        <span className="dia-num">{dia.getDate()}</span>
        <span className="dia-texto">
          <strong>{relativo || maiuscula(fmtNomeDia.format(dia))}</strong>
          <span>{relativo ? fmtNomeDia.format(dia) : distancia(dia)}</span>
        </span>
      </header>

      {casal && (
        <CoupleStrip
          dia={dia}
          eu={casal.eu}
          par={casal.par}
          ocupados={casal.ocupados}
          livres={livres}
          eventos={eventos}
          ehCompartilhado={(ev) => Boolean(agendaDe(ev)?.compartilhada)}
          onMarcar={(l) => onNovo({ inicio: l.inicio, fim: new Date(Math.min(l.fim, l.inicio.getTime() + 60 * MIN)), compartilhar: true })}
        />
      )}

      {doDia.length === 0 ? (
        <div className="vazio">
          <p>Nada marcado.</p>
          <button className="btn" onClick={() => onNovo({ inicio: new Date(ini.getTime() + 19 * 60 * MIN), fim: new Date(ini.getTime() + 20 * 60 * MIN) })}>
            Adicionar evento
          </button>
        </div>
      ) : (
        <ol className="lista">
          {doDia.map((ev) => {
            const passou = new Date(ev.fim) < agora;
            const agenda = agendaDe(ev);
            const autor = agenda?.compartilhada ? autorDe(ev) : null;
            return (
              <li key={ev.id}>
                <button className={`item ${passou ? 'passou' : ''}`} style={{ '--cor': corDe(ev) }} onClick={() => onAbrir(ev)}>
                  <span className={`item-hora ${ev.dia_inteiro ? 'inteiro' : ''}`}>
                    {ev.dia_inteiro ? (
                      'dia todo'
                    ) : (
                      <>
                        {hora(ev.inicio)}
                        <small>{hora(ev.fim)}</small>
                      </>
                    )}
                  </span>
                  <span className="item-barra" aria-hidden="true" />
                  <span className="item-corpo">
                    <strong>
                      {ev.titulo}
                      {ev.serie_id && <span className="repete-icone" title="Repete" aria-label="repete"> ↻</span>}
                    </strong>
                    {(ev.local || agenda?.compartilhada) && (
                      <small>
                        {ev.local}
                        {ev.local && agenda?.compartilhada ? ', ' : ''}
                        {agenda?.compartilhada && agenda.nome}
                      </small>
                    )}
                  </span>
                  {autor && <span className="item-autor" title={`Criado por ${autor}`}>{autor.slice(0, 1).toUpperCase()}</span>}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
