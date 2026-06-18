import React, { useState, useEffect } from "react";
import { formatCurrency, formatCPF, formatPhone, calculateLoanAmount, generateWhatsAppLink, validateCPF, cleanNumber } from "../utils/helpers";
import { generateSimulationPDF } from "../utils/pdfGenerator";
import { Simulation, SystemConfig } from "../types";
import { addDoc, collection } from "firebase/firestore";
import { db } from "../firebase";
import { handleFirestoreError, OperationType } from "../utils/firebaseErrorHandler";
import { FileText, Smartphone, TrendingUp, AlertCircle, ShieldAlert, Sparkles, CheckCircle, Briefcase } from "lucide-react";

interface CltSimulatorProps {
  systemConfig: SystemConfig;
  userProfile?: any;
  onSimulationSaved?: (sim: Simulation) => void;
}

export default function CltSimulator({ systemConfig, userProfile, onSimulationSaved }: CltSimulatorProps) {
  // Form fields
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [salaryAmount, setSalaryAmount] = useState(2500); // Salário médio inicial real
  const [installments, setInstallments] = useState(48); // Padrão: 48 meses
  const [marginOption, setMarginOption] = useState<"standard" | "full">("standard"); // Standard is 30% loan, Full includes cards (35%)
  const [observations, setObservations] = useState("");

  // Simulation results
  const [marginRate, setMarginRate] = useState(30);
  const [marginValue, setMarginValue] = useState(0);
  const [loanEstimated, setLoanEstimated] = useState(0);
  const [isCpfValid, setIsCpfValid] = useState<boolean | null>(null);

  // UI States
  const [progress, setProgress] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<Simulation | null>(null);
  const [loadingSave, setLoadingSave] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // CLT interest rate (médias de 2.5% a 4.5%, padrão 3.45% a.m.)
  const cltInterestRate = 3.45;

  // Real-time calculations
  useEffect(() => {
    // Standard loan margin is 30%, Full combined is 35%
    const rate = marginOption === "full" ? 35 : 30;
    setMarginRate(rate);

    const margin = salaryAmount * (rate / 100);
    setMarginValue(margin);

    // Calculo do montante liberado
    const calculatedLoan = calculateLoanAmount(margin, cltInterestRate, installments);
    setLoanEstimated(calculatedLoan);
  }, [salaryAmount, installments, marginOption, cltInterestRate]);

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

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  const handleSimulate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!name.trim()) return setErrorMessage("Por favor, preencha o nome do trabalhador CLT.");
    if (cleanNumber(cpf).length !== 11) return setErrorMessage("O CPF deve conter exatamente 11 dígitos.");
    if (isCpfValid === false) return setErrorMessage("CPF inválido.");
    if (cleanNumber(phone).length < 10) return setErrorMessage("Preencha um número de celular válido para contato.");

    setIsSimulating(true);
    setProgress(0);
    setSimulationResult(null);

    // Animação Analítica IA
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
            benefitAmount: salaryAmount,
            marginRate: marginRate,
            marginAmount: marginValue,
            installmentAmount: marginValue,
            requestedAmount: loanEstimated,
            interestRate: cltInterestRate,
            installmentsCount: installments,
            status: "pre_approved",
            type: "clt",
            createdAt: new Date().toISOString(),
            createdBy: userProfile ? userProfile.uid : "public",
            createdByName: userProfile ? userProfile.name : "Simulação Web Pública",
            observations: observations
          };

          setSimulationResult(simObj);
          return 100;
        }
        return prev + 20;
      });
    }, 120);
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
      setErrorMessage("Erro de conexão ao salvar simulação de forma persistente.");
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
      undefined,
      simulationResult.benefitAmount,
      simulationResult.installmentAmount,
      simulationResult.requestedAmount,
      simulationResult.installmentsCount,
      "clt"
    );
  };

  return (
    <div id="clt-simulator-parent" className="bg-[#0f172a] rounded-[32px] overflow-hidden shadow-2xl border border-white/10 transition-all duration-300">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#020617] to-[#0f172a] p-8 text-white relative border-b border-white/10">
        <div className="absolute top-4 right-4 bg-indigo-500/15 text-indigo-400 text-xs px-3 py-1.5 rounded-full border border-indigo-500/25 flex items-center gap-1.5 font-medium animate-pulse">
          <Briefcase className="w-3.5 h-3.5" />
          Pre-Aprovação CLT Privado
        </div>
        <h3 className="text-2xl font-bold font-sans tracking-tight">Consignado CLT Privado</h3>
        <p className="text-slate-400 text-sm mt-2 max-w-xl">
          Simule as condições exclusivas de juros para funcionários da iniciativa privada sob formato de convênio folha de pagamento.
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
                <label className="block text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">Nome Completo do Colaborador (CLT)</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Carlos Eduardo de Oliveira"
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
                <label className="block text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">WhatsApp do Cliente para Retorno</label>
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

            {/* Opções de Margem CLT */}
            <div>
              <label className="block text-xs uppercase tracking-wider font-bold text-slate-400 mb-3">Linha de Margem Consignável CLT</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setMarginOption("standard")}
                  className={`p-4 rounded-xl border text-left transition duration-200 focus:outline-none ${
                    marginOption === "standard"
                      ? "border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500"
                      : "border-white/10 bg-[#020617] hover:bg-white/5"
                  }`}
                >
                  <div className="font-bold text-slate-200 text-sm">Margem Empréstimo Padrão (30%)</div>
                  <div className="text-[11px] text-slate-400 mt-1">Limite focado em parcelamento tradicional em folha de pagamento.</div>
                </button>

                <button
                  type="button"
                  onClick={() => setMarginOption("full")}
                  className={`p-4 rounded-xl border text-left transition duration-200 focus:outline-none ${
                    marginOption === "full"
                      ? "border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500"
                      : "border-white/10 bg-[#020617] hover:bg-white/5"
                  }`}
                >
                  <div className="font-bold text-slate-200 text-sm">Margem Combinada com Cartão Consignado (35%)</div>
                  <div className="text-[11px] text-slate-400 mt-1">Soma 30% em folha + 5% reservado para saques emergenciais ou cartão.</div>
                </button>
              </div>
            </div>

            <div className="bg-[#020617] p-6 rounded-2xl border border-white/5 space-y-6">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-white/10 pb-2">Parâmetros de Renda Líquida CLT</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Sliders de Salário CLT */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-semibold text-slate-300">Salário / Renda Líquida</span>
                    <span className="font-bold text-indigo-400">{formatCurrency(salaryAmount)}</span>
                  </div>
                  <input
                    type="range"
                    min="1412"
                    max="15000"
                    step="100"
                    value={salaryAmount}
                    onChange={(e) => setSalaryAmount(Number(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>Mín: R$ 1.412</span>
                    <span>Máx: R$ 15.000</span>
                  </div>
                </div>

                {/* Selecione o Prazo CLT */}
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Selecione o Prazo (Até 96 meses)</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[24, 48, 72, 84, 96].map((months) => (
                      <button
                        key={months}
                        type="button"
                        onClick={() => setInstallments(months)}
                        className={`py-3 rounded-xl border text-xs font-bold transition duration-200 cursor-pointer ${
                          installments === months
                            ? "border-indigo-500 bg-indigo-500/10 text-indigo-400 font-extrabold"
                            : "border-white/10 bg-[#020617] hover:bg-white/5 text-slate-400"
                        }`}
                      >
                        {months}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Observações opcionais */}
            {userProfile && (
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Dados de Convênio e CNPJ da Empresa (Opcional)</label>
                <textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Ex: Empresa Conveniada S/A, CNPJ 12.345.678/0001-90, Departamento de RH parceiro."
                  className="w-full text-white bg-[#020617] border border-white/10 focus:border-indigo-500 px-4 py-3 rounded-xl transition duration-200 outline-none h-18 text-sm"
                />
              </div>
            )}

            {/* Live Indicator */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-indigo-500/5 rounded-2xl border border-indigo-500/20 gap-4">
              <div>
                <div className="text-xs font-bold text-indigo-400 uppercase tracking-wide font-sans">Margem Consignada do Salário ({marginRate}%)</div>
                <div className="text-2xl font-extrabold text-[#10B981] mt-1">{formatCurrency(marginValue)} <span className="text-xs text-white">/mês</span></div>
              </div>
              <div className="text-right md:text-left h-full flex flex-col justify-center">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Estimativa de Crédito Liberado</div>
                <div className="text-3xl font-black text-indigo-400 animate-pulse mt-0.5">{formatCurrency(loanEstimated)}</div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSimulating}
              className="w-full glow-button bg-gradient-to-r from-indigo-700 to-indigo-500 text-white font-sans font-bold py-4 rounded-xl shadow-lg hover:shadow-xl hover:opacity-95 transition-all text-center flex items-center justify-center gap-2 text-lg cursor-pointer"
            >
              {isSimulating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  Módulo de Inteligência Analisando Proposta CLT ({progress}%) ...
                </>
              ) : (
                <>
                  <TrendingUp className="w-5 h-5" />
                  Efetuar Pré-Aprovação Inteligente CLT
                </>
              )}
            </button>
          </form>
        ) : (
          /* RESULTADOS */
          <div className="space-y-6 animate-fade-in text-white animate-fade-in">
            <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-3xl text-center">
              <div className="inline-flex items-center justify-center bg-green-500/20 text-green-400 rounded-full p-3 mb-3">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h4 className="text-2xl font-extrabold text-green-400">Crédito Pré-Aprovado CLT!</h4>
              <p className="text-xs text-green-500/80 font-medium mt-1 uppercase tracking-widest leading-relaxed">
                Algoritmo de Análise JR - Seguro & Crédito Consignado Privado
              </p>
            </div>

            <div className="bg-[#020617] rounded-xl border border-white/5 p-6 space-y-4">
              <h5 className="font-bold text-white border-b border-white/10 pb-2 mb-3">Resumo da Simulação CLT</h5>
              
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
                  <div className="text-[10px] uppercase font-bold text-slate-500">Margem Consignada</div>
                  <div className="text-xs font-extrabold text-[#10B981] mt-1">{formatCurrency(simulationResult.marginAmount)}</div>
                </div>
                <div className="bg-[#0f172a] p-4 rounded-xl border border-white/5 text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Taxa de Juros (Média)</div>
                  <div className="text-xs font-extrabold text-slate-300 mt-1">{simulationResult.interestRate}% a.m.</div>
                </div>
              </div>

              {/* Destaque de liberação */}
              <div className="bg-gradient-to-br from-[#020617] to-[#0f172a] rounded-2xl text-white p-6 relative overflow-hidden border border-indigo-500/20">
                <div className="absolute -right-4 -bottom-4 bg-indigo-500/5 rounded-full w-32 h-32 blur-xl" />
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <span className="text-xs uppercase font-extrabold text-indigo-400 tracking-widest">Valor Estimado Líquido para Liberação</span>
                    <h5 className="text-4xl font-extrabold text-white mt-1 font-mono">{formatCurrency(simulationResult.requestedAmount)}</h5>
                  </div>
                  <div className="md:text-right bg-white/5 border border-white/10 p-3 rounded-xl backdrop-blur-sm self-stretch flex flex-col justify-center">
                    <span className="text-[10px] uppercase text-slate-300 font-bold">Dedução em Folha</span>
                    <span className="text-lg font-black text-indigo-400">{formatCurrency(simulationResult.installmentAmount)} <span className="text-xs text-white">/mês</span></span>
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
                className="w-full flex items-center justify-center gap-2 bg-green-650 hover:bg-green-750 text-white font-bold py-3.5 px-4 rounded-xl transition duration-200 text-center cursor-pointer shadow-lg shadow-green-500/10"
              >
                <Smartphone className="w-5 h-5" />
                Formalizar no WhatsApp
              </a>
            </div>

            {/* Registrar no Firestore */}
            <div className="bg-[#020617] p-6 rounded-2xl border border-white/5 space-y-4">
              <div>
                <h6 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Acompanhar este lead de forma segura?</h6>
                <p className="text-slate-500 text-xs mt-1">
                  Guarde os dados deste colaborador no Firestore para garantir o faturamento e comissionamento.
                </p>
              </div>

              {saveSuccess ? (
                <div className="bg-green-500/10 text-green-400 px-4 py-3 rounded-lg text-xs font-bold border border-green-500/20 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Lead registrado e salvo no sistema em tempo real!
                </div>
              ) : (
                <button
                  onClick={saveSimulationToDb}
                  disabled={loadingSave}
                  className="bg-[#312e81] hover:bg-indigo-900 text-white font-bold py-3 px-6 rounded-xl transition text-xs shadow-md inline-flex items-center gap-2 cursor-pointer"
                >
                  {loadingSave ? "Registrando..." : "Registrar e Salvar Simulação CLT"}
                </button>
              )}
            </div>

            {/* Voltar */}
            <div className="text-center">
              <button
                onClick={() => {
                  setSimulationResult(null);
                  setSaveSuccess(false);
                }}
                className="text-indigo-400 hover:text-indigo-300 text-sm font-semibold underline decoration-dotted tracking-wide cursor-pointer"
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
