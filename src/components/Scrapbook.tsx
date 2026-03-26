import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Calendar, Search, Filter } from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { CollectionItem } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';

export default function Scrapbook() {
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const path = 'collection';
    const q = query(
      collection(db, path),
      where('userId', '==', auth.currentUser.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CollectionItem));
      setItems(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tighter">SCRAPBOOK</h1>
          <p className="text-slate-500 text-sm font-medium">Your Unlocked Treasures</p>
        </div>
        <div className="bg-primary/10 p-3 rounded-2xl">
          <Heart className="text-primary w-6 h-6 fill-primary" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Heart className="w-8 h-8 text-primary animate-pulse" />
        </div>
      ) : items.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center space-y-4">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
            <Calendar className="text-slate-300 w-8 h-8" />
          </div>
          <div className="font-bold text-slate-400">Your scrapbook is empty. Unlock gifts to fill it!</div>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          <AnimatePresence>
            {items.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.03 }}
                className="group flex flex-col items-center text-center"
              >
                <div className="relative w-full aspect-square overflow-hidden rounded-xl mb-1.5 shadow-sm">
                  <img 
                    src={item.image} 
                    alt={item.title} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-40" />
                </div>
                <div className="w-full px-1">
                  <h3 className="text-[9px] font-black tracking-tight truncate uppercase text-slate-800 leading-none mb-0.5">
                    {item.title}
                  </h3>
                  <p className="text-slate-400 italic font-medium text-[8px] leading-tight line-clamp-1">
                    {item.message}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
