// ============================================================
//  admin.js — Painel admin, configs do usuário e config de IA
// ============================================================

import { WORKER_URL, getSessao, showToast, esc, escAttr } from './config.js';

var _cfgPctAtual = 0;

export const DEFAULT_PROMPT =
`Analise este voo como especialista em tarifas aéreas.
Rota: {origem} → {destino}
Ida: {dataIda}{dataVoltaStr}
Preço atual: R$ {precoAtual}
Variação desde início do monitoramento: {variacao}%
Histórico recente de preços: {historicoPontos}

Responda EXATAMENTE em 2 frases curtas em português:
1. Veredicto claro: "COMPRE AGORA", "AGUARDE" ou "PREÇO ESTÁVEL"
2. Justificativa objetiva em até 20 palavras explicando o motivo.`;

// ── CONFIGS DO USUÁRIO ────────────────────────────────────────

export function renderConfigs() {
  var sessao = getSessao();
  if (!sessao || !sessao.usuario) return;

  fetch(WORKER_URL + '/auth/me', { headers: { 'Authorization': 'Bearer ' + sessao.token } })
  .then(function (r) { return r.json(); })
  .then(function (u) {
    _cfgPctAtual = u.percentualMinimo || 0;

    var pctEl    = document.getElementById('cfg-pct');
    var iaEl     = document.getElementById('cfg-ia');
    var limEl    = document.getElementById('cfg-limite');
    var provEl   = document.getElementById('cfg-provider-status');
    var tokenEl  = document.getElementById('cfg-token-status');

    if (pctEl) pctEl.textContent = _cfgPctAtual + '%';
    if (iaEl)  iaEl.textContent  = u.analiseIA ? '✅ Ativa (sistema)' : '❌ Inativa';
    if (limEl) limEl.textContent = u.isAdmin ? 'Ilimitado' : (u.limiteAlertas ?? 10) + ' alertas';

    // Status do token próprio
    var provedores = { anthropic: 'Claude (Anthropic)', openai: 'GPT (OpenAI)', google: 'Gemini (Google)' };
    if (provEl) provEl.textContent = u.tokenIA
      ? (provedores[u.providerIA] || 'Anthropic')
      : '— não configurado';
    if (tokenEl) tokenEl.textContent = u.tokenIA ? '🔑 Configurado' : '— não configurado';
  });
}

export function editarConfigs() {
  var form  = document.getElementById('cfg-edit-form');
  var input = document.getElementById('cfg-pct-input');
  if (!form || !input) return;
  input.value = _cfgPctAtual;
  form.style.display = 'block';
}

export function cancelarEditConfigs() {
  document.getElementById('cfg-edit-form').style.display = 'none';
}

export function salvarConfigs() {
  var pct    = parseInt(document.getElementById('cfg-pct-input').value || '0');
  var sessao = getSessao();
  fetch(WORKER_URL + '/auth/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessao.token },
    body: JSON.stringify({ percentualMinimo: pct })
  })
  .then(function (r) { return r.json(); })
  .then(function (data) {
    if (data.erro) { showToast(data.erro, 'error'); return; }
    _cfgPctAtual = pct;
    document.getElementById('cfg-pct').textContent = pct + '%';
    document.getElementById('cfg-edit-form').style.display = 'none';
    showToast('Configuração salva!', 'success');
  })
  .catch(function () { showToast('Erro ao salvar', 'error'); });
}

// ── CONFIG DE IA ──────────────────────────────────────────────

export function editarConfigIA() {
  var sessao = getSessao();
  if (!sessao) return;

  // Carrega dados atuais do usuário para preencher o form
  fetch(WORKER_URL + '/auth/me', { headers: { 'Authorization': 'Bearer ' + sessao.token } })
  .then(function (r) { return r.json(); })
  .then(function (u) {
    var provInput   = document.getElementById('cfg-provider-input');
    var tokenInput  = document.getElementById('cfg-token-input');
    var promptInput = document.getElementById('cfg-prompt-input');

    if (provInput)   provInput.value   = u.providerIA  || 'anthropic';
    if (tokenInput)  tokenInput.value  = '';            // nunca pré-preenche por segurança
    if (promptInput) promptInput.value = u.promptIA    || DEFAULT_PROMPT;

    document.getElementById('cfg-ia-edit-form').style.display = 'block';
  });
}

export function cancelarEditConfigIA() {
  document.getElementById('cfg-ia-edit-form').style.display = 'none';
}

export function salvarConfigIA() {
  var provider = document.getElementById('cfg-provider-input').value;
  var token    = document.getElementById('cfg-token-input').value.trim();
  var prompt   = document.getElementById('cfg-prompt-input').value.trim();
  var sessao   = getSessao();

  var payload = { providerIA: provider, promptIA: prompt || DEFAULT_PROMPT };
  // Só envia tokenIA se o usuário digitou algo — campo vazio = mantém o token atual
  if (token) payload.tokenIA = token;

  fetch(WORKER_URL + '/auth/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessao.token },
    body: JSON.stringify(payload)
  })
  .then(function (r) { return r.json(); })
  .then(function (data) {
    if (data.erro) { showToast(data.erro, 'error'); return; }
    document.getElementById('cfg-ia-edit-form').style.display = 'none';
    showToast('Configuração de IA salva!', 'success');
    renderConfigs();
  })
  .catch(function () { showToast('Erro ao salvar', 'error'); });
}

export function resetPrompt() {
  var el = document.getElementById('cfg-prompt-input');
  if (el) { el.value = DEFAULT_PROMPT; showToast('Prompt restaurado ao padrão', 'success'); }
}

export function toggleTokenVisibility() {
  var input = document.getElementById('cfg-token-input');
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

export function removerTokenIA() {
  if (!confirm('Remover seu token de IA? A análise voltará a usar o token do sistema (se habilitado pelo admin).')) return;
  var sessao = getSessao();
  fetch(WORKER_URL + '/auth/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessao.token },
    body: JSON.stringify({ tokenIA: '' })
  })
  .then(function (r) { return r.json(); })
  .then(function (data) {
    if (data.erro) { showToast(data.erro, 'error'); return; }
    showToast('Token removido', 'success');
    renderConfigs();
  })
  .catch(function () { showToast('Erro ao remover token', 'error'); });
}

// ── ADMIN — USUÁRIOS ──────────────────────────────────────────

export function carregarUsuarios() {
  var el     = document.getElementById('admin-usuarios-list');
  el.innerHTML = '<div class="empty">Carregando...</div>';
  var sessao = getSessao();

  fetch(WORKER_URL + '/admin/usuarios', { headers: { 'Authorization': 'Bearer ' + sessao.token } })
  .then(function (r) { return r.json(); })
  .then(function (usuarios) {
    if (!usuarios || usuarios.erro) { el.innerHTML = '<div class="empty">Erro ao carregar usuários.</div>'; return; }
    if (!usuarios.length)           { el.innerHTML = '<div class="empty">Nenhum usuário cadastrado.</div>'; return; }

    el.innerHTML = usuarios.map(function (u) {
      // ── Card de convite pendente ────────────────────────────
      if (u.pendente) {
        var dataConvite = u.criadoEm ? new Date(u.criadoEm).toLocaleDateString('pt-BR') : '—';
        return '<div class="usuario-card usuario-card-pendente">' +
          '<div class="usuario-header">' +
            '<div>' +
              '<div class="usuario-nome" style="color:var(--text2);">✉️ ' + esc(u.email) + '</div>' +
              '<div class="usuario-email">Convite enviado em ' + esc(dataConvite) + '</div>' +
            '</div>' +
            '<div class="usuario-badges">' +
              '<span class="badge badge-yellow">aguardando</span>' +
            '</div>' +
          '</div>' +
          '<div class="usuario-actions">' +
            '<div class="btn-small" onclick="adminReenviarConvite(\'' + escAttr(u.email) + '\')">📨 Reenviar</div>' +
            '<div class="btn-small danger" onclick="adminCancelarConvite(\'' + escAttr(u.token) + '\', \'' + escAttr(u.email) + '\')">Cancelar</div>' +
          '</div>' +
        '</div>';
      }
      // ── Card de usuário cadastrado ──────────────────────────
      return '<div class="usuario-card">' +
        '<div class="usuario-header">' +
          '<div>' +
            '<div class="usuario-nome" style="cursor:pointer;text-decoration:underline dotted;" onclick="adminVerAlertas(\'' + escAttr(u.email) + '\', \'' + escAttr(u.nome) + '\')">' + esc(u.nome) + '</div>' +
            '<div class="usuario-email">' + esc(u.email) + '</div>' +
          '</div>' +
          '<div class="usuario-badges">' +
            (u.isAdmin   ? '<span class="badge badge-purple">admin</span>'    : '') +
            (u.ativo     ? '<span class="badge badge-green">ativo</span>'     : '<span class="badge badge-red">inativo</span>') +
            (u.analiseIA ? '<span class="badge badge-green">IA ✓</span>'      : '<span class="badge badge-gray">sem IA</span>') +
            (u.tokenIA   ? '<span class="badge badge-purple">token próprio</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="usuario-meta">' +
          '<div class="usuario-meta-item">Chat ID: <strong>' + esc(u.chatId || '—') + '</strong></div>' +
          '<div class="usuario-meta-item">Alertas: <strong>' + (u.totalAlertas || 0) + '</strong></div>' +
          '<div class="usuario-meta-item">Queda mín: <strong>' + (u.percentualMinimo || 0) + '%</strong></div>' +
          '<div class="usuario-meta-item">Limite: <strong>' + (u.limiteAlertas ?? 10) + '</strong></div>' +
        '</div>' +
        '<div class="usuario-actions">' +
          '<div class="btn-small" onclick="adminAbrirEdicao(\'' + escAttr(u.email) + '\')">✏️ Editar</div>' +
          '<div class="btn-small" onclick="adminVerAudit(\'' + escAttr(u.email) + '\', \'' + escAttr(u.nome) + '\')">📋 Audit</div>' +
          (u.ativo
            ? '<div class="btn-small" onclick="adminToggleAtivo(\'' + escAttr(u.email) + '\', false)">Desativar</div>'
            : '<div class="btn-small" onclick="adminToggleAtivo(\'' + escAttr(u.email) + '\', true)">Ativar</div>') +
          (!u.isAdmin ? '<div class="btn-small danger" onclick="adminRemoverUsuario(\'' + escAttr(u.email) + '\', \'' + escAttr(u.nome) + '\')">Remover</div>' : '') +
        '</div>' +
      '</div>';
    }).join('');
  })
  .catch(function () { el.innerHTML = '<div class="empty">Erro ao carregar usuários.</div>'; });
}

export function adminEnviarConvite() {
  var email = document.getElementById('convite-email').value.trim().toLowerCase();
  if (!email || !email.includes('@')) { showToast('Informe um e-mail válido', 'error'); return; }

  var btn = document.getElementById('btn-enviar-convite');
  if (btn) { btn.style.opacity = '0.5'; btn.style.pointerEvents = 'none'; btn.textContent = 'Enviando...'; }

  var sessao = getSessao();
  fetch(WORKER_URL + '/admin/convite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessao.token },
    body: JSON.stringify({ email: email })
  })
  .then(function (r) { return r.json(); })
  .then(function (data) {
    if (btn) { btn.style.opacity = '1'; btn.style.pointerEvents = ''; btn.textContent = 'Enviar convite'; }
    if (data.erro) { showToast(data.erro, 'error'); return; }
    showToast('Convite enviado!', 'success');
    document.getElementById('convite-email').value = '';
    carregarUsuarios();
  })
  .catch(function () {
    if (btn) { btn.style.opacity = '1'; btn.style.pointerEvents = ''; btn.textContent = 'Enviar convite'; }
    showToast('Erro ao enviar convite', 'error');
  });
}

export function adminReenviarConvite(email) {
  if (!confirm('Reenviar convite para ' + email + '?')) return;
  var sessao = getSessao();
  fetch(WORKER_URL + '/admin/convite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessao.token },
    body: JSON.stringify({ email: email })
  })
  .then(function (r) { return r.json(); })
  .then(function (data) {
    if (data.erro) { showToast(data.erro, 'error'); return; }
    showToast('Convite reenviado para ' + email + '!', 'success');
    carregarUsuarios();
  })
  .catch(function () { showToast('Erro ao reenviar convite', 'error'); });
}

export function adminCancelarConvite(token, email) {
  if (!confirm('Cancelar convite para ' + email + '?')) return;
  var sessao = getSessao();
  fetch(WORKER_URL + '/admin/convite/' + encodeURIComponent(token), {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + sessao.token }
  })
  .then(function (r) { return r.json(); })
  .then(function (data) {
    if (data.erro) { showToast(data.erro, 'error'); return; }
    showToast('Convite cancelado.', 'success');
    carregarUsuarios();
  })
  .catch(function () { showToast('Erro ao cancelar convite', 'error'); });
}

export function adminCriarUsuario() {
  var nome   = document.getElementById('admin-nome').value.trim();
  var email  = document.getElementById('admin-email').value.trim().toLowerCase();
  var chatId = document.getElementById('admin-chatid').value.trim();
  if (!nome || !email) { showToast('Preencha nome e e-mail', 'error'); return; }
  if (!chatId) {
    window._pendingNome = nome;
    window._pendingTipo = 'manual';
    document.getElementById('modal-sem-chatid').style.display = 'flex';
    return;
  }
  _executarCriarUsuarioManual();
}

export function _executarCriarUsuarioManual() {
  var nome   = document.getElementById('admin-nome').value.trim();
  var email  = document.getElementById('admin-email').value.trim().toLowerCase();
  var chatId = document.getElementById('admin-chatid').value.trim();
  var ia     = document.getElementById('admin-ia').value === 'true';
  var pct    = parseInt(document.getElementById('admin-pct').value || '0');
  var sessao = getSessao();

  fetch(WORKER_URL + '/admin/usuarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessao.token },
    body: JSON.stringify({ nome: nome, email: email, chatId: chatId, analiseIA: ia, percentualMinimo: pct })
  })
  .then(function (r) { return r.json(); })
  .then(function (data) {
    if (data.erro) { showToast(data.erro, 'error'); return; }
    showToast('Usuário cadastrado!', 'success');
    document.getElementById('admin-nome').value = '';
    document.getElementById('admin-email').value = '';
    document.getElementById('admin-chatid').value = '';
    document.getElementById('admin-pct').value = '0';
    window._pendingNome = null; window._pendingTipo = null;
    carregarUsuarios();
  })
  .catch(function () { showToast('Erro ao cadastrar', 'error'); });
}

// Armazena dados do usuário sendo editado
var _adminEditandoEmail = null;
var _adminEditandoUsuario = null;

export function adminAbrirEdicao(email) {
  var sessao = getSessao();
  fetch(WORKER_URL + '/admin/usuarios', { headers: { 'Authorization': 'Bearer ' + sessao.token } })
  .then(function (r) { return r.json(); })
  .then(function (usuarios) {
    var u = usuarios.find(function(x) { return x.email === email; });
    if (!u) { showToast('Usuário não encontrado', 'error'); return; }
    _adminEditandoEmail   = email;
    _adminEditandoUsuario = u;

    // Preenche o modal
    document.getElementById('modal-edit-nome').textContent    = u.nome;
    document.getElementById('modal-edit-email').textContent   = u.email;
    document.getElementById('modal-edit-pct').value           = u.percentualMinimo || 0;
    document.getElementById('modal-edit-limite').value        = u.limiteAlertas ?? 10;
    document.getElementById('modal-edit-ia').value            = u.analiseIA ? 'true' : 'false';
    document.getElementById('modal-edit-chatid').value        = u.chatId || '';
    document.getElementById('modal-edit-usuario').style.display = 'flex';
  })
  .catch(function () { showToast('Erro ao carregar dados', 'error'); });
}

export function adminSalvarEdicao() {
  if (!_adminEditandoEmail) return;
  var sessao = getSessao();
  var pct    = parseInt(document.getElementById('modal-edit-pct').value || '0');
  var limite = parseInt(document.getElementById('modal-edit-limite').value || '10');
  var ia     = document.getElementById('modal-edit-ia').value === 'true';
  var chatId = document.getElementById('modal-edit-chatid').value.trim();

  fetch(WORKER_URL + '/admin/usuarios/' + encodeURIComponent(_adminEditandoEmail) + '/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessao.token },
    body: JSON.stringify({ percentualMinimo: pct, limiteAlertas: limite, analiseIA: ia, chatId: chatId })
  })
  .then(function (r) { return r.json(); })
  .then(function (data) {
    if (data.erro) { showToast(data.erro, 'error'); return; }
    showToast('Usuário atualizado!', 'success');
    document.getElementById('modal-edit-usuario').style.display = 'none';
    _adminEditandoEmail   = null;
    _adminEditandoUsuario = null;
    carregarUsuarios();
  })
  .catch(function () { showToast('Erro ao salvar', 'error'); });
}

export function adminFecharEdicao() {
  document.getElementById('modal-edit-usuario').style.display = 'none';
  _adminEditandoEmail   = null;
  _adminEditandoUsuario = null;
}

export function adminEditarLimite(email, limiteAtual) {
  var novoLimite = prompt('Novo limite de alertas para ' + email + ':\n(padrão = 10)', limiteAtual);
  if (novoLimite === null) return;
  var limite = parseInt(novoLimite);
  if (isNaN(limite) || limite < 1) { showToast('Limite inválido — mínimo 1', 'error'); return; }
  var sessao = getSessao();
  fetch(WORKER_URL + '/admin/usuarios/' + encodeURIComponent(email) + '/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessao.token },
    body: JSON.stringify({ limiteAlertas: limite })
  })
  .then(function (r) { return r.json(); })
  .then(function (data) {
    if (data.erro) { showToast(data.erro, 'error'); return; }
    showToast('Limite atualizado para ' + limite + ' alertas!', 'success');
    carregarUsuarios();
  })
  .catch(function () { showToast('Erro ao atualizar limite', 'error'); });
}

export function adminToggleIA(email, ativo) {
  var sessao = getSessao();
  fetch(WORKER_URL + '/admin/usuarios/' + encodeURIComponent(email) + '/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessao.token },
    body: JSON.stringify({ analiseIA: ativo })
  })
  .then(function (r) { return r.json(); })
  .then(function (data) { if (data.erro) { showToast(data.erro, 'error'); return; } showToast('Atualizado!', 'success'); carregarUsuarios(); })
  .catch(function () { showToast('Erro ao atualizar', 'error'); });
}

export function adminToggleAtivo(email, ativo) {
  var sessao = getSessao();
  fetch(WORKER_URL + '/admin/usuarios/' + encodeURIComponent(email) + '/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessao.token },
    body: JSON.stringify({ ativo: ativo })
  })
  .then(function (r) { return r.json(); })
  .then(function (data) {
    if (data.erro) { showToast(data.erro, 'error'); return; }
    showToast(ativo ? 'Usuário ativado!' : 'Usuário desativado!', 'success');
    carregarUsuarios();
  })
  .catch(function () { showToast('Erro ao atualizar', 'error'); });
}

export function adminRemoverUsuario(email, nome) {
  if (!confirm('Remover ' + nome + '? Todos os alertas serão apagados.')) return;
  var sessao = getSessao();
  fetch(WORKER_URL + '/admin/usuarios/' + encodeURIComponent(email), {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + sessao.token }
  })
  .then(function (r) { return r.json(); })
  .then(function (data) {
    if (data.erro) { showToast(data.erro, 'error'); return; }
    showToast('Usuário removido!', 'success');
    carregarUsuarios();
  })
  .catch(function () { showToast('Erro ao remover', 'error'); });
}

function _sparkline(historico, w, h) {
  if (!historico || historico.length < 2) return '';
  var precos = historico.map(function (p) { return p.preco; });
  var mn = Math.min.apply(null, precos);
  var mx = Math.max.apply(null, precos);
  var range = mx - mn || 1;
  var pad = 4;
  var W = w - pad * 2;
  var H = h - pad * 2;
  var pts = precos.map(function (p, i) {
    var x = pad + (i / (precos.length - 1)) * W;
    var y = pad + (1 - (p - mn) / range) * H;
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  var lastY = (pad + (1 - (precos[precos.length - 1] - mn) / range) * H).toFixed(1);
  var lastX = (pad + W).toFixed(1);
  return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" class="sparkline-svg">' +
    '<polyline points="' + pts + '" fill="none" stroke="var(--accent,#6c63ff)" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>' +
    '<circle cx="' + lastX + '" cy="' + lastY + '" r="2.5" fill="var(--accent,#6c63ff)"/>' +
  '</svg>';
}

function _fmtBRL(v) {
  return 'R$ ' + Number(v).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
}

export function adminVerAlertas(email, nome) {
  var modal = document.getElementById('modal-alertas-usuario');
  var lista = document.getElementById('modal-alertas-lista');
  var nomeEl = document.getElementById('modal-alertas-nome');
  nomeEl.textContent = nome + ' (' + email + ')';
  lista.innerHTML = '<div class="empty">Carregando...</div>';
  modal.style.display = '';

  var sessao = getSessao();
  fetch(WORKER_URL + '/admin/usuarios/' + encodeURIComponent(email) + '/alertas', {
    headers: { 'Authorization': 'Bearer ' + sessao.token }
  })
  .then(function (r) { return r.json(); })
  .then(function (alertas) {
    if (!alertas || alertas.erro) { lista.innerHTML = '<div class="empty">Erro ao carregar alertas.</div>'; return; }
    if (!alertas.length) { lista.innerHTML = '<div class="empty">Nenhum alerta cadastrado.</div>'; return; }
    lista.innerHTML = alertas.map(function (a) {
      var temPreco = a.precoAtual > 0;
      var varClass = a.variacao < 0 ? 'price-drop' : (a.variacao > 0 ? 'price-up' : 'price-neutral');
      var varSinal = a.variacao < 0 ? '↓ ' : (a.variacao > 0 ? '↑ ' : '');

      var hist = Array.isArray(a.historico) ? a.historico : [];
      var temHist = hist.length >= 2;
      var precos  = hist.map(function (p) { return p.preco; });
      var minP    = temHist ? Math.min.apply(null, precos) : null;
      var maxP    = temHist ? Math.max.apply(null, precos) : null;
      var lastP   = temHist ? precos[precos.length - 1] : null;

      var sparkHTML = temHist ? (
        '<div class="sparkline-wrap">' +
          _sparkline(hist, 200, 48) +
          '<div class="sparkline-stats">' +
            '<span class="spark-min">↓ min ' + _fmtBRL(minP) + '</span>' +
            '<span class="spark-last">atual ' + _fmtBRL(lastP) + '</span>' +
            '<span class="spark-max">↑ max ' + _fmtBRL(maxP) + '</span>' +
          '</div>' +
          '<div class="sparkline-count">' + hist.length + ' registro' + (hist.length > 1 ? 's' : '') + '</div>' +
        '</div>'
      ) : (
        '<div class="sparkline-empty">Sem histórico de preços</div>'
      );

      return '<div class="card" style="margin-bottom:10px;">' +
        '<div class="card-body">' +
          '<div class="card-top">' +
            '<div class="route">' + esc(a.origem) + '<span class="route-sep"> → </span>' + esc(a.destino) + '</div>' +
            (temPreco ? '<div class="price-block">' +
              '<div class="price">R$ ' + a.precoAtual.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}) + '</div>' +
              (a.variacao !== 0 ? '<div class="' + varClass + '">' + varSinal + Math.abs(a.variacao) + '%</div>' : '') +
            '</div>' : '') +
          '</div>' +
          '<div class="dates">' +
            (a.dataIda   ? '<div class="date-row">ida <strong>' + esc(a.dataIda) + '</strong></div>' : '') +
            (a.dataVolta ? '<div class="date-row">volta <strong>' + esc(a.dataVolta) + '</strong></div>' : '') +
          '</div>' +
          sparkHTML +
        '</div>' +
      '</div>';
    }).join('');
  })
  .catch(function () { lista.innerHTML = '<div class="empty">Erro ao carregar alertas.</div>'; });
}

export function fecharModalAlertasUsuario() {
  document.getElementById('modal-alertas-usuario').style.display = 'none';
}

// ── ADMIN — AUDITORIA ────────────────────────────────────────

var _auditEmail = null;

var _auditIcones = {
  login:              '🔑',
  otp_solicitado:     '📧',
  cadastro:           '🎉',
  alerta_criado:      '✈️',
  alerta_removido:    '🗑️',
  push_ativado:       '🔔',
  push_desativado:    '🔕',
  analise_ia:         '🤖',
  preco_checado:      '🔍',
  telegram_ok:        '✅',
  telegram_falhou:    '❌',
  push_ok:            '📲',
  push_falhou:        '⚠️',
  email_ok:           '📩',
  email_falhou:       '⚠️',
  convite_enviado:    '✉️',
  convite_cancelado:  '🚫',
};

var _auditLabels = {
  login:              'Login',
  otp_solicitado:     'Código de acesso solicitado',
  cadastro:           'Conta criada via convite',
  alerta_criado:      'Alerta criado',
  alerta_removido:    'Alerta removido',
  push_ativado:       'Push ativado',
  push_desativado:    'Push desativado',
  analise_ia:         'Análise de IA',
  preco_checado:      'Preço checado',
  telegram_ok:        'Telegram enviado',
  telegram_falhou:    'Telegram falhou',
  push_ok:            'Push enviado',
  push_falhou:        'Push falhou',
  email_ok:           'E-mail enviado',
  email_falhou:       'E-mail falhou',
  convite_enviado:    'Convite enviado',
  convite_cancelado:  'Convite cancelado',
};

export function adminVerAudit(email, nome) {
  _auditEmail = email;
  document.getElementById('modal-audit-nome').textContent = nome + ' (' + email + ')';
  document.getElementById('modal-audit-usuario').style.display = '';
  _buscarAudit(email);
}

export function fecharModalAudit() {
  document.getElementById('modal-audit-usuario').style.display = 'none';
  _auditEmail = null;
}

export function recarregarAudit() {
  if (_auditEmail) _buscarAudit(_auditEmail);
}

function _buscarAudit(email) {
  var lista = document.getElementById('modal-audit-lista');
  lista.innerHTML = '<div class="empty">Carregando...</div>';

  var dias = parseInt((document.getElementById('audit-periodo') || {}).value || '6');
  var ate  = new Date().toISOString().slice(0, 10);
  var de   = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);

  var sessao = getSessao();
  fetch(WORKER_URL + '/admin/usuarios/' + encodeURIComponent(email) + '/audit?de=' + de + '&ate=' + ate, {
    headers: { 'Authorization': 'Bearer ' + sessao.token }
  })
  .then(function (r) { return r.json(); })
  .then(function (data) {
    if (!data.eventos || !data.eventos.length) {
      lista.innerHTML = '<div class="empty">Nenhum evento registrado no período.</div>';
      return;
    }
    lista.innerHTML = '<div class="card" style="padding:0 16px;">' +
      data.eventos.map(function (e) {
        var icone  = _auditIcones[e.tipo]  || '•';
        var label  = _auditLabels[e.tipo]  || e.tipo;
        var d      = new Date(e.ts);
        var tsStr  = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
                     ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return '<div class="audit-evento">' +
          '<div class="audit-icon">' + icone + '</div>' +
          '<div class="audit-body">' +
            '<div class="audit-tipo">' + label + '</div>' +
            (e.detalhe ? '<div class="audit-detalhe">' + esc(e.detalhe) + '</div>' : '') +
            '<div class="audit-ts">' + tsStr + '</div>' +
          '</div>' +
        '</div>';
      }).join('') +
    '</div>';
  })
  .catch(function () {
    lista.innerHTML = '<div class="empty">Erro ao carregar auditoria.</div>';
  });
}

// ── ADMIN — DASHBOARD ─────────────────────────────────────────

export function carregarDashboard() {
  var statsEl   = document.getElementById('dash-stats');
  var acessosEl = document.getElementById('dash-acessos');
  var rotasEl   = document.getElementById('dash-rotas');
  if (!statsEl) return;

  var hoje = new Date().toISOString().slice(0, 10);
  var dias = parseInt((document.getElementById('dash-periodo') || {}).value || '30');
  var de   = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
  var ate  = hoje;

  var sessao = getSessao();
  fetch(WORKER_URL + '/admin/dashboard?de=' + de + '&ate=' + ate, { headers: { 'Authorization': 'Bearer ' + sessao.token } })
  .then(function (r) { return r.json(); })
  .then(function (data) {
    if (data.erro) { statsEl.innerHTML = '<div class="empty">Erro ao carregar.</div>'; return; }

    statsEl.innerHTML = [
      { num: data.totalUsuarios,  label: 'usuários'  },
      { num: data.totalAtivos,    label: 'ativos'    },
      { num: data.totalAlertas,   label: 'alertas'   },
      { num: data.totalChecagens, label: 'checagens' }
    ].map(function (s) {
      return '<div class="dash-stat"><div class="dash-stat-num">' + (s.num ?? '—') + '</div>' +
             '<div class="dash-stat-label">' + s.label + '</div></div>';
    }).join('');

    if (data.acessos && data.acessos.length) {
      acessosEl.innerHTML = '<div class="card">' + data.acessos.map(function (u) {
        var ts = u.ultimoAcesso
          ? new Date(u.ultimoAcesso).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
          : '—';
        return '<div class="dash-user-row">' +
          '<div class="dash-user-info">' +
            '<div class="dash-user-name">' + esc(u.nome) + '</div>' +
            '<div class="dash-user-email">' + esc(u.email) + '</div>' +
            '<div class="dash-user-meta">último acesso: ' + esc(ts) + '</div>' +
          '</div>' +
          '<div style="display:flex;gap:16px;align-items:center;">' +
            '<div style="text-align:center;">' +
              '<div class="dash-stat-num" style="font-size:20px;">' + (u.acessos || 0) + '</div>' +
              '<div class="dash-user-meta">acessos</div>' +
            '</div>' +
            '<div style="text-align:center;">' +
              '<div class="dash-stat-num" style="font-size:20px;color:var(--text2);">' + (u.push || 0) + '</div>' +
              '<div class="dash-user-meta">push</div>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('') + '</div>';
    } else {
      acessosEl.innerHTML = '<div class="empty">Nenhum acesso registrado ainda.</div>';
    }

    if (data.rotasTop && data.rotasTop.length) {
      rotasEl.innerHTML = '<div class="card">' + data.rotasTop.map(function (r) {
        return '<div class="dash-rota-row">' +
          '<div style="font-size:15px;font-weight:500;">' + esc(r.rota) + '</div>' +
          '<div style="font-size:13px;color:var(--text2);">' + r.count + '×</div>' +
        '</div>';
      }).join('') + '</div>';
    } else {
      rotasEl.innerHTML = '<div class="empty">Sem dados de rotas.</div>';
    }
  })
  .catch(function () {
    if (statsEl) statsEl.innerHTML = '<div class="empty">Erro ao carregar dashboard.</div>';
  });
}
