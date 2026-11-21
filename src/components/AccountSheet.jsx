import { useState } from 'react';
import { supabase } from '../lib/supabase.js';

// Folha da conta: dados do usuário, trocar senha e sair
export default function AccountSheet({ usuario, nome, avisar, onFechar }) {
  const [trocando, setTrocando] = useState(false);
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [ver, setVer] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  async function salvarSenha(e) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres.');
    if (senha !== confirmacao) return setErro('As duas senhas não são iguais.');

    setSalvando(true);
    // o Supabase troca a senha de quem está logado, sem precisar de e-mail
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);

    if (error) return setErro(traduzirErro(error.message));
    setSenha('');
    setConfirmacao('');
    setTrocando(false);
    avisar('Senha alterada.');
  }

  return (
    <div className="fundo-folha" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div className="folha">
        <span className="folha-alca" aria-hidden="true" />
        <div className="conta">
          <span className="avatar grande">{nome.slice(0, 1).toUpperCase()}</span>
          <span>
            <strong>{nome}</strong>
            <small>{usuario.email}</small>
          </span>
        </div>

        {!trocando ? (
          <button className="opcao-conta" onClick={() => setTrocando(true)}>
            <span>
              <strong>Alterar senha</strong>
              <small>Escolha uma senha nova para entrar no app</small>
            </span>
            <span aria-hidden="true">›</span>
          </button>
        ) : (
          <form className="form-senha" onSubmit={salvarSenha}>
            <h3>Nova senha</h3>
            <label>
              Nova senha
              <input
                type={ver ? 'text' : 'password'}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="new-password"
                autoFocus
                minLength={6}
                required
              />
            </label>
            <label>
              Repita a nova senha
              <input
                type={ver ? 'text' : 'password'}
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                autoComplete="new-password"
                required
              />
            </label>
            <label className="check">
              <input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} />
              Mostrar senha
            </label>
            <p className="dica">Mínimo de 6 caracteres. Você continua logado neste aparelho.</p>
            {erro && <p className="msg erro">{erro}</p>}
            <div className="acoes">
              <button type="button" className="btn" onClick={() => { setTrocando(false); setErro(null); }} disabled={salvando}>
                Cancelar
              </button>
              <span className="espaco" />
              <button className="btn primario" disabled={salvando}>
                {salvando ? <><span className="girando" /> Salvando…</> : 'Salvar senha'}
              </button>
            </div>
          </form>
        )}

        <div className="acoes">
          <button className="btn" onClick={onFechar}>Fechar</button>
          <span className="espaco" />
          <button className="btn perigo" onClick={() => supabase.auth.signOut()}>Sair da conta</button>
        </div>
      </div>
    </div>
  );
}

function traduzirErro(m) {
  if (/different from the old/i.test(m)) return 'A senha nova precisa ser diferente da atual.';
  if (/at least|should be/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/reauthentication|nonce/i.test(m)) return 'Por segurança, saia da conta, entre de novo e tente outra vez.';
  if (/weak|pwned/i.test(m)) return 'Essa senha é muito fácil de adivinhar. Escolha outra.';
  return m;
}
