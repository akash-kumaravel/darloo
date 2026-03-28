import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, doc, updateDoc, increment, addDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { ChoiceMoment, ChoiceOption } from '../types';
import { Sparkles, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';

export default function ChoiceMoments() {
  const [activeMoment, setActiveMoment] = useState<ChoiceMoment | null>(null);
  const [selectedOption, setSelectedOption] = useState<ChoiceOption | null>(null);
  const [showResponse, setShowResponse] = useState(false);
  const [isCheckingResponse, setIsCheckingResponse] = useState(true);
  const isAdmin = auth.currentUser?.email === 'akashuxui@gmail.com';

  useEffect(() => {
    const q = query(collection(db, 'choiceMoments'), where('active', '==', true));
    const unsubscribe = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const moment = { id: snap.docs[0].id, ...snap.docs[0].data() } as ChoiceMoment;
        setActiveMoment(moment);
        
        // Check if user already responded to this moment
        const user = auth.currentUser;
        if (user) {
          const respQuery = query(
            collection(db, 'choiceResponses'), 
            where('momentId', '==', moment.id),
            where('userId', '==', user.uid)
          );
          
          onSnapshot(respQuery, (respSnap) => {
            if (!respSnap.empty) {
              const respData = respSnap.docs[0].data();
              const option = moment.options.find(o => o.label === respData.choiceLabel);
              if (option) {
                setSelectedOption(option);
                setShowResponse(true);
              }
            }
            setIsCheckingResponse(false);
          });
        } else {
          setIsCheckingResponse(false);
        }
      } else {
        setActiveMoment(null);
        setIsCheckingResponse(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleChoice = async (option: ChoiceOption) => {
    if (showResponse) return; // Prevent changing choice
    
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
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'choiceResponses');
      }
    }

    // Reward removed as per user request
  };

  const handleDelete = async () => {
    if (!activeMoment) return;
    if (!window.confirm('Delete this active moment?')) return;

    try {
      // Cascading delete: delete all associated responses
      const q = query(collection(db, 'choiceResponses'), where('momentId', '==', activeMoment.id));
      const responses = await getDocs(q);
      
      const batch = writeBatch(db);
      responses.docs.forEach((doc) => batch.delete(doc.ref));
      batch.delete(doc(db, 'choiceMoments', activeMoment.id));
      
      await batch.commit();
      toast.success('Choice moment and responses deleted! 🗑️');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `choiceMoments/${activeMoment.id}`);
    }
  };

  if (!activeMoment || isCheckingResponse) return null;

  return (
    <div className="glass rounded-3xl p-6 space-y-6 overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Sparkles className="w-12 h-12 text-primary animate-spin-slow" />
      </div>

      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h3 className="text-xl font-black tracking-tighter text-slate-800 uppercase">
            {activeMoment.question}
          </h3>
          <p className="text-xs font-bold text-primary uppercase tracking-widest">
            Interactive Moment
          </p>
        </div>
        {isAdmin && (
          <button 
            onClick={handleDelete}
            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all rounded-xl"
            title="Delete active moment"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
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
            className="space-y-4 text-center py-4"
          >
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <h4 className="text-2xl font-black tracking-tighter text-slate-800 uppercase">
              Great Choice!
            </h4>
            <p className="text-slate-600 font-medium italic">
              "{selectedOption?.response}"
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary/40">
              <CheckCircle2 className="w-3 h-3" />
              Choice Locked
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
