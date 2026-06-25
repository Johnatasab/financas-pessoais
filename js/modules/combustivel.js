import { state } from '../state.js';
import { showToast, fmtEuro, getTodayStr } from '../utils.js';
import { saveTransactionToDB } from '../storage.js';
import { recalcAllBalances } from '../state.js';
import { renderAll } from '../ui.js';

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
    if (ultimoCalculo <= 0 ){
        showToast('Calcule o gasto primeiro', 'error');
        return;
    }
    
    if (!state.contas.length) { 
        showToast('Crie uma conta antes de lançar despesas.', 'error');
        return;
    }

    const transacao = {
        tipo: 'despesa',
        forma: 'debito',
        conta: state.contas[0].id,
        valor: ultimoCalculo,
        desc: 'Abastecimento',
        cat: 'Combustível',
        data: getTodayStr(),
        mes: getTodayStr().slice(0, 7)
    };

    try { 
        const newId = await saveTransactionToDB(transacao);
        transacao.id = newId;
        state.transacoes.push(transacao);
        recalcAllBalances();
        renderAll();
        showToast(`Despesa de combustível lançada: ${fmtEuro(ultimoCalculo)}`, 'success');
        document.getElementById('lancarCombustivelBtn').style.display = 'none';
        document.getElementById('combustivel-resultado').innerHTML = '';
        ultimoCalculo = 0;
    } catch (err) { 
        showToast('Erro ao lançar despesa.', 'error');
    }
}

export function initCombustivel() {
  document.addEventListener('click', function(e) {
    if (e.target.id === 'calcularCombustivelBtn') {
      calcularCombustivel();
    }
    if (e.target.id === 'lancarCombustivelBtn') {
      lancarDespesaCombustivel();
    }
  });
}