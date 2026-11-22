// Sino do topo: mostra o estado das notificações neste aparelho.
//  verde = ativas | pontinho coral = falta ativar | riscado = bloqueadas
export default function PushButton({ push, onAbrir }) {
  if (push.estado === 'carregando') return null;

  const rotulo = {
    ativo: 'Notificações ativas neste aparelho',
    ativar: 'Ativar notificações',
    instalar: 'Instale o app para receber notificações',
    negado: 'Notificações bloqueadas',
    'sem-suporte': 'Este navegador não recebe notificações',
  }[push.estado];

  return (
    <button className={`sino estado-${push.estado}`} onClick={onAbrir} aria-label={rotulo} title={rotulo}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2.2 2.2 0 0 0 4 0" />
        {(push.estado === 'negado' || push.estado === 'sem-suporte') && <path d="M4 4l16 16" />}
      </svg>
      {push.estado === 'ativo' && <span className="sino-ok" aria-hidden="true" />}
      <span className="sino-texto">{push.estado === 'ativo' ? 'Ativas' : push.estado === 'ativar' || push.estado === 'instalar' ? 'Ativar' : ''}</span>
    </button>
  );
}
