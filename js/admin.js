// ============================================================
//  admin.js — Painel admin, configs do usuário e config de IA
// ============================================================

import { WORKER_URL, getSessao, showToast } from './config.js';

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
            (u.tokenIA   ? '<span class="badge badge-purple">token próprio</span>' : '') +
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
          '<div class="btn-small" onclick="adminEditarLimite(\'' + u.email + '\', ' + (u.limiteAlertas ?? 10) + ')">Limite</div>' +
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

export function adminEditarLimite(email, limiteAtual) {
  var novoLimite = prompt('Novo limite de alertas para ' + email + ':
(0 = ilimitado para admins, padrão = 10)', limiteAtual);
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
