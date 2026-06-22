// js/cloud.js
import { state } from './state.js';
import { showToast } from './utils.js';
import { saveAllToDB } from './storage.js';
import { renderAll } from './ui.js';
import { updateChart } from './charts.js';

const CLOUD_URL = 'https://script.google.com/macros/s/AKfycbx46T5VpBYIDlXBt1FCrunbw5zdcBr0UcthdQpBs7_2l639IzhfLxT3ZYUA2bZXiOReKg/exec'; // Use a URL atualizada

export async function syncToCloud() {
  showToast('Enviando dados para a nuvem...', 'info');
  try {
    const formData = new URLSearchParams();
    formData.append('action', 'sync');
    formData.append('data', JSON.stringify({ contas: state.contas, transacoes: state.transacoes }));
    
    const response = await fetch(CLOUD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    });
    const result = await response.json();
    if (result.success) {
      showToast('✅ Dados sincronizados com a nuvem!', 'success');
    } else {
      throw new Error(result.error || 'Erro desconhecido');
    }
  } catch (err) {
    console.error(err);
    showToast('❌ Falha na sincronização. Verifique sua conexão.', 'error');
  }
}

export async function syncFromCloud() {
  showToast('Baixando dados da nuvem...', 'info');
  try {
    const response = await fetch(CLOUD_URL);
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    
    state.contas = data.contas || [];
    state.transacoes = data.transacoes || [];
    await saveAllToDB(state.contas, state.transacoes);
    
    const { recalcAllBalances } = await import('./state.js');
    recalcAllBalances();
    renderAll();
    updateChart();
    
    showToast(`✅ Dados carregados: ${state.contas.length} contas, ${state.transacoes.length} transações.`, 'success');
  } catch (err) {
    console.error(err);
    showToast('❌ Não foi possível buscar dados da nuvem.', 'error');
  }
}