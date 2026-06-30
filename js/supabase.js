import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ivunkwtjcnfxriifivlg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_egqdy70tUVrAwI0UarVuJg_1wHGc2UF';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === Autenticação ===

//Registrar com email e senha 
export async function signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
}

// entrar com email e senha 
export async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

//Entra com Google (OAuth)
export async function signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({ 
        provider: 'google', 
        options: { redirectTo: window.location.origin + window.location.pathname }});

    if (error) throw error;
    return data;
}

//Sair
export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

//Obter usuário atual 
export async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

//Escutar mudanças de autenticação 
export function onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange((event, session) => {
        callback(event, session);
    });
}

//Funções de perfil
export async function getProfile(userId) {
    const { data, error } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return data || { pais: 'Portugal', moeda: 'EUR' };  
}

export async function updateProfile(userId, update) {
    const { data, error } = await supabase
        .from('perfis')
        .upsert({ id: userId, ...update }, { onConflict: 'id' });
    if (error) throw error;
    return data;
}

// Funções para contas
export async function getContas(userId) {
    const { data, error } = await supabase
        .from('contas')
        .select('*')
        .eq('user_id', userId);
    if (error) throw error;
    return data;
}

export async function addConta(userId, conta) {
    const { data, error } = await supabase
        .from('contas')
        .insert([{ user_id: userId, ...conta }])
        .select();
    if (error) throw error;
    return data[0];
}

export async function updateConta(id, update) {
    const { data, error } = await supabase
        .from('contas')
        .update(update)
        .eq('id', id)
        .select();
    if (error) throw error;
    return data[0];
}

export async function deleteConta(id) {
    const { error } = await supabase
        .from('contas')
        .delete()
        .eq('id', id);
    if (error) throw error;
}

//Funções para transações 
export async function getTransacoes(userId) {
    const { data, error } = await supabase
        .from('transacoes')
        .select('*')
        .eq('user_id', userId);
    if (error) throw error;
    return data;
}

export async function addTransacao(userId, transacao) {
    const { data, error } = await supabase
        .from('transacoes')
        .insert([{ user_id: userId, ...transacao }])
        .select();
    if (error) throw error;
    return data[0];
}