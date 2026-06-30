// ==== Importação ===
import { state, recalcAllBalances, getNextTxId, getNextContaId } from './state.js';
import { showToast, getTodayStr } from './utils.js';
import { clearAllData, saveAccountToDB, saveTransactionToDB, deleteAccountFromDB, deleteTransactionFromDB, updateTransactionToDB } from './storage.js';
import { renderAll, closeModal } from './ui.js';
import { MSG } from './constants.js';
import { getCurrentUser, supabase } from './supabase.js';

// === Salvar transação ===
export async function salvarTransacao() {
  console.log('💾 salvarTransacao() chamada, editingTxId:', state.editingTxId);

  //Obter usuario logado 
  const user = await getCurrentUser();
  if (!user) {
    showToast('Usuário não autenticado.', 'error');
    return;
  }

  const tipo = document.getElementById('f-tipo').value;
  const forma = document.getElementById('f-forma').value;
  const contaId = parseInt(document.getElementById('f-conta').value);
  const valorRaw = document.getElementById('f-valor').value;
  const desc = document.getElementById('f-desc').value.trim();
  const cat = document.getElementById('f-cat').value;
  const data = document.getElementById('f-data').value;

  console.log('📝 Dados lidos:', { tipo, forma, contaId, valorRaw, desc, cat, data });

  // Converte valor (ex: "1.234,56" -> 1234.56)
  let clean = valorRaw.replace(/[^\d,.-]/g, '');
  if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }
  let valor = parseFloat(clean) || 0;
  

  if (valor <= 0) { showToast(MSG.ERROR_VALOR, 'error'); return; }
  if (!desc) { showToast('Descrição é obrigatória', 'error'); return; }
  if (!data) { showToast(MSG.ERROR_DATA, 'error'); return; }
  const today = getTodayStr();
  if (data > today) { showToast(MSG.ERROR_DATA_FUTURA, 'error'); return; }

  const saveBtn = document.getElementById('saveTxBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Salvando...';

  try {
    console.log('📤 A salvar no banco...');
    if (state.editingTxId !== null) {
      // === EDIÇÃO ===
      console.log('✏️ Editando transação ID:', state.editingTxId);

      const updatedTx = { id: state.editingTxId, user_id: user.id, tipo, forma, conta: contaId, valor, descricao: desc, cat, data, mes: data.slice(0, 7) };

      // Salvar no banco (suponho que updateTransactionToDB existe)
      await saveTransactionToDB(updatedTx);

      // Atualizar no state local
      const index = state.transacoes.findIndex(t => t.id === state.editingTxId);

      if (index !== -1) state.transacoes[index] = updatedTx;
      showToast(MSG.SUCCESS_SAVE_TX, 'success');
      state.editingTxId = null;
    } else {
      // === NOVA TRANSAÇÃO ===
      const newTx = { user_id: user.id, tipo, forma, conta: contaId, valor, descricao: desc, cat, data, mes: data.slice(0, 7) };
      const id = await saveTransactionToDB(newTx);
      newTx.id = id;
      state.transacoes.push(newTx);
      showToast(MSG.SUCCESS_SAVE_TX, 'success');
    }
    recalcAllBalances();
    closeModal('modal-tx');
    renderAll();
  } catch (err) {

    console.error('❌ Erro ao salvar transação:', err);

    showToast(MSG.ERROR_STORAGE, 'error');
  } finally {

    console.log('🔄 Restaurando botão...');

    saveBtn.disabled = false;
    saveBtn.textContent = 'Salvar';
  }
}

// === Excluir ===
export async function excluirTx(id) {
  if (!confirm(MSG.CONFIRM_DELETE_TX)) return;
  try {
    await deleteTransactionFromDB(id);
    state.transacoes = state.transacoes.filter(t => t.id !== id);
    recalcAllBalances();
    renderAll();
    showToast(MSG.SUCCESS_DELETE_TX, 'info');
  } catch (err) {
    showToast(MSG.ERROR_STORAGE, 'error');
  }
}

// === Salvar conta ===
export async function salvarConta() {
  console.log('🔍 salvarConta() chamada');

  const nome = document.getElementById('c-nome').value.trim();
  const tipo = document.getElementById('c-tipo').value;
  const valorRaw = document.getElementById('c-saldo').value.trim(); 
  const cor = document.getElementById('c-cor').value;

  let clean = valorRaw.replace(/[^\d,.-]/g, '');
  if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }
  const saldo = parseFloat(clean) || 0;

  console.log('📦 Dados da conta:', { nome, tipo, saldo, cor });

  if (!nome) { 
    console.warn('⚠️ Nome Vazio');
    showToast('Nome da conta é obrigatório', 'error'); 
    return; 
  }

  //Obter usuário logado
  const user = await getCurrentUser();
  if (!user) {
    showToast('Usuário não autenticado.', 'error');
    console.error('❌ Nehum usuário logado');
    return;
  }
  console.log('👤 Usuário', user.id);

  const newConta = { user_id: user.id, nome, tipo, saldo, cor };
  
  try {
    console.log('💾 Tentando salvar no banco...');
    const id = await saveAccountToDB(newConta);
    console.log('✅ ID recebido:', id);

    newConta.id = id;
    state.contas.push(newConta);

    //recalcAllBalances();

    console.log('🔙 Fechando modal...');
    closeModal('modal-conta');

    console.log('🔄️ Renderizando...');
    renderAll();

    showToast(MSG.SUCCESS_SAVE_CONTA, 'success');
    console.log('✅ Processo concluído');
  } catch (err) {
    console.error('❌ Erro ao salvar conta:', err);
    showToast(MSG.ERROR_STORAGE, 'error');
  }
}

// === Excluir Conta ===
export async function excluirConta(id) {
  // Confirmação geral antes de qualquer ação
  if (!confirm('Tem a certeza que deseja excluir esta conta?')) return;

  if (state.contas.length === 1) {
    showToast('Você deve ter pelo menos uma conta.', 'error');
    return;
  }

  const temTx = state.transacoes.some(t => t.conta === id);
  if (temTx && !confirm('Esta conta possui transações. Excluir e transferir as transações para a primeira conta disponível?')) return;

  try {
    if (temTx) {
      const outraConta = state.contas.find(c => c.id !== id);
      if (outraConta) {
        for (let tx of state.transacoes.filter(t => t.conta === id)) {
          tx.conta = outraConta.id;
          await updateTransactionToDB(tx);
        }
        state.transacoes.forEach(t => { if (t.conta === id) t.conta = outraConta.id; });
        showToast(`✅ Transações transferidas para ${outraConta.nome}`, 'info');
      }
    }

    await deleteAccountFromDB(id);
    state.contas = state.contas.filter(c => c.id !== id);
    recalcAllBalances();
    renderAll();
    showToast('🗑️ Conta removida com sucesso!', 'info');
  } catch (err) {
    console.error('❌ Erro ao excluir conta:', err);
    showToast('Erro ao excluir conta.', 'error');
  }
}

// === Carregar dados do usuário ===
export async function loadUserData(userId) {
  console.log('📥 loadUserData chamada com userId', userId);

  const { data: contas, error: errContas } = await supabase
    .from('contas')
    .select('*')
    .eq('user_id', userId);
  if (errContas) {
    console.error('❌ Erro ao buscar contas:', errContas);
    throw errContas;
  }
  console.log('📊 Contas retornadas:', contas?.length || 0)
  

  const { data: transacoes, error: errTrans } = await supabase
    .from('transacoes')
    .select('*')
    .eq('user_id', userId);
  if (errTrans) {
    console.error('❌ Erro ao buscar transações:', errTrans);
    throw errTrans;
  }
  console.log('📊 Transações retornadas:', transacoes?.length || 0);
  
  state.contas = contas || [];
  state.transacoes = transacoes || [];
  //recalcAllBalances();
  console.log('✅ Estado atualizado:', { contas: state.contas.length, transacoes: state.transacoes.length });
}

// === Exporta dados ===
export function exportData() {
  try {
    //Pega os dados atuais 
    const data = {
      contas: state.contas,
      transacoes: state.transacoes,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financas_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('📦 Dados exportados com sucesso!', 'success');
  } catch (err) {
    console.error('Erro ao exportar:', err);
    showToast('Erro ao exportar dados.', 'error');
  }
}

// === Importar dados ===
export function importData(fileInput) {
  const file = fileInput.files[0];
  if (!file) {
    showToast('Selecione um arquivo.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = async function (e) {
    try {
      const data = JSON.parse(e.target.result);

      //Validação básica
      if (!data.contas || !data.transacoes) {
        throw new Error('Arquivo inválido: faltam "contas" ou "transacoes".');
      }

      if (!confirm(`Deseja importar ${data.contas.length} contas e ${data.transacoes.length} transações? Isso substituirá todos os dados atuais.`)) return;

      //Substituir o estado atual
      state.contas = data.contas;
      state.transacoes = data.transacoes;

      //recalcular saldos
      recalcAllBalances();

      // Salvar no banco
      // Como não temos uma função "saveAll", vamos limpar e reinserir
      // (precisa que storage.js tenha clearAllData e saveAccountToDB/saveTransactionToDB)
      // Usamos as funções existentes
      const { clearAllData } = await import('./storage.js');
      await clearAllData();
      
      // Salvar contas
      for (let conta of state.contas) {
        await saveAccountToDB(conta);
      }
      // Salvar transações
      for (let tx of state.transacoes) {
        await saveTransactionToDB(tx);
      }
      
      recalcAllBalances();
      renderAll();
      showToast(`✅ Importado: ${state.contas.length} contas, ${state.transacoes.length} transações.`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Erro ao importar: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
  // Limpar o input para permitir re-upload
  fileInput.value = '';
}

// === Reset para dados de demonstração ===
export async function resetToDemo() {
  if (!confirm('⚠️ Isso apagará todos os seus dados atuais e carregará dados de exemplo. Continuar?')) return;

  try {
    // Obter utilizador atual
    const user = await getCurrentUser();
    if (!user) {
      showToast('Usuário não autenticado.', 'error');
      return;
    }
    console.log('👤 Reset para demo do usuário:', user.id);

    // 1. Apagar contas e transações existentes
    const { error: errContas } = await supabase
      .from('contas')
      .delete()
      .eq('user_id', user.id);
    if (errContas) throw errContas;

    const { error: errTrans } = await supabase
      .from('transacoes')
      .delete()
      .eq('user_id', user.id);
    if (errTrans) throw errTrans;

    // 2. Inserir contas de exemplo
    const demoContas = [
      { user_id: user.id, nome: 'Conta Corrente', tipo: 'corrente', saldo: 2500, cor: '#378ADD' },
      { user_id: user.id, nome: 'Poupança', tipo: 'poupanca', saldo: 8000, cor: '#1D9E75' },
      { user_id: user.id, nome: 'Cartão Crédito', tipo: 'cartao', saldo: -450, cor: '#D4537E' }
    ];

    const contasIds = [];
    for (const conta of demoContas) {
      const { data, error } = await supabase
        .from('contas')
        .insert([conta])
        .select();
      if (error) throw error;
      contasIds.push(data[0].id);
    }

    // 3. Inserir transações de exemplo
    const demoTransacoes = [
      { user_id: user.id, tipo: 'despesa', forma: 'debito', conta: contasIds[0], valor: 120, descricao: 'Supermercado', cat: 'Alimentação', data: getTodayStr(), mes: getTodayStr().slice(0,7) },
      { user_id: user.id, tipo: 'receita', forma: 'transferencia', conta: contasIds[0], valor: 3200, descricao: 'Salário', cat: 'Salário', data: getTodayStr(), mes: getTodayStr().slice(0,7) },
      { user_id: user.id, tipo: 'despesa', forma: 'credito', conta: contasIds[2], valor: 89.9, descricao: 'Netflix', cat: 'Lazer', data: getTodayStr(), mes: getTodayStr().slice(0,7) },
      { user_id: user.id, tipo: 'despesa', forma: 'pix', conta: contasIds[0], valor: 200, descricao: 'Conta de luz', cat: 'Moradia', data: getTodayStr(), mes: getTodayStr().slice(0,7) }
    ];

    for (const tx of demoTransacoes) {
      const { error } = await supabase
        .from('transacoes')
        .insert([tx]);
      if (error) throw error;
    }

    // 4. Recarregar dados para o state
    await loadUserData(user.id);
    recalcAllBalances();
    renderAll();
    showToast('🔄 Dados de demonstração carregados!', 'success');
    console.log('✅ Demo carregado com sucesso');

  } catch (err) {
    console.error('❌ Erro ao carregar demo:', err);
    showToast('Erro ao carregar dados demo: ' + err.message, 'error');
  }
}