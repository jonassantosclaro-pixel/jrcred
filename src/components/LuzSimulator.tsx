import React, { useState, useEffect } from "react";
import { formatCurrency, formatCPF, formatPhone, generateWhatsAppLink, validateCPF, cleanNumber } from "../utils/helpers";
import { generateSimulationPDF } from "../utils/pdfGenerator";
import { Simulation, SystemConfig } from "../types";
import { addDoc, collection } from "firebase/firestore";
import { db } from "../firebase";
import { handleFirestoreError, OperationType } from "../utils/firebaseErrorHandler";
import { FileText, Smartphone, TrendingUp, AlertCircle, Lightbulb, Sparkles, CheckCircle, Zap } from "lucide-react";

interface LuzSimulatorProps {
  systemConfig: SystemConfig;
  userProfile?: any;
  onSimulationSaved?: (sim: Simulation) => void;
}

export default function LuzSimulator({ systemConfig, userProfile, onSimulationSaved }: LuzSimulatorProps) {
  // Form fields
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [energyProvider, setEnergyProvider] = useState("neoenergia"); // Default provider in Brazil or generic
  const [luzAverageBill, setLuzAverageBill] = useState(250); // average bill R$ 250
  const [installments, setInstallments] = useState(18); // Term terms (e.g. 12, 18, 24)
  const [billInClientName, setBillInClientName] = useState(true);
  const [observations, setObservations] = useState("");

  // Simulation results
  const [estimatedRelease, setEstimatedRelease] = useState(0);
  const [installmentAmount, setInstallmentAmount] = useState(0);
  const [isCpfValid, setIsCpfValid] = useState<boolean | null>(null);

  // UI States
  const [progress, setProgress] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<Simulation | null>(null);
  const [loadingSave, setLoadingSave] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const luzInterestRate = 11.72; // Taxa média residencial real de 11.72% a.m. em junho de 2026 (CET ~12.67%)

  // Real-time calculation of credit limit
  // A typical electricity bill loan allows an installment of up to 45% of the bill value, but cannot exceed a credit cap of R$ 5,000.00
  useEffect(() => {
    // Estimating installment: say, typical maximum installment is 45% of their electricity bill to fit the debit safety margin
    const suggestedInstallment = Math.round(luzAverageBill * 0.45);
    setInstallmentAmount(suggestedInstallment);

    // Limit based on interest rate and installments list, maxed at R$ 5,000.00 as per 2026 rules
    // PV = installment * [(1 - (1 + i)^-n) / i]
    const i = luzInterestRate / 100;
    const factor = (1 - Math.pow(1 + i, -installments)) / i;
    let rawPV = suggestedInstallment * factor;

    if (rawPV > 5000) {
      rawPV = 5000;
      // Re-calculate precise installment based on exact R$ 5,000 credit
      const revisedInstallment = rawPV * (i * Math.pow(1 + i, installments)) / (Math.pow(1 + i, installments) - 1);
      setInstallmentAmount(Math.round(revisedInstallment));
    }

    // Ensure it shows range R$ 400 - R$ 5000
    if (rawPV < 400) {
      rawPV = 400;
    }

    setEstimatedRelease(Math.round(rawPV));
  }, [luzAverageBill, installments, luzInterestRate]);

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

    if (!name.trim()) return setErrorMessage("Por favor, preencha o nome do titular da conta.");
    if (cleanNumber(cpf).length !== 11) return setErrorMessage("O CPF deve conter exatamente 11 dígitos.");
    if (isCpfValid === false) return setErrorMessage("CPF inválido.");
    if (cleanNumber(phone).length < 10) return setErrorMessage("Preencha um número de celular válido para contato.");
    if (!billInClientName) return setErrorMessage("Regra oficial: Para seguir, a conta de luz precisa estar no seu CPF / nome.");
    if (luzAverageBill < 80) return setErrorMessage("O valor médio da conta de luz precisa ser de no mínimo R$ 80,00.");

    setIsSimulating(true);
    setProgress(0);
    setSimulationResult(null);

    // AI simulation analytics loop resembling fast energy-bill deduction check
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
            benefitAmount: luzAverageBill, // Maps to bill parameter
            marginRate: 45, // 45% of the energy bill limit
            marginAmount: luzAverageBill * 0.45,
            installmentAmount: installmentAmount,
            requestedAmount: estimatedRelease,
            interestRate: luzInterestRate,
            installmentsCount: installments,
            status: "pre_approved",
            type: "conta_luz",
            createdAt: new Date().toISOString(),
            createdBy: userProfile ? userProfile.uid : "public",
            createdByName: userProfile ? userProfile.name : "Simulação Web Pública",
            observations: `Distribuidora: ${energyProvider.toUpperCase()}. Conta em nome do próprio titular: Sim. Luz Média: ${formatCurrency(luzAverageBill)}. ${observations ? observations : ""}`,
            energyProvider: energyProvider,
            luzAverageBill: luzAverageBill
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
      setErrorMessage("Erro de conexão ao salvar simulação de Luz no banco de dados.");
      handleFirestoreError(e, OperationType.CREATE, "simulations");
    } finally {
      setLoadingSave(false);
    }
  };

  const getWhatsAppLinkUrl = () => {
    if (!simulationResult) return "#";
    const text = `Olá JR Crédito e Soluções Financeiras!
Gostaria de formalizar minha simulação de Crédito de Débito em Conta de Luz:

*Nome:* ${simulationResult.clientName}
*CPF:* ${formatCPF(simulationResult.cpf)}
*Distribuidora:* ${energyProvider.toUpperCase()}
*Valor Médio Luz:* ${formatCurrency(luzAverageBill)}
*Limite Liberado Estimado:* ${formatCurrency(simulationResult.requestedAmount)}
*Parcela na Fatura:* ${formatCurrency(simulationResult.installmentAmount)} por mês
*Prazo:* ${installments} meses

Favor dar andamento no meu crédito na conta de energia!`;
    return `https://api.whatsapp.com/send?phone=${cleanNumber(systemConfig?.whatsappNumber || "5511999999999")}&text=${encodeURIComponent(text)}`;
  };

  const downloadPDFProposal = () => {
    if (simulationResult) {
      generateSimulationPDF(simulationResult);
    }
  };

  return (
    <div id="luz-simulator-parent" className="bg-[#0f172a] rounded-[32px] overflow-hidden shadow-2xl border border-white/10 transition-all duration-300">
      {/* Header com selo LUZ */}
      <div className="bg-gradient-to-r from-[#020617] to-[#0f172a] p-8 text-white relative border-b border-white/10">
        <div className="absolute top-4 right-4 bg-yellow-500/10 text-yellow-500 text-xs px-3 py-1.5 rounded-full border border-yellow-500/25 flex items-center gap-1.5 font-medium animate-pulse">
          <Zap className="w-3.5 h-3.5" />
          Sem consulta SPC/SERASA
        </div>
        <h3 className="text-2xl font-bold font-sans tracking-tight">Crédito na Conta de Luz</h3>
        <p className="text-slate-400 text-sm mt-2 max-w-xl">
          Linha inovadora com débito automático direto na sua fatura de energia elétrica. Basta ter a conta em seu nome e libera até R$ 4.200,00!
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
              {/* Nome do Titular */}
              <div>
                <label className="block text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">Nome Completo do Titular da Conta</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Amanda Bezerra Rocha"
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

              {/* Distribuidora */}
              <div>
                <label className="block text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">Companhia de Energia / Distribuidora</label>
                <select
                  value={energyProvider}
                  onChange={(e) => setEnergyProvider(e.target.value)}
                  className="w-full text-white bg-[#020617] border border-white/10 focus:border-yellow-500 px-4 py-3 rounded-xl transition duration-200 outline-none"
                >
                  <option value="neoenergia">Neoenergia (Coelba, Celpe, Cosern, Elektro)</option>
                  <option value="enel">Enel (São Paulo, Rio de Janeiro, Ceará)</option>
                  <option value="cpfl">CPFL Energia</option>
                  <option value="cemig">Cemig (Minas Gerais)</option>
                  <option value="copel">Copel (Paraná)</option>
                  <option value="equatorial">Equatorial Energia</option>
                  <option value="other">Outras Companhias Regulamentadas</option>
                </select>
              </div>

              {/* Telefone/WhatsApp */}
              <div>
                <label className="block text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">WhatsApp do Titular da Conta</label>
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
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-white/10 pb-2">Dedução Médio da Conta de Luz</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Sliders de Valor Médio Fatura */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-semibold text-slate-300">Valor Médio Conta de Luz</span>
                    <span className="font-bold text-yellow-500">{formatCurrency(luzAverageBill)}</span>
                  </div>
                  <input
                    type="range"
                    min="80"
                    max="1000"
                    step="10"
                    value={luzAverageBill}
                    onChange={(e) => setLuzAverageBill(Number(e.target.value))}
                    className="w-full accent-yellow-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>Mín: R$ 80</span>
                    <span>Máx: R$ 1.000</span>
                  </div>
                  <span className="block text-[11px] text-slate-505 mt-2">
                    *Para simular, sua fatura de energia mensal deve ser de no mínimo R$ 80,00.
                  </span>
                </div>

                {/* Parcelas Mensais na Fatura */}
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Selecione o Prazo de Parcelamento (8x a 24x)</label>
                  <div className="grid grid-cols-5 gap-2">
                    {[8, 12, 16, 20, 24].map((months) => (
                      <button
                        key={months}
                        type="button"
                        onClick={() => setInstallments(months)}
                        className={`py-3 rounded-xl border text-xs font-bold transition duration-200 cursor-pointer ${
                          installments === months
                            ? "border-yellow-500 bg-yellow-500/10 text-yellow-500 font-extrabold"
                            : "border-white/10 bg-[#020617] hover:bg-white/5 text-slate-400"
                        }`}
                      >
                        {months}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Titularidade da conta de luz flyer requirement */}
              <div className="pt-4 border-t border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider font-bold text-slate-450">A conta de luz está em seu nome / CPF?</label>
                  <p className="text-[10px] text-slate-500 mt-0.5">Basta ter a conta de luz em seu CPF para liberar o contrato de débito em fatura.</p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setBillInClientName(true)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      billInClientName
                        ? "border-yellow-500 bg-yellow-500/10 text-yellow-500"
                        : "border-white/10 bg-[#020617] text-slate-400"
                    }`}
                  >
                    Sim, está no meu nome
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillInClientName(false)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      !billInClientName
                        ? "border-red-500 bg-red-500/10 text-red-400"
                        : "border-white/10 bg-[#020617] text-slate-400"
                    }`}
                  >
                    Não, está no de terceiros
                  </button>
                </div>
              </div>
            </div>

            {/* Observações opcionais */}
            {userProfile && (
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Observações / Detalhes para Equipe de Suporte (Opcional)</label>
                <textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Número de instalação, código do cliente, operadora de energia e informações extras."
                  className="w-full text-white bg-[#020617] border border-white/10 focus:border-yellow-500 px-4 py-3 rounded-xl transition duration-200 outline-none h-18 text-sm"
                />
              </div>
            )}

            {/* Live Indicator calculated */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-yellow-500/5 rounded-2xl border border-yellow-500/20 gap-4">
              <div>
                <div className="text-xs font-bold text-yellow-500 uppercase tracking-wide">Parcela Estimada Debitada na Fatura</div>
                <div className="text-2xl font-extrabold text-[#10B981] mt-1 flex items-center gap-1.5 font-mono">
                  {formatCurrency(installmentAmount)} <span className="text-xs text-white">/mês na luz</span>
                </div>
              </div>
              <div className="text-right md:text-left h-full flex flex-col justify-center">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Valor Máximo Estimado Liberado</div>
                <div className="text-3xl font-black text-yellow-500 animate-pulse mt-0.5">{formatCurrency(estimatedRelease)}</div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSimulating}
              className="w-full bg-gradient-to-r from-gold-dark to-gold text-white font-sans font-bold py-4 rounded-xl shadow-lg hover:shadow-xl hover:opacity-95 transition-all text-center flex items-center justify-center gap-2 text-lg cursor-pointer"
            >
              {isSimulating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  Módulo de Inteligência Simulando Débito Energia ({progress}%) ...
                </>
              ) : (
                <>
                  <Lightbulb className="w-5 h-5 text-yellow-500" />
                  Efetuar Simulação Conta de Luz
                </>
              )}
            </button>
          </form>
        ) : (
          /* RESULTADOS DA SIMULAÇÃO E PRÉ-APROVAÇÃO LUZ */
          <div className="space-y-6 animate-fade-in text-white">
            <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-3xl text-center">
              <div className="inline-flex items-center justify-center bg-green-500/20 text-green-400 rounded-full p-3 mb-3">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h4 className="text-2xl font-extrabold text-green-400">Linha de Energia Pré-Aprovada!</h4>
              <p className="text-xs text-green-550/85 font-medium mt-1 uppercase tracking-widest leading-relaxed">
                Correspondente Autorizado JR Crédito & Crédito em Conta de Luz
              </p>
            </div>

            <div className="bg-[#020617] rounded-xl border border-white/5 p-6 space-y-4">
              <h5 className="font-bold text-white border-b border-white/10 pb-2 mb-3">Resumo da Simulação Débito Fatura</h5>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#0f172a] p-4 rounded-xl border border-white/5 text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Titular</div>
                  <div className="text-xs font-extrabold text-slate-300 truncate mt-1">{simulationResult.clientName}</div>
                </div>
                <div className="bg-[#0f172a] p-4 rounded-xl border border-white/5 text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-500">CPF</div>
                  <div className="text-xs font-extrabold text-slate-300 mt-1">{formatCPF(simulationResult.cpf)}</div>
                </div>
                <div className="bg-[#0f172a] p-4 rounded-xl border border-white/5 text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Média Luz</div>
                  <div className="text-xs font-extrabold text-[#10B981] mt-1">{formatCurrency(simulationResult.benefitAmount)}</div>
                </div>
                <div className="bg-[#0f172a] p-4 rounded-xl border border-white/5 text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Operadora</div>
                  <div className="text-xs font-extrabold text-slate-300 uppercase mt-1">{simulationResult.energyProvider}</div>
                </div>
              </div>

              {/* Quadro Destaque Principal de liberação */}
              <div className="bg-gradient-to-br from-[#020617] to-[#0f172a] rounded-2xl text-white p-6 relative overflow-hidden border border-yellow-500/20">
                <div className="absolute -right-4 -bottom-4 bg-yellow-500/5 rounded-full w-32 h-32 blur-xl" />
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <span className="text-xs uppercase font-extrabold text-yellow-500 tracking-widest">Valor Líquido Pré-Aprovado Liberado</span>
                    <h5 className="text-4xl font-extrabold text-white mt-1 font-mono">{formatCurrency(simulationResult.requestedAmount)}</h5>
                  </div>
                  <div className="md:text-right bg-white/5 border border-white/10 p-3 rounded-xl backdrop-blur-sm self-stretch flex flex-col justify-center">
                    <span className="text-[10px] uppercase text-slate-300 font-bold">Parcela na Fatura da Luz</span>
                    <span className="text-lg font-black text-yellow-500">{formatCurrency(simulationResult.installmentAmount)} <span className="text-xs text-white">/mês</span></span>
                    <span className="text-[10px] text-slate-350 font-medium">{simulationResult.installmentsCount} meses</span>
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
                className="w-full flex items-center justify-center gap-2 bg-green-650 hover:bg-green-700 text-white font-bold py-3.5 px-4 rounded-xl transition duration-200 text-center cursor-pointer shadow-lg shadow-green-500/10"
              >
                <Smartphone className="w-5 h-5" />
                Chamar no WhatsApp
              </a>
            </div>

            {/* Persistence */}
            <div className="bg-[#020617] p-6 rounded-2xl border border-white/5 space-y-4">
              <div>
                <h6 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Deseja Registrar este lead de forma segura?</h6>
                <p className="text-slate-550 text-xs mt-1">
                  Guarde de forma persistente os dados deste cliente no Firestore para monitoramento administrativo e operacional completo.
                </p>
              </div>

              {saveSuccess ? (
                <div className="bg-green-500/10 text-green-400 px-4 py-3 rounded-lg text-xs font-bold border border-green-500/20 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Lead registrado e salvo no banco de dados em tempo real!
                </div>
              ) : (
                <button
                  onClick={saveSimulationToDb}
                  disabled={loadingSave}
                  className="bg-yellow-600 hover:bg-yellow-500 text-stone-900 font-bold py-3 px-6 rounded-xl transition text-xs shadow-md shadow-yellow-500/5 inline-flex items-center gap-2 cursor-pointer"
                >
                  {loadingSave ? (
                    <>
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-stone-800 border-t-transparent" />
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
                className="text-gold-dark hover:text-gold text-sm font-semibold underline decoration-dotted tracking-wide cursor-pointer"
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
