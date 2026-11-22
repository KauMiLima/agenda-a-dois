import { useState } from 'react';
import { ehIOS } from '../lib/push.js';

/**
 * Convite para ativar as notificações. Abre sozinho depois de entrar na conta
 * (e quando a pessoa toca no sino). O botão "Ativar" é o toque que o iPhone
 * exige para mostrar o pedido de permissão do sistema.
 */
export default function NotifPrompt({ push, nomePar, avisar, onFechar, onAgoraNao }) {
  const [ativando, setAtivando] = useState(false);
  const [erro, setErro] = useState(null);

  async function ativar() {
    setAtivando(true);
    setErro(null);
    try {
      await push.ativar();
      avisar('Notificações ativadas neste aparelho.');
      onFechar();
    } catch (err) {
      setErro(err.message);
      setAtivando(false);
    }
  }

  const par = nomePar || 'seu par';

  return (
    <div className="fundo-folha" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div className="folha notif-folha" role="dialog" aria-labelledby="notif-titulo">
        <span className="folha-alca" aria-hidden="true" />

        <div className={`notif-sino ${push.estado}`} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2.2 2.2 0 0 0 4 0" />
            {push.estado === 'negado' && <path d="M4 4l16 16" />}
          </svg>
        </div>

        {push.estado === 'instalar' && (
          <>
            <h2 id="notif-titulo">Instale o app para receber avisos</h2>
            <p className="explica">No iPhone, as notificações só funcionam com o app na Tela de Início.</p>
            <ol className="passos">
              <li>Abra este site no <strong>Safari</strong>.</li>
              <li>Toque em <strong>Compartilhar</strong> <span className="icone-ios">⬆︎</span> na barra de baixo.</li>
              <li>Escolha <strong>Adicionar à Tela de Início</strong>.</li>
              <li>Abra o app pelo <strong>ícone novo</strong>. Este convite aparece de novo lá.</li>
            </ol>
            <div className="acoes">
              <span className="espaco" />
              <button className="btn primario" onClick={onAgoraNao}>Entendi</button>
            </div>
          </>
        )}

        {push.estado === 'ativar' && (
          <>
            <h2 id="notif-titulo">Ative as notificações</h2>
            <p className="explica">Assim você fica sabendo de tudo, mesmo com o app fechado:</p>
            <ul className="notif-lista">
              <li>Lembrete antes de cada compromisso</li>
              <li>Quando {par} propõe um programa ou responde o seu</li>
              <li>Quando {par} adiciona algo na agenda de vocês</li>
            </ul>
            <p className="dica">Você escolhe o que receber no menu da conta, quando quiser.</p>
            {erro && <p className="msg erro">{erro}</p>}
            <div className="acoes">
              <button className="btn btn-texto" onClick={onAgoraNao} disabled={ativando}>Agora não</button>
              <span className="espaco" />
              <button className="btn primario" onClick={ativar} disabled={ativando}>
                {ativando ? <><span className="girando" /> Ativando…</> : 'Ativar notificações'}
              </button>
            </div>
          </>
        )}

        {push.estado === 'ativo' && (
          <>
            <h2 id="notif-titulo">Notificações ativadas</h2>
            <p className="explica">Este aparelho recebe os lembretes e os avisos de {par}.</p>
            <div className="acoes">
              <button
                className="btn btn-texto"
                onClick={async () => {
                  await push.desativar();
                  avisar('Notificações desativadas neste aparelho.');
                  onFechar();
                }}
              >
                Desativar neste aparelho
              </button>
              <span className="espaco" />
              <button className="btn primario" onClick={onFechar}>Fechar</button>
            </div>
          </>
        )}

        {push.estado === 'negado' && (
          <>
            <h2 id="notif-titulo">Notificações bloqueadas</h2>
            <p className="explica">
              {ehIOS()
                ? 'Para liberar, vá em Ajustes do iPhone, Notificações, Agenda, e ative "Permitir Notificações". Depois volte para o app.'
                : 'Para liberar, clique no cadeado ao lado do endereço do site e permita as notificações. Depois recarregue a página.'}
            </p>
            <div className="acoes">
              <span className="espaco" />
              <button className="btn primario" onClick={onFechar}>Entendi</button>
            </div>
          </>
        )}

        {push.estado === 'sem-suporte' && (
          <>
            <h2 id="notif-titulo">Este navegador não recebe notificações</h2>
            <p className="explica">Use o Safari no iPhone (com o app na Tela de Início) ou o Chrome no computador ou no Android.</p>
            <div className="acoes">
              <span className="espaco" />
              <button className="btn primario" onClick={onFechar}>Entendi</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
