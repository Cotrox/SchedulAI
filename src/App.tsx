/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { GoogleGenAI, Type } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { 
  Calendar as CalendarIcon, 
  MessageSquare, 
  Settings, 
  LogOut, 
  Plus, 
  Trash2, 
  X,
  CheckCircle, 
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  CreditCard,
  Zap,
  Droplets,
  Flame,
  ShieldCheck,
  Car,
  BarChart3
} from "lucide-react";
import { format, addMonths, addYears, parseISO, isSameMonth, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, isToday, startOfYear, endOfYear, eachMonthOfInterval } from "date-fns";
import { cn } from "./lib/utils";
import type { User, Deadline, ChatMessage } from "./types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const CATEGORIES = [
  { id: "luce", name: "Luce", icon: Zap, color: "text-yellow-400 bg-yellow-400/10" },
  { id: "gas", name: "Gas", icon: Flame, color: "text-orange-400 bg-orange-400/10" },
  { id: "acqua", name: "Acqua", icon: Droplets, color: "text-blue-400 bg-blue-400/10" },
  { id: "spazzatura", name: "TARI", icon: Trash2, color: "text-green-400 bg-green-400/10" },
  { id: "bollo", name: "Bollo Auto", icon: Car, color: "text-red-400 bg-red-400/10" },
  { id: "assicurazione", name: "Assicurazione", icon: ShieldCheck, color: "text-purple-400 bg-purple-400/10" },
  { id: "altro", name: "Altro", icon: CreditCard, color: "text-gray-400 bg-gray-400/10" },
];

const TODAY = new Date(2026, 2, 26);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [view, setView] = useState<"auth" | "onboarding" | "chat" | "calendar" | "profile" | "budgets">("auth");
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingAmount, setOnboardingAmount] = useState("");
  const [onboardingDate, setOnboardingDate] = useState("");
  const [currentMonth, setCurrentMonth] = useState(TODAY);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isDeadlineFormOpen, setIsDeadlineFormOpen] = useState(false);
  const [chatInputValue, setChatInputValue] = useState("");
  const [deadlineForm, setDeadlineForm] = useState({
    title: "",
    amount: "",
    date: format(TODAY, "yyyy-MM-dd"),
    category: "altro",
    currency: "€"
  });
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auth logic
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);

  useEffect(() => {
    if (token) {
      fetchDeadlines();
      fetchProfile();
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      if (!user.onboarded) {
        setView("onboarding");
      } else if (view === "auth" || view === "onboarding") {
        setView("chat");
      }
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/profile", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      }
    } catch (err) {
      console.error("Failed to fetch profile", err);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchDeadlines = async () => {
    try {
      const res = await fetch("/api/deadlines", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDeadlines(data);
      }
    } catch (err) {
      console.error("Failed to fetch deadlines", err);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/signup";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("token", data.token);
        setToken(data.token);
        setUser(data.user);
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert("Auth failed");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setView("auth");
  };

  const handleDeleteAccount = async () => {
    if (!confirm("Sei sicuro di voler eliminare il tuo account? Questa azione è irreversibile e tutti i tuoi dati verranno persi.")) return;
    
    try {
      const res = await fetch("/api/profile", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        handleLogout();
      }
    } catch (err) {
      alert("Errore durante l'eliminazione dell'account");
    }
  };

  const toggleNotifications = async () => {
    if (!user) return;
    const newValue = !user.emailNotifications;
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ emailNotifications: newValue })
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      }
    } catch (err) {
      console.error("Failed to update profile", err);
    }
  };

  const handleOnboardingNext = async (skip = false) => {
    if (!skip && onboardingAmount && onboardingDate) {
      await addDeadline({
        title: CATEGORIES[onboardingStep].name,
        amount: parseFloat(onboardingAmount),
        dueDate: onboardingDate,
        category: CATEGORIES[onboardingStep].id,
        frequency: onboardingStep > 3 ? "annual" : "monthly" // Simple heuristic
      });
    }
    
    setOnboardingAmount("");
    setOnboardingDate("");

    if (onboardingStep < CATEGORIES.length - 1) {
      setOnboardingStep(prev => prev + 1);
    } else {
      // Mark as onboarded in DB
      try {
        const res = await fetch("/api/profile", {
          method: "PUT",
          headers: { 
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ onboarded: true })
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data);
          setView("chat");
          addInitialMessage();
        }
      } catch (err) {
        console.error("Failed to update onboarding status", err);
        // Fallback
        setView("chat");
        addInitialMessage();
      }
    }
  };

  const addInitialMessage = () => {
    setMessages([
      { role: "model", text: "Ciao! Sono Sched, il tuo assistente per le scadenze. Come posso aiutarti oggi? Puoi chiedermi di aggiungere un pagamento, vedere il calendario o semplicemente fare due chiacchiere sulle bollette (che gioia, vero? 😅)." }
    ]);
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    const newMessages: ChatMessage[] = [...messages, { role: "user", text }];
    setMessages(newMessages);
    setIsTyping(true);

    try {
      const tools = [
        {
          functionDeclarations: [
            {
              name: "add_deadline",
              description: "Aggiunge una nuova scadenza di pagamento al calendario.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "Titolo della scadenza (es. Bolletta Luce)" },
                  amount: { type: Type.NUMBER, description: "Importo in Euro" },
                  dueDate: { type: Type.STRING, description: "Data di scadenza in formato YYYY-MM-DD" },
                  category: { type: Type.STRING, description: "Categoria (luce, gas, acqua, spazzatura, bollo, assicurazione, altro)" },
                  frequency: { type: Type.STRING, enum: ["monthly", "annual", "one-time"], description: "Frequenza del pagamento" }
                },
                required: ["title", "amount", "dueDate", "category"]
              }
            },
            {
              name: "delete_deadline",
              description: "Rimuove una scadenza esistente.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "L'ID della scadenza da rimuovere" }
                },
                required: ["id"]
              }
            }
          ]
        }
      ];

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { role: "user", parts: [{ text: `DATI ATTUALI DELL'UTENTE: ${JSON.stringify(deadlines)}\n\nPROMPT UTENTE: ${text}` }] }
        ],
        config: {
          systemInstruction: `Sei Sched, un assistente AI simpatico, ironico e moderno per la gestione delle scadenze di pagamento in Italia. 
          Il tuo compito è aiutare l'utente a gestire bollette (luce, gas, acqua, TARI), bollo auto, assicurazioni e altri pagamenti.
          Sii amichevole, usa emoji, e ogni tanto fai qualche battuta sul costo della vita o sulla burocrazia italiana.
          Se l'utente vuole aggiungere, modificare o rimuovere una scadenza, usa le funzioni fornite.
          Rispondi SEMPRE in italiano.`,
          tools: tools
        }
      });

      const calls = response.functionCalls;

      if (calls && calls.length > 0) {
        for (const call of calls) {
          if (call.name === "add_deadline") {
            await addDeadline(call.args as any);
          } else if (call.name === "delete_deadline") {
            await deleteDeadline((call.args as any).id);
          }
        }
        
        // Follow up to confirm
        const followUp = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [
            { role: "user", parts: [{ text: "Ho eseguito l'azione richiesta. Conferma all'utente in modo simpatico." }] }
          ],
          config: {
            systemInstruction: "Sei Sched. Conferma l'azione eseguita con il tuo solito tono ironico e amichevole."
          }
        });
        setMessages([...newMessages, { role: "model", text: followUp.text || "Fatto! Ho aggiornato tutto. 😉" }]);
      } else {
        setMessages([...newMessages, { role: "model", text: response.text || "Non ho capito bene, puoi ripetere? 🤖" }]);
      }

    } catch (err) {
      console.error(err);
      setMessages([...newMessages, { role: "model", text: "Ops! Qualcosa è andato storto nei miei circuiti. Riprova tra un attimo! 🤖" }]);
    } finally {
      setIsTyping(false);
    }
  };

  const deleteDeadline = async (id: string) => {
    try {
      const res = await fetch(`/api/deadlines/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchDeadlines();
    } catch (err) {
      console.error(err);
    }
  };

  const addDeadline = async (deadline: Partial<Deadline>) => {
    try {
      const res = await fetch("/api/deadlines", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: deadline.title || "Nuova Scadenza",
          amount: deadline.amount || 0,
          dueDate: deadline.dueDate || format(new Date(), "yyyy-MM-dd"),
          frequency: deadline.frequency || "monthly",
          lastPaidDate: deadline.lastPaidDate || "",
          category: deadline.category || "altro"
        })
      });
      if (res.ok) fetchDeadlines();
    } catch (err) {
      console.error(err);
    }
  };

  // Views
  if (!token || view === "auth") {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center mb-4 rotate-3 shadow-lg shadow-orange-500/20">
              <Sparkles className="text-white w-8 h-8" />
            </div>
            <h1 className="text-4xl font-black tracking-tighter italic">SchedulAI</h1>
            <p className="text-zinc-400 text-sm mt-2">Il tuo portafoglio ti ringrazierà (forse).</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-1 ml-1">Email</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-colors"
                placeholder="tu@esempio.it"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-1 ml-1">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-colors"
                placeholder="••••••••"
                required
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-xl transition-all transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-orange-500/20"
            >
              {isLogin ? "Entra ora" : "Crea Account"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-zinc-500 hover:text-white text-sm transition-colors"
            >
              {isLogin ? "Non hai un account? Registrati" : "Hai già un account? Accedi"}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (view === "onboarding") {
    const currentCat = CATEGORIES[onboardingStep];
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
        <motion.div 
          key={onboardingStep}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          className="w-full max-w-lg bg-zinc-900 border border-zinc-800 p-8 rounded-[2rem] relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-zinc-800">
            <motion.div 
              className="h-full bg-orange-500"
              initial={{ width: 0 }}
              animate={{ width: `${((onboardingStep + 1) / CATEGORIES.length) * 100}%` }}
            />
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div className={cn("p-4 rounded-2xl", currentCat.color)}>
              <currentCat.icon className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Configuriamo: {currentCat.name}</h2>
              <p className="text-zinc-400">Sched vuole sapere quando scade!</p>
            </div>
          </div>

          <div className="space-y-6">
            <p className="text-lg italic text-zinc-300">
              "Ehi! Hai una scadenza per {currentCat.name.toLowerCase()}? Se sì, dimmi quanto paghi di solito e quando scade la prossima volta."
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-zinc-500">Importo (€)</label>
                <input 
                  type="number" 
                  value={onboardingAmount}
                  onChange={(e) => setOnboardingAmount(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3" 
                  placeholder="0.00" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-zinc-500">Prossima Scadenza</label>
                <input 
                  type="date" 
                  value={onboardingDate}
                  onChange={(e) => setOnboardingDate(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3" 
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => handleOnboardingNext(true)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-4 rounded-xl font-bold transition-colors"
              >
                Non ce l'ho
              </button>
              <button 
                onClick={() => handleOnboardingNext(false)}
                className="flex-1 bg-orange-500 hover:bg-orange-600 py-4 rounded-xl font-bold transition-all shadow-lg shadow-orange-500/20"
              >
                Salva e Avanti
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans">
      {/* Header */}
      <header className="h-20 border-bottom border-zinc-800 flex items-center justify-between px-6 bg-zinc-950/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center rotate-3">
            <Sparkles className="text-white w-5 h-5" />
          </div>
          <h1 className="text-2xl font-black italic tracking-tighter">SchedulAI</h1>
        </div>

        <nav className="flex items-center gap-2 bg-zinc-900 p-1 rounded-2xl border border-zinc-800">
          <button 
            onClick={() => setView("chat")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
              view === "chat" ? "bg-orange-500 text-white" : "text-zinc-400 hover:text-white"
            )}
          >
            <MessageSquare className="w-4 h-4" />
            Chat
          </button>
          <button 
            onClick={() => setView("calendar")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
              view === "calendar" ? "bg-orange-500 text-white" : "text-zinc-400 hover:text-white"
            )}
          >
            <CalendarIcon className="w-4 h-4" />
            Calendario
          </button>
          <button 
            onClick={() => setView("budgets")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
              view === "budgets" ? "bg-orange-500 text-white" : "text-zinc-400 hover:text-white"
            )}
          >
            <BarChart3 className="w-4 h-4" />
            Bilanci
          </button>
          <button 
            onClick={() => setView("profile")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
              view === "profile" ? "bg-orange-500 text-white" : "text-zinc-400 hover:text-white"
            )}
          >
            <Settings className="w-4 h-4" />
            Profilo
          </button>
        </nav>

        <button 
          onClick={handleLogout}
          className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-500 transition-all"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {view === "chat" ? (
            <motion.div 
              key="chat"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="h-full flex flex-col max-w-4xl mx-auto w-full p-4"
            >
              <div className="flex-1 overflow-y-auto space-y-6 pb-24 scrollbar-hide">
                {messages.map((msg, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, scale: 0.95, x: msg.role === "user" ? 20 : -20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    className={cn(
                      "flex gap-3",
                      msg.role === "user" ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0",
                      msg.role === "user" ? "bg-zinc-800" : "bg-orange-500 shadow-lg shadow-orange-500/20"
                    )}>
                      {msg.role === "user" ? <div className="font-bold text-xs">TU</div> : <Sparkles className="w-5 h-5" />}
                    </div>
                    <div className={cn(
                      "max-w-[80%] p-4 rounded-3xl text-sm leading-relaxed",
                      msg.role === "user" 
                        ? "bg-zinc-800 text-white rounded-tr-none" 
                        : "bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-tl-none"
                    )}>
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
                {isTyping && (
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-orange-500 flex items-center justify-center animate-pulse">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-3xl rounded-tl-none">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-zinc-600 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-zinc-600 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="w-2 h-2 bg-zinc-600 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="absolute bottom-6 left-0 w-full px-4">
                <div className="max-w-4xl mx-auto relative flex items-center gap-3">
                  <button 
                    onClick={() => setIsDeadlineFormOpen(true)}
                    className="w-14 h-14 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-800 transition-all shadow-xl text-orange-500 shrink-0"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                  <div className="relative flex-1">
                    <input 
                      type="text"
                      value={chatInputValue}
                      onChange={(e) => setChatInputValue(e.target.value)}
                      placeholder="Chiedi a Sched... (es. 'Aggiungi bolletta luce da 80€ per il 15 Aprile')"
                      className="w-full bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-[2rem] px-6 py-5 pr-16 focus:outline-none focus:border-orange-500 transition-all shadow-2xl"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleSendMessage(chatInputValue);
                          setChatInputValue("");
                        }
                      }}
                    />
                    <button 
                      onClick={() => {
                        handleSendMessage(chatInputValue);
                        setChatInputValue("");
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : view === "budgets" ? (
            <motion.div 
              key="budgets"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="h-full flex flex-col p-6 max-w-6xl mx-auto w-full overflow-y-auto scrollbar-hide"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-4xl font-black tracking-tighter italic">Bilanci</h2>
                <div className="flex gap-2">
                  <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-xl flex items-center gap-2">
                    <span className="text-zinc-500 text-xs font-bold uppercase">Totale 2026:</span>
                    <span className="text-orange-500 font-black">
                      {deadlines.reduce((acc, d) => acc + Number(d.amount), 0).toFixed(2)}€
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 p-6 rounded-[2.5rem] h-[400px]">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-orange-500" />
                    Andamento Spese Mensili
                  </h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={
                      eachMonthOfInterval({
                        start: startOfYear(TODAY),
                        end: endOfYear(TODAY)
                      }).map(month => {
                        const monthDeadlines = deadlines.filter(d => isSameMonth(parseISO(d.dueDate), month));
                        return {
                          name: format(month, "MMM"),
                          amount: monthDeadlines.reduce((acc, d) => acc + Number(d.amount), 0)
                        };
                      })
                    }>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#71717a', fontSize: 12 }}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#71717a', fontSize: 12 }}
                        tickFormatter={(value) => `${value}€`}
                      />
                      <Tooltip 
                        cursor={{ fill: '#27272a' }}
                        contentStyle={{ 
                          backgroundColor: '#18181b', 
                          border: '1px solid #27272a',
                          borderRadius: '16px',
                          color: '#fff'
                        }}
                      />
                      <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                        {
                          [...Array(12)].map((_, index) => (
                            <Cell key={`cell-${index}`} fill={index === TODAY.getMonth() ? '#f97316' : '#3f3f46'} />
                          ))
                        }
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[2.5rem] flex flex-col">
                  <h3 className="text-lg font-bold mb-6">Spese per Categoria</h3>
                  <div className="flex-1 space-y-4 overflow-y-auto scrollbar-hide">
                    {CATEGORIES.map(cat => {
                      const catTotal = deadlines
                        .filter(d => d.category === cat.id)
                        .reduce((acc, d) => acc + Number(d.amount), 0);
                      const percentage = (catTotal / deadlines.reduce((acc, d) => acc + Number(d.amount), 0)) * 100 || 0;
                      
                      return (
                        <div key={cat.id} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="flex items-center gap-2 text-zinc-400">
                              <cat.icon className={cn("w-4 h-4", cat.color.split(' ')[0])} />
                              {cat.name}
                            </span>
                            <span className="font-bold">{catTotal.toFixed(2)}€</span>
                          </div>
                          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              className={cn("h-full", cat.color.split(' ')[1].replace('bg-', 'bg-').replace('/10', ''))}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] overflow-hidden">
                <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                  <h3 className="font-bold">Dettaglio Transazioni</h3>
                  <span className="text-zinc-500 text-sm">{deadlines.length} record trovati</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-zinc-500 text-xs font-bold uppercase tracking-widest border-b border-zinc-800">
                        <th className="px-6 py-4">Data</th>
                        <th className="px-6 py-4">Titolo</th>
                        <th className="px-6 py-4">Categoria</th>
                        <th className="px-6 py-4">Frequenza</th>
                        <th className="px-6 py-4 text-right">Importo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {deadlines.sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()).map(d => {
                        const cat = CATEGORIES.find(c => c.id === d.category) || CATEGORIES[6];
                        return (
                          <tr key={d.id} className="hover:bg-zinc-800/50 transition-colors group">
                            <td className="px-6 py-4 text-sm text-zinc-400">
                              {format(parseISO(d.dueDate), "dd MMM yyyy")}
                            </td>
                            <td className="px-6 py-4 font-bold">{d.title}</td>
                            <td className="px-6 py-4">
                              <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase", cat.color)}>
                                {cat.name}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-zinc-500 italic">{d.frequency}</td>
                            <td className="px-6 py-4 text-right font-black text-orange-500">
                              {Number(d.amount).toFixed(2)}€
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          ) : view === "profile" ? (
            <motion.div 
              key="profile"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="h-full flex flex-col p-6 max-w-2xl mx-auto w-full"
            >
              <h2 className="text-4xl font-black tracking-tighter italic mb-8">Profilo</h2>
              
              <div className="space-y-6">
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-lg">Informazioni Account</h3>
                      <p className="text-zinc-400 text-sm">{user?.email}</p>
                    </div>
                    <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center">
                      <Settings className="w-6 h-6 text-zinc-400" />
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-lg">Notifiche Email</h3>
                      <p className="text-zinc-400 text-sm">Ricevi un promemoria prima della scadenza.</p>
                    </div>
                    <button 
                      onClick={toggleNotifications}
                      className={cn(
                        "w-14 h-8 rounded-full transition-all relative p-1",
                        user?.emailNotifications ? "bg-orange-500" : "bg-zinc-700"
                      )}
                    >
                      <motion.div 
                        animate={{ x: user?.emailNotifications ? 24 : 0 }}
                        className="w-6 h-6 bg-white rounded-full shadow-lg"
                      />
                    </button>
                  </div>
                </div>

                <div className="pt-8 space-y-4">
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-3 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 p-4 rounded-2xl font-bold transition-all"
                  >
                    <LogOut className="w-5 h-5" />
                    Disconnetti
                  </button>
                  
                  <button 
                    onClick={handleDeleteAccount}
                    className="w-full flex items-center justify-center gap-3 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-500 p-4 rounded-2xl font-bold transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                    Elimina Account
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="calendar"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="h-full flex flex-col p-6 max-w-6xl mx-auto w-full"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-4xl font-black tracking-tighter italic">Scadenze</h2>
                <div className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 p-2 rounded-2xl">
                  <button 
                    onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
                    className="p-2 hover:bg-zinc-800 rounded-xl transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="font-bold min-w-[140px] text-center uppercase tracking-widest text-sm">
                    {format(currentMonth, "MMMM yyyy")}
                  </span>
                  <button 
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    className="p-2 hover:bg-zinc-800 rounded-xl transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-2 mb-2">
                {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map(d => (
                  <div key={d} className="text-center text-xs font-bold text-zinc-500 uppercase py-2">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2 flex-1">
                {(() => {
                  const start = startOfMonth(currentMonth);
                  const end = endOfMonth(currentMonth);
                  const days = eachDayOfInterval({ start, end });
                  
                  // Add padding for first day of month
                  const firstDayIdx = (start.getDay() + 6) % 7;
                  const padding = Array(firstDayIdx).fill(null);

                  return [...padding, ...days].map((day, i) => {
                    if (!day) return <div key={`pad-${i}`} className="aspect-square" />;
                    
                    const dayDeadlines = deadlines.filter(d => isSameDay(parseISO(d.dueDate), day));
                    
                    return (
                      <motion.div 
                        key={day.toString()}
                        whileHover={{ scale: 1.02 }}
                        onClick={() => dayDeadlines.length > 0 && setSelectedDay(day)}
                        className={cn(
                          "aspect-square bg-zinc-900 border border-zinc-800 rounded-2xl p-2 flex flex-col gap-1 relative overflow-hidden group",
                          isSameDay(day, TODAY) && "border-orange-500/50 bg-orange-500/5",
                          dayDeadlines.length > 0 && "cursor-pointer hover:border-orange-500/30"
                        )}
                      >
                        <span className={cn(
                          "text-xs font-bold",
                          isSameDay(day, TODAY) ? "text-orange-500" : "text-zinc-500"
                        )}>
                          {format(day, "d")}
                        </span>
                        
                        <div className="flex-1 overflow-y-auto space-y-1 scrollbar-hide">
                          {dayDeadlines.map(d => {
                            const cat = CATEGORIES.find(c => c.id === d.category) || CATEGORIES[6];
                            return (
                              <div 
                                key={d.id} 
                                className={cn(
                                  "text-[10px] p-1.5 rounded-lg font-bold truncate flex items-center gap-1",
                                  cat.color
                                )}
                              >
                                <cat.icon className="w-3 h-3" />
                                {d.title}
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    );
                  });
                })()}
              </div>

              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
                  <div className="text-zinc-500 text-xs font-bold uppercase mb-1">Totale Mese</div>
                  <div className="text-3xl font-black tracking-tighter italic">
                    €{deadlines
                      .filter(d => isSameMonth(parseISO(d.dueDate), currentMonth))
                      .reduce((acc, d) => acc + Number(d.amount), 0)
                      .toFixed(2)}
                  </div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
                  <div className="text-zinc-500 text-xs font-bold uppercase mb-1">Prossima Scadenza</div>
                  <div className="text-xl font-bold truncate">
                    {deadlines.length > 0 ? deadlines[0].title : "Nessuna"}
                  </div>
                </div>
                <button 
                  onClick={() => setView("chat")}
                  className="bg-orange-500 hover:bg-orange-600 p-6 rounded-3xl flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-orange-500/20"
                >
                  <Plus className="w-6 h-6" />
                  <span className="font-bold">Aggiungi con Sched</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isDeadlineFormOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsDeadlineFormOpen(false)}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 z-[101] shadow-2xl"
              >
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-3xl font-black tracking-tighter italic">Nuova Scadenza</h3>
                  <button 
                    onClick={() => setIsDeadlineFormOpen(false)}
                    className="p-3 hover:bg-zinc-800 rounded-2xl transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-2 block">Cosa devi pagare?</label>
                    <input 
                      type="text"
                      value={deadlineForm.title}
                      onChange={(e) => setDeadlineForm({...deadlineForm, title: e.target.value})}
                      placeholder="es. Bolletta Luce"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl p-4 focus:outline-none focus:border-orange-500 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-2 block">Quanto?</label>
                      <div className="relative">
                        <input 
                          type="number"
                          value={deadlineForm.amount}
                          onChange={(e) => setDeadlineForm({...deadlineForm, amount: e.target.value})}
                          placeholder="0.00"
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl p-4 pr-12 focus:outline-none focus:border-orange-500 transition-all"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-zinc-500">{deadlineForm.currency}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-2 block">Quando?</label>
                      <input 
                        type="date"
                        value={deadlineForm.date}
                        onChange={(e) => setDeadlineForm({...deadlineForm, date: e.target.value})}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl p-4 focus:outline-none focus:border-orange-500 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-2 block">Categoria</label>
                    <div className="grid grid-cols-4 gap-2">
                      {CATEGORIES.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => setDeadlineForm({...deadlineForm, category: cat.id})}
                          className={cn(
                            "p-3 rounded-2xl border transition-all flex flex-col items-center gap-1",
                            deadlineForm.category === cat.id 
                              ? "bg-orange-500 border-orange-400 text-white" 
                              : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600"
                          )}
                        >
                          <cat.icon className="w-5 h-5" />
                          <span className="text-[10px] font-bold uppercase">{cat.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      const text = `Aggiungi ${deadlineForm.title} di ${deadlineForm.amount}${deadlineForm.currency} per il ${deadlineForm.date} (categoria: ${deadlineForm.category})`;
                      setChatInputValue(text);
                      setIsDeadlineFormOpen(false);
                      setDeadlineForm({
                        title: "",
                        amount: "",
                        date: format(TODAY, "yyyy-MM-dd"),
                        category: "altro",
                        currency: "€"
                      });
                    }}
                    disabled={!deadlineForm.title || !deadlineForm.amount || !deadlineForm.date}
                    className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:hover:bg-orange-500 p-5 rounded-3xl font-bold transition-all shadow-lg shadow-orange-500/20"
                  >
                    Conferma e Incolla
                  </button>
                </div>
              </motion.div>
            </>
          )}

          {selectedDay && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedDay(null)}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 z-[101] shadow-2xl"
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-3xl font-black tracking-tighter italic">
                      {format(selectedDay, "d MMMM")}
                    </h3>
                    <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs mt-1">
                      {format(selectedDay, "EEEE")}
                    </p>
                  </div>
                  <button 
                    onClick={() => setSelectedDay(null)}
                    className="p-3 hover:bg-zinc-800 rounded-2xl transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 scrollbar-hide">
                  {deadlines
                    .filter(d => isSameDay(parseISO(d.dueDate), selectedDay))
                    .map(d => {
                      const cat = CATEGORIES.find(c => c.id === d.category) || CATEGORIES[6];
                      return (
                        <div 
                          key={d.id}
                          className="bg-zinc-800/50 border border-zinc-800 p-5 rounded-3xl flex items-center justify-between group hover:bg-zinc-800 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className={cn("p-3 rounded-2xl", cat.color)}>
                              <cat.icon className="w-6 h-6" />
                            </div>
                            <div>
                              <div className="font-bold text-lg">{d.title}</div>
                              <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider">{cat.name}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-black italic">€{Number(d.amount).toFixed(2)}</div>
                            <div className="text-[10px] text-zinc-500 font-bold uppercase">{d.frequency}</div>
                          </div>
                        </div>
                      );
                    })}
                </div>

                <button 
                  onClick={() => setSelectedDay(null)}
                  className="w-full mt-8 bg-zinc-800 hover:bg-zinc-700 p-4 rounded-2xl font-bold transition-all"
                >
                  Chiudi
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
