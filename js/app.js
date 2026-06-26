// js/app.js
import { supabase, signUp, signIn, signInWithGoogle, getCurrentUser, onAuthStateChange } from './supabase.js';
import { setCurrency } from './utils.js';
import { state, updateState, recalcAllBalances } from './state.js';
import { renderAll } from './ui.js';
import { updateChart } from './charts.js';
import { initCombustivel } from './modules/combustivel.js';
import { initCompras } from './modules/compras.js';

// Referências globais
let authContainer, appContainer, emailInput, passwordInput, loginBtn, registerBtn, googleBtn, authError;

// Função para mostrar erro
function showAuthError(msg) {
  if (authError) {
    authError.textContent = msg;
    setTimeout(() => authError.textContent = '', 5000);
  }
}

// Função para entrar no app
async function enterApp(user) {
  if (authContainer) authContainer.style.display = 'none';
  if (appContainer) appContainer.style.display = 'block';

  // Carregar perfil
  const { data: profile, error } = await supabase
    .from('perfis')
    .select('*')
    .eq('id', user.id)
    .single();
  if (profile && profile.moeda) {
    setCurrency(profile.moeda);
  }

  // Carregar dados
  await loadUserData(user.id);
  
  // Inicializar módulos
  initCombustivel();
  initCompras();
  
  // Renderizar
  renderAll();
  updateChart();
}

// Função para sair
function logoutApp() {
  if (authContainer) authContainer.style.display = 'flex';
  if (appContainer) appContainer.style.display = 'none';
  state.contas = [];
  state.transacoes = [];
  renderAll();
}

// Carregar dados do usuário
async function loadUserData(userId) {
  const { data: contas, error: errContas } = await supabase
    .from('contas')
    .select('*')
    .eq('user_id', userId);
  if (errContas) throw errContas;
  
  const { data: transacoes, error: errTrans } = await supabase
    .from('transacoes')
    .select('*')
    .eq('user_id', userId);
  if (errTrans) throw errTrans;
  
  state.contas = contas || [];
  state.transacoes = transacoes || [];
  recalcAllBalances();
  updateState({ contas: state.contas, transacoes: state.transacoes });
}

// Handlers
async function handleLogin() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (!email || !password) {
    showAuthError('Preencha email e senha.');
    return;
  }
  try {
    const { user } = await signIn(email, password);
    enterApp(user);
  } catch (err) {
    showAuthError(err.message || 'Erro ao entrar.');
  }
}

async function handleRegister() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (!email || !password) {
    showAuthError('Preencha email e senha.');
    return;
  }
  if (password.length < 6) {
    showAuthError('A senha deve ter pelo menos 6 caracteres.');
    return;
  }
  try {
    const { user } = await signUp(email, password);
    if (user) {
      showAuthError('✅ Conta criada! Faça login para continuar.');
    }
  } catch (err) {
    showAuthError(err.message || 'Erro ao registar.');
  }
}

async function handleGoogleLogin() {
  try {
    await signInWithGoogle();
  } catch (err) {
    showAuthError(err.message || 'Erro ao entrar com Google.');
  }
}

// Função de inicialização
function init() {
  // Buscar referências aos elementos
  authContainer = document.getElementById('auth-container');
  appContainer = document.querySelector('.container');
  emailInput = document.getElementById('email-input');
  passwordInput = document.getElementById('password-input');
  loginBtn = document.getElementById('loginBtn');
  registerBtn = document.getElementById('registerBtn');
  googleBtn = document.getElementById('googleBtn');
  authError = document.getElementById('auth-error');

  // Verificar se os elementos existem
  if (!authContainer || !appContainer) {
    console.error('❌ Elementos de login não encontrados!');
    return;
  }

  // Configurar visibilidade inicial
  authContainer.style.display = 'flex';
  appContainer.style.display = 'none';

  // Conectar eventos (apenas se os botões existirem)
  if (loginBtn) loginBtn.onclick = handleLogin;
  if (registerBtn) registerBtn.onclick = handleRegister;
  if (googleBtn) googleBtn.onclick = handleGoogleLogin;

  // Verificar se já está logado
  getCurrentUser().then(user => {
    if (user) {
      enterApp(user);
    }
  }).catch(() => {});

  // Escutar mudanças de autenticação
  onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      enterApp(session.user);
    }
    if (event === 'SIGNED_OUT') {
      logoutApp();
    }
  });
}

// Iniciar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', init);