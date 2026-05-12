// ============================================================
//  ui.js — Render de alertas, histórico, config, tabs, autocomplete, CRUD
// ============================================================

import { getSessao, showToast, formatData, formatDataCurta } from './config.js';
import { alertasData, carregarAlertas, adicionarAlertaAPI, removerAlertaAPI, analisarAlertaAPI } from './api.js';
import { renderGraficos } from './charts.js';

// ── AEROPORTOS ────────────────────────────────────────────────

var AEROPORTOS = [
  // BRASIL
  { code:'CGH', name:'Congonhas',                    city:'Sao Paulo, SP' },
  { code:'GRU', name:'Guarulhos',                    city:'Sao Paulo, SP' },
  { code:'VCP', name:'Viracopos',                    city:'Campinas, SP' },
  { code:'FLN', name:'Hercilio Luz',                 city:'Florianopolis, SC' },
  { code:'GIG', name:'Galeao',                       city:'Rio de Janeiro, RJ' },
  { code:'SDU', name:'Santos Dumont',                city:'Rio de Janeiro, RJ' },
  { code:'BSB', name:'Juscelino Kubitschek',         city:'Brasilia, DF' },
  { code:'SSA', name:'Luis Eduardo Magalhaes',       city:'Salvador, BA' },
  { code:'REC', name:'Guararapes',                   city:'Recife, PE' },
  { code:'FOR', name:'Pinto Martins',                city:'Fortaleza, CE' },
  { code:'BEL', name:'Val de Cans',                  city:'Belem, PA' },
  { code:'MAO', name:'Eduardo Gomes',                city:'Manaus, AM' },
  { code:'CWB', name:'Afonso Pena',                  city:'Curitiba, PR' },
  { code:'POA', name:'Salgado Filho',                city:'Porto Alegre, RS' },
  { code:'GYN', name:'Santa Genoveva',               city:'Goiania, GO' },
  { code:'VIX', name:'Eurico Salles',                city:'Vitoria, ES' },
  { code:'CNF', name:'Tancredo Neves',               city:'Belo Horizonte, MG' },
  { code:'IGU', name:'Cataratas',                    city:'Foz do Iguacu, PR' },
  { code:'NVT', name:'Victor Konder',                city:'Navegantes, SC' },
  { code:'NAT', name:'Sao Goncalo do Amarante',      city:'Natal, RN' },
  { code:'MCZ', name:'Zumbi dos Palmares',           city:'Maceio, AL' },
  { code:'JPA', name:'Castro Pinto',                 city:'Joao Pessoa, PB' },
  // ARGENTINA
  { code:'EZE', name:'Ministro Pistarini (Ezeiza)',  city:'Buenos Aires, AR' },
  { code:'AEP', name:'Jorge Newbery (Aeroparque)',   city:'Buenos Aires, AR' },
  { code:'COR', name:'Ambrosio Taravella',           city:'Cordoba, AR' },
  { code:'MDZ', name:'El Plumerillo',                city:'Mendoza, AR' },
  { code:'BRC', name:'Teniente Candelaria',          city:'Bariloche, AR' },
  { code:'IGR', name:'Cataratas del Iguazu',         city:'Puerto Iguazu, AR' },
  { code:'USH', name:'Malvinas Argentinas',          city:'Ushuaia, AR' },
  { code:'SLA', name:'Martin Miguel de Guemes',      city:'Salta, AR' },
  // PORTUGAL
  { code:'LIS', name:'Humberto Delgado',             city:'Lisboa, PT' },
  { code:'OPO', name:'Francisco Sa Carneiro',        city:'Porto, PT' },
  { code:'FAO', name:'Faro',                         city:'Faro, PT' },
  { code:'FNC', name:'Cristiano Ronaldo',            city:'Funchal, PT' },
  { code:'PDL', name:'Joao Paulo II',                city:'Ponta Delgada, PT' }
];

// ── CLOCK ─────────────────────────────────────────────────────

export function updateClock() {
  var now = new Date();
  document.getElementById('clock').textContent =
    now.getHours().toString().padStart(2, '0') + ':' +
    now.getMinutes().toString().padStart(2, '0');
}

// ── TABS ──────────────────────────────────────────────────────

export function showTab(tab) {
  document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
  document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });

  var el = document.getElementById('tab-' + tab);
  if (el) el.classList.add('active');

  var tabs = ['alertas', 'historico', 'config', 'admin'];
  var tabBtn = document.querySelectorAll('.tab')[tabs.indexOf(tab)];
  if (tabBtn) tabBtn.classList.add('active');

  ['alertas', 'historico', 'config'].forEach(function (t) {
    var ni = document.getElementById('nav-' + t);
    var nl = document.getElementById('navl-' + t);
    if (ni) ni.classList.toggle('on', t === tab);
    if (nl) nl.classList.toggle('on', t === tab);
  });

  var titles = { alertas: 'Passagens', historico: 'Historico', config: 'Config', admin: 'Admin' };
  document.getElementById('page-title').textContent = titles[tab] || 'Passagens';

  if (tab === 'alertas' || tab === 'historico') {
    carregarAlertas().then(function () { renderAlertas(); renderHistorico(); });
  }
  if (tab === 'config') {
    renderConfigAlertas();
    if (window.renderConfigs) window.renderConfigs();
    setTimeout(function () { if (window.atualizarStatusPush) window.atualizarStatusPush(); }, 200);
  }
  if (tab === 'admin') {
    if (window.carregarUsuarios) window.carregarUsuarios();
  }
}

// ── RENDER ALERTAS ────────────────────────────────────────────

export function renderAlertas() {
  var el = document.getElementById('alertas-list');
  if (!alertasData.length) {
    el.innerHTML = '<div class="empty">Nenhum alerta cadastrado.<br>Va em Config para criar um.</div>';
    return;
  }

  var sessao = getSessao();
  var temIA  = sessao && sessao.usuario && sessao.usuario.analiseIA;

  el.innerHTML = alertasData.map(function (a) {
    var temQueda = a.variacao < -0.5;
    var temAlta  = a.variacao > 0.5;
    var varStr   = temQueda ? ('↓ ' + Math.abs(a.variacao) + '%') : temAlta ? ('↑ ' + a.variacao + '%') : '— sem variacao';
    var varClass = temQueda ? 'price-drop' : temAlta ? 'price-up' : 'price-neutral';
    var precoStr = a.precoAtual > 0 ? 'R$ ' + a.precoAtual.toFixed(2).replace('.', ',') : '—';
    var url = 'https://www.google.com/travel/flights?q=Voos+' + a.origem + '+' + a.destino +
      '+' + (a.dataIda || '').replace(/-/g, '') +
      (a.dataVolta ? '+' + a.dataVolta.replace(/-/g, '') : '');
    var temHist = a.historico && a.historico.length > 1;

    return '<div class="card">' +
      '<div class="card-body">' +
        '<div class="card-top">' +
          '<div class="route">' + a.origem + '<span class="route-sep"> → </span>' + a.destino + '</div>' +
          '<div class="price-block"><div class="price">' + precoStr + '</div><div class="' + varClass + '">' + varStr + '</div></div>' +
        '</div>' +
        '<div class="card-meta"><div class="dates">' +
          '<div class="date-row">ida <strong>' + formatData(a.dataIda) + '</strong></div>' +
          (a.dataVolta ? '<div class="date-row">volta <strong>' + formatData(a.dataVolta) + '</strong></div>' : '') +
        '</div></div>' +
      '</div>' +
      (temHist ? '<div style="padding:0 16px 16px;"><canvas id="chart-' + a.id + '" height="80"></canvas></div>' : '') +
      '<div class="card-action" onclick="window.open(\'' + url + '\',\'_blank\')">' +
        '<div class="action-left">' +
          '<div class="action-title">Buscar no Google Flights</div>' +
          '<div class="action-sub">' + a.origem + ' → ' + a.destino + ' · ' + formatDataCurta(a.dataIda) + '</div>' +
        '</div>' +
        '<div class="action-arrow ' + (temQueda ? 'active' : '') + '">↗</div>' +
      '</div>' +
      (temIA ? '<div class="ai-btn" id="btn-ai-' + a.id + '" onclick="solicitarAnalise(' + a.id + ')"><span>Analisar com IA</span></div>' : '') +
      '<div id="ai-' + a.id + '" style="display:none;" class="ai-block">' +
        '<div class="ai-label">analise · ia</div>' +
        '<div class="ai-verdict" id="ai-verdict-' + a.id + '"></div>' +
        '<div class="ai-text" id="ai-text-' + a.id + '"></div>' +
      '</div>' +
      '<div style="height:8px;"></div>' +
    '</div>';
  }).join('');

  var m = document.createElement('div');
  m.className = 'monitor-row';
  m.innerHTML = '<div class="monitor-dot"></div><div class="monitor-text">verificando 4x por dia</div>';
  el.appendChild(m);

  setTimeout(function () { renderGraficos(alertasData); }, 100);
}

// ── RENDER HISTÓRICO ──────────────────────────────────────────

export function renderHistorico() {
  var el    = document.getElementById('historico-list');
  var items = [];

  alertasData.forEach(function (a) {
    (a.historico || []).forEach(function (h) {
      items.push({ preco: h.preco, data: h.data, rota: a.origem + ' → ' + a.destino, dataIda: a.dataIda });
    });
  });

  items.sort(function (x, y) { return new Date(y.data) - new Date(x.data); });

  if (!items.length) {
    el.innerHTML = '<div class="empty">Historico disponivel apos a primeira verificacao.</div>';
    return;
  }

  var html = ''; var lastDate = '';
  items.forEach(function (item, i) {
    var d       = new Date(item.data);
    var dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    var timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (dateStr !== lastDate) { html += '<div class="hist-sep">' + dateStr + '</div>'; lastDate = dateStr; }

    var prev = items[i + 1]; var varStr = '— sem variacao'; var varClass = 'hist-var';
    if (prev) {
      var diff = item.preco - prev.preco;
      if (diff < -1) { varStr = '↓ R$ ' + Math.abs(diff).toFixed(0); varClass = 'hist-var down'; }
      else if (diff > 1) { varStr = '↑ R$ ' + diff.toFixed(0); varClass = 'hist-var up'; }
    }

    html += '<div class="hist-item">' +
      '<div class="hist-left"><div class="hist-route">' + item.rota + '</div><div class="hist-meta">' + timeStr + ' · ida ' + formatData(item.dataIda) + '</div></div>' +
      '<div class="hist-right"><div class="hist-price">R$ ' + item.preco.toFixed(2).replace('.', ',') + '</div><div class="' + varClass + '">' + varStr + '</div></div>' +
    '</div>';
  });
  el.innerHTML = html;
}

// ── RENDER CONFIG (lista de alertas na aba Config) ────────────

export function renderConfigAlertas() {
  var el = document.getElementById('config-alertas-list');
  if (!alertasData.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:4px 2px 12px;">Nenhum alerta cadastrado ainda.</div>';
    return;
  }
  el.innerHTML = alertasData.map(function (a) {
    return '<div class="alerta-item">' +
      '<div class="alerta-header">' +
        '<div class="alerta-route">' + a.origem + ' <span>→</span> ' + a.destino + '</div>' +
        '<div class="remove-btn" onclick="removerAlerta(' + a.indice + ')">×</div>' +
      '</div>' +
      '<div class="alerta-dates">' +
        '<div class="alerta-date">ida <strong>' + formatData(a.dataIda) + '</strong>' +
          (a.dataVolta ? ' · volta <strong>' + formatData(a.dataVolta) + '</strong>' : '') + '</div>' +
        '<div class="alerta-cia">R$ ' + (a.precoAtual > 0 ? a.precoAtual.toFixed(2).replace('.', ',') : '—') + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

// ── CRUD ALERTAS ──────────────────────────────────────────────

export function adicionarAlerta() {
  var origem  = document.getElementById('input-origem').value.trim().toUpperCase();
  var destino = document.getElementById('input-destino').value.trim().toUpperCase();
  var dataIda = document.getElementById('input-ida').value;
  var dataVolta = document.getElementById('input-volta').value;

  if (!origem  || origem.length !== 3)  { showToast('Informe a origem', 'error'); return; }
  if (!destino || destino.length !== 3) { showToast('Informe o destino', 'error'); return; }
  if (!dataIda)                          { showToast('Informe a data de ida', 'error'); return; }

  var btn = document.getElementById('btn-adicionar');
  btn.classList.add('loading'); btn.textContent = 'Criando...';

  adicionarAlertaAPI(origem, destino, dataIda, dataVolta || null)
  .then(function (res) {
    if (!res || res.erro) {
      showToast(res ? res.erro : 'Erro ao criar', 'error');
    } else {
      showToast('Alerta criado!', 'success');
      document.getElementById('input-origem').value = '';
      document.getElementById('input-destino').value = '';
      document.getElementById('input-ida').value = '';
      document.getElementById('input-volta').value = '';
      document.getElementById('display-range').textContent = 'selecionar datas';
      document.getElementById('display-range').className = 'field-placeholder';
      carregarAlertas().then(function () { renderAlertas(); renderHistorico(); renderConfigAlertas(); });
    }
    btn.classList.remove('loading'); btn.textContent = 'Criar alerta';
  })
  .catch(function () {
    showToast('Erro ao criar', 'error');
    btn.classList.remove('loading'); btn.textContent = 'Criar alerta';
  });
}

export function removerAlerta(indice) {
  removerAlertaAPI(indice)
  .then(function (res) {
    if (!res || res.erro) { showToast(res ? res.erro : 'Erro', 'error'); return; }
    showToast('Alerta removido', 'success');
    carregarAlertas().then(function () { renderAlertas(); renderHistorico(); renderConfigAlertas(); });
  })
  .catch(function () { showToast('Erro ao remover', 'error'); });
}

// ── ANÁLISE IA ────────────────────────────────────────────────

export function solicitarAnalise(id) {
  var btn = document.getElementById('btn-ai-' + id);
  btn.innerHTML = '<div class="spinner"></div><span>Analisando...</span>';
  btn.style.pointerEvents = 'none';

  analisarAlertaAPI(id)
  .then(function (res) {
    if (!res || res.erro) {
      showToast(res ? res.erro : 'Erro ao analisar', 'error');
      btn.innerHTML = '<span>Analisar com IA</span>'; btn.style.pointerEvents = '';
      return;
    }
    var linhas = res.analise.split('\n');
    document.getElementById('ai-verdict-' + id).textContent = linhas[0];
    document.getElementById('ai-text-' + id).textContent = linhas.slice(1).join('\n').trim();
    document.getElementById('ai-' + id).style.display = 'block';
    btn.style.display = 'none';
  })
  .catch(function () {
    showToast('Erro ao analisar', 'error');
    btn.innerHTML = '<span>Analisar com IA</span>'; btn.style.pointerEvents = '';
  });
}

// ── AUTOCOMPLETE ──────────────────────────────────────────────

export function doAutocomplete(input, tipo) {
  var val  = input.value.toUpperCase().trim();
  var drop = document.getElementById('drop-' + tipo);
  if (val.length === 0) { drop.classList.remove('open'); drop.innerHTML = ''; return; }

  var matches = AEROPORTOS.filter(function (a) {
    return a.code.indexOf(val) === 0 ||
      a.name.toUpperCase().indexOf(val) >= 0 ||
      a.city.toUpperCase().indexOf(val) >= 0;
  }).slice(0, 5);

  if (!matches.length) { drop.classList.remove('open'); return; }

  drop.innerHTML = matches.map(function (a) {
    return '<div class="autocomplete-item"' +
      ' onmousedown="pickAirport(\'' + a.code + '\',\'' + tipo + '\')"' +
      ' ontouchstart="pickAirport(\'' + a.code + '\',\'' + tipo + '\')">' +
      '<div class="ac-code">' + a.code + '</div>' +
      '<div class="ac-info"><div class="ac-name">' + a.name + '</div><div class="ac-city">' + a.city + '</div></div>' +
    '</div>';
  }).join('');
  drop.classList.add('open');
}

export function pickAirport(code, tipo) {
  document.getElementById('input-' + tipo).value = code;
  var drop = document.getElementById('drop-' + tipo);
  drop.classList.remove('open'); drop.innerHTML = '';
  document.getElementById('input-' + tipo).blur();
}
