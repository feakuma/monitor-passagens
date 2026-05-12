// ============================================================
//  calendar.js — Calendário de seleção de datas (range ida/volta)
// ============================================================

import { showToast, formatDataCurta2 } from './config.js';

const MESES = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

var calDate        = new Date();
var calRangeStep   = 'ida';
var calSelectedIda   = null;
var calSelectedVolta = null;

export function openCal() {
  calDate = new Date();
  calRangeStep = 'ida';
  calSelectedIda = null;
  calSelectedVolta = null;
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

function renderCal() {
  document.getElementById('cal-title').textContent = MESES[calDate.getMonth()] + ' ' + calDate.getFullYear();
  var year  = calDate.getFullYear();
  var month = calDate.getMonth();
  var first = new Date(year, month, 1).getDay();
  var days  = new Date(year, month + 1, 0).getDate();
  var today = new Date(); today.setHours(0, 0, 0, 0);

  var html = ''; var day = 1; var row = 0;
  while (day <= days) {
    html += '<tr>';
    for (var col = 0; col < 7; col++) {
      if (row === 0 && col < first) { html += '<td></td>'; continue; }
      if (day > days) { html += '<td></td>'; continue; }
      var dt = new Date(year, month, day); dt.setHours(0, 0, 0, 0);
      var isPast  = dt < today;
      var isIda   = calSelectedIda   && dt.getTime() === calSelectedIda.getTime();
      var isVolta = calSelectedVolta && dt.getTime() === calSelectedVolta.getTime();
      var isRange = calSelectedIda && calSelectedVolta && dt > calSelectedIda && dt < calSelectedVolta;
      var isToday = dt.getTime() === today.getTime();
      var cls = 'cal-day' +
        (isPast ? ' past' : '') +
        (isToday && !isPast ? ' today' : '') +
        ((isIda || isVolta) ? ' selected' : '') +
        (isRange ? ' in-range' : '');
      var onclick = isPast ? '' : ' onclick="selectDay(' + day + ')"';
      html += '<td><div class="' + cls + '"' + onclick + '>' + day + '</div></td>';
      day++;
    }
    html += '</tr>'; row++;
  }
  document.getElementById('cal-body').innerHTML = html;
}

export function selectDay(d) {
  var dt = new Date(calDate.getFullYear(), calDate.getMonth(), d);
  dt.setHours(0, 0, 0, 0);

  if (calRangeStep === 'ida') {
    calSelectedIda = dt; calSelectedVolta = null; calRangeStep = 'volta';
    document.getElementById('cal-step').textContent = 'Agora selecione a data de volta (opcional)';
    var preview = document.getElementById('cal-range-preview');
    preview.textContent = 'Ida: ' + formatDataCurta2(dt);
    preview.style.display = 'block';
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
  var toISO = function (dt) {
    return dt.getFullYear() + '-' +
      String(dt.getMonth() + 1).padStart(2, '0') + '-' +
      String(dt.getDate()).padStart(2, '0');
  };
  document.getElementById('input-ida').value   = toISO(calSelectedIda);
  document.getElementById('input-volta').value = calSelectedVolta ? toISO(calSelectedVolta) : '';
  var el = document.getElementById('display-range');
  el.textContent = calSelectedVolta
    ? (formatDataCurta2(calSelectedIda) + ' → ' + formatDataCurta2(calSelectedVolta))
    : (formatDataCurta2(calSelectedIda) + ' (só ida)');
  el.className = 'field-value';
  document.getElementById('cal-overlay').classList.remove('open');
}
