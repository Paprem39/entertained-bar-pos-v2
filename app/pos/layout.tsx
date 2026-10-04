"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { 
  ShoppingCart, 
  CreditCard, 
  FileText, 
  Package, 
  DollarSign, 
  LogOut, 
  Menu, 
  X,
  Grid
} from "lucide-react";

export default function POSLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentTime, setCurrentTime] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userData, setUserData] = useState<{ display_name: string; role: string } | null>(null);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false); // ควบคุม Modal ยืนยันออกจากระบบ

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth');
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUserData(data.user);
        }
      } catch (err) {
        console.error("Failed to fetch session user", err);
      }
    };
    fetchUser();

    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const confirmLogout = async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' });
    } catch (e) {
      console.error(e);
    }
    router.push('/');
  };

  const navItems = [
    { name: "POS บล็อกขาย", href: "/pos", icon: Grid },
    { name: "เครดิตค้างชำระ", href: "/pos/credits", icon: CreditCard },
    { name: "รายการบิลทั้งหมด", href: "/pos/bills", icon: FileText },
    { name: "จัดการสต็อก", href: "/pos/stock", icon: Package },
    { name: "รายจ่ายร้าน", href: "/pos/expenses", icon: DollarSign },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* --- HEADER --- */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center overflow-hidden">
              <Image 
                src="/logo.png" 
                alt="Logo" 
                width={32} 
                height={32} 
                className="object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div className="font-bold text-base md:text-lg tracking-wider bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              ENTERTAINED BAR
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-sm">
          <div className="hidden sm:block text-slate-400">
            เวลา: <span className="text-slate-200 font-mono">{currentTime}</span>
          </div>
          
          {/* แสดง display_name และ Role จริง */}
          <div className="bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700 flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-slate-200 font-medium">{userData?.display_name || "กำลังโหลด..."}</span>
            <span className="text-xs bg-slate-700 text-amber-400 px-2 py-0.5 rounded-md font-semibold">
              {userData?.role || "Staff"}
            </span>
          </div>

          <button
            onClick={() => setLogoutModalOpen(true)}
            className="flex items-center space-x-1 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white px-3 py-1.5 rounded-lg transition border border-red-500/30 cursor-pointer"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">ออกจากระบบ</span>
          </button>
        </div>
      </header>

      {/* --- BODY CONTAINER --- */}
      <div className="flex flex-1 relative overflow-hidden">
        {/* --- SIDEBAR --- */}
        <aside className={`
          fixed md:static inset-y-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-800 
          transform transition-transform duration-200 ease-in-out flex flex-col
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          top-16 md:top-0
        `}>
          <div className="p-4 space-y-1 flex-1 overflow-y-auto">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
              เมนูหลัก POS
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center space-x-3 px-3 py-3 rounded-xl font-medium transition
                    ${isActive 
                      ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-bold" 
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"}
                  `}
                >
                  <Icon size={20} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </aside>

        {/* --- MAIN CONTENT --- */}
        <main className="flex-1 bg-slate-950 p-4 md:p-6 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* --- CUSTOM LOGOUT MODAL --- */}
      {logoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto text-2xl font-bold border border-amber-500/20">
              <LogOut size={28} />
            </div>
            <h3 className="text-xl font-bold text-slate-100">ยืนยันการออกจากระบบ</h3>
            <p className="text-slate-400 text-sm">
              คุณต้องการออกจากระบบแคชเชียร์ใช่หรือไม่?
            </p>
            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setLogoutModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmLogout}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition shadow-lg shadow-red-600/20"
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}