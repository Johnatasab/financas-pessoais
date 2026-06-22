import { state, ICONE_CONTA, COR_CAT } from './state.js';
import { fmt, escapeHtml, getTodayStr } from './utils.js';

export function renderMonthFilter() {
  const sel = document.getElementById('month-filter');
  if (!sel) return;
  const mesesSet = new Set();
  state.transacoes.forEach(t => mesesSet.add(t.data.slice(0,7)));
  const meses = Array.from(mesesSet).sort().reverse();
  sel.innerHTML = '<option value="">Todos os meses</option>';
  meses.forEach(m => {
    const [ano, mes] = m.split('-');
    const label = new Date(ano, mes-1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    sel.innerHTML += `<option value="${m}">${label.charAt(0).toUpperCase() + label.slice(1)}</option>`;
  });
  sel.value = state.mesFiltro || '';
}

export function renderResumo() {
  const txs = state.transacoes.filter(t => !state.mesFiltro || t.data.startsWith(state.mesFiltro));
  const receitas = txs.filter(t=>t.tipo==='receita').reduce((s,t)=>s+t.valor,0);
  const despesas = txs.filter(t=>t.tipo==='despesa').reduce((s,t)=>s+t.valor,0);
  const saldo = receitas - despesas;
  document.getElementById('sum-receita').innerText = fmt(receitas);
  document.getElementById('sum-despesa').innerText = fmt(despesas);
  const elSaldo = document.getElementById('sum-saldo');
  elSaldo.innerText = (saldo>=0?'+':'−')+fmt(saldo);
  elSaldo.className = 'summary-value ' + (saldo>=0?'pos':'neg');

  document.getElementById('contas-resumo').innerHTML = state.contas.map(c => `
    <div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--borda)">
      <span>${ICONE_CONTA[c.tipo] || '💰'}</span>
      <div style="flex:1"><div>${c.nome}</div><div style="font-size:12px">${c.tipo}</div></div>
      <div style="color:${c.saldo>=0?'var(--verde)':'var(--vermelho)'}">${c.saldo>=0?'':'−'}${fmt(c.saldo)}</div>
    </div>`).join('');

  const recentes = [...state.transacoes].sort((a,b)=>b.data.localeCompare(a.data)).slice(0,4);
  document.getElementById('tx-recent').innerHTML = recentes.length
    ? `<div class="tx-list">${recentes.map(t => htmlTransacao(t, false)).join('')}</div>`
    : '<div class="empty">Nenhuma transação</div>';
}

export function htmlTransacao(t, showActions = true) {
  const conta = state.contas.find(c => c.id === t.conta) || { nome: '?', cor: '#888', tipo: 'dinheiro' };
  const sinal = t.tipo === 'receita' ? '+' : '−';
  const cls = t.tipo === 'receita' ? 'pos' : 'neg';
  return `<div class="tx-item">
    <div class="tx-icon" style="background:${conta.cor}22">${ICONE_CONTA[conta.tipo] || '💰'}</div>
    <div class="tx-info">
      <div class="tx-desc">${escapeHtml(t.desc)}</div>
      <div class="tx-meta">${t.data} · ${conta.nome} · <span class="badge ${t.forma}">${t.forma}</span></div>
    </div>
    <div class="tx-amount ${cls}">${sinal} ${fmt(t.valor)}</div>
    ${showActions ? `<div class="tx-actions"><button class="icon-btn edit-tx" data-id="${t.id}">✏️</button><button class="icon-btn delete-tx" data-id="${t.id}">🗑️</button></div>` : ''}
  </div>`;
}

export function renderTransacoes() {
  const txs = state.transacoes.filter(t => {
    const okMes = !state.mesFiltro || t.data.startsWith(state.mesFiltro);
    const okTipo = state.filtroTipo === 'todos' || t.forma === state.filtroTipo;
    return okMes && okTipo;
  }).sort((a,b)=>b.data.localeCompare(a.data));
  document.getElementById('tx-all').innerHTML = txs.length
    ? `<div class="tx-list">${txs.map(t => htmlTransacao(t, true)).join('')}</div>`
    : '<div class="empty">Nenhuma transação</div>';
  // Reatribuir eventos (serão ligados no app.js via delegação ou após render)
}

export function renderContas() {
  document.getElementById('contas-cards').innerHTML = state.contas.map(c => `
    <div class="conta-card" style="border-left-color:${c.cor}">
      <div class="conta-card-label">${ICONE_CONTA[c.tipo] || '💰'} ${c.nome}</div>
      <div class="conta-card-value" style="color:${c.saldo>=0?'var(--verde)':'var(--vermelho)'}">${c.saldo>=0?'':'−'}${fmt(c.saldo)}</div>
      <div style="font-size:11px">${c.tipo}</div>
    </div>`).join('');
  document.getElementById('contas-list').innerHTML = state.contas.map(c => `
    <div style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--borda)">
      <div style="width:10px;height:10px;border-radius:50%;background:${c.cor}"></div>
      <span style="flex:1">${c.nome} (${c.tipo})</span>
      <span>${c.saldo>=0?'':'−'}${fmt(c.saldo)}</span>
      <button class="btn btn-sm delete-conta" data-id="${c.id}">🗑️</button>
    </div>`).join('');
}

export function renderAnalise() {
  const despesas = state.transacoes.filter(t => t.tipo === 'despesa' && (!state.mesFiltro || t.data.startsWith(state.mesFiltro)));
  const porCat = {};
  despesas.forEach(t => { porCat[t.cat] = (porCat[t.cat]||0) + t.valor; });
  const sorted = Object.entries(porCat).sort((a,b)=>b[1]-a[1]);
  const total = sorted.reduce((s, [,v]) => s + v, 0);
  document.getElementById('cat-detail').innerHTML = sorted.length
    ? sorted.map(([cat,val]) => {
        const pct = total ? Math.round(val/total*100) : 0;
        return `<div style="display:flex;gap:10px;margin-bottom:12px">
                  <div style="width:100px">${cat}</div>
                  <div style="flex:1"><div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${COR_CAT[cat]||'#888'}"></div></div></div>
                  <div>${fmt(val)} (${pct}%)</div>
                </div>`;
      }).join('')
    : '<div class="empty">Sem despesas</div>';
}

export function renderAll() {
  renderMonthFilter();
  renderResumo();
  renderTransacoes();
  renderContas();
  if (document.getElementById('tab-analise').style.display !== 'none') {
    renderAnalise();
  }
  document.getElementById('period-label').innerText = state.mesFiltro ? `Mês: ${state.mesFiltro}` : 'Todos os meses';
}