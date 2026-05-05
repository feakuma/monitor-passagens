// ============================================================
//  ui.js — Renderização da interface
// ============================================================

import { getSessao, showToast, formatData, formatDataCurta, AEROPORTOS } from './config.js';
import { alertasData, carregarAlertas, adicionarAlertaAPI, removerAlertaAPI, analisarAlertaAPI } from './api.js';
import { renderGraficos } from './charts.js';
import { renderConfigs } from './admin.js';

// CLOCK
export function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent =
    now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
}

// TABS
export function showTab(tab) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));

  const el = document.getElementById('tab-' + tab);
  if (el) el.classList.add('active');

  const tabs = ['alertas','historico','config','admin'];
  const tabBtn = document.querySelectorAll('.tab')[tabs.indexOf(tab)];
  if (tabBtn) tabBtn.classList.add('active');

  ['alertas','historico','config'].forEach(t => {
    const ni = document.getElementById('nav-' + t);
    const nl = document.getElementById('navl-' + t);
    if (ni) ni.classList.toggle('on', t === tab);
    if (nl) nl.classList.toggle('on', t === tab);
  });

  const titles = { alertas: 'Passagens', historico: 'Historico', config: 'Config', admin: 'Admin' };
  document.getElementById('page-title').textContent = titles[tab] || 'Passagens';

  if (tab === 'alertas' || tab === 'historico') {
    carregarAlertas().then(() => { renderAlertas(); renderHistorico(); });
  }
  if (tab === 'config') { renderConfigAlertas(); renderConfigs(); }
  if (tab === 'admin') { import('./admin.js').then(m => m.carregarUsuarios()); }
}

// RENDER ALERTAS
export function renderAlertas() {
  const el = document.getElementById('alertas-list');
  if (!alertasData.length) {
    el.innerHTML = '<div class="empty">Nenhum alerta cadastrado.<br>Va em Config para criar um.</div>';
    return;
  }

  const sessao = getSessao();
  const temIA  = sessao && sessao.usuario && sessao.usuario.analiseIA;

  el.innerHTML = alertasData.map(a => {
    const temQueda = a.variacao < -0.5;
    const temAlta  = a.variacao > 0.5;
    const varStr   = temQueda ? ('↓ ' + Math.abs(a.variacao) + '%') : temAlta ? ('↑ ' + a.variacao + '%') : '— sem variacao';
    const varClass = temQueda ? 'price-drop' : temAlta ? 'price-up' : 'price-neutral';
    const precoStr = a.precoAtual > 0 ? 'R$ ' + a.precoAtual.toFixed(2).replace('.',',') : '—';
    const url      = 'https://www.google.com/travel/flights?q=Voos+' + a.origem + '+' + a.destino + '+' + (a.dataIda||'').replace(/-/g,'') + (a.dataVolta ? '+' + a.dataVolta.replace(/-/g,'') : '');
    const temHist  = a.historico && a.historico.length > 1;

    return '<div class="card"><div class="card-body"><div class="card-top"><div class="route">' + a.origem +
      '<span class="route-sep"> → </span>' + a.destino + '</div><div class="price-block"><div class="price">' +
      precoStr + '</div><div class="' + varClass + '">' + varStr + '</div></div></div><div class="card-meta"><div class="dates">' +
      '<div class="date-row">ida <strong>' + formatData(a.dataIda) + '</strong></div>' +
      (a.dataVolta ? '<div class="date-row">volta <strong>' + formatData(a.dataVolta) + '</strong></div>' : '') +
      '</div></div></div>' +
      (temHist ? '<div style="padding:0 16px 16px;"><canvas id="chart-' + a.id + '" height="80"></canvas></div>' : '') +
      '<div class="card-action" onclick="window.open(\'' + url + '\',\'_blank\')"><div class="action-left"><div class="action-title">Buscar no Google Flights</div>' +
      '<div class="action-sub">' + a.origem + ' → ' + a.destino + ' · ' + formatDataCurta(a.dataIda) + '</div></div>' +
      '<div class="action-arrow ' + (temQueda ? 'active' : '') + '">↗</div></div></div>' +
      (temIA ? '<div class="ai-btn" id="btn-ai-' + a.id + '" onclick="window._solicitarAnalise(' + a.id + ')"><span>Analisar com IA</span></div>' : '') +
      '<div id="ai-' + a.id + '" style="display:none;" class="ai-block"><div class="ai-label">analise · ia</div>' +
      '<div class="ai-verdict" id="ai-verdict-' + a.id + '"></div><div class="ai-text" id="ai-text-' + a.id + '"></div></div>' +
      '<div style="height:8px;"></div>';
  }).join('');

  const m = document.createElement('div');
  m.className = 'monitor-row';
  m.innerHTML = '<div class="monitor-dot"></div><div class="monitor-text">verificando 4x por dia</div>';
  el.appendChild(m);

  setTimeout(() => renderGraficos(alertasData), 100);
}

// RENDER HISTÓRICO
export function renderHistorico() {
  const el = document.getElementById('historico-list');
  const items = [];
  alertasData.forEach(a => {
    (a.historico || []).forEach(h => {
      items.push({ preco: h.preco, data: h.data, rota: a.origem + ' → ' + a.destino, dataIda: a.dataIda });
    });
  });
  items.sort((x,y) => new Date(y.data) - new Date(x.data));

  if (!items.length) { el.innerHTML = '<div class="empty">Historico disponivel apos a primeira verificacao.</div>'; return; }

  let html = ''; let lastDate = '';
  items.forEach((item, i) => {
    const d       = new Date(item.data);
    const dateStr = d.toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' });
    const timeStr = d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
    if (dateStr !== lastDate) { html += '<div class="hist-sep">' + dateStr + '</div>'; lastDate = dateStr; }
    const prev = items[i+1];
    let varStr = '— sem variacao'; let varClass = 'hist-var';
    if (prev) {
      const diff = item.preco - prev.preco;
      if (diff < -1) { varStr = '↓ R$ ' + Math.abs(diff).toFixed(0); varClass = 'hist-var down'; }
      else if (diff > 1) { varStr = '↑ R$ ' + diff.toFixed(0); varClass = 'hist-var up'; }
    }
    html += '<div class="hist-item"><div class="hist-left"><div class="hist-route">' + item.rota +
      '</div><div class="hist-meta">' + timeStr + ' · ida ' + formatData(item.dataIda) +
      '</div></div><div class="hist-right"><div class="hist-price">R$ ' + item.preco.toFixed(2).replace('.',',') +
      '</div><div class="' + varClass + '">' + varStr + '</div></div></div>';
  });
  el.innerHTML = html;
}

// RENDER CONFIG ALERTAS
export function renderConfigAlertas() {
  const el = document.getElementById('config-alertas-list');
  if (!alertasData.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:4px 2px 12px;">Nenhum alerta cadastrado ainda.</div>';
    return;
  }
  el.innerHTML = alertasData.map(a =>
    '<div class="alerta-item"><div class="alerta-header"><div class="alerta-route">' + a.origem +
    ' <span>→</span> ' + a.destino + '</div><div class="remove-btn" onclick="window._removerAlerta(' + a.indice + ')">×</div></div>' +
    '<div class="alerta-dates"><div class="alerta-date">ida <strong>' + formatData(a.dataIda) + '</strong>' +
    (a.dataVolta ? ' · volta <strong>' + formatData(a.dataVolta) + '</strong>' : '') +
    '</div><div class="alerta-cia">R$ ' + (a.precoAtual > 0 ? a.precoAtual.toFixed(2).replace('.',',') : '—') +
    '</div></div></div>'
  ).join('');
}

// ADICIONAR ALERTA
export function adicionarAlerta() {
  const origem  = document.getElementById('input-origem').value.trim().toUpperCase();
  const destino = document.getElementById('input-destino').value.trim().toUpperCase();
  const dataIda = document.getElementById('input-ida').value;
  const dataVolta = document.getElementById('input-volta').value;

  if (!origem || origem.length !== 3) { showToast('Informe a origem', 'error'); return; }
  if (!destino || destino.length !== 3) { showToast('Informe o destino', 'error'); return; }
  if (!dataIda) { showToast('Informe a data de ida', 'error'); return; }

  const btn = document.getElementById('btn-adicionar');
  btn.classList.add('loading'); btn.textContent = 'Criando...';

  adicionarAlertaAPI(origem, destino, dataIda, dataVolta || null).then(res => {
    if (!res || res.erro) { showToast(res ? res.erro : 'Erro ao criar', 'error'); }
    else {
      showToast('Alerta criado!', 'success');
      document.getElementById('input-origem').value = '';
      document.getElementById('input-destino').value = '';
      document.getElementById('input-ida').value = '';
      document.getElementById('input-volta').value = '';
      document.getElementById('display-range').textContent = 'selecionar datas';
      document.getElementById('display-range').className = 'field-placeholder';
      carregarAlertas().then(() => { renderAlertas(); renderHistorico(); renderConfigAlertas(); });
    }
    btn.classList.remove('loading'); btn.textContent = 'Criar alerta';
  }).catch(() => { showToast('Erro ao criar', 'error'); btn.classList.remove('loading'); btn.textContent = 'Criar alerta'; });
}

// REMOVER ALERTA
export function removerAlerta(indice) {
  removerAlertaAPI(indice).then(res => {
    if (!res || res.erro) { showToast(res ? res.erro : 'Erro', 'error'); return; }
    showToast('Alerta removido', 'success');
    carregarAlertas().then(() => { renderAlertas(); renderHistorico(); renderConfigAlertas(); });
  }).catch(() => showToast('Erro ao remover', 'error'));
}

// ANÁLISE IA
export function solicitarAnalise(id) {
  const btn = document.getElementById('btn-ai-' + id);
  btn.innerHTML = '<div class="spinner"></div><span>Analisando...</span>';
  btn.style.pointerEvents = 'none';

  analisarAlertaAPI(id).then(res => {
    if (!res || res.erro) {
      showToast(res ? res.erro : 'Erro ao analisar', 'error');
      btn.innerHTML = '<span>Analisar com IA</span>'; btn.style.pointerEvents = '';
      return;
    }
    const linhas = res.analise.split('\n');
    document.getElementById('ai-verdict-' + id).textContent = linhas[0];
    document.getElementById('ai-text-' + id).textContent = linhas.slice(1).join('\n').trim();
    document.getElementById('ai-' + id).style.display = 'block';
    btn.style.display = 'none';
  }).catch(() => {
    showToast('Erro ao analisar', 'error');
    btn.innerHTML = '<span>Analisar com IA</span>'; btn.style.pointerEvents = '';
  });
}

// AUTOCOMPLETE
export function doAutocomplete(input, tipo) {
  const val  = input.value.toUpperCase().trim();
  const drop = document.getElementById('drop-' + tipo);
  if (!val) { drop.classList.remove('open'); drop.innerHTML = ''; return; }

  const matches = AEROPORTOS.filter(a =>
    a.code.indexOf(val) === 0 || a.name.toUpperCase().indexOf(val) >= 0 || a.city.toUpperCase().indexOf(val) >= 0
  ).slice(0, 5);

  if (!matches.length) { drop.classList.remove('open'); return; }

  drop.innerHTML = matches.map(a =>
    '<div class="autocomplete-item" onmousedown="window._pickAirport(\'' + a.code + '\',\'' + tipo + '\')" ontouchstart="window._pickAirport(\'' + a.code + '\',\'' + tipo + '\')">' +
    '<div class="ac-code">' + a.code + '</div><div class="ac-info"><div class="ac-name">' + a.name +
    '</div><div class="ac-city">' + a.city + '</div></div></div>'
  ).join('');
  drop.classList.add('open');
}

export function pickAirport(code, tipo) {
  document.getElementById('input-' + tipo).value = code;
  const drop = document.getElementById('drop-' + tipo);
  drop.classList.remove('open'); drop.innerHTML = '';
  document.getElementById('input-' + tipo).blur();
}
