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
      where('primary', '==', true),
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
    <div className="space-y-3">
      <motion.div
        whileHover={isUnlockable ? { scale: 1.01 } : {}}
        whileTap={isUnlockable ? { scale: 0.99 } : {}}
        onClick={handleUnlock}
        className={cn(
          "relative glass rounded-2xl p-4 flex items-center gap-4 overflow-hidden transition-all duration-500",
          isUnlockable ? "cursor-pointer border-primary/40 bg-white shadow-lg shadow-primary/5" : "opacity-80"
        )}
      >
        {isUnlockable && (
          <motion.div
            animate={{ opacity: [0.1, 0.3, 0.1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent -skew-x-12 translate-x-[-100%] animate-[shimmer_2s_infinite]"
          />
        )}

        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center shadow-md shrink-0",
          isUnlockable ? "bg-primary text-white animate-pulse" : "bg-slate-100 text-slate-400"
        )}>
          {isUnlockable ? <Gift className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-black text-slate-800 text-sm tracking-tight truncate">
            {isUnlockable ? 'SURPRISE UNLOCKED!' : 'MYSTERY GIFT'}
          </div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
            {isUnlockable ? 'Tap to open your gift' : `${25 - (totalStars % 25)} stars to next gift`}
          </div>
        </div>

        {isUnlockable && <ChevronRight className="w-5 h-5 text-primary shrink-0" />}
      </motion.div>

      {/* Unlock Cinematic Modal */}
      <AnimatePresence>
        {showUnlock && activeGiftSet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-6 overflow-hidden"
          >
            {/* BACKGROUND DIMMING */}
            <motion.div 
              animate={{ 
                opacity: selectedOption !== null ? 0.85 : 0,
                backdropFilter: selectedOption !== null ? 'blur(8px)' : 'blur(0px)'
              }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
              className="absolute inset-0 bg-black pointer-events-none z-0"
            />

            <div className="w-full max-w-2xl flex flex-col items-center relative z-10">
              {/* HEADING */}
              {revealPhase === 'idle' && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  className="text-center mb-12"
                >
                  <h2 className="text-4xl font-black text-white tracking-tighter mb-2">PICK YOUR DESTINY</h2>
                  <p className="text-primary font-bold uppercase tracking-[0.3em] text-xs">Choose one mystery card</p>
                </motion.div>
              )}

              {/* CARD GRID */}
              <div className="grid grid-cols-3 gap-6 w-full" style={{ perspective: '1200px' }}>
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
                        scale: isSelected && revealPhase !== 'idle' ? 1.12 : isOther && revealPhase !== 'revealOthers' && revealPhase !== 'complete' ? 0.85 : 1,
                        opacity: isOther && revealPhase !== 'revealOthers' && revealPhase !== 'complete' ? 0.25 : 1,
                        y: isSelected && revealPhase !== 'idle' ? -30 : 0,
                        rotateY: isFlipped ? 180 : 0,
                        zIndex: isSelected ? 10 : 1
                      }}
                      transition={{ 
                        duration: isFlipped && isOther ? 1.2 : isFlipped && isSelected ? 1.8 : 0.6,
                        ease: isFlipped ? "easeInOut" : "easeOut",
                        rotateY: { duration: isFlipped && isSelected ? 1.8 : 1.2 }
                      }}
                      style={{ transformStyle: 'preserve-3d' }}
                      className={cn(
                        "relative aspect-[2/3] cursor-pointer transition-all",
                        !isLocked && revealPhase === 'idle' ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed'
                      )}
                      onClick={() => !isLocked && revealPhase === 'idle' && handleSelect(i)}
                    >
                      {/* CARD FRONT */}
                      <div 
                        className="absolute inset-0 glass rounded-3xl flex flex-col items-center justify-center gap-4 border-2 border-white/20 backface-hidden shadow-2xl"
                        style={{ backfaceVisibility: 'hidden' }}
                      >
                        <motion.div
                          animate={{ opacity: [0.3, 0.6, 0.3] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent rounded-3xl"
                        />
                        
                        <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center relative z-10 border border-white/20">
                          <Heart className="w-7 h-7 text-white/60" />
                        </div>
                        <div className="text-white font-black text-5xl opacity-20 relative z-10">?</div>
                      </div>

                      {/* CARD BACK */}
                      <div 
                        className={cn(
                          "absolute inset-0 rounded-3xl flex flex-col items-center justify-start p-5 border-2 overflow-hidden shadow-2xl",
                          isSelected 
                            ? "bg-white border-white shadow-[0_0_60px_rgba(255,77,109,0.4)]" 
                            : "bg-white/15 border-white/30 backdrop-blur-sm"
                        )}
                        style={{ 
                          backfaceVisibility: 'hidden',
                          transform: 'rotateY(180deg)'
                        }}
                      >
                        <motion.img 
                          src={opt.image} 
                          alt={opt.title} 
                          className="w-full aspect-square rounded-2xl object-cover shadow-lg"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ 
                            opacity: isSelected ? 1 : 0.7, 
                            scale: 1 
                          }}
                          transition={{ delay: isSelected ? 2.0 : revealPhase === 'revealOthers' ? 4.2 : 0, duration: 1 }}
                        />

                        <div className="text-center flex-1 flex flex-col justify-between w-full mt-4">
                          <motion.h3
                            className={cn(
                              "font-black tracking-tight uppercase leading-none mb-2",
                              isSelected ? "text-slate-900 text-base" : "text-white text-xs"
                            )}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: isSelected ? 2.0 : revealPhase === 'revealOthers' ? 4.2 : 0 }}
                          >
                            {opt.title}
                          </motion.h3>

                          <AnimatePresence>
                            {(
                              (isSelected && (revealPhase === 'revealing' || revealPhase === 'revealOthers' || revealPhase === 'complete')) ||
                              (!isSelected && (revealPhase === 'revealOthers' || revealPhase === 'complete'))
                            ) && (
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.6 }}
                                className={cn(
                                  "text-[11px] font-medium leading-tight italic",
                                  isSelected ? "text-primary" : "text-white/70"
                                )}
                              >
                                {isSelected ? (
                                  <Typewriter text={opt.message} speed={40} />
                                ) : (
                                  opt.message
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      {isSelected && revealPhase === 'flipping' && (
                        <motion.div
                          animate={{ 
                            opacity: [0.2, 0.5, 0.2],
                            scale: [1, 1.05, 1]
                          }}
                          transition={{ duration: 1.8, repeat: 1 }}
                          className="absolute inset-0 bg-gradient-to-br from-primary/40 via-primary/20 to-transparent blur-3xl rounded-3xl pointer-events-none"
                        />
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* WIN ANNOUNCEMENT */}
              <AnimatePresence>
                {(revealPhase === 'won' || revealPhase === 'revealing') && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 1.2 }}
                    transition={{ duration: 0.5 }}
                    className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20"
                  >
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 1.2, opacity: 0 }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className="text-center"
                    >
                      <motion.div
                        animate={{ 
                          scale: [1, 1.2, 1],
                          opacity: [0.3, 0.5, 0.3]
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute inset-0 bg-white/10 blur-3xl rounded-full -z-10"
                      />

                      <motion.h2
                        animate={{ 
                          scale: [1, 1.05, 1],
                          textShadow: [
                            '0 0 0px rgba(255,77,109,0)',
                            '0 0 30px rgba(255,77,109,0.5)',
                            '0 0 0px rgba(255,77,109,0)'
                          ]
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="text-5xl md:text-6xl font-black text-white tracking-tighter mb-6 drop-shadow-2xl"
                      >
                        Congratulations Darloo 💖
                      </motion.h2>

                      <motion.p
                        animate={{ opacity: [0.8, 1, 0.8] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="text-2xl md:text-3xl font-black text-primary uppercase tracking-[0.4em] drop-shadow-lg"
                      >
                        YOU WON
                      </motion.p>

                      <motion.p
                        className="text-xl md:text-2xl font-bold text-white uppercase tracking-wider mt-4 drop-shadow-lg"
                      >
                        {selectedOption === 1 ? activeGiftSet.option1.title : selectedOption === 2 ? activeGiftSet.option2.title : activeGiftSet.option3.title}
                      </motion.p>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* COMPLETE BUTTON */}
              <AnimatePresence>
                {revealPhase === 'complete' && (
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.6 }}
                    className="mt-20 w-full max-w-xs"
                  >
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleClose}
                      className="w-full bg-gradient-to-r from-primary to-secondary text-white py-6 rounded-2xl font-black text-sm tracking-[0.3em] uppercase shadow-2xl shadow-primary/40 hover:shadow-primary/60 transition-all"
                    >
                      Continue Journey
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
