import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { expandir } from '../lib/recorrencia.js';

// Busca os eventos de um intervalo (incluindo os que se repetem) e se inscreve
// no tempo real: quando a outra pessoa cria/edita/apaga, a lista atualiza sozinha.
export function useEvents(de, ate) {
  const [eventos, setEventos] = useState([]);
  const brutos = useRef([]); // como estão no banco (repetidos aparecem 1 vez)
  const intervalo = useRef({ de, ate });
  intervalo.current = { de, ate };

  const recarregar = useCallback(async () => {
    const { de, ate } = intervalo.current;
    const iniIso = de.toISOString();
    const fimIso = ate.toISOString();

    let { data, error } = await supabase
      .from('events')
      .select('*')
      .or(`and(repete.is.null,inicio.lt.${fimIso},fim.gt.${iniIso}),and(repete.not.is.null,inicio.lt.${fimIso})`)
      .order('inicio');

    // banco ainda sem as colunas de repetição (recorrencia.sql não rodou): busca do jeito antigo
    if (error && /repete/.test(error.message)) {
      ({ data, error } = await supabase.from('events').select('*').lt('inicio', fimIso).gt('fim', iniIso).order('inicio'));
    }
    if (error) return console.error(error);

    brutos.current = data;
    setEventos(expandir(data, de, ate).sort((a, b) => new Date(a.inicio) - new Date(b.inicio)));
  }, []);

  useEffect(() => {
    recarregar();
  }, [de.getTime(), ate.getTime(), recarregar]);

  useEffect(() => {
    const canal = supabase
      .channel('eventos-' + Math.random().toString(36).slice(2)) // nome único por uso do hook
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => recarregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [recarregar]);

  /**
   * Salva um evento. Se for uma das vezes de um evento repetido (_ocorrencia),
   * a mudança de horário é aplicada à série inteira.
   */
  async function salvar(evento) {
    const { id, _ocorrencia, ...campos } = evento;
    let inicio = new Date(campos.inicio);
    let fim = new Date(campos.fim);

    if (id && _ocorrencia) {
      const base = brutos.current.find((e) => e.id === id);
      if (base) {
        inicio = new Date(new Date(base.inicio).getTime() + (inicio - new Date(_ocorrencia.inicio)));
        fim = new Date(new Date(base.fim).getTime() + (fim - new Date(_ocorrencia.fim)));
      }
    }

    const payload = { ...campos, inicio: inicio.toISOString(), fim: fim.toISOString() };
    if (payload.repete !== undefined) payload.fuso = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const { error } = id
      ? await supabase.from('events').update(payload).eq('id', id)
      : await supabase.from('events').insert(payload);
    if (error) throw error;
    await recarregar();
  }

  // apaga o evento inteiro (ou a série inteira, se repetir)
  async function apagar(id) {
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) throw error;
    await recarregar();
  }

  // apaga só UMA vez de um evento repetido
  async function apagarOcorrencia(serieId, diaChave) {
    const base = brutos.current.find((e) => e.id === serieId);
    const excecoes = [...new Set([...(base?.excecoes || []), diaChave])];
    const { error } = await supabase.from('events').update({ excecoes }).eq('id', serieId);
    if (error) throw error;
    await recarregar();
  }

  return { eventos, recarregar, salvar, apagar, apagarOcorrencia };
}
