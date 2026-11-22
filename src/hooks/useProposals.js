import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

// Propostas de programa das agendas compartilhadas, com tempo real.
// Traz as pendentes e as respondidas nos últimos 14 dias.
export function useProposals(usuario) {
  const [propostas, setPropostas] = useState([]);
  const [disponivel, setDisponivel] = useState(true); // false se propostas.sql ainda não rodou

  const recarregar = useCallback(async () => {
    const desde = new Date(Date.now() - 14 * 86400000).toISOString();
    const { data, error } = await supabase
      .from('propostas')
      .select('*')
      .or(`status.eq.pendente,created_at.gte.${desde}`)
      .order('created_at', { ascending: false });
    if (error) {
      if (/propostas/.test(error.message)) setDisponivel(false);
      else console.error(error);
      return;
    }
    setDisponivel(true);
    setPropostas(data);
  }, []);

  useEffect(() => {
    recarregar();
    const canal = supabase
      .channel('propostas-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'propostas' }, () => recarregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [recarregar]);

  async function chamar(promessa) {
    const { data, error } = await promessa;
    if (error) throw new Error(error.message);
    await recarregar();
    return data;
  }

  const propor = (p) =>
    chamar(
      supabase.from('propostas').insert({
        calendar_id: p.calendar_id,
        titulo: p.titulo,
        local: p.local || null,
        mensagem: p.mensagem || null,
        inicio: new Date(p.inicio).toISOString(),
        fim: new Date(p.fim).toISOString(),
      })
    );

  const aceitar = (id) => chamar(supabase.rpc('aceitar_proposta', { pid: id }));
  const recusar = (id, recado) => chamar(supabase.rpc('responder_proposta', { pid: id, acao: 'recusar', recado: recado || null }));
  const cancelar = (id) => chamar(supabase.rpc('responder_proposta', { pid: id, acao: 'cancelar' }));
  const contrapropor = (id, p) =>
    chamar(
      supabase.rpc('contrapropor', {
        pid: id,
        novo_inicio: new Date(p.inicio).toISOString(),
        novo_fim: new Date(p.fim).toISOString(),
        recado: p.mensagem || null,
      })
    );

  const pendentes = propostas.filter((p) => p.status === 'pendente');
  return {
    disponivel,
    propostas,
    paraResponder: pendentes.filter((p) => p.criado_por !== usuario.id), // o par está esperando você
    aguardando: pendentes.filter((p) => p.criado_por === usuario.id), // você está esperando o par
    propor,
    aceitar,
    recusar,
    cancelar,
    contrapropor,
  };
}
