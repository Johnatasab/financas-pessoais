//Cores das categorias
export const COR_CAT = {
    Alimentação: '#378ADD', Transporte: '#1D9E75', Moradia: '#BA7517', Saúde: '#D4537E', Lazer: '#7F77DD', Vestuário: '#D85A30', Educação: '#0F6E56', Salário: '#185FA5', Freelance: '#3B6D11', Investimento: '#633806', Outros: '#888780'
};

//Ícones das contas 
export const ICONE_CONTA = {
    corrente: '🏛️', poupanca: '🐷', cartao: '💳', investimento: '💰', dinheiro: '💶'
};

// Mensagem do sistema (p)ara evitar repetções)
export const MSG = {
    CONFIRM_DELETE_TX: 'Excluir esta transação?',
    CONFIRM_DELETE_CONTA_WITH_TX: 'Essa conta possui transações. excluir e transderir as transações para a primeira conta disponível?',
    CONFIRM_RESET: 'Apagar todos os dados e começar do zero?',
    ERROR_VALOR: 'Valor deve ser maior que zero',
    ERROR_DESC: 'Descrição é obrigatória',
    ERROR_DATA: 'Data é obrigatório',
    ERROR_DATA_FUTURA: 'Não é permitido data futura',
    SUCCESS_SAVE_TX: 'Transação salva com sucesso!',
    SUCCESS_DELETE_TX: 'Transação removida',
    SUCCESS_SAVE_CONTA: 'Conta criada com sucesso',
    SUCCESS_DELETE_CONTA: 'Conta removida',
    ERROR_STORAGE: 'Erro ao salvar no banco de dados',
    WARN_LAST_CONTA: 'Você deve ter pelo menos uma conta. Crie outra conta antes de excluir esta.',
    INFO_TRANSFER_TX: (nomeConta) => `Transações transferidas para ${nomeConta}`,
    IMPORT_SUCCESS: (qtd) => `Importação concluída: ${qtd} transações válidas`,
    IMPORT_ERROR: 'Arquivo inválido ou corrompido.',
    EXPORT_SUCCESS: 'Backup exportado'
};