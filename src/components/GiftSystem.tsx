import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart } from 'lucide-react';
import { 
  collection, 
  doc, 
  updateDoc, 
  addDoc,
  increment
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { GiftSet } from '../types';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';

const Typewriter = ({ text, speed = 40 }: { text: string; speed?: number }) => {
  const [displayedText, setDisplayedText] = useState('');
  
  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      setDisplayedText(text.slice(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return <span>{displayedText}</span>;
};

interface GiftSystemProps {
  activeGiftSet: GiftSet;
  totalStars: number;
  lastGiftStarCount: number;
  onClose: () => void;
}

export default function GiftSystem({ activeGiftSet, totalStars, lastGiftStarCount, onClose }: GiftSystemProps) {
  const [revealingGiftSet, setRevealingGiftSet] = useState<GiftSet | null>(activeGiftSet);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [revealPhase, setRevealPhase] = useState<'idle' | 'flipping' | 'won' | 'revealing' | 'revealOthers' | 'complete'>('idle');

  useEffect(() => {
    if (activeGiftSet && !revealingGiftSet) {
      setRevealingGiftSet(activeGiftSet);
    }
  }, [activeGiftSet, revealingGiftSet]);

  const handleSelect = async (optionIndex: number) => {
    if (!revealingGiftSet || selectedOption !== null) return;
    
    setSelectedOption(optionIndex);
    setRevealPhase('flipping');

    // Find the primary option
    const primaryOption = revealingGiftSet.option1.isPrimary ? revealingGiftSet.option1 : 
                         revealingGiftSet.option2.isPrimary ? revealingGiftSet.option2 : 
                         revealingGiftSet.option3;

    // Timing Sequence (Sequential Reveal)
    // 1. Flipping starts immediately (1.5s duration)
    
    // 2. Reveal others after primary flip completes
    setTimeout(() => {
      setRevealPhase('revealOthers');
      // Subtle burst for other reveals
      confetti({
        particleCount: 40,
        spread: 50,
        origin: { y: 0.7 },
        colors: ['#cbd5e1', '#94a3b8']
      });
    }, 1500);

    // 3. Final completion after all cards are revealed
    setTimeout(() => {
      setRevealPhase('complete');
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ff4d6d', '#ffd166', '#ffffff']
      });
    }, 3000);

    try {
      // Add to collection
      await addDoc(collection(db, 'collection'), {
        userId: auth.currentUser?.uid,
        title: primaryOption.title,
        message: primaryOption.message,
        image: primaryOption.image,
        date: new Date().toISOString()
      });

      // Mark gift set as unlocked and increment gifts received
      await updateDoc(doc(db, 'giftSets', revealingGiftSet.id), {
        unlocked: true
      });

      await updateDoc(doc(db, 'stats', 'global'), {
        giftsReceived: increment(1),
        lastGiftStarCount: totalStars
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'giftSets/collection');
      toast.error('Failed to save gift to scrapbook');
    }
  };

  const handleClose = () => {
    // Trigger a massive celebratory blast on close
    const duration = 2 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);

    // Close immediately when user clicks
    onClose();
  };

  if (!activeGiftSet && !revealingGiftSet && totalStars < lastGiftStarCount + 25) return null;

  // Helper to get card content based on selection
  const getCardContent = (cardIndex: number) => {
    if (!revealingGiftSet) return null;
    
    const primaryOption = revealingGiftSet.option1.isPrimary ? revealingGiftSet.option1 : 
                         revealingGiftSet.option2.isPrimary ? revealingGiftSet.option2 : 
                         revealingGiftSet.option3;
    
    const secondaryOptions = [revealingGiftSet.option1, revealingGiftSet.option2, revealingGiftSet.option3].filter(o => !o.isPrimary);

    if (selectedOption === cardIndex) {
      return primaryOption;
    } else {
      // Map the other two cards to the secondary options
      const otherCardIndices = [1, 2, 3].filter(idx => idx !== selectedOption);
      const secondaryIndex = otherCardIndices.indexOf(cardIndex);
      return secondaryOptions[secondaryIndex] || secondaryOptions[0];
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[60] bg-slate-50/95 backdrop-blur-3xl flex flex-col items-center justify-center p-4 md:p-6 overflow-hidden"
    >
      <div className="w-full max-w-5xl flex flex-col items-center relative z-10 px-2 md:px-0">
              <AnimatePresence mode="wait">
                {revealPhase === 'idle' && (
                    <div
                      className="text-center mb-8 md:mb-16"
                    >
                      <h2 className="text-3xl md:text-6xl font-black text-slate-900 tracking-tighter mb-2 md:mb-4 drop-shadow-sm uppercase">PICK YOUR DESTINY</h2>
                      <p className="text-primary font-black uppercase tracking-[0.4em] md:tracking-[0.6em] text-[10px] md:text-xs animate-pulse">Choose one mystery card</p>
                    </div>
                )}
              </AnimatePresence>

              {/* Card Grid - Forced Horizontal on all screens */}
              <div className="grid grid-cols-3 gap-3 md:gap-12 w-full perspective-2000">
                {[1, 2, 3].map((i) => {
                  const isSelected = selectedOption === i;
                  const isOther = selectedOption !== null && !isSelected;
                  const displayOpt = getCardContent(i);
                  const isFlipped = isSelected ? (revealPhase !== 'idle') : (revealPhase === 'revealOthers' || revealPhase === 'complete');
                  const isVisible = isFlipped || revealPhase === 'idle' || revealPhase === 'flipping';

                  if (!displayOpt || !isVisible) return null;

                  return (
                    <motion.div
                      key={i}
                      animate={{
                        scale: isSelected ? 1.15 : isOther ? 0.85 : 1,
                        y: isSelected ? -30 : 0,
                        rotateY: isFlipped ? 180 : 0,
                        z: isSelected ? 100 : 0
                      }}
                      transition={{ 
                        type: "spring",
                        damping: 25,
                        stiffness: 120,
                        rotateY: { duration: 1.2, ease: "easeInOut" }
                      }}
                      style={{ transformStyle: 'preserve-3d' }}
                      className={cn(
                        "relative aspect-[2/3] w-full",
                        revealPhase === 'idle' ? "cursor-pointer hover:scale-105 active:scale-95 transition-all" : "cursor-default"
                      )}
                      onClick={() => handleSelect(i)}
                    >
                      {/* Card Front (Mystery) */}
                      <div 
                        className="absolute inset-0 bg-gradient-to-br from-white to-slate-100 rounded-2xl md:rounded-[2.5rem] flex flex-col items-center justify-center gap-4 md:gap-8 border-2 md:border-4 border-white shadow-[0_10px_30px_rgba(0,0,0,0.1)]"
                        style={{ 
                          backfaceVisibility: 'hidden', 
                          WebkitBackfaceVisibility: 'hidden',
                          transform: 'translateZ(1px)'
                        }}
                      >
                        <div className="w-10 h-10 md:w-20 md:h-20 bg-primary/5 rounded-full flex items-center justify-center border border-primary/10">
                          <Heart className="w-5 h-5 md:w-10 md:h-10 text-primary animate-pulse" />
                        </div>
                        <div className="text-slate-200 font-black text-2xl md:text-7xl opacity-30 tracking-tighter uppercase">Love</div>
                      </div>

                      {/* Card Back (Revealed) */}
                      <div 
                        className={cn(
                          "absolute inset-0 rounded-2xl md:rounded-[2.5rem] flex flex-col items-center p-3 md:p-8 border-2 md:border-4 overflow-hidden shadow-2xl",
                          isSelected ? "bg-white border-primary" : "bg-white/80 border-slate-200 backdrop-blur-xl"
                        )}
                        style={{ 
                          backfaceVisibility: 'hidden',
                          WebkitBackfaceVisibility: 'hidden',
                          transform: 'rotateY(180deg) translateZ(1px)',
                          visibility: isFlipped ? 'visible' : 'hidden',
                          opacity: isFlipped ? 1 : 0
                        }}
                      >
                        {isFlipped && (
                          <div className="w-full h-full flex flex-col items-center">
                            <div className="w-full aspect-square rounded-xl md:rounded-3xl overflow-hidden mb-2 md:mb-6 shadow-lg md:shadow-2xl border border-slate-100">
                              <img 
                                src={displayOpt.image} 
                                alt={displayOpt.title} 
                                className="w-full h-full object-cover" 
                              />
                            </div>
                            
                            <div className="text-center w-full">
                              <h3 className={cn(
                                "font-black tracking-tight uppercase leading-none mb-1 md:mb-3",
                                isSelected ? "text-slate-900 text-xs md:text-xl" : "text-slate-700 text-[8px] md:text-sm"
                              )}>
                                {displayOpt.title}
                              </h3>
                              
                              {isSelected ? (
                                <div className="text-primary font-black text-[10px] md:text-sm italic leading-relaxed mt-2 md:mt-6 px-2 md:px-4 bg-primary/5 py-2 md:py-4 rounded-xl md:rounded-2xl line-clamp-4 md:line-clamp-none">
                                  "{displayOpt.message}"
                                </div>
                              ) : (
                                <p className="text-slate-400 font-medium text-[6px] md:text-[10px] italic leading-tight mt-1 md:mt-4 line-clamp-2 md:line-clamp-3">
                                  "{displayOpt.message}"
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Cinematic Glow during flip */}
                      {isSelected && revealPhase === 'flipping' && (
                        <motion.div
                          animate={{ 
                            opacity: [0, 1, 0],
                            scale: [1, 1.3, 1]
                          }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="absolute inset-0 bg-primary/20 blur-[40px] md:blur-[80px] rounded-2xl md:rounded-[2.5rem] -z-10"
                        />
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* Cinematic Overlays */}
              <AnimatePresence>
                {revealPhase === 'complete' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-4 md:top-12 left-0 right-0 flex flex-col items-center justify-center pointer-events-none z-50 px-4"
                  >
                    <div className="text-center space-y-2 md:space-y-4 bg-white/90 backdrop-blur-xl p-6 md:p-10 rounded-[2.5rem] md:rounded-[4rem] border border-white shadow-2xl w-full max-w-sm md:max-w-none">
                      <div className="inline-block px-3 py-0.5 md:px-4 md:py-1 bg-primary/10 rounded-full text-primary text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] mb-1 md:mb-2">
                        Mystery Unlocked
                      </div>
                      <h2 className="text-2xl md:text-6xl font-black text-slate-900 tracking-tighter leading-tight uppercase">
                        CONGRATULATIONS<br />
                        <span className="text-primary">MY DEAR WIFE! 💖</span>
                      </h2>
                      <div className="h-1 w-16 md:h-1.5 md:w-24 bg-primary mx-auto rounded-full" />
                      <div className="space-y-0.5 md:space-y-1">
                        <p className="text-[8px] md:text-xs font-black text-slate-400 uppercase tracking-[0.3em] md:tracking-[0.5em]">You have received</p>
                        <p className="text-sm md:text-2xl font-black text-slate-800 uppercase tracking-[0.1em] md:tracking-[0.2em]">
                          {
                            (revealingGiftSet.option1.isPrimary ? revealingGiftSet.option1.title : 
                             revealingGiftSet.option2.isPrimary ? revealingGiftSet.option2.title : 
                             revealingGiftSet.option3.title)
                          }
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Final Action Button */}
              <AnimatePresence>
                {revealPhase === 'complete' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-12 md:mt-24 w-full max-w-xs md:max-w-md"
                  >
                    <button
                      onClick={handleClose}
                      className="w-full bg-slate-900 text-white py-5 md:py-8 rounded-2xl md:rounded-[2.5rem] font-black text-sm md:text-xl tracking-[0.3em] md:tracking-[0.5em] uppercase shadow-[0_20px_40px_rgba(15,23,42,0.3)] hover:scale-105 active:scale-95 transition-all relative overflow-hidden group"
                    >
                      <div className="absolute inset-0 bg-primary/10 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500" />
                      <span className="relative z-10">Continue Journey</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
      </div>
    </div>
  );
}
