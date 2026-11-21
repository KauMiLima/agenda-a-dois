import { dataLonga, duracaoTexto, hora, mesmoDia } from '../lib/dates.js';

export default function FreeTimePanel({ compartilhadas, agendaId, setAgendaId, opcoes, setOpcoes, livres, mostrar, setMostrar, sozinho, onMarcar }) {
  if (!compartilhadas.length) {
    return (
      <section className="painel">
        <h3>Livres em comum</h3>
        <p className="dica">Crie uma agenda compartilhada para ver quando vocês dois estão livres.</p>
      </section>
    );
  }

  // agrupa por dia
  const grupos = [];
  for (const l of livres) {
    const ult = grupos[grupos.length - 1];
    if (ult && mesmoDia(ult.dia, l.inicio)) ult.itens.push(l);
    else grupos.push({ dia: l.inicio, itens: [l] });
  }

  return (
    <section className="painel">
      <h3>Livres em comum</h3>

      {compartilhadas.length > 1 && (
        <select value={agendaId} onChange={(e) => setAgendaId(e.target.value)}>
          {compartilhadas.map((a) => (
            <option key={a.id} value={a.id}>{a.nome}</option>
          ))}
        </select>
      )}

      <div className="filtros">
        <label>
          mín.
          <select value={opcoes.minimoMin} onChange={(e) => setOpcoes({ ...opcoes, minimoMin: Number(e.target.value) })}>
            <option value={30}>30 min</option>
            <option value={60}>1h</option>
            <option value={120}>2h</option>
            <option value={180}>3h</option>
          </select>
        </label>
        <label>
          das
          <select value={opcoes.inicioDia} onChange={(e) => setOpcoes({ ...opcoes, inicioDia: Number(e.target.value) })}>
            {[6, 7, 8, 9, 10, 12, 14, 17, 18].map((h) => <option key={h} value={h}>{h}h</option>)}
          </select>
        </label>
        <label>
          às
          <select value={opcoes.fimDia} onChange={(e) => setOpcoes({ ...opcoes, fimDia: Number(e.target.value) })}>
            {[18, 20, 21, 22, 23, 24].map((h) => <option key={h} value={h}>{h}h</option>)}
          </select>
        </label>
      </div>

      <label className="check">
        <input type="checkbox" checked={mostrar} onChange={(e) => setMostrar(e.target.checked)} />
        Destacar na grade
      </label>

      {sozinho && <p className="dica">Seu par ainda não entrou nessa agenda — por enquanto mostro só os seus horários.</p>}

      {grupos.length === 0 ? (
        <p className="dica">Nenhum horário livre em comum nesta semana com esses filtros.</p>
      ) : (
        <div className="lista-livres">
          {grupos.map((g) => (
            <div key={g.dia.toISOString()}>
              <p className="dia-livre">{dataLonga(g.dia)}</p>
              {g.itens.map((l) => (
                <button key={l.inicio.toISOString()} className="slot" onClick={() => onMarcar(l)}>
                  <span>{hora(l.inicio)}–{hora(l.fim)}</span>
                  <em>{duracaoTexto(l.fim - l.inicio)}</em>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
