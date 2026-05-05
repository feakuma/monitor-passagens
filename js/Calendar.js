// ============================================================
//  calendar.js — Calendário de seleção de datas
// ============================================================

import { showToast, formatDataCurta2 } from './config.js';

const MESES = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

let calDate       = new Date();
let calSelected   = null;
let calRangeStep  = 'ida';
let calSelectedIda   = null;
let calSelectedVolta = null;

export function openCal() {
  calDate = new Date(); calSelected = null;
  calRangeStep = 'ida'; calSelectedIda = null; calSelectedVolta = null;
  document.getElementById('cal-step').textContent = 'Selecione a data de ida';
  document.getElementById('cal-range-preview').style.display = 'none';
  document.getElementById('cal-range-preview').textContent = '';
  renderCal();
  document.getElementById('cal-overlay').classList.add('open');
}

export function calNav(dir) {
  calDate = new Date(calDate.getFullYear(), calDate.getMonth() + dir, 1);
  renderCal();
}

export function renderCal() {
  document.getElementById('cal-title').textContent = MESES[calDate.getMonth()] + ' ' + calDate.getFullYear();
  const year  = calDate.getFullYear();
  const month = calDate.getMonth();
  const first = new Date(year, month, 1).getDay();
  const days  = new Date(year, month + 1, 0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);

  let html = ''; let day = 1; let row = 0;
  while (day <= days) {
    html += '<tr>';
    for (let col = 0; col < 7; col++) {
      if (row === 0 && col < first) { html += '<td></td>'; continue; }
      if (day > days) { html += '<td></td>'; continue; }
      const dt = new Date(year, month, day); dt.setHours(0,0,0,0);
      const isPast  = dt < today;
      const isIda   = calSelectedIda   && dt.getTime() === calSelectedIda.getTime();
      const isVolta = calSelectedVolta && dt.getTime() === calSelectedVolta.getTime();
      const isRange = calSelectedIda && calSelectedVolta && dt > calSelectedIda && dt < calSelectedVolta;
      const isToday = dt.getTime() === today.getTime();
      const cls     = 'cal-day' + (isPast ? ' past' : '') + (isToday && !isPast ? ' today' : '') +
                      ((isIda || isVolta) ? ' selected' : '') + (isRange ? ' in-range' : '');
      const onclick = isPast ? '' : ` onclick="window._selectDay(${day})"`;
      html += `<td><div class="${cls}"${onclick}>${day}</div></td>`;
      day++;
    }
    html += '</tr>'; row++;
  }
  document.getElementById('cal-body').innerHTML = html;
}

export function selectDay(d) {
  const dt = new Date(calDate.getFullYear(), calDate.getMonth(), d); dt.setHours(0,0,0,0);
  if (calRangeStep === 'ida') {
    calSelectedIda = dt; calSelectedVolta = null; calRangeStep = 'volta';
    document.getElementById('cal-step').textContent = 'Agora selecione a data de volta (opcional)';
    const preview = document.getElementById('cal-range-preview');
    preview.textContent = 'Ida: ' + formatDataCurta2(dt); preview.style.display = 'block';
  } else {
    if (dt <= calSelectedIda) { showToast('A volta deve ser depois da ida', 'error'); return; }
    calSelectedVolta = dt;
    document.getElementById('cal-range-preview').textContent =
      'Ida: ' + formatDataCurta2(calSelectedIda) + '  →  Volta: ' + formatDataCurta2(dt);
  }
  renderCal();
}

export function confirmCal() {
  if (!calSelectedIda) { showToast('Selecione a data de ida', 'error'); return; }
  const toISO = dt => dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
  document.getElementById('input-ida').value   = toISO(calSelectedIda);
  document.getElementById('input-volta').value = calSelectedVolta ? toISO(calSelectedVolta) : '';
  const el = document.getElementById('display-range');
  el.textContent = calSelectedVolta
    ? (formatDataCurta2(calSelectedIda) + ' → ' + formatDataCurta2(calSelectedVolta))
    : (formatDataCurta2(calSelectedIda) + ' (só ida)');
  el.className = 'field-value';
  document.getElementById('cal-overlay').classList.remove('open');
}
