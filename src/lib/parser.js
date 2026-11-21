// Leitor de texto em português: transforma frases como
//   "jantar sexta 20h", "dentista amanhã às 14:30 por 2h",
//   "cinema dia 25 das 19h às 21h30", "aniversário da Eunice 12/12"
// em { titulo, inicio, fim, diaInteiro }.

import { addDias, inicioDoDia, HORA, MIN } from './dates.js';

// Remove acentos mantendo o MESMO tamanho da string,
// para que os índices dos matches valham no texto original.
function semAcento(s) {
  return [...s].map((c) => c.normalize('NFD')[0]).join('').toLowerCase();
}

const DIAS_SEMANA = [
  ['domingo'],
  ['segunda-feira', 'segunda'],
  ['terca-feira', 'terca'],
  ['quarta-feira', 'quarta'],
  ['quinta-feira', 'quinta'],
  ['sexta-feira', 'sexta'],
  ['sabado'],
];

const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const B = '(?<![\\p{L}\\d])'; // início de palavra
const E = '(?![\\p{L}\\d])';  // fim de palavra

function criarRemovedor(texto) {
  const norm = semAcento(texto);
  const usados = new Array(texto.length).fill(false);
  return {
    norm,
    // procura um regex no texto normalizado ainda não consumido
    achar(re) {
      const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
      let m;
      while ((m = r.exec(norm))) {
        const ini = m.index;
        const fim = ini + m[0].length;
        if (!usados.slice(ini, fim).some(Boolean)) {
          return { m, ini, fim };
        }
        if (m[0].length === 0) r.lastIndex++;
      }
      return null;
    },
    consumir({ ini, fim }) {
      for (let i = ini; i < fim; i++) usados[i] = true;
    },
    resto() {
      return [...texto].map((c, i) => (usados[i] ? ' ' : c)).join('');
    },
  };
}

function ajustarPeriodo(h, periodo) {
  if (!periodo) return h;
  if (/tarde|noite/.test(periodo) && h < 12) return h + 12;
  if (/madrugada|manha/.test(periodo) && h === 12) return 0;
  return h;
}

/**
 * @param {string} texto
 * @param {Date} [agora]
 */
export function interpretarTexto(texto, agora = new Date()) {
  const r = criarRemovedor(texto);
  const hoje = inicioDoDia(agora);
  let dia = null;
  let dataExplicita = false;

  // ---------- DATA ----------
  let x;
  if ((x = r.achar(new RegExp(`${B}depois de amanha${E}`, 'u')))) {
    dia = addDias(hoje, 2); r.consumir(x);
  } else if ((x = r.achar(new RegExp(`${B}amanha${E}`, 'u')))) {
    dia = addDias(hoje, 1); r.consumir(x);
  } else if ((x = r.achar(new RegExp(`${B}hoje${E}`, 'u')))) {
    dia = hoje; r.consumir(x);
  }

  if (!dia) {
    // 25/12 ou 25/12/2026
    x = r.achar(new RegExp(`${B}(?:dia |em |no dia )?(\\d{1,2})/(\\d{1,2})(?:/(\\d{2,4}))?${E}`, 'u'));
    if (x) {
      const [, d, m, a] = x.m;
      let ano = a ? Number(a.length === 2 ? '20' + a : a) : hoje.getFullYear();
      let cand = new Date(ano, Number(m) - 1, Number(d));
      if (!a && cand < hoje) cand = new Date(ano + 1, Number(m) - 1, Number(d));
      dia = cand; dataExplicita = true; r.consumir(x);
    }
  }

  if (!dia) {
    // 25 de dezembro
    x = r.achar(new RegExp(`${B}(?:dia |em |no dia )?(\\d{1,2}) de (${MESES.join('|')})${E}`, 'u'));
    if (x) {
      const d = Number(x.m[1]);
      const m = MESES.indexOf(x.m[2]);
      let cand = new Date(hoje.getFullYear(), m, d);
      if (cand < hoje) cand = new Date(hoje.getFullYear() + 1, m, d);
      dia = cand; dataExplicita = true; r.consumir(x);
    }
  }

  if (!dia) {
    // dia 25
    x = r.achar(new RegExp(`${B}dia (\\d{1,2})${E}`, 'u'));
    if (x) {
      const d = Number(x.m[1]);
      let cand = new Date(hoje.getFullYear(), hoje.getMonth(), d);
      if (cand < hoje) cand = new Date(hoje.getFullYear(), hoje.getMonth() + 1, d);
      dia = cand; dataExplicita = true; r.consumir(x);
    }
  }

  if (!dia) {
    // sexta, na próxima segunda, sábado que vem
    const nomes = DIAS_SEMANA.flat().join('|');
    x = r.achar(new RegExp(`${B}(?:(?:na|no|nesta|neste|nessa|nesse|essa|esse|esta|este)\\s+)?(proxima\\s+|proximo\\s+)?(${nomes})(\\s+que vem)?${E}`, 'u'));
    if (x) {
      const alvo = DIAS_SEMANA.findIndex((ns) => ns.includes(x.m[2]));
      let diff = (alvo - hoje.getDay() + 7) % 7;
      if ((x.m[1] || x.m[3]) && diff === 0) diff = 7;
      dia = addDias(hoje, diff); r.consumir(x);
    }
  }

  // ---------- HORA ----------
  const H = '(\\d{1,2})(?:h(\\d{2})?|:(\\d{2}))(?:\\s*min)?';
  const PER = '(?:\\s+da\\s+(manha|tarde|noite|madrugada))?';
  let ini = null; // minutos desde meia-noite
  let fimMin = null;

  // intervalo: "das 19h às 21h30", "9h-10h", "de 14:00 até 16:00"
  x = r.achar(new RegExp(`${B}(?:das |de )?${H}\\s*(?:as|a|-|ate)\\s*${H}${PER}${E}`, 'u'));
  if (x) {
    const [, h1, m1a, m1b, h2, m2a, m2b, per] = x.m;
    let a = ajustarPeriodo(Number(h1), per) * 60 + Number(m1a || m1b || 0);
    let b = ajustarPeriodo(Number(h2), per) * 60 + Number(m2a || m2b || 0);
    if (per && b < a) a -= 12 * 60; // "das 10 às 2 da tarde"
    if (b <= a) b += 24 * 60;       // passa da meia-noite
    ini = a; fimMin = b; r.consumir(x);
  }

  if (ini === null) {
    x = r.achar(new RegExp(`${B}(?:(?:as|a|ao)\\s+)?(meio[- ]dia|meia[- ]noite)${E}`, 'u'));
    if (x) {
      ini = x.m[1].startsWith('meio') ? 12 * 60 : 0;
      r.consumir(x);
    }
  }

  if (ini === null) {
    // "às 20h", "20h30", "14:30", "8h da noite"
    x = r.achar(new RegExp(`${B}(?:(?:as|a|para as|pras)\\s+)?${H}${PER}${E}`, 'u'));
    if (x) {
      const [, h, ma, mb, per] = x.m;
      const hh = ajustarPeriodo(Number(h), per);
      if (hh < 24) { ini = hh * 60 + Number(ma || mb || 0); r.consumir(x); }
    }
  }

  if (ini === null) {
    // "às 8 da noite" (sem h)
    x = r.achar(new RegExp(`${B}(?:as|a)\\s+(\\d{1,2})\\s+da\\s+(manha|tarde|noite|madrugada)${E}`, 'u'));
    if (x) {
      ini = ajustarPeriodo(Number(x.m[1]), x.m[2]) * 60; r.consumir(x);
    }
  }

  // duração: "por 2h", "por 1h30", "por 45 min", "por 2 horas"
  let duracao = null;
  x = r.achar(new RegExp(`${B}(?:por|durante)\\s+(\\d+)\\s*(?:h(?:oras?)?\\s*(\\d{1,2})?|(min(?:utos?)?))${E}`, 'u'));
  if (x) {
    const [, n, extra, ehMin] = x.m;
    duracao = ehMin ? Number(n) * MIN : Number(n) * HORA + Number(extra || 0) * MIN;
    r.consumir(x);
  }

  // ---------- TÍTULO ----------
  const LIXO = new Set(['as', 'às', 'a', 'à', 'na', 'no', 'em', 'de', 'do', 'da', 'dia', 'para', 'pra', 'e', '-', ',', '.']);
  let palavras = r.resto().split(/\s+/).filter(Boolean);
  while (palavras.length && LIXO.has(palavras[0].toLowerCase())) palavras.shift();
  while (palavras.length && LIXO.has(palavras[palavras.length - 1].toLowerCase())) palavras.pop();
  let titulo = palavras.join(' ').replace(/\s+([,.!?])/g, '$1');
  titulo = titulo ? titulo[0].toUpperCase() + titulo.slice(1) : 'Novo evento';

  // ---------- MONTAGEM ----------
  if (ini === null) {
    // sem hora => dia inteiro
    const d = dia || hoje;
    return {
      titulo,
      inicio: inicioDoDia(d),
      fim: addDias(inicioDoDia(d), 1),
      diaInteiro: true,
      entendeu: Boolean(dia),
      temData: Boolean(dia),
    };
  }

  let base = dia || hoje;
  let inicio = new Date(base.getTime() + ini * MIN);
  // só hora, sem data, e já passou? então é amanhã
  if (!dia && inicio < agora) {
    base = addDias(base, 1);
    inicio = new Date(base.getTime() + ini * MIN);
  }
  const fim = fimMin !== null
    ? new Date(base.getTime() + fimMin * MIN)
    : new Date(inicio.getTime() + (duracao ?? HORA));

  return { titulo, inicio, fim, diaInteiro: false, entendeu: true, dataExplicita, temData: Boolean(dia) };
}
