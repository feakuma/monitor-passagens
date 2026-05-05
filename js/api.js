// ============================================================
//  api.js — Chamadas para Worker/Apps Script
// ============================================================

import { WORKER_URL, IS_GAS, getSessao, limparSessao, showToast } from './config.js';
import { mostrarTelaLogin } from './auth.js';

export let alertasData = [];

// Chamada genérica ao Apps Script (análise IA)
export function api(action, data = {}) {
  const sessao  = getSessao();
  const headers = { 'Content-Type': 'text/plain' };
  if (sessao) headers['Authorization'] = 'Bearer ' + sessao.token;

  if (IS_GAS) {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)
        .handleAction(JSON.stringify({ action, ...data }));
    });
  }

  return fetch(WORKER_URL, {
    method: 'POST', redirect: 'follow', headers,
    body: JSON.stringify({ action, ...data }),
  })
  .then(r => {
    if (r.status === 401) { limparSessao(); mostrarTelaLogin(); return Promise.reject('Sessão expirada'); }
    return r.json();
  });
}

// Carrega alertas do Redis via Worker
export function carregarAlertas() {
  const sessao = getSessao();
  if (!sessao) return;

  return fetch(WORKER_URL + '/alertas', {
    headers: { 'Authorization': 'Bearer ' + sessao.token }
  })
  .then(r => {
    if (r.status === 401) { limparSessao(); mostrarTelaLogin(); return Promise.reject('Sessão expirada'); }
    return r.json();
  })
  .then(data => {
    alertasData = data || [];
    const n = alertasData.length;
    document.getElementById('eyebrow').textContent = n + ' alerta' + (n !== 1 ? 's' : '') + ' ativo' + (n !== 1 ? 's' : '');
    return alertasData;
  });
}

// Adiciona alerta no Redis
export function adicionarAlertaAPI(origem, destino, dataIda, dataVolta) {
  const sessao = getSessao();
  return fetch(WORKER_URL + '/alertas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessao.token },
    body: JSON.stringify({ origem, destino, dataIda, dataVolta: dataVolta || null })
  }).then(r => r.json());
}

// Remove alerta do Redis
export function removerAlertaAPI(indice) {
  const sessao = getSessao();
  return fetch(WORKER_URL + '/alertas/' + indice, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + sessao.token }
  }).then(r => r.json());
}

// Análise IA (via Apps Script)
export function analisarAlertaAPI(id) {
  return api('analisar', { id });
}
