import React from 'react';
import { motion } from 'motion/react';
import { Home, Gift, Camera, User } from 'lucide-react';
import { cn } from '../lib/utils';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Navigation({ activeTab, setActiveTab }: NavigationProps) {
  const tabs = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'gifts', icon: Gift, label: 'Gifts' },
    { id: 'memories', icon: Camera, label: 'Memories' },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-t border-slate-100/50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-around h-20 px-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative flex-1 flex flex-col items-center justify-center gap-1.5 h-full transition-all active:scale-90"
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-x-2 inset-y-2 bg-primary/5 rounded-2xl"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              <div className="relative flex flex-col items-center gap-1">
                <Icon className={cn(
                  "w-6 h-6 transition-all duration-300",
                  isActive ? "text-primary scale-110" : "text-slate-400"
                )} />
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-widest transition-colors duration-300",
                  isActive ? "text-primary" : "text-slate-400"
                )}>
                  {tab.label}
                </span>
              </div>
              {isActive && (
                <motion.div
                  layoutId="activeDot"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-b-full shadow-[0_2px_10px_rgba(255,77,109,0.5)]"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
