// ============================================================
//  app.js — Entry point e inicialização do app
// ============================================================

import { getSessao, showToast } from ‘./config.js’;
import { carregarAlertas } from ‘./api.js’;
import { mostrarTelaLogin, ocultarTelaLogin, verificarConviteURL, solicitarOTP, verificarOTP, logout, voltarParaEmail, criarContaConvite, _executarCriarContaConvite, mostrarErroLogin, mostrarErroConvite } from ‘./auth.js’;
import { showTab, updateClock, renderAlertas, renderHistorico, renderConfigAlertas, adicionarAlerta, removerAlerta, solicitarAnalise, doAutocomplete, pickAirport, validarCampoAeroporto } from ‘./ui.js’;
import { openCal, calNav, selectDay, confirmCal } from ‘./calendar.js’;
import { mostrarInstallToast, fecharInstallToast, instalarPWA, inicializarPush } from ‘./pwa.js’;
import { carregarUsuarios, adminEnviarConvite, adminCriarUsuario, _executarCriarUsuarioManual, adminToggleIA, adminToggleAtivo, adminRemoverUsuario, editarConfigs, cancelarEditConfigs, salvarConfigs, adminEditarLimite, verAlertasUsuario, fecharModalAlertasUsuario } from ‘./admin.js’;

// ============================================================
//  Expõe funções no window para uso inline no HTML
// ============================================================
window.showTab              = showTab;
window.solicitarOTP         = solicitarOTP;
window.verificarOTP         = verificarOTP;
window.voltarParaEmail      = voltarParaEmail;
window.logout               = logout;
window.criarContaConvite    = criarContaConvite;
window.adicionarAlerta      = adicionarAlerta;
window._removerAlerta       = removerAlerta;
window._solicitarAnalise    = solicitarAnalise;
window.doAutocomplete       = doAutocomplete;
window._pickAirport         = pickAirport;
window._validarAero         = validarCampoAeroporto;
window.openCal              = openCal;
window.calNav               = calNav;
window._selectDay           = selectDay;
window.confirmCal           = confirmCal;
window.instalarPWA          = instalarPWA;
window.fecharInstallToast   = fecharInstallToast;
window.confirmarSemChatId   = confirmarSemChatId;
window.fecharModalSemChatId = fecharModalSemChatId;
window.editarConfigs        = editarConfigs;
window.cancelarEditConfigs  = cancelarEditConfigs;
window.salvarConfigs        = salvarConfigs;
window.adminEditarLimite        = adminEditarLimite;
window._verAlertasUsuario       = verAlertasUsuario;
window.fecharModalAlertasUsuario = fecharModalAlertasUsuario;
window.adminEnviarConvite   = adminEnviarConvite;
window.adminCriarUsuario    = adminCriarUsuario;
window._adminToggleIA       = adminToggleIA;
window._adminToggleAtivo    = adminToggleAtivo;
window._adminRemoverUsuario = adminRemoverUsuario;

// Modal sem chatId
function confirmarSemChatId() {
document.getElementById(‘modal-sem-chatid’).style.display = ‘none’;
if (window._pendingTipo === ‘convite’) {
_executarCriarContaConvite(window._pendingNome, ‘’);
} else if (window._pendingTipo === ‘manual’) {
_executarCriarUsuarioManual();
}
}
function fecharModalSemChatId() {
document.getElementById(‘modal-sem-chatid’).style.display = ‘none’;
window._pendingNome = null; window._pendingTipo = null;
}

// Fecha dropdowns ao clicar fora
document.addEventListener(‘click’, e => {
if (!e.target.closest(’.autocomplete-wrap’)) {
document.querySelectorAll(’.autocomplete-dropdown’).forEach(d => { d.classList.remove(‘open’); d.innerHTML = ‘’; });
}
});

// Fecha calendário ao clicar fora
document.getElementById(‘cal-overlay’).addEventListener(‘click’, e => {
if (e.target === e.currentTarget) e.currentTarget.classList.remove(‘open’);
});

// Clock
updateClock();
setInterval(updateClock, 10000);

// ============================================================
//  INICIALIZAR APP
// ============================================================
export function inicializarApp() {
const sessao = getSessao();
if (sessao) {
ocultarTelaLogin();
if (sessao.usuario && sessao.usuario.isAdmin) {
document.getElementById(‘tab-admin-btn’).style.display = ‘’;
}
const emailEl = document.getElementById(‘sessao-email’);
if (emailEl && sessao.usuario) emailEl.textContent = sessao.usuario.email;
carregarAlertas().then(() => { renderAlertas(); renderHistorico(); renderConfigAlertas(); });
setTimeout(inicializarPush, 3000);
if (!localStorage.getItem(‘pwa_install_dismissed’)) setTimeout(mostrarInstallToast, 5000);
} else {
mostrarTelaLogin();
}
}

// Verifica convite na URL antes de inicializar
if (!verificarConviteURL()) {
inicializarApp();
}

// Recarrega alertas a cada 5 minutos
setInterval(() => {
const sessao = getSessao();
if (sessao) carregarAlertas().then(() => { renderAlertas(); renderHistorico(); });
}, 5 * 60 * 1000);

// Service Worker
if (‘serviceWorker’ in navigator) {
window.addEventListener(‘load’, () => {
navigator.serviceWorker.register(’/sw.js’)
.then(reg => console.log(‘SW registrado:’, reg.scope))
.catch(err => console.log(‘SW erro:’, err));
});
}
