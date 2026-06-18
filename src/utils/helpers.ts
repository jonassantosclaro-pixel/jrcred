// Formata valores para Moeda Brasileira (R$)
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

// Limpa strings de caracteres não-numéricos
export function cleanNumber(str: string): string {
  return str.replace(/\D/g, "");
}

// Formata CPF (###.###.###-##)
export function formatCPF(value: string): string {
  const digits = cleanNumber(value);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

// Formata NIS (###.#####.##-#)
export function formatNIS(value: string): string {
  const digits = cleanNumber(value);
  if (digits.length <= 3) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 10) return `${digits.slice(0, 3)}.${digits.slice(3, 8)}.${digits.slice(8)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 8)}.${digits.slice(8, 10)}-${digits.slice(10, 11)}`;
}

// Formata Telefone ((##) #####-####)
export function formatPhone(value: string): string {
  const digits = cleanNumber(value);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

// Calcula o valor presente (Valor Liberado Estimado) baseado no Valor da Parcela, Taxa de Juros e Quantidade de Parcelas
// Fórmula do PMT invertida: PV = PMT * [(1 - (1 + i)^-n) / i]
export function calculateLoanAmount(installment: number, monthlyRatePercent: number, months: number): number {
  const i = monthlyRatePercent / 100;
  if (i === 0) return installment * months;
  const factor = (1 - Math.pow(1 + i, -months)) / i;
  return installment * factor;
}

// Calcula a parcela ideal para o empréstimo se o usuário digitar o valor que deseja
// PMT = PV * [i * (1 + i)^n] / [(1 + i)^n - 1]
export function calculateInstallment(principal: number, monthlyRatePercent: number, months: number): number {
  const i = monthlyRatePercent / 100;
  if (i === 0) return principal / months;
  const factor = (i * Math.pow(1 + i, months)) / (Math.pow(1 + i, months) - 1);
  return principal * factor;
}

// Cria a URL customizada do WhatsApp com as informações formatadas para o fechamento
export function generateWhatsAppLink(
  whatsappNumber: string,
  clientName: string,
  cpf: string,
  nis: string | undefined,
  benefitAmount: number,
  installment: number,
  amount: number,
  months: number,
  type: string
): string {
  const cleanPhone = cleanNumber(whatsappNumber);
  
  let typeText = "Consignado INSS";
  if (type === "bolsa_familia") typeText = "Crédito Social Bolsa Família (Boleto - Livre)";
  else if (type === "fgts") typeText = "Antecipação Saque-Aniversário FGTS";
  else if (type === "luz") typeText = "Empréstimo Conta de Luz Crefaz";
  else if (type === "clt") typeText = "Consignado Privado CLT";
  
  const text = `Olá JR Crédito e Soluções Financeiras!
Gostaria de formalizar minha simulação de seguro/crédito:

*Tipo:* ${typeText}
*Nome:* ${clientName}
*CPF:* ${cpf}
${nis ? `*NIS:* ${nis}\n` : ""}*Renda/Salário/Benefício:* ${formatCurrency(benefitAmount)}
*Parcela Simulada:* ${formatCurrency(installment)}
*Valor Estimado Liberado:* ${formatCurrency(amount)}
*Prazo:* ${months} ${type === "fgts" ? "saques anuais" : "meses"}

Favor analisar minha pré-aprovação para fechamento oficial de 2026!`;

  return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
}

// Validador simples de CPF
export function validateCPF(cpf: string): boolean {
  const clean = cleanNumber(cpf);
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;
  
  let sum = 0;
  let remainder;
  
  for (let i = 1; i <= 9; i++) {
    sum = sum + parseInt(clean.substring(i - 1, i)) * (11 - i);
  }
  
  remainder = (sum * 10) % 11;
  if ((remainder === 10) || (remainder === 11)) remainder = 0;
  if (remainder !== parseInt(clean.substring(9, 10))) return false;
  
  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum = sum + parseInt(clean.substring(i - 1, i)) * (12 - i);
  }
  
  remainder = (sum * 10) % 11;
  if ((remainder === 10) || (remainder === 11)) remainder = 0;
  if (remainder !== parseInt(clean.substring(10, 11))) return false;
  
  return true;
}
