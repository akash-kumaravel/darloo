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
    <div className="fixed bottom-6 left-6 right-6 z-50">
      <div className="glass rounded-3xl p-2 flex items-center justify-around shadow-2xl">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative py-3 px-6 transition-all"
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-primary/10 rounded-2xl"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              <div className="relative flex flex-col items-center gap-1">
                <Icon className={cn(
                  "w-6 h-6 transition-colors duration-300",
                  isActive ? "text-primary" : "text-slate-400"
                )} />
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-widest transition-colors duration-300",
                  isActive ? "text-primary" : "text-slate-400"
                )}>
                  {tab.label}
                </span>
              </div>
              {isActive && (
                <motion.div
                  layoutId="activeDot"
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
