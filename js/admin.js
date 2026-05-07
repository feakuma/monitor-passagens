// ============================================================
//  admin.js — Painel admin e configurações do usuário
// ============================================================

import { WORKER_URL, getSessao, showToast } from './config.js';

let _cfgPctAtual = 0;
export let _pendingNome = null;
export let _pendingTipo = null;

// CONFIGS DO USUÁRIO
export function renderConfigs() {
  const sessao = getSessao();
  if (!sessao) return;

  fetch(WORKER_URL + '/auth/me', { headers: { 'Authorization': 'Bearer ' + sessao.token } })
  .then(r => r.json())
  .then(u => {
    _cfgPctAtual = u.percentualMinimo || 0;
    const pctEl = document.getElementById('cfg-pct');
    const iaEl  = document.getElementById('cfg-ia');
    if (pctEl) pctEl.textContent = _cfgPctAtual + '%';
    if (iaEl)  iaEl.textContent  = u.analiseIA ? '✅ Ativa' : '❌ Inativa (solicite ao admin)';
    const limEl = document.getElementById('cfg-limite');
    if (limEl) limEl.textContent = u.isAdmin ? 'Ilimitado' : (u.limiteAlertas ?? 10) + ' alertas';
  });
}

export function editarConfigs() {
  const form  = document.getElementById('cfg-edit-form');
  const input = document.getElementById('cfg-pct-input');
  if (!form || !input) return;
  input.value = _cfgPctAtual;
  form.style.display = 'block';
}

export function cancelarEditConfigs() {
  document.getElementById('cfg-edit-form').style.display = 'none';
}

export function salvarConfigs() {
  const pct    = parseInt(document.getElementById('cfg-pct-input').value || '0');
  const sessao = getSessao();

  fetch(WORKER_URL + '/auth/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessao.token },
    body: JSON.stringify({ percentualMinimo: pct })
  })
  .then(r => r.json())
  .then(data => {
    if (data.erro) { showToast(data.erro, 'error'); return; }
    _cfgPctAtual = pct;
    document.getElementById('cfg-pct').textContent = pct + '%';
    document.getElementById('cfg-edit-form').style.display = 'none';
    showToast('Configuração salva!', 'success');
  })
  .catch(() => showToast('Erro ao salvar', 'error'));
}

// ADMIN — USUÁRIOS
export function carregarUsuarios() {
  const el     = document.getElementById('admin-usuarios-list');
  el.innerHTML = '<div class="empty">Carregando...</div>';
  const sessao = getSessao();

  fetch(WORKER_URL + '/admin/usuarios', { headers: { 'Authorization': 'Bearer ' + sessao.token } })
  .then(r => r.json())
  .then(usuarios => {
    if (!usuarios || usuarios.erro) { el.innerHTML = '<div class="empty">Erro ao carregar usuários.</div>'; return; }
    if (!usuarios.length) { el.innerHTML = '<div class="empty">Nenhum usuário cadastrado.</div>'; return; }

    el.innerHTML = usuarios.map(u =>
      '<div class="usuario-card"><div class="usuario-header"><div><div class="usuario-nome">' + u.nome +
      '</div><div class="usuario-email">' + u.email + '</div></div><div class="usuario-badges">' +
      (u.isAdmin ? '<span class="badge badge-purple">admin</span>' : '') +
      (u.ativo   ? '<span class="badge badge-green">ativo</span>' : '<span class="badge badge-red">inativo</span>') +
      (u.analiseIA ? '<span class="badge badge-green">IA ✓</span>' : '<span class="badge badge-gray">sem IA</span>') +
      '</div></div><div class="usuario-meta">' +
      '<div class="usuario-meta-item">Chat ID: <strong>' + (u.chatId || '—') + '</strong></div>' +
      '<div class="usuario-meta-item">Alertas: <strong>' + (u.totalAlertas || 0) + '</strong></div>' +
      '<div class="usuario-meta-item">Queda mín: <strong>' + (u.percentualMinimo || 0) + '%</strong></div>' +
      '<div class="usuario-meta-item">Limite alertas: <strong>' + (u.limiteAlertas ?? 10) + '</strong></div>' +
      '</div><div class="usuario-actions">' +
      (u.analiseIA
        ? '<div class="btn-small" onclick="window._adminToggleIA(\'' + u.email + '\', false)">Desativar IA</div>'
        : '<div class="btn-small" onclick="window._adminToggleIA(\'' + u.email + '\', true)">Ativar IA</div>') +
      (u.ativo
        ? '<div class="btn-small" onclick="window._adminToggleAtivo(\'' + u.email + '\', false)">Desativar</div>'
        : '<div class="btn-small" onclick="window._adminToggleAtivo(\'' + u.email + '\', true)">Ativar</div>') +
      (!u.isAdmin ? '<div class="btn-small danger" onclick="window._adminRemoverUsuario(\'' + u.email + '\', \'' + u.nome + '\')">Remover</div>' : '') +
      '</div></div>'
    ).join('');
  })
  .catch(() => { el.innerHTML = '<div class="empty">Erro ao carregar usuários.</div>'; });
}

export function adminEnviarConvite() {
  const email  = document.getElementById('convite-email').value.trim().toLowerCase();
  if (!email || !email.includes('@')) { showToast('Informe um e-mail válido', 'error'); return; }
  const sessao = getSessao();

  fetch(WORKER_URL + '/admin/convite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessao.token },
    body: JSON.stringify({ email })
  })
  .then(r => r.json())
  .then(data => {
    if (data.erro) { showToast(data.erro, 'error'); return; }
    showToast('Convite enviado!', 'success');
    document.getElementById('convite-email').value = '';
  })
  .catch(() => showToast('Erro ao enviar convite', 'error'));
}

export function adminCriarUsuario() {
  const nome   = document.getElementById('admin-nome').value.trim();
  const email  = document.getElementById('admin-email').value.trim().toLowerCase();
  const chatId = document.getElementById('admin-chatid').value.trim();
  const ia     = document.getElementById('admin-ia').value === 'true';
  const pct    = parseInt(document.getElementById('admin-pct').value || '0');

  if (!nome || !email) { showToast('Preencha nome e e-mail', 'error'); return; }
  if (!chatId) {
    _pendingNome = nome; _pendingTipo = 'manual';
    document.getElementById('modal-sem-chatid').style.display = 'flex';
    return;
  }
  _executarCriarUsuarioManual();
}

export function _executarCriarUsuarioManual() {
  const nome   = document.getElementById('admin-nome').value.trim();
  const email  = document.getElementById('admin-email').value.trim().toLowerCase();
  const chatId = document.getElementById('admin-chatid').value.trim();
  const ia     = document.getElementById('admin-ia').value === 'true';
  const pct    = parseInt(document.getElementById('admin-pct').value || '0');
  const limite = parseInt(document.getElementById('admin-limite')?.value || '10');
  const sessao = getSessao();

  fetch(WORKER_URL + '/admin/usuarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessao.token },
    body: JSON.stringify({ nome, email, chatId, analiseIA: ia, percentualMinimo: pct, limiteAlertas: limite })
  })
  .then(r => r.json())
  .then(data => {
    if (data.erro) { showToast(data.erro, 'error'); return; }
    showToast('Usuário cadastrado!', 'success');
    ['admin-nome','admin-email','admin-chatid'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('admin-pct').value = '0';
    carregarUsuarios();
  })
  .catch(() => showToast('Erro ao cadastrar', 'error'));
}

export function adminEditarLimite(email, limiteAtual) {
  const novoLimite = prompt(`Novo limite de alertas para ${email}:`, limiteAtual);
  if (novoLimite === null) return;
  const limite = parseInt(novoLimite);
  if (isNaN(limite) || limite < 1) { showToast('Limite inválido', 'error'); return; }
  const sessao = getSessao();
  fetch(WORKER_URL + '/admin/usuarios/' + encodeURIComponent(email) + '/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessao.token },
    body: JSON.stringify({ limiteAlertas: limite })
  })
  .then(r => r.json())
  .then(data => { if (data.erro) { showToast(data.erro, 'error'); return; } showToast('Limite atualizado!', 'success'); carregarUsuarios(); })
  .catch(() => showToast('Erro ao atualizar', 'error'));
}

export function adminToggleIA(email, ativo) {
  const sessao = getSessao();
  fetch(WORKER_URL + '/admin/usuarios/' + encodeURIComponent(email) + '/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessao.token },
    body: JSON.stringify({ analiseIA: ativo })
  })
  .then(r => r.json())
  .then(data => { if (data.erro) { showToast(data.erro, 'error'); return; } showToast('Atualizado!', 'success'); carregarUsuarios(); })
  .catch(() => showToast('Erro ao atualizar', 'error'));
}

export function adminToggleAtivo(email, ativo) {
  const sessao = getSessao();
  fetch(WORKER_URL + '/admin/usuarios/' + encodeURIComponent(email) + '/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessao.token },
    body: JSON.stringify({ ativo })
  })
  .then(r => r.json())
  .then(data => { if (data.erro) { showToast(data.erro, 'error'); return; } showToast(ativo ? 'Usuário ativado!' : 'Usuário desativado!', 'success'); carregarUsuarios(); })
  .catch(() => showToast('Erro ao atualizar', 'error'));
}

export function adminRemoverUsuario(email, nome) {
  if (!confirm('Remover ' + nome + '? Todos os alertas serão apagados.')) return;
  const sessao = getSessao();
  fetch(WORKER_URL + '/admin/usuarios/' + encodeURIComponent(email), {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + sessao.token }
  })
  .then(r => r.json())
  .then(data => { if (data.erro) { showToast(data.erro, 'error'); return; } showToast('Usuário removido!', 'success'); carregarUsuarios(); })
  .catch(() => showToast('Erro ao remover', 'error'));
}
