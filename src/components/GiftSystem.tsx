import { cn } from '../lib/utils';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Gift, Sparkles, ChevronRight, Heart } from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc,
  orderBy,
  limit
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { GiftSet, GiftOption } from '../types';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';

interface GiftSystemProps {
  totalStars: number;
}

type RevealPhase = 'idle' | 'flipping' | 'won' | 'revealing' | 'revealOthers' | 'complete';

// Typewriter Component
const Typewriter = ({ text, speed = 50, onComplete }: { text: string; speed?: number; onComplete?: () => void }) => {
  const [displayedText, setDisplayedText] = useState('');
  
  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      setDisplayedText(text.slice(0, i + 1));
      i++;
      if (i >= text.length) {
        clearInterval(timer);
        onComplete?.();
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed, onComplete]);

  return <span>{displayedText}</span>;
};

export default function GiftSystem({ totalStars }: GiftSystemProps) {
  const [activeGiftSet, setActiveGiftSet] = useState<GiftSet | null>(null);
  const [showUnlock, setShowUnlock] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [revealPhase, setRevealPhase] = useState<RevealPhase>('idle');
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'giftSets'), 
      where('unlocked', '==', false),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const data = { id: snap.docs[0].id, ...snap.docs[0].data() } as GiftSet;
        setActiveGiftSet(data);
      } else {
        setActiveGiftSet(null);
      }
    }, (error) => {
      console.error('Gift sets snapshot error:', error);
      handleFirestoreError(error, OperationType.GET, 'giftSets');
    });

    return () => unsubscribe();
  }, []);

  const isUnlockable = totalStars >= 25 && activeGiftSet;

  const handleUnlock = () => {
    if (!isUnlockable) return;
    setShowUnlock(true);
    setRevealPhase('idle');
    setSelectedOption(null);
  };

  const handleSelect = async (optionIndex: number) => {
    if (!activeGiftSet || selectedOption !== null || isLocked) return;
    
    // LOCK SELECTION - disable all interactions
    setIsLocked(true);
    setSelectedOption(optionIndex);
    setRevealPhase('flipping');

    const option = optionIndex === 1 ? activeGiftSet.option1 : 
                   optionIndex === 2 ? activeGiftSet.option2 : 
                   activeGiftSet.option3;

    // PHASE TIMING SEQUENCE (strict order)
    // Phase 1: SLOW CARD FLIP (1.5s) - starts immediately
    
    // Phase 2: WIN ANNOUNCEMENT (occurs after flip at 1.5s, displays for 1s)
    setTimeout(() => {
      setRevealPhase('won');
      
      // CONFETTI BURST - Emotional celebration
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.5, x: 0.5 },
        colors: ['#ff4d6d', '#ffd166', '#ffffff', '#ff758f'],
        gravity: 0.8,
        scalar: 1.2
      });
    }, 1500);

    // Phase 3: GIFT CONTENT REVEAL (at 2.5s, typewriter begins)
    setTimeout(() => {
      setRevealPhase('revealing');
    }, 2500);

    // Phase 4: REVEAL REMAINING TWO CARDS (at 4s, automatically flip other cards)
    setTimeout(() => {
      setRevealPhase('revealOthers');
    }, 4000);

    // Phase 5: COMPLETE & UNLOCK INTERACTIONS (at 5.5s)
    setTimeout(() => {
      setRevealPhase('complete');
      setIsLocked(false);
    }, 5500);

    try {
      // Add to collection
      const path = 'collection';
      await addDoc(collection(db, path), {
        userId: auth.currentUser?.uid,
        title: option.title,
        message: option.message,
        image: option.image,
        date: new Date().toISOString()
      });

      // Mark gift set as unlocked
      await updateDoc(doc(db, 'giftSets', activeGiftSet.id), {
        unlocked: true
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'giftSets/collection');
      toast.error('Failed to save gift to scrapbook');
      setIsLocked(false);
    }
  };

  const handleClose = () => {
    setShowUnlock(false);
    setSelectedOption(null);
    setRevealPhase('idle');
    setIsLocked(false);
  };

  if (!activeGiftSet && totalStars < 25) return null;

  return (
    <div className="w-full">
      {/* MOBILE-FIRST GIFT BUTTON */}
      <motion.button
        whileHover={isUnlockable ? { scale: 1.02 } : {}}
        whileTap={isUnlockable ? { scale: 0.96 } : {}}
        onClick={handleUnlock}
        disabled={!isUnlockable}
        className={cn(
          "relative w-full overflow-hidden rounded-3xl transition-all duration-300",
          "active:scale-95 touch-none",
          isUnlockable 
            ? "py-6 px-5 bg-gradient-to-r from-primary via-secondary to-primary text-white shadow-lg shadow-primary/40"
            : "py-5 px-5 bg-slate-100 text-slate-400 opacity-60"
        )}
      >
        {/* Animated shimmer for unlocked */}
        {isUnlockable && (
          <motion.div
            animate={{ x: ['0%', '100%'] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          />
        )}

        <div className="relative z-10 flex flex-col items-center justify-center gap-2">
          <motion.div
            animate={isUnlockable ? { scale: [1, 1.15, 1], rotate: [0, 5, -5, 0] } : {}}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            {isUnlockable ? (
              <Gift className="w-8 h-8" />
            ) : (
              <Lock className="w-8 h-8" />
            )}
          </motion.div>
          
          <div className="text-center">
            <div className="font-black text-lg tracking-tight">
              {isUnlockable ? '🎁 GIFT READY!' : 'EARNING GIFT'}
            </div>
            <div className="text-xs font-bold opacity-80 mt-1">
              {isUnlockable 
                ? 'TAP TO OPEN' 
                : `${25 - Math.max(0, 25 - totalStars)} / 25 ⭐`
              }
            </div>
          </div>
        </div>

        {/* Pulsing border for unlocked */}
        {isUnlockable && (
          <motion.div
            animate={{ opacity: [0.2, 0.5, 0.2] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="absolute inset-0 rounded-3xl border-2 border-white pointer-events-none"
          />
        )}
      </motion.button>

      {/* Mobile Gift Modal */}
      <AnimatePresence>
        {showUnlock && activeGiftSet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/98 flex flex-col items-center justify-between p-4 pb-8 overflow-y-auto"
          >
            {/* Close Button */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleClose}
              disabled={isLocked}
              className="absolute top-6 right-6 z-20 w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white/70 disabled:opacity-30"
            >
              ✕
            </motion.button>

            {/* Main Content */}
            <div className="w-full flex flex-col items-center justify-center flex-1 pt-12">
              {/* HEADER - Only show during idle phase */}
              <AnimatePresence>
                {revealPhase === 'idle' && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="text-center mb-8 w-full"
                  >
                    <motion.h2 
                      className="text-3xl font-black text-white tracking-tighter mb-2"
                    >
                      CHOOSE YOUR GIFT
                    </motion.h2>
                    <p className="text-primary font-bold uppercase tracking-widest text-xs">Pick one of three</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* CARD GRID - Mobile optimized */}
              <div className="w-full flex flex-col gap-5 mb-4">
                {[1, 2, 3].map((i) => {
                  const isSelected = selectedOption === i;
                  const isOther = selectedOption !== null && !isSelected;
                  const opt = i === 1 ? activeGiftSet.option1 : i === 2 ? activeGiftSet.option2 : activeGiftSet.option3;
                  
                  const isFlipped = isSelected 
                    ? (revealPhase !== 'idle') 
                    : (revealPhase === 'revealOthers' || revealPhase === 'complete');

                  return (
                    <motion.div
                      key={i}
                      animate={{
                        scale: isSelected && revealPhase !== 'idle' ? 1.05 : isOther && revealPhase !== 'revealOthers' && revealPhase !== 'complete' ? 0.9 : 1,
                        opacity: isOther && revealPhase !== 'revealOthers' && revealPhase !== 'complete' ? 0.3 : 1,
                        y: isSelected && revealPhase !== 'idle' ? -10 : 0,
                        rotateY: isFlipped ? 180 : 0,
                        zIndex: isSelected ? 10 : 1
                      }}
                      transition={{ 
                        duration: isFlipped && isOther ? 1.0 : isFlipped && isSelected ? 1.4 : 0.4,
                        ease: isFlipped ? "easeInOut" : "easeOut"
                      }}
                      style={{ transformStyle: 'preserve-3d' }}
                      className="w-full h-40 cursor-pointer"
                      onClick={() => !isLocked && revealPhase === 'idle' && handleSelect(i)}
                    >
                      {/* Card Front - Mystery */}
                      <div 
                        className="absolute inset-0 w-full h-40 bg-gradient-to-br from-primary/80 to-secondary/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center gap-3 border-2 border-white/30 shadow-lg"
                        style={{ backfaceVisibility: 'hidden' }}
                      >
                        <motion.div
                          animate={{ opacity: [0.4, 0.8, 0.4] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent rounded-2xl"
                        />
                        
                        <motion.div
                          animate={{ scale: [1, 1.2, 1], y: [0, -5, 0] }}
                          transition={{ duration: 1.2, repeat: Infinity }}
                          className="relative z-10"
                        >
                          <Heart className="w-10 h-10 text-white/70" />
                        </motion.div>
                        
                        <motion.p
                          animate={{ opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 0.8, repeat: Infinity }}
                          className="text-white font-black text-2xl relative z-10"
                        >
                          ?
                        </motion.p>

                        {revealPhase === 'idle' && (
                          <motion.p
                            animate={{ opacity: [0.6, 1, 0.6] }}
                            transition={{ duration: 1, repeat: Infinity }}
                            className="text-white/80 text-xs font-bold uppercase tracking-wide absolute bottom-4"
                          >
                            ← SWIPE or TAP →
                          </motion.p>
                        )}
                      </div>

                      {/* Card Back - Revealed */}
                      <div 
                        className={cn(
                          "absolute inset-0 w-full h-40 rounded-2xl flex flex-col items-center justify-between p-4 border-2 shadow-lg",
                          isSelected 
                            ? "bg-white border-white shadow-[0_0_60px_rgba(255,77,109,0.4)]" 
                            : "bg-white/10 border-white/20 backdrop-blur-sm"
                        )}
                        style={{ 
                          backfaceVisibility: 'hidden',
                          transform: 'rotateY(180deg)'
                        }}
                      >
                        {/* Image */}
                        <motion.img 
                          src={opt.image} 
                          alt={opt.title}
                          className="w-full h-20 rounded-lg object-cover shadow-md"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ 
                            opacity: isSelected ? 1 : 0.7,
                            scale: 1
                          }}
                          transition={{ duration: 0.6, delay: isSelected ? 1.2 : 0 }}
                        />

                        {/* Title */}
                        <motion.h3
                          className={cn(
                            "font-black uppercase text-center leading-tight",
                            isSelected ? "text-slate-900 text-sm" : "text-white text-xs"
                          )}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: isSelected ? 1.2 : 3.5 }}
                        >
                          {opt.title}
                        </motion.h3>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* CONGRATULATIONS OVERLAY - Mobile optimized */}
              <AnimatePresence>
                {(revealPhase === 'won' || revealPhase === 'revealing') && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-30 p-6"
                  >
                    {/* Background glow */}
                    <motion.div
                      animate={{ 
                        scale: [1, 1.3, 1],
                        opacity: [0.2, 0.4, 0.2]
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 bg-gradient-to-t from-primary/40 via-primary/20 to-transparent blur-2xl -z-10"
                    />

                    <motion.div
                      initial={{ scale: 0.8, opacity: 0, y: 30 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.8, opacity: 0, y: -30 }}
                      transition={{ duration: 0.6, type: 'spring', stiffness: 120 }}
                      className="text-center space-y-3 max-w-xs"
                    >
                      <motion.h1
                        animate={{ 
                          scale: [1, 1.05, 1],
                          textShadow: [
                            '0 0 10px rgba(255,77,109,0)',
                            '0 0 40px rgba(255,77,109,0.8)',
                            '0 0 15px rgba(255,77,109,0.4)'
                          ]
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="text-4xl md:text-5xl font-black text-white drop-shadow-2xl leading-tight"
                      >
                        🎉 CONGRATS! 🎉
                      </motion.h1>

                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-base md:text-lg text-white/90 font-bold uppercase tracking-wider"
                      >
                        You Won<br/>
                        <span className="text-primary text-lg md:text-xl font-black">
                          {selectedOption === 1 ? activeGiftSet.option1.title : selectedOption === 2 ? activeGiftSet.option2.title : activeGiftSet.option3.title}
                        </span>
                      </motion.div>

                      <motion.div
                        animate={{ scale: [0.8, 1, 0.8] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                        className="text-4xl"
                      >
                        💖
                      </motion.div>

                      {revealPhase === 'revealing' && (
                        <motion.p
                          animate={{ opacity: [0.6, 1, 0.6] }}
                          transition={{ duration: 1, repeat: Infinity }}
                          className="text-primary font-bold uppercase text-xs tracking-widest pt-2"
                        >
                          Gift Loading...
                        </motion.p>
                      )}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Action Button at Bottom */}
            <AnimatePresence>
              {revealPhase === 'complete' && (
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleClose}
                  className="w-full max-w-xs bg-gradient-to-r from-primary to-secondary text-white py-4 rounded-2xl font-black text-sm tracking-widest uppercase shadow-lg shadow-primary/40 active:scale-95"
                >
                  ✨ Continue ✨
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
