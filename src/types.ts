export type UserRole = "client" | "colaborador" | "admin";

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  approved?: boolean; // Para colaboradores que necessitam de aprovação do administrador
  commissionRate?: number; // Comissão em porcentagem (ex: 2.5 para 2.5%)
  createdAt: string;
}

export type SimulationType = "bolsa_familia" | "inss" | "fgts" | "consignado_privado" | "conta_luz";

export type SimulationStatus = "pending" | "pre_approved" | "approved" | "rejected" | "contracted";

export interface Simulation {
  id: string;
  clientName: string;
  cpf: string;
  phone: string;
  nis?: string;
  benefitAmount: number;
  marginRate: number; // Porcentagem de margem utilizada (ex: 35)
  marginAmount: number; // Valor calculado da margem consignável
  installmentAmount: number; // Valor simulado da parcela mensal
  requestedAmount: number; // Valor simulado do empréstimo liberado
  interestRate: number; // Taxa de juros mensal
  installmentsCount: number; // Quantidade de parcelas
  status: SimulationStatus;
  type: SimulationType;
  createdAt: string;
  createdBy: string; // UID do criador ou "public"
  createdByName?: string; // Nome do colaborador ou visitante
  observations?: string;
  
  // Specific to Conta de Luz or FGTS simulations if needed
  energyProvider?: string;
  luzAverageBill?: number;
  fgtsBalance?: number;
}

export interface SystemConfig {
  id: string;
  bolsaMaxMargin: number;      // Padrão: 35%
  bolsaInterestRate: number;   // Padrão: 2.45% a.m.
  inssMaxMargin: number;       // Padrão: 45%
  inssInterestRate: number;    // Padrão: 1.70% a.m.
  fgtsInterestRate: number;    // Padrão: 1.99% a.m.
  luzInterestRate: number;     // Padrão: 4.99% a.m.
  whatsappNumber: string;      // Número do WhatsApp da JR Crédito
}
