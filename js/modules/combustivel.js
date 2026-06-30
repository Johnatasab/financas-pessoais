import { state, recalcAllBalances } from '../state.js';
import { showToast, fmtEuro, getTodayStr } from '../utils.js';
import { saveTransactionToDB } from '../storage.js';
import { renderAll } from '../ui.js';
import { getCurrentUser } from '../supabase.js';

let ultimoCalculo = 0;

export function calcularCombustivel() {
    const km = parseFloat(document.getElementById('combustivel-km').value);
    const consumo = parseFloat(document.getElementById('combustivel-consumo').value); // L/100km
    const preco = parseFloat(document.getElementById('combustivel-preco').value);

    if (!km || km <= 0 || !consumo || consumo <= 0 || !preco || preco <= 0) {
        showToast('Preencha todos os campos com valores positivos.', 'error');
        return;
    }

    const gasto = (km / 100) * consumo * preco;
    ultimoCalculo = gasto;

    const resultadoDiv = document.getElementById('combustivel-resultado');
    resultadoDiv.innerHTML = `
    💰 Gasto estimado: <spam style="color: var(--verde); font-weight: 700;">${fmtEuro(gasto)}</spam>
    <div style="font-size:12px; color: var(--muted); margin-top: 4px;"> 
        ${km} km . ${consumo} L/100km . ${fmtEuro(preco)}/L
    </div>
    `;
    document.getElementById('lancarCombustivelBtn').style.display = 'inline-block';
}

export async function lancarDespesaCombustivel() {
  console.log('🔄 lancarDespesaCombustivel chamada');

  const btnLancar = document.getElementById('lancarCombustivelBtn');
  if (!btnLancar) return;

  // Evita cliques múltiplos
  if (btnLancar.disabled) {
    console.log('⏳ Já está a processar...');
    return;
  }

  if (ultimoCalculo <= 0) {
    showToast('Calcule o gasto primeiro.', 'error');
    return;
  }

  const user = await getCurrentUser();
  if (!user) {
    showToast('Usuário não autenticado.', 'error');
    return;
  }

  if (!state.contas.length) {
    showToast('Crie uma conta antes de lançar despesas.', 'error');
    return;
  }

  // Desabilitar botão
  btnLancar.disabled = true;
  btnLancar.textContent = '⏳ A lançar...';

  try {
    const transacao = {
      user_id: user.id,
      tipo: 'despesa',
      forma: 'debito',
      conta: state.contas[0].id,
      valor: ultimoCalculo,
      descricao: 'Abastecimento',
      cat: 'Combustível',
      data: getTodayStr(),
      mes: getTodayStr().slice(0, 7)
    };

    console.log('📤 Objeto a enviar:', transacao);

    const newId = await saveTransactionToDB(transacao);
    transacao.id = newId;
    state.transacoes.push(transacao);
    recalcAllBalances();
    renderAll();
    showToast(`✅ Despesa de combustível lançada: ${fmtEuro(ultimoCalculo)}`, 'success');

    // Reset UI
    document.getElementById('lancarCombustivelBtn').style.display = 'none';
    document.getElementById('combustivel-resultado').innerHTML = '';
    ultimoCalculo = 0;

    //Limpar campos 
    document.getElementById('combustivel-km').value = '';
    document.getElementById('combustivel-consumo').value = '';
    document.getElementById('combustivel-preco').value = '';
    ultimoCalculo = 0;
    
  } catch (err) {
    console.error('❌ Erro ao lançar despesa:', err);
    showToast('Erro ao lançar despesa.', 'error');
  } finally {
    // Reabilitar botão
    btnLancar.disabled = false;
    btnLancar.textContent = '✅ Lançar como despesa';
  }
}

export function initCombustivel() {
    console.log('🔧 initCombustivel() chamada');
    const btnCalcular = document.getElementById('calculaCombustivelBtn');
    const btnLancar = document.getElementById('lancarCombustivelBtn');

    if (btnCalcular) {
        btnCalcular.onclick = null;
        btnCalcular.onclick = calcularCombustivel;
    }

    if (btnLancar) {
        btnLancar.onclick = null;
        btnLancar.onclick = lancarDespesaCombustivel;
    }
}