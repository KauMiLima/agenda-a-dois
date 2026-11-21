import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';

// Busca os eventos de um intervalo e se inscreve no tempo real:
// quando a outra pessoa cria/edita/apaga, a lista atualiza sozinha.
export function useEvents(de, ate) {
  const [eventos, setEventos] = useState([]);
  const intervalo = useRef({ de, ate });
  intervalo.current = { de, ate };

  const recarregar = useCallback(async () => {
    const { de, ate } = intervalo.current;
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .lt('inicio', ate.toISOString())
      .gt('fim', de.toISOString())
      .order('inicio');
    if (error) console.error(error);
    else setEventos(data);
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

  async function salvar(evento) {
    const { id, ...campos } = evento;
    const payload = {
      ...campos,
      inicio: new Date(campos.inicio).toISOString(),
      fim: new Date(campos.fim).toISOString(),
    };
    const { error } = id
      ? await supabase.from('events').update(payload).eq('id', id)
      : await supabase.from('events').insert(payload);
    if (error) throw error;
    await recarregar();
  }

  async function apagar(id) {
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) throw error;
    await recarregar();
  }

  return { eventos, recarregar, salvar, apagar };
}
