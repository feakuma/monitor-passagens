// ============================================================
//  charts.js — Gráficos de histórico de preços
// ============================================================

export function renderGraficos(alertasData) {
  alertasData.forEach(a => {
    if (!a.historico || a.historico.length <= 1) return;
    const canvas = document.getElementById('chart-' + a.id);
    if (!canvas) return;

    const quinzeDiasAtras = new Date();
    quinzeDiasAtras.setDate(quinzeDiasAtras.getDate() - 15);
    let hist = a.historico.filter(h => new Date(h.data) >= quinzeDiasAtras);
    if (hist.length <= 1) hist = a.historico;

    const labels  = hist.map(h => {
      const d = new Date(h.data);
      return d.getDate() + '/' + (d.getMonth()+1) + ' ' + d.getHours().toString().padStart(2,'0') + 'h';
    });
    const precos   = hist.map(h => h.preco);
    const minPreco = Math.min(...precos);
    const maxPreco = Math.max(...precos);
    const temQueda = precos[precos.length-1] < precos[0];

    if (canvas._chartInstance) canvas._chartInstance.destroy();

    canvas._chartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: precos,
          borderColor:     temQueda ? '#5A9E6F' : '#9E5A5A',
          backgroundColor: temQueda ? 'rgba(90,158,111,0.08)' : 'rgba(158,90,90,0.08)',
          borderWidth: 1.5,
          pointRadius:      hist.length <= 6 ? 3 : 0,
          pointHoverRadius: 4,
          tension: 0.3,
          fill: true,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => 'R$ ' + ctx.parsed.y.toFixed(2) } }
        },
        scales: {
          x: { ticks: { color: '#444', font: { size: 9 }, maxTicksLimit: 5 }, grid: { color: '#1C1C1C' } },
          y: {
            ticks: { color: '#444', font: { size: 9 }, callback: v => 'R$' + v.toFixed(0) },
            grid: { color: '#1C1C1C' },
            suggestedMin: minPreco * 0.98,
            suggestedMax: maxPreco * 1.02,
          }
        }
      }
    });
  });
}
