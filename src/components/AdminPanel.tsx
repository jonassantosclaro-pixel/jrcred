import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, setDoc } from "firebase/firestore";
import { Simulation, UserProfile, SystemConfig, SimulationStatus } from "../types";
import { formatCurrency, formatCPF, formatNIS, cleanNumber } from "../utils/helpers";
import { handleFirestoreError, OperationType } from "../utils/firebaseErrorHandler";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import { ShieldCheck, Users, FileText, Settings, Settings2, BarChart3, Trash2, Edit, CheckCircle2, XCircle, Search, Percent, Save, Smartphone } from "lucide-react";

interface AdminPanelProps {
  userProfile: UserProfile;
  systemConfig: SystemConfig;
  onUpdateSystemConfig: (newConfig: SystemConfig) => void;
}

export default function AdminPanel({ userProfile, systemConfig, onUpdateSystemConfig }: AdminPanelProps) {
  // Real-time Lists
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter and search states
  const [activeTab, setActiveTab] = useState<"dashboard" | "simula" | "colaboradores" | "settings">("dashboard");
  const [simFilter, setSimFilter] = useState<string>("");
  const [colabSearch, setColabSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Edit modals state
  const [editingSim, setEditingSim] = useState<Simulation | null>(null);
  const [newSimStatus, setNewSimStatus] = useState<SimulationStatus>("pending");
  const [newSimObservations, setNewSimObservations] = useState("");

  // Global Config inputs
  const [bolsaMaxMargin, setBolsaMaxMargin] = useState(systemConfig?.bolsaMaxMargin || 35);
  const [bolsaInterestRate, setBolsaInterestRate] = useState(systemConfig?.bolsaInterestRate || 2.45);
  const [inssMaxMargin, setInssMaxMargin] = useState(systemConfig?.inssMaxMargin || 45);
  const [inssInterestRate, setInssInterestRate] = useState(systemConfig?.inssInterestRate || 1.70);
  const [fgtsInterestRate, setFgtsInterestRate] = useState(systemConfig?.fgtsInterestRate || 1.99);
  const [luzInterestRate, setLuzInterestRate] = useState(systemConfig?.luzInterestRate || 4.99);
  const [whatsappNumber, setWhatsappNumber] = useState(systemConfig?.whatsappNumber || "5511999999999");
  
  const [saveSettingsSuccess, setSaveSettingsSuccess] = useState(false);

  // Real-time listeners
  useEffect(() => {
    setLoading(true);
    
    // Listen to simulations
    const qSim = query(collection(db, "simulations"));
    const unsubscribeSim = onSnapshot(qSim, (snapshot) => {
      const list: Simulation[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Simulation);
      });
      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSimulations(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "simulations");
    });

    // Listen to users
    const qUsers = query(collection(db, "users"));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      const list: UserProfile[] = [];
      snapshot.forEach((doc) => {
        list.push({ uid: doc.id, ...doc.data() } as UserProfile);
      });
      setUsers(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "users");
    });

    return () => {
      unsubscribeSim();
      unsubscribeUsers();
    };
  }, []);

  // Update System settings in Firebase
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSettingsSuccess(false);
    try {
      const configDocRef = doc(db, "configs", "system_config");
      const updatedData: SystemConfig = {
        id: "system_config",
        bolsaMaxMargin,
        bolsaInterestRate,
        inssMaxMargin,
        inssInterestRate,
        fgtsInterestRate,
        luzInterestRate,
        whatsappNumber: cleanNumber(whatsappNumber)
      };
      await setDoc(configDocRef, updatedData, { merge: true });
      onUpdateSystemConfig(updatedData);
      setSaveSettingsSuccess(true);
      setTimeout(() => setSaveSettingsSuccess(false), 4000);
    } catch (e) {
      console.error("Erro ao salvar configurações globais: ", e);
    }
  };

  // Delete Simulation
  const handleDeleteSim = async (id: string) => {
    if (window.confirm("Deseja realmente excluir esta simulação? Esta ação é irreversível.")) {
      try {
        await deleteDoc(doc(db, "simulations", id));
      } catch (err) {
        console.error("Erro ao deletar simulação: ", err);
      }
    }
  };

  // Update user roles & approval status
  const handleToggleApproval = async (uid: string, currentStatus: boolean | undefined) => {
    try {
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, {
        approved: !currentStatus
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateCommission = async (uid: string, commission: number) => {
    try {
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, {
        commissionRate: commission
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateRole = async (uid: string, newRole: "admin" | "colaborador" | "client") => {
    try {
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, {
        role: newRole
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Open edit modal
  const openEditSim = (sim: Simulation) => {
    setEditingSim(sim);
    setNewSimStatus(sim.status);
    setNewSimObservations(sim.observations || "");
  };

  const handleSaveSimEdit = async () => {
    if (!editingSim) return;
    try {
      const simRef = doc(db, "simulations", editingSim.id);
      await updateDoc(simRef, {
        status: newSimStatus,
        observations: newSimObservations
      });
      setEditingSim(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Filtering lists
  const filteredSimulations = simulations.filter((sim) => {
    const matchesKeyword = sim.clientName.toLowerCase().includes(simFilter.toLowerCase()) || 
                           sim.cpf.includes(simFilter) ||
                           (sim.nis && sim.nis.includes(simFilter));
    const matchesStatus = statusFilter === "all" || sim.status === statusFilter;
    return matchesKeyword && matchesStatus;
  });

  const filteredUsers = users.filter((u) => {
    return u.name.toLowerCase().includes(colabSearch.toLowerCase()) || u.email.toLowerCase().includes(colabSearch.toLowerCase());
  });

  // Analytics Math
  const totalSimulatedAmount = simulations.reduce((sum, s) => sum + s.requestedAmount, 0);
  const totalContractedAmount = simulations.filter(s => s.status === "contracted").reduce((sum, s) => sum + s.requestedAmount, 0);
  const totalSimCount = simulations.length;
  const colabCount = users.filter((u) => u.role === "colaborador").length;

  // Charting Data Structure
  // By Status
  const statusCounts = simulations.reduce((acc: any, sim) => {
    acc[sim.status] = (acc[sim.status] || 0) + 1;
    return acc;
  }, {});

  const chartByStatus = [
    { name: "Pendente", value: statusCounts["pending"] || 0, color: "#94A3B8" },
    { name: "Pré-Aprovado", value: statusCounts["pre_approved"] || 0, color: "#FB7185" },
    { name: "Aprovado", value: statusCounts["approved"] || 0, color: "#34D399" },
    { name: "Recusado", value: statusCounts["rejected"] || 0, color: "#F87171" },
    { name: "Contratado", value: statusCounts["contracted"] || 0, color: "#D4AF37" },
  ];

  // By Type (Bolsa VS INSS)
  const typeCounts = simulations.reduce((acc: any, sim) => {
    acc[sim.type] = (acc[sim.type] || 0) + 1;
    return acc;
  }, {});

  const chartByType = [
    { name: "Bolsa Família (Bolsa+)", value: typeCounts["bolsa_familia"] || 0, fill: "#D4AF37" },
    { name: "Consignado INSS", value: typeCounts["inss"] || 0, fill: "#1E293B" },
    { name: "FGTS/Outros", value: typeCounts["fgts"] || 0, fill: "#64748B" },
  ];

  return (
    <div id="admin-panel-parent" className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar Admin */}
      <aside className="w-full md:w-64 bg-dark-primary text-white shrink-0 p-6 flex flex-col">
        {/* Identidade Logo */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-5 mb-6">
          <div className="bg-gradient-to-tr from-gold-dark to-gold w-9 h-9 rounded-lg flex items-center justify-center font-bold text-dark-primary text-base">
            JR
          </div>
          <div>
            <span className="text-sm font-black text-gold tracking-wider block">JR CRÉDITO</span>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">Painel Master Admin</span>
          </div>
        </div>

        {/* Info do Admin */}
        <div className="bg-dark-secondary rounded-xl p-4 border border-gold/10 mb-6 flex items-center gap-3 text-sm">
          <ShieldCheck className="w-5 h-5 text-gold shrink-0" />
          <div className="truncate">
            <div className="font-bold text-slate-100 truncate">{userProfile.name}</div>
            <div className="text-[10px] text-gold font-semibold uppercase">Super Usuário</div>
          </div>
        </div>

        {/* Nível Nav */}
        <nav className="space-y-1.5 flex-1">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`w-full text-left py-3 px-4 rounded-xl text-sm font-bold flex items-center gap-3 transition cursor-pointer ${
              activeTab === "dashboard" ? "bg-gold text-dark-primary font-extrabold" : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Visão Geral / Gráficos
          </button>

          <button
            onClick={() => setActiveTab("simula")}
            className={`w-full text-left py-3 px-4 rounded-xl text-sm font-bold flex items-center gap-3 transition cursor-pointer ${
              activeTab === "simula" ? "bg-gold text-dark-primary font-extrabold" : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <FileText className="w-4 h-4" />
            Simulações Realizadas ({simulations.length})
          </button>

          <button
            onClick={() => setActiveTab("colaboradores")}
            className={`w-full text-left py-3 px-4 rounded-xl text-sm font-bold flex items-center gap-3 transition cursor-pointer ${
              activeTab === "colaboradores" ? "bg-gold text-dark-primary font-extrabold" : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Users className="w-4 h-4" />
            Colaboradores & Roles ({users.length})
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`w-full text-left py-3 px-4 rounded-xl text-sm font-bold flex items-center gap-3 transition cursor-pointer ${
              activeTab === "settings" ? "bg-gold text-dark-primary font-extrabold" : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Settings className="w-4 h-4" />
            Configuração de Taxas
          </button>
        </nav>
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        {loading ? (
          <div className="h-96 flex flex-col justify-center items-center gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-gold-dark border-t-transparent" />
            <p className="text-slate-500 text-sm font-medium">Carregando dados em tempo real do Firestore...</p>
          </div>
        ) : (
          <>
            {/* 1. VISÃO GERAL / DASHBOARD */}
            {activeTab === "dashboard" && (
              <div className="space-y-8 animate-fade-in">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Performance Global Jr</h3>
                  <p className="text-slate-500 text-sm">Resumos matemáticos e estatísticos de simulações integrados em tempo real.</p>
                </div>

                {/* Grid de Resumo */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Simulado</span>
                    <h4 className="text-2xl font-black text-slate-800 mt-2">{formatCurrency(totalSimulatedAmount)}</h4>
                    <span className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Volume geral de propostas</span>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Convertido (Contratado)</span>
                    <h4 className="text-2xl font-black text-gold-dark mt-2">{formatCurrency(totalContractedAmount)}</h4>
                    <span className="text-[10px] text-green-600 mt-1 uppercase font-bold">Sucesso de vendas e averbações</span>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Quantidade de Simulações</span>
                    <h4 className="text-2xl font-black text-slate-800 mt-2">{totalSimCount} propostas</h4>
                    <span className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Interações em tempo real</span>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Colaboradores Contratados</span>
                    <h4 className="text-2xl font-black text-slate-800 mt-2">{colabCount} ativos</h4>
                    <span className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Corretores e correspondentes</span>
                  </div>
                </div>

                {/* Seção de Gráficos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Gráficos por Status */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b pb-2">Simulações por Status Operacional</h4>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartByStatus}>
                          <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} />
                          <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                          <Tooltip />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            {chartByStatus.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Gráficos por Tipo */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b pb-2">Distribuição de Tipo de Crédito</h4>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartByType}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          />
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Últimos Leads */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b pb-3">Novas Propostas Recentes (Tempo Real)</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase">
                          <th className="py-3 px-4">Beneficiário</th>
                          <th className="py-3 px-4">Tipo</th>
                          <th className="py-3 px-4">Valor Estimado</th>
                          <th className="py-3 px-4">Atendente</th>
                          <th className="py-3 px-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm text-slate-600 divide-y divide-slate-50">
                        {simulations.slice(0, 5).map((sim) => (
                          <tr key={sim.id} className="hover:bg-slate-50/50">
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900">{sim.clientName}</div>
                              <div className="text-[10px] text-slate-400">{formatCPF(sim.cpf)}</div>
                            </td>
                            <td className="py-3 px-4">
                              {sim.type === "bolsa_familia" ? (
                                <span className="bg-gold/10 text-gold-dark text-[10px] font-bold px-2 py-1 rounded">Bolsa+</span>
                              ) : (
                                <span className="bg-slate-100 text-slate-800 text-[10px] font-bold px-2 py-1 rounded">INSS</span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-slate-900">{formatCurrency(sim.requestedAmount)}</td>
                            <td className="py-3 px-4 text-xs font-semibold">{sim.createdByName || "Público"}</td>
                            <td className="py-3 px-4">
                              <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                                sim.status === "contracted" ? "bg-amber-100 text-amber-800" :
                                sim.status === "approved" ? "bg-green-100 text-green-800" :
                                sim.status === "pending" ? "bg-slate-100 text-slate-500" :
                                sim.status === "pre_approved" ? "bg-rose-100 text-rose-700" : "bg-red-100 text-red-700"
                              }`}>
                                {sim.status.toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 2. GERENCIADOR DE SIMULAÇÕES REGISTRADAS */}
            {activeTab === "simula" && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Todas as Simulações</h3>
                    <p className="text-slate-500 text-sm">Superfície total de auditoria e revisão de propostas.</p>
                  </div>
                </div>

                {/* Filtros de Busca */}
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4">
                  {/* Busca Keyword */}
                  <div className="flex-1 relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      placeholder="Pesquisar por Nome, CPF ou NIS..."
                      value={simFilter}
                      onChange={(e) => setSimFilter(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-gold outline-none text-sm text-slate-800"
                    />
                  </div>

                  {/* Filtro de Status */}
                  <div className="w-full md:w-56">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-gold outline-none text-sm text-slate-800"
                    >
                      <option value="all">Ver Todos os Status</option>
                      <option value="pending">Pendente</option>
                      <option value="pre_approved">Pré-Aprovado</option>
                      <option value="approved">Aprovado</option>
                      <option value="contracted">Contratado</option>
                      <option value="rejected">Recusado</option>
                    </select>
                  </div>
                </div>

                {/* Tabela Principal */}
                <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase">
                          <th className="py-3 px-4">ID</th>
                          <th className="py-3 px-4">Beneficiário</th>
                          <th className="py-3 px-4">Tipo</th>
                          <th className="py-3 px-4">Parcela</th>
                          <th className="py-3 px-4">Liberado</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm text-slate-600 divide-y divide-slate-100">
                        {filteredSimulations.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="y-12 py-8 text-center text-slate-400">Nenhuma simulação encontrada.</td>
                          </tr>
                        ) : (
                          filteredSimulations.map((sim) => (
                            <tr key={sim.id} className="hover:bg-slate-50/55 transition">
                              <td className="py-3.5 px-4 font-mono text-[10px] font-bold text-slate-400">
                                {sim.id.toUpperCase().slice(0, 8)}
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="font-bold text-slate-900">{sim.clientName}</div>
                                <div className="text-[10px] text-slate-400">CPF: {formatCPF(sim.cpf)}</div>
                              </td>
                              <td className="py-3.5 px-4">
                                {sim.type === "bolsa_familia" ? (
                                  <span className="bg-gold/10 text-gold-dark text-[10px] font-bold px-2.5 py-1 rounded">Bolsa+</span>
                                ) : (
                                  <span className="bg-slate-100 text-slate-800 text-[10px] font-bold px-2.5 py-1 rounded">INSS</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 font-bold text-slate-800">{formatCurrency(sim.installmentAmount)}</td>
                              <td className="py-3.5 px-4 font-bold text-gold-dark">{formatCurrency(sim.requestedAmount)}</td>
                              <td className="py-3.5 px-4">
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                                  sim.status === "contracted" ? "bg-amber-100 text-amber-800" :
                                  sim.status === "approved" ? "bg-green-100 text-green-800" :
                                  sim.status === "pending" ? "bg-slate-100 text-slate-550" :
                                  sim.status === "pre_approved" ? "bg-rose-100 text-rose-700" : "bg-red-100 text-red-700"
                                }`}>
                                  {sim.status.toUpperCase()}
                                </span>
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => openEditSim(sim)}
                                    className="p-1 px-1.5 border border-slate-200 rounded hover:bg-slate-100 text-slate-600 transition"
                                    title="Mudar Status"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSim(sim.id)}
                                    className="p-1 px-1.5 border border-red-200 rounded text-red-600 hover:bg-red-50 transition"
                                    title="Excluir"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* MODAL EDITAR STATUS */}
                {editingSim && (
                  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full border border-slate-100 space-y-5 animate-scale-up">
                      <div className="flex justify-between items-center border-b pb-3">
                        <h4 className="font-extrabold text-slate-900">Editar Proposta</h4>
                        <button onClick={() => setEditingSim(null)} className="text-slate-400 hover:text-slate-600 text-sm font-bold">Fechar</button>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <span className="text-[11px] font-bold text-slate-400 uppercase">Cliente</span>
                          <p className="font-bold text-slate-800 text-sm">{editingSim.clientName}</p>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Selecione o Status Atual</label>
                          <select
                            value={newSimStatus}
                            onChange={(e) => setNewSimStatus(e.target.value as SimulationStatus)}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-gold focus:outline-none text-slate-800 text-sm"
                          >
                            <option value="pending">Pendente (Recebido)</option>
                            <option value="pre_approved">Pré-Aprovado pelo Motor IA</option>
                            <option value="approved">Aprovado pelo Banco</option>
                            <option value="contracted">Averbado / Contratado (Pago ao Cliente)</option>
                            <option value="rejected">Recusado pelo Convênio</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Comentários e Histórico do Atendimento</label>
                          <textarea
                            value={newSimObservations}
                            onChange={(e) => setNewSimObservations(e.target.value)}
                            placeholder="Adicione informações adicionais (Ex: Enviado ao Banco Itaú, etc.)"
                            className="w-full text-slate-800 bg-slate-50 border border-slate-200 focus:border-gold px-3 py-2 rounded-xl transition duration-200 outline-none h-24 text-xs"
                          />
                        </div>

                        <button
                          onClick={handleSaveSimEdit}
                          className="w-full py-3 bg-gold-dark hover:bg-gold text-white font-bold rounded-xl shadow-lg transition"
                        >
                          Salvar Alterações
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. COLABORADORES & ROLES (RBAC) */}
            {activeTab === "colaboradores" && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Colaboradores & Controle de Permissão</h3>
                  <p className="text-slate-500 text-sm">Controle as comissões e aprove os corretores autorizados que realizam vendas.</p>
                </div>

                {/* Filtro */}
                <div className="bg-white p-4 rounded-xl border border-slate-100 flex gap-4">
                  <div className="flex-1 relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Pesquisar Colaboradores pelo Nome ou Email..."
                      value={colabSearch}
                      onChange={(e) => setColabSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-gold outline-none text-sm text-slate-800"
                    />
                  </div>
                </div>

                {/* Grid de Lista */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredUsers.map((u) => (
                    <div key={u.uid} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-extrabold text-slate-900 text-base">{u.name}</h4>
                          <span className="text-slate-400 text-xs font-medium block mt-0.5">{u.email}</span>
                        </div>
                        <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded uppercase tracking-wider ${
                          u.role === "admin" ? "bg-red-100 text-red-700" :
                          u.role === "colaborador" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
                        }`}>
                          {u.role}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg text-xs">
                        <div>
                          <span className="text-slate-400 block font-bold">Status de Aprovação:</span>
                          <span className={`font-extrabold ${u.approved ? "text-green-600" : "text-red-500 animate-pulse"}`}>
                            {u.approved ? "✓ AUTORIZADO (Ativo)" : "✗ PENDENTE ATIVAÇÃO"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-bold">Comissão Atual:</span>
                          <span className="font-extrabold text-slate-800">
                            {u.commissionRate ? `${u.commissionRate}%` : "Não definido"}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t flex flex-wrap items-center justify-between gap-3">
                        {/* Botões de Ação para Role Based Access Control */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleToggleApproval(u.uid, u.approved)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                              u.approved
                                ? "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100"
                                : "bg-green-100 text-green-800 hover:bg-green-200"
                            }`}
                          >
                            {u.approved ? "Bloquear" : "Aprovar corretor"}
                          </button>

                          <select
                            value={u.role}
                            onChange={(e) => handleUpdateRole(u.uid, e.target.value as any)}
                            className="bg-slate-100 text-slate-800 text-xs font-bold py-1.5 px-2 rounded-lg outline-none cursor-pointer"
                          >
                            <option value="client">Ver como Cliente</option>
                            <option value="colaborador">Ver como Corretor</option>
                            <option value="admin">Ver como Admin</option>
                          </select>
                        </div>

                        {/* Definição de Comissão em tempo real */}
                        {u.role === "colaborador" && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <Percent className="w-3.5 h-3.5 text-gold-dark" />
                            <label className="text-slate-500 font-semibold uppercase text-[10px]">Comissão:</label>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="10"
                              defaultValue={u.commissionRate || 1.5}
                              onBlur={(e) => handleUpdateCommission(u.uid, Number(e.target.value))}
                              className="w-12 bg-slate-50 border rounded p-1 text-center font-bold text-slate-800"
                            />
                            <span>%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. CONFIGURAÇÕES EM TEMPO REAL DO SISTEMA */}
            {activeTab === "settings" && (
              <div className="space-y-6 animate-fade-in max-w-2xl">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Parametrização do Motor de Crédito</h3>
                  <p className="text-slate-500 text-sm">Ajuste em tempo real as regras oficiais, margens e taxas aplicadas nos simuladores.</p>
                </div>

                <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
                  {saveSettingsSuccess && (
                    <div className="bg-green-100 text-green-800 p-4 rounded-xl flex items-center gap-3 border border-green-200">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-bold">Parâmetros operacionais salvos diretamente no Firestore em tempo real!</span>
                    </div>
                  )}

                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b pb-2 mb-3">CONVÊNIO Bolsa+ (CONSIGNADO Bolsa Família)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Margem de Utilização Recomendada (%)</label>
                        <input
                          type="number"
                          value={bolsaMaxMargin}
                          onChange={(e) => setBolsaMaxMargin(Number(e.target.value))}
                          className="w-full text-slate-800 bg-slate-50 border px-3 py-2 rounded-xl focus:bg-white focus:border-gold outline-none text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Taxa de Juros Mensal (% a.m.)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={bolsaInterestRate}
                          onChange={(e) => setBolsaInterestRate(Number(e.target.value))}
                          className="w-full text-slate-800 bg-slate-50 border px-3 py-2 rounded-xl focus:bg-white focus:border-gold outline-none text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b pb-2 mb-3">CONVÊNIO INSS (REFORMAS & PENSIONISTAS)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Margem Máxima Permitida INSS (%)</label>
                        <input
                          type="number"
                          value={inssMaxMargin}
                          onChange={(e) => setInssMaxMargin(Number(e.target.value))}
                          className="w-full text-slate-800 bg-slate-50 border px-3 py-2 rounded-xl focus:bg-white focus:border-gold outline-none text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Taxa de Juros Máxima regulada INSS (% a.m.)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={inssInterestRate}
                          onChange={(e) => setInssInterestRate(Number(e.target.value))}
                          className="w-full text-slate-800 bg-slate-50 border px-3 py-2 rounded-xl focus:bg-white focus:border-gold outline-none text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b pb-2 mb-3">GERAL & CANAL DE ATENDIMENTO</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Taxa Provisória FGTS (% a.m.)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={fgtsInterestRate}
                          onChange={(e) => setFgtsInterestRate(Number(e.target.value))}
                          className="w-full text-slate-800 bg-slate-50 border px-3 py-2 rounded-xl focus:bg-white focus:border-gold outline-none text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Taxa Provisória Conta de Luz (% a.m.)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={luzInterestRate}
                          onChange={(e) => setLuzInterestRate(Number(e.target.value))}
                          className="w-full text-slate-800 bg-slate-50 border px-3 py-2 rounded-xl focus:bg-white focus:border-gold outline-none text-sm"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Número Oficial do WhatsApp para Formalização</label>
                        <input
                          type="text"
                          value={whatsappNumber}
                          onChange={(e) => setWhatsappNumber(e.target.value)}
                          placeholder="Ex: 5511999999999"
                          className="w-full text-slate-800 bg-slate-50 border px-3 py-2 rounded-xl focus:bg-white focus:border-gold outline-none text-sm"
                        />
                        <span className="text-[10px] text-slate-400 mt-1 block font-medium">Lembre-se de colocar DDI (55) + DDD + Celular (Sem espaços ou traços).</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-gold-dark to-gold text-white font-bold py-3.5 rounded-xl shadow-lg cursor-pointer"
                  >
                    <Save className="w-5 h-5" />
                    Salvar Ajustes no Firebase
                  </button>
                </form>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
