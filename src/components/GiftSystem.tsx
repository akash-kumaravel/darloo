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
  const [revealPhase, setRevealPhase] = useState<'idle' | 'flipping' | 'won' | 'revealing' | 'revealOthers' | 'complete'>('idle');

  useEffect(() => {
    if (activeGiftSet && revealPhase === 'idle') {
      handleUnlock();
    }
  }, [activeGiftSet]);

  const handleUnlock = () => {
    setRevealingGiftSet(activeGiftSet);
    setSelectedOption(null);
    setRevealPhase('idle');
  };

  const handleSelect = async (optionIndex: number) => {
    if (!revealingGiftSet || selectedOption !== null) return;
    
    setSelectedOption(optionIndex);
    setRevealPhase('flipping');

    // Find the primary option
    const primaryOption = revealingGiftSet.option1.isPrimary ? revealingGiftSet.option1 : 
                         revealingGiftSet.option2.isPrimary ? revealingGiftSet.option2 : 
                         revealingGiftSet.option3;

    // Timing Sequence (Cinematic)
    // 1. Flipping starts immediately (1.5s duration)
    
    // 2. Show "Won" announcement after flip completes
    setTimeout(() => {
      setRevealPhase('won');
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ff4d6d', '#ffd166', '#ffffff']
      });
    }, 1500); // Wait for full 1.5s flip

    // 3. Reveal gift content (image + typewriter message)
    setTimeout(() => {
      setRevealPhase('revealing');
    }, 2500);

    // 4. Reveal other two cards (dimmed)
    setTimeout(() => {
      setRevealPhase('revealOthers');
    }, 4500);

    // 5. Final state (show close button)
    setTimeout(() => {
      setRevealPhase('complete');
    }, 6000);

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
    const duration = 3 * 1000;
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

    // Close after a short delay to allow the blast to start
    setTimeout(onClose, 500);
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
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(20px)' }}
      className="fixed inset-0 z-[60] bg-slate-50/95 backdrop-blur-3xl flex flex-col items-center justify-center p-6 overflow-hidden"
    >
      <div className="w-full max-w-5xl flex flex-col items-center relative z-10">
              <AnimatePresence mode="wait">
                {revealPhase === 'idle' && (
                  <motion.div
                    key="header-idle"
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    className="text-center mb-16"
                  >
                    <h2 className="text-6xl font-black text-slate-900 tracking-tighter mb-4 drop-shadow-sm">PICK YOUR DESTINY</h2>
                    <p className="text-primary font-black uppercase tracking-[0.6em] text-xs animate-pulse">Choose one mystery card</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Card Grid */}
              <div className="grid grid-cols-3 gap-12 w-full perspective-2000">
                {[1, 2, 3].map((i) => {
                  const isSelected = selectedOption === i;
                  const isOther = selectedOption !== null && !isSelected;
                  const displayOpt = getCardContent(i);
                  const isFlipped = isSelected ? (revealPhase !== 'idle') : (revealPhase === 'revealOthers' || revealPhase === 'complete');

                  if (!displayOpt) return null;

                  return (
                    <motion.div
                      key={i}
                      animate={{
                        scale: isSelected ? 1.2 : isOther ? 0.8 : 1,
                        opacity: isOther && revealPhase !== 'revealOthers' && revealPhase !== 'complete' ? 0.3 : 1,
                        y: isSelected ? -60 : 0,
                        rotateY: isFlipped ? 180 : 0,
                        z: isSelected ? 200 : 0
                      }}
                      transition={{ 
                        type: "spring",
                        damping: 20,
                        stiffness: 100,
                        rotateY: { duration: 1.5, ease: "easeInOut" }
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
                        className="absolute inset-0 bg-gradient-to-br from-white to-slate-100 rounded-[2.5rem] flex flex-col items-center justify-center gap-8 border-4 border-white shadow-[0_20px_50px_rgba(0,0,0,0.1)]"
                        style={{ 
                          backfaceVisibility: 'hidden', 
                          WebkitBackfaceVisibility: 'hidden',
                          transform: 'translateZ(2px)'
                        }}
                      >
                        <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center border border-primary/10">
                          <Heart className="w-10 h-10 text-primary animate-pulse" />
                        </div>
                        <div className="text-slate-200 font-black text-7xl opacity-30 tracking-tighter uppercase">Love</div>
                      </div>

                      {/* Card Back (Revealed) */}
                      <div 
                        className={cn(
                          "absolute inset-0 rounded-[2.5rem] flex flex-col items-center p-8 border-4 overflow-hidden shadow-2xl",
                          isSelected ? "bg-white border-primary" : "bg-white/80 border-slate-200 backdrop-blur-xl"
                        )}
                        style={{ 
                          backfaceVisibility: 'hidden',
                          WebkitBackfaceVisibility: 'hidden',
                          transform: 'rotateY(180deg) translateZ(2px)'
                        }}
                      >
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={isFlipped ? { opacity: 1, scale: 1 } : {}}
                          transition={{ delay: 1.5, duration: 0.8 }}
                          className="w-full aspect-square rounded-3xl overflow-hidden mb-6 shadow-2xl border-2 border-slate-100"
                        >
                          <img 
                            src={displayOpt.image} 
                            alt={displayOpt.title} 
                            className="w-full h-full object-cover" 
                          />
                        </motion.div>
                        
                        <div className="text-center w-full">
                          <h3 className={cn(
                            "font-black tracking-tight uppercase leading-none mb-3",
                            isSelected ? "text-slate-900 text-xl" : "text-slate-700 text-sm"
                          )}>
                            {displayOpt.title}
                          </h3>
                          
                          {isSelected && (revealPhase === 'revealing' || revealPhase === 'revealOthers' || revealPhase === 'complete') && (
                            <div className="text-primary font-black text-sm italic leading-relaxed mt-6 px-4 bg-primary/5 py-4 rounded-2xl">
                              <Typewriter text={`"${displayOpt.message}"`} />
                            </div>
                          )}
                          
                          {!isSelected && (revealPhase === 'revealOthers' || revealPhase === 'complete') && (
                            <p className="text-slate-400 font-medium text-[10px] italic leading-tight mt-4 line-clamp-3">
                              "{displayOpt.message}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Cinematic Glow during flip */}
                      {isSelected && revealPhase === 'flipping' && (
                        <motion.div
                          animate={{ 
                            opacity: [0, 1, 0],
                            scale: [1, 1.3, 1]
                          }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="absolute inset-0 bg-primary/20 blur-[80px] rounded-[2.5rem] -z-10"
                        />
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* Cinematic Overlays */}
              <AnimatePresence>
                {revealPhase === 'won' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5, y: -100 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 1.5, filter: "blur(40px)" }}
                    transition={{ type: "spring", damping: 15, stiffness: 100 }}
                    className="absolute top-12 left-0 right-0 flex flex-col items-center justify-center pointer-events-none z-50"
                  >
                    <div className="text-center space-y-4 bg-white/80 backdrop-blur-xl p-8 rounded-[3rem] border border-white shadow-2xl scale-75 md:scale-100">
                      <motion.h2 
                        animate={{ 
                          scale: [1, 1.05, 1],
                          textShadow: ["0 0 0px rgba(255,77,109,0)", "0 0 50px rgba(255,77,109,0.3)", "0 0 0px rgba(255,77,109,0)"]
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter leading-tight"
                      >
                        HEY MY DEAR WIFE<br />
                        <span className="text-primary">YOU YOU WOW! 💖</span>
                      </motion.h2>
                      <div className="h-1 w-16 bg-primary mx-auto rounded-full" />
                      <p className="text-lg md:text-xl font-black text-slate-600 uppercase tracking-[0.3em]">
                        YOU UNLOCKED: {
                          (revealingGiftSet.option1.isPrimary ? revealingGiftSet.option1.title : 
                           revealingGiftSet.option2.isPrimary ? revealingGiftSet.option2.title : 
                           revealingGiftSet.option3.title).toUpperCase()
                        }
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Final Action Button */}
              <AnimatePresence>
                {revealPhase === 'complete' && (
                  <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-24 w-full max-w-md"
                  >
                    <button
                      onClick={handleClose}
                      className="w-full bg-slate-900 text-white py-8 rounded-[2.5rem] font-black text-xl tracking-[0.5em] uppercase shadow-[0_30px_60px_rgba(15,23,42,0.3)] hover:scale-105 active:scale-95 transition-all relative overflow-hidden group"
                    >
                      <div className="absolute inset-0 bg-primary/10 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500" />
                      <span className="relative z-10">Continue Journey</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
      </div>
    </motion.div>
  );
}
