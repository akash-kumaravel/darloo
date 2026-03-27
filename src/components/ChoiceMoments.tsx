import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, doc, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { ChoiceMoment, ChoiceOption } from '../types';
import { Sparkles, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';

export default function ChoiceMoments() {
  const [activeMoment, setActiveMoment] = useState<ChoiceMoment | null>(null);
  const [selectedOption, setSelectedOption] = useState<ChoiceOption | null>(null);
  const [showResponse, setShowResponse] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'choiceMoments'), where('active', '==', true));
    const unsubscribe = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setActiveMoment({ id: snap.docs[0].id, ...snap.docs[0].data() } as ChoiceMoment);
      } else {
        setActiveMoment(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleChoice = async (option: ChoiceOption) => {
    setSelectedOption(option);
    setShowResponse(true);

    const user = auth.currentUser;
    if (user && activeMoment) {
      try {
        await addDoc(collection(db, 'choiceResponses'), {
          userId: user.uid,
          userName: user.email === 'admin@starfall.com' ? 'Admin' : 'Darloo',
          momentId: activeMoment.id,
          question: activeMoment.question,
          choiceLabel: option.label,
          choiceEmoji: option.emoji,
          createdAt: new Date().toISOString()
        });
        toast.success(`Your choice has been recorded!`);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'choiceResponses');
      }
    }

    // Deactivate the moment after a choice is made (optional, maybe it's a one-time thing)
    // if (activeMoment) {
    //   await updateDoc(doc(db, 'choiceMoments', activeMoment.id), { active: false });
    // }
  };

  if (!activeMoment) return null;

  return (
    <div className="glass rounded-3xl p-6 space-y-6 overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Sparkles className="w-12 h-12 text-primary animate-spin-slow" />
      </div>

      <div className="space-y-2">
        <h3 className="text-xl font-black tracking-tighter text-slate-800 uppercase">
          {activeMoment.question}
        </h3>
        <p className="text-xs font-bold text-primary uppercase tracking-widest">
          Interactive Moment
        </p>
      </div>

      <AnimatePresence mode="wait">
        {!showResponse ? (
          <motion.div 
            key="options"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-1 gap-3"
          >
            {activeMoment.options.map((option, index) => (
              <motion.button
                key={index}
                whileHover={{ scale: 1.02, x: 5 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleChoice(option)}
                className="flex items-center gap-4 p-4 bg-white/50 hover:bg-white rounded-2xl border-2 border-transparent hover:border-primary/20 transition-all text-left group"
              >
                <span className="text-2xl group-hover:scale-125 transition-transform">
                  {option.emoji}
                </span>
                <span className="font-bold text-slate-700">{option.label}</span>
              </motion.button>
            ))}
          </motion.div>
        ) : (
          <motion.div 
            key="response"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-4 text-center py-6"
          >
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <h4 className="text-2xl font-black tracking-tighter text-slate-800 uppercase">
              Choice Locked!
            </h4>
            <div className="flex items-center justify-center gap-3 bg-white/50 p-3 rounded-2xl">
              <span className="text-2xl">{selectedOption?.emoji}</span>
              <span className="text-sm font-bold text-primary uppercase tracking-widest">
                {selectedOption?.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
              Waiting for admin to reward...
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
