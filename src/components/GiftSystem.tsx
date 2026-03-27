import { cn } from '../lib/utils';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Gift, Sparkles, ChevronRight, Heart, Image as ImageIcon, Plus, X, Loader2 } from 'lucide-react';
import { GiftSet, GiftOption } from '../types';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { uploadImage, fileToBase64 } from '../services/api';

interface GiftSystemProps {
  totalStars: number;
  giftOpenRequest?: boolean;
  onGiftOpened?: () => void;
}

type RevealPhase = 'idle' | 'flipping' | 'won' | 'revealing' | 'revealOthers' | 'complete';
type GiftCreationPhase = 'idle' | 'uploading' | 'complete';

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

export default function GiftSystem({ totalStars, giftOpenRequest = false, onGiftOpened }: GiftSystemProps) {
  const [activeGiftSet, setActiveGiftSet] = useState<GiftSet | null>(null);
  const [showUnlock, setShowUnlock] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [revealPhase, setRevealPhase] = useState<RevealPhase>('idle');
  const [showCreateGift, setShowCreateGift] = useState(false);
  const [giftTitle, setGiftTitle] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [giftImage, setGiftImage] = useState<File | null>(null);
  const [creationPhase, setCreationPhase] = useState<GiftCreationPhase>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLocked, setIsLocked] = useState(false);

  // Calculate if gift is ready (every 25 stars: 25, 50, 75, etc.)
  const starsInCycle = totalStars % 25;
  const isGiftReady = starsInCycle === 0 && totalStars > 0;

  // Load gifts from localStorage instead of Firebase
  useEffect(() => {
    const savedGifts = localStorage.getItem('loveverse_gifts');
    if (savedGifts) {
      try {
        const gifts = JSON.parse(savedGifts) as GiftSet[];
        // Get first unlocked gift
        const nextGift = gifts.find(g => !g.unlocked);
        setActiveGiftSet(nextGift || null);
      } catch (error) {
        console.error('Error loading gifts:', error);
        setActiveGiftSet(null);
      }
    }
  }, []);

  const isUnlockable = isGiftReady && activeGiftSet;

  useEffect(() => {
    if (giftOpenRequest && isUnlockable && !showUnlock) {
      handleUnlock();
      onGiftOpened?.();
    }
  }, [giftOpenRequest, isUnlockable, showUnlock, onGiftOpened]);

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
      // Save to scrapbook collection in localStorage
      const savedScrapbook = localStorage.getItem('loveverse_scrapbook');
      const scrapbook = savedScrapbook ? JSON.parse(savedScrapbook) : [];
      
      scrapbook.push({
        id: Date.now().toString(),
        title: option.title,
        message: option.message,
        image: option.image,
        date: new Date().toISOString()
      });
      
      localStorage.setItem('loveverse_scrapbook', JSON.stringify(scrapbook));

      // Mark gift set as unlocked
      const savedGifts = localStorage.getItem('loveverse_gifts');
      if (savedGifts) {
        const gifts = JSON.parse(savedGifts) as GiftSet[];
        const updatedGifts = gifts.map(g => 
          g.id === activeGiftSet.id ? { ...g, unlocked: true } : g
        );
        localStorage.setItem('loveverse_gifts', JSON.stringify(updatedGifts));
      }
      
      toast.success('Gift added to scrapbook! 📸');
    } catch (error) {
      console.error('Error saving gift:', error);
      toast.error('Failed to save gift to scrapbook');
      setIsLocked(false);
    }
  };

  const handleClose = () => {
    setShowUnlock(false);
    setSelectedOption(null);
    setRevealPhase('idle');
    setIsLocked(false);
    onGiftOpened?.();
  };

  const handleCreateGift = async () => {
    if (!giftTitle || !giftMessage || !giftImage) {
      toast.error('Please fill all fields and select an image');
      return;
    }

    setCreationPhase('uploading');
    try {
      // Convert file to base64
      const base64 = await fileToBase64(giftImage);
      
      // Upload image to GitHub
      const uploadResponse = await uploadImage(base64, `gift_${Date.now()}_${giftImage.name}`);
      
      if (!uploadResponse.success) {
        toast.error('Failed to upload gift image to server');
        setCreationPhase('idle');
        return;
      }

      // Create gift set in localStorage
      const savedGifts = localStorage.getItem('loveverse_gifts');
      const gifts: GiftSet[] = savedGifts ? JSON.parse(savedGifts) : [];
      
      const newGift: GiftSet = {
        id: Date.now().toString(),
        option1: {
          title: giftTitle,
          message: giftMessage,
          image: uploadResponse.url
        },
        option2: {
          title: 'Mystery Gift 2',
          message: 'Another surprise awaits...',
          image: uploadResponse.url
        },
        option3: {
          title: 'Mystery Gift 3',
          message: 'The final treasure...',
          image: uploadResponse.url
        },
        unlocked: false,
        createdAt: new Date().toISOString()
      };
      
      gifts.push(newGift);
      localStorage.setItem('loveverse_gifts', JSON.stringify(gifts));

      toast.success('Gift created! 🎁 (Image stored permanently on GitHub)');
      setCreationPhase('complete');
      
      // Reset form
      setTimeout(() => {
        setShowCreateGift(false);
        setGiftTitle('');
        setGiftMessage('');
        setGiftImage(null);
        setCreationPhase('idle');
      }, 1500);
    } catch (error) {
      console.error('Gift creation error:', error);
      toast.error('Failed to create gift');
      setCreationPhase('idle');
    }
  };

  if (!activeGiftSet && !isGiftReady) return null;

  return (
    <div className="space-y-3">
      <motion.div
        whileHover={isUnlockable ? { scale: 1.05 } : {}}
        whileTap={isUnlockable ? { scale: 0.98 } : {}}
        onClick={handleUnlock}
        className={cn(
          "flex items-center gap-4",
          isUnlockable ? "cursor-pointer" : "opacity-80"
        )}
      >
        {isUnlockable && (
          <>
            {/* Animated outer glow */}
            <motion.div
              animate={{ opacity: [0.2, 0.5, 0.2], scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0 -skew-x-12"
            />
            {/* Shimmer effect */}
            <motion.div
              animate={{ opacity: [0.1, 0.3, 0.1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent -skew-x-12 translate-x-[-100%] animate-[shimmer_2s_infinite]"
            />
          </>
        )}

        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center shadow-lg shrink-0 relative",
          isUnlockable ? "bg-gradient-to-br from-primary to-secondary text-white" : "bg-slate-100 text-slate-400"
        )}>
          {isUnlockable && (
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="absolute inset-0 bg-primary/20 rounded-xl blur-lg"
            />
          )}
          <motion.div animate={isUnlockable ? { rotateY: [0, 360] } : {}} transition={{ repeat: Infinity, duration: 3 }} className="relative z-10">
            {isUnlockable ? <Gift className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
          </motion.div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-black text-slate-800 text-sm tracking-tight truncate">
            {isUnlockable ? 'SURPRISE UNLOCKED!' : 'MYSTERY GIFT'}
          </div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
            {isUnlockable ? '✨ TAP TO OPEN YOUR GIFT ✨' : `${25 - starsInCycle} stars to next gift`}
          </div>
        </div>

        {isUnlockable && (
          <motion.div
            animate={{ x: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1 }}
          >
            <ChevronRight className="w-5 h-5 text-primary shrink-0" />
          </motion.div>
        )}
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
            {/* BACKGROUND DIMMING - Progressive effect during reveal */}
            <motion.div 
              animate={{ 
                opacity: selectedOption !== null ? 0.85 : 0,
                backdropFilter: selectedOption !== null ? 'blur(8px)' : 'blur(0px)'
              }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
              className="absolute inset-0 bg-black pointer-events-none z-0"
            />

            <div className="w-full max-w-2xl flex flex-col items-center relative z-10">
              {/* HEADING - Only show during idle phase */}
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
                  
                  // FLIP LOGIC: Selected card flips during flipping phase
                  // Non-selected cards flip during revealOthers/complete phases
                  const isFlipped = isSelected 
                    ? (revealPhase !== 'idle') 
                    : (revealPhase === 'revealOthers' || revealPhase === 'complete');

                  return (
                    <motion.div
                      key={i}
                      animate={{
                        scale: isSelected && revealPhase !== 'idle' ? 1.15 : isOther && revealPhase !== 'revealOthers' && revealPhase !== 'complete' ? 0.8 : 1,
                        opacity: isOther && revealPhase !== 'revealOthers' && revealPhase !== 'complete' ? 0.2 : 1,
                        y: isSelected && revealPhase !== 'idle' ? -50 : 0,
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
                        !isLocked && revealPhase === 'idle' ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed'
                      )}
                      onClick={() => !isLocked && revealPhase === 'idle' && handleSelect(i)}
                    >
                      {/* CARD FRONT (Mystery) */}
                      <div 
                        className="absolute inset-0 glass rounded-3xl flex flex-col items-center justify-center gap-4 border-2 border-white/20 backface-hidden shadow-2xl backdrop-blur-md"
                        style={{ backfaceVisibility: 'hidden' }}
                      >
                        {/* Glow pulse */}
                        <motion.div
                          animate={{ opacity: [0.3, 0.6, 0.3] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent rounded-3xl"
                        />
                        
                        <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center relative z-10 border border-white/20">
                          <motion.div
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          >
                            <Heart className="w-7 h-7 text-white/60" />
                          </motion.div>
                        </div>
                        <motion.div 
                          animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.8, 0.4] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="text-white font-black text-5xl opacity-20 relative z-10"
                        >
                          ?
                        </motion.div>
                        {revealPhase === 'idle' && (
                          <motion.p
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 1, repeat: Infinity }}
                            className="text-white/70 text-xs font-bold uppercase tracking-widest absolute bottom-6"
                          >
                            Tap to reveal
                          </motion.p>
                        )}
                      </div>

                      {/* CARD BACK (Revealed) */}
                      <div 
                        className={cn(
                          "absolute inset-0 rounded-3xl flex flex-col items-center justify-start p-5 border-2 overflow-hidden shadow-2xl",
                          isSelected 
                            ? "bg-gradient-to-br from-white via-white to-primary/5 border-white shadow-[0_0_80px_rgba(255,77,109,0.5)]" 
                            : "bg-white/15 border-white/30 backdrop-blur-sm"
                        )}
                        style={{ 
                          backfaceVisibility: 'hidden',
                          transform: 'rotateY(180deg)'
                        }}
                      >
                        {/* GIFT IMAGE */}
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

                        {/* GIFT TITLE & MESSAGE */}
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

                          {/* MESSAGE DISPLAY - Only show when appropriate */}
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

                      {/* GLOW EFFECT during selected card flip */}
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

              {/* WIN ANNOUNCEMENT OVERLAY */}
              <AnimatePresence>
                {(revealPhase === 'won' || revealPhase === 'revealing') && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 1.2 }}
                    transition={{ duration: 0.5 }}
                    className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20"
                  >
                    {/* ANIMATED CELEBRATION TEXT */}
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0, y: 30 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 1.2, opacity: 0, y: -30 }}
                      transition={{ duration: 0.8, ease: 'easeOut', type: 'spring', stiffness: 100 }}
                      className="text-center relative"
                    >
                      {/* Multiple glowing layers */}
                      <motion.div
                        animate={{ 
                          scale: [0.8, 1.4, 0.8],
                          opacity: [0.3, 0.1, 0.3]
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute inset-0 bg-gradient-to-t from-primary/60 via-primary/40 to-primary/20 blur-3xl rounded-full -z-10 w-96 h-96 -translate-x-24"
                      />
                      <motion.div
                        animate={{ 
                          scale: [1, 1.3, 1],
                          opacity: [0.2, 0.4, 0.2]
                        }}
                        transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
                        className="absolute inset-0 bg-gradient-to-b from-white/20 via-primary/10 to-transparent blur-2xl rounded-full -z-10 w-80 h-80"
                      />

                      <motion.h2
                        animate={{ 
                          scale: [1, 1.08, 1],
                          textShadow: [
                            '0 0 0px rgba(255,77,109,0)',
                            '0 0 50px rgba(255,77,109,0.8)',
                            '0 0 20px rgba(255,77,109,0.4)'
                          ],
                          letterSpacing: ['0.05em', '0.08em', '0.05em']
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="text-6xl md:text-7xl font-black text-white tracking-tight mb-6 drop-shadow-2xl leading-tight"
                      >
                        CONGRATULATIONS
                      </motion.h2>

                      <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.8 }}
                        className="text-3xl md:text-4xl font-black text-primary uppercase tracking-[0.2em] drop-shadow-xl mb-4"
                      >
                        DARLOO 💖
                      </motion.p>

                      <motion.p
                        animate={{ opacity: [0.7, 1, 0.7] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="text-2xl md:text-3xl font-black text-white uppercase tracking-[0.4em] drop-shadow-lg mb-2"
                      >
                        YOU WON
                      </motion.p>

                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5, duration: 0.8 }}
                        className="text-xl md:text-2xl font-bold text-primary/90 uppercase tracking-wider mt-4 drop-shadow-lg italic"
                      >
                        {selectedOption === 1 ? activeGiftSet.option1.title : selectedOption === 2 ? activeGiftSet.option2.title : activeGiftSet.option3.title}
                      </motion.p>

                      {/* Tap to continue prompt */}
                      {revealPhase === 'revealing' && (
                        <motion.div
                          animate={{ scale: [0.95, 1.05, 0.95], opacity: [0.6, 1, 0.6] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 text-white/80 font-bold uppercase text-sm tracking-widest"
                        >
                          ✨ Gift Ready to Open ✨
                        </motion.div>
                      )}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* COMPLETE ACTION BUTTON */}
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

      {/* Create Gift Modal */}
      <AnimatePresence>
        {showCreateGift && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-3xl p-8 max-w-md w-full space-y-4 border border-primary/20"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-black text-slate-800 text-xl">Create a Gift 🎁</h3>
                <button 
                  onClick={() => {
                    setShowCreateGift(false);
                    setGiftTitle('');
                    setGiftMessage('');
                    setGiftImage(null);
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <input
                type="text"
                placeholder="Gift title"
                value={giftTitle}
                onChange={(e) => setGiftTitle(e.target.value)}
                className="w-full bg-white/50 border-none rounded-xl px-4 py-3 focus:ring-2 ring-primary outline-none text-sm"
              />

              <textarea
                placeholder="Write a message for your gift..."
                value={giftMessage}
                onChange={(e) => setGiftMessage(e.target.value)}
                className="w-full h-20 bg-white/50 border-none rounded-xl px-4 py-3 focus:ring-2 ring-primary outline-none text-sm resize-none"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative aspect-video bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-200 transition-colors overflow-hidden"
              >
                {giftImage ? (
                  <img
                    src={URL.createObjectURL(giftImage)}
                    className="w-full h-full object-cover"
                    alt="Preview"
                  />
                ) : (
                  <>
                    <ImageIcon className="w-8 h-8 text-slate-300" />
                    <span className="text-xs text-slate-400 font-medium">Tap to select image</span>
                  </>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => setGiftImage(e.target.files?.[0] || null)}
                />
              </div>

              <button
                onClick={handleCreateGift}
                disabled={creationPhase === 'uploading' || creationPhase === 'complete'}
                className="w-full bg-gradient-to-r from-primary to-secondary text-white py-3 rounded-xl font-bold shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creationPhase === 'uploading' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading to GitHub...
                  </>
                ) : creationPhase === 'complete' ? (
                  <>
                    <span>✓ Gift Created!</span>
                  </>
                ) : (
                  'Create Gift'
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Create Gift Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowCreateGift(true)}
        className="fixed bottom-24 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-secondary text-white shadow-lg shadow-primary/40 flex items-center justify-center hover:shadow-primary/60 transition-shadow"
      >
        <Plus className="w-6 h-6" />
      </motion.button>
    </div>
  );
}
