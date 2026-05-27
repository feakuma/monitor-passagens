// ============================================================
//  config.js — Constantes, sessão e utilitários compartilhados
// ============================================================

export const WORKER_URL = 'https://passagens-proxy.felipe-akuma.workers.dev';
export const IS_GAS = typeof google !== 'undefined' && google.script;

// SESSÃO
export function salvarSessao(token, usuario) {
  localStorage.setItem('pm_token', token);
  localStorage.setItem('pm_usuario', JSON.stringify(usuario));
}

export function getSessao() {
  var t = localStorage.getItem('pm_token');
  var u = localStorage.getItem('pm_usuario');
  if (!t || !u) return null;
  return { token: t, usuario: JSON.parse(u) };
}

export function limparSessao() {
  localStorage.removeItem('pm_token');
  localStorage.removeItem('pm_usuario');
}

// TOAST
export function showToast(msg, type) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  setTimeout(function () { t.className = 'toast'; }, 3000);
}

// FORMATAÇÃO DE DATAS
export function formatData(str) {
  if (!str) return '—';
  var p = str.split('-');
  var m = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  return p[2] + ' ' + m[parseInt(p[1]) - 1] + ' ' + p[0];
}

export function formatDataCurta(str) {
  if (!str) return '—';
  var p = str.split('-');
  return p[2] + '/' + p[1];
}

export function formatDataCurta2(dt) {
  var m = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  return dt.getDate() + ' ' + m[dt.getMonth()];
}

// XSS PREVENTION ──────────────────────────────────────────────

/**
 * Escapa texto para inserção segura como conteúdo innerHTML.
 * Usa em: + valor + dentro de tags HTML.
 */
export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escapa valor para uso dentro de onclick="func('VALUE')".
 * Aplica JS escaping (quebra de string) + HTML attr escaping.
 * Uso: onclick="func(\'' + escAttr(val) + '\')"
 */
export function escAttr(s) {
  var js = String(s == null ? '' : s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, ' ');
  return js
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
