import { useState } from 'react';
import { supabase } from '../lib/supabase.js';

// Folha da conta: dados do usuário, trocar senha e sair
export default function AccountSheet({ usuario, nome, perfil, push, onAbrirNotif, onPerfilSalvo, avisar, onFechar }) {
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

        <Notificacoes usuario={usuario} perfil={perfil} push={push} onAbrirNotif={onAbrirNotif} onSalvo={onPerfilSalvo} avisar={avisar} />

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

const HORAS = Array.from({ length: 24 }, (_, h) => h);

// Preferências de notificação DESTA pessoa (cada usuário tem as suas)
function Notificacoes({ usuario, perfil, push, onAbrirNotif, onSalvo, avisar }) {
  const [salvando, setSalvando] = useState(null);
  const pronto = perfil && perfil.notif_lembretes !== undefined;

  async function salvar(campos, chave) {
    setSalvando(chave);
    const { error } = await supabase.from('profiles').update(campos).eq('id', usuario.id);
    setSalvando(null);
    if (error) return avisar('Não foi possível salvar: ' + error.message);
    await onSalvo?.();
  }

  if (!pronto) {
    return <p className="msg erro">Para escolher suas notificações, rode o arquivo supabase/notificacoes.sql no Supabase.</p>;
  }

  const temSilencio = perfil.silencio_inicio != null && perfil.silencio_fim != null;

  return (
    <section className="notif">
      <h3>Suas notificações</h3>
      {push && <EstadoAparelho push={push} onAbrir={onAbrirNotif} />}
      <p className="dica">Escolha o que receber. Vale só para você; seu par escolhe as próprias no celular.</p>

      <Interruptor
        titulo="Lembretes dos eventos"
        texto="Aviso antes de cada evento, no tempo escolhido em cada um."
        ligado={perfil.notif_lembretes}
        salvando={salvando === 'lembretes'}
        onMudar={(v) => salvar({ notif_lembretes: v }, 'lembretes')}
      />
      <Interruptor
        titulo="Quando seu par adicionar algo"
        texto="Aviso quando alguém cria um evento numa agenda compartilhada com você."
        ligado={perfil.notif_par}
        salvando={salvando === 'par'}
        onMudar={(v) => salvar({ notif_par: v }, 'par')}
      />
      <Interruptor
        titulo="Silêncio à noite"
        texto="Não receber avisos do par nesse horário. Os lembretes continuam chegando."
        ligado={temSilencio}
        salvando={salvando === 'silencio'}
        onMudar={(v) => salvar(v ? { silencio_inicio: 22, silencio_fim: 7 } : { silencio_inicio: null, silencio_fim: null }, 'silencio')}
      />
      {temSilencio && (
        <div className="linha-2 silencio">
          <label>
            Das
            <select value={perfil.silencio_inicio} onChange={(e) => salvar({ silencio_inicio: Number(e.target.value) }, 'silencio')}>
              {HORAS.map((h) => <option key={h} value={h}>{h}h</option>)}
            </select>
          </label>
          <label>
            Até
            <select value={perfil.silencio_fim} onChange={(e) => salvar({ silencio_fim: Number(e.target.value) }, 'silencio')}>
              {HORAS.map((h) => <option key={h} value={h}>{h}h</option>)}
            </select>
          </label>
        </div>
      )}
    </section>
  );
}

// faixa que mostra se ESTE aparelho recebe notificações
function EstadoAparelho({ push, onAbrir }) {
  if (push.estado === 'carregando') return null;
  const textos = {
    ativo: ['Ativadas neste aparelho', 'Você recebe lembretes e avisos mesmo com o app fechado.', null],
    ativar: ['Desativadas neste aparelho', 'Você não está recebendo lembretes nem avisos.', 'Ativar'],
    instalar: ['Desativadas neste aparelho', 'No iPhone, instale o app na Tela de Início primeiro.', 'Como instalar'],
    negado: ['Bloqueadas neste aparelho', 'A permissão foi negada nos ajustes.', 'Como liberar'],
    'sem-suporte': ['Indisponíveis neste navegador', 'Use o Safari no iPhone ou o Chrome.', null],
  }[push.estado];
  return (
    <div className={`estado-aparelho estado-${push.estado}`}>
      <span className="estado-icone" aria-hidden="true">{push.estado === 'ativo' ? '✓' : '!'}</span>
      <span>
        <strong>{textos[0]}</strong>
        <small>{textos[1]}</small>
      </span>
      {textos[2] && (
        <button type="button" className={`btn pequeno ${push.estado === 'ativar' ? 'primario' : ''}`} onClick={onAbrir}>
          {textos[2]}
        </button>
      )}
    </div>
  );
}

function Interruptor({ titulo, texto, ligado, salvando, onMudar }) {
  return (
    <label className="interruptor">
      <span>
        <strong>{titulo}</strong>
        <small>{texto}</small>
      </span>
      <span className="chave-wrap">
        {salvando && <span className="girando" />}
        <input type="checkbox" role="switch" className="chave" checked={ligado} disabled={salvando} onChange={(e) => onMudar(e.target.checked)} />
      </span>
    </label>
  );
}

function traduzirErro(m) {
  if (/different from the old/i.test(m)) return 'A senha nova precisa ser diferente da atual.';
  if (/at least|should be/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/reauthentication|nonce/i.test(m)) return 'Por segurança, saia da conta, entre de novo e tente outra vez.';
  if (/weak|pwned/i.test(m)) return 'Essa senha é muito fácil de adivinhar. Escolha outra.';
  return m;
}
