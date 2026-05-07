// ============================================================
//  pwa.js — PWA Install Toast + Push via OneSignal
// ============================================================

import { getSessao, showToast } from './config.js';

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

// PUSH — OneSignal
export async function inicializarPush() {
  const sessao = getSessao();
  if (!sessao) return;

  // Aguarda OneSignal carregar
  if (!window.OneSignal) {
    setTimeout(inicializarPush, 1000);
    return;
  }

  try {
    // Pede permissão de notificação via OneSignal
    const permission = await OneSignal.Notifications.requestPermission();
    if (!permission) return;

    // Aguarda subscription ser criada
    const pushSub = await OneSignal.User.PushSubscription;
    if (!pushSub || !pushSub.id) return;

    // Associa o usuário pelo e-mail como External ID
    await OneSignal.login(sessao.email);

    showToast('🔔 Notificações ativadas!', 'success');
  } catch (err) {
    console.log('OneSignal error:', err);
  }
}
