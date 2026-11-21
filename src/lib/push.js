// Inscrição em notificações push (Web Push).
import { supabase } from './supabase.js';

const CHAVE_PUBLICA = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export const ehIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPad "desktop"

// O app foi aberto pelo ícone da Tela de Início?
export const estaInstalado = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

export const suportaPush = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// Converte a chave VAPID (base64url) para o formato que o navegador espera
function chaveParaBytes(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  return Uint8Array.from([...bin].map((c) => c.charCodeAt(0)));
}

export async function inscricaoAtual() {
  if (!suportaPush()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

// Precisa ser chamada a partir de um toque/clique do usuário (exigência do iPhone)
export async function ativarPush() {
  if (!CHAVE_PUBLICA) throw new Error('Falta VITE_VAPID_PUBLIC_KEY no .env');
  if (!suportaPush()) {
    throw new Error(ehIOS() ? 'No iPhone, instale o app na Tela de Início primeiro.' : 'Este navegador não suporta notificações.');
  }

  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') throw new Error('Permissão de notificação negada.');

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: chaveParaBytes(CHAVE_PUBLICA),
    });
  }

  const json = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent.slice(0, 200),
    },
    { onConflict: 'endpoint' }
  );
  if (error) throw error;
  return sub;
}

export async function desativarPush() {
  const sub = await inscricaoAtual();
  if (!sub) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}
