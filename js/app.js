// ============================================================
//  app.js — Entry point: inicializa o app e orquestra os módulos
// ============================================================

import { getSessao } from './config.js';
import { carregarAlertas } from './api.js';
import {
  mostrarTelaLogin, mostrarLanding, ocultarTelaLogin,
  verificarConviteURL
} from './auth.js';
import {
  showTab, updateClock,
  renderAlertas, renderHistorico, renderConfigAlertas
} from './ui.js';
import { initEvents } from './events.js';
import {
  inicializarPush, mostrarInstallToast
} from './pwa.js';

// ── WIRING — deve ocorrer antes do boot ───────────────────────

initEvents();

// ── CUSTOM EVENTS ─────────────────────────────────────────────

// auth.js → login bem-sucedido
document.addEventListener('passagens:login-success', function () {
  inicializarApp();
});

// api.js → sessão expirada (401)
document.addEventListener('passagens:session-expired', function () {
  mostrarTelaLogin();
});

// pwa.js PTR → pull-to-refresh disparou
document.addEventListener('passagens:reload', function () {
  carregarAlertas().then(function () {
    renderAlertas();
    renderHistorico();
    renderConfigAlertas();
  });
});

// ── EVENT LISTENERS GLOBAIS ───────────────────────────────────

// Fecha dropdowns de autocomplete ao clicar fora
document.addEventListener('click', function (e) {
  if (!e.target.closest('.autocomplete-wrap')) {
    document.querySelectorAll('.autocomplete-dropdown').forEach(function (d) {
      d.classList.remove('open'); d.innerHTML = '';
    });
  }
});

// Fecha overlay do calendário ao clicar no backdrop
document.getElementById('cal-overlay').addEventListener('click', function (e) {
  if (e.target === this) this.classList.remove('open');
});

// ── CLOCK ─────────────────────────────────────────────────────

updateClock();
setInterval(updateClock, 10000);

// ── INICIALIZAR APP ───────────────────────────────────────────

export function inicializarApp() {
  var sessao = getSessao();
  if (sessao) {
    ocultarTelaLogin();
    if (sessao.usuario && sessao.usuario.isAdmin) {
      document.getElementById('tab-admin-btn').style.display = '';
      document.getElementById('nav-admin-btn').style.display = '';
      document.getElementById('nav-dash-btn').style.display  = '';
    }
    var emailEl = document.getElementById('sessao-email');
    if (emailEl && sessao.usuario) emailEl.textContent = sessao.usuario.email;

    carregarAlertas().then(function () {
      renderAlertas();
      renderHistorico();
      renderConfigAlertas();
    });

    setTimeout(inicializarPush, 3000);
    if (!localStorage.getItem('pwa_install_dismissed')) setTimeout(mostrarInstallToast, 5000);
  } else {
    mostrarLanding();
  }
}

// ── BOOT ──────────────────────────────────────────────────────

if (!verificarConviteURL()) {
  inicializarApp();
}

// ── POLLING ───────────────────────────────────────────────────
// Não dispara requests quando a aba está em background (economiza bateria e
// cota do Worker). Ao voltar para a aba, recarrega se passaram > 2 minutos.

var _ultimoPolling = Date.now();

setInterval(function () {
  if (document.visibilityState !== 'visible') return; // aba oculta — pula
  var sessao = getSessao();
  if (!sessao) return;
  _ultimoPolling = Date.now();
  carregarAlertas().then(function () { renderAlertas(); renderHistorico(); });
}, 5 * 60 * 1000);

document.addEventListener('visibilitychange', function () {
  if (document.visibilityState !== 'visible') return;
  var sessao = getSessao();
  if (!sessao) return;
  // Recarrega ao voltar para a aba somente se passou mais de 2 minutos
  if (Date.now() - _ultimoPolling > 2 * 60 * 1000) {
    _ultimoPolling = Date.now();
    carregarAlertas().then(function () { renderAlertas(); renderHistorico(); });
  }
});

// ── SERVICE WORKER ────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js')
      .then(function (reg) { console.log('SW registrado:', reg.scope); })
      .catch(function (err) { console.log('SW erro:', err); });
  });
}
