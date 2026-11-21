import { addDias, hora, inicioDoDia, mesmoDia, MIN } from '../lib/dates.js';

const fmtNomeDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' });
const fmtMes = new Intl.DateTimeFormat('pt-BR', { month: 'long' });

const maiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

function rotuloRelativo(dia) {
  const hoje = inicioDoDia(new Date());
  if (mesmoDia(dia, hoje)) return 'Hoje';
  if (mesmoDia(dia, addDias(hoje, 1))) return 'Amanhã';
  if (mesmoDia(dia, addDias(hoje, -1))) return 'Ontem';
  return null;
}

// Mostra UM dia: título grande, aviso de horário livre em comum e a lista de eventos
export default function DayView({ dia, eventos, livres, corDe, agendaDe, autorDe, onAbrir, onNovo }) {
  const ini = inicioDoDia(dia);
  const fim = addDias(ini, 1);
  const doDia = eventos
    .filter((e) => new Date(e.inicio) < fim && new Date(e.fim) > ini)
    .sort((a, b) => Number(b.dia_inteiro) - Number(a.dia_inteiro) || new Date(a.inicio) - new Date(b.inicio));
  const livresDoDia = livres.filter((l) => mesmoDia(new Date(l.inicio), dia));
  const relativo = rotuloRelativo(dia);
  const agora = new Date();

  // o horário livre mais longo do dia
  const melhorLivre = livresDoDia.reduce((m, l) => (!m || l.fim - l.inicio > m.fim - m.inicio ? l : m), null);

  return (
    <section className="dia" aria-live="polite">
      <header className="dia-cabecalho">
        <span className="dia-num">{dia.getDate()}</span>
        <span className="dia-texto">
          <strong>{relativo || maiuscula(fmtNomeDia.format(dia))}</strong>
          <span>{relativo ? `${fmtNomeDia.format(dia)} ` : ''}de {fmtMes.format(dia)}</span>
        </span>
      </header>

      {melhorLivre && (
        <button
          className="juntos"
          onClick={() => onNovo({ inicio: melhorLivre.inicio, fim: new Date(Math.min(melhorLivre.fim, melhorLivre.inicio.getTime() + 60 * MIN)), compartilhar: true })}
        >
          <span className="juntos-icone" aria-hidden="true">
            <i /><i />
          </span>
          <span>
            Vocês estão livres das <b>{hora(melhorLivre.inicio)}</b> às <b>{hora(melhorLivre.fim)}</b>
            <small>Toque para marcar algo juntos</small>
          </span>
        </button>
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
                    <strong>{ev.titulo}</strong>
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
