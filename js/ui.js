// === Importação ===
import { state, ICONE_CONTA, COR_CAT } from './state.js';
import { fmt, showToast, getTodayStr, fmtEuro, escapeHtml, debounce } from './utils.js';
import { MSG } from './constants.js'
import { updateChart } from './charts.js';
import { excluirConta, excluirTx } from './crud.js';

// === Função de filtro ===
export function txDoMes() {
  return state.transacoes.filter(t => !state.mesFiltro || t.data.startsWith(state.mesFiltro));
}

export function txFiltradas() {
  return state.transacoes.filter(t => {
    const okMes = !state.mesFiltro || t.data.startsWith(state.mesFiltro);
    const okTipo = state.filtroTipo === 'todos' || t.forma === state.filtroTipo;
    return okMes && okTipo;
  });
}

// === Preenche <select>
export function populateContaSelect(selectedId = null) {
  const sel = document.getElementById('f-conta');
  if (!sel) return;
  sel.innerHTML = state.contas.map(c => 
    `<option value="${c.id}" ${selectedId === c.id ? 'selected' : ''}>${c.nome}</option>`
  ).join('');
}

// === Fechar Modal ===
export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('open')
} 

// === Abre modal, preenche campos ===
export function openAddTransactionModal() {
  state.editingTxId = null;
  document.getElementById('step1-escolha').style.display = 'block';
  document.getElementById('step2-formulario').style.display = 'none';
  document.getElementById('f-valor').value = '';
  document.getElementById('f-desc').value = '';
  document.getElementById('f-data').value = getTodayStr();
  populateContaSelect();
  document.getElementById('modal-tx').classList.add('open');
}

// === Abre modal de conta ===
export function openContaModal() {
  document.getElementById('c-nome').value = '';
  document.getElementById('c-saldo').value = '';
  document.getElementById('modal-conta').classList.add('open');
}

// === Receita ===
export function escolherReceita() {
  document.getElementById('f-tipo').value = 'receita';
  document.getElementById('f-tipo-display').value = 'Receita';
  document.getElementById('tipoSelecionadoLabel').innerText = 'Receita';
  document.getElementById('step1-escolha').style.display = 'none';
  document.getElementById('step2-formulario').style.display = 'block';
}

// === Despesas ===
export function escolherDespesa() {
  document.getElementById('f-tipo').value = 'despesa';
  document.getElementById('f-tipo-display').value = 'Despesa';
  document.getElementById('tipoSelecionadoLabel').innerText = 'Despesa';
  document.getElementById('step1-escolha').style.display = 'none';
  document.getElementById('step2-formulario').style.display = 'block';
}

// === Voltar Step 1 ===
export function voltarStep1() {
  document.getElementById('step2-formulario').style.display = 'none';
  document.getElementById('step1-escolha').style.display = 'block';
}

// === Editar  ===
export function editTransaction(id) {
  const tx = state.transacoes.find(t => t.id === id);
  if (!tx) return;
  state.editingTxId = id;
  document.getElementById('modalTitle').innerText = 'Editar transação';
  document.getElementById('f-tipo').value = tx.tipo;
  document.getElementById('f-tipo-display').value = tx.tipo === 'receita' ? 'Receita' : 'Despesa';
  document.getElementById('tipoSelecionadoLabel').innerText = tx.tipo === 'receita' ? 'Receita' : 'Despesa';
  document.getElementById('f-forma').value = tx.forma;
  document.getElementById('f-valor').value = `R$ ${tx.valor.toFixed(2).replace('.', ',')}`;
  document.getElementById('f-desc').value = tx.desc;
  document.getElementById('f-cat').value = tx.cat;
  document.getElementById('f-data').value = tx.data;
  populateContaSelect(tx.conta);
  document.getElementById('step1-escolha').style.display = 'none';
  document.getElementById('step2-formulario').style.display = 'block';
  document.getElementById('modal-tx').classList.add('open');
}

// === Renderizar filtro mãe
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

// === Renderizar resumo ===
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
      <div class="tx-desc">${escapeHtml(t.descricao || t.desc || '')}</div>
      <div class="tx-meta">${t.data} · ${conta.nome} · <span class="badge ${t.forma}">${t.forma}</span></div>
    </div>
    <div class="tx-amount ${cls}">${sinal} ${fmt(t.valor)}</div>
    ${showActions ? `<div class="tx-actions"><button class="icon-btn edit-tx" data-id="${t.id}">✏️</button><button class="icon-btn delete-tx" data-id="${t.id}">🗑️</button></div>` : ''}
  </div>`;
}

// === Renderizar transação ===
export function renderTransacoes() {
  const txs = txFiltradas().sort((a, b) => b.data.localeCompare(a.data));
  document.getElementById('tx-all').innerHTML = txs.length
    ? `<div class="tx-list">${txs.map(t => htmlTransacao(t, true)).join('')}</div>`
    : '<div class="empty">Nenhuma transação</div>';

  // Botões de editar (se a função estiver no ui.js, usa localmente)
  document.querySelectorAll('.edit-tx').forEach(btn => {
    btn.onclick = () => {
      console.log('✏️ Editar TX ID:', btn.dataset.id);
      editTransaction(parseInt(btn.dataset.id));
    };
  });

  // Botões de excluir (usa excluirTx importado)
  document.querySelectorAll('.delete-tx').forEach(btn => {
    btn.onclick = () => {
      console.log('🗑️ Excluir TX ID:', btn.dataset.id);
      excluirTx(parseInt(btn.dataset.id));
    };
  });
}

// === Renderizar Contas ===
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

  document.querySelectorAll('.delete-conta').forEach(btn => {
    btn.onclick = () => {
      const id = parseInt(btn.dataset.id);
      console.log('🚮 Clicou em excluir conta ID:', id);
      excluirConta(id);
    };
  });
}

// === Renderizar tudo ===
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

export function switchTab(tabName, btn) {
  const tabs = ['resumo', 'transacoes', 'contas', 'analise', 'combustivel', 'compras'];
  tabs.forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    if (el) el.style.display = (t === tabName) ? '' : 'none';
  });
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (tabName === 'analise') {
    renderAnalise();
    updateChart();
  }
}

export function setFiltro(tipo, btn) {
  state.filtroTipo = tipo;
  document.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTransacoes();
}

// === Renderizar analise ===
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