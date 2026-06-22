import { state, getNextTxId, getNextContaId, recalcAllBalances } from './state.js';
import { showToast, getTodayStr } from './utils.js';
import { saveAccountToDB, deleteAccountFromDB, saveTransactionToDB, deleteTransactionFromDB } from './storage.js';
import { render, populateContaSelect } from './ui.js';
import { MSG } from './constants.js';

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

export function escolherReceita() {
  document.getElementById('f-tipo').value = 'receita';
  document.getElementById('f-tipo-display').value = 'Receita';
  document.getElementById('tipoSelecionadoLabel').innerText = 'Receita';
  document.getElementById('step1-escolha').style.display = 'none';
  document.getElementById('step2-formulario').style.display = 'block';
}

export function escolherDespesa() {
  document.getElementById('f-tipo').value = 'despesa';
  document.getElementById('f-tipo-display').value = 'Despesa';
  document.getElementById('tipoSelecionadoLabel').innerText = 'Despesa';
  document.getElementById('step1-escolha').style.display = 'none';
  document.getElementById('step2-formulario').style.display = 'block';
}

export function voltarStep1() {
  document.getElementById('step2-formulario').style.display = 'none';
  document.getElementById('step1-escolha').style.display = 'block';
}

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

export async function salvarTransacao() {
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
  const today = getTodayStr();
  if (data > today) { showToast(MSG.ERROR_DATA_FUTURA, 'error'); return; }

  const saveBtn = document.getElementById('saveTxBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Salvando...';

  try {
    if (state.editingTxId !== null) {
      const updatedTx = { id: state.editingTxId, tipo, forma, conta: contaId, valor, desc, cat, data, mes: data.slice(0, 7) };
      await saveTransactionToDB(updatedTx);
      const index = state.transacoes.findIndex(t => t.id === state.editingTxId);
      if (index !== -1) state.transacoes[index] = updatedTx;
      showToast(MSG.SUCCESS_SAVE_TX, 'success');
      state.editingTxId = null;
    } else {
      const newTx = { tipo, forma, conta: contaId, valor, desc, cat, data, mes: data.slice(0, 7) };
      const id = await saveTransactionToDB(newTx);
      newTx.id = id;
      state.transacoes.push(newTx);
      showToast(MSG.SUCCESS_SAVE_TX, 'success');
    }
    recalcAllBalances();
    closeModal('modal-tx');
    render();
  } catch (err) {
    showToast(MSG.ERROR_STORAGE, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Salvar';
  }
}

export async function excluirTx(id) {
  if (!confirm(MSG.CONFIRM_DELETE_TX)) return;
  try {
    await deleteTransactionFromDB(id);
    state.transacoes = state.transacoes.filter(t => t.id !== id);
    recalcAllBalances();
    render();
    showToast(MSG.SUCCESS_DELETE_TX, 'info');
  } catch (err) {
    showToast(MSG.ERROR_STORAGE, 'error');
  }
}

export function openContaModal() {
  document.getElementById('c-nome').value = '';
  document.getElementById('c-saldo').value = '';
  document.getElementById('modal-conta').classList.add('open');
}

export async function salvarConta() {
  const nome = document.getElementById('c-nome').value.trim();
  const tipo = document.getElementById('c-tipo').value;
  const saldo = parseFloat(document.getElementById('c-saldo').value) || 0;
  const cor = document.getElementById('c-cor').value;
  if (!nome) { showToast('Nome da conta é obrigatório', 'error'); return; }
  const newConta = { nome, tipo, saldo, cor };
  try {
    const id = await saveAccountToDB(newConta);
    newConta.id = id;
    state.contas.push(newConta);
    recalcAllBalances();
    closeModal('modal-conta');
    render();
    showToast(MSG.SUCCESS_SAVE_CONTA, 'success');
  } catch (err) {
    showToast(MSG.ERROR_STORAGE, 'error');
  }
}

export async function excluirConta(id) {
  if (state.contas.length === 1) {
    showToast(MSG.WARN_LAST_CONTA, 'error');
    return;
  }
  const temTx = state.transacoes.some(t => t.conta === id);
  if (temTx && !confirm(MSG.CONFIRM_DELETE_CONTA_WITH_TX)) return;
  try {
    if (temTx) {
      const outraConta = state.contas.find(c => c.id !== id);
      if (outraConta) {
        for (let tx of state.transacoes.filter(t => t.conta === id)) {
          tx.conta = outraConta.id;
          await saveTransactionToDB(tx);
        }
        state.transacoes.forEach(t => { if (t.conta === id) t.conta = outraConta.id; });
        showToast(MSG.INFO_TRANSFER_TX(outraConta.nome), 'info');
      }
    }
    await deleteAccountFromDB(id);
    state.contas = state.contas.filter(c => c.id !== id);
    recalcAllBalances();
    render();
    showToast(MSG.SUCCESS_DELETE_CONTA, 'info');
  } catch (err) {
    showToast(MSG.ERROR_STORAGE, 'error');
  }
}

// Função auxiliar para fechar modal
export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('open');
}