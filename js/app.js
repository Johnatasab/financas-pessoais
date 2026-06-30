// === Importação === 
import { supabase, signUp, signIn, signInWithGoogle, signOut, getCurrentUser, onAuthStateChange } from './supabase.js';
import { setCurrency, showToast, fmtEuro, getTodayStr, debounce } from './utils.js';
import { state, updateState, recalcAllBalances } from './state.js';
import { renderAll, switchTab, setFiltro, renderAnalise, closeModal, openAddTransactionModal, openContaModal, editTransaction, escolherReceita, escolherDespesa, voltarStep1 } from './ui.js';
import { updateChart } from './charts.js';
import { initCombustivel, lancarDespesaCombustivel } from './modules/combustivel.js';
import { initCompras } from './modules/compras.js';
import { salvarTransacao, excluirTx, salvarConta, excluirConta, exportData, importData, resetToDemo, loadUserData } from './crud.js';

// === Variavéis globais ===
let authContainer, appContainer, emailInput, passwordInput, authError;
let menu, logoutBtn, editProfileBtn;
let loginBtn, registerBtn, googleBtn;

// === Funções auxiliares ===
function showAuthError(msg) {
  if (authError) {
    authError.textContent = msg;
    setTimeout(() => authError.textContent = '', 5000);
  }
}

// === Função de tema ===
function toggleThema() {
  const body = document.body;
  const themeBtn = document.getElementById('themeToggle');

  body.classList.toggle('dark-mode');

  const isDark = body.classList.contains('dark-mode');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');

  //Atualizar icone do botão
  if (themeBtn) {
    themeBtn.textContent = isDark ? '☀️' : '🌑';
    themeBtn.setAttribute('arial-label', isDark ? 'Alternar para tema claro' : 'Alternar para tema escuro');
  }
}
// Carregar tema guardado 
function loadTheme() {
  const saveTheme = localStorage.getItem('theme');
  const body = document.body;
  const themeBtn = document.getElementById('themeToggle');

  if (saveTheme === 'dark') {
    body.classList.add('dark-mode');
    if (themeBtn) {
      themeBtn.textContent = '☀️';
      themeBtn.setAttribute('aria-label', 'Alternar para tema claro');
    }
  } else {
    body.classList.remove('dark-mode');
    if (themeBtn){
      themeBtn.textContent = '🌑';
      themeBtn.setAttribute('aria-label', 'Alternar para tema escuro');
    }
  }
}

// === Garantir perfil ===
async function ensureProfile(userId) {
  try{
    const { data, error } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('⚠️ Erro ao buscar perfil:', error.message);
    }

    if (data) {
      console.log('✅ Perfil encontrado:', data);
      return data;
    }

    console.log('📝 Criando perfil para o usuário...');
    const { error: upsertError } = await supabase
      .from('perfis')
      .upsert({ id: userId, pais: 'Portugal', moeda: 'EUR' }, { onConflict: 'id'});

    if (upsertError) {
      console.error('❌ Erro ao criar perfil:', upsertError);
      return null;
    }
    console.log('✅ Perfil criado!')
    //Buscar novamente
    const { data: newData } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    return newData || { pais: 'Portugal', moeda: 'EUR' };
  } catch (err) {
    console.warn('⚠️ Exceção ao buscar perfil:', err.message);
    return { pais: 'Portugal', moeda: 'EUR' };
  }
}

// === Entrar no app ===
async function enterApp(user) {
  console.log('✅ Entrando no app, usuário:', user.email);
  authContainer.style.display = 'none';
  appContainer.style.display = 'block';

  //Garantir perfil
  const profile = await ensureProfile(user.id);
  if (profile && profile.moeda) {
    setCurrency(profile.moeda);
  }

  //Atualizar avatar e nome  
  const avatarEl = document.getElementById( 'user-avatar' );
  const avatarMenuEl = document.getElementById( 'user-avatar-menu' );
  const userNameEl = document.getElementById( 'user-name-menu' );
  const userEmailEl = document.getElementById( 'user-email-menu' );
  const nome = user.user_metadata?.full_name || user.email?.split('@') [0] || 'Usuário';
  const email = user.email || '';
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(nome)}&background=378ADD&color=fff&size=80&font-size=0.5`;
  avatarEl.src = user.user_metadata?.avatar_url || fallback;
  avatarMenuEl.src = user.user_metadata?.avatar_url || fallback;
  userNameEl.textContent = `Olá, ${nome}!`;
  userEmailEl.textContent = email;

  await loadUserData(user.id);
  initCombustivel();
  //initCompras(); // Desativado temporariamente
  //setupEventListeners(); // Garantir eventos
  renderAll();
  updateChart();
}

// === Sair do APP ===
function logoutApp() {
  authContainer.style.display = 'flex';
  appContainer.style.display = 'none';
  state.contas = [];
  state.transacoes = [];
  renderAll();
  if (menu) menu.classList.add('hidden');
}

// === Handlers de autenticação ===
async function handleLogin() {
  console.log('🔑 Tentando login...');
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
  console.log('📝 Tentando registra...');
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
  console.log('🌐 Tentando login com Google...');
  try {
    await signInWithGoogle();
  } catch (err) {
    showAuthError(err.message || 'Erro ao entrar com Google.');
  }
}

async function handleLogout() {
  console.log('🚪 Logout iniciado');
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    console.log('✅ Logout concluído');
    logoutApp();
    showToast('👋 Até logo!', 'info');
  } catch (err) {
    console.error('❌ Erro no logout:', err);
    showToast('Erro ao sair: ' + err.message, 'error');
  }
}

// === Configurar eventos (botõe) ===
function setupEventListeners() {
  console.log('🔧 Configurando event listeners...');

  //Botões principais
  document.getElementById('newTransactionBtn').addEventListener('click', () => {
    console.log('🖱️ Clique no + Nova');
    openAddTransactionModal();
  });

  document.getElementById('newContaBtn').addEventListener('click', () => {
    console.log('🖱️ Clique em Nova Conta');
    openContaModal();
  });

  document.getElementById('saveTxBtn').addEventListener('click', () => {
    console.log('🖱️ Clique em salvar tansação');
    salvarTransacao();
  });
  document.getElementById('closeModalBtn').addEventListener('click', () => closeModal('modal-tx'));

  document.getElementById('closeContaModalBtn').addEventListener('click', () => closeModal('modal-conta'));

  document.getElementById('exportBtn').addEventListener('click', exportData);

  document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());

  document.getElementById('resetDemoBtn').addEventListener('click', resetToDemo);

  document.getElementById('importFile').addEventListener('change', (e) => importData(e.target));

  // Botões modal
  document.getElementById('escolherReceita').addEventListener('click', escolherReceita);
  document.getElementById('escolherDespesa').addEventListener('click', escolherDespesa);
  document.getElementById('voltarStep1Btn').addEventListener('click', voltarStep1);
  //document.getElementById('lancarCombustivelBtn').addEventListener('click', lancarDespesaCombustivel);
  document.getElementById('saveContaBtn').addEventListener('click', () => {
    console.log('🖱️ Clique em Salvar conta');
    salvarConta();
  });



  //Abas
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab, tab));
  });

  //Chips de filtro
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => setFiltro(chip.dataset.filter, chip));
  });

  //Fechar modais ao clicar no overlay
  document.getElementById('modal-tx').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-tx')) closeModal('modal-tx');
  });
  document.getElementById('modal-conta').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-conta')) closeModal('modal-conta');
  });

  //Menu do avatar
  const profile = document.getElementById('user-profile');
  if (profile && menu) {
    profile.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('hidden');
    });
    document.addEventListener('click', () => {
      if (!menu.classList.contains('hidden')) menu.classList.add('hidden');
    });
  }

  //Botão logout
  const logouBtn = document.getElementById('logout-btn');
  if (logouBtn) {
    logouBtn.addEventListener('click', handleLogout);
  }

  //Botão editar perfil
  const editBtn = document.getElementById('edit-profile-btn');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      showToast('Funcionalidade em breve!', 'info');
      if (menu) menu.classList.add('hidden');
    });
  }
}

// === Inicialização ===
function init() {
  console.log('🔧 init() executada');

  // Buscar referências aos elementos
  authContainer = document.getElementById('auth-container');
  appContainer = document.querySelector('.container');
  emailInput = document.getElementById('email-input');
  passwordInput = document.getElementById('password-input');
  loginBtn = document.getElementById('loginBtn');
  registerBtn = document.getElementById('registerBtn');
  googleBtn = document.getElementById('googleBtn');
  authError = document.getElementById('auth-error');
  menu = document.getElementById('user-menu');

  console.log('📦 Elementos encontrados:', {
    authContainer: !!authContainer,
    appContainer: !!appContainer,
    emailInput: !!emailInput,
    passwordInput: !!passwordInput,
    authError: !!authError,
    menu: !!menu
  });

  if (!authContainer || !appContainer) {
    console.log('❌ Elementos de login não encontrados!');
    return;
  }

  //Mostrar login, esconder app
  authContainer.style.display = 'flex';
  appContainer.style.display = 'none';

  //Eventos de login 
  document.getElementById('loginBtn').addEventListener('click', handleLogin);
  document.getElementById('registerBtn').addEventListener('click', handleRegister);
  document.getElementById('googleBtn').addEventListener('click', handleGoogleLogin);

  //Verificar se já esta logado
  getCurrentUser().then(user => {
    if (user) {
      console.log('👤 Usuário já logado:', user.email);
      enterApp(user);
    } else {
      console.log('👤 Nenhum usuário logado.');
    }
  }).catch(err => {
    console.warn('Erro ao verificar usuário:', err);
  });

  // Escutar mudanças de autenticação
  onAuthStateChange((event, session) => {
    console.log('🔄️ Evento de auth:', event);
    if (event === 'SIGNED_IN' && session?.user) {
      enterApp(session.user);
    }
    if (event === 'SIGNED_OUT') {
      logoutApp();
    }
  });

  // Carregar tema 
  loadTheme();

  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', toggleThema);
    console.log('✅ Botão de tema configurado');
  } else{
    console.warn('⚠️ Botão de tema não configurado (ID: themeToggle)');
  }

  //Configurar eventos (Botões, abas, etc.)
  setupEventListeners();

  //Renderizar inicial
  renderAll();
  updateChart();
}

// Iniciar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', init);