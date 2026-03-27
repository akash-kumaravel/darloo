import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, Heart, Gift } from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { cn } from '../lib/utils';
import { addStars, getStars } from '../services/api';

interface StarReactorProps {
  totalStars: number;
  isAdmin: boolean;
  cooldown?: number;
  onStarAdded?: (newTotal: number) => void;
  onGiftOpen?: () => void;
}

export default function StarReactor({ totalStars, isAdmin, cooldown = 500, onStarAdded, onGiftOpen }: StarReactorProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [lastClick, setLastClick] = useState(0);
  const [floatingHearts, setFloatingHearts] = useState<{ id: number; x: number; y: number }[]>([]);

  // Calculate stars in current cycle (0-24 = collecting; cycle complete when 0 and totalStars > 0)
  const starsInCycle = totalStars % 25;
  const [giftOpenedThisCycle, setGiftOpenedThisCycle] = useState(false);
  const isGiftReadyToOpen = starsInCycle === 0 && totalStars > 0 && !giftOpenedThisCycle;
  const currentGiftNumber = Math.floor(totalStars / 25);

  React.useEffect(() => {
    if (starsInCycle !== 0) {
      setGiftOpenedThisCycle(false);
    }
  }, [starsInCycle]);

  const handleGiveStar = async () => {
    const now = Date.now();
    if (now - lastClick < cooldown) {
      toast.error('Wait a moment... ❤️');
      return;
    }

    // Gift open mode when exactly on 25-cycle and not opened yet
    if (isGiftReadyToOpen) {
      onGiftOpen?.();
      setGiftOpenedThisCycle(true);
      toast.success(`Gift #${currentGiftNumber} opening! 🎁`);
      return;
    }

    // Only admin can give stars incrementally
    if (!isAdmin) {
      toast.error('Only admin can give stars before gift unlock');
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
      // Send star to server
      const response = await addStars(1, 'Admin reward');
      
      if (!response.success) {
        toast.error('Failed to give star');
        setIsAnimating(false);
        return;
      }

      // Update localStorage stats
      const stats = JSON.parse(localStorage.getItem('loveverse_stats') || '{"totalStars": 0, "level": 1, "xp": 0}');
      stats.totalStars = response.total;
      stats.lastStarGivenAt = new Date().toISOString();
      localStorage.setItem('loveverse_stats', JSON.stringify(stats));
      
      // Notify parent component of the update
      onStarAdded?.(response.total);
      toast.success('Star Given! ✨');
    } catch (error) {
      console.error('Error giving star:', error);
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
        {/* GIFT UNLOCK ANIMATIONS - Only reveal when gift is ready (every 25 stars) */}
        {isGiftReadyToOpen && (
          <>
            {/* Pulsing gift box glow - animated reveal effect */}
            <motion.div 
              animate={{ 
                opacity: [0.3, 0.6, 0.3],
                scale: [1, 1.15, 1]
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute inset-0 bg-gradient-to-br from-primary via-secondary to-primary blur-2xl rounded-full" 
            />
            {/* Shimmer effect for gift */}
            <motion.div
              animate={{ 
                opacity: [0.2, 0.5, 0.2],
                rotate: [0, 360]
              }}
              transition={{ duration: 3, repeat: Infinity }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent blur-xl rounded-full"
            />
          </>
        )}

        <div className={cn(
          "relative glass p-8 rounded-full shadow-2xl border-4 transition-all duration-500",
          isGiftReadyToOpen 
            ? "border-primary shadow-[0_0_60px_rgba(255,77,109,0.6)]" 
            : "border-white"
        )}>
          {isGiftReadyToOpen ? (
            /* GIFT BOX - Ready when stars % 25 == 0 */
            <motion.div
              animate={{ rotateY: [0, 360] }}
              transition={{ repeat: Infinity, duration: 4 }}
              className="w-24 h-24"
            >
              <Gift 
                className="w-24 h-24 text-primary fill-primary drop-shadow-lg" 
              />
            </motion.div>
          ) : (
            /* STAR - Shows while collecting stars (1-24 in cycle) */
            <Star 
              className={cn(
                "w-24 h-24 transition-all duration-500",
                totalStars > 0 ? "text-yellow-400 fill-yellow-400" : "text-slate-200"
              )} 
            />
          )}
          
          {/* Level Badge */}
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className={cn(
              "absolute -top-2 -right-2 text-xs font-bold px-3 py-1 rounded-full shadow-lg",
              isGiftReadyToOpen
                ? "bg-gradient-to-r from-primary to-secondary text-white"
                : "bg-primary text-white"
            )}
          >
            {isGiftReadyToOpen ? `🎁 GIFT #${currentGiftNumber}!` : `LVL ${Math.floor(totalStars / 10) + 1}`}
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
          animate={{ width: isGiftReadyToOpen ? "100%" : `${(starsInCycle * 4)}%` }}
          className={cn(
            "h-full rounded-full shadow-lg transition-all duration-300",
            isGiftReadyToOpen
              ? "bg-gradient-to-r from-primary to-secondary"
              : "bg-gradient-to-r from-primary to-secondary"
          )}
        />
      </div>
      <div className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        {isGiftReadyToOpen 
          ? `🎁 GIFT #${currentGiftNumber} READY! CLICK THE BOX` 
          : `${25 - starsInCycle} stars until gift #${currentGiftNumber + 1}`}
      </div>
    </div>
  );
}
