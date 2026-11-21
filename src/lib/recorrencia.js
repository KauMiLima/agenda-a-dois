// Eventos que se repetem: o banco guarda o evento UMA vez com a regra,
// e aqui calculamos em quais dias ele aparece dentro de um intervalo.

const NOMES_DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

// "2026-11-21" no horário local
export function chaveDia(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// o evento acontece neste dia (data local)?
function caiNoDia(ev, base, dia) {
  switch (ev.repete) {
    case 'diario':
      return true;
    case 'semanal': {
      const dias = ev.repete_dias?.length ? ev.repete_dias : [base.getDay()];
      return dias.includes(dia.getDay());
    }
    case 'mensal':
      return dia.getDate() === base.getDate();
    case 'anual':
      return dia.getDate() === base.getDate() && dia.getMonth() === base.getMonth();
    default:
      return false;
  }
}

/**
 * Transforma a lista do banco na lista de "vezes" que aparecem entre `de` e `ate`.
 * Eventos normais passam direto; repetidos viram uma cópia por dia, com:
 *   id: "<id>:<AAAA-MM-DD>", serie_id: id original, ocorrencia: "AAAA-MM-DD"
 */
export function expandir(eventos, de, ate) {
  const ini = new Date(de).getTime();
  const fim = new Date(ate).getTime();
  const saida = [];

  for (const ev of eventos) {
    const comeco = new Date(ev.inicio);
    const termino = new Date(ev.fim);

    if (!ev.repete) {
      if (comeco.getTime() < fim && termino.getTime() > ini) saida.push(ev);
      continue;
    }

    const duracao = termino - comeco;
    const excecoes = new Set(ev.excecoes || []);
    const limite = ev.repete_ate ? new Date(`${ev.repete_ate}T23:59:59`).getTime() : Infinity;

    // começa um pouco antes do intervalo, para pegar eventos que atravessam a meia-noite
    const diasAteInicio = Math.floor((ini - duracao - comeco.getTime()) / 86400000) - 1;
    let k = Math.max(0, diasAteInicio);

    for (let i = 0; i < 400; i++, k++) {
      const vez = new Date(comeco);
      vez.setDate(comeco.getDate() + k); // mantém a hora local, mesmo com horário de verão
      const t = vez.getTime();
      if (t >= fim || t > limite) break;
      if (t + duracao <= ini) continue;
      if (!caiNoDia(ev, comeco, vez)) continue;
      const chave = chaveDia(vez);
      if (excecoes.has(chave)) continue;
      saida.push({
        ...ev,
        id: `${ev.id}:${chave}`,
        serie_id: ev.id,
        ocorrencia: chave,
        inicio: vez.toISOString(),
        fim: new Date(t + duracao).toISOString(),
      });
    }
  }
  return saida;
}

// Texto curto da regra: "toda segunda e quarta", "todo dia 5", "todo ano"
export function descreverRepeticao(repete, dias, inicio) {
  const base = new Date(inicio);
  switch (repete) {
    case 'diario':
      return 'todo dia';
    case 'semanal': {
      const lista = (dias?.length ? dias : [base.getDay()]).slice().sort((a, b) => a - b).map((d) => NOMES_DIAS[d]);
      if (lista.length === 7) return 'todo dia';
      const junto = lista.length > 1 ? `${lista.slice(0, -1).join(', ')} e ${lista[lista.length - 1]}` : lista[0];
      const todo = lista.every((n) => n === 'sábado' || n === 'domingo') ? 'todo' : 'toda';
      return `${todo} ${junto}`;
    }
    case 'mensal':
      return `todo dia ${base.getDate()}`;
    case 'anual':
      return `todo ano em ${base.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}`;
    default:
      return '';
  }
}
