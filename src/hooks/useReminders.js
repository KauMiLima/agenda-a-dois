import { useEffect, useRef } from 'react';
import { MIN, hora } from '../lib/dates.js';

const CHAVE = 'agenda-lembretes-avisados';

function lerAvisados() {
  try {
    return new Set(JSON.parse(localStorage.getItem(CHAVE) || '[]'));
  } catch {
    return new Set();
  }
}

function salvarAvisados(set) {
  try {
    // guarda só os últimos 200 para não crescer para sempre
    localStorage.setItem(CHAVE, JSON.stringify([...set].slice(-200)));
  } catch {
    /* sem armazenamento: tudo bem */
  }
}

export function pedirPermissaoNotificacao() {
  if ('Notification' in window && Notification.permission === 'default') {
    return Notification.requestPermission();
  }
  return Promise.resolve(window.Notification?.permission);
}

// Verifica a cada 30s se algum evento entrou na janela de lembrete.
// Funciona enquanto o app estiver aberto (em qualquer aba).
export function useReminders(eventos, onAviso, notificarNoSistema = true) {
  const notificar = useRef(notificarNoSistema);
  notificar.current = notificarNoSistema;
  const avisados = useRef(lerAvisados());
  const ultimo = useRef(eventos);
  ultimo.current = eventos;

  useEffect(() => {
    function verificar() {
      const agora = Date.now();
      for (const ev of ultimo.current) {
        if (ev.lembrete_min == null || ev.dia_inteiro) continue;
        const inicio = new Date(ev.inicio).getTime();
        const quando = inicio - ev.lembrete_min * MIN;
        const chave = `${ev.id}@${ev.inicio}`;
        if (agora >= quando && agora < inicio && !avisados.current.has(chave)) {
          avisados.current.add(chave);
          salvarAvisados(avisados.current);
          const faltam = Math.max(1, Math.round((inicio - agora) / MIN));
          const texto = `${ev.titulo} às ${hora(ev.inicio)} (em ${faltam} min)`;
          onAviso?.(texto);
          if (notificar.current && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification('Lembrete', { body: texto });
            } catch {
              /* alguns navegadores móveis não deixam criar direto */
            }
          }
        }
      }
    }
    verificar();
    const id = setInterval(verificar, 30 * 1000);
    return () => clearInterval(id);
  }, [onAviso]);
}
