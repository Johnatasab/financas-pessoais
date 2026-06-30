import { state, updateState, recalcAllBalances } from './state.js';
import { showToast } from './utils.js';
import { getNextContaId, getNextTxId } from './state.js';
import { supabase, getCurrentUser } from './supabase.js';

let db = null;
let dbReady = false;
let pending = [];

function ensureDB(cb) {
  if (dbReady && db) cb(db);
  else pending.push(cb);
}

export function openDatabase() {
  const request = indexedDB.open('FinancasDB', 1);
  request.onerror = () => showToast('Erro ao abrir banco de dados', 'error');
  request.onsuccess = (e) => {
    db = e.target.result;
    dbReady = true;
    pending.forEach(cb => cb(db));
    pending = [];
    loadAllData();
  };
  request.onupgradeneeded = (e) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains('contas')) {
      const store = db.createObjectStore('contas', { keyPath: 'id', autoIncrement: true });
      store.createIndex('nome', 'nome');
    }
    if (!db.objectStoreNames.contains('transacoes')) {
      const store = db.createObjectStore('transacoes', { keyPath: 'id', autoIncrement: true });
      store.createIndex('data', 'data');
      store.createIndex('contaId', 'conta');
      store.createIndex('mes', 'mes');
    }
  };
}

function loadAllData() {
  ensureDB(() => {
    const txContas = db.transaction('contas', 'readonly').objectStore('contas').getAll();
    txContas.onsuccess = () => {
      const contas = txContas.result || [];
      const txTrans = db.transaction('transacoes', 'readonly').objectStore('transacoes').getAll();
      txTrans.onsuccess = () => {
        let transacoes = txTrans.result || [];
        // Migração: adicionar campo 'mes'
        let needUpdate = false;
        transacoes.forEach(t => {
          if (!t.mes && t.data) {
            t.mes = t.data.slice(0,7);
            needUpdate = true;
          }
        });
        updateState({ contas, transacoes });
        if (needUpdate) {
          transacoes.forEach(t => saveTransactionToDB(t));
        }
        recalcAllBalances();
      };
    };
  });
}

export async function saveAccountToDB(conta) {
  const { data, error } = await supabase
    .from('contas')
    .insert([conta])
    .select();
  if (error) {
    console.error('❌ Erro do supabase:', error);
    throw error;
  }
  return data[0].id;
}

export function updateAccountInDB(conta) {
  return new Promise((resolve, reject) => {
    ensureDB(() => {
      const req = db.transaction('contas', 'readwrite').objectStore('contas').put(conta);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

export async function deleteAccountFromDB(id) {
  const { error } = await supabase
    .from('contas')
    .delete()
    .eq('id', id);
  if (error) {
    console.error('❌ Erro ao apagar conta:', error);
    throw error;
  }
  console.log('✅ Conta apagada do supabase.');
}

export async function saveTransactionToDB(tx) {
  console.log('📊 saveTansactionToDB chamada com:', tx);
  try {
    const { data, error } = await supabase
      .from('transacoes')
      .insert([tx])
      .select();
    if (error) {
      console.error('❌ Erro Supabase:', error);
      throw error;
    }
    console.log('✅ Dados recebidos do supabase:', data);
    return data[0]?.id || data[0];
  } catch (err) {
    console.error('❌ Exceção em saveTransactionToDB:', err);
    throw err;
  }
}

export async function updateTransactionToDB(tx) {
  console.log('📤 updateTransactionToDB chamada com:', tx);
  try {
    const { data, error } = await supabase
      .from('transacoes')
      .update(tx)
      .eq('id', tx.id)
      .select();
    if (error) {
      console.error('❌ Erro Supabase ao atualizar:', error);
      throw error;
    }
    console.log('✅ Transação atualizada no Supabase:', data);
    return data[0];
  } catch (err) {
    console.error('❌ Exceção em updateTransactionToDB:', err);
    throw err;
  }
}

export async function deleteTransactionFromDB(id) {
  console.log('📤 deleteTransactionFromDB chamada com ID:', id);
  const { error } = await supabase
    .from('transacoes')
    .delete()
    .eq('id', id);
  if (error) {
    console.error('❌ Erro Supabase ao excluir:', error);
    throw error;
  }
  console.log('✅ Transação excluída com sucesso.');
}

// Substitui todos os dados do banco por novos arrays
export async function saveAllToDB(contas, transacoes) {
  await clearAllData();
  for (let conta of contas) {
    await saveAccountToDB(conta);
  }
  for (let tx of transacoes) {
    await saveTransactionToDB(tx);
  }
}

// Limpa todas as tabelas
export async function clearAllData() {
  // Se usar Supabase:
  const user = await getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado.');
  const { error } = await supabase
    .from('contas')
    .delete()
    .eq('user_id', user.id);
  if (error) throw error;
  const { error: txError } = await supabase
    .from('transacoes')
    .delete()
    .eq('user_id', user.id);
  if (txError) throw txError;
}