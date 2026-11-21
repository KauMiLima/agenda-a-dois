// Utilitários de data — sem dependências externas.

export const MIN = 60 * 1000;
export const HORA = 60 * MIN;
export const DIA = 24 * HORA;

export function inicioDoDia(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDias(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// Semana começando no domingo (padrão no Brasil)
export function inicioDaSemana(d) {
  const x = inicioDoDia(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

export function mesmoDia(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const fmtHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const fmtDiaSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });
const fmtDataCurta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const fmtDataLonga = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtMesAno = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });

export const hora = (d) => fmtHora.format(new Date(d));
export const diaSemana = (d) => fmtDiaSemana.format(new Date(d)).replace('.', '');
export const dataCurta = (d) => fmtDataCurta.format(new Date(d));
const maiuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const dataLonga = (d) => maiuscula(fmtDataLonga.format(new Date(d)));
export const mesAno = (d) => maiuscula(fmtMesAno.format(new Date(d)));

// Converte Date -> valor de <input type="datetime-local">
export function paraInputLocal(d) {
  const x = new Date(d);
  const p = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`;
}

// Converte Date -> valor de <input type="date">
export function paraInputData(d) {
  return paraInputLocal(d).slice(0, 10);
}

export function duracaoTexto(ms) {
  const min = Math.round(ms / MIN);
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h${String(m).padStart(2, '0')}`;
  if (h) return `${h}h`;
  return `${m}min`;
}
