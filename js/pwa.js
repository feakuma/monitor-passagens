// ============================================================
//  pwa.js — Push notifications e instalação PWA
// ============================================================

import { WORKER_URL, getSessao, showToast } from './config.js';

var _pushAtivo       = false;
var _deferredPrompt  = null;
var _isIOS           = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
var _isInStandalone  = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

// ── PUSH ──────────────────────────────────────────────────────

export async function inicializarPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (localStorage.getItem('push_negado')) return;
  var sessao = getSessao();
  if (!sessao) return;

  try {
    var reg = await navigator.serviceWorker.ready;

    var resp = await fetch(WORKER_URL + '/push/vapidkey');
    var { publicKey } = await resp.json();

    var existingSub = await reg.pushManager.getSubscription();
    if (existingSub) {
      _pushAtivo = true;
      await _salvarSubscription(existingSub, sessao.token);
      atualizarStatusPush();
      return;
    }

    var perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      localStorage.setItem('push_negado', '1');
      atualizarStatusPush();
      return;
    }

    var sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: _urlBase64ToUint8Array(publicKey)
    });

    await _salvarSubscription(sub, sessao.token);
    _pushAtivo = true;
    atualizarStatusPush();
    showToast('🔔 Notificações ativadas!', 'success');
  } catch (err) {
    console.log('Push error:', err);
  }
}

async function _salvarSubscription(sub, token) {
  await fetch(WORKER_URL + '/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify(sub.toJSON())
  });
}

export async function togglePush() {
  var sessao = getSessao();
  if (!sessao) return;

  if (_pushAtivo) {
    // Desativar
    try {
      var reg = await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await fetch(WORKER_URL + '/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessao.token },
          body: JSON.stringify({ endpoint: sub.endpoint })
        });
      }
      _pushAtivo = false;
      localStorage.setItem('push_negado', '1');
      showToast('Notificações desativadas', 'success');
    } catch (err) {
      showToast('Erro ao desativar', 'error');
    }
  } else {
    // Ativar
    localStorage.removeItem('push_negado');
    await inicializarPush();
  }
  atualizarStatusPush();
}

export async function atualizarStatusPush() {
  var statusEl = document.getElementById('push-status');
  var btnEl    = document.getElementById('push-toggle-btn');
  if (!statusEl || !btnEl) return;

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    statusEl.textContent = 'Não suportado neste navegador';
    btnEl.style.display  = 'none';
    return;
  }

  try {
    var reg = await navigator.serviceWorker.ready;
    var sub = await reg.pushManager.getSubscription();
    _pushAtivo = !!sub;
    if (_pushAtivo) {
      statusEl.textContent = 'Ativo — você receberá alertas de queda';
      btnEl.textContent    = 'Desativar';
      btnEl.style.background = 'var(--bg3)';
    } else {
      statusEl.textContent = 'Inativo';
      btnEl.textContent    = 'Ativar';
      btnEl.style.background = 'var(--bg3)';
    }
  } catch (err) {
    statusEl.textContent = 'Erro ao verificar status';
  }
}

function _urlBase64ToUint8Array(base64String) {
  var padding   = '='.repeat((4 - base64String.length % 4) % 4);
  var base64    = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  var rawData   = window.atob(base64);
  var outputArray = new Uint8Array(rawData.length);
  for (var i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// ── PWA INSTALL ───────────────────────────────────────────────

window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  _deferredPrompt = e;
  if (!_isInStandalone && !localStorage.getItem('pwa_install_dismissed')) {
    setTimeout(mostrarInstallToast, 3000);
  }
});

export function mostrarInstallToast() {
  if (_isInStandalone) return;
  if (localStorage.getItem('pwa_install_dismissed')) return;
  if (!getSessao()) return;
  document.getElementById('install-toast').classList.add('show');
}

export function fecharInstallToast() {
  document.getElementById('install-toast').classList.remove('show');
  localStorage.setItem('pwa_install_dismissed', '1');
}

export function instalarPWA() {
  if (_isIOS) {
    document.getElementById('ios-modal').classList.add('open');
    return;
  }
  if (_deferredPrompt) {
    _deferredPrompt.prompt();
    _deferredPrompt.userChoice.then(function (result) {
      if (result.outcome === 'accepted') fecharInstallToast();
      _deferredPrompt = null;
    });
  }
}

// iOS — mostra toast manual se ainda não instalou e não dispensou
if (_isIOS && !_isInStandalone && !localStorage.getItem('pwa_install_dismissed')) {
  window.addEventListener('load', function () {
    if (getSessao()) setTimeout(mostrarInstallToast, 3000);
  });
}
