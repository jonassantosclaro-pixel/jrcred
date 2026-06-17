import React, { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "firebase/auth";
import { doc, getDoc, setDoc, collection, query, limit, onSnapshot, updateDoc } from "firebase/firestore";
import { UserProfile, SystemConfig, Simulation } from "./types";
import { formatCurrency } from "./utils/helpers";
import { handleFirestoreError, OperationType } from "./utils/firebaseErrorHandler";
import BolsaSimulator from "./components/BolsaSimulator";
import InssSimulator from "./components/InssSimulator";
import FgtsSimulator from "./components/FgtsSimulator";
import LuzSimulator from "./components/LuzSimulator";
import AdminPanel from "./components/AdminPanel";
import ColaboradorPanel from "./components/ColaboradorPanel";
import ClientPanel from "./components/ClientPanel";
import {
  Coins,
  Shield,
  ShieldCheck,
  Check,
  Calculator,
  Settings,
  LogOut,
  LogIn,
  UserPlus,
  ArrowRight,
  FileText,
  Phone,
  Clock,
  Menu,
  X,
  Lock,
  Sparkles,
  Award,
  BookOpen,
  ArrowUpRight,
  ChevronRight,
  User,
  Activity,
  ThumbsUp,
  Zap,
  Users,
  TrendingUp,
  DollarSign,
  Video,
  MoreVertical,
  Smile,
  Paperclip,
  Mic,
  CheckCheck
} from "lucide-react";

// Fallback System Config default standard
const DEFAULT_CONFIG: SystemConfig = {
  id: "system_config",
  bolsaMaxMargin: 35,
  bolsaInterestRate: 2.45,
  inssMaxMargin: 45,
  inssInterestRate: 1.70,
  fgtsInterestRate: 1.99,
  luzInterestRate: 4.99,
  whatsappNumber: "5511999999999"
};

export default function App() {
  // Navigation Routing States
  // Pages: "home" | "client_portal" | "colab_portal" | "admin_portal" | "auth" | "sobre"
  const [currentPage, setCurrentPage] = useState<string>("home");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auth States
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup" | "reset">("login");
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authSuccessMsg, setAuthSuccessMsg] = useState("");

  // Auth Form Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"client" | "colaborador" | "admin">("colaborador");

  // Global Config synced with Firestore
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(DEFAULT_CONFIG);

  // Active quick simulator on Home Page
  const [activeHomeSim, setActiveHomeSim] = useState<"bolsa" | "inss" | "fgts" | "luz">("bolsa");

  // Load and Listen to Configurations on mount
  useEffect(() => {
    const configDocRef = doc(db, "configs", "system_config");
    const unsubscribe = onSnapshot(configDocRef, (snapshot) => {
      if (snapshot.exists()) {
        setSystemConfig(snapshot.data() as SystemConfig);
      } else {
        // Se as configurações não existirem no Firebase ainda, utiliza-se a padrão do client
        // sem tentar gravá-la forcada para evitar erros de permissão de não-admin
        console.log("Configurações iniciais não encontradas no Firestore. Usando fallback padrão.");
        setSystemConfig(DEFAULT_CONFIG);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "configs/system_config");
    });

    return () => unsubscribe();
  }, []);

  // Listen to Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          // Fetch custom user profile from Firestore
          const userDocRef = doc(db, "users", currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          let userProfileObj: UserProfile;
          
          if (userDoc.exists()) {
            userProfileObj = userDoc.data() as UserProfile;
            
            // Se o email logado for "jrcredito@x.com", certifique-se que o profile é admin e aprovado!
            if (currentUser.email?.toLowerCase() === "jrcredito@x.com" && (userProfileObj.role !== "admin" || !userProfileObj.approved)) {
              userProfileObj.role = "admin";
              userProfileObj.approved = true;
              await updateDoc(userDocRef, { role: "admin", approved: true });
            }
          } else {
            // Se o perfil não existir por algum motivo, cria o perfil adequado
            const isDefaultAdmin = currentUser.email?.toLowerCase() === "jrcredito@x.com";
            const defaultProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || "",
              name: isDefaultAdmin ? "Administrador JR Crédito" : (currentUser.displayName || "Usuário JR"),
              role: isDefaultAdmin ? "admin" : "client",
              approved: isDefaultAdmin ? true : undefined,
              createdAt: new Date().toISOString()
            };
            await setDoc(userDocRef, defaultProfile);
            userProfileObj = defaultProfile;
          }
          setProfile(userProfileObj);
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${currentUser?.uid}`);
        }
      } else {
        setProfile(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Handle Login Authentication
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingAuth(true);
    setAuthError("");
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // Obter perfil para redirecionamento imediato
      const userDocRef = doc(db, "users", uid);
      const userDoc = await getDoc(userDocRef);
      let userProf: UserProfile;

      if (userDoc.exists()) {
        userProf = userDoc.data() as UserProfile;
        // Se o email logado for "jrcredito@x.com", certifique-se de que é admin
        if (email.toLowerCase() === "jrcredito@x.com" && (userProf.role !== "admin" || !userProf.approved)) {
          userProf.role = "admin";
          userProf.approved = true;
          await updateDoc(userDocRef, { role: "admin", approved: true });
        }
      } else {
        const isDefaultAdmin = email.toLowerCase() === "jrcredito@x.com";
        const defaultProfile: UserProfile = {
          uid,
          email,
          name: isDefaultAdmin ? "Administrador JR Crédito" : "Usuário JR",
          role: isDefaultAdmin ? "admin" : "client",
          approved: isDefaultAdmin ? true : undefined,
          createdAt: new Date().toISOString()
        };
        await setDoc(userDocRef, defaultProfile);
        userProf = defaultProfile;
      }

      setProfile(userProf);
      
      // Redirecionamento inteligente baseado no Role
      if (userProf.role === "admin") {
        setCurrentPage("admin_portal");
      } else if (userProf.role === "colaborador") {
        setCurrentPage("colab_portal");
      } else {
        setCurrentPage("client_portal");
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setAuthError("Email ou senha incorretos.");
      } else {
        setAuthError("Erro ao fazer login. Verifique sua conexão.");
      }
    } finally {
      setLoadingAuth(false);
    }
  };

  // Handle Registration / Sign Up
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingAuth(true);
    setAuthError("");
    setAuthSuccessMsg("");
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // Se for jrcredito@x.com, o role é admin e aprovado automaticamente.
      // Caso contrário, é um "colaborador" (registro de administrador desabilitado).
      const finalizedRole = email.trim().toLowerCase() === "jrcredito@x.com" ? "admin" : "colaborador";
      const isApproved = finalizedRole === "admin" ? true : false;

      const newProfile: UserProfile = {
        uid,
        email,
        name,
        role: finalizedRole,
        phone,
        approved: isApproved,
        commissionRate: finalizedRole === "colaborador" ? 1.5 : undefined,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, "users", uid), newProfile);
      setProfile(newProfile);

      if (finalizedRole === "colaborador") {
        setAuthSuccessMsg("Cadastro efetuado! Aguarde a aprovação interna do administrador.");
        setAuthMode("login");
      } else if (finalizedRole === "admin") {
        setAuthSuccessMsg("Administrador cadastrado com sucesso!");
        setCurrentPage("admin_portal");
      } else {
        setCurrentPage("client_portal");
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        setAuthError("Este e-mail já está sendo utilizado.");
      } else if (err.code === "auth/weak-password") {
        setAuthError("A senha precisa conter no mínimo 6 caracteres.");
      } else {
        setAuthError("Erro de comunicação ao efetuar cadastro.");
      }
    } finally {
      setLoadingAuth(false);
    }
  };

  // Password reset email
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingAuth(true);
    setAuthError("");
    setAuthSuccessMsg("");
    try {
      await sendPasswordResetEmail(auth, email);
      setAuthSuccessMsg("Link de redefinição de senha enviado para sua caixa de entrada!");
    } catch (err) {
      setAuthError("Erro ao enviar link de redefinição. Verifique o email digitado.");
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setProfile(null);
      setUser(null);
      setCurrentPage("home");
    } catch (err) {
      console.error(err);
    }
  };

  // Redirecionamento rápido para o painel atual do usuário logado
  const handleGoToPortal = () => {
    if (!profile) return;
    if (profile.role === "admin") {
      setCurrentPage("admin_portal");
    } else if (profile.role === "colaborador") {
      setCurrentPage("colab_portal");
    } else {
      setCurrentPage("client_portal");
    }
  };

  return (
    <div id="base-app" className="min-h-screen bg-[#020617] text-[#f8fafc] flex flex-col justify-between">
      {/* HEADER UNIVERSAL */}
      <header className="bg-dark-primary text-white border-b border-gold/15 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          {/* Logo Brand */}
          <div 
            onClick={() => setCurrentPage("home")} 
            className="flex items-center gap-3 cursor-pointer group select-none"
          >
            {/* Logo Ouro Emblem */}
            <div className="bg-gradient-to-tr from-gold-dark to-gold w-10 h-10 rounded-xl flex items-center justify-center font-bold text-dark-primary text-lg transition duration-300 group-hover:rotate-6">
              JR
            </div>
            <div>
              <span className="text-sm font-extrabold text-white tracking-widest block font-sans">
                JR CRÉDITO
              </span>
              <span className="text-[10px] text-gold font-bold uppercase tracking-widest block leading-none">
                E SOLUÇÕES FINANCEIRAS
              </span>
            </div>
          </div>

          {/* Desktop Right Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <button
              onClick={() => setCurrentPage("home")}
              className={`text-sm font-bold tracking-wide transition cursor-pointer ${
                currentPage === "home" ? "text-gold underline decoration-2 decoration-gold underline-offset-4" : "text-slate-200 hover:text-gold"
              }`}
            >
              Início
            </button>
            <button
              onClick={() => {
                setCurrentPage("home");
                setTimeout(() => {
                  document.getElementById("produtos")?.scrollIntoView({ behavior: "smooth" });
                }, 120);
              }}
              className="text-sm font-bold tracking-wide transition cursor-pointer text-slate-200 hover:text-gold"
            >
              Produtos
            </button>
            <button
              onClick={() => {
                setCurrentPage("home");
                setTimeout(() => {
                  document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" });
                }, 120);
              }}
              className="text-sm font-bold tracking-wide transition cursor-pointer text-slate-200 hover:text-gold"
            >
              Como Funciona
            </button>
            <button
              onClick={() => setCurrentPage("sobre")}
              className={`text-sm font-bold tracking-wide transition cursor-pointer ${
                currentPage === "sobre" ? "text-gold underline decoration-2 decoration-gold underline-offset-4" : "text-slate-200 hover:text-gold"
              }`}
            >
              Sobre Nós
            </button>
            <button
              onClick={() => setCurrentPage("client_portal")}
              className={`text-sm font-bold tracking-wide transition cursor-pointer ${
                currentPage === "client_portal" ? "text-gold underline decoration-2 decoration-gold underline-offset-4" : "text-slate-200 hover:text-gold"
              }`}
            >
              Consultar Proposta
            </button>

            {/* Condicionais de login */}
            {profile ? (
              <div className="flex items-center gap-4 border-l border-white/10 pl-4">
                <button
                  onClick={handleGoToPortal}
                  className="bg-gold hover:bg-gold-light text-dark-primary text-xs font-black px-4 py-2.5 rounded-xl transition cursor-pointer uppercase tracking-wider"
                >
                  Minha Área ({profile.role === "admin" ? "Admin" : "Corretor"})
                </button>
                <button
                  onClick={handleSignOut}
                  className="text-slate-300 hover:text-red-400 font-bold text-xs flex items-center gap-1 cursor-pointer"
                  title="Sair da Conta"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sair
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 border-l border-white/10 pl-4">
                <button
                  onClick={() => {
                    setAuthMode("login");
                    setCurrentPage("auth");
                  }}
                  className="text-slate-200 hover:text-gold text-sm font-extrabold cursor-pointer"
                >
                  Login Corretor
                </button>
                <button
                  onClick={() => {
                    setAuthMode("signup");
                    setCurrentPage("auth");
                  }}
                  className="bg-gradient-to-r from-gold-dark to-gold text-white text-xs font-black px-4 py-2.5 rounded-xl shadow cursor-pointer uppercase tracking-wider hover:opacity-90"
                >
                  Cadastrar Vendedor
                </button>
              </div>
            )}
          </nav>

          {/* Mobile hamburger menu */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
            className="md:hidden text-slate-200 focus:outline-none cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu sheet */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-dark-secondary border-t border-slate-800 p-4 space-y-3">
            <button
              onClick={() => {
                setCurrentPage("home");
                setMobileMenuOpen(false);
              }}
              className="block w-full text-left py-2 px-3 text-slate-200 hover:text-gold font-bold text-sm"
            >
              Início
            </button>
            <button
              onClick={() => {
                setCurrentPage("home");
                setMobileMenuOpen(false);
                setTimeout(() => {
                  document.getElementById("produtos")?.scrollIntoView({ behavior: "smooth" });
                }, 120);
              }}
              className="block w-full text-left py-2 px-3 text-slate-200 hover:text-gold font-bold text-sm"
            >
              Produtos
            </button>
            <button
              onClick={() => {
                setCurrentPage("home");
                setMobileMenuOpen(false);
                setTimeout(() => {
                  document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" });
                }, 120);
              }}
              className="block w-full text-left py-2 px-3 text-slate-200 hover:text-gold font-bold text-sm"
            >
              Como Funciona
            </button>
            <button
              onClick={() => {
                setCurrentPage("sobre");
                setMobileMenuOpen(false);
              }}
              className="block w-full text-left py-2 px-3 text-slate-200 hover:text-gold font-bold text-sm"
            >
              Sobre Nós
            </button>
            <button
              onClick={() => {
                setCurrentPage("client_portal");
                setMobileMenuOpen(false);
              }}
              className="block w-full text-left py-2 px-3 text-slate-200 hover:text-gold font-bold text-sm"
            >
              Consultar Proposta
            </button>

            {profile ? (
              <div className="pt-2 border-t border-slate-700 space-y-2">
                <button
                  onClick={() => {
                    handleGoToPortal();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full bg-gold text-dark-primary font-black py-2.5 text-center rounded-xl text-xs uppercase"
                >
                  Minha Área ({profile.role})
                </button>
                <button
                  onClick={() => {
                    handleSignOut();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-red-400 py-2 text-center text-xs font-bold"
                >
                  Sair do sistema
                </button>
              </div>
            ) : (
              <div className="pt-2 border-t border-slate-700 space-y-2">
                <button
                  onClick={() => {
                    setAuthMode("login");
                    setCurrentPage("auth");
                    setMobileMenuOpen(false);
                  }}
                  className="w-full border border-slate-700 text-slate-100 py-2 px-3 rounded-xl text-xs hover:bg-slate-800 text-center font-bold"
                >
                  Login Corretor
                </button>
                <button
                  onClick={() => {
                    setAuthMode("signup");
                    setCurrentPage("auth");
                    setMobileMenuOpen(false);
                  }}
                  className="w-full bg-gold text-dark-primary py-2.5 px-3 rounded-xl text-xs text-center font-black uppercase"
                >
                  Cadastrar Vendedor
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* CORE PAGES RENDERER */}
      <div id="central-layout-pane" className="flex-1">

        {/* 1. PUBLIC LANDING PAGE (HOME) */}
        {currentPage === "home" && (
          <div className="bg-slate-50 text-slate-800 pb-20 animate-fade-in font-sans">
            {/* HERO SECTION - PREMIUM FINTECH BACKDROP */}
            <section className="relative bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white py-20 lg:py-28 overflow-hidden">
              {/* Background gradient effects and grid patterns */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30" />
              <div className="absolute right-0 top-0 w-[500px] h-[500px] bg-indigo-505/20 rounded-full blur-3xl -z-10" />
              <div className="absolute -left-20 bottom-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl -z-10" />

              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
                {/* Text Block */}
                <div className="lg:col-span-7 space-y-6 text-left">
                  {/* Authorized Stamp Badge */}
                  <div className="inline-flex items-center gap-2 bg-[#FDE047]/10 text-yellow-300 text-xs font-bold px-3 py-1.5 rounded-full border border-[#FDE047]/20">
                    <Sparkles className="w-4 h-4 text-yellow-400 animate-pulse" />
                    Correspondente Autorizado FEBRABAN & ANEPS
                  </div>

                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight text-white font-sans">
                    A maior e mais rápida plataforma para <span className="bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 bg-clip-text text-transparent">digitar consignados</span>
                  </h1>
                  
                  <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl">
                    Seja um correspondente parceiro da <strong>Jr Crédito e Soluções Financeiras</strong>. Tenha acesso à esteira multi-bancos mais veloz do Brasil, suporte humano ágil, comissão garantida direto no PIX e o melhor painel de controle para sua operação.
                  </p>

                  {/* Trust Bulletpoints */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                      <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400">
                        <Check className="w-4 h-4" />
                      </div>
                      Pré-proposta simplificada e online
                    </div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                      <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400">
                        <Check className="w-4 h-4" />
                      </div>
                      Suporte humano resolutivo
                    </div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                      <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400">
                        <Check className="w-4 h-4" />
                      </div>
                      Comissões apuradas sem pegadinha
                    </div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                      <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400">
                        <Check className="w-4 h-4" />
                      </div>
                      Gestão completa pelo celular ou PC
                    </div>
                  </div>

                  {/* Hero CTA layout */}
                  <div className="flex flex-wrap gap-4 pt-4">
                    <button
                      onClick={() => {
                        setAuthMode("signup");
                        setCurrentPage("auth");
                      }}
                      className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black px-8 py-4 rounded-2xl shadow-xl shadow-amber-500/10 transition-all uppercase text-xs tracking-wider flex items-center gap-2.5 cursor-pointer"
                    >
                      <UserPlus className="w-4.5 h-4.5" />
                      Cadastrar Grátis como Parceiro
                    </button>
                    <button
                      onClick={() => {
                        setAuthMode("login");
                        setCurrentPage("auth");
                      }}
                      className="bg-white/10 hover:bg-white/15 text-white font-bold px-8 py-4 rounded-2xl border border-white/20 transition text-xs uppercase tracking-wider cursor-pointer flex items-center gap-2"
                    >
                      <LogIn className="w-4 h-4" />
                      Acessar Meu Painel
                    </button>
                  </div>
                </div>

                {/* Dashboard mock layout - looks premium & realistic, no raw codes, pure fintech feel */}
                <div className="lg:col-span-5">
                  <div className="bg-white/10 border border-white/20 p-5 rounded-3xl backdrop-blur-lg shadow-2xl relative">
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-emerald-500 text-white font-bold text-[9px] px-2.5 py-1 rounded-full animate-pulse uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 bg-white rounded-full inline-block" /> Estável
                    </div>
                    
                    {/* Mock header */}
                    <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-3">
                      <div className="w-3 h-3 rounded-full bg-red-400" />
                      <div className="w-3 h-3 rounded-full bg-yellow-400" />
                      <div className="w-3 h-3 rounded-full bg-green-400" />
                      <span className="text-[10px] text-slate-400 ml-2 font-mono">painel.jrcredito.com</span>
                    </div>

                    <p className="text-slate-350 text-[10px] font-bold uppercase tracking-widest text-left mb-3">Painel do Corretor Ativo</p>
                    
                    {/* Simulated widgets */}
                    <div className="space-y-3 font-sans text-slate-900">
                      <div className="bg-white p-4 rounded-2xl shadow-sm text-left">
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Faturamento Estimado do Dia</div>
                        <div className="text-2xl font-black text-indigo-950 mt-1">R$ 14.820,50</div>
                        <div className="text-[10px] text-emerald-600 font-bold mt-1 flex items-center gap-1">
                          <span>↑ 18.3% hoje</span>
                          <span className="text-slate-400">— Pago via PIX hoje</span>
                        </div>
                      </div>

                      <div className="bg-slate-900 border border-white/15 p-4 rounded-2xl text-left text-white">
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Status da Ficha Recente</div>
                        <div className="flex justify-between items-center mt-2">
                          <div>
                            <div className="text-xs font-bold text-slate-200">Maria das Graças (INSS)</div>
                            <div className="text-[10px] text-zinc-400">CPF: 129.***.***-01</div>
                          </div>
                          <span className="bg-emerald-500/20 text-emerald-300 font-extrabold text-[9px] px-2 py-0.5 rounded-full border border-emerald-500/30 uppercase tracking-tight">
                            Aprovado Pago
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-left">
                        <div className="bg-white p-3.5 rounded-2xl shadow-xs">
                          <div className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wide">Minha Comissão</div>
                          <div className="text-lg font-black text-emerald-600 mt-0.5">R$ 1.150,00</div>
                        </div>
                        <div className="bg-white p-3.5 rounded-2xl shadow-xs">
                          <div className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wide">Tempo de Análise</div>
                          <div className="text-lg font-black text-indigo-950 mt-0.5">8 min</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* PARTNER LOGOS BAR */}
            <section className="bg-white border-b border-slate-200 py-10">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
                <span className="text-[10px] text-indigo-900 font-black uppercase tracking-widest block opacity-70">
                  PLATAFORMA INTEGRADA COM OS MAIORES REGULADORES E BANCOS DO PAÍS
                </span>
                <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14 opacity-50 transition duration-300">
                  <div className="text-xs md:text-sm font-black text-slate-600 tracking-wider">ANEPS CERTIFICADO</div>
                  <div className="text-xs md:text-sm font-black text-slate-600 tracking-wider">FEBRABAN PARCEIRO</div>
                  <div className="text-xs md:text-sm font-black text-slate-600 tracking-wider">REGISTRO BANCO CENTRAL</div>
                  <div className="text-xs md:text-sm font-black text-slate-600 tracking-wider">OUVIDORIA COMPLIANCE</div>
                </div>
              </div>
            </section>

            {/* SEÇÃO PRINCIPAL DE PRODUTOS E CARDS - SEM SIMULADORES PÚBLICOS */}
            <section id="produtos" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 space-y-12">
              <div className="text-center space-y-3">
                <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  Nossas Linhas de Crédito
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-sans">
                  Produtos Disponíveis para Digitação
                </h2>
                <p className="text-slate-500 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
                  Trabalhamos com ampla gama de convênios para garantir que você tenha sempre a melhor proposta para o seu cliente. Simule e envie propostas direto na plataforma após fazer login como colaborador.
                </p>
              </div>

              {/* Grid 5 Cards (Bolsa Família, Crefaz/Conta de Luz, FGTS, INSS, CLT) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                
                {/* 1. Bolsa Família */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-lg hover:border-indigo-400 transition-all duration-300 flex flex-col justify-between space-y-6">
                  <div className="space-y-4 text-left">
                    <div className="p-3 bg-amber-100 text-amber-700 rounded-2xl w-fit">
                      <Coins className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-950 text-base">Benefício Bolsa Família</h3>
                      <p className="text-slate-500 text-xs leading-relaxed mt-1">
                        Linha sob medida focado em consignados do benefício social nacional permanente.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3 pt-2 text-left">
                    <div className="text-[10px] text-slate-400 italic">
                      Simule e envie propostas direto na plataforma após fazer login como colaborador.
                    </div>
                    <button
                      onClick={() => {
                        setAuthMode("login");
                        setCurrentPage("auth");
                      }}
                      className="w-full bg-slate-900 hover:bg-indigo-900 text-white font-bold py-2 px-3 rounded-xl text-xs transition duration-300 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>Entrar & Simular</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 2. Empréstimo na Conta de Luz */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-lg hover:border-indigo-400 transition-all duration-300 flex flex-col justify-between space-y-6">
                  <div className="space-y-4 text-left">
                    <div className="p-3 bg-yellow-105 bg-amber-50 text-amber-600 rounded-2xl w-fit">
                      <Zap className="w-6 h-6 text-yellow-550" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-950 text-base">Conta de Luz (Crefaz)</h3>
                      <p className="text-slate-500 text-xs leading-relaxed mt-1">
                        Débito direto e parcelado na fatura mensal de energia elétrica. Liberação rápida.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3 pt-2 text-left">
                    <div className="text-[10px] text-slate-400 italic">
                      Simule e envie propostas direto na plataforma após fazer login como colaborador.
                    </div>
                    <button
                      onClick={() => {
                        setAuthMode("login");
                        setCurrentPage("auth");
                      }}
                      className="w-full bg-slate-900 hover:bg-indigo-900 text-white font-bold py-2 px-3 rounded-xl text-xs transition duration-300 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>Entrar & Simular</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 3. Saque Aniversário FGTS */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-lg hover:border-indigo-400 transition-all duration-300 flex flex-col justify-between space-y-6">
                  <div className="space-y-4 text-left">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl w-fit">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-950 text-base">Saque FGTS</h3>
                      <p className="text-slate-500 text-xs leading-relaxed mt-1">
                        Antecipe até 10 parcelas do seu saldo acumulado sem parcelas de carnê mensal.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3 pt-2 text-left">
                    <div className="text-[10px] text-slate-400 italic">
                      Simule e envie propostas direto na plataforma após fazer login como colaborador.
                    </div>
                    <button
                      onClick={() => {
                        setAuthMode("login");
                        setCurrentPage("auth");
                      }}
                      className="w-full bg-slate-900 hover:bg-indigo-900 text-white font-bold py-2 px-3 rounded-xl text-xs transition duration-300 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>Entrar & Simular</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 4. Aposentado & Pensionista INSS */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-lg hover:border-indigo-400 transition-all duration-300 flex flex-col justify-between space-y-6">
                  <div className="space-y-4 text-left">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl w-fit">
                      <Award className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-950 text-base">Consignado INSS</h3>
                      <p className="text-slate-500 text-xs leading-relaxed mt-1">
                        Margens de previdência integradas com as taxas de juros oficias reduzidas.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3 pt-2 text-left">
                    <div className="text-[10px] text-slate-400 italic">
                      Simule e envie propostas direto na plataforma após fazer login como colaborador.
                    </div>
                    <button
                      onClick={() => {
                        setAuthMode("login");
                        setCurrentPage("auth");
                      }}
                      className="w-full bg-slate-900 hover:bg-indigo-900 text-white font-bold py-2 px-3 rounded-xl text-xs transition duration-300 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>Entrar & Simular</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 5. Empréstimo CLT */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-lg hover:border-indigo-400 transition-all duration-300 flex flex-col justify-between space-y-6">
                  <div className="space-y-4 text-left">
                    <div className="p-3 bg-indigo-50 text-indigo-650 text-indigo-700 rounded-2xl w-fit">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-950 text-base">Consignado CLT</h3>
                      <p className="text-slate-500 text-xs leading-relaxed mt-1">
                        Empréstimo direcionado para trabalhadores formais com taxas pactuadas.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3 pt-2 text-left">
                    <div className="text-[10px] text-slate-400 italic">
                      Simule e envie propostas direto na plataforma após fazer login como colaborador.
                    </div>
                    <button
                      onClick={() => {
                        setAuthMode("login");
                        setCurrentPage("auth");
                      }}
                      className="w-full bg-slate-900 hover:bg-indigo-900 text-white font-bold py-2 px-3 rounded-xl text-xs transition duration-300 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>Entrar & Simular</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            </section>

            {/* SEÇÃO "COMO FUNCIONA" - 4 PASSOS */}
            <section id="como-funciona" className="bg-slate-100 py-20 border-y border-slate-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
                <div className="text-center space-y-3">
                  <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    Sem Complicações
                  </span>
                  <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-sans">
                    Como funciona a nossa parceria?
                  </h2>
                  <p className="text-slate-500 text-sm sm:text-base max-w-xl mx-auto">
                    Do cadastro ao recebimento do dinheiro, nosso processo foi desenhado para ser 100% intuitivo.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
                  {/* Step 1 */}
                  <div className="bg-white p-7 rounded-3xl shadow-xs border border-slate-150 relative space-y-4 text-left group hover:-translate-y-1 transition duration-300">
                    <div className="absolute -top-5 left-6 bg-slate-900 text-amber-400 font-extrabold text-xl w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg">
                      01
                    </div>
                    <div className="pt-2">
                      <h3 className="font-extrabold text-slate-900 text-lg">Seja Parceiro</h3>
                      <p className="text-slate-550 text-xs leading-relaxed mt-1">
                        Preencha seu cadastro de corretor/parceiro gratuitamente na Jr Crédito em menos de 2 minutos.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="bg-white p-7 rounded-3xl shadow-xs border border-slate-150 relative space-y-4 text-left group hover:-translate-y-1 transition duration-300">
                    <div className="absolute -top-5 left-6 bg-slate-900 text-amber-400 font-extrabold text-xl w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg">
                      02
                    </div>
                    <div className="pt-2">
                      <h3 className="font-extrabold text-slate-900 text-lg">Capte Clientes</h3>
                      <p className="text-slate-550 text-xs leading-relaxed mt-1">
                        Utilize nossos simuladores dinâmicos exclusivos para realizar cálculos rápidos de propostas a clientes.
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="bg-white p-7 rounded-3xl shadow-xs border border-slate-150 relative space-y-4 text-left group hover:-translate-y-1 transition duration-300">
                    <div className="absolute -top-5 left-6 bg-slate-900 text-amber-400 font-extrabold text-xl w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg">
                      03
                    </div>
                    <div className="pt-2">
                      <h3 className="font-extrabold text-slate-900 text-lg">Acompanhe</h3>
                      <p className="text-slate-550 text-xs leading-relaxed mt-1">
                        Submeta os dados simples de proposta e acompanhe o status da análise em tempo real pelo painel.
                      </p>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="bg-white p-7 rounded-3xl shadow-xs border border-slate-150 relative space-y-4 text-left group hover:-translate-y-1 transition duration-300">
                    <div className="absolute -top-5 left-6 bg-slate-950 text-emerald-400 font-extrabold text-xl w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg">
                      04
                    </div>
                    <div className="pt-2">
                      <h3 className="font-extrabold text-slate-900 text-lg">Receba Comissão</h3>
                      <p className="text-slate-550 text-xs leading-relaxed mt-1">
                        Proposta fechada? Suas comissões transparentes e cheias são faturadas e creditadas no seu PIX.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* SEÇÃO "POR QUE ESCOLHER A JUNIOR CRÉDITO?" */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              
              {/* Left Column Information */}
              <div className="lg:col-span-7 space-y-6 text-left">
                <span className="bg-indigo-150 text-indigo-750 bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  Diferenciais Competitivos
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-none font-sans">
                  Por que escolher a Jr Crédito e Soluções Financeiras?
                </h2>
                <p className="text-slate-500 text-sm sm:text-base leading-relaxed">
                  Não somos apenas mais um agente correspondente. Fornecemos um ecossistema digital sólido para que você consiga digitalizar mais propostas em menos tempo, com suporte integral feito por pessoas reais apaixonadas pelo que fazem.
                </p>

                {/* Grid 4 columns benefits style */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  <div className="flex gap-4 items-start">
                    <div className="bg-indigo-50 text-indigo-600 p-3 rounded-2xl shrink-0 border border-indigo-100">
                      <Shield className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-base">Seriedade Regulamentar</h4>
                      <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">Regularizados sob a normatização federal oficial de correspondência bancária.</p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl shrink-0 border border-emerald-100">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-base">Velocidade Máxima</h4>
                      <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">Análise via robôs emissores agilizados de crédito vinculados.</p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="bg-amber-50 text-amber-600 p-3 rounded-2xl shrink-0 border border-amber-100">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-base">Comissão Transparente</h4>
                      <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">Sua margem calculada e transferida por simulações efetivadas.</p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="bg-blue-50 text-blue-600 p-3 rounded-2xl shrink-0 border border-blue-100">
                      <Phone className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-base">Suporte Humano de Verdade</h4>
                      <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">Dúvidas rápidas atendidas instantaneamente via Whatsapp por nossos técnicos.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column illustrative stats block */}
              <div className="lg:col-span-5">
                <div className="bg-gradient-to-tr from-indigo-950 to-slate-900 rounded-3xl p-8 text-white space-y-6 relative overflow-hidden shadow-xl border border-indigo-500/10">
                  <div className="absolute right-0 top-0 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl" />
                  
                  <h4 className="text-xl font-extrabold text-amber-400 flex items-center gap-1.5 font-sans">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    Segurança & Qualidade Jr
                  </h4>
                  
                  <p className="text-slate-350 text-xs sm:text-sm leading-relaxed text-left">
                    Atuamos com integridade. O respeito ao corretor parceiro e ao cliente mutuário final é nossa maior bandeira. Por isso, oferecemos uma infraestrutura rápida, segura e isenta de taxas abusivas ou surpresas.
                  </p>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10 text-center">
                    <div>
                      <div className="text-2xl font-black text-amber-400 font-mono">+18k</div>
                      <div className="text-[9px] uppercase text-slate-400 font-bold tracking-tight">Vendas Feitas</div>
                    </div>
                    <div>
                      <div className="text-2xl font-black text-amber-400 font-mono">1.70%</div>
                      <div className="text-[9px] uppercase text-slate-400 font-bold tracking-tight">Melhor Taxa INSS</div>
                    </div>
                    <div>
                      <div className="text-2xl font-black text-amber-400 font-mono">100%</div>
                      <div className="text-[9px] uppercase text-slate-400 font-bold tracking-tight">Ambiente Seguro</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* SEÇÃO DE DEPOIMENTOS DE PARCEIROS/COLABORADORES */}
            <section className="bg-slate-100 py-24 border-t border-slate-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
                <div className="text-center space-y-3">
                  <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    Sucesso Provado no WhatsApp
                  </span>
                  <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-sans">
                    Quem usa a nossa ferramenta aprova!
                  </h2>
                  <p className="text-slate-650 text-sm sm:text-base max-w-xl mx-auto">
                    Prints de conversas reais enviadas por corretores e parceiros de todo o Brasil para o nosso suporte humano. Veja a agilidade e transparência!
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch justify-center">
                  
                  {/* WhatsApp Print Chat 1 (Carlos S.) */}
                  <div className="bg-slate-900 p-3 rounded-[40px] border-4 border-slate-800 shadow-2xl max-w-sm mx-auto w-full flex flex-col hover:-translate-y-2 transition duration-300">
                    <div className="bg-[#efeae2] rounded-[30px] overflow-hidden flex flex-col h-[520px] relative font-sans w-full">
                      {/* Top status bar phone */}
                      <div className="bg-[#005e4b] h-7 px-5 flex items-center justify-between text-white/95 text-[10px] font-medium tracking-tight">
                        <span>11:15</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px]">4G</span>
                          <div className="w-4 h-2.5 border border-white/80 rounded-xs p-0.5 flex items-center">
                            <div className="w-full h-full bg-white rounded-2xs" />
                          </div>
                        </div>
                      </div>

                      {/* WhatsApp Header bar */}
                      <div className="bg-[#008069] py-2 px-3 flex items-center justify-between text-white shadow-sm shrink-0">
                        <div className="flex items-center gap-2">
                          <button className="text-white hover:opacity-80 transition select-none">
                            <ChevronRight className="w-5 h-5 rotate-180" />
                          </button>
                          <div className="relative">
                            <div className="w-9 h-9 rounded-full bg-amber-500 text-white font-extrabold flex items-center justify-center text-xs uppercase shadow-xs">
                              CS
                            </div>
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#008069] rounded-full" />
                          </div>
                          <div className="leading-tight text-left">
                            <h4 className="font-extrabold text-xs text-white">Carlos S. (Maceió/AL)</h4>
                            <p className="text-[9px] text-white/80">online</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-white/90">
                          <Video className="w-4 h-4 cursor-pointer hover:text-white" />
                          <Phone className="w-3.5 h-3.5 cursor-pointer hover:text-white" />
                          <MoreVertical className="w-4 h-4 cursor-pointer hover:text-white" />
                        </div>
                      </div>

                      {/* Message area */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 flex flex-col">
                        {/* Day indicator */}
                        <div className="self-center bg-white/85 text-slate-500 text-[9px] font-bold px-3 py-1 rounded-lg uppercase tracking-wider shadow-xs border border-slate-100">
                          Hoje
                        </div>

                        {/* Incoming message (Colaborador) */}
                        <div className="self-start max-w-[85%] bg-white rounded-2xl rounded-tl-none p-3 shadow-sm relative text-left">
                          <p className="text-slate-800 text-xs sm:text-[12.5px] leading-relaxed">
                            Fala pessoal da Jr Crédito! Passando pra agradecer pela parceria de sempre. 🤝
                          </p>
                          <span className="block text-[8px] text-slate-450 text-slate-400 text-right mt-1 font-mono">11:15</span>
                        </div>

                        {/* Incoming message 2 (Colaborador) */}
                        <div className="self-start max-w-[85%] bg-white rounded-2xl rounded-tl-none p-3 shadow-sm relative text-left">
                          <p className="text-slate-800 text-xs sm:text-[12.5px] leading-relaxed">
                            Acabei de ver aqui que a comissão da proposta do Sr. Francisco caiu direto no meu PIX. Menos de 10 minutos após ser paga pelo banco! ⚡😱
                          </p>
                          <span className="block text-[8px] text-slate-450 text-slate-400 text-right mt-1 font-mono">11:16</span>
                        </div>

                        {/* Outgoing message (Jr Crédito) */}
                        <div className="self-end max-w-[85%] bg-[#d9fdd3] rounded-2xl rounded-tr-none p-3 shadow-xs relative text-left">
                          <p className="text-slate-850 text-xs sm:text-[12.5px] leading-relaxed">
                            Grande Carlos! Sensacional!🚀 Esse é o nosso compromisso por aqui: sua comissão faturada e paga o mais rápido possível!
                          </p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className="text-[8px] text-slate-550 font-mono">11:17</span>
                            <CheckCheck className="w-3.5 h-3.5 text-sky-500 inline" />
                          </div>
                        </div>

                        {/* Incoming message 3 (Colaborador) */}
                        <div className="self-start max-w-[85%] bg-white rounded-2xl rounded-tl-none p-3 shadow-sm relative text-left">
                          <p className="text-slate-800 text-xs sm:text-[12.5px] leading-relaxed">
                            Show demais! Nos outros correspondentes eu esperava semanas pelas comissões. Com o painel da Jr Crédito tudo flui muito rápido e transparente. Nota 1000! 👊🔥
                          </p>
                          <span className="block text-[8px] text-slate-450 text-slate-400 text-right mt-1 font-mono">11:18</span>
                        </div>
                      </div>

                      {/* WhatsApp Footer input */}
                      <div className="p-2 flex items-center gap-2 bg-[#efeae2] shrink-0 border-t border-slate-200/50">
                        <div className="flex-1 bg-white rounded-full py-2 px-3 flex items-center gap-2 shadow-xs border border-zinc-200">
                          <Smile className="w-4 h-4 text-slate-400 cursor-pointer" />
                          <span className="text-xs text-slate-400 flex-1 text-left font-sans">Mensagem</span>
                          <Paperclip className="w-4 h-4 text-slate-400 cursor-pointer -rotate-45" />
                        </div>
                        <div className="w-9 h-9 bg-[#00a884] rounded-full flex items-center justify-center text-white cursor-pointer hover:bg-[#008f72] transition shrink-0">
                          <Mic className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* WhatsApp Print Chat 2 (Mariana L.) */}
                  <div className="bg-slate-900 p-3 rounded-[40px] border-4 border-slate-800 shadow-2xl max-w-sm mx-auto w-full flex flex-col hover:-translate-y-2 transition duration-300">
                    <div className="bg-[#efeae2] rounded-[30px] overflow-hidden flex flex-col h-[520px] relative font-sans w-full">
                      {/* Top status bar phone */}
                      <div className="bg-[#005e4b] h-7 px-5 flex items-center justify-between text-white/95 text-[10px] font-medium tracking-tight">
                        <span>14:30</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px]">4G</span>
                          <div className="w-4 h-2.5 border border-white/80 rounded-xs p-0.5 flex items-center">
                            <div className="w-full h-full bg-white rounded-2xs" />
                          </div>
                        </div>
                      </div>

                      {/* WhatsApp Header bar */}
                      <div className="bg-[#008069] py-2 px-3 flex items-center justify-between text-white shadow-sm shrink-0">
                        <div className="flex items-center gap-2">
                          <button className="text-white hover:opacity-80 transition select-none">
                            <ChevronRight className="w-5 h-5 rotate-180" />
                          </button>
                          <div className="relative">
                            <div className="w-9 h-9 rounded-full bg-indigo-600 text-white font-extrabold flex items-center justify-center text-xs uppercase shadow-xs">
                              ML
                            </div>
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#008069] rounded-full" />
                          </div>
                          <div className="leading-tight text-left">
                            <h4 className="font-extrabold text-xs text-white">Mariana L. (São Paulo/SP)</h4>
                            <p className="text-[9px] text-white/80">online</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-white/90">
                          <Video className="w-4 h-4 cursor-pointer hover:text-white" />
                          <Phone className="w-3.5 h-3.5 cursor-pointer hover:text-white" />
                          <MoreVertical className="w-4 h-4 cursor-pointer hover:text-white" />
                        </div>
                      </div>

                      {/* Message area */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 flex flex-col">
                        {/* Day indicator */}
                        <div className="self-center bg-white/85 text-slate-500 text-[9px] font-bold px-3 py-1 rounded-lg uppercase tracking-wider shadow-xs border border-slate-100">
                          Hoje
                        </div>

                        {/* Incoming message (Colaborador) */}
                        <div className="self-start max-w-[85%] bg-white rounded-2xl rounded-tl-none p-3 shadow-sm relative text-left">
                          <p className="text-slate-800 text-xs sm:text-[12.5px] leading-relaxed">
                            Gente, os novos simuladores internos de FGTS e de Conta de Luz dentro do painel do colaborador estão simplesmente espetaculares!!! 😍🙌
                          </p>
                          <span className="block text-[8px] text-slate-450 text-slate-400 text-right mt-1 font-mono">14:30</span>
                        </div>

                        {/* Outgoing message (Jr Crédito) */}
                        <div className="self-end max-w-[85%] bg-[#d9fdd3] rounded-2xl rounded-tr-none p-3 shadow-xs relative text-left">
                          <p className="text-slate-855 text-xs sm:text-[12.5px] leading-relaxed">
                            Ficamos muito felizes, Mariana! Desenvolvemos o novo layout para estimar as parcelas e os juros com total precisão diretamente na frente do cliente. ⚡💻
                          </p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className="text-[8px] text-slate-550 font-mono">14:32</span>
                            <CheckCheck className="w-3.5 h-3.5 text-sky-500 inline" />
                          </div>
                        </div>

                        {/* Incoming message (Colaborador) */}
                        <div className="self-start max-w-[85%] bg-white rounded-2xl rounded-tl-none p-3 shadow-sm relative text-left">
                          <p className="text-slate-800 text-xs sm:text-[12.5px] leading-relaxed">
                            Sim, ajudou demais a fechar venda na hora! Minha equipe de promotores de vendas consegue simular na mesa com o cliente e saber o valor exato no ato. O faturamento aumentou muito esse mês! 🚀📈
                          </p>
                          <span className="block text-[8px] text-slate-450 text-slate-400 text-right mt-1 font-mono">14:33</span>
                        </div>

                        {/* Outgoing message (Jr Crédito) */}
                        <div className="self-end max-w-[85%] bg-[#d9fdd3] rounded-2xl rounded-tr-none p-3 shadow-xs relative text-left">
                          <p className="text-slate-855 text-xs sm:text-[12.5px] leading-relaxed">
                            E vem mais novidade por aí! Tamo junto na parceria! 💪🏆
                          </p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className="text-[8px] text-slate-550 font-mono">14:35</span>
                            <CheckCheck className="w-3.5 h-3.5 text-sky-500 inline" />
                          </div>
                        </div>
                      </div>

                      {/* WhatsApp Footer input */}
                      <div className="p-2 flex items-center gap-2 bg-[#efeae2] shrink-0 border-t border-slate-200/50">
                        <div className="flex-1 bg-white rounded-full py-2 px-3 flex items-center gap-2 shadow-xs border border-zinc-200">
                          <Smile className="w-4 h-4 text-slate-400 cursor-pointer" />
                          <span className="text-xs text-slate-400 flex-1 text-left font-sans">Mensagem</span>
                          <Paperclip className="w-4 h-4 text-slate-400 cursor-pointer -rotate-45" />
                        </div>
                        <div className="w-9 h-9 bg-[#00a884] rounded-full flex items-center justify-center text-white cursor-pointer hover:bg-[#008f72] transition shrink-0">
                          <Mic className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* WhatsApp Print Chat 3 (Everton J.) */}
                  <div className="bg-slate-900 p-3 rounded-[40px] border-4 border-slate-800 shadow-2xl max-w-sm mx-auto w-full flex flex-col hover:-translate-y-2 transition duration-300">
                    <div className="bg-[#efeae2] rounded-[30px] overflow-hidden flex flex-col h-[520px] relative font-sans w-full">
                      {/* Top status bar phone */}
                      <div className="bg-[#005e4b] h-7 px-5 flex items-center justify-between text-white/95 text-[10px] font-medium tracking-tight">
                        <span>09:41</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px]">4G</span>
                          <div className="w-4 h-2.5 border border-white/80 rounded-xs p-0.5 flex items-center">
                            <div className="w-full h-full bg-white rounded-2xs" />
                          </div>
                        </div>
                      </div>

                      {/* WhatsApp Header bar */}
                      <div className="bg-[#008069] py-2 px-3 flex items-center justify-between text-white shadow-sm shrink-0">
                        <div className="flex items-center gap-2">
                          <button className="text-white hover:opacity-80 transition select-none">
                            <ChevronRight className="w-5 h-5 rotate-180" />
                          </button>
                          <div className="relative">
                            <div className="w-9 h-9 rounded-full bg-purple-600 text-white font-extrabold flex items-center justify-center text-xs uppercase shadow-xs">
                              EJ
                            </div>
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#008069] rounded-full" />
                          </div>
                          <div className="leading-tight text-left">
                            <h4 className="font-extrabold text-xs text-white">Everton J. (Porto Alegre/RS)</h4>
                            <p className="text-[9px] text-white/80">online</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-white/90">
                          <Video className="w-4 h-4 cursor-pointer hover:text-white" />
                          <Phone className="w-3.5 h-3.5 cursor-pointer hover:text-white" />
                          <MoreVertical className="w-4 h-4 cursor-pointer hover:text-white" />
                        </div>
                      </div>

                      {/* Message area */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 flex flex-col">
                        {/* Day indicator */}
                        <div className="self-center bg-white/85 text-slate-500 text-[9px] font-bold px-3 py-1 rounded-lg uppercase tracking-wider shadow-xs border border-slate-100">
                          Hoje
                        </div>

                        {/* Incoming message (Colaborador) */}
                        <div className="self-start max-w-[85%] bg-white rounded-2xl rounded-tl-none p-3 shadow-sm relative text-left">
                          <p className="text-slate-800 text-xs sm:text-[12.5px] leading-relaxed">
                            Bom dia gente! Tudo bom? Conseguem me dar um help com o status da proposta nº 5824 do INSS? O cliente tá cobrando.
                          </p>
                          <span className="block text-[8px] text-slate-450 text-slate-400 text-right mt-1 font-mono">09:41</span>
                        </div>

                        {/* Outgoing message (Jr Crédito) */}
                        <div className="self-end max-w-[85%] bg-[#d9fdd3] rounded-2xl rounded-tr-none p-3 shadow-xs relative text-left">
                          <p className="text-slate-855 text-xs sm:text-[12.5px] leading-relaxed">
                            Bom dia Everton! Já consultamos aqui com a nossa mesa. A averbação foi concluída com sucesso e o banco já confirmou o pagamento em conta do cliente! 🥳✅
                          </p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className="text-[8px] text-slate-550 font-mono">09:43</span>
                            <CheckCheck className="w-3.5 h-3.5 text-sky-500 inline" />
                          </div>
                        </div>

                        {/* Incoming message (Colaborador) */}
                        <div className="self-start max-w-[85%] bg-white rounded-2xl rounded-tl-none p-3 shadow-sm relative text-left">
                          <p className="text-slate-800 text-xs sm:text-[12.5px] leading-relaxed">
                            Nossa, que suporte super rápido de verdade!!! Outros correspondentes demoram horas ou até o dia todo pra dar um retorno assim. Vocês são fora da curva! 👏👏👏
                          </p>
                          <span className="block text-[8px] text-slate-450 text-slate-400 text-right mt-1 font-mono">09:44</span>
                        </div>

                        {/* Outgoing message (Jr Crédito) */}
                        <div className="self-end max-w-[85%] bg-[#d9fdd3] rounded-2xl rounded-tr-none p-3 shadow-xs relative text-left">
                          <p className="text-slate-855 text-xs sm:text-[12.5px] leading-relaxed">
                            Aqui o suporte é humano de verdade e em tempo recorde pra você não perder nenhuma venda! Conte conosco! 🚀
                          </p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className="text-[8px] text-slate-550 font-mono">09:45</span>
                            <CheckCheck className="w-3.5 h-3.5 text-sky-500 inline" />
                          </div>
                        </div>
                      </div>

                      {/* WhatsApp Footer input */}
                      <div className="p-2 flex items-center gap-2 bg-[#efeae2] shrink-0 border-t border-slate-200/50">
                        <div className="flex-1 bg-white rounded-full py-2 px-3 flex items-center gap-2 shadow-xs border border-zinc-200">
                          <Smile className="w-4 h-4 text-slate-400 cursor-pointer" />
                          <span className="text-xs text-slate-400 flex-1 text-left font-sans">Mensagem</span>
                          <Paperclip className="w-4 h-4 text-slate-400 cursor-pointer -rotate-45" />
                        </div>
                        <div className="w-9 h-9 bg-[#00a884] rounded-full flex items-center justify-center text-white cursor-pointer hover:bg-[#008f72] transition shrink-0">
                          <Mic className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </section>

            {/* CALL TO ACTION BANNER FINAL FORTE */}
            <section className="bg-indigo-950 text-white py-20 relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,#1e1b4b,transparent_60%)] opacity-80" />
              <div className="absolute -right-20 -top-20 w-80 h-80 bg-amber-400/10 rounded-full blur-3xl" />
              
              <div className="max-w-4xl mx-auto text-center space-y-8 px-4 relative z-10">
                <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight font-sans">
                  Pronto para decolar o seu faturamento com crédito?
                </h2>
                <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
                  Junte-se a mais de 15.000 correspondentes que confiam suas propostas e recebem comissões transparentes todos os dias. Cadastre sua conta na Jr Crédito grátis.
                </p>

                <div className="flex flex-wrap justify-center gap-4">
                  <button
                    onClick={() => {
                      setAuthMode("signup");
                      setCurrentPage("auth");
                    }}
                    className="bg-amber-400 hover:bg-amber-500 text-[#020617] font-black px-8 py-4 rounded-xl shadow-xl transition-all uppercase text-xs tracking-wider cursor-pointer"
                  >
                    Começar Cadastro Agora
                  </button>
                  <button
                    onClick={() => {
                      setAuthMode("login");
                      setCurrentPage("auth");
                    }}
                    className="bg-white/10 hover:bg-white/20 text-white font-bold px-8 py-4 rounded-xl border border-white/20 transition text-xs uppercase tracking-wider cursor-pointer"
                  >
                    Acessar Conta de Corretor
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* 2. INSTITUTIONAL PAGE (SOBRE NÓS) */}
        {currentPage === "sobre" && (
          <div className="max-w-4xl mx-auto py-16 px-4 space-y-12 animate-fade-in">
            <div className="text-center space-y-3">
              <span className="bg-gold/10 text-gold-dark text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                Quem Somos
              </span>
              <h2 className="text-4xl font-black text-slate-900 tracking-tight">JR Crédito e Soluções Financeiras</h2>
              <p className="text-slate-500 text-sm max-w-lg mx-auto">
                Uma trajetória de solidez, confiança e integridade no mercado nacional de correspondência bancária.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100 space-y-6 text-slate-600 text-sm leading-relaxed">
              <h3 className="text-lg font-bold text-slate-900">Missão, Visão e Valores</h3>
              <p>
                A JR Crédito e Soluções Financeiras iniciou suas atividades com um propósito simples porém impactante: humanizar o acesso ao crédito consignado e benefícios no Brasil, especialmente para as parcelas populacionais ligadas ao INSS e ao Bolsa Família.
              </p>
              <p>
                Trabalhamos incansavelmente para democratizar taxas, remover barreiras burocráticas e fornecer simulações rápidas e eficazes por meio de modernas ferramentas em tempo real. Nossa força está na tecnologia aliada a uma profunda ética regulamentar.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                <div className="bg-slate-50 p-5 rounded-2xl border text-center space-y-2">
                  <div className="font-extrabold text-gold-dark">Confiança</div>
                  <p className="text-xs text-slate-500">Garantimos a proteção total de dados econômicos sob a égide da LGPD.</p>
                </div>
                <div className="bg-slate-50 p-5 rounded-2xl border text-center space-y-2">
                  <div className="font-extrabold text-gold-dark">Praticidade</div>
                  <p className="text-xs text-slate-500">Sua simulação e sua liberação de caixa são feitas 100% online.</p>
                </div>
                <div className="bg-slate-50 p-5 rounded-2xl border text-center space-y-2">
                  <div className="font-extrabold text-gold-dark">Inovação</div>
                  <p className="text-xs text-slate-500">Desenvolvemos algoritmos inteligentes de pré-aprovação rápida.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. PORTAL DO CLIENTE */}
        {currentPage === "client_portal" && (
          <ClientPanel systemConfig={systemConfig} />
        )}

        {/* 4. AUTHENTICATION PAGES FOR COLABORADORES */}
        {currentPage === "auth" && (
          <div className="max-w-md mx-auto py-16 px-4 animate-fade-in">
            <div className="bg-white rounded-3xl p-8 shadow-2xl border border-slate-100 space-y-6">
              
              {/* Logo / Introdução */}
              <div className="text-center space-y-2">
                <div className="bg-gradient-to-tr from-gold-dark to-gold w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-dark-primary text-xl mx-auto shadow-md">
                  JR
                </div>
                {authMode === "login" && (
                  <>
                    <h3 className="text-xl font-bold text-slate-900">Acesse o Canal de Vendas</h3>
                    <p className="text-xs text-slate-400">Entre com seu e-mail e senha de corretor credenciado.</p>
                  </>
                )}
                {authMode === "signup" && (
                  <>
                    <h3 className="text-xl font-bold text-slate-900">Cadastre-se como Corretor</h3>
                    <p className="text-xs text-slate-400">Solicite sua afiliação e comece a gerar comissões.</p>
                  </>
                )}
                {authMode === "reset" && (
                  <>
                    <h3 className="text-xl font-bold text-slate-900">Recupere Sua Senha</h3>
                    <p className="text-xs text-slate-400">Enviaremos em tempo real o link de recuperação.</p>
                  </>
                )}
              </div>

              {/* Mensagens de Feedback */}
              {authError && (
                <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl border border-red-100 text-xs font-bold leading-normal">
                  ⚠️ {authError}
                </div>
              )}
              {authSuccessMsg && (
                <div className="bg-blue-50 text-blue-800 px-4 py-3 rounded-xl border border-blue-100 text-xs font-bold leading-normal">
                  ✓ {authSuccessMsg}
                </div>
              )}

              {/* FORMULÁRIO DE LOGIN */}
              {authMode === "login" && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2">E-mail Corporativo</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seuemail@jrcredito.com.br"
                      className="w-full text-slate-800 bg-slate-50 border px-3 py-2 rounded-xl focus:bg-white focus:border-gold text-sm outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Senha de Acesso</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="******"
                      className="w-full text-slate-800 bg-slate-50 border px-3 py-2 rounded-xl focus:bg-white focus:border-gold text-sm outline-none"
                    />
                  </div>

                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => setAuthMode("reset")}
                      className="text-xs text-slate-450 hover:text-gold hover:underline font-semibold"
                    >
                      Esqueci minha senha
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loadingAuth}
                    className="w-full bg-slate-900 hover:bg-slate-850 text-white font-bold py-3 px-4 rounded-xl text-sm transition tracking-wider uppercase cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {loadingAuth ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <LogIn className="w-4 h-4 text-gold" />
                        Acessar Minha Carteira
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* FORMULÁRIO DE INSCRIÇÃO CORRETOR */}
              {authMode === "signup" && (
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Seu Nome Completo</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Carlos Roberto Santos"
                      className="w-full text-slate-800 bg-slate-50 border px-3 py-2 rounded-xl text-sm outline-none focus:bg-white focus:border-gold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">WhatsApp de Vendas</label>
                    <input
                      type="text"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(00) 00000-0000"
                      className="w-full text-slate-800 bg-slate-50 border px-3 py-2 rounded-xl text-sm outline-none focus:bg-white focus:border-gold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">E-mail</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Ex: corretor@email.com"
                      className="w-full text-slate-800 bg-slate-50 border px-3 py-2 rounded-xl text-sm outline-none focus:bg-white focus:border-gold"
                    />
                  </div>

                  <div>
                     <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 font-bold">Defina Uma Senha</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full text-slate-800 bg-slate-50 border px-3 py-2 rounded-xl text-sm outline-none focus:bg-white focus:border-gold"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loadingAuth}
                    className="w-full bg-gradient-to-r from-gold-dark to-gold text-white font-extrabold py-3 px-4 rounded-xl text-sm transition uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {loadingAuth ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        Cadastrar no Sistema
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* FORM DE RECUPERAÇÃO */}
              {authMode === "reset" && (
                <form onSubmit={handlePasswordReset} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Digite Seu E-mail Cadastrado</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="financeiro@empresa.com"
                      className="w-full text-slate-800 bg-slate-50 border px-3 py-2 rounded-xl text-sm outline-none focus:bg-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loadingAuth}
                    className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl text-sm tracking-wider uppercase cursor-pointer"
                  >
                    {loadingAuth ? "Enviando..." : "Enviar Link de Recuperação"}
                  </button>
                </form>
              )}

              {/* Alterne entre os fluxos */}
              <div className="text-center pt-3 border-t text-xs space-y-2">
                {authMode === "login" ? (
                  <p className="text-slate-500 font-medium">
                    Novo corretor?{" "}
                    <button onClick={() => setAuthMode("signup")} className="text-gold-dark hover:underline font-bold cursor-pointer">
                      Cadastre-se aqui
                    </button>
                  </p>
                ) : (
                  <p className="text-slate-500 font-medium">
                    Já possui conta credenciada?{" "}
                    <button onClick={() => setAuthMode("login")} className="text-gold-dark hover:underline font-bold cursor-pointer">
                      Faça login aqui
                    </button>
                  </p>
                )}
              </div>

            </div>
          </div>
        )}

        {/* 5. PORTAL WORKSPACE DO COLABORADOR */}
        {currentPage === "colab_portal" && (
          <div>
            {!profile ? (
              <div className="max-w-md mx-auto py-16 text-center space-y-4 font-bold text-slate-700">
                Acesse sua conta para ver este painel.
              </div>
            ) : profile.role !== "colaborador" && profile.role !== "admin" ? (
              <div className="max-w-md mx-auto py-16 text-center space-y-4">
                <p className="font-bold text-red-650">Acesso Restrito a Correspondentes Credenciados.</p>
                <button onClick={() => setCurrentPage("home")} className="text-gold underline font-bold">Ir para Home</button>
              </div>
            ) : (
              <ColaboradorPanel userProfile={profile} systemConfig={systemConfig} />
            )}
          </div>
        )}

        {/* 6. PORTAL WORKSPACE DO ADMINISTRADOR */}
        {currentPage === "admin_portal" && (
          <div>
            {!profile ? (
              <div className="max-w-md mx-auto py-16 text-center space-y-4 font-bold text-slate-700">
                Faça login para gerenciar o sistema.
              </div>
            ) : profile.role !== "admin" ? (
              <div className="max-w-md mx-auto py-16 text-center text-red-650 space-y-4 font-bold">
                ⚠️ Acesso restrito apenas ao Administrador Master!
              </div>
            ) : (
              <AdminPanel 
                userProfile={profile} 
                systemConfig={systemConfig} 
                onUpdateSystemConfig={(newConf) => setSystemConfig(newConf)} 
              />
            )}
          </div>
        )}

      </div>

      {/* FOOTER PREMIUM INSTITUCIONAL */}
      <footer className="bg-dark-primary text-slate-400 py-12 border-t border-gold/15 transition-all text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Col 1 */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-tr from-gold-dark to-gold w-8 h-8 rounded-lg flex items-center justify-center font-bold text-dark-primary text-sm">
                JR
              </div>
              <span className="text-sm font-extrabold text-white tracking-widest block font-sans">
                JR CRÉDITO
              </span>
            </div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              JR Crédito e Soluções Financeiras Ltda. Correspondente Bancário Oficial focado em empréstimos e convênios nacionais com taxas competitivas.
            </p>
          </div>

          {/* Col 2 */}
          <div className="space-y-3">
            <h4 className="text-white font-bold tracking-widest uppercase text-[10px]">Links Principais</h4>
            <div className="space-y-2 flex flex-col items-start font-medium">
              <button onClick={() => setCurrentPage("home")} className="hover:text-gold transition text-left cursor-pointer">Início</button>
              <button onClick={() => setCurrentPage("sobre")} className="hover:text-gold transition text-left cursor-pointer">Sobre Nós</button>
              <button onClick={() => setCurrentPage("client_portal")} className="hover:text-gold transition text-left cursor-pointer">Área do Cliente</button>
              <button onClick={() => { setAuthMode("login"); setCurrentPage("auth"); }} className="hover:text-gold transition text-left cursor-pointer">Acesso Restrito</button>
            </div>
          </div>

          {/* Col 3 */}
          <div className="space-y-3">
            <h4 className="text-white font-bold tracking-widest uppercase text-[10px]">Canais Oficiais</h4>
            <div className="space-y-2 flex flex-col items-start font-medium leading-relaxed font-mono">
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-gold shrink-0" />
                Dúvidas: (11) 99999-9999
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gold shrink-0" />
                Seg a Sex: 08h to 18h
              </span>
            </div>
          </div>

          {/* Col 4 */}
          <div className="space-y-3">
            <h4 className="text-white font-bold tracking-widest uppercase text-[10px]">Nota de Governança</h4>
            <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
              * A JR Crédito não é uma instituição financeira direta. Atuamos estritamente como agente correspondente cadastrado em bancos parceiros oficiais em conformidade com a Resolução nº 4.935 do Banco Central do Brasil.
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 pt-6 border-t border-slate-800 text-center text-[10px] text-slate-500 font-semibold uppercase tracking-wider space-y-1">
          <div>© {new Date().getFullYear()} JR CRÉDITO E SOLUÇÕES FINANCEIRAS LTDA. TODOS OS DIREITOS RESERVADOS.</div>
          <div>CNPJ sob nº 00.345.987/0001-01 - Endereço Escritório Master.</div>
        </div>
      </footer>
    </div>
  );
}
