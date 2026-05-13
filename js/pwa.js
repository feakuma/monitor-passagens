// ============================================================
//  pwa.js — Push notifications e instalação PWA
// ============================================================

import { WORKER_URL, getSessao, showToast } from './config.js';

var _pushAtivo      = false;
var _deferredPrompt = null;
var _isIOS          = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
var _isInStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

// Chaves de localStorage escopadas por usuário — evita que flags de um
// usuário afetem outro na mesma máquina/browser
function _keyPush()    { var s = getSessao(); return 'push_negado_'    + (s ? s.usuario.email : 'anon'); }
function _keyInstall() { var s = getSessao(); return 'pwa_dismissed_'  + (s ? s.usuario.email : 'anon'); }

// ── PUSH ──────────────────────────────────────────────────────

export async function inicializarPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  var sessao = getSessao();
  if (!sessao) return;
  if (localStorage.getItem(_keyPush())) return;

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
      localStorage.setItem(_keyPush(), '1');
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
    try {
      var reg = await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await fetch(WORKER_URL + '/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessao.token }
        });
      }
      _pushAtivo = false;
      localStorage.setItem(_keyPush(), '1');
      showToast('Notificações desativadas', 'success');
    } catch (err) {
      showToast('Erro ao desativar', 'error');
    }
  } else {
    localStorage.removeItem(_keyPush());
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
      statusEl.textContent   = 'Ativo — você receberá alertas de queda';
      btnEl.textContent      = 'Desativar';
    } else {
      statusEl.textContent   = 'Inativo';
      btnEl.textContent      = 'Ativar';
    }
  } catch (err) {
    statusEl.textContent = 'Erro ao verificar status';
  }
}

function _urlBase64ToUint8Array(base64String) {
  var padding    = '='.repeat((4 - base64String.length % 4) % 4);
  var base64     = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  var rawData    = window.atob(base64);
  var outputArray = new Uint8Array(rawData.length);
  for (var i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// ── PWA INSTALL ───────────────────────────────────────────────

window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  _deferredPrompt = e;
  if (!_isInStandalone && !localStorage.getItem(_keyInstall())) {
    setTimeout(mostrarInstallToast, 3000);
  }
});

export function mostrarInstallToast() {
  if (_isInStandalone) return;
  if (localStorage.getItem(_keyInstall())) return;
  if (!getSessao()) return;
  document.getElementById('install-toast').classList.add('show');
}

export function fecharInstallToast() {
  document.getElementById('install-toast').classList.remove('show');
  localStorage.setItem(_keyInstall(), '1');
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

// iOS — mostra toast se não instalou e não dispensou
if (_isIOS && !_isInStandalone) {
  window.addEventListener('load', function () {
    if (getSessao() && !localStorage.getItem(_keyInstall())) {
      setTimeout(mostrarInstallToast, 3000);
    }
  });
}

// ── PULL TO REFRESH ───────────────────────────────────────────

(function () {
  // Só ativa no modo PWA standalone
  if (!window.matchMedia('(display-mode: standalone)').matches && !window.navigator.standalone) return;

  var _startY      = 0;
  var _pulling     = false;
  var _threshold   = 80;  // px para disparar o refresh
  var _indicator   = null;

  // Cria o indicador visual
  function _criarIndicador() {
    var el = document.createElement('div');
    el.id  = 'ptr-indicator';
    el.style.cssText = [
      'position:fixed',
      'top:-70px',
      'left:50%',
      'transform:translateX(-50%)',
      'width:52px',
      'height:52px',
      'transition:top 0.15s ease',
      'z-index:9999',
      'pointer-events:none',
    ].join(';');
    var img = document.createElement('img');
    img.src = '/OTRii.gif';
    img.style.cssText = 'width:100%;height:100%;opacity:0.85;';
    el.appendChild(img);
    document.body.appendChild(el);
    return el;
  }

  document.addEventListener('touchstart', function (e) {
    // Só inicia se estiver no topo da página
    if (window.scrollY !== 0) return;
    _startY  = e.touches[0].clientY;
    _pulling = true;
    if (!_indicator) _indicator = _criarIndicador();
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    if (!_pulling) return;
    var dy = e.touches[0].clientY - _startY;
    if (dy <= 0) { _pulling = false; return; }

    // Move o indicador conforme o pull
    var progress = Math.min(dy, _threshold * 1.5);
    var top      = Math.min(progress - 60, 20);
    _indicator.style.top = top + 'px';

    // Aumenta opacidade quando atingir threshold
    if (_indicator) {
      var img2 = _indicator.querySelector('img');
      if (img2) img2.style.opacity = dy >= _threshold ? '1' : '0.5';
    }
  }, { passive: true });

  document.addEventListener('touchend', function (e) {
    if (!_pulling || !_indicator) return;
    _pulling = false;

    var dy = e.changedTouches[0].clientY - _startY;

    if (dy >= _threshold) {
      // Dispara refresh — anima antes de recarregar
      _indicator.style.top       = '20px';
      // O GIF já é animado — só mantém visível

      setTimeout(function () {
        // Em vez de recarregar a página, recarrega os alertas
        if (window.carregarAlertas) {
          window.carregarAlertas().then(function () {
            if (window.renderAlertas)      window.renderAlertas();
            if (window.renderHistorico)    window.renderHistorico();
            if (window.renderConfigAlertas) window.renderConfigAlertas();
          });
        }
        // Esconde o indicador
        _indicator.style.top = '-60px';
      }, 600);
    } else {
      // Não atingiu threshold — volta o indicador
      _indicator.style.top       = '-60px';
      _indicator.style.transform = 'translateX(-50%)';
    }
  }, { passive: true });
})();
