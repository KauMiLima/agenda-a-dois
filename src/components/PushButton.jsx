import { useEffect, useState } from 'react';
import { ativarPush, desativarPush, ehIOS, estaInstalado, inscricaoAtual, suportaPush } from '../lib/push.js';

function Sino() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2.2 2.2 0 0 0 4 0" />
    </svg>
  );
}

// Botão do topo: instala o app no iPhone e ativa as notificações.
// Um pontinho coral avisa quando as notificações ainda não estão ligadas.
export default function PushButton({ avisar, onMudar }) {
  const [estado, setEstado] = useState('carregando'); // carregando | instalar | ativar | ativo | negado | sem-suporte
  const [ajuda, setAjuda] = useState(false);

  async function atualizar() {
    if (ehIOS() && !estaInstalado()) return setEstado('instalar');
    if (!suportaPush()) return setEstado('sem-suporte');
    if (Notification.permission === 'denied') return setEstado('negado');
    const sub = await inscricaoAtual();
    setEstado(sub ? 'ativo' : 'ativar');
  }

  useEffect(() => {
    atualizar();
  }, []);

  useEffect(() => {
    onMudar?.(estado === 'ativo');
  }, [estado]);

  async function ativar() {
    try {
      await ativarPush();
      setEstado('ativo');
      avisar('Notificações ativadas neste aparelho.');
    } catch (err) {
      avisar(err.message);
      atualizar();
    }
  }

  async function desativar() {
    if (!confirm('Desativar as notificações neste aparelho?')) return;
    await desativarPush();
    setEstado('ativar');
  }

  if (estado === 'carregando' || estado === 'sem-suporte') return null;

  return (
    <>
      {estado === 'instalar' && (
        <button className="sino pendente" onClick={() => setAjuda(true)} aria-label="Instalar o app para receber notificações" title="Instalar o app para receber notificações">
          <Sino />
        </button>
      )}
      {estado === 'ativar' && (
        <button className="sino pendente" onClick={ativar} aria-label="Ativar notificações" title="Ativar notificações">
          <Sino />
        </button>
      )}
      {estado === 'ativo' && (
        <button className="sino" onClick={desativar} aria-label="Notificações ativas neste aparelho" title="Notificações ativas neste aparelho">
          <Sino />
        </button>
      )}
      {estado === 'negado' && (
        <button className="sino bloqueado" onClick={() => setAjuda(true)} aria-label="Notificações bloqueadas" title="Notificações bloqueadas">
          <Sino />
        </button>
      )}

      {ajuda && (
        <div className="fundo-modal" onMouseDown={(e) => e.target === e.currentTarget && setAjuda(false)}>
          <div className="modal ajuda">
            {estado === 'instalar' ? (
              <>
                <h3>Instalar no iPhone</h3>
                <p>Para receber notificações, o app precisa estar na sua Tela de Início:</p>
                <ol>
                  <li>Abra este site no <strong>Safari</strong>.</li>
                  <li>Toque em <strong>Compartilhar</strong> <span className="icone-ios">⬆︎</span> na barra de baixo.</li>
                  <li>Escolha <strong>Adicionar à Tela de Início</strong> e confirme.</li>
                  <li>Abra o app pelo <strong>ícone novo</strong> e toque em <strong>🔔 Ativar notificações</strong>.</li>
                </ol>
                <p className="dica">Precisa do iOS 16.4 ou mais recente.</p>
              </>
            ) : (
              <>
                <h3>Notificações bloqueadas</h3>
                <p>
                  {ehIOS()
                    ? 'Vá em Ajustes › Notificações › Agenda e ative "Permitir Notificações".'
                    : 'Libere as notificações deste site nas configurações do navegador (ícone de cadeado ao lado do endereço).'}
                </p>
              </>
            )}
            <div className="acoes">
              <span className="espaco" />
              <button className="btn primario" onClick={() => setAjuda(false)}>Entendi</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
