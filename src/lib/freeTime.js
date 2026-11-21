// Calcula os horários em que TODOS estão livres ao mesmo tempo.

import { addDias, inicioDoDia, MIN } from './dates.js';

/**
 * @param {{inicio: Date|string, fim: Date|string}[]} ocupados  todos os blocos ocupados (de qualquer pessoa)
 * @param {Date} de  primeiro dia
 * @param {number} dias  quantos dias olhar
 * @param {object} opcoes
 * @param {number} opcoes.inicioDia  hora em que o dia "começa" (ex.: 8)
 * @param {number} opcoes.fimDia     hora em que o dia "termina" (ex.: 23)
 * @param {number} opcoes.minimoMin  duração mínima de um horário livre, em minutos
 * @param {Date}   [opcoes.agora]    ignora o que já passou
 */
export function horariosLivres(ocupados, de, dias, { inicioDia = 8, fimDia = 23, minimoMin = 60, agora = new Date() } = {}) {
  // 1) junta todos os blocos ocupados num único conjunto ordenado e mesclado
  const blocos = ocupados
    .map((b) => [new Date(b.inicio).getTime(), new Date(b.fim).getTime()])
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);

  const mesclados = [];
  for (const [a, b] of blocos) {
    const ult = mesclados[mesclados.length - 1];
    if (ult && a <= ult[1]) ult[1] = Math.max(ult[1], b);
    else mesclados.push([a, b]);
  }

  // 2) para cada dia, pega a janela [inicioDia, fimDia] e subtrai os blocos
  const livres = [];
  const agoraMs = agora.getTime();
  for (let i = 0; i < dias; i++) {
    const d = inicioDoDia(addDias(de, i));
    let janIni = new Date(d).setHours(inicioDia, 0, 0, 0);
    const janFim = new Date(d).setHours(fimDia, 0, 0, 0);
    janIni = Math.max(janIni, arredondar(agoraMs));
    if (janIni >= janFim) continue;

    let cursor = janIni;
    for (const [a, b] of mesclados) {
      if (b <= cursor) continue;
      if (a >= janFim) break;
      if (a > cursor) empurrar(livres, cursor, Math.min(a, janFim), minimoMin);
      cursor = Math.max(cursor, b);
      if (cursor >= janFim) break;
    }
    if (cursor < janFim) empurrar(livres, cursor, janFim, minimoMin);
  }
  return livres;
}

function empurrar(lista, a, b, minimoMin) {
  if (b - a >= minimoMin * MIN) lista.push({ inicio: new Date(a), fim: new Date(b) });
}

// arredonda "agora" para o próximo múltiplo de 30 min
function arredondar(ms) {
  const passo = 30 * MIN;
  return Math.ceil(ms / passo) * passo;
}
