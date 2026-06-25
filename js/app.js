import { state, setRenderCallback, updateState, recalcAllBalances } from './state.js';
import { showToast, debounce, getTodayStr, MSG } from './utils.js';
import { openDatabase, saveAccountToDB, updateAccountInDB, deleteAccountFromDB, saveTransactionToDB, updateTransactionInDB, deleteTransactionFromDB, clearAllData } from './storage.js';
import { renderAll, renderTransacoes, renderAnalise, renderContas, renderResumo } from './ui.js';
import { updateChart } from './charts.js';
import { syncToCloud, syncFromCloud } from './cloud.js';
import { initCombustivel } from './modules/combustivel.js';
import { initCompras } from './modules/compras.js';

// Registrar callback de renderização
setRenderCallback(() => {
  renderAll();
  updateChart();
});

// ----- Funções auxiliares de UI -----
function populateContaSelect(selectedId = null) {
  const sel = document.getElementById('f-conta');
  if (!sel) return;
  sel.innerHTML = state.contas.map(c => `<option value="${c.id}" ${selectedId === c.id ? 'selected' : ''}>${c.nome}</option>`).join('');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('open');
}

// ----- CRUD Transações -----
async function salvarTransacao() {
  const tipo = document.getElementById('f-tipo').value;
  const forma = document.getElementById('f-forma').value;
  const contaId = parseInt(document.getElementById('f-conta').value);
  const valorRaw = document.getElementById('f-valor').value;
  const desc = document.getElementById('f-desc').value.trim();
  const cat = document.getElementById('f-cat').value;
  const data = document.getElementById('f-data').value;
  let valor = parseFloat(valorRaw.replace(/[^\d,-]/g, '').replace(',', '.')) || 0;
  if (valor <= 0) { showToast(MSG.ERROR_VALOR, 'error'); return; }
  if (!desc) { showToast(MSG.ERROR_DESC, 'error'); return; }
  if (!data) { showToast(MSG.ERROR_DATA, 'error'); return; }
  if (data > getTodayStr()) { showToast(MSG.ERROR_DATA_FUTURE, 'error'); return; }

  const saveBtn = document.getElementById('saveTxBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Salvando...';
  try {
    if (state.editingTxId) {
      await updateTransactionInDB({ id: state.editingTxId, tipo, forma, conta: contaId, valor, desc, cat, data, mes: data.slice(0,7) });
      const index = state.transacoes.findIndex(t => t.id === state.editingTxId);
      if (index !== -1) state.transacoes[index] = { ...state.transacoes[index], tipo, forma, conta: contaId, valor, desc, cat, data };
      showToast('Transação editada', 'success');
      state.editingTxId = null;
    } else {
      const newId = await saveTransactionToDB({ tipo, forma, conta: contaId, valor, desc, cat, data, mes: data.slice(0,7) });
      state.transacoes.push({ id: newId, tipo, forma, conta: contaId, valor, desc, cat, data, mes: data.slice(0,7) });
      showToast('Transação adicionada', 'success');
    }
    recalcAllBalances();
    closeModal('modal-tx');
  } catch (err) { showToast('Erro ao salvar', 'error'); }
  finally { saveBtn.disabled = false; saveBtn.textContent = 'Salvar'; }
}

async function excluirTx(id) {
  if (!confirm(MSG.CONFIRM_DELETE_TX)) return;
  try {
    await deleteTransactionFromDB(id);
    state.transacoes = state.transacoes.filter(t => t.id !== id);
    recalcAllBalances();
    showToast('Transação removida', 'info');
  } catch (err) { showToast('Erro ao excluir', 'error'); }
}

function editTransaction(id) {
  const tx = state.transacoes.find(t => t.id === id);
  if (!tx) return;
  state.editingTxId = id;
  document.getElementById('modalTitle').innerText = 'Editar transação';
  document.getElementById('f-tipo').value = tx.tipo;
  document.getElementById('f-tipo-display').value = tx.tipo === 'receita' ? 'Receita' : 'Despesa';
  document.getElementById('tipoSelecionadoLabel').innerText = tx.tipo === 'receita' ? 'Receita' : 'Despesa';
  document.getElementById('f-forma').value = tx.forma;
  document.getElementById('f-valor').value = fmt(tx.valor).replace('R$ ', '');
  document.getElementById('f-desc').value = tx.desc;
  document.getElementById('f-cat').value = tx.cat;
  document.getElementById('f-data').value = tx.data;
  populateContaSelect(tx.conta);
  document.getElementById('step1-escolha').style.display = 'none';
  document.getElementById('step2-formulario').style.display = 'block';
  document.getElementById('modal-tx').classList.add('open');
}

function openAddTransactionModal() {
  state.editingTxId = null;
  document.getElementById('step1-escolha').style.display = 'block';
  document.getElementById('step2-formulario').style.display = 'none';
  document.getElementById('f-valor').value = '';
  document.getElementById('f-desc').value = '';
  document.getElementById('f-data').value = getTodayStr();
  populateContaSelect();
  document.getElementById('modal-tx').classList.add('open');
}

function escolherReceita() {
  document.getElementById('f-tipo').value = 'receita';
  document.getElementById('f-tipo-display').value = 'Receita';
  document.getElementById('tipoSelecionadoLabel').innerText = 'Receita';
  document.getElementById('step1-escolha').style.display = 'none';
  document.getElementById('step2-formulario').style.display = 'block';
}

function escolherDespesa() {
  document.getElementById('f-tipo').value = 'despesa';
  document.getElementById('f-tipo-display').value = 'Despesa';
  document.getElementById('tipoSelecionadoLabel').innerText = 'Despesa';
  document.getElementById('step1-escolha').style.display = 'none';
  document.getElementById('step2-formulario').style.display = 'block';
}

function voltarStep1() {
  document.getElementById('step2-formulario').style.display = 'none';
  document.getElementById('step1-escolha').style.display = 'block';
}

// ----- CRUD Contas -----
async function salvarConta() {
  const nome = document.getElementById('c-nome').value.trim();
  const tipo = document.getElementById('c-tipo').value;
  const saldo = parseFloat(document.getElementById('c-saldo').value) || 0;
  const cor = document.getElementById('c-cor').value;
  if (!nome) { showToast('Nome da conta é obrigatório', 'error'); return; }
  try {
    const id = await saveAccountToDB({ nome, tipo, saldo, cor });
    state.contas.push({ id, nome, tipo, saldo, cor });
    recalcAllBalances();
    closeModal('modal-conta');
    showToast('Conta criada', 'success');
  } catch (err) { showToast('Erro ao criar conta', 'error'); }
}

async function excluirConta(id) {
  if (state.contas.length === 1) {
    showToast('Você deve ter pelo menos uma conta.', 'error');
    return;
  }
  const temTx = state.transacoes.some(t => t.conta === id);
  if (temTx && !confirm(MSG.CONFIRM_DELETE_ACCOUNT)) return;
  try {
    if (temTx) {
      const outraConta = state.contas.find(c => c.id !== id);
      if (outraConta) {
        for (let tx of state.transacoes.filter(t => t.conta === id)) {
          tx.conta = outraConta.id;
          await updateTransactionInDB(tx);
        }
        state.transacoes.forEach(t => { if (t.conta === id) t.conta = outraConta.id; });
      }
    }
    await deleteAccountFromDB(id);
    state.contas = state.contas.filter(c => c.id !== id);
    recalcAllBalances();
    showToast('Conta removida', 'info');
  } catch (err) { showToast('Erro ao excluir conta', 'error'); }
}

function openContaModal() {
  document.getElementById('c-nome').value = '';
  document.getElementById('c-saldo').value = '';
  document.getElementById('modal-conta').classList.add('open');
}

// ----- Export / Import / Reset -----
async function exportData() {
  const dataStr = JSON.stringify({ contas: state.contas, transacoes: state.transacoes }, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `financas_${new Date().toISOString().slice(0,19)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Backup exportado', 'success');
}

async function importData(fileInput) {
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.contas || !data.transacoes) throw new Error();
      await clearAllData();
      for (let conta of data.contas) await saveAccountToDB(conta);
      for (let tx of data.transacoes) await saveTransactionToDB(tx);
      // Recarregar tudo
      state.contas = data.contas;
      state.transacoes = data.transacoes;
      recalcAllBalances();
      renderAll();
      updateChart();
      showToast('Importação concluída', 'success');
    } catch (err) { showToast('Arquivo inválido', 'error'); }
  };
  reader.readAsText(file);
  fileInput.value = '';
}

async function resetToDemo() {
  if (!confirm(MSG.CONFIRM_RESET)) return;
  await clearAllData();
  state.contas = [];
  state.transacoes = [];
  recalcAllBalances();
  renderAll();
  updateChart();
  showToast('Dados zerados. Crie uma conta para começar.', 'info');
}

// ----- Filtros e abas -----
function setFiltro(tipo, btn) {
  state.filtroTipo = tipo;
  document.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTransacoes();
}

function switchTab(tabName, btn) {
  const tabs = ['resumo', 'transacoes', 'contas', 'analise', 'combustivel', 'compras'];
  tabs.forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    if (el) el.style.display = (t === tabName) ? '' : 'none';
  });
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (tabName === 'analise') {
    renderAnalise();
    updateChart();
  }
}

// Alterna o tema escuro/claro
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    document.getElementById('themeToggle').textContent = '😎';
  } else {
    document.body.classList.remove('dark-mode');
    document.getElementById('themeToggle').textContent = '🌚';
  }
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-mode');
  const btn = document.getElementById('themeToggle');
  if (isDark) {
    btn.textContent = '😎';
    localStorage.setItem('theme', 'dark');
  } else {
    btn.textContent = '🌚';
    localStorage.setItem('theme', 'light');
  }
}

// ----- Inicialização e eventos -----
function init() {
  openDatabase();

  // Eventos principais
  document.getElementById('newTransactionBtn').onclick = openAddTransactionModal;
  document.getElementById('newContaBtn').onclick = openContaModal;
  document.getElementById('saveTxBtn').onclick = salvarTransacao;
  document.getElementById('saveContaBtn').onclick = salvarConta;
  document.getElementById('closeModalBtn').onclick = () => closeModal('modal-tx');
  document.getElementById('closeContaModalBtn').onclick = () => closeModal('modal-conta');
  document.getElementById('exportBtn').onclick = exportData;
  document.getElementById('importBtn').onclick = () => document.getElementById('importFile').click();
  document.getElementById('importFile').onchange = (e) => importData(e.target);
  document.getElementById('resetDemoBtn').onclick = resetToDemo;
  document.getElementById('syncToCloudBtn').onclick = syncToCloud;
  document.getElementById('syncFromCloudBtn').onclick = syncFromCloud;

  // Etapas do modal
  document.getElementById('escolherReceita').onclick = escolherReceita;
  document.getElementById('escolherDespesa').onclick = escolherDespesa;
  document.getElementById('voltarStep1Btn').onclick = voltarStep1;

  // Filtro de mês com debounce
  const monthFilter = document.getElementById('month-filter');
  const handleMonthChange = debounce((e) => {
    state.mesFiltro = e.target.value;
    renderAll();
    updateChart();
  }, 300);
  monthFilter.addEventListener('change', handleMonthChange);

  //
  initCombustivel();
  initCompras();

  // Abas
  document.querySelectorAll('.tab').forEach(tab => {
    tab.onclick = () => switchTab(tab.dataset.tab, tab);
  });

  // Chips de filtro
  document.querySelectorAll('.chip').forEach(chip => {
    chip.onclick = () => setFiltro(chip.dataset.filter, chip);
  });

  // Delegação de eventos para editar/excluir transações (já que são dinâmicos)
  document.getElementById('tx-all').addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-tx');
    if (editBtn) editTransaction(parseInt(editBtn.dataset.id));
    const delBtn = e.target.closest('.delete-tx');
    if (delBtn) excluirTx(parseInt(delBtn.dataset.id));
  });

  document.getElementById('contas-list').addEventListener('click', (e) => {
    const delBtn = e.target.closest('.delete-conta');
    if (delBtn) excluirConta(parseInt(delBtn.dataset.id));
  });

  // Fechar modais ao clicar no overlay
  document.getElementById('modal-tx').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-tx')) closeModal('modal-tx');
  });
  document.getElementById('modal-conta').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-conta')) closeModal('modal-conta');
  });
}

initTheme();
document.getElementById('themeToggle').onclick = toggleTheme;

window.addEventListener('DOMContentLoaded', init);