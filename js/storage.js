import { state, updateState, recalcAllBalances } from './state.js';
import { showToast } from './utils.js';

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

export function saveAccountToDB(conta) {
  return new Promise((resolve, reject) => {
    ensureDB(() => {
      const req = db.transaction('contas', 'readwrite').objectStore('contas').add(conta);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  });
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

export function deleteAccountFromDB(id) {
  return new Promise((resolve, reject) => {
    ensureDB(() => {
      const req = db.transaction('contas', 'readwrite').objectStore('contas').delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

export function saveTransactionToDB(tx) {
  return new Promise((resolve, reject) => {
    ensureDB(() => {
      if (!tx.mes && tx.data) tx.mes = tx.data.slice(0,7);
      const req = db.transaction('transacoes', 'readwrite').objectStore('transacoes').add(tx);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  });
}

export function updateTransactionInDB(tx) {
  return new Promise((resolve, reject) => {
    ensureDB(() => {
      if (!tx.mes && tx.data) tx.mes = tx.data.slice(0,7);
      const req = db.transaction('transacoes', 'readwrite').objectStore('transacoes').put(tx);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

export function deleteTransactionFromDB(id) {
  return new Promise((resolve, reject) => {
    ensureDB(() => {
      const req = db.transaction('transacoes', 'readwrite').objectStore('transacoes').delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
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
  return new Promise((resolve, reject) => {
    ensureDB(() => {
      const txContas = db.transaction('contas', 'readwrite').objectStore('contas').clear();
      const txTrans = db.transaction('transacoes', 'readwrite').objectStore('transacoes').clear();
      Promise.all([
        new Promise(r => txContas.onsuccess = r),
        new Promise(r => txTrans.onsuccess = r)
      ]).then(resolve).catch(reject);
    });
  });
}