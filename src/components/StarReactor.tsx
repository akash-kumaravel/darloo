import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, Heart } from 'lucide-react';
import { doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';

interface StarReactorProps {
  totalStars: number;
  isAdmin: boolean;
  cooldown?: number;
}

export default function StarReactor({ totalStars, isAdmin, cooldown = 500 }: StarReactorProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [lastClick, setLastClick] = useState(0);
  const [floatingHearts, setFloatingHearts] = useState<{ id: number; x: number; y: number }[]>([]);

  const handleGiveStar = async () => {
    if (!isAdmin) return;
    
    const now = Date.now();
    if (now - lastClick < cooldown) {
      toast.error('Wait a moment... ❤️');
      return;
    }

    setLastClick(now);
    setIsAnimating(true);
    
    // Confetti burst
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#ff4d6d', '#ff758f', '#ffb3c1', '#ffd166']
    });

    // Add floating hearts
    const newHearts = Array.from({ length: 5 }).map((_, i) => ({
      id: Date.now() + i,
      x: Math.random() * 200 - 100,
      y: Math.random() * -200 - 50
    }));
    setFloatingHearts(prev => [...prev, ...newHearts]);

    try {
      await updateDoc(doc(db, 'stats', 'global'), {
        totalStars: increment(1),
        lastStarGivenAt: new Date().toISOString()
      });
      toast.success('Star Given! ✨');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'stats/global');
      toast.error('Failed to give star');
    }

    setTimeout(() => setIsAnimating(false), 1000);
    setTimeout(() => setFloatingHearts(prev => prev.filter(h => !newHearts.includes(h))), 3000);
  };

  return (
    <div className="relative flex flex-col items-center justify-center py-12">
      <AnimatePresence>
        {floatingHearts.map(heart => (
          <motion.div
            key={heart.id}
            initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
            animate={{ opacity: 0, scale: 1.5, x: heart.x, y: heart.y }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="absolute z-10"
          >
            <Heart className="text-primary fill-primary w-6 h-6" />
          </motion.div>
        ))}
      </AnimatePresence>

      <motion.div
        animate={isAnimating ? { scale: [1, 1.4, 1], rotate: [0, 15, -15, 0] } : {}}
        transition={{ duration: 0.5 }}
        className="relative cursor-pointer"
        onClick={handleGiveStar}
      >
        {/* Gift reveal background glow - only show when 25+ stars for gift unlock */}
        {totalStars >= 25 && (
          <motion.div 
            animate={{ opacity: [0.2, 0.4, 0.2], scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150" 
          />
        )}
        <div className="relative glass p-8 rounded-full shadow-2xl border-4 border-white">
          <Star 
            className={cn(
              "w-24 h-24 transition-all duration-500",
              totalStars > 0 ? "text-yellow-400 fill-yellow-400" : "text-slate-200"
            )} 
          />
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute -top-2 -right-2 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg"
          >
            LVL {Math.floor(totalStars / 10) + 1}
          </motion.div>
        </div>
      </motion.div>

      <div className="mt-8 text-center">
        <motion.div 
          key={totalStars}
          initial={{ scale: 1.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-6xl font-black text-slate-800 tracking-tighter"
        >
          {totalStars}
        </motion.div>
        <div className="text-xs uppercase tracking-[0.3em] font-bold text-slate-400 mt-2">
          Stars Collected
        </div>
      </div>

      <div className="w-full max-w-xs mt-8 h-3 bg-white/50 rounded-full overflow-hidden shadow-inner p-0.5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(totalStars % 25) * 4}%` }}
          className="h-full bg-gradient-to-r from-primary to-secondary rounded-full shadow-lg"
        />
      </div>
      <div className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        {25 - (totalStars % 25)} stars until next gift
      </div>
    </div>
  );
}
