import React from 'react';
import { motion } from 'motion/react';
import { useMood } from '../context/MoodContext';
import { MoodType } from '../types';
import { Smile, Heart, Frown, Moon } from 'lucide-react';

const moods: { type: MoodType; icon: any; label: string; color: string }[] = [
  { type: 'happy', icon: Smile, label: 'Happy', color: '#FFD700' },
  { type: 'miss_you', icon: Heart, label: 'Miss You', color: '#FF69B4' },
  { type: 'upset', icon: Frown, label: 'Upset', color: '#4682B4' },
  { type: 'tired', icon: Moon, label: 'Tired', color: '#808080' }
];

export default function MoodEngine() {
  const { currentMood, setMood } = useMood();

  return (
    <div className="glass rounded-3xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-800">Current Mood</h3>
        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
          {currentMood.replace('_', ' ')}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {moods.map((mood) => {
          const Icon = mood.icon;
          const isActive = currentMood === mood.type;

          return (
            <motion.button
              key={mood.type}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setMood(mood.type)}
              className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all ${
                isActive 
                  ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
              }`}
            >
              <Icon className={`w-6 h-6 ${isActive ? 'animate-pulse' : ''}`} />
              <span className="text-[10px] font-bold uppercase tracking-tighter">
                {mood.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
