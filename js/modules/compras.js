// js/modules/compras.js
import { state } from '../state.js';
import { showToast, fmtEuro, getTodayStr, escapeHtml } from '../utils.js';
import { saveTransactionToDB } from '../storage.js';
import { recalcAllBalances } from '../state.js';
import { renderAll } from '../ui.js';

const SUPERMERCADO_PT = ['Continente', 'Pingo Doce', 'Auchan', 'Lidl', 'Mercadona', 'Aldi', 'Intermarché'];
const SUPERMERCADO_BR = ['Pão de Açucar', 'Carrefour', 'Extra', 'Atacadão', 'Assaí'];

const DOMINIOS_PT = ['continente.pt', 'pingodoce.pt', 'auchan.pt', 'lidl.pt', 'mercadona.pt', 'aldi.pt', 'intermache.pt'];
const DOMINIOS_BR = ['paodeacucar.com', 'carrefour.com.br', 'extra.com.br', 'atacadao.com.br', 'assai.com.br'];

// Configuração da API (substitua pelos seus dados)
const API_KEY = 'SUA_CHAVE_API';
const CX = 'SEU_ID_MECANISMO_BUSCA';

// Estado local
let listaItens = [];
let editingId = null;

// ========== FUNÇÕES DE RENDERIZAÇÃO ==========
function renderLista() {
  const container = document.getElementById('lista-itens');
  if (!container) return;
  if (!listaItens.length) {
    container.innerHTML = '<div class="empty">Nenhum item na lista. Adicione um produto!</div>';
    document.getElementById('total-compras').innerText = '€ 0,00';
    return;
  }

  const sorted = [...listaItens].sort((a, b) => a.comprado - b.comprado);
  let html = '<div style="display:flex; flex-direction:column; gap:6px;">';
  sorted.forEach(item => {
    const checked = item.comprado ? 'checked' : '';
    html += `
      <div class="tx-item" style="${item.comprado ? 'opacity:0.6;' : ''}">
        <input type="checkbox" ${checked} data-id="${item.id}" class="item-checkbox" style="width:18px;height:18px;cursor:pointer;">
        <div style="flex:1;">
          <div style="font-weight:500;">${escapeHtml(item.nome)}</div>
          <div style="font-size:12px;color:var(--muted);">
            ${item.supermercado || '—'} · ${item.categoria}
          </div>
        </div>
        <div style="font-weight:600;color:var(--verde);">${fmtEuro(item.preco)}</div>
        <button class="icon-btn pesquisar-item" data-id="${item.id}" style="color:var(--azul);">🔍</button>
        <button class="icon-btn delete-item" data-id="${item.id}" style="color:var(--vermelho);">🗑️</button>
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;

  const total = listaItens.reduce((acc, item) => acc + (item.comprado ? 0 : item.preco), 0);
  document.getElementById('total-compras').innerText = fmtEuro(total);

  // Reatribuir eventos
  document.querySelectorAll('.item-checkbox').forEach(cb => {
    cb.onchange = (e) => marcarItem(parseInt(e.target.dataset.id));
  });
  document.querySelectorAll('.delete-item').forEach(btn => {
    btn.onclick = () => removerItem(parseInt(btn.dataset.id));
  });
  document.querySelectorAll('.pesquisar-item').forEach(btn => {
    btn.onclick = () => pesquisarPreco(parseInt(btn.dataset.id));
  });
}

// ========== CRUD DA LISTA ==========
function adicionarItem(nome, preco, categoria, supermercado) {
  if (!nome || nome.trim() === '') {
    showToast('Insira o nome do produto.', 'error');
    return false;
  }
  if (!preco || preco <= 0) {
    showToast('Insira um preço válido.', 'error');
    return false;
  }

  const novoItem = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    nome: nome.trim(),
    preco: parseFloat(preco),
    categoria: categoria || 'Outros',
    supermercado: supermercado || 'Outro',
    comprado: false
  };

  if (editingId) {
    const index = listaItens.findIndex(i => i.id === editingId);
    if (index !== -1) listaItens[index] = { ...listaItens[index], ...novoItem };
    editingId = null;
    showToast('Item atualizado!', 'success');
  } else {
    listaItens.push(novoItem);
    showToast('Item adicionado à lista!', 'success');
  }

  renderLista();
  fecharFormulario();
  return true;
}

function removerItem(id) {
  if (!confirm('Remover este item?')) return;
  listaItens = listaItens.filter(item => item.id !== id);
  renderLista();
  showToast('Item removido.', 'info');
}

function marcarItem(id) {
  const item = listaItens.find(i => i.id === id);
  if (!item) return;
  item.comprado = !item.comprado;
  renderLista();
}

function editarItem(id) {
  const item = listaItens.find(i => i.id === id);
  if (!item) return;
  editingId = id;
  document.getElementById('item-nome').value = item.nome;
  document.getElementById('item-preco').value = item.preco;
  document.getElementById('item-categoria').value = item.categoria;
  document.getElementById('item-supermercado').value = item.supermercado || 'Continente';
  document.getElementById('form-item-container').style.display = 'block';
  document.getElementById('addItemBtn').style.display = 'none';
  document.getElementById('salvarItemBtn').innerText = 'Atualizar item';
}

// ========== CONTROLE DO FORMULÁRIO ==========
function abrirFormulario() {
  document.getElementById('form-item-container').style.display = 'block';
  document.getElementById('addItemBtn').style.display = 'none';
  document.getElementById('salvarItemBtn').innerText = 'Adicionar à lista';
  document.getElementById('item-nome').value = '';
  document.getElementById('item-preco').value = '';
  document.getElementById('item-categoria').value = 'Alimentação';
  
  const selectSuper = document.getElementById('item-supermercacdo');
  const supermercados = getSupermercados();
  selectSuper.innerHTML = supermercados.map(s => `<option value="${s}">${s}</option>`).join('');

  editingId = null;
}

function fecharFormulario() {
  document.getElementById('form-item-container').style.display = 'none';
  document.getElementById('addItemBtn').style.display = 'inline-flex';
  editingId = null;
}

// ========== PESQUISA ONLINE ==========
async function pesquisarPreco(id) {
  const item = listaItens.find(i => i.id === id);
  const dominios = getDominios();
  const siteFilter = dominios.map(d => `site:${d}`).join(' OR ');
  const query = `${item.nome} preço ${siteFilter}`;
  if (!item) return;

  showToast(`Pesquisando preço de "${item.nome}"...`, 'info');

  try {
    const query = `${item.nome} preço ${item.supermercado || 'supermercado'} Portugal`;
    const url = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${CX}&q=${encodeURIComponent(query)}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      showToast('Nenhum resultado encontrado. Insira o preço manualmente.', 'warning');
      return;
    }

    const resultados = data.items.map(item => {
      const titulo = item.title;
      const snippet = item.snippet;
      const precoMatch = snippet.match(/[\€€]\s*(\d+[.,]\d{2})/);
      const preco = precoMatch ? parseFloat(precoMatch[1].replace(',', '.')) : null;
      return { titulo, snippet, preco, link: item.link };
    }).filter(r => r.preco !== null);

    if (resultados.length === 0) {
      showToast('Não foi possível extrair preços. Insira manualmente.', 'warning');
      return;
    }

    let msg = `🔍 Resultados para "${item.nome}":\n\n`;
    resultados.slice(0, 3).forEach((r, i) => {
      msg += `${i+1}. ${r.titulo} → ${fmtEuro(r.preco)}\n`;
    });
    msg += '\nEscolha o número do preço desejado (ou 0 para cancelar):';

    const escolha = prompt(msg);
    if (!escolha || escolha === '0') return;

    const idx = parseInt(escolha) - 1;
    if (isNaN(idx) || idx < 0 || idx >= resultados.length) {
      showToast('Escolha inválida.', 'error');
      return;
    }

    const precoEncontrado = resultados[idx].preco;
    item.preco = precoEncontrado;
    const supermercadoEncontrado = resultados[idx].titulo.match(/(Continente|Pingo Doce|Auchan|Lidl|Mercadona|Aldi|Intermarché)/i);
    if (supermercadoEncontrado) item.supermercado = supermercadoEncontrado[1];

    renderLista();
    showToast(`Preço de "${item.nome}" atualizado para ${fmtEuro(precoEncontrado)}`, 'success');

  } catch (err) {
    console.error(err);
    showToast('Erro na pesquisa. Tente novamente mais tarde.', 'error');
  }
}

// ========== FINALIZAR COMPRA ==========
async function finalizarCompras() {
  const itensParaComprar = listaItens.filter(item => item.comprado);
  if (!itensParaComprar.length) {
    showToast('Nenhum item marcado como comprado.', 'error');
    return;
  }

  const total = itensParaComprar.reduce((acc, item) => acc + item.preco, 0);
  const quantidade = itensParaComprar.length;
  const supermercado = itensParaComprar[0]?.supermercado || 'Supermercado';

  const confirmMsg = `Finalizar compra no ${supermercado}?\n\n` +
                     `${quantidade} item(ns)\n` +
                     `Total: ${fmtEuro(total)}\n\n` +
                     `Isso gerará UMA despesa na categoria "Supermercado".`;

  if (!confirm(confirmMsg)) return;

  if (!state.contas.length) {
    showToast('Crie uma conta antes de lançar despesas.', 'error');
    return;
  }

  const transacao = {
    tipo: 'despesa',
    forma: 'debito',
    conta: state.contas[0].id,
    valor: total,
    desc: `Compras ${supermercado} - ${quantidade} itens`,
    cat: 'Supermercado',
    data: getTodayStr(),
    mes: getTodayStr().slice(0, 7)
  };

  try {
    const newId = await saveTransactionToDB(transacao);
    transacao.id = newId;
    state.transacoes.push(transacao);
    recalcAllBalances();
    renderAll();
    listaItens = listaItens.filter(item => !item.comprado);
    renderLista();
    showToast(`Compra finalizada! Despesa de ${fmtEuro(total)} lançada em "Supermercado".`, 'success');
  } catch (err) {
    console.error(err);
    showToast('Erro ao lançar despesa.', 'error');
  }
}

// ========== INICIALIZAÇÃO DO MÓDULO ==========
export function initCompras() {
  const btnAdd = document.getElementById('addItemBtn');
  const btnCancelar = document.getElementById('cancelarItemBtn');
  const btnSalvar = document.getElementById('salvarItemBtn');
  const btnFinalizar = document.getElementById('finalizarComprasBtn');

  if (btnAdd) btnAdd.onclick = abrirFormulario;
  if (btnCancelar) btnCancelar.onclick = fecharFormulario;
  if (btnSalvar) {
    btnSalvar.onclick = () => {
      const nome = document.getElementById('item-nome').value;
      const preco = parseFloat(document.getElementById('item-preco').value);
      const categoria = document.getElementById('item-categoria').value;
      const supermercado = document.getElementById('item-supermercado').value;
      adicionarItem(nome, preco, categoria, supermercado);
    };
  }
  if (btnFinalizar) btnFinalizar.onclick = finalizarCompras;

  // Carregar lista do localStorage
  const saved = localStorage.getItem('listaCompras');
  if (saved) {
    try {
      listaItens = JSON.parse(saved);
    } catch(e) { listaItens = []; }
  }
  renderLista();

  // Salvar automaticamente a lista no localStorage
  const originalRender = renderLista;
  renderLista = function() {
    originalRender();
    localStorage.setItem('listaCompras', JSON.stringify(listaItens));
  };
}