// ============================================================
//  events.js — Centraliza todo o wiring de eventos
//              estáticos (addEventListener) + delegação dinâmica (data-action)
// ============================================================

import {
  mostrarFormLogin, solicitarOTP, verificarOTP, voltarParaEmail,
  criarContaConvite, _executarCriarContaConvite, logout
} from './auth.js';
import {
  showTab, adicionarAlerta, removerAlerta, solicitarAnalise,
  doAutocomplete, pickAirport
} from './ui.js';
import { openCal, calNav, selectDay, confirmCal } from './calendar.js';
import {
  renderConfigs, editarConfigs, cancelarEditConfigs, salvarConfigs,
  editarConfigIA, cancelarEditConfigIA, salvarConfigIA,
  resetPrompt, toggleTokenVisibility, removerTokenIA,
  carregarUsuarios, adminEnviarConvite, adminCriarUsuario,
  _executarCriarUsuarioManual,
  adminAbrirEdicao, adminSalvarEdicao, adminFecharEdicao,
  adminReenviarConvite, adminCancelarConvite,
  adminToggleAtivo, adminRemoverUsuario,
  adminVerAlertas, fecharModalAlertasUsuario,
  adminVerAudit, fecharModalAudit, recarregarAudit,
  carregarDashboard
} from './admin.js';
import {
  togglePush, instalarPWA, fecharInstallToast, atualizarStatusPush
} from './pwa.js';

// ── ESTADO MODAL SEM CHAT ID ──────────────────────────────────
// Centralizado aqui; auth.js e admin.js apenas despacham 'passagens:set-pending'

var _pendingNome = null;
var _pendingTipo = null;

function _confirmarSemChatId() {
  document.getElementById('modal-sem-chatid').style.display = 'none';
  var tipo = _pendingTipo;
  var nome = _pendingNome;
  _pendingNome = null;
  _pendingTipo = null;
  if (tipo === 'convite') {
    _executarCriarContaConvite(nome, '');
  } else if (tipo === 'manual') {
    _executarCriarUsuarioManual();
  }
}

function _fecharModalSemChatId() {
  document.getElementById('modal-sem-chatid').style.display = 'none';
  _pendingNome = null;
  _pendingTipo = null;
}

// ── INIT ──────────────────────────────────────────────────────

export function initEvents() {

  // ── LANDING ────────────────────────────────────────────────
  document.querySelectorAll('[data-action="mostrar-form-login"]').forEach(function (el) {
    el.addEventListener('click', mostrarFormLogin);
  });

  // ── LOGIN / OTP ────────────────────────────────────────────
  var loginEmail = document.getElementById('login-email');
  if (loginEmail) loginEmail.addEventListener('keyup', function (e) {
    if (e.key === 'Enter') solicitarOTP();
  });

  var btnSolicitarOTP = document.getElementById('btn-solicitar-otp');
  if (btnSolicitarOTP) btnSolicitarOTP.addEventListener('click', function () { solicitarOTP(); });

  var loginOTP = document.getElementById('login-otp');
  if (loginOTP) loginOTP.addEventListener('keyup', function (e) {
    if (e.key === 'Enter') verificarOTP();
  });

  var btnVerificarOTP = document.getElementById('btn-verificar-otp');
  if (btnVerificarOTP) btnVerificarOTP.addEventListener('click', verificarOTP);

  var btnVoltarEmail = document.getElementById('btn-voltar-email');
  if (btnVoltarEmail) btnVoltarEmail.addEventListener('click', voltarParaEmail);

  var btnReenviarOTP = document.getElementById('btn-reenviar-otp');
  if (btnReenviarOTP) btnReenviarOTP.addEventListener('click', function () { solicitarOTP(true); });

  var btnCriarConta = document.getElementById('btn-criar-conta');
  if (btnCriarConta) btnCriarConta.addEventListener('click', criarContaConvite);

  // ── NAVEGAÇÃO (top tabs + bottom nav) ──────────────────────
  // Ambos usam data-tab="nome" — um único selector serve os dois
  document.querySelectorAll('[data-tab]').forEach(function (el) {
    el.addEventListener('click', function () { showTab(el.dataset.tab); });
  });

  // ── AUTOCOMPLETE ───────────────────────────────────────────
  var inputOrigem = document.getElementById('input-origem');
  if (inputOrigem) {
    inputOrigem.addEventListener('input', function () { doAutocomplete(this, 'origem'); });
    inputOrigem.addEventListener('keyup', function () { doAutocomplete(this, 'origem'); });
  }

  var inputDestino = document.getElementById('input-destino');
  if (inputDestino) {
    inputDestino.addEventListener('input', function () { doAutocomplete(this, 'destino'); });
    inputDestino.addEventListener('keyup', function () { doAutocomplete(this, 'destino'); });
  }

  // ── CALENDÁRIO (abrir) ─────────────────────────────────────
  var dateRowPeriodo = document.getElementById('date-row-periodo');
  if (dateRowPeriodo) dateRowPeriodo.addEventListener('click', function () { openCal(); });

  // ── ADICIONAR ALERTA ───────────────────────────────────────
  var btnAdicionar = document.getElementById('btn-adicionar');
  if (btnAdicionar) btnAdicionar.addEventListener('click', adicionarAlerta);

  // ── CONFIG ─────────────────────────────────────────────────
  var btnSalvarCfg = document.getElementById('btn-salvar-cfg');
  if (btnSalvarCfg) btnSalvarCfg.addEventListener('click', salvarConfigs);

  var btnCancelarCfg = document.getElementById('btn-cancelar-cfg');
  if (btnCancelarCfg) btnCancelarCfg.addEventListener('click', cancelarEditConfigs);

  var btnEditarCfg = document.getElementById('btn-editar-cfg');
  if (btnEditarCfg) btnEditarCfg.addEventListener('click', editarConfigs);

  var btnTokenVis = document.getElementById('btn-token-visibility');
  if (btnTokenVis) btnTokenVis.addEventListener('click', toggleTokenVisibility);

  var btnResetPrompt = document.getElementById('btn-reset-prompt');
  if (btnResetPrompt) btnResetPrompt.addEventListener('click', resetPrompt);

  var btnSalvarIA = document.getElementById('btn-salvar-ia');
  if (btnSalvarIA) btnSalvarIA.addEventListener('click', salvarConfigIA);

  var btnCancelarIA = document.getElementById('btn-cancelar-ia');
  if (btnCancelarIA) btnCancelarIA.addEventListener('click', cancelarEditConfigIA);

  var btnRemoverToken = document.getElementById('btn-remover-token-ia');
  if (btnRemoverToken) btnRemoverToken.addEventListener('click', removerTokenIA);

  var btnEditarIA = document.getElementById('btn-editar-ia');
  if (btnEditarIA) btnEditarIA.addEventListener('click', editarConfigIA);

  // ── PUSH / LOGOUT ──────────────────────────────────────────
  var pushToggle = document.getElementById('push-toggle-btn');
  if (pushToggle) pushToggle.addEventListener('click', togglePush);

  var btnLogout = document.getElementById('btn-logout');
  if (btnLogout) btnLogout.addEventListener('click', logout);

  // ── ADMIN ──────────────────────────────────────────────────
  var btnEnviarConvite = document.getElementById('btn-enviar-convite');
  if (btnEnviarConvite) btnEnviarConvite.addEventListener('click', adminEnviarConvite);

  var btnCriarUsuario = document.getElementById('btn-criar-usuario');
  if (btnCriarUsuario) btnCriarUsuario.addEventListener('click', adminCriarUsuario);

  // ── DASHBOARD ──────────────────────────────────────────────
  var dashPeriodo = document.getElementById('dash-periodo');
  if (dashPeriodo) dashPeriodo.addEventListener('change', carregarDashboard);

  var btnDashRefresh = document.getElementById('btn-dash-refresh');
  if (btnDashRefresh) btnDashRefresh.addEventListener('click', carregarDashboard);

  // ── MODAL EDITAR USUÁRIO ────────────────────────────────────
  var btnSalvarEdicao = document.getElementById('btn-salvar-edicao');
  if (btnSalvarEdicao) btnSalvarEdicao.addEventListener('click', adminSalvarEdicao);

  var btnFecharEdicao = document.getElementById('btn-fechar-edicao');
  if (btnFecharEdicao) btnFecharEdicao.addEventListener('click', adminFecharEdicao);

  // ── MODAL SEM CHAT ID ──────────────────────────────────────
  var btnConfirmar = document.getElementById('btn-confirmar-sem-chatid');
  if (btnConfirmar) btnConfirmar.addEventListener('click', _confirmarSemChatId);

  var btnFecharSemChat = document.getElementById('btn-fechar-sem-chatid');
  if (btnFecharSemChat) btnFecharSemChat.addEventListener('click', _fecharModalSemChatId);

  // ── CALENDÁRIO (navegar + confirmar) ────────────────────────
  var calNavPrev = document.getElementById('cal-nav-prev');
  if (calNavPrev) calNavPrev.addEventListener('click', function () { calNav(-1); });

  var calNavNext = document.getElementById('cal-nav-next');
  if (calNavNext) calNavNext.addEventListener('click', function () { calNav(1); });

  var calConfirmBtn = document.getElementById('cal-confirm');
  if (calConfirmBtn) calConfirmBtn.addEventListener('click', confirmCal);

  // ── PWA INSTALL TOAST ───────────────────────────────────────
  var btnInstalar = document.getElementById('btn-instalar-pwa');
  if (btnInstalar) btnInstalar.addEventListener('click', instalarPWA);

  var btnFecharInstall = document.getElementById('btn-fechar-install-toast');
  if (btnFecharInstall) btnFecharInstall.addEventListener('click', fecharInstallToast);

  var btnIosOk = document.getElementById('btn-ios-modal-ok');
  if (btnIosOk) btnIosOk.addEventListener('click', function () {
    document.getElementById('ios-modal').classList.remove('open');
    fecharInstallToast();
  });

  var iosModal = document.getElementById('ios-modal');
  if (iosModal) iosModal.addEventListener('click', function (e) {
    if (e.target === this) this.classList.remove('open');
  });

  // ── MODAIS BACKDROP ─────────────────────────────────────────
  var modalAudit = document.getElementById('modal-audit-usuario');
  if (modalAudit) modalAudit.addEventListener('click', function (e) {
    if (e.target === this) fecharModalAudit();
  });

  var modalAlertas = document.getElementById('modal-alertas-usuario');
  if (modalAlertas) modalAlertas.addEventListener('click', function (e) {
    if (e.target === this) fecharModalAlertasUsuario();
  });

  // ── AUDITORIA ───────────────────────────────────────────────
  var auditPeriodo = document.getElementById('audit-periodo');
  if (auditPeriodo) auditPeriodo.addEventListener('change', recarregarAudit);

  var btnFecharAudit = document.getElementById('btn-fechar-audit');
  if (btnFecharAudit) btnFecharAudit.addEventListener('click', fecharModalAudit);

  var btnFecharAlertasModal = document.getElementById('btn-fechar-alertas-modal');
  if (btnFecharAlertasModal) btnFecharAlertasModal.addEventListener('click', fecharModalAlertasUsuario);

  // ══ DELEGAÇÃO DINÂMICA ═══════════════════════════════════════

  // #alertas-list — botões de IA + link Google Flights
  var alertasList = document.getElementById('alertas-list');
  if (alertasList) alertasList.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    if (el.dataset.action === 'solicitar-analise') {
      solicitarAnalise(parseInt(el.dataset.id, 10));
    } else if (el.dataset.action === 'open-flights-url') {
      window.open(el.dataset.url, '_blank');
    }
  });

  // #config-alertas-list — botão de remover alerta
  var configAlertas = document.getElementById('config-alertas-list');
  if (configAlertas) configAlertas.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action="remover-alerta"]');
    if (el) removerAlerta(parseInt(el.dataset.indice, 10));
  });

  // #admin-usuarios-list — todas as ações de admin
  var adminList = document.getElementById('admin-usuarios-list');
  if (adminList) adminList.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    switch (el.dataset.action) {
      case 'admin-ver-alertas':      adminVerAlertas(el.dataset.email, el.dataset.nome); break;
      case 'admin-abrir-edicao':     adminAbrirEdicao(el.dataset.email); break;
      case 'admin-ver-audit':        adminVerAudit(el.dataset.email, el.dataset.nome); break;
      case 'admin-toggle-ativo':     adminToggleAtivo(el.dataset.email, el.dataset.ativo === 'true'); break;
      case 'admin-remover-usuario':  adminRemoverUsuario(el.dataset.email, el.dataset.nome); break;
      case 'admin-reenviar-convite': adminReenviarConvite(el.dataset.email); break;
      case 'admin-cancelar-convite': adminCancelarConvite(el.dataset.token, el.dataset.email); break;
    }
  });

  // #cal-body — seleção de dia (data-action="select-day" data-day="N")
  var calBody = document.getElementById('cal-body');
  if (calBody) calBody.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action="select-day"]');
    if (el) selectDay(parseInt(el.dataset.day, 10));
  });

  // #drop-origem / #drop-destino — seleção de aeroporto
  // mousedown + touchstart para não perder foco do input antes do pick
  ['origem', 'destino'].forEach(function (tipo) {
    var drop = document.getElementById('drop-' + tipo);
    if (!drop) return;
    function _pick(e) {
      var el = e.target.closest('[data-action="pick-airport"]');
      if (el) pickAirport(el.dataset.code, el.dataset.tipo);
    }
    drop.addEventListener('mousedown', _pick);
    drop.addEventListener('touchstart', _pick, { passive: true });
  });

  // ══ CUSTOM EVENTS ════════════════════════════════════════════

  // Tab ativa → carrega dados específicos da aba
  document.addEventListener('passagens:tab-active', function (e) {
    var tab = e.detail && e.detail.tab;
    if (tab === 'config') {
      renderConfigs();
      setTimeout(atualizarStatusPush, 200);
    } else if (tab === 'admin') {
      carregarUsuarios();
    } else if (tab === 'dash') {
      carregarDashboard();
    }
  });

  // Modal sem chat ID — auth.js / admin.js despacham para abrir o modal
  document.addEventListener('passagens:set-pending', function (e) {
    _pendingNome = e.detail.nome;
    _pendingTipo = e.detail.tipo;
    document.getElementById('modal-sem-chatid').style.display = 'flex';
  });
}
