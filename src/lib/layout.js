// Posiciona eventos sobrepostos lado a lado dentro de um dia.
import { addDias, inicioDoDia } from './dates.js';

/**
 * Recebe os eventos (com hora) de UM dia e devolve cada um com
 * { topoMin, alturaMin, coluna, colunas } para desenhar na grade.
 */
export function posicionarNoDia(eventos, dia) {
  const ini = inicioDoDia(dia).getTime();
  const fim = addDias(inicioDoDia(dia), 1).getTime();

  const itens = eventos
    .map((ev) => {
      const a = Math.max(new Date(ev.inicio).getTime(), ini);
      const b = Math.min(new Date(ev.fim).getTime(), fim);
      return { ev, a, b };
    })
    .filter((x) => x.b > x.a)
    .sort((x, y) => x.a - y.a || y.b - x.b);

  const resultado = [];
  let grupo = [];
  let fimGrupo = -Infinity;

  const fecharGrupo = () => {
    const colunasFim = []; // fim do último evento de cada coluna
    for (const it of grupo) {
      let c = colunasFim.findIndex((f) => f <= it.a);
      if (c === -1) {
        c = colunasFim.length;
        colunasFim.push(it.b);
      } else colunasFim[c] = it.b;
      it.coluna = c;
    }
    for (const it of grupo) {
      resultado.push({
        ev: it.ev,
        topoMin: (it.a - ini) / 60000,
        alturaMin: Math.max((it.b - it.a) / 60000, 20),
        coluna: it.coluna,
        colunas: colunasFim.length,
      });
    }
    grupo = [];
  };

  for (const it of itens) {
    if (it.a >= fimGrupo && grupo.length) fecharGrupo();
    grupo.push(it);
    fimGrupo = Math.max(fimGrupo, it.b);
  }
  if (grupo.length) fecharGrupo();
  return resultado;
}
