import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, query, where, onSnapshot, doc, addDoc, updateDoc, getDocs, getDoc } from "firebase/firestore";
import { Simulation, UserProfile, SystemConfig, SimulationStatus } from "../types";
import { formatCurrency, formatCPF, cleanNumber, formatPhone, generateWhatsAppLink, calculateLoanAmount } from "../utils/helpers";
import { handleFirestoreError, OperationType } from "../utils/firebaseErrorHandler";
import BolsaSimulator from "./BolsaSimulator";
import InssSimulator from "./InssSimulator";
import FgtsSimulator from "./FgtsSimulator";
import LuzSimulator from "./LuzSimulator";
import CltSimulator from "./CltSimulator";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { 
  FileText, 
  Calculator, 
  Users, 
  HelpCircle, 
  User, 
  Award, 
  Smartphone, 
  TrendingUp, 
  Download, 
  Sparkles, 
  AlertCircle, 
  Plus, 
  Search, 
  Clock, 
  Briefcase, 
  History, 
  CheckCircle2, 
  X, 
  ChevronRight, 
  DollarSign,
  Scale,
  BookOpen
} from "lucide-react";

interface ColaboradorPanelProps {
  userProfile: UserProfile;
  systemConfig: SystemConfig;
}

export default function ColaboradorPanel({ userProfile, systemConfig }: ColaboradorPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<"stats" | "credit_consult" | "simulate_bolsa" | "simulate_inss" | "simulate_fgts" | "simulate_luz" | "simulate_clt" | "customers">("stats");
  const [mySimulations, setMySimulations] = useState<Simulation[]>([]);
  const [loading, setLoading] = useState(true);

  // Client Management State (CRM)
  const [clientsList, setClientsList] = useState<{name: string, cpf: string, phone: string, count: number}[]>([]);
  const [searchClientQuery, setSearchClientQuery] = useState("");
  const [selectedClientCpf, setSelectedClientCpf] = useState<string | null>(null);
  
  // Create client form
  const [showAddClient, setShowAddClient] = useState(false);
  const [cName, setCName] = useState("");
  const [cCpf, setCCpf] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cFeedback, setCFeedback] = useState("");
  const [cIsSaving, setCIsSaving] = useState(false);

  // Credit consultation Calculator Tab State
  const [creditName, setCreditName] = useState("");
  const [creditCpf, setCreditCpf] = useState("");
  const [creditPhone, setCreditPhone] = useState("");
  const [creditType, setCreditType] = useState<"bolsa_familia" | "inss">("bolsa_familia");
  const [creditBenefit, setCreditBenefit] = useState<number>(600);
  const [creditNetMargin, setCreditNetMargin] = useState<number>(0);
  const [creditInstallments, setCreditInstallments] = useState<number>(36);
  const [creditFeedback, setCreditFeedback] = useState("");
  const [creditIsSaving, setCreditIsSaving] = useState(false);

  // Props Lookup State on Dashboard
  const [dashSearchVal, setDashSearchVal] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchedSimResult, setSearchedSimResult] = useState<Simulation | null>(null);
  const [searchError, setSearchError] = useState("");

  // Local storage lists for consulted proposals (todas as propostas já consultadas)
  const [consultedProposals, setConsultedProposals] = useState<Simulation[]>([]);

  // Load consulted proposals key history from local storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`jr_consulted_sims_${userProfile.uid}`);
      if (saved) {
        setConsultedProposals(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Erro ao ler propostas consultadas do localStorage: ", e);
    }
  }, [userProfile.uid]);

  // Sync / Real-time Simulations Created by This Collaborator
  useEffect(() => {
    setLoading(true);
    const simRef = collection(db, "simulations");
    const q = query(simRef, where("createdBy", "==", userProfile.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Simulation[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Simulation);
      });
      // Order newest first
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setMySimulations(list);

      // Derive distinct clients from simulations
      const clientMap: { [cpf: string]: { name: string, phone: string, count: number } } = {};
      list.forEach((sim) => {
        const cleanCpf = cleanNumber(sim.cpf);
        if (cleanCpf) {
          if (!clientMap[cleanCpf]) {
            clientMap[cleanCpf] = { name: sim.clientName, phone: sim.phone, count: 0 };
          }
          clientMap[cleanCpf].count += 1;
        }
      });

      const derivedClients = Object.keys(clientMap).map((cpf) => ({
        cpf,
        name: clientMap[cpf].name,
        phone: clientMap[cpf].phone,
        count: clientMap[cpf].count,
      }));
      setClientsList(derivedClients);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "simulations");
    });

    return () => unsubscribe();
  }, [userProfile.uid]);

  // Add simulation/proposal to consulted list inside local history
  const addProposalToConsultedList = (sim: Simulation) => {
    setConsultedProposals((prev) => {
      const exists = prev.some((p) => p.id === sim.id);
      if (exists) return prev;
      const updated = [sim, ...prev].slice(0, 15); // keep last 15 consulted
      try {
        localStorage.setItem(`jr_consulted_sims_${userProfile.uid}`, JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  };

  // Clear consulted history
  const clearConsultedHistory = () => {
    setConsultedProposals([]);
    try {
      localStorage.removeItem(`jr_consulted_sims_${userProfile.uid}`);
    } catch (e) {
      console.error(e);
    }
  };

  // Lookup proposal globally anywhere in the database (by CPF or by ID)
  const handleGlobalProposalSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError("");
    setSearchedSimResult(null);
    const term = dashSearchVal.trim();
    if (!term) {
      setSearchError("Insira um CPF ou ID de proposta para consultar.");
      return;
    }

    setSearchLoading(true);
    try {
      const simulationsRef = collection(db, "simulations");
      let found: Simulation | null = null;

      // 1. Try search as direct Document ID
      if (term.toUpperCase().startsWith("SIM_") || term.length > 15) {
        const docRef = doc(db, "simulations", term);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          found = { id: docSnap.id, ...docSnap.data() } as Simulation;
        }
      }

      // 2. Try search by CPF
      if (!found) {
        const cleanCpf = cleanNumber(term);
        if (cleanCpf.length === 11) {
          const qCpf = query(simulationsRef, where("cpf", "==", cleanCpf));
          const querySnap = await getDocs(qCpf);
          if (!querySnap.empty) {
            const firstDoc = querySnap.docs[0];
            found = { id: firstDoc.id, ...firstDoc.data() } as Simulation;
          }
        }
      }

      if (found) {
        setSearchedSimResult(found);
        addProposalToConsultedList(found);
      } else {
        setSearchError("Nenhuma proposta ou cadastro localizado no sistema com esse identificador.");
      }
    } catch (err: any) {
      console.error("Erro na busca de proposta:", err);
      setSearchError("Falha na permissão ou erro de conexão. Tente novamente.");
    } finally {
      setSearchLoading(false);
    }
  };

  // Handle manual customer registration and store in Firestore simulations as a Lead/prospect
  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setCFeedback("");
    const cleanCpfVal = cleanNumber(cCpf);
    const cleanPhoneVal = cleanNumber(cPhone);

    if (!cName.trim() || cleanCpfVal.length !== 11 || cleanPhoneVal.length < 10) {
      setCFeedback("Preencha todos os campos corretamente com dados válidos.");
      return;
    }

    setCIsSaving(true);
    try {
      // Calculate realistic proposal placeholder layout
      const defaultBolsaMargin = systemConfig?.bolsaMaxMargin || 35;
      const defaultBolsaInterest = systemConfig?.bolsaInterestRate || 2.45;
      const defaultMarginAmt = 600 * (defaultBolsaMargin / 100);
      const estLoan = calculateLoanAmount(defaultMarginAmt, defaultBolsaInterest, 36);

      const simId = "SIM_" + Math.random().toString(36).substr(2, 9).toUpperCase();
      const simObj = {
        clientName: cName.trim(),
        cpf: cleanCpfVal,
        phone: formatPhone(cPhone),
        benefitAmount: 600,
        marginRate: defaultBolsaMargin,
        marginAmount: defaultMarginAmt,
        installmentAmount: defaultMarginAmt,
        requestedAmount: estLoan,
        interestRate: defaultBolsaInterest,
        installmentsCount: 36,
        status: "pending" as SimulationStatus,
        type: "bolsa_familia",
        createdAt: new Date().toISOString(),
        createdBy: userProfile.uid,
        createdByName: userProfile.name,
        observations: "Cliente pré-cadastrado no CRM de atendimento (Proposta de Prospecção Inicial)."
      };

      // Create doc in simulations collection in Firestore
      await addDoc(collection(db, "simulations"), simObj);

      setCFeedback(`Cliente "${cName}" registrado com sucesso em nuvem com alta durabilidade.`);
      setCName("");
      setCCpf("");
      setCPhone("");
      setTimeout(() => {
        setShowAddClient(false);
        setCFeedback("");
      }, 3000);
    } catch (err: any) {
      console.error(err);
      setCFeedback("Erro ao tentar persistir dados de CRM no banco.");
      handleFirestoreError(err, OperationType.CREATE, "simulations");
    } finally {
      setCIsSaving(false);
    }
  };

  // Save Proposal Directly from available credits check
  const handleSaveCreditAsProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreditFeedback("");
    const cleanCpfVal = cleanNumber(creditCpf);
    
    if (!creditName.trim() || cleanCpfVal.length !== 11 || cleanNumber(creditPhone).length < 10) {
      setCreditFeedback("Por favor, preencha o Nome, CPF e Celular válidos do cliente para consolidar a simulação.");
      return;
    }

    setCreditIsSaving(true);
    try {
      // Rates and margins configured
      const marginRate = creditType === "bolsa_familia" ? (systemConfig?.bolsaMaxMargin || 35) : (systemConfig?.inssMaxMargin || 45);
      const interestRate = creditType === "bolsa_familia" ? (systemConfig?.bolsaInterestRate || 2.45) : (systemConfig?.inssInterestRate || 1.84);
      
      let finalMargin = 0;
      if (creditType === "bolsa_familia") {
        finalMargin = creditBenefit * (marginRate / 100);
      } else {
        // INSS can consult by Net Margin or calculate from Benefit
        finalMargin = creditNetMargin > 0 ? creditNetMargin : (creditBenefit * (marginRate / 100));
      }

      const calculatedEstimatedLoan = calculateLoanAmount(finalMargin, interestRate, creditInstallments);

      const simId = "SIM_" + Math.random().toString(36).substr(2, 9).toUpperCase();
      const simObj = {
        clientName: creditName.trim(),
        cpf: cleanCpfVal,
        phone: formatPhone(creditPhone),
        benefitAmount: creditBenefit,
        marginRate: marginRate,
        marginAmount: finalMargin,
        installmentAmount: finalMargin,
        requestedAmount: calculatedEstimatedLoan,
        interestRate: interestRate,
        installmentsCount: creditInstallments,
        status: "pre_approved" as SimulationStatus,
        type: creditType,
        createdAt: new Date().toISOString(),
        createdBy: userProfile.uid,
        createdByName: userProfile.name,
        observations: `Pre-atendimento de Crédito Disponível. Margem Líquida Consultada: R$ ${finalMargin.toFixed(2)}.`
      };

      await addDoc(collection(db, "simulations"), simObj);
      setCreditFeedback(`Simulação de Crédito gerada com sucesso sob o ID: ${simId}. Proposta salva na carteira do cliente.`);
      
      // Reset inputs
      setCreditName("");
      setCreditCpf("");
      setCreditPhone("");
      
      // Auto switch to dashboard or customers to view
      setTimeout(() => {
        setCreditFeedback("");
        setActiveSubTab("stats");
      }, 3500);

    } catch (err: any) {
      console.error(err);
      setCreditFeedback("Erro ao tentar persistir simulação de margem em nuvem.");
      handleFirestoreError(err, OperationType.CREATE, "simulations");
    } finally {
      setCreditIsSaving(false);
    }
  };

  // Export pipeline logs to CSV
  const handleExportCSV = () => {
    if (mySimulations.length === 0) return;
    
    // Headers
    const headers = ["ID", "Cliente", "CPF", "Tipo", "Prazo (Meses)", "Parcela", "Valor Liberado", "Status", "Data"];
    
    const rows = mySimulations.map((sim) => [
      sim.id || "N/A",
      sim.clientName,
      sim.cpf,
      sim.type === "bolsa_familia" ? "Bolsa Familia" : "INSS",
      sim.installmentsCount.toString(),
      sim.installmentAmount.toFixed(2),
      sim.requestedAmount.toFixed(2),
      sim.status,
      new Date(sim.createdAt).toLocaleDateString("pt-BR")
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `carteira_corretor_jr_${userProfile.name.toLowerCase().replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Math KPI Calculations
  const totalMySimulated = mySimulations.reduce((sum, s) => sum + s.requestedAmount, 0);
  const totalMyContracted = mySimulations.filter(s => s.status === "contracted").reduce((sum, s) => sum + s.requestedAmount, 0);
  const myCommissionRate = userProfile?.commissionRate || 1.5; // default collaborator commission is 1.5%
  const estimatedCommissionCollected = totalMyContracted * (myCommissionRate / 100);

  // Group counts by type
  const inssSimsCount = mySimulations.filter(s => s.type === "inss").length;
  const bolsaSimsCount = mySimulations.filter(s => s.type === "bolsa_familia").length;

  // Chart structures
  const statusGrouping = mySimulations.reduce((acc: any, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {});

  const myChartData = [
    { name: "Pendente", propostas: statusGrouping["pending"] || 0 },
    { name: "Pré-Aprovado", propostas: statusGrouping["pre_approved"] || 0 },
    { name: "Aprovado", propostas: statusGrouping["approved"] || 0 },
    { name: "Contratado", propostas: statusGrouping["contracted"] || 0 },
  ];

  const filteredClients = clientsList.filter((c) => 
    c.name.toLowerCase().includes(searchClientQuery.toLowerCase()) || c.cpf.includes(searchClientQuery)
  );

  // Filter custom history of one specific client CPF in CRM
  const getSimulationsForCpf = (cpf: string) => {
    return mySimulations.filter(s => cleanNumber(s.cpf) === cleanNumber(cpf));
  };

  // Calculations for quick margin/credit checker tab
  const activeMarginRate = creditType === "bolsa_familia" ? (systemConfig?.bolsaMaxMargin || 35) : (systemConfig?.inssMaxMargin || 45);
  const activeInterestRate = creditType === "bolsa_familia" ? (systemConfig?.bolsaInterestRate || 2.45) : (systemConfig?.inssInterestRate || 1.84);
  
  const computedMarginVal = creditType === "bolsa_familia" 
    ? (creditBenefit * (activeMarginRate / 100))
    : (creditNetMargin > 0 ? creditNetMargin : (creditBenefit * (activeMarginRate / 100)));
    
  const computedLoanAmt = calculateLoanAmount(computedMarginVal, activeInterestRate, creditInstallments);

  return (
    <div id="colab-panel-parent" className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar Corretor */}
      <aside className="w-full md:w-64 bg-slate-900 text-white shrink-0 p-6 flex flex-col">
        {/* Identidade Logo */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-5 mb-6">
          <div className="bg-gradient-to-tr from-amber-500 to-amber-400 w-9 h-9 rounded-lg flex items-center justify-center font-bold text-slate-905 text-base shadow-lg text-slate-950">
            JR
          </div>
          <div>
            <span className="text-sm font-black text-amber-400 tracking-wider block">JR CRÉDITO</span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Canal de Vendas</span>
          </div>
        </div>

        {/* Perfil Corretor com Comissão */}
        <div className="bg-slate-850 bg-slate-800/60 rounded-xl p-4 border border-amber-400/15 mb-6 space-y-3">
          <div className="flex items-center gap-2.5 text-sm">
            <User className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="truncate">
              <div className="font-extrabold text-slate-100 truncate">{userProfile.name}</div>
              <div className="text-[10px] text-amber-400 font-bold uppercase">Corretor Autorizado</div>
            </div>
          </div>
          {/* Tag de Comissão */}
          <div className="bg-amber-400/10 border border-amber-400/20 p-2 rounded-lg text-center flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-300">Sua comissão:</span>
            <span className="text-xs font-black text-amber-400">{myCommissionRate.toFixed(1)}%</span>
          </div>
        </div>

        {/* Navigation Corretor */}
        <nav className="space-y-1.5 flex-1">
          <button
            onClick={() => {
              setActiveSubTab("stats");
              setSelectedClientCpf(null);
            }}
            className={`w-full text-left py-3 px-4 rounded-xl text-sm font-bold flex items-center gap-3 transition cursor-pointer ${
              activeSubTab === "stats" ? "bg-amber-400 text-slate-950 font-extrabold shadow-md" : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Métricas e Dashboard
          </button>

          <button
            onClick={() => {
              setActiveSubTab("credit_consult");
              setSelectedClientCpf(null);
            }}
            className={`w-full text-left py-3 px-4 rounded-xl text-sm font-bold flex items-center gap-3 transition cursor-pointer ${
              activeSubTab === "credit_consult" ? "bg-amber-400 text-slate-950 font-extrabold shadow-md" : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Scale className="w-4 h-4" />
            Créditos Disponíveis
          </button>

          <button
            onClick={() => {
              setActiveSubTab("simulate_bolsa");
              setSelectedClientCpf(null);
            }}
            className={`w-full text-left py-3 px-4 rounded-xl text-sm font-bold flex items-center gap-3 transition cursor-pointer ${
              activeSubTab === "simulate_bolsa" ? "bg-amber-400 text-slate-950 font-extrabold shadow-md" : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Calculator className="w-4 h-4" />
            Simulador Bolsa+
          </button>

          <button
            onClick={() => {
              setActiveSubTab("simulate_inss");
              setSelectedClientCpf(null);
            }}
            className={`w-full text-left py-3 px-4 rounded-xl text-sm font-bold flex items-center gap-3 transition cursor-pointer ${
              activeSubTab === "simulate_inss" ? "bg-amber-400 text-slate-950 font-extrabold shadow-md" : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Calculator className="w-4 h-4" />
            Simulador INSS
          </button>

          <button
            onClick={() => {
              setActiveSubTab("simulate_fgts");
              setSelectedClientCpf(null);
            }}
            className={`w-full text-left py-3 px-4 rounded-xl text-sm font-bold flex items-center gap-3 transition cursor-pointer ${
              activeSubTab === "simulate_fgts" ? "bg-amber-400 text-slate-950 font-extrabold shadow-md" : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Calculator className="w-4 h-4" />
            Simulador FGTS
          </button>

          <button
            onClick={() => {
              setActiveSubTab("simulate_luz");
              setSelectedClientCpf(null);
            }}
            className={`w-full text-left py-3 px-4 rounded-xl text-sm font-bold flex items-center gap-3 transition cursor-pointer ${
              activeSubTab === "simulate_luz" ? "bg-amber-400 text-slate-950 font-extrabold shadow-md" : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Calculator className="w-4 h-4" />
            Simulador Conta de Luz
          </button>

          <button
            onClick={() => {
              setActiveSubTab("simulate_clt");
              setSelectedClientCpf(null);
            }}
            className={`w-full text-left py-3 px-4 rounded-xl text-sm font-bold flex items-center gap-3 transition cursor-pointer ${
              activeSubTab === "simulate_clt" ? "bg-amber-400 text-slate-950 font-extrabold shadow-md" : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Calculator className="w-4 h-4" />
            Simulador CLT Privado
          </button>

          <button
            onClick={() => {
              setActiveSubTab("customers");
              setSelectedClientCpf(null);
            }}
            className={`w-full text-left py-3 px-4 rounded-xl text-sm font-bold flex items-center gap-3 transition cursor-pointer ${
              activeSubTab === "customers" ? "bg-amber-400 text-slate-950 font-extrabold shadow-md" : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Users className="w-4 h-4" />
            Meus Clientes / CRM
          </button>
        </nav>
      </aside>

      {/* Main Content Workspace */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        {loading ? (
          <div className="h-96 flex flex-col justify-center items-center gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-amber-500 border-t-transparent" />
            <p className="text-slate-500 text-sm font-medium">Atualizando workspace em tempo real...</p>
          </div>
        ) : (
          <>
            {/* SUB TAB 1: DASHBOARD METRICAS */}
            {activeSubTab === "stats" && (
              <div className="space-y-8 animate-fade-in">
                {/* Header do painel */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Painel Executivo de Vendas</h3>
                    <p className="text-slate-500 text-sm">Controle completo de propostas consultadas e conversões do corretor.</p>
                  </div>
                  
                  {mySimulations.length > 0 && (
                    <button
                      onClick={handleExportCSV}
                      className="bg-slate-850 bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 shadow-sm transition cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-amber-400" />
                      Exportar Minhas Propostas (CSV)
                    </button>
                  )}
                </div>

                {/* Grid KPI de comissão */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Estimativa de Comissão */}
                  <div className="bg-slate-900 text-white p-6 rounded-3xl border border-amber-400/20 shadow flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute right-3 top-3 bg-amber-400/10 text-amber-400 text-[9px] font-bold px-2.5 py-1 rounded-md border border-amber-400/25 flex items-center gap-1">
                      <Award className="w-3.5 h-3.5" />
                      Sua Carteira
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Estimativa de Comissão</span>
                      <h4 className="text-3xl font-black text-amber-400">{formatCurrency(estimatedCommissionCollected)}</h4>
                      <p className="text-[10px] text-slate-400 mt-2 uppercase font-semibold leading-relaxed">Referente a contratos pagos aos clientes ({myCommissionRate}% over limit)</p>
                    </div>
                  </div>

                  {/* Volume convertido */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-150-grid shadow-sm flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Volume Pago (Averbados)</span>
                      <h4 className="text-2xl font-black text-slate-800">{formatCurrency(totalMyContracted)}</h4>
                    </div>
                    <span className="text-[10px] text-emerald-600 font-bold block mt-3 font-mono">Repassados sob aprovação final</span>
                  </div>

                  {/* Total de Propostas do corretor */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-150-grid shadow-sm flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Simulações na Carteira</span>
                      <h4 className="text-2xl font-black text-slate-800">{mySimulations.length} Propostas</h4>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-3 font-semibold">
                      {bolsaSimsCount} Bolsa+ | {inssSimsCount} INSS Consignado
                    </span>
                  </div>
                </div>

                {/* Banner Informativa sobre Atualizações 2026 */}
                <div className="bg-slate-900 text-white p-6 rounded-2xl border border-amber-400/30 shadow flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="space-y-2">
                    <span className="font-sans font-black uppercase text-[10px] tracking-wider text-amber-400 flex items-center gap-1.5 animate-pulse">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Painel Operacional Atualizado (Versão Oficial 2026)
                    </span>
                    <h4 className="text-base font-black text-slate-100">
                      Simuladores Ajustados com Regras do Diário Oficial de 2026
                    </h4>
                    <p className="text-xs text-slate-350 leading-relaxed max-w-2xl font-medium">
                      Todas as esteiras de crédito foram calibradas para os valores oficiais vigentes: <span className="text-amber-400 font-bold">Consignado INSS</span> com piso baseado no salário mínimo de <span className="text-amber-400 font-bold">R$ 1.621</span> e prazos até 108x; <span className="text-emerald-400 font-bold">Antecipação FGTS</span> em até 5 saques anuais; <span className="text-yellow-400 font-bold">Bolsa Família</span> para microcrédito social de R$ 300 a R$ 1.500 amortizado em até 18 meses; e <span className="text-cyan-400 font-bold">Fatura de Luz (Crefaz)</span> com limite estendido para até R$ 4.200.
                    </p>
                  </div>
                </div>

                {/* BUSCADOR DENTRO DO DASHBOARD - CONSULTA INTEGRAL DE QUALQUER PROPOSTA */}
                <div className="bg-white p-6 rounded-2xl border border-amber-400/15 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="bg-amber-400/10 p-2 rounded-lg text-amber-600">
                      <Search className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">Buscar Proposta Geral no Sistema</h4>
                      <p className="text-slate-500 text-xs text-[11px]">Consulte histórico de qualquer proposta ou simulação digitando o CPF do beneficiário ou o ID único.</p>
                    </div>
                  </div>

                  <form onSubmit={handleGlobalProposalSearch} className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      placeholder="Identificador da Proposta (ex: SIM_2AJW9) ou CPF do Cliente..."
                      value={dashSearchVal}
                      onChange={(e) => setDashSearchVal(e.target.value)}
                      className="flex-1 bg-slate-50 text-slate-850 text-sm px-4 py-3 rounded-xl border border-slate-200 outline-none focus:bg-white focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    />
                    <button
                      type="submit"
                      disabled={searchLoading}
                      className="bg-slate-900 hover:bg-slate-850 text-amber-400 font-bold px-6 py-3 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
                    >
                      {searchLoading ? "Pesquisando..." : "Consultar Proposta"}
                    </button>
                  </form>

                  {searchError && (
                    <div className="text-red-600 text-xs font-semibold flex items-center gap-1.5 p-3 bg-red-50 rounded-lg">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {searchError}
                    </div>
                  )}

                  {searchedSimResult && (
                    <div className="bg-amber-400/5 border border-amber-400/25 p-5 rounded-xl space-y-4 animate-scale-up">
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="text-xs font-bold text-amber-700 uppercase">Resultado de Proposta Encontrada</span>
                        <span className="text-[10.5px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-bold">
                          ID: {searchedSimResult.id}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                        <div>
                          <span className="text-slate-405 text-slate-400 block font-semibold">Cliente Beneficiário</span>
                          <span className="font-bold text-slate-800 text-sm block mt-0.5">{searchedSimResult.clientName}</span>
                          <span className="text-[10px] text-slate-500 block">CPF: {formatCPF(searchedSimResult.cpf)}</span>
                        </div>
                        <div>
                          <span className="text-slate-405 text-slate-400 block font-semibold">Tipo Convênio</span>
                          <span className="font-extrabold text-slate-800 block mt-1">
                            {searchedSimResult.type === "bolsa_familia" ? "Bolsa Família (Bolsa+)" : "INSS Consignado"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-405 text-slate-400 block font-semibold">Condições Simuladas</span>
                          <span className="font-bold text-slate-800 block mt-0.5">{searchedSimResult.installmentsCount} parcelas de {formatCurrency(searchedSimResult.installmentAmount)}</span>
                          <span className="text-[10px] text-amber-600 font-bold block">Taxa: {searchedSimResult.interestRate}% am.</span>
                        </div>
                        <div>
                          <span className="text-slate-405 text-slate-400 block font-semibold">Valor Disponibilizado</span>
                          <span className="font-extrabold text-amber-600 text-sm block mt-0.5">{formatCurrency(searchedSimResult.requestedAmount)}</span>
                          <span className={`inline-block mt-1 text-[9px] font-bold px-2 py-0.5 rounded ${
                            searchedSimResult.status === "contracted" ? "bg-amber-100 text-amber-800" :
                            searchedSimResult.status === "approved" ? "bg-emerald-100 text-emerald-800" :
                            "bg-slate-100 text-slate-600"
                          }`}>
                            {searchedSimResult.status.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {searchedSimResult.observations && (
                        <div className="bg-slate-100/65 p-3 rounded-lg text-xs text-slate-600 italic">
                          <strong>Observações da proposta:</strong> {searchedSimResult.observations}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Grafico com Recharts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Grafico status */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-150-grid shadow-sm flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-4 border-b pb-2">Status da sua Carteira</h4>
                      <div className="h-60 mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={myChartData}>
                            <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} />
                            <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                            <Tooltip />
                            <Bar dataKey="propostas" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* HISTÓRICO DAS PROPOSTAS CONSULTADAS DO CORRETOR */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-150-grid shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-4 border-b pb-2">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                          <History className="w-4 h-4 text-amber-500" />
                          Propostas Consultadas Recentemente
                        </h4>
                        {consultedProposals.length > 0 && (
                          <button 
                            onClick={clearConsultedHistory}
                            className="text-[10px] text-rose-600 hover:text-rose-800 font-bold uppercase transition"
                          >
                            Limpar Histórico
                          </button>
                        )}
                      </div>

                      <div className="space-y-3.5 max-h-64 overflow-y-auto pr-1">
                        {consultedProposals.length === 0 ? (
                          <div className="text-slate-400 text-xs py-10 text-center font-medium">
                            Nenhuma proposta externa consultada recentemente nesta sessão. Use a busca acima!
                          </div>
                        ) : (
                          consultedProposals.map((item, idx) => (
                            <div 
                              key={item.id || idx} 
                              className="bg-slate-50 p-3 rounded-xl border border-slate-100 hover:border-amber-400/20 transition flex items-center justify-between gap-3 text-xs"
                            >
                              <div>
                                <h5 className="font-extrabold text-slate-800 leading-tight">{item.clientName}</h5>
                                <span className="text-[10px] text-slate-400 block mt-0.5">CPF: {formatCPF(item.cpf)} | {item.type === "bolsa_familia" ? "Bolsa+" : "INSS"}</span>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="font-black text-amber-600 block">{formatCurrency(item.requestedAmount)}</span>
                                <span className="text-[9.5px] font-mono font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded mt-1 inline-block uppercase">{item.status}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Historico De Atendimento em tempo real do propio corretor */}
                <div className="bg-white rounded-2xl border border-slate-150-grid p-6 shadow-sm">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-4 border-b pb-3">Seus Atendimentos Recentes</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase">
                          <th className="py-3 px-4">Beneficiário</th>
                          <th className="py-3 px-4">Convênio</th>
                          <th className="py-3 px-4">Parcela</th>
                          <th className="py-3 px-4">Liberado</th>
                          <th className="py-3 px-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-600 divide-y divide-slate-100">
                        {mySimulations.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-slate-400">Nenhum atendimento ativo. Vá nas abas ao lado para simular!</td>
                          </tr>
                        ) : (
                          mySimulations.slice(0, 10).map((sim) => (
                            <tr key={sim.id} className="hover:bg-slate-50/50">
                              <td className="py-3 px-4">
                                <div className="font-bold text-slate-900">{sim.clientName}</div>
                                <div className="text-[10px] text-slate-400">CPF: {formatCPF(sim.cpf)}</div>
                              </td>
                              <td className="py-3 px-4">
                                {sim.type === "bolsa_familia" ? (
                                  <span className="bg-amber-150 bg-amber-400/10 text-amber-700 text-[10px] font-extrabold px-2 py-0.5 rounded">Bolsa+</span>
                                ) : (
                                  <span className="bg-slate-100 text-slate-800 text-[10px] font-extrabold px-2 py-0.5 rounded">INSS</span>
                                )}
                              </td>
                              <td className="py-3 px-4 font-bold">{formatCurrency(sim.installmentAmount)}</td>
                              <td className="py-3 px-4 font-bold text-amber-700">{formatCurrency(sim.requestedAmount)}</td>
                              <td className="py-3 px-4">
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                                  sim.status === "contracted" ? "bg-amber-150 text-amber-800 bg-amber-100" :
                                  sim.status === "approved" ? "bg-green-100 text-green-800" :
                                  sim.status === "pending" ? "bg-slate-200 text-slate-700" :
                                  sim.status === "pre_approved" ? "bg-rose-100 text-rose-700" : "bg-red-100 text-red-700"
                                }`}>
                                  {sim.status.toUpperCase()}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* SUB TAB 2: SIMULADOR DE CRÉDUTOS DISPONIVEIS / CALCULO DE MARGEM */}
            {activeSubTab === "credit_consult" && (
              <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                  <div>
                    <h3 className="text-xl font-black text-slate-950 tracking-tight flex items-center gap-2">
                      <Scale className="w-5 h-5 text-amber-500" />
                      Consulta Dinâmica de Créditos Disponíveis / Margem
                    </h3>
                    <p className="text-slate-500 text-xs">Simulador analítico complementar para corretores calcularem limites de financiabilidade rapidamente.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Painel do Formulario */}
                    <div className="space-y-5">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b pb-2">1. Parametros do Contrato</h4>
                      
                      {/* Tipo de convenio */}
                      <div>
                        <label className="block text-xs font-black text-slate-700 mb-1.5 uppercase">Convênio Comercial</label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setCreditType("bolsa_familia");
                              setCreditBenefit(600);
                              setCreditNetMargin(0);
                            }}
                            className={`py-3 px-4 rounded-xl text-xs font-extrabold border text-center transition cursor-pointer ${
                              creditType === "bolsa_familia" 
                                ? "bg-amber-400/10 border-amber-400 text-amber-800 font-extrabold" 
                                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            Bolsa Família (Bolsa+)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCreditType("inss");
                              setCreditBenefit(1412);
                            }}
                            className={`py-3 px-4 rounded-xl text-xs font-extrabold border text-center transition cursor-pointer ${
                              creditType === "inss" 
                                ? "bg-amber-400/10 border-amber-400 text-amber-800 font-extrabold" 
                                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            INSS Aposentado
                          </button>
                        </div>
                      </div>

                      {/* Inputs do Beneficio */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-black text-slate-700 mb-1.5 uppercase">Valor do Benefício Mensal</label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-2.5 text-xs text-slate-400 font-bold">R$</span>
                            <input
                              type="number"
                              value={creditBenefit}
                              onChange={(e) => setCreditBenefit(Number(e.target.value))}
                              className="w-full bg-slate-50 border text-slate-800 text-xs py-2.5 pl-9 pr-3 rounded-xl outline-none focus:bg-white"
                            />
                          </div>
                        </div>

                        {/* Se for INSS, permitir digitar margem direta */}
                        {creditType === "inss" ? (
                          <div>
                            <label className="block text-xs font-black text-slate-705 text-slate-700 mb-1.5 uppercase">Margem Líquida Livre (R$)</label>
                            <div className="relative">
                              <span className="absolute left-3.5 top-2.5 text-xs text-slate-400 font-bold">R$</span>
                              <input
                                type="number"
                                placeholder="Auto (45% max)"
                                value={creditNetMargin || ""}
                                onChange={(e) => setCreditNetMargin(Number(e.target.value))}
                                className="w-full bg-slate-50 border text-slate-800 text-xs py-2.5 pl-9 pr-3 rounded-xl outline-none focus:bg-white"
                              />
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 block">Opcional. Se zero, usa limite do convênio.</span>
                          </div>
                        ) : (
                          <div>
                            <label className="block text-xs font-black text-slate-400 mb-1.5 uppercase">Margem Regulamentar</label>
                            <input
                              type="text"
                              disabled
                              value={`${activeMarginRate}% do benefício`}
                              className="w-full bg-slate-100 border text-slate-500 font-medium text-xs py-2.5 px-3 rounded-xl cursor-not-allowed"
                            />
                          </div>
                        )}
                      </div>

                      {/* Quantidade de Parcelas / Prazo */}
                      <div>
                        <label className="block text-xs font-black text-slate-705 text-slate-700 mb-1.5 uppercase">Prazo de Financiamento (Meses)</label>
                        <select
                          value={creditInstallments}
                          onChange={(e) => setCreditInstallments(Number(e.target.value))}
                          className="w-full bg-slate-50 border text-slate-800 text-xs py-2.5 px-3 rounded-xl outline-none focus:bg-white"
                        >
                          <option value={12}>12 Meses</option>
                          <option value={18}>18 Meses</option>
                          <option value={24}>24 Meses</option>
                          <option value={36}>36 Meses (Prazo sugerido Bolsa+)</option>
                          <option value={48}>48 Meses</option>
                          <option value={60}>60 Meses</option>
                          <option value={72}>72 Meses</option>
                          <option value={84}>84 Meses (Limite INSS)</option>
                        </select>
                      </div>

                      {/* Dados opcionais do cliente para cadastrar na linha direta */}
                      <form onSubmit={handleSaveCreditAsProposal} className="space-y-4 pt-4 border-t border-slate-100">
                        <h5 className="text-xs font-black text-slate-850 flex items-center gap-1">
                          <Sparkles className="w-4 h-4 text-amber-500" />
                          2. Converter em Proposta Real do Cliente
                        </h5>

                        {creditFeedback && (
                          <div className={`p-3 rounded-lg text-xs font-bold leading-relaxed ${
                            creditFeedback.includes("sucesso") ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
                          }`}>
                            {creditFeedback}
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Nome Cliente</label>
                            <input
                              type="text"
                              value={creditName}
                              onChange={(e) => setCreditName(e.target.value)}
                              placeholder="Ficha do beneficiário"
                              className="w-full bg-slate-50 border text-slate-830 text-xs p-2 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">CPF Cliente</label>
                            <input
                              type="text"
                              value={creditCpf}
                              onChange={(e) => setCreditCpf(e.target.value)}
                              placeholder="000.000.000-00"
                              className="w-full bg-slate-50 border text-slate-830 text-xs p-2 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">WhatsApp Celular</label>
                            <input
                              type="text"
                              value={creditPhone}
                              onChange={(e) => setCreditPhone(e.target.value)}
                              placeholder="(00) 00000-0000"
                              className="w-full bg-slate-50 border text-slate-830 text-xs p-2 rounded-lg"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={creditIsSaving}
                          className="w-full bg-slate-900 hover:bg-slate-850 text-amber-400 font-black py-3 rounded-xl text-xs transition uppercase tracking-wider"
                        >
                          {creditIsSaving ? "Lançando em nuvem..." : "Registrar Proposta Pré-Aprovada"}
                        </button>
                      </form>
                    </div>

                    {/* Painel do Resultado Analitico */}
                    <div className="bg-slate-900 text-white p-6 rounded-2xl flex flex-col justify-between border border-amber-400/20 shadow-inner">
                      <div className="space-y-6">
                        <div className="border-b border-white/10 pb-4">
                          <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">Crédito Analisado</span>
                          <span className="text-sm font-bold block mt-1">Estimativa de Linhas Disponíveis</span>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <span className="text-slate-400 text-xs block font-semibold">Crédito Estimado Liberado</span>
                            <span className="text-3xl font-black text-amber-400 block mt-1">{formatCurrency(computedLoanAmt)}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-4 pt-2 text-xs">
                            <div>
                              <span className="text-slate-400 block">Parcela Mensal</span>
                              <span className="font-extrabold text-white text-base block mt-0.5">{formatCurrency(computedMarginVal)}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block">Juros Praticados</span>
                              <span className="font-bold text-amber-300 block mt-1">{activeInterestRate}% a.m.</span>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-white/5 space-y-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Total de Parcelas:</span>
                              <span className="font-bold text-slate-100">{creditInstallments}x</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Margem Consumida:</span>
                              <span className="font-bold text-amber-400">{activeMarginRate}% regulamentar</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Total Pago de Financiamento:</span>
                              <span className="font-mono text-slate-300">{(computedMarginVal * creditInstallments).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white/5 p-3 rounded-lg border border-white/10 text-[10.5px] text-slate-300 mt-6 leading-relaxed">
                        ★ <strong>Instruções do Correspondente Bancário:</strong> Este simulador efetua o cálculo invertendo a fórmula padrão do PMT. Os coeficientes de bancos parceiros da JR Crédito podem acarretar em modificações pequenas na apuração física final.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SUB TAB 3: SIMULADOR BOLSA */}
            {activeSubTab === "simulate_bolsa" && (
              <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
                <BolsaSimulator systemConfig={systemConfig} userProfile={userProfile} />
              </div>
            )}

            {/* SUB TAB 4: SIMULADOR INSS */}
            {activeSubTab === "simulate_inss" && (
              <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
                <InssSimulator systemConfig={systemConfig} userProfile={userProfile} />
              </div>
            )}

            {/* SUB TAB FGTS */}
            {activeSubTab === "simulate_fgts" && (
              <div className="space-y-6 animate-fade-in max-w-4xl mx-auto text-slate-900">
                <FgtsSimulator systemConfig={systemConfig} userProfile={userProfile} onSimulationSaved={() => {}} />
              </div>
            )}

            {/* SUB TAB CONTA DE LUZ */}
            {activeSubTab === "simulate_luz" && (
              <div className="space-y-6 animate-fade-in max-w-4xl mx-auto text-slate-900">
                <LuzSimulator systemConfig={systemConfig} userProfile={userProfile} onSimulationSaved={() => {}} />
              </div>
            )}

            {/* SUB TAB CLT CONSIGNADO */}
            {activeSubTab === "simulate_clt" && (
              <div className="space-y-6 animate-fade-in max-w-4xl mx-auto text-slate-900">
                <CltSimulator systemConfig={systemConfig} userProfile={userProfile} onSimulationSaved={() => {}} />
              </div>
            )}

            {/* SUB TAB 5: CRM CLIENTS MANAGER */}
            {activeSubTab === "customers" && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">CRM Meus Clientes e Histórico</h3>
                    <p className="text-slate-500 text-sm">Gerencie beneficiários fidelizados e acompanhe linha temporal de simulações.</p>
                  </div>

                  <button
                    onClick={() => setShowAddClient(!showAddClient)}
                    className="bg-slate-900 hover:bg-slate-850 text-amber-400 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 shadow cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Registrar Prospect / Novo Lead
                  </button>
                </div>

                {/* Bloco Cadastro Manual */}
                {showAddClient && (
                  <form onSubmit={handleAddClient} className="bg-white p-6 rounded-2xl border border-amber-400/20 shadow-sm space-y-4 animate-scale-up">
                    <h4 className="text-xs font-bold text-slate-800 border-b pb-2 uppercase tracking-widest">Lançar Nova Ficha de Lead Cliente</h4>
                    
                    {cFeedback && (
                      <div className={`p-3 rounded-lg text-xs font-bold leading-relaxed ${
                        cFeedback.includes("sucesso") ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
                      }`}>
                        {cFeedback}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Nome Completo</label>
                        <input
                          type="text"
                          required
                          value={cName}
                          onChange={(e) => setCName(e.target.value)}
                          placeholder="Ex: Pedro de Alcântara"
                          className="w-full text-slate-800 bg-slate-50 border px-3 py-2 rounded-xl text-sm outline-none focus:bg-white focus:border-amber-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">CPF Cliente</label>
                        <input
                          type="text"
                          required
                          value={cCpf}
                          onChange={(e) => setCCpf(e.target.value)}
                          placeholder="000.000.000-00"
                          className="w-full text-slate-800 bg-slate-50 border px-3 py-2 rounded-xl text-sm outline-none focus:bg-white focus:border-amber-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">WhatsApp / Celular</label>
                        <input
                          type="text"
                          required
                          value={cPhone}
                          onChange={(e) => setCPhone(e.target.value)}
                          placeholder="(00) 00000-0000"
                          className="w-full text-slate-800 bg-slate-50 border px-3 py-2 rounded-xl text-sm outline-none focus:bg-white focus:border-amber-400"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAddClient(false)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-4 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={cIsSaving}
                        className="bg-slate-900 hover:bg-slate-850 text-amber-400 py-2 px-5 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        {cIsSaving ? "Registrando..." : "Confirmar Cadastro Completo"}
                      </button>
                    </div>
                  </form>
                )}

                {/* Filtro Clientes */}
                <div className="bg-white p-4 rounded-xl border border-slate-100">
                  <input
                    type="text"
                    placeholder="Pesquise localmente seus clientes por nome ou CPF..."
                    value={searchClientQuery}
                    onChange={(e) => setSearchClientQuery(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 rounded-xl text-sm border focus:outline-none focus:bg-white focus:border-amber-400"
                  />
                </div>

                {/* AREA PRINCIPAL CRM: GRID CLIENTES OU HISTÓRICO DETALHADO */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Lista de Clientes */}
                  <div className="lg:col-span-2 space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Carteira Ativa de Clientes ({filteredClients.length})</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredClients.length === 0 ? (
                        <div className="bg-white p-8 rounded-2xl border text-center text-slate-450 text-slate-400 font-medium md:col-span-2">
                          Nenhum cliente na carteira. Registre um prospect ou salve simulações de Bolsa+ ou INSS!
                        </div>
                      ) : (
                        filteredClients.map((cli) => (
                          <div 
                            key={cli.cpf} 
                            onClick={() => setSelectedClientCpf(cli.cpf)}
                            className={`p-5 rounded-2xl border transition text-left cursor-pointer flex flex-col justify-between space-y-4 ${
                              selectedClientCpf === cli.cpf 
                                ? "bg-amber-400/5 border-amber-400 shadow-sm" 
                                : "bg-white border-slate-100 hover:border-slate-350 shadow-sm hover:shadow"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="bg-slate-900 text-amber-400 font-black p-2.5 rounded-full flex items-center justify-center text-sm w-10 h-10 shadow-sm">
                                {cli.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="truncate">
                                <h4 className="font-extrabold text-slate-900 text-sm truncate">{cli.name}</h4>
                                <span className="text-slate-400 text-[10.5px] block font-semibold">{formatCPF(cli.cpf)}</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-xs py-2 border-y border-slate-100">
                              <span className="text-slate-450 text-slate-400 font-bold block">Histórico acumulado:</span>
                              <span className="bg-amber-400/10 text-amber-850 font-black rounded-full px-2 py-0.5 text-[10px]">
                                {cli.count} {cli.count === 1 ? "Simulação" : "Simulações"}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-600 font-bold font-mono text-[11px]">{formatPhone(cli.phone)}</span>
                              <span className="text-amber-600 hover:text-amber-800 font-black uppercase text-[9.5px] inline-flex items-center gap-0.5">
                                Ver Linha Histórica
                                <ChevronRight className="w-3.5 h-3.5" />
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Painel do Historico Completo do Cliente Selecionado */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                    <h4 className="text-xs font-black text-slate-900 border-b pb-3 uppercase tracking-widest flex items-center gap-1.5">
                      <History className="w-4 h-4 text-amber-500" />
                      Histórico e Linha Temporal
                    </h4>

                    {!selectedClientCpf ? (
                      <div className="text-center py-20 text-slate-400 text-xs">
                        <Users className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                        Selecione um cliente ao lado para inspecionar todas as propostas, status atual, prazos e formalização.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Identificação basica */}
                        {(() => {
                          const cliInfo = clientsList.find(c => c.cpf === selectedClientCpf);
                          if (!cliInfo) return null;
                          return (
                            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                              <span className="text-[10px] text-slate-400 font-bold block uppercase">Cliente em Destaque</span>
                              <h5 className="font-extrabold text-slate-805 text-slate-900 text-sm">{cliInfo.name}</h5>
                              <p className="text-[10.5px] text-slate-550 text-slate-500 mt-1 font-semibold">CPF: {formatCPF(cliInfo.cpf)}</p>
                              
                              <div className="mt-3">
                                <a
                                  href={generateWhatsAppLink(
                                    systemConfig?.whatsappNumber || "5511999999999",
                                    cliInfo.name,
                                    cliInfo.cpf,
                                    undefined,
                                    0,
                                    0,
                                    0,
                                    0,
                                    "N/A"
                                  )}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="w-full bg-emerald-500 hover:bg-emerald-600 font-bold text-white text-[11px] py-1.5 px-3 rounded-lg inline-flex items-center justify-center gap-1.5 shadow-sm transition"
                                >
                                  <Smartphone className="w-4 h-4" />
                                  Acessar Contato via WhatsApp
                                </a>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Listagem das simulações do CPF */}
                        <div className="space-y-3 pt-2">
                          <span className="text-[10.5px] text-slate-400 uppercase font-black tracking-wider block">Propostas neste CPF:</span>
                          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                            {getSimulationsForCpf(selectedClientCpf).length === 0 ? (
                              <p className="text-slate-400 text-xs text-center py-6 italic">O cliente ainda não possuía propostas cadastradas neste corretor.</p>
                            ) : (
                              getSimulationsForCpf(selectedClientCpf).map((sim, index) => (
                                <div key={sim.id || index} className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm space-y-2.5">
                                  <div className="flex justify-between items-start text-xs border-b pb-1.5 border-slate-50">
                                    <span className="font-bold text-slate-800">
                                      {sim.type === "bolsa_familia" ? "Bolsa+ " : "INSS "} 
                                      {sim.installmentsCount}x
                                    </span>
                                    <span className={`text-[9px] font-bold uppercase p-1 rounded leading-none ${
                                      sim.status === "contracted" ? "bg-amber-100 text-amber-800" :
                                      sim.status === "approved" ? "bg-emerald-100 text-emerald-800" :
                                      sim.status === "pending" ? "bg-slate-100 text-slate-600" : "bg-rose-100 text-rose-850"
                                    }`}>
                                      {sim.status}
                                    </span>
                                  </div>

                                  <div className="text-xs space-y-1">
                                    <div className="flex justify-between">
                                      <span className="text-slate-450 text-slate-400">Parcelas:</span>
                                      <span className="font-bold text-slate-700">{formatCurrency(sim.installmentAmount)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-450 text-slate-400">Total Liberado:</span>
                                      <span className="font-black text-amber-600">{formatCurrency(sim.requestedAmount)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-450 text-slate-400">Registrado em:</span>
                                      <span className="text-[10px] text-slate-500 font-semibold">{new Date(sim.createdAt).toLocaleDateString("pt-BR")}</span>
                                    </div>
                                  </div>

                                  {sim.observations && (
                                    <div className="bg-slate-100/50 p-2 rounded text-[10px] text-slate-500 italic">
                                      "{sim.observations}"
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
