/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  ClipboardList, 
  Calculator, 
  Settings, 
  Plus, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  ChevronRight,
  FileText,
  MapPin,
  Camera,
  MessageSquare,
  User,
  Menu,
  X,
  Download,
  Zap,
  DollarSign,
  Package,
  Users,
  TrendingUp,
  ShieldCheck,
  CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  calculateElectrical, 
  calculateMotor, 
  calculateQDC, 
  calculateSPDA,
  calculateSolar,
  estimateShortCircuit,
  BREAKER_RATINGS,
  CalcInput, 
  CalcResult, 
  SystemType, 
  LoadType,
  MotorCalcInput,
  MotorCalcResult,
  QDCCalcInput,
  QDCCalcResult,
  SPDAInput,
  SPDAResult,
  SolarInput,
  SolarResult
} from './services/electricalLogic';
import { generateMemorialPDF, generateServiceOrderPDF } from './services/pdfService';
import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface Ticket {
  id: number;
  client_id: number;
  client_name: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
}

interface DashboardStats {
  open: number;
  inProgress: number;
  completed: number;
  total: number;
  revenue: number;
}

interface InventoryItem {
  id: number;
  name: string;
  category: string;
  quantity: number;
  min_quantity: number;
  unit_price: number;
}

interface Transaction {
  id: number;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string;
}

interface TeamMember {
  id: number;
  name: string;
  role: string;
  status: string;
}

// --- Components ---

const Card = ({ children, className, ...props }: { children: React.ReactNode; className?: string; [key: string]: any }) => (
  <div className={cn("bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden", className)} {...props}>
    {children}
  </div>
);

const Button = ({ 
  children, 
  variant = 'primary', 
  className, 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'danger' }) => {
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white",
    secondary: "bg-zinc-100 hover:bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100",
    outline: "border border-zinc-300 hover:bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:hover:bg-zinc-800 dark:text-zinc-300",
    danger: "bg-red-600 hover:bg-red-700 text-white",
  };
  return (
    <button 
      className={cn("px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2", variants[variant], className)} 
      {...props}
    >
      {children}
    </button>
  );
};

const Input = ({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) => (
  <div className="space-y-1">
    {label && <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</label>}
    <input 
      className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
      {...props}
    />
  </div>
);

const Select = ({ label, options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string, options: { label: string, value: string | number }[] }) => (
  <div className="space-y-1">
    {label && <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</label>}
    <select 
      className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
      {...props}
    >
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  </div>
);

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tickets' | 'calculator' | 'finance' | 'inventory' | 'team' | 'settings'>('dashboard');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ open: 0, inProgress: 0, completed: 0, total: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [user, setUser] = useState<{ name: string, plan: string } | null>(null);
  const [isAIConsultantOpen, setIsAIConsultantOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    fetchData();
    // Simulate login
    setUser({ name: "Mestre Admin", plan: "pro" });

    // WebSocket Integration
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'TICKET_CREATED') {
        fetchData(); // Refresh all data
      }
      if (data.type === 'NEW_MESSAGE') {
        // Handle real-time message update if needed
      }
    };

    return () => ws.close();
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ticketsRes, statsRes] = await Promise.all([
        fetch('/api/tickets'),
        fetch('/api/dashboard/stats')
      ]);
      const ticketsData = await ticketsRes.json();
      const statsData = await statsRes.json();
      setTickets(ticketsData);
      setStats(statsData);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTicketClick = (ticket: Ticket) => {
    setSelectedTicket(ticket);
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tickets', label: 'Chamados', icon: ClipboardList },
    { id: 'calculator', label: 'Engenharia', icon: Calculator },
    { id: 'finance', label: 'Financeiro', icon: DollarSign },
    { id: 'inventory', label: 'Estoque', icon: Package },
    { id: 'team', label: 'Equipe', icon: Users },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 overflow-hidden">
      {/* AI Consultant Toggle */}
      <button 
        onClick={() => setIsAIConsultantOpen(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all z-40 group"
      >
        <Zap className="w-8 h-8 group-hover:animate-pulse" />
        <span className="absolute -top-12 right-0 bg-zinc-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Consultor Normativo IA</span>
      </button>

      {/* AI Consultant Modal */}
      <AnimatePresence>
        {isAIConsultantOpen && (
          <AIConsultant onClose={() => setIsAIConsultantOpen(false)} />
        )}
      </AnimatePresence>
      {/* Sidebar */}
      <aside className={cn(
        "bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 transition-all duration-300 flex flex-col",
        isSidebarOpen ? "w-64" : "w-20"
      )}>
        <div className="p-6 flex items-center gap-3 border-bottom border-zinc-200 dark:border-zinc-800">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Zap className="w-6 h-6 text-white" />
          </div>
          {isSidebarOpen && <span className="font-bold text-xl tracking-tight uppercase">Mestre</span>}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id as any);
                setSelectedTicket(null);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                activeTab === item.id && !selectedTicket
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" 
                  : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              )}
            >
              <item.icon className="w-5 h-5" />
              {isSidebarOpen && <span className="font-medium">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-full flex items-center justify-center p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {selectedTicket ? `Chamado #${selectedTicket.id}` : navItems.find(i => i.id === activeTab)?.label}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400">
              {selectedTicket ? selectedTicket.title : new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input 
                type="text" 
                placeholder="Buscar..." 
                className="pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold">
              EA
            </div>
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg transition-colors"
            >
              {darkMode ? <Zap className="w-5 h-5 text-yellow-400" /> : <Zap className="w-5 h-5 text-zinc-400" />}
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={selectedTicket ? `ticket-${selectedTicket.id}` : activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {selectedTicket ? (
              <TicketDetail ticket={selectedTicket} onBack={() => setSelectedTicket(null)} />
            ) : (
              <>
                {activeTab === 'dashboard' && <Dashboard stats={stats} tickets={tickets} onTicketClick={handleTicketClick} />}
                {activeTab === 'tickets' && <Tickets tickets={tickets} onRefresh={fetchData} onTicketClick={handleTicketClick} />}
                {activeTab === 'calculator' && <ElectricalCalculator />}
                {activeTab === 'finance' && <FinanceView />}
                {activeTab === 'inventory' && <InventoryView />}
                {activeTab === 'team' && <TeamView />}
                {activeTab === 'settings' && <SettingsView user={user} />}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

// --- Ticket Detail View ---

function TicketDetail({ ticket, onBack }: { ticket: Ticket, onBack: () => void }) {
  const [checkIn, setCheckIn] = useState<{ lat: number, lng: number } | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [messages, setMessages] = useState<{ user: string, text: string, time: string }[]>([
    { user: 'Supervisor', text: 'Favor verificar o estado dos barramentos.', time: '10:30' },
    { user: 'Você', text: 'Entendido, estou a caminho.', time: '10:35' },
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [associatedCalcs, setAssociatedCalcs] = useState<any[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [isNR10Open, setIsNR10Open] = useState(false);
  const [nr10Checklist, setNr10Checklist] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/calculations/${ticket.id}`).then(res => res.json()).then(setAssociatedCalcs);
    fetch(`/api/nr10/${ticket.id}`).then(res => res.json()).then(setNr10Checklist);
  }, [ticket.id]);

  const handleNR10Submit = async (data: any) => {
    await fetch('/api/nr10', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket_id: ticket.id, data })
    });
    setNr10Checklist(data);
    setIsNR10Open(false);
  };

  const handleCheckIn = () => {
    navigator.geolocation.getCurrentPosition((pos) => {
      setCheckIn({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setMessages([...messages, { user: 'Você', text: newMessage, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    setNewMessage('');
  };

  return (
    <div className="space-y-8">
      <Button variant="outline" onClick={onBack} className="mb-4">
        Voltar para Lista
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="p-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-bold">{ticket.title}</h3>
                <p className="text-zinc-500">{ticket.client_name}</p>
              </div>
              <span className={cn(
                "px-3 py-1 rounded-full text-sm font-bold uppercase",
                ticket.status === 'open' ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
              )}>
                {ticket.status}
              </span>
            </div>
            <p className="text-zinc-700 dark:text-zinc-300 mb-8">{ticket.description}</p>
            
            <div className="flex flex-wrap gap-4">
              <Button onClick={handleCheckIn} variant={checkIn ? 'secondary' : 'primary'}>
                <MapPin className="w-4 h-4" /> {checkIn ? 'Check-in Realizado' : 'Realizar Check-in (GPS)'}
              </Button>
              <Button variant="outline">
                <Camera className="w-4 h-4" /> Adicionar Foto
              </Button>
              <Button variant="outline" onClick={() => setIsSigning(true)}>
                <FileText className="w-4 h-4" /> {signature ? 'Ver Assinatura' : 'Assinatura Digital'}
              </Button>
              <Button variant={nr10Checklist ? 'secondary' : 'danger'} onClick={() => setIsNR10Open(true)}>
                <ShieldCheck className="w-4 h-4" /> {nr10Checklist ? 'Checklist NR10 OK' : 'Checklist NR10 Pendente'}
              </Button>
              <Button variant="outline" onClick={() => generateServiceOrderPDF(ticket, nr10Checklist, signature, associatedCalcs)}>
                <Download className="w-4 h-4" /> Gerar OS Completa
              </Button>
            </div>
          </Card>

          {/* NR10 Modal */}
          <AnimatePresence>
            {isNR10Open && (
              <NR10Modal 
                onClose={() => setIsNR10Open(false)} 
                onSubmit={handleNR10Submit} 
                initialData={nr10Checklist}
              />
            )}
          </AnimatePresence>

          {/* Signature Modal */}
          <AnimatePresence>
            {isSigning && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white dark:bg-zinc-900 rounded-2xl p-8 max-w-md w-full shadow-2xl">
                  <h3 className="text-xl font-bold mb-4">Assinatura Digital do Cliente</h3>
                  <div className="w-full h-48 bg-zinc-100 dark:bg-zinc-800 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center relative overflow-hidden">
                    {signature ? (
                      <img src={signature} alt="Assinatura" className="max-w-full max-h-full" />
                    ) : (
                      <div className="text-center">
                        <p className="text-xs text-zinc-500">O cliente deve assinar nesta área</p>
                        <button 
                          onClick={() => setSignature("data:image/png;base64,iVBORw0K...")} // Mock signature
                          className="mt-4 text-blue-600 text-xs font-bold underline"
                        >
                          Simular Assinatura
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3 mt-6">
                    <Button variant="outline" className="flex-1" onClick={() => setIsSigning(false)}>Fechar</Button>
                    {!signature && <Button className="flex-1" onClick={() => setSignature("data:image/png;base64,iVBORw0K...")}>Confirmar</Button>}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Photos Grid */}
          <Card className="p-8">
            <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Camera className="w-5 h-5" /> Registro Fotográfico
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="aspect-square bg-zinc-100 dark:bg-zinc-800 rounded-xl overflow-hidden relative group">
                  <img 
                    src={`https://picsum.photos/seed/elec${i}/400/400`} 
                    alt="Serviço" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button variant="outline" className="bg-white/10 border-white text-white">Ver</Button>
                  </div>
                </div>
              ))}
              <button className="aspect-square border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl flex flex-col items-center justify-center text-zinc-400 hover:border-blue-500 hover:text-blue-500 transition-all">
                <Plus className="w-8 h-8" />
                <span className="text-xs font-bold mt-2">Adicionar</span>
              </button>
            </div>
          </Card>

          {/* Associated Calculations */}
          <Card className="p-8">
            <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-blue-600" /> Memoriais de Cálculo Associados
            </h4>
            <div className="space-y-4">
              {associatedCalcs.length === 0 ? (
                <p className="text-sm text-zinc-500 italic">Nenhum cálculo associado a este chamado.</p>
              ) : (
                associatedCalcs.map((calc, i) => {
                  const data = JSON.parse(calc.data);
                  return (
                    <div key={i} className="p-4 bg-zinc-50 dark:bg-zinc-900/30 rounded-xl border border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-sm">{calc.description}</p>
                        <p className="text-xs text-zinc-500">Cabo: {data.cableSection}mm² | Disjuntor: {data.breakerRating}A</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => generateMemorialPDF(data.input, data.result, ticket.client_name)}>
                        <Download className="w-3 h-3" /> PDF
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar: Chat & Details */}
        <div className="space-y-8">
          <Card className="p-6 flex flex-col h-[500px]">
            <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" /> Chat do Chamado
            </h4>
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
              {messages.map((msg, i) => (
                <div key={i} className={cn(
                  "max-w-[80%] p-3 rounded-2xl text-sm",
                  msg.user === 'Você' 
                    ? "bg-blue-600 text-white self-end ml-auto rounded-tr-none" 
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-tl-none"
                )}>
                  <p className="font-bold text-[10px] uppercase opacity-70 mb-1">{msg.user}</p>
                  <p>{msg.text}</p>
                  <p className="text-[10px] text-right mt-1 opacity-50">{msg.time}</p>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input 
                type="text" 
                placeholder="Mensagem..." 
                className="flex-1 bg-zinc-100 dark:bg-zinc-800 border-none rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
              />
              <Button type="submit" className="p-2 w-10 h-10">
                <ChevronRight className="w-5 h-5" />
              </Button>
            </form>
          </Card>

          <Card className="p-6">
            <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-4">Detalhes do Contrato</h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">SLA de Atendimento</span>
                <span className="text-sm font-bold text-emerald-600">4h (Conforme)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Tipo de Manutenção</span>
                <span className="text-sm font-bold">Corretiva</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Técnico Responsável</span>
                <span className="text-sm font-bold">Engehall Admin</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// --- Dashboard View ---

function Dashboard({ stats, tickets, onTicketClick }: { stats: DashboardStats, tickets: Ticket[], onTicketClick: (t: Ticket) => void }) {
  const [viewMode, setViewMode] = useState<'stats' | 'map'>('stats');
  
  const chartData = [
    { name: 'Abertos', value: stats.open, color: '#3b82f6' },
    { name: 'Em Progresso', value: stats.inProgress, color: '#f59e0b' },
    { name: 'Concluídos', value: stats.completed, color: '#10b981' },
  ];

  const revenueData = [
    { name: 'Jan', value: 4000 },
    { name: 'Fev', value: 3000 },
    { name: 'Mar', value: 2000 },
    { name: 'Abr', value: 2780 },
    { name: 'Mai', value: 1890 },
    { name: 'Jun', value: 2390 },
    { name: 'Jul', value: 3490 },
  ];

  return (
    <div className="space-y-8">
      {/* View Toggle */}
      <div className="flex gap-2 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl w-fit">
        <button 
          onClick={() => setViewMode('stats')}
          className={cn("px-4 py-2 rounded-lg text-sm font-bold transition-all", viewMode === 'stats' ? "bg-white dark:bg-zinc-800 shadow-sm" : "text-zinc-500")}
        >
          Estatísticas
        </button>
        <button 
          onClick={() => setViewMode('map')}
          className={cn("px-4 py-2 rounded-lg text-sm font-bold transition-all", viewMode === 'map' ? "bg-white dark:bg-zinc-800 shadow-sm" : "text-zinc-500")}
        >
          Mapa de Chamados
        </button>
      </div>

      {viewMode === 'stats' ? (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Receita Mensal" value={stats.revenue} icon={DollarSign} color="emerald" isCurrency />
            <StatCard title="Chamados Ativos" value={stats.open + stats.inProgress} icon={Zap} color="blue" />
            <StatCard title="Eficiência SLA" value={98} icon={TrendingUp} color="indigo" isPercentage />
            <StatCard title="Equipe em Campo" value={4} icon={Users} color="amber" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Charts */}
            <Card className="lg:col-span-2 p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold">Crescimento de Receita</h3>
                <Select 
                  options={[{ label: 'Últimos 6 meses', value: '6m' }]} 
                  className="w-40 py-1 text-xs"
                />
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Status Distribution */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-6">Distribuição de Status</h3>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-4">
                {chartData.map((item, i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-zinc-500">{item.name}</span>
                    </div>
                    <span className="font-bold">{item.value}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      ) : (
        <Card className="h-[600px] relative overflow-hidden bg-zinc-100 dark:bg-zinc-900 border-none">
          {/* Mock Map Background */}
          <div className="absolute inset-0 opacity-40 dark:opacity-20 pointer-events-none">
            <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          </div>
          
          <div className="absolute inset-0 p-8">
            <h3 className="text-xl font-bold mb-8 flex items-center gap-2">
              <MapPin className="w-6 h-6 text-red-600" /> Localização dos Chamados em Tempo Real
            </h3>
            
            {/* Mock Map Pins */}
            <div className="relative w-full h-full">
              {tickets.map((t, i) => (
                <motion.button
                  key={t.id}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => onTicketClick(t)}
                  className="absolute group"
                  style={{ 
                    left: `${20 + (i * 15)}%`, 
                    top: `${30 + (i * 10)}%` 
                  }}
                >
                  <div className="relative">
                    <MapPin className={cn(
                      "w-8 h-8 drop-shadow-lg transition-transform group-hover:scale-125",
                      t.status === 'open' ? "text-blue-600" : "text-emerald-600"
                    )} />
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full mb-2 bg-white dark:bg-zinc-800 p-2 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-zinc-200 dark:border-zinc-700 z-10">
                      <p className="text-xs font-bold">#{t.id} - {t.title}</p>
                      <p className="text-[10px] text-zinc-500">{t.client_name}</p>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
          
          <div className="absolute bottom-8 right-8 bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700">
            <h4 className="text-xs font-bold uppercase mb-3">Legenda</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded-full bg-blue-600" />
                <span>Chamado Aberto</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded-full bg-emerald-600" />
                <span>Em Atendimento</span>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, isCurrency, isPercentage }: { title: string, value: number, icon: any, color: string, isCurrency?: boolean, isPercentage?: boolean }) {
  const colors: any = {
    blue: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
    amber: "text-amber-600 bg-amber-50 dark:bg-amber-900/20",
    emerald: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20",
    indigo: "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20",
  };

  const formattedValue = isCurrency 
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
    : isPercentage ? `${value}%` : value;

  return (
    <Card className="p-6 flex items-center gap-4">
      <div className={cn("p-3 rounded-xl", colors[color])}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">{title}</p>
        <p className="text-2xl font-bold">{formattedValue}</p>
      </div>
    </Card>
  );
}

// --- Tickets View ---

function Tickets({ tickets, onRefresh, onTicketClick }: { tickets: Ticket[], onRefresh: () => void, onTicketClick: (t: Ticket) => void }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTicket, setNewTicket] = useState({ title: '', client_id: 1, description: '', priority: 'medium' });
  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/clients').then(res => res.json()).then(setClients);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTicket)
    });
    setIsModalOpen(false);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Lista de Chamados</h3>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4" /> Novo Chamado
        </Button>
      </div>

      <Card>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
              <th className="px-6 py-4 text-sm font-semibold text-zinc-600 dark:text-zinc-400">ID</th>
              <th className="px-6 py-4 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Título</th>
              <th className="px-6 py-4 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Cliente</th>
              <th className="px-6 py-4 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Status</th>
              <th className="px-6 py-4 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Prioridade</th>
              <th className="px-6 py-4 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Data</th>
              <th className="px-6 py-4 text-sm font-semibold text-zinc-600 dark:text-zinc-400 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {tickets.map(ticket => (
              <tr 
                key={ticket.id} 
                className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors cursor-pointer"
                onClick={() => onTicketClick(ticket)}
              >
                <td className="px-6 py-4 text-sm font-medium">#{ticket.id}</td>
                <td className="px-6 py-4 text-sm font-medium">{ticket.title}</td>
                <td className="px-6 py-4 text-sm text-zinc-500">{ticket.client_name}</td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-2 py-1 rounded-full text-xs font-semibold",
                    ticket.status === 'open' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                    ticket.status === 'in_progress' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  )}>
                    {ticket.status === 'open' ? 'Aberto' : ticket.status === 'in_progress' ? 'Em Atendimento' : 'Concluído'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "flex items-center gap-1 text-xs font-medium",
                    ticket.priority === 'high' ? "text-red-600" : ticket.priority === 'medium' ? "text-amber-600" : "text-blue-600"
                  )}>
                    <AlertCircle className="w-3 h-3" />
                    {ticket.priority.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-zinc-500">{new Date(ticket.created_at).toLocaleDateString()}</td>
                <td className="px-6 py-4 text-right">
                  <button className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* New Ticket Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-zinc-900 rounded-2xl p-8 w-full max-w-lg shadow-2xl"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Novo Chamado</h3>
              <button onClick={() => setIsModalOpen(false)}><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <Input 
                label="Título do Serviço" 
                placeholder="Ex: Manutenção de QDC" 
                value={newTicket.title}
                onChange={e => setNewTicket({...newTicket, title: e.target.value})}
                required
              />
              <Select 
                label="Cliente" 
                options={clients.map(c => ({ label: c.name, value: c.id }))}
                value={newTicket.client_id}
                onChange={e => setNewTicket({...newTicket, client_id: Number(e.target.value)})}
              />
              <div className="space-y-1">
                <label className="text-sm font-medium">Descrição</label>
                <textarea 
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={3}
                  value={newTicket.description}
                  onChange={e => setNewTicket({...newTicket, description: e.target.value})}
                />
              </div>
              <Select 
                label="Prioridade" 
                options={[
                  { label: 'Baixa', value: 'low' },
                  { label: 'Média', value: 'medium' },
                  { label: 'Alta', value: 'high' }
                ]}
                value={newTicket.priority}
                onChange={e => setNewTicket({...newTicket, priority: e.target.value})}
              />
              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                <Button type="submit" className="flex-1">Criar Chamado</Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// --- Electrical Calculator View ---

function ElectricalCalculator() {
  const [calcType, setCalcType] = useState<'conductors' | 'motors' | 'qdc'>('conductors');
  
  // Conductor State
  const [input, setInput] = useState<CalcInput>({
    systemType: 'monofasico',
    voltage: 127,
    power: 1200,
    powerFactor: 1.0,
    loadType: 'iluminacao',
    length: 20,
    method: 'B1',
    temp: 30,
    grouping: 1,
    material: 'cobre',
    insulation: 'PVC',
    breakerCurve: 'C',
    breakerIcn: 3.0,
    breakerRating: 16
  });
  const [result, setResult] = useState<CalcResult | null>(null);

  // Motor State
  const [motorInput, setMotorInput] = useState<MotorCalcInput>({
    powerCV: 5,
    voltage: 380,
    efficiency: 85,
    powerFactor: 0.8,
    startingMethod: 'direta'
  });
  const [motorResult, setMotorResult] = useState<MotorCalcResult | null>(null);

  // QDC State
  const [qdcInput, setQdcInput] = useState<QDCCalcInput>({
    circuits: [
      { id: 1, current: 20, type: 'TUG' },
      { id: 2, current: 15, type: 'Iluminação' },
      { id: 3, current: 32, type: 'Chuveiro' },
    ]
  });
  const [qdcResult, setQdcResult] = useState<QDCCalcResult | null>(null);
  
  // SPDA State
  const [spdaInput, setSpdaInput] = useState<SPDAInput>({
    height: 10,
    width: 20,
    length: 30,
    riskLevel: 2
  });
  const [spdaResult, setSpdaResult] = useState<SPDAResult | null>(null);

  // Solar State
  const [solarInput, setSolarInput] = useState<SolarInput>({
    monthlyConsumption: 500,
    solarIrradiation: 5.0,
    panelPower: 550
  });
  const [solarResult, setSolarResult] = useState<SolarResult | null>(null);

  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    fetch('/api/tickets').then(res => res.json()).then(setTickets);
  }, []);

  const handleSaveCalculation = async (ticketId: number) => {
    const description = calcType === 'conductors' ? `Dimensionamento de Condutores - ${input.loadType}` : 
                       calcType === 'motors' ? `Dimensionamento de Motor - ${motorInput.powerCV}CV` :
                       calcType === 'qdc' ? `Dimensionamento de QDC - ${qdcInput.circuits.length} circuitos` :
                       calcType === 'spda' ? `Dimensionamento SPDA` : `Dimensionamento Fotovoltaico`;
    
    const data = calcType === 'conductors' ? { input, result, cableSection: result?.cableSection, breakerRating: result?.breakerRating, bom: result?.bom } :
                 calcType === 'motors' ? { input: motorInput, result: motorResult, cableSection: 'N/A', breakerRating: motorResult?.breaker, bom: [] } :
                 calcType === 'qdc' ? { input: qdcInput, result: qdcResult, cableSection: 'N/A', breakerRating: qdcResult?.mainBreaker, bom: [] } :
                 calcType === 'spda' ? { input: spdaInput, result: spdaResult, cableSection: 'N/A', breakerRating: 'N/A', bom: [] } :
                 { input: solarInput, result: solarResult, cableSection: 'N/A', breakerRating: 'N/A', bom: [] };

    await fetch('/api/calculations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket_id: ticketId, description, data })
    });

    // Process BOM for inventory and finance
    if (calcType === 'conductors' && result?.bom) {
      const totalAmount = result.bom.reduce((acc, item) => acc + item.estimatedPrice, 0);
      
      // Reserve inventory
      await fetch('/api/inventory/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: result.bom.map(i => ({ name: i.item, quantity: i.quantity })) })
      });

      // Create budget in finance
      await fetch('/api/finance/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: `Material: ${description}`, amount: totalAmount, ticket_id: ticketId })
      });
    }

    setIsSaveModalOpen(false);
    alert("Cálculo salvo, materiais reservados e orçamento gerado no financeiro!");
  };

  const handleAnalyzePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = (event.target?.result as string).split(',')[1];
      
      try {
        const model = genAI.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: [
            {
              inlineData: {
                data: base64,
                mimeType: file.type
              }
            },
            {
              text: "Analise esta placa de motor ou disjuntor. Extraia os dados técnicos relevantes (Potência em CV ou kW, Tensão em V, Corrente em A, Frequência, Fator de Potência). Retorne APENAS um JSON com esses campos."
            }
          ]
        });

        const response = await model;
        alert("Dados extraídos pela IA: " + response.text);
        // Here we could auto-fill the inputs based on parsed JSON
      } catch (err) {
        console.error(err);
        alert("Erro ao analisar imagem com IA.");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCalculate = () => {
    if (calcType === 'conductors') setResult(calculateElectrical(input));
    if (calcType === 'motors') setMotorResult(calculateMotor(motorInput));
    if (calcType === 'qdc') setQdcResult(calculateQDC(qdcInput));
    if (calcType === 'spda') setSpdaResult(calculateSPDA(spdaInput));
    if (calcType === 'solar') setSolarResult(calculateSolar(solarInput));
  };

  return (
    <div className="space-y-8">
      <div className="flex gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <button 
          onClick={() => setCalcType('conductors')}
          className={cn("px-4 py-2 rounded-lg font-bold transition-all", calcType === 'conductors' ? "bg-blue-600 text-white" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900")}
        >
          Dimensionamento de Condutores
        </button>
        <button 
          onClick={() => setCalcType('motors')}
          className={cn("px-4 py-2 rounded-lg font-bold transition-all", calcType === 'motors' ? "bg-blue-600 text-white" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900")}
        >
          Dimensionamento de Motores
        </button>
        <button 
          onClick={() => setCalcType('qdc')}
          className={cn("px-4 py-2 rounded-lg font-bold transition-all", calcType === 'qdc' ? "bg-blue-600 text-white" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900")}
        >
          Dimensionamento de QDC
        </button>
        <button 
          onClick={() => setCalcType('spda')}
          className={cn("px-4 py-2 rounded-lg font-bold transition-all", calcType === 'spda' ? "bg-blue-600 text-white" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900")}
        >
          SPDA
        </button>
        <button 
          onClick={() => setCalcType('solar')}
          className={cn("px-4 py-2 rounded-lg font-bold transition-all", calcType === 'solar' ? "bg-blue-600 text-white" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900")}
        >
          Fotovoltaico
        </button>
      </div>

      <div className="mb-8 flex justify-end">
        <label className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 px-4 py-2 rounded-lg cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
          <Camera className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-bold">Analisar Placa com IA</span>
          <input type="file" className="hidden" accept="image/*" onChange={handleAnalyzePhoto} />
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-8">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-blue-600" /> Parâmetros de Entrada
          </h3>
          
          {calcType === 'conductors' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Select label="Tipo de Sistema" options={[{ label: 'Monofásico', value: 'monofasico' }, { label: 'Bifásico', value: 'bifasico' }, { label: 'Trifásico', value: 'trifasico' }]} value={input.systemType} onChange={e => setInput({...input, systemType: e.target.value as any})} />
              <Input label="Tensão (V)" type="number" value={input.voltage} onChange={e => setInput({...input, voltage: Number(e.target.value)})} />
              <Input label="Potência (W)" type="number" value={input.power} onChange={e => setInput({...input, power: Number(e.target.value)})} />
              <Input label="Fator de Potência" type="number" step="0.01" value={input.powerFactor} onChange={e => setInput({...input, powerFactor: Number(e.target.value)})} />
              <Select label="Tipo de Carga" options={[{ label: 'Iluminação', value: 'iluminacao' }, { label: 'Tomadas', value: 'tomadas' }, { label: 'Motor', value: 'motor' }, { label: 'Alimentador', value: 'alimentador' }]} value={input.loadType} onChange={e => setInput({...input, loadType: e.target.value as any})} />
              <Input label="Comprimento (m)" type="number" value={input.length} onChange={e => setInput({...input, length: Number(e.target.value)})} />
              <Select label="Método de Instalação" options={[{ label: 'A1', value: 'A1' }, { label: 'B1', value: 'B1' }, { label: 'B2', value: 'B2' }, { label: 'C', value: 'C' }]} value={input.method} onChange={e => setInput({...input, method: e.target.value})} />
              <Select label="Temp. Ambiente" options={[20, 25, 30, 35, 40].map(t => ({ label: `${t}°C`, value: t }))} value={input.temp} onChange={e => setInput({...input, temp: Number(e.target.value)})} />
              <Select label="Material" options={[{ label: 'Cobre', value: 'cobre' }, { label: 'Alumínio', value: 'aluminio' }]} value={input.material} onChange={e => setInput({...input, material: e.target.value as any})} />
              <Select label="Isolação" options={[{ label: 'PVC (70°C)', value: 'PVC' }, { label: 'EPR (90°C)', value: 'EPR' }]} value={input.insulation} onChange={e => setInput({...input, insulation: e.target.value as any})} />
              <Select label="Curva do Disjuntor" options={[{ label: 'Curva B', value: 'B' }, { label: 'Curva C', value: 'C' }, { label: 'Curva D', value: 'D' }]} value={input.breakerCurve} onChange={e => setInput({...input, breakerCurve: e.target.value as any})} />
              <Select label="Corrente Nominal (In)" options={BREAKER_RATINGS.map(r => ({ label: `${r} A`, value: r }))} value={input.breakerRating} onChange={e => setInput({...input, breakerRating: Number(e.target.value)})} />
              <Select label="Capacidade Interrupção (kA)" options={[{ label: '3.0 kA', value: 3.0 }, { label: '4.5 kA', value: 4.5 }, { label: '6.0 kA', value: 6.0 }, { label: '10.0 kA', value: 10.0 }]} value={input.breakerIcn} onChange={e => setInput({...input, breakerIcn: Number(e.target.value)})} />
            </div>
          )}

          {calcType === 'motors' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input label="Potência (CV)" type="number" value={motorInput.powerCV} onChange={e => setMotorInput({...motorInput, powerCV: Number(e.target.value)})} />
              <Input label="Tensão (V)" type="number" value={motorInput.voltage} onChange={e => setMotorInput({...motorInput, voltage: Number(e.target.value)})} />
              <Input label="Rendimento (%)" type="number" value={motorInput.efficiency} onChange={e => setMotorInput({...motorInput, efficiency: Number(e.target.value)})} />
              <Input label="Fator de Potência" type="number" step="0.01" value={motorInput.powerFactor} onChange={e => setMotorInput({...motorInput, powerFactor: Number(e.target.value)})} />
              <Select label="Partida" options={[{ label: 'Direta', value: 'direta' }, { label: 'Estrela-Triângulo', value: 'estrela-triangulo' }, { label: 'Soft-Starter', value: 'soft-starter' }]} value={motorInput.startingMethod} onChange={e => setMotorInput({...motorInput, startingMethod: e.target.value as any})} />
            </div>
          )}

          {calcType === 'qdc' && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-500">Adicione as correntes dos circuitos terminais para dimensionar o QDC.</p>
              {qdcInput.circuits.map((c, i) => {
                const suggestedBreaker = BREAKER_RATINGS.find(r => r >= c.current) || 125;
                const loadRatio = c.current / suggestedBreaker;
                const isSafe = loadRatio <= 0.8;

                return (
                  <div key={c.id} className="flex gap-4 items-end bg-zinc-50 dark:bg-zinc-900/30 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                    <div className="flex-1">
                      <Input label={`Circuito ${c.id} (A)`} type="number" value={c.current} onChange={e => {
                        const newCircs = [...qdcInput.circuits];
                        newCircs[i].current = Number(e.target.value);
                        setQdcInput({...qdcInput, circuits: newCircs});
                      }} />
                    </div>
                    <div className="flex-1">
                      <Input label="Tipo" value={c.type} onChange={e => {
                        const newCircs = [...qdcInput.circuits];
                        newCircs[i].type = e.target.value;
                        setQdcInput({...qdcInput, circuits: newCircs});
                      }} />
                    </div>
                    <div className="flex flex-col items-center pb-2">
                      <span className="text-[10px] font-bold uppercase text-zinc-400 mb-1">Status</span>
                      <div className={cn(
                        "w-4 h-4 rounded-full shadow-sm",
                        isSafe ? "bg-emerald-500 shadow-emerald-500/50" : "bg-red-500 shadow-red-500/50"
                      )} title={isSafe ? "Carga adequada (<80%)" : "Carga elevada (>80%)"} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {calcType === 'spda' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input label="Altura da Edificação (m)" type="number" value={spdaInput.height} onChange={e => setSpdaInput({...spdaInput, height: Number(e.target.value)})} />
              <Input label="Largura (m)" type="number" value={spdaInput.width} onChange={e => setSpdaInput({...spdaInput, width: Number(e.target.value)})} />
              <Input label="Comprimento (m)" type="number" value={spdaInput.length} onChange={e => setSpdaInput({...spdaInput, length: Number(e.target.value)})} />
              <Select label="Nível de Risco" options={[{ label: 'Nível I', value: 1 }, { label: 'Nível II', value: 2 }, { label: 'Nível III', value: 3 }, { label: 'Nível IV', value: 4 }]} value={spdaInput.riskLevel} onChange={e => setSpdaInput({...spdaInput, riskLevel: Number(e.target.value) as any})} />
            </div>
          )}

          {calcType === 'solar' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input label="Consumo Mensal (kWh)" type="number" value={solarInput.monthlyConsumption} onChange={e => setSolarInput({...solarInput, monthlyConsumption: Number(e.target.value)})} />
              <Input label="Irradiação Solar (kWh/m²/dia)" type="number" step="0.1" value={solarInput.solarIrradiation} onChange={e => setSolarInput({...solarInput, solarIrradiation: Number(e.target.value)})} />
              <Input label="Potência do Painel (Wp)" type="number" value={solarInput.panelPower} onChange={e => setSolarInput({...solarInput, panelPower: Number(e.target.value)})} />
            </div>
          )}

          <Button className="w-full mt-8 h-12 text-lg" onClick={handleCalculate}>
            Calcular Dimensionamento
          </Button>
        </Card>

        <div className="space-y-6">
          {calcType === 'conductors' && result && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className={cn("p-8 border-l-8", result.isConform ? "border-l-emerald-500" : "border-l-red-500")}>
                <h3 className="text-2xl font-bold mb-4">Resultado Técnico</h3>
                <div className="grid grid-cols-2 gap-8">
                  <div className="col-span-2 flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                    <div>
                      <p className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">Bitola Mínima do Cabo</p>
                      <p className="text-sm text-blue-600/70 dark:text-blue-400/70">Sugestão baseada na NBR 5410</p>
                    </div>
                    <span className="text-3xl font-black text-blue-600 dark:text-blue-400">{result.cableSection} mm²</span>
                  </div>
                  <ResultItem label="Seção do Cabo" value={`${result.cableSection} mm²`} />
                  <ResultItem label="Disjuntor" value={`${result.breakerCurve}${result.breakerRating} A`} highlight danger={result.breakerRating > result.izCorrected} />
                  <ResultItem label="Corrente Ib" value={`${result.current.toFixed(2)} A`} />
                  <ResultItem label="Capacidade Iz (Corrigida)" value={`${result.izCorrected.toFixed(2)} A`} danger={result.breakerRating > result.izCorrected} />
                  <ResultItem label="Queda de Tensão" value={`${result.voltageDrop.toFixed(2)} V (${result.voltageDropPercent.toFixed(2)} %)`} />
                  <ResultItem label="Icc Presumida" value={`${result.shortCircuitCurrent.toFixed(0)} A`} danger={!result.isIcnConform} />
                  <ResultItem label="Condutor Neutro" value={`${result.neutralSection} mm²`} />
                  <ResultItem label="Condutor Terra" value={`${result.earthSection} mm²`} />
                  <ResultItem label="Eletroduto Sugerido" value={result.conduitSize} highlight />
                </div>

                {/* Diagrama Unifilar Simples */}
                <div className="mt-8 p-6 bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Zap className="w-3 h-3 text-yellow-500" /> Diagrama Unifilar (Simplificado)
                  </h4>
                  <div className="flex items-center justify-between relative">
                    <div className="absolute top-1/2 left-0 w-full h-0.5 bg-zinc-800 -translate-y-1/2 z-0" />
                    
                    <div className="relative z-10 flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center mb-2">
                        <span className="text-[10px] font-bold text-zinc-400">FONTE</span>
                      </div>
                      <span className="text-[9px] text-zinc-500 uppercase">{input.voltage}V</span>
                    </div>

                    <div className="relative z-10 flex flex-col items-center">
                      <div className="w-12 h-8 bg-blue-600 rounded flex items-center justify-center mb-2 shadow-lg shadow-blue-900/20">
                        <span className="text-[10px] font-black text-white">{result.breakerRating}A</span>
                      </div>
                      <span className="text-[9px] text-zinc-500 uppercase">Disjuntor</span>
                    </div>

                    <div className="relative z-10 flex flex-col items-center">
                      <div className="px-3 py-1 bg-zinc-800 border border-zinc-700 rounded-full mb-2">
                        <span className="text-[10px] font-bold text-zinc-300">{result.cableSection}mm²</span>
                      </div>
                      <span className="text-[9px] text-zinc-500 uppercase">Cabo</span>
                    </div>

                    <div className="relative z-10 flex flex-col items-center">
                      <div className="w-10 h-10 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center mb-2">
                        <Zap className="w-5 h-5 text-yellow-500" />
                      </div>
                      <span className="text-[9px] text-zinc-500 uppercase">{input.loadType}</span>
                    </div>
                  </div>
                </div>

                {/* BOM Section */}
                <div className="mt-8">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Package className="w-3 h-3" /> Lista de Materiais Estimada (BOM)
                  </h4>
                  <div className="space-y-2">
                    {result.bom.map((item, i) => (
                      <div key={i} className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-900/30 rounded-lg border border-zinc-100 dark:border-zinc-800">
                        <div>
                          <p className="text-sm font-medium">{item.item}</p>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-tighter">Qtd: {item.quantity}</p>
                        </div>
                        <span className="text-sm font-bold text-emerald-600">R$ {item.estimatedPrice.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                      <span className="text-sm font-bold uppercase text-zinc-400">Total Estimado</span>
                      <span className="text-lg font-black text-emerald-600">
                        R$ {result.bom.reduce((acc, curr) => acc + curr.estimatedPrice, 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {result.notes.length > 0 && (
                  <div className="mt-6 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <AlertCircle className="w-3 h-3" /> Observações Técnicas
                    </h4>
                    <ul className="space-y-1">
                      {result.notes.map((note, i) => (
                        <li key={i} className="text-sm text-zinc-600 dark:text-zinc-400 flex gap-2">
                          <span className="text-blue-500">•</span> {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex gap-4 mt-8">
                  <Button variant="outline" className="flex-1" onClick={() => generateMemorialPDF(input, result, "Cliente Exemplo")}>
                    <Download className="w-4 h-4" /> Gerar PDF
                  </Button>
                  <Button className="flex-1" onClick={() => setIsSaveModalOpen(true)}>
                    <ClipboardList className="w-4 h-4" /> Salvar no Chamado
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Save Modal */}
          {isSaveModalOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-zinc-900 rounded-2xl p-8 max-w-md w-full shadow-2xl">
                <h3 className="text-xl font-bold mb-4">Selecionar Chamado</h3>
                <p className="text-sm text-zinc-500 mb-6">Escolha o chamado para associar este memorial de cálculo.</p>
                <div className="space-y-2 max-h-[300px] overflow-y-auto mb-6 pr-2">
                  {tickets.map(t => (
                    <button 
                      key={t.id} 
                      onClick={() => handleSaveCalculation(t.id)}
                      className="w-full text-left p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl border border-zinc-100 dark:border-zinc-800 transition-colors"
                    >
                      <p className="font-bold text-sm">#{t.id} - {t.title}</p>
                      <p className="text-xs text-zinc-500">{t.client_name}</p>
                    </button>
                  ))}
                </div>
                <Button variant="outline" className="w-full" onClick={() => setIsSaveModalOpen(false)}>Cancelar</Button>
              </motion.div>
            </div>
          )}

          {calcType === 'motors' && motorResult && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className="p-8 border-l-8 border-l-blue-500">
                <h3 className="text-2xl font-bold mb-4">Resultado Motor</h3>
                <div className="grid grid-cols-2 gap-8">
                  <ResultItem label="Corrente Nominal" value={`${motorResult.nominalCurrent.toFixed(2)} A`} />
                  <ResultItem label="Corrente Partida" value={`${motorResult.startingCurrent.toFixed(2)} A`} />
                  <ResultItem label="Disjuntor Motor" value={`${motorResult.breaker} A`} highlight />
                  <ResultItem label="Contator Sugerido" value={motorResult.contactor} highlight />
                </div>
              </Card>
            </motion.div>
          )}

          {calcType === 'qdc' && qdcResult && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className="p-8 border-l-8 border-l-indigo-500">
                <h3 className="text-2xl font-bold mb-4">Resultado QDC</h3>
                <div className="grid grid-cols-2 gap-8">
                  <ResultItem label="Corrente Total" value={`${qdcResult.totalCurrent.toFixed(2)} A`} />
                  <ResultItem label="Disjuntor Geral" value={`${qdcResult.mainBreaker} A`} highlight />
                  <ResultItem label="DR Sugerido" value={`${qdcResult.drRating} A`} />
                  <ResultItem label="DPS" value={qdcResult.dpsRating} />
                </div>

                {/* Phase Balancing Visualization */}
                <div className="mt-8">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <TrendingUp className="w-3 h-3" /> Equilíbrio de Fases (Carga por Fase)
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    {qdcResult.phaseBalance.map((p, i) => {
                      const max = Math.max(...qdcResult.phaseBalance.map(pb => pb.current));
                      const height = max > 0 ? (p.current / max) * 100 : 0;
                      
                      return (
                        <div key={i} className="flex flex-col items-center">
                          <div className="w-full h-32 bg-zinc-100 dark:bg-zinc-900 rounded-lg relative overflow-hidden mb-2 border border-zinc-200 dark:border-zinc-800">
                            <motion.div 
                              initial={{ height: 0 }}
                              animate={{ height: `${height}%` }}
                              className="absolute bottom-0 left-0 w-full bg-indigo-500/50 border-t border-indigo-400"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-xs font-bold">{p.current.toFixed(1)}A</span>
                            </div>
                          </div>
                          <span className="text-xs font-black text-zinc-400">FASE {p.phase}</span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-4 text-[10px] text-zinc-500 italic">
                    * Distribuição automática baseada na carga de cada circuito para minimizar o desequilíbrio.
                  </p>
                </div>
              </Card>
            </motion.div>
          )}

          {calcType === 'spda' && spdaResult && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className="p-8 border-l-8 border-l-orange-500">
                <h3 className="text-2xl font-bold mb-4">Resultado SPDA</h3>
                <div className="grid grid-cols-2 gap-8">
                  <ResultItem label="Raio de Proteção" value={`${spdaResult.protectionRadius.toFixed(1)} m`} />
                  <ResultItem label="Espaçamento Descidas" value={`${spdaResult.downConductorSpacing} m`} />
                  <ResultItem label="Malha Sugerida" value={spdaResult.meshSize} highlight />
                  <ResultItem label="Profundidade Anel" value={`${spdaResult.groundingRingDepth} m`} />
                </div>
              </Card>
            </motion.div>
          )}

          {calcType === 'solar' && solarResult && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className="p-8 border-l-8 border-l-yellow-500">
                <h3 className="text-2xl font-bold mb-4">Resultado Fotovoltaico</h3>
                <div className="grid grid-cols-2 gap-8">
                  <ResultItem label="Painéis Estimados" value={`${solarResult.estimatedPanels} un`} highlight />
                  <ResultItem label="Potência do Sistema" value={`${solarResult.systemPower.toFixed(2)} kWp`} />
                  <ResultItem label="Geração Mensal" value={`${solarResult.monthlyGeneration.toFixed(0)} kWh`} />
                  <ResultItem label="Área Necessária" value={`${solarResult.estimatedArea} m²`} />
                </div>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultItem({ label, value, highlight, danger }: { label: string, value: string, highlight?: boolean, danger?: boolean }) {
  return (
    <div>
      <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1">{label}</p>
      <p className={cn(
        "text-2xl font-bold",
        danger ? "text-red-600 dark:text-red-400" : highlight ? "text-blue-600 dark:text-blue-400" : ""
      )}>{value}</p>
    </div>
  );
}

// --- NR10 Modal Component ---

function NR10Modal({ onClose, onSubmit, initialData }: { onClose: () => void, onSubmit: (data: any) => void, initialData?: any }) {
  const [data, setData] = useState(initialData || {
    epi: false,
    desenergizado: false,
    sinalizado: false,
    ferramentas_isoladas: false,
    area_isolada: false
  });

  const items = [
    { key: 'epi', label: 'Uso de EPIs adequados (Luvas, Óculos, Capacete)' },
    { key: 'desenergizado', label: 'Circuito desenergizado e testado' },
    { key: 'sinalizado', label: 'Área sinalizada e bloqueada (LOTO)' },
    { key: 'ferramentas_isoladas', label: 'Ferramentas isoladas 1000V verificadas' },
    { key: 'area_isolada', label: 'Área de trabalho isolada de terceiros' }
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-zinc-900 rounded-2xl p-8 max-w-md w-full shadow-2xl">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-red-600" /> Checklist de Segurança NR10
        </h3>
        <p className="text-sm text-zinc-500 mb-6">Verifique todos os itens antes de iniciar a intervenção elétrica.</p>
        
        <div className="space-y-4 mb-8">
          {items.map(item => (
            <label key={item.key} className="flex items-center gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl cursor-pointer transition-colors">
              <input 
                type="checkbox" 
                checked={(data as any)[item.key]} 
                onChange={e => setData({ ...data, [item.key]: e.target.checked })}
                className="w-5 h-5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium">{item.label}</span>
            </label>
          ))}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button 
            className="flex-1" 
            disabled={!Object.values(data).every(v => v === true)}
            onClick={() => onSubmit(data)}
          >
            Confirmar Segurança
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// --- AI Consultant Component ---

function AIConsultant({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([
    { role: 'model', text: 'Olá! Sou seu Consultor Normativo IA. Como posso ajudar com a NBR 5410 ou outras normas hoje?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const model = genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [...messages, { role: 'user', text: userMsg }].map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        })),
        config: {
          systemInstruction: "Você é um consultor técnico especialista em normas elétricas brasileiras (NBR 5410, NBR 5419, NR10). Responda de forma técnica, precisa e cite itens da norma quando possível. Seja direto e profissional."
        }
      });

      const response = await model;
      setMessages(prev => [...prev, { role: 'model', text: response.text || "Desculpe, tive um problema ao processar sua consulta." }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'model', text: "Erro na conexão com a IA." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <motion.div 
        initial={{ y: 100, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        exit={{ y: 100, opacity: 0 }}
        className="bg-white dark:bg-zinc-900 w-full max-w-2xl h-[600px] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="p-6 bg-blue-600 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Zap className="w-6 h-6" />
            <div>
              <h3 className="font-bold">Consultor Normativo IA</h3>
              <p className="text-[10px] opacity-70 uppercase tracking-widest">Especialista NBR 5410 / 5419</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={cn(
              "max-w-[85%] p-4 rounded-2xl text-sm",
              m.role === 'user' 
                ? "bg-blue-600 text-white self-end ml-auto rounded-tr-none" 
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-tl-none border border-zinc-200 dark:border-zinc-700"
            )}>
              {m.text}
            </div>
          ))}
          {loading && (
            <div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-2xl rounded-tl-none w-20 flex gap-1">
              <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          )}
        </div>

        <form onSubmit={handleSend} className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex gap-3">
          <input 
            type="text" 
            placeholder="Pergunte sobre a NBR 5410..." 
            className="flex-1 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            value={input}
            onChange={e => setInput(e.target.value)}
          />
          <Button type="submit" disabled={loading} className="w-12 h-12 p-0 rounded-xl">
            <ChevronRight className="w-6 h-6" />
          </Button>
        </form>
      </motion.div>
    </div>
  );
}

// --- Finance View ---

function FinanceView() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    fetch('/api/finance').then(res => res.json()).then(setTransactions);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Fluxo de Caixa</h3>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.open('/api/finance/export')}>
            <Download className="w-4 h-4" /> Exportar CSV
          </Button>
          <Button>
            <Plus className="w-4 h-4" /> Nova Transação
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Entradas" value={4500} icon={TrendingUp} color="emerald" isCurrency />
        <StatCard title="Saídas" value={1200} icon={TrendingUp} color="red" isCurrency />
        <StatCard title="Saldo" value={3300} icon={DollarSign} color="blue" isCurrency />
      </div>

      <Card>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
              <th className="px-6 py-4 text-sm font-semibold">Data</th>
              <th className="px-6 py-4 text-sm font-semibold">Descrição</th>
              <th className="px-6 py-4 text-sm font-semibold">Categoria</th>
              <th className="px-6 py-4 text-sm font-semibold text-right">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {transactions.map(t => (
              <tr key={t.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                <td className="px-6 py-4 text-sm text-zinc-500">{new Date(t.date).toLocaleDateString()}</td>
                <td className="px-6 py-4 text-sm font-medium">{t.description}</td>
                <td className="px-6 py-4 text-sm text-zinc-500">{t.category}</td>
                <td className={cn(
                  "px-6 py-4 text-sm font-bold text-right",
                  t.type === 'income' ? "text-emerald-600" : "text-red-600"
                )}>
                  {t.type === 'income' ? '+' : '-'} {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// --- Inventory View ---

function InventoryView() {
  const [items, setItems] = useState<InventoryItem[]>([]);

  useEffect(() => {
    fetch('/api/inventory').then(res => res.json()).then(setItems);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Controle de Estoque</h3>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.open('/api/inventory/export')}>
            <Download className="w-4 h-4" /> Exportar CSV
          </Button>
          <Button>
            <Plus className="w-4 h-4" /> Novo Item
          </Button>
        </div>
      </div>

      <Card>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
              <th className="px-6 py-4 text-sm font-semibold">Item</th>
              <th className="px-6 py-4 text-sm font-semibold">Categoria</th>
              <th className="px-6 py-4 text-sm font-semibold">Quantidade</th>
              <th className="px-6 py-4 text-sm font-semibold">Status</th>
              <th className="px-6 py-4 text-sm font-semibold text-right">Preço Unit.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {items.map(item => (
              <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                <td className="px-6 py-4 text-sm font-medium">{item.name}</td>
                <td className="px-6 py-4 text-sm text-zinc-500">{item.category}</td>
                <td className="px-6 py-4 text-sm font-bold">{item.quantity}</td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-2 py-1 rounded-full text-xs font-semibold",
                    item.quantity <= item.min_quantity ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                  )}>
                    {item.quantity <= item.min_quantity ? 'Estoque Baixo' : 'Normal'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-bold text-right">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.unit_price)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// --- Team View ---

function TeamView() {
  const [members, setMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    fetch('/api/team').then(res => res.json()).then(setMembers);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Equipe Técnica</h3>
        <Button>
          <Plus className="w-4 h-4" /> Novo Membro
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {members.map(member => (
          <Card key={member.id} className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                {member.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <h4 className="font-bold">{member.name}</h4>
                <p className="text-sm text-zinc-500">{member.role}</p>
              </div>
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Disponível</span>
              <Button variant="outline" className="py-1 text-xs">Ver Perfil</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// --- Settings View ---

function SettingsView({ user }: { user: any }) {
  return (
    <div className="max-w-4xl space-y-8">
      {/* Plan Info */}
      <Card className="p-8 border-l-8 border-l-blue-600">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-blue-600" /> Plano Atual: {user?.plan?.toUpperCase()}
            </h3>
            <p className="text-zinc-500">Sua assinatura PRO está ativa até 24/03/2026</p>
          </div>
          <Button variant="outline">Alterar Plano</Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="p-8">
          <h3 className="text-xl font-bold mb-6">Perfil do Profissional</h3>
          <div className="space-y-6">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                <User className="w-10 h-10 text-zinc-400" />
              </div>
              <Button variant="outline">Alterar Foto</Button>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <Input label="Nome Completo" defaultValue={user?.name} />
              <Input label="E-mail" defaultValue="admin@mestre.app" />
              <Input label="Registro Profissional" defaultValue="123456-7" />
            </div>
          </div>
        </Card>

        <Card className="p-8">
          <h3 className="text-xl font-bold mb-6">Faturamento</h3>
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg">
              <CreditCard className="w-6 h-6 text-zinc-400" />
              <div>
                <p className="font-bold">Visa final 4242</p>
                <p className="text-xs text-zinc-500">Próxima cobrança: R$ 199,90 em 24/03</p>
              </div>
            </div>
            <Button variant="outline" className="w-full">Gerenciar Assinatura</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
