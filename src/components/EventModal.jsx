import { useState } from 'react';
import { addDias, inicioDoDia, paraInputData, paraInputLocal } from '../lib/dates.js';
import { descreverRepeticao } from '../lib/recorrencia.js';

const LEMBRETES = [
  [null, 'Sem lembrete'],
  [5, '5 min antes'],
  [10, '10 min antes'],
  [15, '15 min antes'],
  [30, '30 min antes'],
  [60, '1 hora antes'],
  [120, '2 horas antes'],
  [1440, '1 dia antes'],
];

const REPETIR = [
  ['', 'Não repete'],
  ['diario', 'Todo dia'],
  ['semanal', 'Toda semana'],
  ['mensal', 'Todo mês'],
  ['anual', 'Todo ano'],
];

const LETRAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const NOMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export default function EventModal({ evento, agendas, perfis, onSalvar, onApagar, onApagarOcorrencia, onFechar }) {
  // se for uma das vezes de um evento repetido, editamos a série
  const ehSerie = Boolean(evento.serie_id);
  const [f, setF] = useState(() => ({
    id: evento.serie_id || evento.id,
    titulo: evento.titulo || '',
    calendar_id: evento.calendar_id || agendas[0]?.id,
    dia_inteiro: Boolean(evento.dia_inteiro),
    inicio: new Date(evento.inicio),
    fim: new Date(evento.fim),
    local: evento.local || '',
    descricao: evento.descricao || '',
    lembrete_min: evento.lembrete_min === undefined ? 30 : evento.lembrete_min,
    repete: evento.repete || '',
    repete_dias: evento.repete_dias || null,
    repete_ate: evento.repete_ate || '',
  }));
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [apagando, setApagando] = useState(false); // mostra as opções de apagar de um repetido

  const set = (campo) => (e) => setF({ ...f, [campo]: e.target.value });

  function mudarData(campo, valor) {
    if (!valor) return;
    let d = f.dia_inteiro ? new Date(valor + 'T00:00') : new Date(valor);
    if (f.dia_inteiro && campo === 'fim') d = addDias(d, 1); // fim exclusivo
    const novo = { ...f, [campo]: d };
    // se mover o início, mantém a duração
    if (campo === 'inicio') {
      const dur = f.fim - f.inicio;
      novo.fim = new Date(d.getTime() + dur);
    }
    setF(novo);
  }

  function alternarDiaInteiro(e) {
    const marcado = e.target.checked;
    if (marcado) {
      const ini = inicioDoDia(f.inicio);
      setF({ ...f, dia_inteiro: true, inicio: ini, fim: addDias(ini, 1) });
    } else {
      const ini = new Date(inicioDoDia(f.inicio).getTime() + 9 * 3600e3);
      setF({ ...f, dia_inteiro: false, inicio: ini, fim: new Date(ini.getTime() + 3600e3) });
    }
  }

  function mudarRepeticao(e) {
    const valor = e.target.value;
    setF({ ...f, repete: valor, repete_dias: valor === 'semanal' ? f.repete_dias || [f.inicio.getDay()] : null });
  }

  function alternarDiaSemana(d) {
    const atuais = f.repete_dias || [f.inicio.getDay()];
    const novos = atuais.includes(d) ? atuais.filter((x) => x !== d) : [...atuais, d].sort((a, b) => a - b);
    if (novos.length === 0) return; // pelo menos um dia
    setF({ ...f, repete_dias: novos });
  }

  async function salvar(e) {
    e.preventDefault();
    if (f.fim <= f.inicio) return setErro('O fim precisa ser depois do início.');
    setSalvando(true);
    try {
      const { id, repete, repete_dias, repete_ate, ...resto } = f;
      const dados = {
        ...(id ? { id } : {}),
        ...resto,
        titulo: f.titulo.trim() || 'Sem título',
        lembrete_min: f.dia_inteiro || f.lembrete_min == null || f.lembrete_min === 'null' ? null : Number(f.lembrete_min),
        local: f.local || null,
        descricao: f.descricao || null,
      };
      // só manda os campos de repetição quando eles importam
      if (repete || evento.repete) {
        dados.repete = repete || null;
        dados.repete_dias = repete === 'semanal' ? repete_dias || [f.inicio.getDay()] : null;
        dados.repete_ate = repete && repete_ate ? repete_ate : null;
      }
      if (ehSerie) dados._ocorrencia = { inicio: evento.inicio, fim: evento.fim };
      await onSalvar(dados);
      onFechar();
    } catch (err) {
      setErro(err.message);
      setSalvando(false);
    }
  }

  async function apagar() {
    if (ehSerie) return setApagando(true);
    if (!confirm('Apagar este evento?')) return;
    await onApagar(f.id);
    onFechar();
  }

  async function apagarSoEste() {
    await onApagarOcorrencia(evento.serie_id, evento.ocorrencia);
    onFechar();
  }

  async function apagarTodos() {
    await onApagar(evento.serie_id);
    onFechar();
  }

  const criador = evento.criado_por && perfis[evento.criado_por];
  const fimMostrado = f.dia_inteiro ? addDias(f.fim, -1) : f.fim;
  const diasSemana = f.repete_dias || [f.inicio.getDay()];

  return (
    <div className="fundo-modal" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <form className="modal" onSubmit={salvar}>
        <input
          className="titulo-input"
          autoFocus={!evento.id}
          placeholder="Título do evento"
          value={f.titulo}
          onChange={set('titulo')}
        />

        {ehSerie && (
          <p className="aviso-serie">
            ↻ Este evento se repete ({descreverRepeticao(evento.repete, evento.repete_dias, evento.inicio)}). As mudanças valem para todas as vezes.
          </p>
        )}

        <label>
          Agenda
          <select value={f.calendar_id} onChange={set('calendar_id')}>
            {agendas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.compartilhada ? '♥ ' : ''}
                {a.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="check">
          <input type="checkbox" checked={f.dia_inteiro} onChange={alternarDiaInteiro} />
          Dia inteiro
        </label>

        <div className="linha-2">
          <label>
            Início
            {f.dia_inteiro ? (
              <input type="date" value={paraInputData(f.inicio)} onChange={(e) => mudarData('inicio', e.target.value)} />
            ) : (
              <input type="datetime-local" value={paraInputLocal(f.inicio)} onChange={(e) => mudarData('inicio', e.target.value)} />
            )}
          </label>
          <label>
            Fim
            {f.dia_inteiro ? (
              <input type="date" value={paraInputData(fimMostrado)} onChange={(e) => mudarData('fim', e.target.value)} />
            ) : (
              <input type="datetime-local" value={paraInputLocal(f.fim)} onChange={(e) => mudarData('fim', e.target.value)} />
            )}
          </label>
        </div>

        <label>
          Repetir
          <select value={f.repete} onChange={mudarRepeticao}>
            {REPETIR.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>

        {f.repete === 'semanal' && (
          <div className="dias-semana" role="group" aria-label="Dias da semana">
            {LETRAS.map((l, d) => (
              <button
                type="button"
                key={d}
                className={diasSemana.includes(d) ? 'ativo' : ''}
                aria-pressed={diasSemana.includes(d)}
                aria-label={NOMES[d]}
                onClick={() => alternarDiaSemana(d)}
              >
                {l}
              </button>
            ))}
          </div>
        )}

        {f.repete && (
          <label>
            Repetir até (opcional)
            <input type="date" value={f.repete_ate} min={paraInputData(f.inicio)} onChange={set('repete_ate')} />
            <small className="dica">Deixe em branco para repetir sempre.</small>
          </label>
        )}

        {!f.dia_inteiro && (
          <label>
            Lembrete
            <select value={String(f.lembrete_min)} onChange={set('lembrete_min')}>
              {LEMBRETES.map(([v, t]) => (
                <option key={String(v)} value={String(v)}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        )}

        <details className="mais-campos" open={Boolean(evento.local || evento.descricao)}>
          <summary>Local e observações</summary>
          <label>
            Local
            <input value={f.local} onChange={set('local')} placeholder="Opcional" />
          </label>
          <label>
            Observações
            <textarea rows={3} value={f.descricao} onChange={set('descricao')} placeholder="Opcional" />
          </label>
        </details>

        {criador && <p className="meta">Criado por {criador.nome}</p>}
        {erro && <p className="msg erro">{erro}</p>}

        {apagando ? (
          <div className="acoes apagar-serie">
            <p>Este evento se repete. O que você quer apagar?</p>
            <div className="botoes-linha">
              <button type="button" className="btn perigo" onClick={apagarSoEste}>Só este dia</button>
              <button type="button" className="btn perigo" onClick={apagarTodos}>Todas as vezes</button>
              <button type="button" className="btn" onClick={() => setApagando(false)}>Voltar</button>
            </div>
          </div>
        ) : (
          <div className="acoes">
            {f.id && (
              <button type="button" className="btn perigo" onClick={apagar}>
                Apagar
              </button>
            )}
            <span className="espaco" />
            <button type="button" className="btn" onClick={onFechar}>
              Cancelar
            </button>
            <button className="btn primario" disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
