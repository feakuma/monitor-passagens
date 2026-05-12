// ============================================================
//  auth.js — Autenticação: login, OTP, convite, logout
// ============================================================

import { WORKER_URL, getSessao, salvarSessao, limparSessao, showToast } from './config.js';

export var _conviteToken = null;
export var _conviteEmail = null;

// ── VISIBILIDADE ─────────────────────────────────────────────

export function mostrarTelaLogin() {
  document.getElementById('tela-login').style.display = 'block';
  document.querySelector('.status-bar').style.display = 'none';
  document.querySelector('.header').style.display = 'none';
  document.querySelector('.tabs').style.display = 'none';
  document.querySelectorAll('.page').forEach(function (p) { p.style.display = 'none'; });
  document.querySelector('.bottom-nav').style.display = 'none';
}

export function ocultarTelaLogin() {
  document.getElementById('tela-login').style.display = 'none';
  document.querySelector('.status-bar').style.display = '';
  document.querySelector('.header').style.display = '';
  document.querySelector('.tabs').style.display = '';
  document.querySelectorAll('.page').forEach(function (p) { p.style.display = ''; });
  document.querySelector('.bottom-nav').style.display = '';
}

// ── OTP ──────────────────────────────────────────────────────

export function solicitarOTP(reenvio) {
  var email = document.getElementById('login-email').value.trim().toLowerCase();
  if (!email || !email.includes('@')) { mostrarErroLogin('email', 'Informe um e-mail válido'); return; }

  var btn = document.getElementById('btn-solicitar-otp');
  btn.textContent = 'Enviando...'; btn.style.opacity = '0.6'; btn.style.pointerEvents = 'none';
  document.getElementById('login-email-erro').style.display = 'none';

  fetch(WORKER_URL + '/auth/request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email })
  })
  .then(function (r) { return r.json(); })
  .then(function (data) {
    btn.textContent = 'Enviar código'; btn.style.opacity = '1'; btn.style.pointerEvents = '';
    if (data.erro) { mostrarErroLogin('email', data.erro); return; }
    document.getElementById('login-step-email').style.display = 'none';
    document.getElementById('login-step-otp').style.display = 'block';
    document.getElementById('login-email-display').textContent = email;
    document.getElementById('login-otp').focus();
    setTimeout(function () { document.getElementById('btn-reenviar-otp').style.display = 'block'; }, 30000);
  })
  .catch(function () {
    btn.textContent = 'Enviar código'; btn.style.opacity = '1'; btn.style.pointerEvents = '';
    mostrarErroLogin('email', 'Erro ao enviar. Tente novamente.');
  });
}

export function verificarOTP() {
  var email  = document.getElementById('login-email').value.trim().toLowerCase();
  var codigo = document.getElementById('login-otp').value.trim();
  if (!codigo || codigo.length !== 6) { mostrarErroLogin('otp', 'Digite o código de 6 dígitos'); return; }

  var btn = document.getElementById('btn-verificar-otp');
  btn.textContent = 'Verificando...'; btn.style.opacity = '0.6'; btn.style.pointerEvents = 'none';
  document.getElementById('login-otp-erro').style.display = 'none';

  fetch(WORKER_URL + '/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, codigo: codigo })
  })
  .then(function (r) { return r.json(); })
  .then(function (data) {
    btn.textContent = 'Entrar'; btn.style.opacity = '1'; btn.style.pointerEvents = '';
    if (data.erro) { mostrarErroLogin('otp', data.erro); return; }
    salvarSessao(data.token, data.usuario);
    // Usa window para evitar dependência circular com app.js
    if (window.inicializarApp) window.inicializarApp();
    setTimeout(function () { if (window.inicializarPush) window.inicializarPush(); }, 4000);
  })
  .catch(function () {
    btn.textContent = 'Entrar'; btn.style.opacity = '1'; btn.style.pointerEvents = '';
    mostrarErroLogin('otp', 'Erro ao verificar. Tente novamente.');
  });
}

export function voltarParaEmail() {
  document.getElementById('login-step-otp').style.display = 'none';
  document.getElementById('login-step-email').style.display = 'block';
  document.getElementById('login-otp').value = '';
  document.getElementById('login-otp-erro').style.display = 'none';
  document.getElementById('btn-reenviar-otp').style.display = 'none';
}

export function logout() {
  var sessao = getSessao();
  if (sessao) fetch(WORKER_URL + '/auth/logout', { method: 'POST', headers: { 'Authorization': 'Bearer ' + sessao.token } });
  limparSessao();
  mostrarTelaLogin();
}

// ── CONVITE ───────────────────────────────────────────────────

export function verificarConviteURL() {
  var params = new URLSearchParams(window.location.search);
  var token  = params.get('convite');
  if (!token) return false;

  fetch(WORKER_URL + '/convite/' + token)
  .then(function (r) { return r.json(); })
  .then(function (data) {
    if (data.erro) { mostrarTelaLogin(); showToast('Convite inválido ou expirado.', 'error'); return; }
    mostrarTelaLogin();
    document.getElementById('login-step-email').style.display = 'none';
    document.getElementById('login-step-otp').style.display = 'none';
    document.getElementById('login-step-convite').style.display = 'block';
    document.getElementById('convite-email-display').textContent = data.email;
    _conviteToken = token;
    _conviteEmail = data.email;
  })
  .catch(function () { mostrarTelaLogin(); });

  return true;
}

export function criarContaConvite() {
  var nome   = document.getElementById('convite-nome').value.trim();
  var chatId = document.getElementById('convite-chatid').value.trim();
  if (!nome) { mostrarErroConvite('Informe seu nome'); return; }
  if (!chatId) {
    window._pendingNome = nome;
    window._pendingTipo = 'convite';
    document.getElementById('modal-sem-chatid').style.display = 'flex';
    return;
  }
  _executarCriarContaConvite(nome, chatId);
}

export function _executarCriarContaConvite(nome, chatId) {
  var btn = document.getElementById('btn-criar-conta');
  btn.textContent = 'Criando conta...'; btn.style.opacity = '0.6'; btn.style.pointerEvents = 'none';

  fetch(WORKER_URL + '/convite/' + _conviteToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: nome, chatId: chatId })
  })
  .then(function (r) { return r.json(); })
  .then(function (data) {
    btn.textContent = 'Criar minha conta'; btn.style.opacity = '1'; btn.style.pointerEvents = '';
    if (data.erro) { mostrarErroConvite(data.erro); return; }
    document.getElementById('login-step-convite').style.display = 'none';
    document.getElementById('login-step-email').style.display = 'block';
    document.getElementById('login-email').value = _conviteEmail;
    showToast('Conta criada! Faça login para continuar.', 'success');
    window.history.replaceState({}, document.title, window.location.pathname);
  })
  .catch(function () {
    btn.textContent = 'Criar minha conta'; btn.style.opacity = '1'; btn.style.pointerEvents = '';
    mostrarErroConvite('Erro ao criar conta. Tente novamente.');
  });
}

// ── HELPERS ───────────────────────────────────────────────────

export function mostrarErroLogin(tipo, msg) {
  var el = document.getElementById('login-' + tipo + '-erro');
  el.textContent = msg; el.style.display = 'block';
}

export function mostrarErroConvite(msg) {
  var el = document.getElementById('convite-erro');
  el.textContent = msg; el.style.display = 'block';
}
