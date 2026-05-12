// ============================================================
//  api.js — Chamadas para o Worker (alertas, análise IA)
// ============================================================

import { WORKER_URL, getSessao, limparSessao } from './config.js';

export var alertasData = [];

// ── ALERTAS ───────────────────────────────────────────────────

export function carregarAlertas() {
  var sessao = getSessao();
  if (!sessao) return Promise.resolve([]);

  return fetch(WORKER_URL + '/alertas', {
    headers: { 'Authorization': 'Bearer ' + sessao.token }
  })
  .then(function (r) {
    if (r.status === 401) {
      limparSessao();
      if (window.mostrarTelaLogin) window.mostrarTelaLogin();
      return Promise.reject('Sessão expirada');
    }
    return r.json();
  })
  .then(function (data) {
    alertasData = data || [];
    var n = alertasData.length;
    document.getElementById('eyebrow').textContent =
      n + ' alerta' + (n !== 1 ? 's' : '') + ' ativo' + (n !== 1 ? 's' : '');
    return alertasData;
  })
  .catch(function (e) {
    console.error(e);
    document.getElementById('eyebrow').textContent = 'erro ao carregar';
    return [];
  });
}

export function adicionarAlertaAPI(origem, destino, dataIda, dataVolta) {
  var sessao = getSessao();
  return fetch(WORKER_URL + '/alertas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessao.token },
    body: JSON.stringify({ origem: origem, destino: destino, dataIda: dataIda, dataVolta: dataVolta || null })
  }).then(function (r) { return r.json(); });
}

export function removerAlertaAPI(indice) {
  var sessao = getSessao();
  return fetch(WORKER_URL + '/alertas/' + indice, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + sessao.token }
  }).then(function (r) { return r.json(); });
}

// Chama /analisar direto no Worker (não passa mais pelo Apps Script)
export function analisarAlertaAPI(id) {
  var sessao = getSessao();
  return fetch(WORKER_URL + '/analisar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessao.token },
    body: JSON.stringify({ id: id })
  }).then(function (r) { return r.json(); });
}
