// ============================================================
//  auth.js — Autenticação: login, OTP, convite, logout
// ============================================================

import { WORKER_URL, getSessao, salvarSessao, limparSessao, showToast } from './config.js';
import { inicializarPush } from './pwa.js';

export let _conviteToken = null;
export let _conviteEmail = null;

// MOSTRAR/OCULTAR TELA LOGIN
export function mostrarTelaLogin() {
  document.getElementById('tela-login').style.display = 'block';
  document.querySelector('.status-bar').style.display = 'none';
  document.querySelector('.header').style.display = 'none';
  document.querySelector('.tabs').style.display = 'none';
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  document.querySelector('.bottom-nav').style.display = 'none';
}

export function ocultarTelaLogin() {
  document.getElementById('tela-login').style.display = 'none';
  document.querySelector('.status-bar').style.display = '';
  document.querySelector('.header').style.display = '';
  document.querySelector('.tabs').style.display = '';
  document.querySelectorAll('.page').forEach(p => p.style.display = '');
  document.querySelector('.bottom-nav').style.display = '';
}

// SOLICITAR OTP
export function solicitarOTP() {
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  if (!email || !email.includes('@')) { mostrarErroLogin('email', 'Informe um e-mail válido'); return; }

  const btn = document.getElementById('btn-solicitar-otp');
  btn.textContent = 'Enviando...'; btn.style.opacity = '0.6'; btn.style.pointerEvents = 'none';
  document.getElementById('login-email-erro').style.display = 'none';

  fetch(WORKER_URL + '/auth/request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  })
  .then(r => r.json())
  .then(data => {
    btn.textContent = 'Enviar código'; btn.style.opacity = '1'; btn.style.pointerEvents = '';
    if (data.erro) { mostrarErroLogin('email', data.erro); return; }
    document.getElementById('login-step-email').style.display = 'none';
    document.getElementById('login-step-otp').style.display = 'block';
    document.getElementById('login-email-display').textContent = email;
    document.getElementById('login-otp').focus();
    setTimeout(() => { document.getElementById('btn-reenviar-otp').style.display = 'block'; }, 30000);
  })
  .catch(() => {
    btn.textContent = 'Enviar código'; btn.style.opacity = '1'; btn.style.pointerEvents = '';
    mostrarErroLogin('email', 'Erro ao enviar. Tente novamente.');
  });
}

// VERIFICAR OTP
export function verificarOTP() {
  const email  = document.getElementById('login-email').value.trim().toLowerCase();
  const codigo = document.getElementById('login-otp').value.trim();
  if (!codigo || codigo.length !== 6) { mostrarErroLogin('otp', 'Digite o código de 6 dígitos'); return; }

  const btn = document.getElementById('btn-verificar-otp');
  btn.textContent = 'Verificando...'; btn.style.opacity = '0.6'; btn.style.pointerEvents = 'none';
  document.getElementById('login-otp-erro').style.display = 'none';

  fetch(WORKER_URL + '/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, codigo })
  })
  .then(r => r.json())
  .then(data => {
    btn.textContent = 'Entrar'; btn.style.opacity = '1'; btn.style.pointerEvents = '';
    if (data.erro) { mostrarErroLogin('otp', data.erro); return; }
    salvarSessao(data.token, data.usuario);
    import('./app.js').then(m => m.inicializarApp());
    setTimeout(inicializarPush, 4000);
  })
  .catch(() => {
    btn.textContent = 'Entrar'; btn.style.opacity = '1'; btn.style.pointerEvents = '';
    mostrarErroLogin('otp', 'Erro ao verificar. Tente novamente.');
  });
}

// LOGOUT
export function logout() {
  const sessao = getSessao();
  if (sessao) fetch(WORKER_URL + '/auth/logout', { method: 'POST', headers: { 'Authorization': 'Bearer ' + sessao.token } });
  limparSessao();
  mostrarTelaLogin();
}

// VOLTAR PARA E-MAIL
export function voltarParaEmail() {
  document.getElementById('login-step-otp').style.display = 'none';
  document.getElementById('login-step-email').style.display = 'block';
  document.getElementById('login-otp').value = '';
  document.getElementById('login-otp-erro').style.display = 'none';
  document.getElementById('btn-reenviar-otp').style.display = 'none';
}

// CONVITE — detecta token na URL
export function verificarConviteURL() {
  const params = new URLSearchParams(window.location.search);
  const token  = params.get('convite');
  if (!token) return false;

  fetch(WORKER_URL + '/convite/' + token)
  .then(r => r.json())
  .then(data => {
    if (data.erro) { mostrarTelaLogin(); showToast('Convite inválido ou expirado.', 'error'); return; }
    mostrarTelaLogin();
    document.getElementById('login-step-email').style.display = 'none';
    document.getElementById('login-step-otp').style.display = 'none';
    document.getElementById('login-step-convite').style.display = 'block';
    document.getElementById('convite-email-display').textContent = data.email;
    _conviteToken = token;
    _conviteEmail = data.email;
  })
  .catch(() => mostrarTelaLogin());

  return true;
}

// CRIAR CONTA VIA CONVITE
export function criarContaConvite() {
  const nome   = document.getElementById('convite-nome').value.trim();
  const chatId = document.getElementById('convite-chatid').value.trim();
  if (!nome) { mostrarErroConvite('Informe seu nome'); return; }
  if (!chatId) {
    window._pendingNome = nome; window._pendingTipo = 'convite';
    document.getElementById('modal-sem-chatid').style.display = 'flex';
    return;
  }
  _executarCriarContaConvite(nome, chatId);
}

export function _executarCriarContaConvite(nome, chatId) {
  const btn = document.getElementById('btn-criar-conta');
  btn.textContent = 'Criando conta...'; btn.style.opacity = '0.6'; btn.style.pointerEvents = 'none';

  fetch(WORKER_URL + '/convite/' + _conviteToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome, chatId })
  })
  .then(r => r.json())
  .then(data => {
    btn.textContent = 'Criar minha conta'; btn.style.opacity = '1'; btn.style.pointerEvents = '';
    if (data.erro) { mostrarErroConvite(data.erro); return; }
    document.getElementById('login-step-convite').style.display = 'none';
    document.getElementById('login-step-email').style.display = 'block';
    document.getElementById('login-email').value = _conviteEmail;
    showToast('Conta criada! Faça login para continuar.', 'success');
    window.history.replaceState({}, document.title, window.location.pathname);
  })
  .catch(() => {
    btn.textContent = 'Criar minha conta'; btn.style.opacity = '1'; btn.style.pointerEvents = '';
    mostrarErroConvite('Erro ao criar conta. Tente novamente.');
  });
}

// HELPERS
export function mostrarErroLogin(tipo, msg) {
  const el = document.getElementById('login-' + tipo + '-erro');
  el.textContent = msg; el.style.display = 'block';
}

export function mostrarErroConvite(msg) {
  const el = document.getElementById('convite-erro');
  el.textContent = msg; el.style.display = 'block';
}
