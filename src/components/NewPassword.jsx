import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import PasswordField from './PasswordField.jsx';

// Aparece quando a pessoa abre o link de "Esqueci minha senha" do e-mail
export default function NewPassword({ onPronto }) {
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres.');
    if (senha !== confirmacao) return setErro('As duas senhas não são iguais.');
    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);
    if (error) {
      if (/different from the old/i.test(error.message)) return setErro('A senha nova precisa ser diferente da antiga.');
      if (/expired|invalid/i.test(error.message)) return setErro('O link expirou. Peça um novo em "Esqueci minha senha".');
      return setErro(error.message);
    }
    // limpa o endereço (o link do e-mail deixa códigos nele)
    window.history.replaceState(null, '', window.location.pathname);
    onPronto();
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="logo encontro" aria-hidden="true">
          <span className="logo-dot a" />
          <span className="logo-dot b" />
        </div>
        <h1>Crie uma senha nova</h1>
        <p className="sub">Depois de salvar, você já entra no app com ela.</p>

        <form onSubmit={salvar}>
          <label>
            Nova senha
            <PasswordField value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" autoFocus />
          </label>
          <label>
            Repita a nova senha
            <PasswordField value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoComplete="new-password" />
          </label>
          {erro && <p className="msg erro" role="alert">{erro}</p>}
          <button className="btn primario" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar senha nova'}
          </button>
        </form>
      </div>
    </div>
  );
}
