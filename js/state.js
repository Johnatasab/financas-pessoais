export let state = {
  contas: [],
  transacoes: [],
  filtroTipo: 'todos',
  mesFiltro: '',
  graficoCat: null,
  editingTxId: null
};

export const COR_CAT = {
  Alimentação: '#378ADD', Transporte: '#1D9E75', Moradia: '#BA7517',
  Saúde: '#D4537E', Lazer: '#7F77DD', Vestuário: '#D85A30',
  Educação: '#0F6E56', Salário: '#185FA5', Freelance: '#3B6D11',
  Investimento: '#633806', Outros: '#888780'
};

export const ICONE_CONTA = {
  corrente: '🏦', poupanca: '🐷', cartao: '💳',
  investimento: '📈', dinheiro: '💵'
};

let renderCallback = null;
export function setRenderCallback(cb) {
  renderCallback = cb;
}

export function updateState(newPartialState) {
  Object.assign(state, newPartialState);
  if (renderCallback) renderCallback();
}

export function recalcAllBalances() {
  state.contas.forEach(c => c.saldo = 0);
  state.transacoes.forEach(tx => {
    const conta = state.contas.find(c => c.id === tx.conta);
    if (conta) conta.saldo += tx.tipo === 'receita' ? tx.valor : -tx.valor;
  });
  updateState({ contas: state.contas });
}

export function getNextContaId() {
  const max = Math.max(0, ...state.contas.map(c => c.id), 0);
  return max + 1;
}

export function getNextTxId() {
  const max = Math.max(0, ...state.transacoes.map(t => t.id), 0);
  return max + 1;
}