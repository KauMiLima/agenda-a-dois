import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';
import Auth from './components/Auth.jsx';
import Agenda from './components/Agenda.jsx';
import NewPassword from './components/NewPassword.jsx';

export default function App() {
  const [sessao, setSessao] = useState(undefined); // undefined = carregando
  // abriu pelo link de "Esqueci minha senha"?
  const [recuperando, setRecuperando] = useState(() => window.location.hash.includes('type=recovery'));

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      if (evento === 'PASSWORD_RECOVERY') setRecuperando(true);
      setSessao(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (sessao === undefined) return <div className="carregando">Carregando…</div>;
  if (recuperando && sessao) return <NewPassword onPronto={() => setRecuperando(false)} />;
  if (!sessao) return <Auth />;
  return <Agenda usuario={sessao.user} />;
}
