import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';
import Auth from './components/Auth.jsx';
import Agenda from './components/Agenda.jsx';

export default function App() {
  const [sessao, setSessao] = useState(undefined); // undefined = carregando

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => setSessao(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (sessao === undefined) return <div className="carregando">Carregando…</div>;
  if (!sessao) return <Auth />;
  return <Agenda usuario={sessao.user} />;
}
