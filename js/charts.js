import { state, COR_CAT } from './state.js';
import { fmt } from './utils.js';

let chart = null;

export function updateChart() {
  const despesas = state.transacoes.filter(t => t.tipo === 'despesa' && (!state.mesFiltro || t.data.startsWith(state.mesFiltro)));
  const porCat = {};
  despesas.forEach(t => { porCat[t.cat] = (porCat[t.cat]||0) + t.valor; });
  const sorted = Object.entries(porCat).sort((a,b)=>b[1]-a[1]);
  const ctx = document.getElementById('catChart');
  if (!ctx) return;
  if (!sorted.length) {
    if (chart) { chart.destroy(); chart = null; }
    return;
  }
  const labels = sorted.map(e=>e[0]);
  const data = sorted.map(e=>e[1]);
  const colors = sorted.map(e=>COR_CAT[e[0]]||'#888');
  if (chart) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.data.datasets[0].backgroundColor = colors;
    chart.update();
  } else {
    chart = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.raw)}` } } } }
    });
  }
}