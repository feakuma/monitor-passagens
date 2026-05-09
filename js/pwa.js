// ============================================================
//  pwa.js — PWA Install Toast + Push via OneSignal
// ============================================================

import { getSessao, showToast } from ‘./config.js’;

let _deferredPrompt = null;
const _isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
const _isInStandalone = window.matchMedia(’(display-mode: standalone)’).matches || window.navigator.standalone;

// INSTALL TOAST
window.addEventListener(‘beforeinstallprompt’, e => {
e.preventDefault();
_deferredPrompt = e;
if (!_isInStandalone && !localStorage.getItem(‘pwa_install_dismissed’)) {
setTimeout(mostrarInstallToast, 3000);
}
});

export function mostrarInstallToast() {
if (_isInStandalone) return;
if (localStorage.getItem(‘pwa_install_dismissed’)) return;
const sessao = getSessao();
if (!sessao) return;
document.getElementById(‘install-toast’).classList.add(‘show’);
}

export function fecharInstallToast() {
document.getElementById(‘install-toast’).classList.remove(‘show’);
localStorage.setItem(‘pwa_install_dismissed’, ‘1’);
}

export function instalarPWA() {
if (_isIOS) { document.getElementById(‘ios-modal’).classList.add(‘open’); return; }
if (_deferredPrompt) {
_deferredPrompt.prompt();
_deferredPrompt.userChoice.then(result => {
if (result.outcome === ‘accepted’) fecharInstallToast();
_deferredPrompt = null;
});
}
}

// iOS manual
if (_isIOS && !_isInStandalone && !localStorage.getItem(‘pwa_install_dismissed’)) {
window.addEventListener(‘load’, () => {
const sessao = getSessao();
if (sessao) setTimeout(mostrarInstallToast, 3000);
});
}

// ============================================================
//  PUSH — OneSignal
// ============================================================

export function inicializarPush() {
const sessao = getSessao();
if (!sessao || !sessao.email) return;

const tentarInicializar = () => {
if (typeof OneSignal === ‘undefined’) { setTimeout(tentarInicializar, 500); return; }
window.OneSignalDeferred.push(async function(OneSignal) {
try {
await OneSignal.login(sessao.email);
atualizarStatusPush();
} catch (err) {
console.log(‘OneSignal init error:’, err);
}
});
};

setTimeout(tentarInicializar, 2000);
}

// Atualiza o status e botão na aba Config
export function atualizarStatusPush() {
const statusEl = document.getElementById(‘push-status’);
const btnEl    = document.getElementById(‘push-toggle-btn’);
if (!statusEl || !btnEl) return;

if (typeof OneSignal === ‘undefined’) {
statusEl.textContent = ‘não disponível neste browser’;
btnEl.style.display = ‘none’;
return;
}

window.OneSignalDeferred.push(async function(OneSignal) {
const permission = OneSignal.Notifications.permission;
const optedIn    = OneSignal.User.PushSubscription.optedIn;

```
if (permission && optedIn) {
  statusEl.textContent = '✅ Ativadas';
  btnEl.textContent = 'Desativar';
  btnEl.style.background = 'var(--bg3)';
  btnEl.style.color = 'var(--red)';
  btnEl.style.borderColor = '#4A1A1A';
} else if (permission === false) {
  statusEl.textContent = '❌ Bloqueadas pelo browser';
  btnEl.textContent = 'Como ativar';
  btnEl.style.background = 'var(--bg3)';
  btnEl.style.color = 'var(--text2)';
} else {
  statusEl.textContent = '○ Desativadas';
  btnEl.textContent = 'Ativar';
  btnEl.style.background = 'var(--green)';
  btnEl.style.color = '#fff';
  btnEl.style.border = 'none';
}
```

});
}

// Toggle push — ativa ou desativa
export function togglePush() {
if (typeof OneSignal === ‘undefined’) {
showToast(‘Push não disponível neste browser’, ‘error’);
return;
}

window.OneSignalDeferred.push(async function(OneSignal) {
const permission = OneSignal.Notifications.permission;
const optedIn    = OneSignal.User.PushSubscription.optedIn;

```
if (permission === false) {
  // Bloqueado pelo browser — instrui o usuário
  showToast('Habilite notificações nas configurações do browser', 'error');
  return;
}

if (permission && optedIn) {
  // Desativar
  await OneSignal.User.PushSubscription.optOut();
  showToast('Notificações desativadas', 'success');
} else {
  // Ativar — pede permissão
  const granted = await OneSignal.Notifications.requestPermission();
  if (granted) {
    await OneSignal.User.PushSubscription.optIn();
    showToast('🔔 Notificações ativadas!', 'success');
  } else {
    showToast('Permissão negada', 'error');
  }
}

setTimeout(atualizarStatusPush, 500);
```

});
}