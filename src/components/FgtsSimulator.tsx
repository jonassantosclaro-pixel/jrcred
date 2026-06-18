import React, { useState, useEffect } from "react";
import { formatCurrency, formatCPF, formatPhone, generateWhatsAppLink, validateCPF, cleanNumber } from "../utils/helpers";
import { generateSimulationPDF } from "../utils/pdfGenerator";
import { Simulation, SystemConfig } from "../types";
import { addDoc, collection } from "firebase/firestore";
import { db } from "../firebase";
import { handleFirestoreError, OperationType } from "../utils/firebaseErrorHandler";
import { FileText, Smartphone, TrendingUp, AlertCircle, ShieldCheck, Sparkles, CheckCircle, Wallet } from "lucide-react";

interface FgtsSimulatorProps {
  systemConfig: SystemConfig;
  userProfile?: any;
  onSimulationSaved?: (sim: Simulation) => void;
}

export default function FgtsSimulator({ systemConfig, userProfile, onSimulationSaved }: FgtsSimulatorProps) {
  // Form fields
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [fgtsBalance, setFgtsBalance] = useState(5000); // Standard FGTS balance
  const [anticipatedYears, setAnticipatedYears] = useState(5); // Limite oficial 2026 de até 5 parcelas
  const [receiveByPix, setReceiveByPix] = useState(true);
  const [observations, setObservations] = useState("");

  // Simulation results
  const [estimatedRelease, setEstimatedRelease] = useState(0);
  const [isCpfValid, setIsCpfValid] = useState<boolean | null>(null);

  // UI States
  const [progress, setProgress] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<Simulation | null>(null);
  const [loadingSave, setLoadingSave] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const fgtsInterestRate = systemConfig?.fgtsInterestRate || 1.99;

  // Official Caixa Econômica Saque-Aniversário schedule table
  const calculateSaqueAniversario = (balance: number): number => {
    if (balance <= 500) {
      return balance * 0.50;
    } else if (balance <= 1000) {
      return balance * 0.40 + 50;
    } else if (balance <= 5000) {
      return balance * 0.30 + 150;
    } else if (balance <= 10000) {
      return balance * 0.20 + 650;
    } else if (balance <= 15000) {
      return balance * 0.15 + 1150;
    } else if (balance <= 20000) {
      return balance * 0.10 + 1900;
    } else {
      return balance * 0.05 + 2900;
    }
  };

  // Real-time calculation of multi-year anticipation
  useEffect(() => {
    let totalPV = 0;
    let balanceCap = fgtsBalance;

    for (let yr = 1; yr <= anticipatedYears; yr++) {
      const yearlyBase = calculateSaqueAniversario(balanceCap);
      if (yearlyBase <= 0) break;

      // Discounting formula over months (yr * 12)
      // PV = FV / (1 + i)^n
      const rate = fgtsInterestRate / 100;
      const months = yr * 12;
      const yearPV = yearlyBase / Math.pow(1 + rate, months);

      // Capping each year/installment realistic range between R$ 100 and R$ 500
      let cappedYearPV = yearPV;
      if (cappedYearPV < 100) cappedYearPV = 100;
      if (cappedYearPV > 500) cappedYearPV = 500;

      totalPV += cappedYearPV;
      
      // Decrease remaining balance cap realistically for subsequent years
      balanceCap = balanceCap - yearlyBase;
      if (balanceCap < 0) balanceCap = 0;
    }

    // Multiply by standard safety margin for pre-approval simulation
    let calculated = Math.round(totalPV * 0.95);
    // Capping at R$ 2,500 total as per June 2026 guidelines
    if (calculated > 2500) {
      calculated = 2500;
    }
    setEstimatedRelease(calculated);
  }, [fgtsBalance, anticipatedYears, fgtsInterestRate]);

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = formatCPF(e.target.value);
    setCpf(value);
    const clean = cleanNumber(value);
    if (clean.length === 11) {
      setIsCpfValid(validateCPF(value));
    } else {
      setIsCpfValid(null);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  const handleSimulate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!name.trim()) return setErrorMessage("Por favor, preencha o nome do trabalhador.");
    if (cleanNumber(cpf).length !== 11) return setErrorMessage("O CPF de conter exatamente 11 dígitos.");
    if (isCpfValid === false) return setErrorMessage("CPF inválido.");
    if (cleanNumber(phone).length < 10) return setErrorMessage("Preencha um número de celular válido para contato.");
    if (fgtsBalance < 150) return setErrorMessage("O saldo mínimo necessário para antecipação do FGTS é de R$ 150,00.");

    setIsSimulating(true);
    setProgress(0);
    setSimulationResult(null);

    // AI simulation analytics loop resembling 5-minute fast deposit
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsSimulating(false);

          const simObj: Simulation = {
            id: "SIM_" + Math.random().toString(36).substr(2, 9).toUpperCase(),
            clientName: name,
            cpf: cleanNumber(cpf),
            phone: phone,
            benefitAmount: fgtsBalance, // Maps to balance parameter
            marginRate: anticipatedYears, // Maps to years anticipated
            marginAmount: fgtsBalance * 0.35, // average
            installmentAmount: 0, // No monthly bills! Retido diretamente do fundo
            requestedAmount: estimatedRelease,
            interestRate: fgtsInterestRate,
            installmentsCount: anticipatedYears,
            status: "pre_approved",
            type: "fgts",
            createdAt: new Date().toISOString(),
            createdBy: userProfile ? userProfile.uid : "public",
            createdByName: userProfile ? userProfile.name : "Simulação Web Pública",
            observations: `Dinheiro na tela em até 5min via Pix: ${receiveByPix ? "Sim" : "Não"}. ${observations ? observations : ""}`,
            fgtsBalance: fgtsBalance
          };

          setSimulationResult(simObj);
          return 100;
        }
        return prev + 25;
      });
    }, 100);
  };

  const saveSimulationToDb = async () => {
    if (!simulationResult) return;
    setLoadingSave(true);
    setErrorMessage("");
    try {
      await addDoc(collection(db, "simulations"), {
        ...simulationResult,
        createdAt: new Date().toISOString()
      });
      setSaveSuccess(true);
      if (onSimulationSaved) {
        onSimulationSaved(simulationResult);
      }
    } catch (e: any) {
      console.error(e);
      setErrorMessage("Erro de conexão ao salvar simulação de FGTS no banco de dados.");
      handleFirestoreError(e, OperationType.CREATE, "simulations");
    } finally {
      setLoadingSave(false);
    }
  };

  const getWhatsAppLinkUrl = () => {
    if (!simulationResult) return "#";
    const text = `Olá JR Crédito e Soluções Financeiras!
Gostaria de formalizar minha simulação de Antecipação Saque-Aniversário FGTS:

*Nome:* ${simulationResult.clientName}
*CPF:* ${formatCPF(simulationResult.cpf)}
*Saldo FGTS Atual:* ${formatCurrency(fgtsBalance)}
*Anos Antecipados:* ${anticipatedYears} parcelas anuais
*Valor Estimado Liberado:* ${formatCurrency(simulationResult.requestedAmount)}
*Chave Pix para Recebimento:* Sim, em até 30 minutos via Pix!

Favor dar andamento na contratação do meu FGTS!`;
    return `https://api.whatsapp.com/send?phone=${cleanNumber(systemConfig?.whatsappNumber || "5511999999999")}&text=${encodeURIComponent(text)}`;
  };

  const downloadPDFProposal = () => {
    if (simulationResult) {
      generateSimulationPDF(simulationResult);
    }
  };

  return (
    <div id="fgts-simulator-parent" className="bg-[#0f172a] rounded-[32px] overflow-hidden shadow-2xl border border-white/10 transition-all duration-300">
      {/* Header com selo VERDE / OURO */}
      <div className="bg-gradient-to-r from-[#020617] to-[#0f172a] p-8 text-white relative border-b border-white/10">
        <div className="absolute top-4 right-4 bg-emerald-500/10 text-emerald-400 text-xs px-3 py-1.5 rounded-full border border-emerald-500/25 flex items-center gap-1.5 font-medium animate-pulse">
          <ShieldCheck className="w-3.5 h-3.5" />
          Liberação via Pix em 30min
        </div>
        <h3 className="text-2xl font-bold font-sans tracking-tight">Antecipação Saque-Aniversário FGTS</h3>
        <p className="text-slate-400 text-sm mt-2 max-w-xl">
          Até 31/10/2026 antecipe até <span className="text-emerald-400 font-bold">5 parcelas anuais</span> (Mín R$ 100 e Máx R$ 500 por parcela, com limite global de <span className="text-emerald-400 font-bold">R$ 2.500,00</span>). Sem boletos mensais!
        </p>
      </div>

      <div className="p-8">
        {!simulationResult ? (
          <form onSubmit={handleSimulate} className="space-y-6">
            {errorMessage && (
              <div className="bg-red-500/10 text-red-400 p-4 rounded-xl flex items-center gap-3 border border-red-500/20">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium">{errorMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Nome do Trabalhador */}
              <div>
                <label className="block text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">Nome Completo do Trabalhador</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Carlos Eduardo de Souza"
                  className="w-full text-white bg-[#020617] border border-white/10 focus:border-yellow-500 px-4 py-3 rounded-xl transition duration-200 outline-none"
                />
              </div>

              {/* CPF */}
              <div>
                <label className="block text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">CPF</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={cpf}
                    onChange={handleCpfChange}
                    maxLength={14}
                    placeholder="000.000.000-00"
                    className={`w-full text-white bg-[#020617] border px-4 py-3 rounded-xl transition duration-200 outline-none ${
                      isCpfValid === true
                        ? "border-green-500 bg-green-500/5"
                        : isCpfValid === false
                        ? "border-red-500 bg-red-500/5"
                        : "border-white/10 focus:border-yellow-500"
                    }`}
                  />
                  {isCpfValid === true && (
                    <span className="absolute right-3 top-3.5 text-green-400 text-xs font-bold">Válido</span>
                  )}
                  {isCpfValid === false && (
                    <span className="absolute right-3 top-3.5 text-red-400 text-xs font-bold">Inválido</span>
                  )}
                </div>
              </div>

              {/* Telefone/WhatsApp */}
              <div className="md:col-span-2">
                <label className="block text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">WhatsApp do Cliente para Receber o Pix</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={handlePhoneChange}
                  maxLength={15}
                  placeholder="(00) 00000-0000"
                  className="w-full text-white bg-[#020617] border border-white/10 focus:border-yellow-500 px-4 py-3 rounded-xl transition duration-200 outline-none"
                />
              </div>
            </div>

            <div className="bg-[#020617] p-6 rounded-2xl border border-white/5 space-y-6">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-white/10 pb-2">Configuração do Fundo (FGTS)</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Sliders de Saldo FGTS */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-semibold text-slate-300 font-mono">Saldo Estimado/Total FGTS</span>
                    <span className="font-bold text-emerald-400">{formatCurrency(fgtsBalance)}</span>
                  </div>
                  <input
                    type="range"
                    min="150"
                    max="50000"
                    step="250"
                    value={fgtsBalance}
                    onChange={(e) => setFgtsBalance(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>Mín: R$ 150</span>
                    <span>Máx: R$ 50.000</span>
                  </div>
                  <span className="block text-[11px] text-slate-500 mt-2">
                    *Para simular, consulte seu saldo no aplicativo oficial do FGTS do Governo.
                  </span>
                </div>

                {/* Parcelas Anuais para Antecipação */}
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Anos/Parcelas a Antecipar (Até 5 Saques - Regulamento 2026)</label>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((years) => (
                      <button
                        key={years}
                        type="button"
                        onClick={() => setAnticipatedYears(years)}
                        className={`py-3 rounded-xl border text-xs font-bold transition duration-200 cursor-pointer ${
                          anticipatedYears === years
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-450 font-black"
                            : "border-white/10 bg-[#020617] hover:bg-white/5 text-slate-500"
                        }`}
                      >
                        {years} {years === 1 ? "Ano" : "Anos"}
                      </button>
                    ))}
                  </div>
                  <span className="block text-[10px] text-slate-500 mt-2 font-medium">
                    *Permite antecipar de 1 até 5 parcelas de Saque-Aniversário conforme novas diretrizes de preservação patrimonial.
                  </span>
                </div>
              </div>

              {/* Opção Pix */}
              <div className="pt-4 border-t border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider font-bold text-slate-450">Recebimento Instantâneo via Pix</label>
                  <p className="text-[10px] text-slate-500 mt-0.5">Dinheiro depositado nas contas autorizadas da Caixa no mesmo dia.</p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setReceiveByPix(true)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      receiveByPix
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-450"
                        : "border-white/10 bg-[#020617] text-slate-400"
                    }`}
                  >
                    Sim, Enviar Via Pix
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiveByPix(false)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      !receiveByPix
                        ? "border-orange-500 bg-orange-500/10 text-orange-400"
                        : "border-white/10 bg-[#020617] text-slate-400"
                    }`}
                  >
                    Transferência Comum (TED)
                  </button>
                </div>
              </div>
            </div>

            {/* Observações opcionais */}
            {userProfile && (
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Comentários Operacionais de Equipe Corretor (Opcional)</label>
                <textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Canal de entrada, restrições cadastrais, agências, etc."
                  className="w-full text-white bg-[#020617] border border-white/10 focus:border-yellow-500 px-4 py-3 rounded-xl transition duration-200 outline-none h-18 text-sm"
                />
              </div>
            )}

            {/* Live Indicator calculated */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-emerald-500/5 rounded-2xl border border-emerald-500/20 gap-4">
              <div>
                <div className="text-xs font-bold text-emerald-400 uppercase tracking-wide">Prazo Médio de Depósito</div>
                <div className="text-xl font-extrabold text-[#10B981] mt-1 flex items-center gap-1.5 font-mono">
                  <Wallet className="w-4 h-4 text-emerald-400" />
                  Até 30 minutos na conta!
                </div>
              </div>
              <div className="text-right md:text-left h-full flex flex-col justify-center">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Valor Bruto Líquido Estimado Liberado</div>
                <div className="text-3xl font-black text-emerald-400 animate-pulse mt-0.5">{formatCurrency(estimatedRelease)}</div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSimulating}
              className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-sans font-bold py-4 rounded-xl shadow-lg hover:shadow-xl hover:opacity-95 transition-all text-center flex items-center justify-center gap-2 text-lg cursor-pointer"
            >
              {isSimulating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  Módulo de Antigravity IA Simulando FGTS ({progress}%) ...
                </>
              ) : (
                <>
                  <TrendingUp className="w-5 h-5" />
                  Efetuar Simulação Online e sem Custos
                </>
              )}
            </button>
          </form>
        ) : (
          /* RESULTADOS DA SIMULAÇÃO E PRÉ-APROVAÇÃO FGTS */
          <div className="space-y-6 animate-fade-in text-white">
            <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-3xl text-center">
              <div className="inline-flex items-center justify-center bg-green-500/20 text-green-400 rounded-full p-3 mb-3">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h4 className="text-2xl font-extrabold text-green-400">Saldo FGTS Pré-Aprovado!</h4>
              <p className="text-xs text-green-500/80 font-medium mt-1 uppercase tracking-widest leading-relaxed">
                Empréstimo Rápido sem Parcelas Mensais — Direto do Saldo FGTS
              </p>
            </div>

            <div className="bg-[#020617] rounded-xl border border-white/5 p-6 space-y-4">
              <h5 className="font-bold text-white border-b border-white/10 pb-2 mb-3">Resumo da Antecipação</h5>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#0f172a] p-4 rounded-xl border border-white/5 text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Trabalhador</div>
                  <div className="text-xs font-extrabold text-slate-300 truncate mt-1">{simulationResult.clientName}</div>
                </div>
                <div className="bg-[#0f172a] p-4 rounded-xl border border-white/5 text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-500">CPF</div>
                  <div className="text-xs font-extrabold text-slate-300 mt-1">{formatCPF(simulationResult.cpf)}</div>
                </div>
                <div className="bg-[#0f172a] p-4 rounded-xl border border-white/5 text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Saldo FGTS Base</div>
                  <div className="text-xs font-extrabold text-slate-300 mt-1">{formatCurrency(simulationResult.benefitAmount)}</div>
                </div>
                <div className="bg-[#0f172a] p-4 rounded-xl border border-white/5 text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Alíquota Média Juros</div>
                  <div className="text-xs font-extrabold text-slate-300 mt-1">{simulationResult.interestRate}% a.m.</div>
                </div>
              </div>

              {/* Quadro Destaque Principal de liberação */}
              <div className="bg-gradient-to-br from-[#020617] to-[#0f172a] rounded-2xl text-white p-6 relative overflow-hidden border border-emerald-500/20">
                <div className="absolute -right-4 -bottom-4 bg-emerald-500/5 rounded-full w-32 h-32 blur-xl" />
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <span className="text-xs uppercase font-extrabold text-emerald-400 tracking-widest">Valor Líquido Estimado Liberado via Pix</span>
                    <h5 className="text-4xl font-extrabold text-emerald-400 mt-1 font-mono">{formatCurrency(simulationResult.requestedAmount)}</h5>
                  </div>
                  <div className="md:text-right bg-white/5 border border-white/10 p-3 rounded-xl backdrop-blur-sm self-stretch flex flex-col justify-center">
                    <span className="text-[10px] uppercase text-slate-350 font-bold">Parcelas Mensais</span>
                    <span className="text-lg font-black text-white">R$ 0,00</span>
                    <span className="text-[10px] text-emerald-400 font-bold">Sem Boleto Mensal!</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Ações pós simulação */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={downloadPDFProposal}
                className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3.5 px-4 rounded-xl transition duration-200 text-center cursor-pointer border border-white/5"
              >
                <FileText className="w-5 h-5 text-slate-300" />
                Baixar Proposta em PDF
              </button>

              <a
                href={getWhatsAppLinkUrl()}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl transition duration-200 text-center cursor-pointer shadow-lg shadow-green-500/10"
              >
                <Smartphone className="w-5 h-5" />
                Receber Pix no WhatsApp
              </a>
            </div>

            {/* Persistence */}
            <div className="bg-[#020617] p-6 rounded-2xl border border-white/5 space-y-4">
              <div>
                <h6 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Deseja Registrar este lead de forma segura?</h6>
                <p className="text-slate-500 text-xs mt-1">
                  Guarde de forma persistente os dados deste cliente no Firestore para acompanhar o status e garantir sua comissão de vendas.
                </p>
              </div>

              {saveSuccess ? (
                <div className="bg-emerald-500/10 text-emerald-400 px-4 py-3 rounded-lg text-xs font-bold border border-green-500/20 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  Lead registrado e salvo no banco de dados em tempo real!
                </div>
              ) : (
                <button
                  onClick={saveSimulationToDb}
                  disabled={loadingSave}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-xl transition text-xs shadow-md shadow-emerald-500/5 inline-flex items-center gap-2 cursor-pointer"
                >
                  {loadingSave ? (
                    <>
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                      Registrando...
                    </>
                  ) : (
                    "Registrar e Salvar Simulação na JR Crédito"
                  )}
                </button>
              )}
            </div>

            {/* Voltar para Simular outro */}
            <div className="text-center">
              <button
                onClick={() => {
                  setSimulationResult(null);
                  setSaveSuccess(false);
                }}
                className="text-emerald-455 hover:text-emerald-400 text-sm font-semibold underline decoration-dotted tracking-wide cursor-pointer"
              >
                Realizar Novas Simulações
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
