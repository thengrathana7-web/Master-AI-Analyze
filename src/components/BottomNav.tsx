import React from 'react';
import { Home, BarChart2, Cpu, BookOpen, Settings } from 'lucide-react';

export type NavTab = 'home' | 'chart' | 'analysis' | 'journal' | 'settings';

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  const navItems: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'chart', label: 'Chart', icon: BarChart2 },
    { id: 'analysis', label: 'Analysis', icon: Cpu },
    { id: 'journal', label: 'Journal', icon: BookOpen },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#070d18]/95 backdrop-blur-lg border-t border-slate-800/80 pb-safe">
      <div className="max-w-md mx-auto flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition duration-150 relative ${
                isActive ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`w-9 h-8 rounded-lg flex items-center justify-center transition ${
                  isActive ? 'bg-emerald-500/15 text-emerald-400' : ''
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
              </div>
              <span className={`text-[10px] mt-0.5 font-semibold tracking-tight ${isActive ? 'text-emerald-400' : 'text-slate-400'}`}>
                {item.label}
              </span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] absolute -top-1" />
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Branding line matching image.png */}
      <div className="text-center py-1 border-t border-slate-800/30 text-[9px] font-semibold tracking-[0.2em] text-slate-500 uppercase">
        <span>STEP INDEX</span>
        <span className="mx-2">•</span>
        <span className="text-cyan-500">AI POWERED</span>
        <span className="mx-2">•</span>
        <span className="text-emerald-500">DERIV DATA</span>
      </div>
    </div>
  );
};
