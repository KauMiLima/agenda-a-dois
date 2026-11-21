import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// No iPhone o teclado cobre a tela sem encolher a página.
// Guardamos a área que continua visível para as folhas e janelas ficarem acima do teclado.
function acompanharTeclado() {
  const vv = window.visualViewport;
  if (!vv) return;
  const raiz = document.documentElement;
  const atualizar = () => {
    raiz.style.setProperty('--vv-altura', `${vv.height}px`);
    raiz.style.setProperty('--vv-topo', `${vv.offsetTop}px`);
  };
  vv.addEventListener('resize', atualizar);
  vv.addEventListener('scroll', atualizar);
  atualizar();
}
acompanharTeclado();

// Registra o Service Worker (necessário para instalar o app e receber notificações)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.error('Service Worker:', err));
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
