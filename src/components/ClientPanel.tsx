import React, { useState } from "react";
import { db } from "../firebase";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { Simulation, SystemConfig } from "../types";
import { formatCurrency, formatCPF, cleanNumber } from "../utils/helpers";
import { handleFirestoreError, OperationType } from "../utils/firebaseErrorHandler";
import { Search, FileCheck, Shield, ClipboardList, CheckCircle2, CloudUpload, UserCheck, PhoneCall } from "lucide-react";

interface ClientPanelProps {
  systemConfig: SystemConfig;
}

export default function ClientPanel({ systemConfig }: ClientPanelProps) {
  const [cpfQuery, setCpfQuery] = useState("");
  const [mySimulations, setMySimulations] = useState<Simulation[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Simulated Document Upload State
  const [uploadProgress, setUploadProgress] = useState<{ [simId: string]: number }>({});
  const [uploadedFiles, setUploadedFiles] = useState<{ [simId: string]: string[] }>({});
  const [dragOver, setDragOver] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setHasSearched(false);
    
    const clean = cleanNumber(cpfQuery);
    if (clean.length !== 11) {
      setErrorMsg("Por favor, digite um CPF válido contendo 11 dígitos.");
      return;
    }

    setLoading(true);
    try {
      const q = query(collection(db, "simulations"), where("cpf", "==", clean));
      const snapshot = await getDocs(q);
      const list: Simulation[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Simulation);
      });
      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setMySimulations(list);
      setHasSearched(true);
    } catch (err) {
      console.error(err);
      setErrorMsg("Erro de conexão ao buscar no Firestore. Tente novamente.");
      handleFirestoreError(err, OperationType.GET, "simulations");
    } finally {
      setLoading(false);
    }
  };

  const handleSimulatedUpload = (simId: string, fileName: string) => {
    setUploadProgress(prev => ({ ...prev, [simId]: 10 }));
    
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        const current = prev[simId];
        if (current >= 100) {
          clearInterval(interval);
          setUploadedFiles(files => ({
            ...files,
            [simId]: [...(files[simId] || []), fileName]
          }));
          
          // Opcionalmente atualizar a simulação no Firestore de que recebeu documentos
          try {
            const simRef = doc(db, "simulations", simId);
            updateDoc(simRef, {
              observations: `Documento de comprovante recebido via portal do cliente.`
            }).catch(e => {
              handleFirestoreError(e, OperationType.UPDATE, `simulations/${simId}`);
            });
          } catch (e) {
            console.error(e);
            handleFirestoreError(e, OperationType.UPDATE, `simulations/${simId}`);
          }

          return 100;
        }
        return current + 30;
      });
    }, 200);
  };

  const onDragOver = (e: React.DragEvent, simId: string) => {
    e.preventDefault();
    setDragOver(simId);
  };

  const onDragLeave = () => {
    setDragOver(null);
  };

  const onDrop = (e: React.DragEvent, simId: string) => {
    e.preventDefault();
    setDragOver(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleSimulatedUpload(simId, file.name);
    }
  };

  return (
    <div id="client-panel-parent" className="max-w-4xl mx-auto space-y-8 py-10 px-4 animate-fade-in">
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Portal de Consulta do Cliente</h2>
        <p className="text-slate-500 text-sm max-w-lg mx-auto leading-relaxed">
          Acompanhe em tempo real as etapas de liberação, margem aprovada e pendência de assinaturas de contrato.
        </p>
      </div>

      {/* Caixa de Entrada de CPF */}
      <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100 space-y-5">
        <h3 className="text-base font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
          <Shield className="w-5 h-5 text-gold-dark shrink-0" />
          Consulta Segura com CPF
        </h3>

        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-4" />
            <input
              type="text"
              required
              maxLength={14}
              value={cpfQuery}
              onChange={(e) => setCpfQuery(formatCPF(e.target.value))}
              placeholder="000.000.000-00"
              className="w-full pl-12 pr-4 py-3.5 text-lg font-mono text-slate-800 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-gold outline-none transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-gradient-to-r from-dark-primary to-dark-secondary hover:opacity-95 text-white font-bold px-8 py-3.5 rounded-2xl shadow transition flex items-center justify-center gap-2 text-base shrink-0 cursor-pointer"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent animate-spin" />
                Buscando...
              </>
            ) : (
              "Buscar Minha Proposta"
            )}
          </button>
        </form>

        {errorMsg && (
          <p className="text-sm font-semibold text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 flex items-center gap-2">
            ⚠️ {errorMsg}
          </p>
        )}
      </div>

      {/* RESULTADO DA CONSULTA */}
      {hasSearched ? (
        <div className="space-y-6">
          {mySimulations.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border shadow-md space-y-4">
              <ClipboardList className="w-12 h-12 text-slate-300 mx-auto" />
              <h4 className="text-lg font-bold text-slate-700">Nenhum Registro Encontrado</h4>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                Não encontramos propostas ativas com este CPF. Realize a simulação rápida na página inicial ou contate nosso suporte.
              </p>
            </div>
          ) : (
            mySimulations.map((sim) => (
              <div key={sim.id} className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
                {/* Header status */}
                <div className="bg-gradient-to-r from-dark-primary to-dark-secondary p-6 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800">
                  <div>
                    <span className="text-xs uppercase font-extrabold text-gold tracking-widest block leading-none">CÓDIGO OPERACIONAL</span>
                    <span className="text-lg font-mono font-bold">{sim.id.toUpperCase()}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-300">STATUS ATUAL:</span>
                    <span className={`text-xs font-black px-3 py-1.5 rounded-full ${
                      sim.status === "contracted" ? "bg-amber-100 text-amber-800" :
                      sim.status === "approved" ? "bg-green-100 text-green-800" :
                      sim.status === "pending" ? "bg-slate-100 text-slate-600" :
                      sim.status === "pre_approved" ? "bg-rose-100 text-rose-700" : "bg-red-100 text-red-700"
                    }`}>
                      {sim.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="p-6 md:p-8 space-y-8">
                  {/* Visual Tracker steps progress line */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b pb-2">Etapa da Proposta (Esteira de Crédito)</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
                      {/* Step 1 */}
                      <div className="flex items-center gap-3 bg-slate-50/70 p-3 rounded-xl border">
                        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                        <div>
                          <div className="text-xs font-bold text-slate-800">1. Cadastro</div>
                          <div className="text-[10px] text-slate-400">Proposta recebida</div>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="flex items-center gap-3 bg-slate-50/70 p-3 rounded-xl border">
                        <CheckCircle2 className={`w-5 h-5 shrink-0 ${
                          ["pre_approved", "approved", "contracted"].includes(sim.status) ? "text-green-500" : "text-slate-300"
                        }`} />
                        <div>
                          <div className="text-xs font-bold text-slate-800">2. Análise de Margem</div>
                          <div className="text-[10px] text-slate-400">Estudo de viabilidade</div>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className="flex items-center gap-3 bg-slate-50/70 p-3 rounded-xl border">
                        <CheckCircle2 className={`w-5 h-5 shrink-0 ${
                          ["approved", "contracted"].includes(sim.status) ? "text-green-500" : "text-slate-300"
                        }`} />
                        <div>
                          <div className="text-xs font-bold text-slate-800">3. Liberação Banco</div>
                          <div className="text-[10px] text-slate-400">Aprovação do convênio</div>
                        </div>
                      </div>

                      {/* Step 4 */}
                      <div className="flex items-center gap-3 bg-slate-50/70 p-3 rounded-xl border">
                        <CheckCircle2 className={`w-5 h-5 shrink-0 ${
                          sim.status === "contracted" ? "text-gold" : "text-slate-300"
                        }`} />
                        <div>
                          <div className="text-xs font-bold text-slate-800">4. Pagamento</div>
                          <div className="text-[10px] text-slate-400">Crédito pago em conta</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Resumo financeiro do cliente */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Aproveitamento de Margem</span>
                      <div className="text-lg font-bold text-slate-800 mt-1">{formatCurrency(sim.marginAmount)} <span className="text-xs">/mês</span></div>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Total de Meses (Prazo)</span>
                      <div className="text-lg font-bold text-slate-800 mt-1">{sim.installmentsCount} meses</div>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 text-gold-dark">Valor Estimado Liberado</span>
                      <div className="text-2xl font-black text-slate-900 mt-0.5">{formatCurrency(sim.requestedAmount)}</div>
                    </div>
                  </div>

                  {/* SUBMISSÃO DOCUMENTAL - DRAG AND DROP */}
                  <div className="space-y-4">
                    <div className="border-t pt-5">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Acelerar Minha Liberação (Documentos)</h4>
                      <p className="text-slate-500 text-xs">
                        Para agilizar a liberação e assinatura do contrato físico ou digital do INSS/Bolsa Família, anexe uma cópia visível do seu RG ou CNH de beneficiário.
                      </p>
                    </div>

                    {/* DropZone */}
                    <div 
                      onDragOver={(e) => onDragOver(e, sim.id)}
                      onDragLeave={onDragLeave}
                      onDrop={(e) => onDrop(e, sim.id)}
                      className={`border-2 border-dashed rounded-3xl p-6 text-center transition flex flex-col justify-center items-center gap-3 cursor-pointer ${
                        dragOver === sim.id
                          ? "border-gold bg-gold/5"
                          : "border-slate-300 bg-slate-50/50 hover:bg-slate-50"
                      }`}
                      onClick={() => handleSimulatedUpload(sim.id, "documento_comprovante_rg.pdf")}
                    >
                      <CloudUpload className="w-10 h-10 text-slate-400" />
                      <div>
                        <span className="text-sm font-bold text-slate-800 block">Arraste seus comprovantes ou clique aqui</span>
                        <span className="text-[11px] text-slate-400 block mt-1">Formatos aceitos: JPG, PNG, PDF até 10MB</span>
                      </div>

                      {uploadProgress[sim.id] !== undefined && uploadProgress[sim.id] < 100 && (
                        <div className="w-full max-w-xs bg-slate-200 rounded-full h-1.5 mt-2">
                          <div className="bg-gold h-1.5 rounded-full" style={{ width: `${uploadProgress[sim.id]}%` }} />
                        </div>
                      )}
                    </div>

                    {/* Arquivos Enviados */}
                    {uploadedFiles[sim.id] && uploadedFiles[sim.id].length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Documentos Atrelados:</span>
                        <div className="flex flex-wrap gap-2">
                          {uploadedFiles[sim.id].map((f, idx) => (
                            <span key={idx} className="bg-green-50 border border-green-200 text-green-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                              <FileCheck className="w-3.5 h-3.5 text-green-600" />
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SUPORTE TELEFONE / WHATSAPP INTEGRADO */}
                  <div className="bg-gold/5 p-5 rounded-2xl border border-gold/15 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-gold-dark" />
                        Precisa de Ajuda com a Ficha?
                      </h4>
                      <p className="text-xs text-slate-600">Fale diretamente com os consultores da JR Crédito e Soluções Financeiras para acertar as taxas.</p>
                    </div>
                    <a
                      href={`https://api.whatsapp.com/send?phone=${systemConfig.whatsappNumber}&text=Ola!%20Gostaria%20de%20consultar%20mais%20detalhes%20da%20minha%20proposta%20ID%20${sim.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-5 rounded-xl text-xs flex items-center gap-2 shadow cursor-pointer transition"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      Falar com Suporte
                    </a>
                  </div>

                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="text-center text-slate-400 text-xs font-semibold">
          Nenhuma pesquisa ativa no momento. Digite seu CPF acima.
        </div>
      )}
    </div>
  );
}
