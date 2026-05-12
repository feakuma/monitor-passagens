// ============================================================
//  app.js — Entry point: expõe funções ao window, inicializa o app
// ============================================================

import { getSessao } from './config.js';
import { carregarAlertas } from './api.js';
import {
  mostrarTelaLogin, ocultarTelaLogin,
  solicitarOTP, verificarOTP, voltarParaEmail,
  verificarConviteURL, criarContaConvite, _executarCriarContaConvite,
  logout
} from './auth.js';
import {
  showTab, updateClock,
  renderAlertas, renderHistorico, renderConfigAlertas,
  adicionarAlerta, removerAlerta, solicitarAnalise,
  doAutocomplete, pickAirport
} from './ui.js';
import { openCal, calNav, selectDay, confirmCal } from './calendar.js';
import {
  renderConfigs, editarConfigs, cancelarEditConfigs, salvarConfigs,
  editarConfigIA, cancelarEditConfigIA, salvarConfigIA,
  adminEditarLimite,
  resetPrompt, toggleTokenVisibility, removerTokenIA,
  carregarUsuarios, adminEnviarConvite, adminCriarUsuario,
  _executarCriarUsuarioManual, adminToggleIA, adminToggleAtivo, adminRemoverUsuario
} from './admin.js';
import {
  inicializarPush, togglePush, atualizarStatusPush,
  mostrarInstallToast, fecharInstallToast, instalarPWA
} from './pwa.js';

// ── EXPÕE AO WINDOW ───────────────────────────────────────────

window.solicitarOTP          = solicitarOTP;
window.verificarOTP          = verificarOTP;
window.voltarParaEmail       = voltarParaEmail;
window.logout                = logout;
window.mostrarTelaLogin      = mostrarTelaLogin;
window.criarContaConvite     = criarContaConvite;

window.showTab               = showTab;
window.adicionarAlerta       = adicionarAlerta;
window.removerAlerta         = removerAlerta;
window.solicitarAnalise      = solicitarAnalise;
window.doAutocomplete        = doAutocomplete;
window.pickAirport           = pickAirport;

window.openCal               = openCal;
window.calNav                = calNav;
window.selectDay             = selectDay;
window.confirmCal            = confirmCal;

window.renderConfigs         = renderConfigs;
window.editarConfigs         = editarConfigs;
window.cancelarEditConfigs   = cancelarEditConfigs;
window.salvarConfigs         = salvarConfigs;
window.editarConfigIA        = editarConfigIA;
window.cancelarEditConfigIA  = cancelarEditConfigIA;
window.salvarConfigIA        = salvarConfigIA;
window.resetPrompt           = resetPrompt;
window.toggleTokenVisibility = toggleTokenVisibility;
window.removerTokenIA        = removerTokenIA;

window.carregarUsuarios      = carregarUsuarios;
window.adminEnviarConvite    = adminEnviarConvite;
window.adminCriarUsuario     = adminCriarUsuario;
window.adminEditarLimite     = adminEditarLimite;
window.adminToggleIA         = adminToggleIA;
window.adminToggleAtivo      = adminToggleAtivo;
window.adminRemoverUsuario   = adminRemoverUsuario;

window.inicializarPush       = inicializarPush;
window.togglePush            = togglePush;
window.atualizarStatusPush   = atualizarStatusPush;
window.instalarPWA           = instalarPWA;
window.fecharInstallToast    = fecharInstallToast;

// ── MODAL SEM CHAT ID ─────────────────────────────────────────

window._pendingNome = null;
window._pendingTipo = null;

window.confirmarSemChatId = function () {
  document.getElementById('modal-sem-chatid').style.display = 'none';
  if (window._pendingTipo === 'convite') {
    _executarCriarContaConvite(window._pendingNome, '');
  } else if (window._pendingTipo === 'manual') {
    _executarCriarUsuarioManual();
  }
};

window.fecharModalSemChatId = function () {
  document.getElementById('modal-sem-chatid').style.display = 'none';
  window._pendingNome = null;
  window._pendingTipo = null;
};

// ── EVENT LISTENERS ───────────────────────────────────────────

document.addEventListener('click', function (e) {
  if (!e.target.closest('.autocomplete-wrap')) {
    document.querySelectorAll('.autocomplete-dropdown').forEach(function (d) {
      d.classList.remove('open'); d.innerHTML = '';
    });
  }
});

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
    mostrarTelaLogin();
  }
}

window.inicializarApp = inicializarApp;

// ── BOOT ──────────────────────────────────────────────────────

if (!verificarConviteURL()) {
  inicializarApp();
}

setInterval(function () {
  var sessao = getSessao();
  if (sessao) {
    carregarAlertas().then(function () { renderAlertas(); renderHistorico(); });
  }
}, 5 * 60 * 1000);

// ── SERVICE WORKER ────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js')
      .then(function (reg) { console.log('SW registrado:', reg.scope); })
      .catch(function (err) { console.log('SW erro:', err); });
  });
}
