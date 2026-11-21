import { useState } from 'react';
import { supabase } from '../lib/supabase.js';

export default function Auth() {
  const [modo, setModo] = useState('entrar'); // 'entrar' | 'cadastrar'
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [msg, setMsg] = useState(null);
  const [carregando, setCarregando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setMsg(null);
    setCarregando(true);
    try {
      if (modo === 'cadastrar') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: { data: { nome } },
        });
        if (error) throw error;
        if (!data.session) {
          setMsg({ tipo: 'ok', texto: 'Conta criada! Confirme pelo link que chegou no seu e-mail e depois entre.' });
          setModo('entrar');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
      }
    } catch (err) {
      setMsg({ tipo: 'erro', texto: traduzirErro(err.message) });
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="logo">
          <span className="logo-dot a" />
          <span className="logo-dot b" />
        </div>
        <h1>Agenda a Dois</h1>
        <p className="sub">Uma agenda só sua e uma que vocês dividem.</p>

        <form onSubmit={enviar}>
          {modo === 'cadastrar' && (
            <label>
              Seu nome
              <input value={nome} onChange={(e) => setNome(e.target.value)} required placeholder="Como quer ser chamado(a)" />
            </label>
          )}
          <label>
            E-mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Senha
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={6} />
          </label>
          {msg && <p className={`msg ${msg.tipo}`}>{msg.texto}</p>}
          <button className="btn primario" disabled={carregando}>
            {carregando ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <button className="link" onClick={() => setModo(modo === 'entrar' ? 'cadastrar' : 'entrar')}>
          {modo === 'entrar' ? 'Ainda não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
        </button>
      </div>
    </div>
  );
}

function traduzirErro(m) {
  if (/Invalid login/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/already registered/i.test(m)) return 'Esse e-mail já tem conta.';
  if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail antes de entrar.';
  if (/Password should be/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
  return m;
}
