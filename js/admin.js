// ============================================================
//  admin.js — Painel admin e configurações do usuário
// ============================================================

import { WORKER_URL, getSessao, showToast } from './config.js';

var _cfgPctAtual = 0;

// ── CONFIGS DO USUÁRIO ────────────────────────────────────────

export function renderConfigs() {
  var sessao = getSessao();
  if (!sessao || !sessao.usuario) return;

  fetch(WORKER_URL + '/auth/me', { headers: { 'Authorization': 'Bearer ' + sessao.token } })
  .then(function (r) { return r.json(); })
  .then(function (u) {
    _cfgPctAtual = u.percentualMinimo || 0;
    var pctEl = document.getElementById('cfg-pct');
    var iaEl  = document.getElementById('cfg-ia');
    var limEl = document.getElementById('cfg-limite');
    if (pctEl) pctEl.textContent = _cfgPctAtual + '%';
    if (iaEl)  iaEl.textContent  = u.analiseIA ? '✅ Ativa' : '❌ Inativa (solicite ao admin)';
    if (limEl) limEl.textContent = u.isAdmin ? 'Ilimitado' : (u.limiteAlertas ?? 10) + ' alertas';
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
      return '<div class="usuario-card">' +
        '<div class="usuario-header">' +
          '<div>' +
            '<div class="usuario-nome">' + u.nome + '</div>' +
            '<div class="usuario-email">' + u.email + '</div>' +
          '</div>' +
          '<div class="usuario-badges">' +
            (u.isAdmin   ? '<span class="badge badge-purple">admin</span>'    : '') +
            (u.ativo     ? '<span class="badge badge-green">ativo</span>'     : '<span class="badge badge-red">inativo</span>') +
            (u.analiseIA ? '<span class="badge badge-green">IA ✓</span>'      : '<span class="badge badge-gray">sem IA</span>') +
          '</div>' +
        '</div>' +
        '<div class="usuario-meta">' +
          '<div class="usuario-meta-item">Chat ID: <strong>' + (u.chatId || '—') + '</strong></div>' +
          '<div class="usuario-meta-item">Alertas: <strong>' + (u.totalAlertas || 0) + '</strong></div>' +
          '<div class="usuario-meta-item">Queda mín: <strong>' + (u.percentualMinimo || 0) + '%</strong></div>' +
          '<div class="usuario-meta-item">Limite: <strong>' + (u.limiteAlertas ?? 10) + '</strong></div>' +
        '</div>' +
        '<div class="usuario-actions">' +
          (u.analiseIA
            ? '<div class="btn-small" onclick="adminToggleIA(\'' + u.email + '\', false)">Desativar IA</div>'
            : '<div class="btn-small" onclick="adminToggleIA(\'' + u.email + '\', true)">Ativar IA</div>') +
          (u.ativo
            ? '<div class="btn-small" onclick="adminToggleAtivo(\'' + u.email + '\', false)">Desativar</div>'
            : '<div class="btn-small" onclick="adminToggleAtivo(\'' + u.email + '\', true)">Ativar</div>') +
          (!u.isAdmin ? '<div class="btn-small danger" onclick="adminRemoverUsuario(\'' + u.email + '\', \'' + u.nome + '\')">Remover</div>' : '') +
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
  })
  .catch(function () {
    if (btn) { btn.style.opacity = '1'; btn.style.pointerEvents = ''; btn.textContent = 'Enviar convite'; }
    showToast('Erro ao enviar convite', 'error');
  });
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
