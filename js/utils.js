// === Importações ===


// Constantes de mensagens
export const MSG = {
  CONFIRM_DELETE_TX: 'Excluir esta transação?',
  CONFIRM_DELETE_ACCOUNT: 'Essa conta possui transações. Excluir e transferir?',
  CONFIRM_RESET: 'Apagar todos os dados e começar do zero?',
  ERROR_VALOR: 'Valor deve ser maior que zero',
  ERROR_DESCricao: 'Descrição é obrigatória',
  ERROR_DATA: 'Data é obrigatória',
  ERROR_DATA_FUTURE: 'Não é permitido data futura'
};

let currentCurrency = 'EUR';

export function setCurrency(currency){
  currentCurrency = currency;
}

export function fmtEuro(valor) {
  return '€ ' + valor.toFixed(2).replace('.', '.');
}

export function fmt(valor) {
  const symbol = currentCurrency === 'EUR' ? '€' : 'R$';
  const formatted = valor.toFixed(2).replace('.', ',');
  return symbol + ' ' + formatted;
}

export function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function escapeHtml(str) {
  if (str === undefined || str === null) return;
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

export function debounce(func, delay) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

// Toast simples
let toastContainer = null;
export function showToast(message, type = 'info') {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}