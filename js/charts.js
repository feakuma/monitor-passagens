// ============================================================
//  charts.js — Renderização dos gráficos de histórico de preços
// ============================================================

export function renderGraficos(alertasData) {
  alertasData.forEach(function (a) {
    if (!a.historico || a.historico.length <= 1) return;
    var canvas = document.getElementById('chart-' + a.id);
    if (!canvas) return;

    // Filtra últimos 15 dias
    var quinzeDiasAtras = new Date();
    quinzeDiasAtras.setDate(quinzeDiasAtras.getDate() - 15);
    var hist = a.historico.filter(function (h) { return new Date(h.data) >= quinzeDiasAtras; });
    if (hist.length <= 1) hist = a.historico;

    var labels = hist.map(function (h) {
      var d = new Date(h.data);
      return d.getDate() + '/' + (d.getMonth() + 1) + ' ' + d.getHours().toString().padStart(2, '0') + 'h';
    });
    var precos   = hist.map(function (h) { return h.preco; });
    var minPreco = Math.min.apply(null, precos);
    var maxPreco = Math.max.apply(null, precos);
    var temQueda = precos[precos.length - 1] < precos[0];

    if (canvas._chartInstance) canvas._chartInstance.destroy();

    canvas._chartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          data: precos,
          borderColor:     temQueda ? '#5A9E6F' : '#9E5A5A',
          backgroundColor: temQueda ? 'rgba(90,158,111,0.08)' : 'rgba(158,90,90,0.08)',
          borderWidth: 1.5,
          pointRadius:      hist.length <= 6 ? 3 : 0,
          pointHoverRadius: 4,
          tension: 0.3,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) { return 'R$ ' + ctx.parsed.y.toFixed(2); }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#444', font: { size: 9 }, maxTicksLimit: 5 },
            grid:  { color: '#1C1C1C' }
          },
          y: {
            ticks: {
              color: '#444',
              font:  { size: 9 },
              callback: function (v) { return 'R$' + v.toFixed(0); }
            },
            grid: { color: '#1C1C1C' },
            suggestedMin: minPreco * 0.98,
            suggestedMax: maxPreco * 1.02
          }
        }
      }
    });
  });
}
