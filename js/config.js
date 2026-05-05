// ============================================================
//  config.js — Constantes e gerenciamento de sessão
// ============================================================

export const WORKER_URL = 'https://passagens-proxy.felipe-akuma.workers.dev';
export const IS_GAS = typeof google !== 'undefined' && google.script;

export const AEROPORTOS = [
  { code:'CGH', name:'Congonhas', city:'Sao Paulo, SP' },
  { code:'GRU', name:'Guarulhos', city:'Sao Paulo, SP' },
  { code:'VCP', name:'Viracopos', city:'Campinas, SP' },
  { code:'FLN', name:'Hercilio Luz', city:'Florianopolis, SC' },
  { code:'GIG', name:'Galeao', city:'Rio de Janeiro, RJ' },
  { code:'SDU', name:'Santos Dumont', city:'Rio de Janeiro, RJ' },
  { code:'BSB', name:'Juscelino Kubitschek', city:'Brasilia, DF' },
  { code:'SSA', name:'Luis Eduardo Magalhaes', city:'Salvador, BA' },
  { code:'REC', name:'Guararapes', city:'Recife, PE' },
  { code:'FOR', name:'Pinto Martins', city:'Fortaleza, CE' },
  { code:'BEL', name:'Val de Cans', city:'Belem, PA' },
  { code:'MAO', name:'Eduardo Gomes', city:'Manaus, AM' },
  { code:'CWB', name:'Afonso Pena', city:'Curitiba, PR' },
  { code:'POA', name:'Salgado Filho', city:'Porto Alegre, RS' },
  { code:'GYN', name:'Santa Genoveva', city:'Goiania, GO' },
  { code:'VIX', name:'Eurico Salles', city:'Vitoria, ES' },
  { code:'CNF', name:'Tancredo Neves', city:'Belo Horizonte, MG' },
  { code:'IGU', name:'Cataratas', city:'Foz do Iguacu, PR' },
  { code:'NVT', name:'Victor Konder', city:'Navegantes, SC' },
  { code:'NAT', name:'Sao Goncalo do Amarante', city:'Natal, RN' },
  { code:'MCZ', name:'Zumbi dos Palmares', city:'Maceio, AL' },
  { code:'JPA', name:'Castro Pinto', city:'Joao Pessoa, PB' },
];

// SESSÃO
export function salvarSessao(token, usuario) {
  localStorage.setItem('pm_token', token);
  localStorage.setItem('pm_usuario', JSON.stringify(usuario));
}

export function getSessao() {
  const t = localStorage.getItem('pm_token');
  const u = localStorage.getItem('pm_usuario');
  if (!t || !u) return null;
  return { token: t, usuario: JSON.parse(u) };
}

export function limparSessao() {
  localStorage.removeItem('pm_token');
  localStorage.removeItem('pm_usuario');
}

// TOAST
export function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  setTimeout(() => { t.className = 'toast'; }, 3000);
}

// HELPERS
export function formatData(str) {
  if (!str) return '—';
  const p = str.split('-');
  const m = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  return p[2] + ' ' + m[parseInt(p[1])-1] + ' ' + p[0];
}

export function formatDataCurta(str) {
  if (!str) return '—';
  const p = str.split('-');
  return p[2] + '/' + p[1];
}

export function formatDataCurta2(dt) {
  const m = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  return dt.getDate() + ' ' + m[dt.getMonth()];
}
