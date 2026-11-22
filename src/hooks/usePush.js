import { useCallback, useEffect, useState } from 'react';
import { ativarPush, desativarPush, ehIOS, estaInstalado, inscricaoAtual, suportaPush } from '../lib/push.js';

/**
 * Estado das notificações NESTE aparelho:
 *  'carregando' | 'instalar' (iPhone fora da Tela de Início) | 'ativar' | 'ativo' | 'negado' | 'sem-suporte'
 */
export function usePush() {
  const [estado, setEstado] = useState('carregando');

  const atualizar = useCallback(async () => {
    if (ehIOS() && !estaInstalado()) return setEstado('instalar');
    if (!suportaPush()) return setEstado('sem-suporte');
    if (Notification.permission === 'denied') return setEstado('negado');
    try {
      const sub = await inscricaoAtual();
      setEstado(sub ? 'ativo' : 'ativar');
    } catch {
      setEstado('ativar');
    }
  }, []);

  useEffect(() => {
    atualizar();
    // voltou para o app (ex.: depois de mudar nos Ajustes do iPhone): confere de novo
    const aoVoltar = () => document.visibilityState === 'visible' && atualizar();
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, [atualizar]);

  // precisa ser chamado a partir de um toque (exigência do iPhone)
  async function ativar() {
    try {
      await ativarPush();
      setEstado('ativo');
    } finally {
      if (Notification?.permission === 'denied') setEstado('negado');
    }
  }

  async function desativar() {
    await desativarPush();
    setEstado('ativar');
  }

  return { estado, ativo: estado === 'ativo', ativar, desativar, atualizar };
}
