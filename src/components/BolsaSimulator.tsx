import React, { useState, useEffect } from "react";
import { formatCurrency, formatCPF, formatNIS, formatPhone, calculateLoanAmount, generateWhatsAppLink, validateCPF, cleanNumber } from "../utils/helpers";
import { generateSimulationPDF } from "../utils/pdfGenerator";
import { Simulation, SystemConfig } from "../types";
import { addDoc, collection } from "firebase/firestore";
import { db } from "../firebase";
import { handleFirestoreError, OperationType } from "../utils/firebaseErrorHandler";
import { FileText, Smartphone, TrendingUp, AlertCircle, ShieldAlert, Sparkles, CheckCircle } from "lucide-react";

interface BolsaSimulatorProps {
  systemConfig: SystemConfig;
  userProfile?: any;
  onSimulationSaved?: (sim: Simulation) => void;
}

export default function BolsaSimulator({ systemConfig, userProfile, onSimulationSaved }: BolsaSimulatorProps) {
  // Form fields
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [nis, setNis] = useState("");
  const [phone, setPhone] = useState("");
  const [benefitAmount, setBenefitAmount] = useState(600); // Base Bolsa Família is R$600
  const [installments, setInstallments] = useState(12); // standard terms (e.g. 6, 12, 18)
  const [observations, setObservations] = useState("");
  
  // Custom requirements from images
  const [receivesByCaixaTem, setReceivesByCaixaTem] = useState<boolean>(true);
  const [operationType, setOperationType] = useState<"novo" | "refinanciamento">("novo");
  const [refinancingHasFourPaidInstallments, setRefinancingHasFourPaidInstallments] = useState<boolean>(true);
  
  // Simulation results
  const [marginValue, setMarginValue] = useState(0);
  const [loanEstimated, setLoanEstimated] = useState(0);
  const [isCpfValid, setIsCpfValid] = useState<boolean | null>(null);
  const [isNisValid, setIsNisValid] = useState<boolean | null>(null);
  
  // UI states
  const [progress, setProgress] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<Simulation | null>(null);
  const [loadingSave, setLoadingSave] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const bolsaMaxMargin = systemConfig?.bolsaMaxMargin || 35;
  const bolsaInterestRate = systemConfig?.bolsaInterestRate || 5.90;

  // Real-time calculations
  useEffect(() => {
    // Calculo de margem consignável (ex: 35% do valor do benefício)
    const margin = benefitAmount * (bolsaMaxMargin / 100);
    setMarginValue(margin);

    // Calculo do valor do Empréstimo com base na parcela (que é igual à margem total)
    const calculatedLoan = calculateLoanAmount(margin, bolsaInterestRate, installments);
    setLoanEstimated(calculatedLoan);
  }, [benefitAmount, installments, bolsaMaxMargin, bolsaInterestRate]);

  // CPF validations
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

  // NIS validations (11 digits)
  const handleNisChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = formatNIS(e.target.value);
    setNis(value);
    const clean = cleanNumber(value);
    if (clean.length === 11) {
      setIsNisValid(true);
    } else {
      setIsNisValid(null);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  const handleSimulate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!name.trim()) return setErrorMessage("Por favor, preencha o nome do beneficiário.");
    if (cleanNumber(cpf).length !== 11) return setErrorMessage("O CPF deve conter exatamente 11 dígitos.");
    if (isCpfValid === false) return setErrorMessage("O CPF digitado é inválido.");
    if (cleanNumber(nis).length !== 11) return setErrorMessage("O NIS deve conter exatamente 11 dígitos.");
    if (cleanNumber(phone).length < 10) return setErrorMessage("Preencha um número de WhatsApp válido.");
    
    // Novas validações das fotos (Bolsa Família)
    if (benefitAmount < 300) {
      return setErrorMessage("A renda/benefício deve ser de no mínimo R$ 300,00.");
    }
    if (!receivesByCaixaTem) {
      return setErrorMessage("Regra oficial: Para seguir, o benefício precisa ser recebido pelo aplicativo Caixa Tem.");
    }
    if (operationType === "refinanciamento" && !refinancingHasFourPaidInstallments) {
      return setErrorMessage("Regra oficial: Para refinanciamento, é necessário ter no mínimo 4 parcelas pagas.");
    }

    setIsSimulating(true);
    setProgress(0);
    setSimulationResult(null);

    // Animação da IA simuladora de pré-aprovação inteligente
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsSimulating(false);
          
          // Criar observação detalhada com dados adicionados
          const extraObs = `${observations ? observations + " | " : ""}Operação: ${operationType === "novo" ? "Novo Empréstimo" : "Refinanciamento (min. 4 parcelas pagas)"}. Recebe pelo Caixa Tem: ${receivesByCaixaTem ? "Sim" : "Não"}.`;

          // Criar objeto da simulação simulada
          const simObj: Simulation = {
            id: "SIM_" + Math.random().toString(36).substr(2, 9).toUpperCase(),
            clientName: name,
            cpf: cleanNumber(cpf),
            phone: phone,
            nis: cleanNumber(nis),
            benefitAmount: benefitAmount,
            marginRate: bolsaMaxMargin,
            marginAmount: marginValue,
            installmentAmount: marginValue,
            requestedAmount: loanEstimated,
            interestRate: bolsaInterestRate,
            installmentsCount: installments,
            status: "pre_approved",
            type: "bolsa_familia",
            createdAt: new Date().toISOString(),
            createdBy: userProfile ? userProfile.uid : "public",
            createdByName: userProfile ? userProfile.name : "Simulação Web Pública",
            observations: extraObs
          };
          
          setSimulationResult(simObj);
          return 100;
        }
        return prev + 15;
      });
    }, 150);
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
      setErrorMessage("Erro ao salvar simulação de forma persistente. Verifique a internet.");
      handleFirestoreError(e, OperationType.CREATE, "simulations");
    } finally {
      setLoadingSave(false);
    }
  };

  const downloadPDFProposal = () => {
    if (simulationResult) {
      generateSimulationPDF(simulationResult);
    }
  };

  const getWhatsAppLinkUrl = () => {
    if (!simulationResult) return "#";
    return generateWhatsAppLink(
      systemConfig?.whatsappNumber || "5511999999999",
      simulationResult.clientName,
      simulationResult.cpf,
      simulationResult.nis,
      simulationResult.benefitAmount,
      simulationResult.installmentAmount,
      simulationResult.requestedAmount,
      simulationResult.installmentsCount,
      "bolsa_familia"
    );
  };

  return (
    <div id="bolsa-simulator-parent" className="bg-[#0f172a] rounded-[32px] overflow-hidden shadow-2xl border border-white/10 transition-all duration-300">
      {/* Header com selo ouro */}
      <div className="bg-gradient-to-r from-[#020617] to-[#0f172a] p-8 text-white relative border-b border-white/10">
        <div className="absolute top-4 right-4 bg-yellow-500/10 text-yellow-500 text-xs px-3 py-1.5 rounded-full border border-yellow-500/25 flex items-center gap-1.5 font-medium">
          <Sparkles className="w-3.5 h-3.5 animate-spin" />
          Pre-Aprovação Bolsa+
        </div>
        <h3 className="text-2xl font-bold font-sans tracking-tight">Crédito Bolsa Família</h3>
        <p className="text-slate-400 text-sm mt-2 max-w-xl">
          Simule as parcelas e descubra o valor liberado com base no limite oficial de margem de {bolsaMaxMargin}%.
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
              {/* Nome Do Beneficiário */}
              <div>
                <label className="block text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">Nome Completo do Beneficiário</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Maria José de Oliveira"
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

              {/* NIS */}
              <div>
                <label className="block text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">NIS (Número de Identificação Social)</label>
                <input
                  type="text"
                  required
                  value={nis}
                  onChange={handleNisChange}
                  maxLength={14}
                  placeholder="000.00000.00-0"
                  className="w-full text-white bg-[#020617] border border-white/10 focus:border-yellow-500 px-4 py-3 rounded-xl transition duration-200 outline-none"
                />
              </div>

              {/* Telefone/WhatsApp */}
              <div>
                <label className="block text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">WhatsApp do Cliente</label>
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
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-white/10 pb-2">Parâmetros do Benefício & Requisitos Regulamentares</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Sliders de Valor de Benefício */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-semibold text-slate-300">Valor do Benefício Bolsa Família</span>
                    <span className="font-bold text-yellow-500">{formatCurrency(benefitAmount)}</span>
                  </div>
                  <input
                    type="range"
                    min="300"
                    max="1500"
                    step="50"
                    value={benefitAmount}
                    onChange={(e) => setBenefitAmount(Number(e.target.value))}
                    className="w-full accent-yellow-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>Mín: R$ 300</span>
                    <span>Máx: R$ 1.500</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">
                    *Renda assistencial mínima de R$ 300,00 para aprovação do microcrédito social assistido.
                  </p>
                </div>

                {/* Prazo */}
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Selecione o Prazo</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[6, 12, 18].map((months) => (
                      <button
                        key={months}
                        type="button"
                        onClick={() => setInstallments(months)}
                        className={`py-3 rounded-xl border text-sm font-bold transition duration-205 cursor-pointer ${
                          installments === months
                            ? "border-yellow-500 bg-yellow-500/10 text-yellow-500 font-extrabold"
                            : "border-white/10 bg-[#020617] hover:bg-white/5 text-slate-400"
                        }`}
                      >
                        {months} Meses
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Novas seções baseadas na primeira foto de requisitos de Bolsa Família */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/10">
                {/* Recebimento Caixa Tem */}
                <div>
                  <label className="block text-xs uppercase tracking-wider font-bold text-slate-400 mb-2.5">
                    Receber pelo aplicativo Caixa Tem?
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setReceivesByCaixaTem(true)}
                      className={`py-2 px-4 rounded-xl text-center text-xs font-bold border transition cursor-pointer ${
                        receivesByCaixaTem
                          ? "border-green-500 bg-green-500/10 text-green-450"
                          : "border-white/10 bg-[#020617] text-slate-400"
                      }`}
                    >
                      Sim (Padrão)
                    </button>
                    <button
                      type="button"
                      onClick={() => setReceivesByCaixaTem(false)}
                      className={`py-2 px-4 rounded-xl text-center text-xs font-bold border transition cursor-pointer ${
                        !receivesByCaixaTem
                          ? "border-red-500 bg-red-500/10 text-red-400"
                          : "border-white/10 bg-[#020617] text-slate-400"
                      }`}
                    >
                      Não / Outro
                    </button>
                  </div>
                  <span className="block text-[10px] text-slate-500 mt-1.5">
                    *O pagamento do empréstimo Bolsa+ é descontado diretamente e pago no aplicativo oficial.
                  </span>
                </div>

                {/* Tipo de Operação */}
                <div>
                  <label className="block text-xs uppercase tracking-wider font-bold text-slate-400 mb-2.5">
                    Tipo de Operação Recomendada
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setOperationType("novo")}
                      className={`py-2 px-4 rounded-xl text-center text-xs font-bold border transition cursor-pointer ${
                        operationType === "novo"
                          ? "border-yellow-500 bg-yellow-500/10 text-yellow-500"
                          : "border-white/10 bg-[#020617] text-slate-400"
                      }`}
                    >
                      Novo Contrato
                    </button>
                    <button
                      type="button"
                      onClick={() => setOperationType("refinanciamento")}
                      className={`py-2 px-4 rounded-xl text-center text-xs font-bold border transition cursor-pointer ${
                        operationType === "refinanciamento"
                          ? "border-yellow-500 bg-yellow-500/10 text-yellow-500"
                          : "border-white/10 bg-[#020617] text-slate-400"
                      }`}
                    >
                      Refinanciamento
                    </button>
                  </div>
                </div>
              </div>

              {/* Se for refinanciamento, mostrar pergunta sobre as 4 parcelas do segundo flyer */}
              {operationType === "refinanciamento" && (
                <div className="bg-yellow-500/5 p-4 rounded-xl border border-yellow-500/15 animate-fade-in">
                  <label className="block text-xs uppercase tracking-wider font-bold text-yellow-500 mb-2">
                    Já possui no mínimo 4 parcelas do contrato anterior pagas?
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-350 cursor-pointer">
                      <input
                        type="radio"
                        checked={refinancingHasFourPaidInstallments === true}
                        onChange={() => setRefinancingHasFourPaidInstallments(true)}
                        className="accent-yellow-500"
                      />
                      Sim, tenho pelo menos 4 pagas (Aprovado para Refinanciar)
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-350 cursor-pointer">
                      <input
                        type="radio"
                        checked={refinancingHasFourPaidInstallments === false}
                        onChange={() => setRefinancingHasFourPaidInstallments(false)}
                        className="accent-yellow-500"
                      />
                      Não, possuo menos de 4 parcelas pagas
                    </label>
                  </div>
                  <p className="text-[10px] text-slate-450 mt-1.5">
                    *Regra regulatória: A margem anterior precisa estar amortizada em no mínimo 4 prestações quitadas para renovação do saldo.
                  </p>
                </div>
              )}
            </div>

            {/* Observações opcionais para Colaboradores */}
            {userProfile && (
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Observações / Detalhes de Atendimento (Opcional)</label>
                <textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Insira detalhes adicionais sobre o atendimento ao cliente para controle interno."
                  className="w-full text-white bg-[#020617] border border-white/10 focus:border-yellow-500 px-4 py-3 rounded-xl transition duration-200 outline-none h-18 text-sm"
                />
              </div>
            )}

            {/* Live Indicator of calculations */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-yellow-500/5 rounded-2xl border border-yellow-500/20 gap-4">
              <div>
                <div className="text-xs font-bold text-yellow-500 uppercase tracking-wide">Margem Disponível Estimada ({bolsaMaxMargin}%)</div>
                <div className="text-2xl font-extrabold text-[#10B981] mt-1">{formatCurrency(marginValue)} /mês</div>
              </div>
              <div className="text-right md:text-left h-full flex flex-col justify-center">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Estimativa de Crédito Liberado</div>
                <div className="text-3xl font-black text-yellow-500 animate-pulse mt-0.5">{formatCurrency(loanEstimated)}</div>
              </div>
            </div>

            {/* Botão de Simulação */}
            <button
              type="submit"
              disabled={isSimulating}
              className="w-full glow-button bg-gradient-to-r from-gold-dark to-gold text-white font-sans font-bold py-4 rounded-xl shadow-lg hover:shadow-xl hover:opacity-95 transition-all text-center flex items-center justify-center gap-2 text-lg cursor-pointer"
            >
              {isSimulating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  Módulo de Inteligência Analisando Proposta ({progress}%) ...
                </>
              ) : (
                <>
                  <TrendingUp className="w-5 h-5" />
                  Efetuar Pré-Aprovação Inteligente
                </>
              )}
            </button>
          </form>
        ) : (
          /* RESULTADOS DA SIMULAÇÃO E PRÉ-APROVAÇÃO */
          <div className="space-y-6 animate-fade-in text-white">
            <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-3xl text-center">
              <div className="inline-flex items-center justify-center bg-green-500/20 text-green-400 rounded-full p-3 mb-3">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h4 className="text-2xl font-extrabold text-green-400">Crédito Pré-Aprovado Instântaneo!</h4>
              <p className="text-xs text-green-500/80 font-medium mt-1 uppercase tracking-widest leading-relaxed">
                Algoritmo Inteligente JR Crédito & Soluções Financeiras
              </p>
            </div>

            <div className="bg-[#020617] rounded-2xl border border-white/5 p-6 space-y-4">
              <h5 className="font-bold text-white border-b border-white/10 pb-2 mb-3">Resumo da Simulação Bolsa+</h5>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#0f172a] p-4 rounded-xl border border-white/5 text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Beneficiário</div>
                  <div className="text-xs font-extrabold text-slate-300 truncate mt-1">{simulationResult.clientName}</div>
                </div>
                <div className="bg-[#0f172a] p-4 rounded-xl border border-white/5 text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-500">CPF</div>
                  <div className="text-xs font-extrabold text-slate-300 mt-1">{formatCPF(simulationResult.cpf)}</div>
                </div>
                <div className="bg-[#0f172a] p-4 rounded-xl border border-white/5 text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Margem Consignável</div>
                  <div className="text-xs font-extrabold text-[#10B981] mt-1">{formatCurrency(simulationResult.marginAmount)}</div>
                </div>
                <div className="bg-[#0f172a] p-4 rounded-xl border border-white/5 text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Taxa de Juros</div>
                  <div className="text-xs font-extrabold text-slate-300 mt-1">{simulationResult.interestRate}% a.m.</div>
                </div>
              </div>

              {/* Quadro Destaque Principal de liberação */}
              <div className="bg-gradient-to-br from-dark-primary to-[#0f172a] rounded-2xl text-white p-6 relative overflow-hidden border border-yellow-500/20">
                <div className="absolute -right-4 -bottom-4 bg-yellow-500/5 rounded-full w-32 h-32 blur-xl" />
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <span className="text-xs uppercase font-extrabold text-yellow-500 tracking-widest">Valor Estimado Líquido para Saque</span>
                    <h5 className="text-4xl font-extrabold text-white mt-1 font-mono">{formatCurrency(simulationResult.requestedAmount)}</h5>
                  </div>
                  <div className="md:text-right bg-white/5 border border-white/10 p-3 rounded-xl backdrop-blur-sm self-stretch flex flex-col justify-center">
                    <span className="text-[10px] uppercase text-slate-300 font-bold">Parcela do Empréstimo</span>
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
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-750 text-white font-bold py-3.5 px-4 rounded-xl transition duration-200 text-center cursor-pointer shadow-lg shadow-green-500/10"
              >
                <Smartphone className="w-5 h-5" />
                Formalizar no WhatsApp
              </a>
            </div>

            {/* Persistence & Salvar no Firestore */}
            <div className="bg-[#020617] p-6 rounded-2xl border border-white/5 space-y-4">
              <div>
                <h6 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Deseja Registrar este lead de forma segura?</h6>
                <p className="text-slate-500 text-xs mt-1">
                  Guarde de forma persistente os dados deste cliente no Firestore para monitorar o status administrativo no seu painel.
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
                  className="bg-yellow-600 hover:bg-yellow-500 text-[#020617] font-bold py-3 px-6 rounded-xl transition text-xs shadow-md shadow-yellow-500/5 inline-flex items-center gap-2 cursor-pointer"
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
