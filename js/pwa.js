// ============================================================
//  pwa.js — PWA Install Toast + Push Notifications
// ============================================================

import { WORKER_URL, getSessao, showToast } from './config.js';

let _deferredPrompt = null;
const _isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
const _isInStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

// INSTALL TOAST
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _deferredPrompt = e;
  if (!_isInStandalone && !localStorage.getItem('pwa_install_dismissed')) {
    setTimeout(mostrarInstallToast, 3000);
  }
});

export function mostrarInstallToast() {
  if (_isInStandalone) return;
  if (localStorage.getItem('pwa_install_dismissed')) return;
  const sessao = getSessao();
  if (!sessao) return;
  document.getElementById('install-toast').classList.add('show');
}

export function fecharInstallToast() {
  document.getElementById('install-toast').classList.remove('show');
  localStorage.setItem('pwa_install_dismissed', '1');
}

export function instalarPWA() {
  if (_isIOS) { document.getElementById('ios-modal').classList.add('open'); return; }
  if (_deferredPrompt) {
    _deferredPrompt.prompt();
    _deferredPrompt.userChoice.then(result => {
      if (result.outcome === 'accepted') fecharInstallToast();
      _deferredPrompt = null;
    });
  }
}

// iOS manual
if (_isIOS && !_isInStandalone && !localStorage.getItem('pwa_install_dismissed')) {
  window.addEventListener('load', () => {
    const sessao = getSessao();
    if (sessao) setTimeout(mostrarInstallToast, 3000);
  });
}

// PUSH NOTIFICATIONS
let _pushAtivo = false;

export async function inicializarPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (localStorage.getItem('push_negado')) return;
  const sessao = getSessao();
  if (!sessao) return;

  try {
    const reg  = await navigator.serviceWorker.ready;
    const resp = await fetch(WORKER_URL + '/push/vapidkey');
    const { publicKey } = await resp.json();

    const existingSub = await reg.pushManager.getSubscription();
    if (existingSub) {
      _pushAtivo = true;
      await salvarSubscription(existingSub, sessao.token);
      return;
    }

    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { localStorage.setItem('push_negado', '1'); return; }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    await salvarSubscription(sub, sessao.token);
    _pushAtivo = true;
    showToast('🔔 Notificações ativadas!', 'success');
  } catch (err) {
    console.log('Push error:', err);
  }
}

async function salvarSubscription(sub, token) {
  await fetch(WORKER_URL + '/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify(sub.toJSON())
  });
}

function urlBase64ToUint8Array(base64String) {
  const padding  = '='.repeat((4 - base64String.length % 4) % 4);
  const base64   = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData  = window.atob(base64);
  const output   = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}
