import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

// Carrega as agendas do usuário + membros de cada uma (com nome/cor do perfil)
export function useCalendars(usuario) {
  const [agendas, setAgendas] = useState([]);
  const [perfis, setPerfis] = useState({}); // id -> perfil
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    const { data: cals, error } = await supabase
      .from('calendars')
      .select('*, calendar_members(user_id, papel)')
      .order('compartilhada', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error(error);
      setCarregando(false);
      return;
    }

    const ids = [...new Set(cals.flatMap((c) => c.calendar_members.map((m) => m.user_id)))];
    const { data: profs } = await supabase.from('profiles').select('*').in('id', ids.length ? ids : [usuario.id]);
    setPerfis(Object.fromEntries((profs || []).map((p) => [p.id, p])));
    setAgendas(cals.map((c) => ({ ...c, membros: c.calendar_members })));
    setCarregando(false);
  }, [usuario.id]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  async function criarCompartilhada(nome, cor) {
    const { error } = await supabase
      .from('calendars')
      .insert({ nome, cor, compartilhada: true, owner_id: usuario.id });
    if (error) throw error;
    await recarregar();
  }

  async function entrarComCodigo(codigo) {
    const { error } = await supabase.rpc('entrar_na_agenda', { codigo });
    if (error) throw new Error(error.message.includes('inválido') ? 'Código de convite inválido.' : error.message);
    await recarregar();
  }

  async function sair(calendarId) {
    const { error } = await supabase
      .from('calendar_members')
      .delete()
      .match({ calendar_id: calendarId, user_id: usuario.id });
    if (error) throw error;
    await recarregar();
  }

  // só quem criou pode apagar; os eventos dela são apagados junto
  async function apagar(calendarId) {
    const { error } = await supabase.from('calendars').delete().eq('id', calendarId);
    if (error) throw error;
    await recarregar();
  }

  return { agendas, perfis, carregando, recarregar, criarCompartilhada, entrarComCodigo, sair, apagar };
}
