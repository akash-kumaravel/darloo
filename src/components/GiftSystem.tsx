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
  const [revealingGiftSet, setRevealingGiftSet] = useState<GiftSet | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [revealPhase, setRevealPhase] = useState<'idle' | 'flipping' | 'revealOthers' | 'complete'>('idle');
  const [revealedCards, setRevealedCards] = useState<number[]>([]);

  useEffect(() => {
    if (activeGiftSet && revealPhase === 'idle') {
      handleUnlock();
    }
  }, [activeGiftSet]);

  const handleUnlock = () => {
    setRevealingGiftSet(activeGiftSet);
    setSelectedOption(null);
    setRevealPhase('idle');
    setRevealedCards([]);
  };

  const handleSelect = async (optionIndex: number) => {
    if (!revealingGiftSet || selectedOption !== null) return;
    
    setSelectedOption(optionIndex);
    setRevealPhase('flipping');
    setRevealedCards([optionIndex]);

    // Find the primary option
    const primaryOption = revealingGiftSet.option1.isPrimary ? revealingGiftSet.option1 : 
                         revealingGiftSet.option2.isPrimary ? revealingGiftSet.option2 : 
                         revealingGiftSet.option3;

    // Timing Sequence
    // 1. Selected card flips for 1.5s
    // 2. After flip, reveal other cards one by one with 0.5s delay
    // 3. Then show complete state
    
    setTimeout(() => {
      setRevealPhase('revealOthers');
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ff4d6d', '#ffd166', '#ffffff']
      });
    }, 1500);

    // Reveal remaining cards sequentially
    setTimeout(() => {
      setRevealedCards([optionIndex, ...[1, 2, 3].filter(i => i !== optionIndex).slice(0, 1)]);
    }, 2000);

    setTimeout(() => {
      setRevealedCards([1, 2, 3]);
      setRevealPhase('complete');
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ff4d6d', '#ffd166', '#ffffff']
      });
    }, 2500);

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
    const duration = 1.5 * 1000;
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

    // Reset state and close
    setRevealingGiftSet(null);
    setSelectedOption(null);
    setRevealPhase('idle');
    setRevealedCards([]);
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
      className="fixed inset-0 z-[60] bg-slate-50/95 backdrop-blur-3xl flex flex-col items-center justify-center p-6 overflow-hidden"
    >
      <div className="w-full max-w-5xl flex flex-col items-center relative z-10">
              <AnimatePresence mode="wait">
                {revealPhase === 'idle' && (
                    <div
                      className="text-center mb-16"
                    >
                      <h2 className="text-6xl font-black text-slate-900 tracking-tighter mb-4 drop-shadow-sm">PICK YOUR DESTINY</h2>
                      <p className="text-primary font-black uppercase tracking-[0.6em] text-xs animate-pulse">Choose one mystery card</p>
                    </div>
                )}
              </AnimatePresence>

              {/* Card Grid */}
              <div className="grid grid-cols-3 gap-12 w-full perspective-2000">
                {[1, 2, 3].map((i) => {
                  const isSelected = selectedOption === i;
                  const isOther = selectedOption !== null && !isSelected;
                  const displayOpt = getCardContent(i);
                  const isFlipped = revealedCards.includes(i);

                  if (!displayOpt) return null;

                  return (
                    <motion.div
                      key={i}
                      animate={{
                        scale: isSelected ? 1.2 : isOther ? 0.85 : 1,
                        y: isSelected ? -40 : 0,
                        rotateY: isFlipped ? 180 : 0,
                        z: isSelected ? 200 : 0,
                        opacity: revealPhase === 'idle' || isFlipped ? 1 : 0.7
                      }}
                      transition={{ 
                        type: "spring",
                        damping: 25,
                        stiffness: 120,
                        rotateY: { 
                          duration: 0.8, 
                          ease: "easeInOut"
                        },
                        scale: {
                          type: "spring",
                          damping: 20,
                          stiffness: 100
                        }
                      }}
                      style={{ transformStyle: 'preserve-3d' }}
                      className={cn(
                        "relative aspect-[2/3] w-full",
                        revealPhase === 'idle' ? "cursor-pointer hover:scale-110 active:scale-95 transition-all" : "cursor-default"
                      )}
                      onClick={() => handleSelect(i)}
                    >
                      {/* Card Front (Mystery) */}
                      <div 
                        className="absolute inset-0 bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-[2.5rem] flex flex-col items-center justify-center gap-8 border-4 border-white shadow-[0_20px_50px_rgba(0,0,0,0.1)]"
                        style={{ 
                          backfaceVisibility: 'hidden', 
                          WebkitBackfaceVisibility: 'hidden',
                          transform: 'translateZ(1px)'
                        }}
                      >
                        <motion.div 
                          animate={{ y: [0, -10, 0] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center border border-primary/10"
                        >
                          <Heart className="w-10 h-10 text-primary animate-pulse" />
                        </motion.div>
                        <div className="text-slate-200 font-black text-7xl opacity-30 tracking-tighter uppercase">Love</div>
                      </div>

                      {/* Card Back (Revealed) */}
                      <div 
                        className={cn(
                          "absolute inset-0 rounded-[2.5rem] flex flex-col items-center p-8 border-4 overflow-hidden shadow-2xl",
                          isSelected ? "bg-white border-primary" : "bg-white/80 border-slate-200"
                        )}
                        style={{ 
                          backfaceVisibility: 'hidden',
                          WebkitBackfaceVisibility: 'hidden',
                          transform: 'rotateY(180deg) translateZ(1px)'
                        }}
                      >
                        {isFlipped && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.4, delay: 0.2 }}
                            className="w-full h-full flex flex-col items-center p-8"
                          >
                            <div className="w-full aspect-square rounded-3xl overflow-hidden mb-6 shadow-2xl border-2 border-slate-100">
                              <img 
                                src={displayOpt.image} 
                                alt={displayOpt.title} 
                                className="w-full h-full object-cover" 
                              />
                            </div>
                            
                            <div className="text-center w-full flex-1 flex flex-col justify-end">
                              <h3 className={cn(
                                "font-black tracking-tight uppercase leading-none mb-3",
                                isSelected ? "text-slate-900 text-xl" : "text-slate-700 text-sm"
                              )}>
                                {displayOpt.title}
                              </h3>
                              
                              {isSelected ? (
                                <motion.div 
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ duration: 0.4, delay: 0.4 }}
                                  className="text-primary font-black text-sm italic leading-relaxed mt-6 px-4 bg-primary/5 py-4 rounded-2xl"
                                >
                                  <Typewriter text={displayOpt.message} speed={30} />
                                </motion.div>
                              ) : (
                                <p className="text-slate-400 font-medium text-[10px] italic leading-tight mt-4 line-clamp-3">
                                  "{displayOpt.message}"
                                </p>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </div>

                      {/* Cinematic Glow during flip */}
                      {isSelected && revealPhase === 'flipping' && (
                        <motion.div
                          animate={{ 
                            opacity: [0, 0.6, 0],
                            scale: [1, 1.2, 1]
                          }}
                          transition={{ duration: 0.8, repeat: Infinity }}
                          className="absolute inset-0 bg-primary/30 blur-[60px] rounded-[2.5rem] -z-10"
                        />
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* Cinematic Overlays */}
              {revealPhase === 'complete' && (
                <motion.div 
                  initial={{ opacity: 0, y: -30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="absolute top-12 left-0 right-0 flex flex-col items-center justify-center pointer-events-none z-50"
                >
                  <div className="text-center space-y-4 bg-white/90 backdrop-blur-xl p-8 rounded-[3rem] border border-white shadow-2xl">
                    <motion.h2 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                      className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter leading-tight"
                    >
                      HEY MY DEAR
                      <br />
                      <span className="text-primary text-xl md:text-3xl">YOU YOU WOW! 💖</span>
                    </motion.h2>
                    <motion.div 
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.5, delay: 0.4 }}
                      className="h-1 w-16 bg-primary mx-auto rounded-full origin-left" 
                    />
                    <motion.p 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.6 }}
                      className="text-sm md:text-base font-black text-slate-600 uppercase tracking-[0.2em]"
                    >
                      YOU UNLOCKED: {
                        (revealingGiftSet?.option1.isPrimary ? revealingGiftSet.option1.title : 
                         revealingGiftSet?.option2.isPrimary ? revealingGiftSet.option2.title : 
                         revealingGiftSet?.option3.title)?.toUpperCase()
                      }
                    </motion.p>
                  </div>
                </motion.div>
              )}

              {/* Final Action Button */}
              {revealPhase === 'complete' && (
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="mt-24 w-full max-w-md flex justify-center pointer-events-auto"
                >
                  <button
                    onClick={handleClose}
                    className="w-full bg-gradient-to-r from-slate-900 to-slate-800 text-white py-4 px-8 rounded-[2rem] font-black text-lg tracking-[0.3em] uppercase shadow-[0_30px_60px_rgba(15,23,42,0.4)] hover:shadow-[0_40px_80px_rgba(15,23,42,0.5)] hover:scale-105 active:scale-95 transition-all duration-300 relative overflow-hidden group"
                  >
                    <motion.div 
                      className="absolute inset-0 bg-primary/20 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-700" 
                    />
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      Continue Home
                      <motion.span
                        animate={{ x: [0, 5, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        →
                      </motion.span>
                    </span>
                  </button>
                </motion.div>
              )}
      </div>
    </div>
  );
}
