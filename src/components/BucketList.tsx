import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, CheckCircle2, Circle, Heart, Camera, Calendar, Sparkles, Clock, Trash2 } from 'lucide-react';
import { collection, query, onSnapshot, orderBy, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';

interface BucketListItem {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'todo' | 'completed';
  image?: string;
  createdAt: string;
  completedAt?: string;
}

export default function BucketList({ isAdmin = false }: { isAdmin?: boolean }) {
  const [items, setItems] = useState<BucketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'bucketList'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BucketListItem));
      setItems(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'bucketList');
    });

    return () => unsubscribe();
  }, []);

  const handleAddDream = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'bucketList'), {
        title: newTitle,
        description: newDesc,
        status: isAdmin ? 'todo' : 'pending',
        createdAt: new Date().toISOString()
      });
      setNewTitle('');
      setNewDesc('');
      setShowAddForm(false);
      toast.success(isAdmin ? 'Dream added to list! ✨' : 'Dream proposed! Waiting for approval. ❤️');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'bucketList');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await deleteDoc(doc(db, 'bucketList', itemId));
      toast.success('Dream removed from list');
      setDeleteConfirmId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `bucketList/${itemId}`);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <Heart className="w-8 h-8 text-primary animate-pulse" />
    </div>
  );

  const pendingItems = items.filter(i => i.status === 'pending');
  const todoItems = items.filter(i => i.status === 'todo');
  const completedItems = items.filter(i => i.status === 'completed');

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tighter uppercase">OUR BUCKET LIST</h1>
          <p className="text-slate-500 text-sm font-medium">Dreams to fulfill together</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-primary text-white p-3 rounded-2xl shadow-lg shadow-primary/20 hover:scale-105 transition-all active:scale-95"
          >
            {showAddForm ? <Sparkles className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAddDream}
            className="glass p-6 rounded-[2.5rem] space-y-4 overflow-hidden"
          >
            <div className="text-center mb-2">
              <h2 className="text-lg font-black text-slate-800 tracking-tighter uppercase">Propose a Dream</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">What should we do next?</p>
            </div>
            <input 
              type="text" 
              placeholder="Dream Title (e.g., Visit Paris)" 
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full bg-white/50 border-2 border-transparent rounded-2xl px-5 py-4 outline-none focus:border-primary/30 text-sm font-medium"
              required
            />
            <textarea 
              placeholder="Tell me more about this dream..." 
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full bg-white/50 border-2 border-transparent rounded-2xl px-5 py-4 outline-none focus:border-primary/30 text-sm font-medium h-24 resize-none"
            />
            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Adding...' : 'Add to Bucket List'}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {items.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center space-y-4">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
            <Sparkles className="text-slate-300 w-8 h-8" />
          </div>
          <div className="font-bold text-slate-400">Our bucket list is empty. Add some dreams!</div>
        </div>
      ) : (
        <div className="space-y-8">
          {pendingItems.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <Clock className="w-4 h-4 text-orange-400" />
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Proposed Dreams</h2>
              </div>
              <div className="grid gap-3">
                {pendingItems.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass p-5 rounded-[2rem] border border-white/20 flex items-center gap-4 opacity-70"
                  >
                    <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center shrink-0">
                      <Clock className="w-6 h-6 text-orange-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-black text-slate-800 tracking-tight leading-tight uppercase text-sm">
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed mt-0.5">
                        {item.description}
                      </p>
                      <div className="mt-2 inline-block px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full text-[8px] font-black uppercase tracking-wider">
                        Awaiting Approval
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        {deleteConfirmId === item.id ? (
                          <div className="flex items-center gap-1 bg-red-50 p-1 rounded-xl border border-red-100">
                            <button 
                              onClick={() => handleDeleteItem(item.id)}
                              className="px-2 py-1 bg-red-500 text-white text-[8px] font-black uppercase rounded-lg"
                            >
                              Delete
                            </button>
                            <button 
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-2 py-1 bg-slate-200 text-slate-600 text-[8px] font-black uppercase rounded-lg"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setDeleteConfirmId(item.id)}
                            className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {todoItems.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <Circle className="w-4 h-4 text-primary" />
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">To Do</h2>
              </div>
              <div className="grid gap-3">
                {todoItems.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass p-5 rounded-[2rem] border border-white/20 flex items-center gap-4 group"
                  >
                    <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <Heart className="w-6 h-6 text-primary/40 group-hover:text-primary transition-colors" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-black text-slate-800 tracking-tight leading-tight uppercase text-sm">
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed mt-0.5">
                        {item.description}
                      </p>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        {deleteConfirmId === item.id ? (
                          <div className="flex items-center gap-1 bg-red-50 p-1 rounded-xl border border-red-100">
                            <button 
                              onClick={() => handleDeleteItem(item.id)}
                              className="px-2 py-1 bg-red-500 text-white text-[8px] font-black uppercase rounded-lg"
                            >
                              Delete
                            </button>
                            <button 
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-2 py-1 bg-slate-200 text-slate-600 text-[8px] font-black uppercase rounded-lg"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setDeleteConfirmId(item.id)}
                            className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {completedItems.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Fulfilled</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {completedItems.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass rounded-[2rem] border border-white/20 overflow-hidden group"
                  >
                    <div className="aspect-square relative overflow-hidden">
                      {item.image ? (
                        <img 
                          src={item.image} 
                          alt={item.title} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                          <Camera className="w-8 h-8 text-slate-300" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
                      {isAdmin && (
                        <div className="absolute top-2 right-2 z-10">
                          {deleteConfirmId === item.id ? (
                            <div className="flex flex-col gap-1 bg-white/90 backdrop-blur-md p-1 rounded-xl shadow-lg">
                              <button 
                                onClick={() => handleDeleteItem(item.id)}
                                className="px-2 py-1 bg-red-500 text-white text-[8px] font-black uppercase rounded-lg"
                              >
                                Delete
                              </button>
                              <button 
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-2 py-1 bg-slate-200 text-slate-600 text-[8px] font-black uppercase rounded-lg"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(item.id);
                              }}
                              className="p-2 bg-white/20 backdrop-blur-md rounded-xl text-white hover:bg-red-500 transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                      <div className="absolute bottom-3 left-3 right-3">
                        <h3 className="text-[10px] font-black tracking-tight text-white uppercase truncate">
                          {item.title}
                        </h3>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Calendar className="w-2.5 h-2.5 text-white/60" />
                          <span className="text-[8px] font-bold text-white/60 uppercase">
                            {item.completedAt ? new Date(item.completedAt).toLocaleDateString() : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
