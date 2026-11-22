import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import PasswordField from './PasswordField.jsx';

const TITULOS = {
  entrar: 'A sua agenda e a de vocês dois, no mesmo lugar.',
  cadastrar: 'Crie sua conta. Depois é só convidar seu par.',
  recuperar: 'Digite o e-mail da sua conta. Enviamos um link para você criar uma senha nova.',
};

export default function Auth() {
  const [modo, setModo] = useState('entrar'); // 'entrar' | 'cadastrar' | 'recuperar'
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [msg, setMsg] = useState(null);
  const [carregando, setCarregando] = useState(false);

  function irPara(novo) {
    setModo(novo);
    setMsg(null);
  }

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
      } else if (modo === 'recuperar') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setMsg({
          tipo: 'ok',
          texto: `Se ${email.trim()} tiver uma conta, o link chega em alguns minutos. Confira também a caixa de spam.`,
        });
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

  const textoBotao = { entrar: 'Entrar', cadastrar: 'Criar conta', recuperar: 'Enviar link' }[modo];

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="logo encontro" aria-hidden="true">
          <span className="logo-dot a" />
          <span className="logo-dot b" />
        </div>
        <h1>{modo === 'recuperar' ? 'Esqueceu a senha?' : 'Agenda a Dois'}</h1>
        <p className="sub">{TITULOS[modo]}</p>

        <form onSubmit={enviar}>
          {modo === 'cadastrar' && (
            <label>
              Seu nome
              <input value={nome} onChange={(e) => setNome(e.target.value)} required placeholder="Como quer ser chamado(a)" />
            </label>
          )}
          <label>
            E-mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>
          {modo !== 'recuperar' && (
            <label>
              <span className="rotulo-senha">
                Senha
                {modo === 'entrar' && (
                  <button type="button" className="link pequeno" onClick={() => irPara('recuperar')}>
                    Esqueci minha senha
                  </button>
                )}
              </span>
              <PasswordField
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
              />
            </label>
          )}
          {msg && <p className={`msg ${msg.tipo}`} role="status">{msg.texto}</p>}
          <button className="btn primario" disabled={carregando}>
            {carregando ? 'Aguarde…' : textoBotao}
          </button>
        </form>

        {modo === 'recuperar' ? (
          <button className="link" onClick={() => irPara('entrar')}>Lembrei a senha. Voltar para entrar</button>
        ) : (
          <button className="link" onClick={() => irPara(modo === 'entrar' ? 'cadastrar' : 'entrar')}>
            {modo === 'entrar' ? 'Ainda não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
          </button>
        )}
      </div>
    </div>
  );
}

function traduzirErro(m) {
  if (/Invalid login/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/already registered/i.test(m)) return 'Esse e-mail já tem conta.';
  if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail antes de entrar.';
  if (/Password should be/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/not authorized/i.test(m)) return 'O envio de e-mails ainda não está liberado para esse endereço. Fale com quem administra o app.';
  if (/rate limit|too many|security purposes/i.test(m)) return 'Muitos pedidos seguidos. Espere alguns minutos e tente de novo.';
  return m;
}
