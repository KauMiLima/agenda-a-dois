import { useEffect, useState } from 'react';
import { ativarPush, desativarPush, ehIOS, estaInstalado, inscricaoAtual, suportaPush } from '../lib/push.js';

// Botão do topo: instala o app no iPhone e ativa as notificações.
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
        <button className="btn pequeno destaque" onClick={() => setAjuda(true)}>
          📲<span className="so-desktop"> Instalar app</span>
        </button>
      )}
      {estado === 'ativar' && (
        <button className="btn pequeno destaque" onClick={ativar}>
          🔔<span className="so-desktop"> Ativar notificações</span>
        </button>
      )}
      {estado === 'ativo' && (
        <button className="btn pequeno" onClick={desativar} title="Notificações ativas neste aparelho">
          🔔<span className="so-desktop"> Ativas</span>
        </button>
      )}
      {estado === 'negado' && (
        <button className="btn pequeno" onClick={() => setAjuda(true)} title="Notificações bloqueadas">
          🔕
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
