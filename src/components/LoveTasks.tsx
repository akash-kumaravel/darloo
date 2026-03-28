import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Clock, Star, Trophy, Sparkles, ChevronRight } from 'lucide-react';
import { collection, query, onSnapshot, orderBy, doc, updateDoc, increment, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';

interface LoveTask {
  id: string;
  title: string;
  description: string;
  stars: number;
  status: 'pending' | 'completed_by_user' | 'approved_by_admin' | 'claimed';
  createdAt: string;
}

export default function LoveTasks({ isAdmin = false }: { isAdmin?: boolean }) {
  const [tasks, setTasks] = useState<LoveTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LoveTask));
      setTasks(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'tasks');
    });

    return () => unsubscribe();
  }, []);

  const handleCompleteTask = async (taskId: string) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        status: 'completed_by_user',
        completedAt: new Date().toISOString()
      });
      toast.success('Task marked as completed! Waiting for approval... ❤️');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  const handleClaimStars = async (task: LoveTask) => {
    try {
      const batch = writeBatch(db);
      
      // Update task status
      batch.update(doc(db, 'tasks', task.id), {
        status: 'claimed',
        claimedAt: new Date().toISOString()
      });

      // Add stars to global stats
      batch.update(doc(db, 'stats', 'global'), {
        totalStars: increment(task.stars)
      });

      await batch.commit();

      // Celebration
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ff4d6d', '#ffd166', '#4cc9f0']
      });

      toast.success(`Claimed ${task.stars} stars! ✨`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${task.id}`);
    }
  };

  if (loading) return null;

  const activeTasks = tasks.filter(t => t.status !== 'claimed');

  if (activeTasks.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Trophy className="w-5 h-5 text-primary" />
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">Love Missions</h2>
      </div>

      <div className="space-y-3">
        {activeTasks.map((task) => (
          <motion.div
            key={task.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass p-4 rounded-3xl border border-white/20 relative overflow-hidden group"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h3 className="font-black text-slate-800 tracking-tight leading-tight uppercase text-sm">
                  {task.title}
                </h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  {task.description}
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  <div className="bg-yellow-400/10 text-yellow-600 px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1">
                    <Star className="w-3 h-3 fill-yellow-400" />
                    {task.stars} STARS
                  </div>
                  {task.status === 'completed_by_user' && (
                    <div className="bg-blue-400/10 text-blue-600 px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      WAITING APPROVAL
                    </div>
                  )}
                  {task.status === 'approved_by_admin' && (
                    <div className="bg-green-400/10 text-green-600 px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 animate-pulse">
                      <Sparkles className="w-3 h-3" />
                      READY TO CLAIM
                    </div>
                  )}
                </div>
              </div>

              {task.status === 'pending' && (
                <button
                  onClick={() => handleCompleteTask(task.id)}
                  className="bg-primary text-white p-3 rounded-2xl shadow-lg shadow-primary/20 hover:scale-110 active:scale-90 transition-all"
                >
                  <CheckCircle2 className="w-5 h-5" />
                </button>
              )}

              {task.status === 'approved_by_admin' && (
                <button
                  onClick={() => handleClaimStars(task)}
                  className="bg-green-500 text-white px-4 py-2 rounded-2xl shadow-lg shadow-green-500/20 font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
                >
                  Claim
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
