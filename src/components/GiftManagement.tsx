import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Star, CheckCircle } from 'lucide-react';
import { 
  collection, 
  addDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy
} from 'firebase/firestore';
import { db, storage } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';
import { cn, sanitizeFileName, validateImageFile } from '../lib/utils';

interface GiftSetItem {
  id: string;
  option1: { title: string; message: string; image: string };
  option2: { title: string; message: string; image: string };
  option3: { title: string; message: string; image: string };
  unlocked: boolean;
  primary?: boolean;
  createdAt: string;
}

export default function GiftManagement() {
  const [giftSets, setGiftSets] = useState<GiftSetItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [primaryGiftId, setPrimaryGiftId] = useState<string | null>(null);

  const [giftOptions, setGiftOptions] = useState([
    { title: '', message: '', image: null as File | null },
    { title: '', message: '', image: null as File | null },
    { title: '', message: '', image: null as File | null },
  ]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'giftSets'), orderBy('createdAt', 'desc')),
      (snap) => {
        const gifts = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as GiftSetItem));
        setGiftSets(gifts);
        const primary = gifts.find(g => g.primary);
        setPrimaryGiftId(primary?.id || null);
      }
    );
    return () => unsubscribe();
  }, []);

  const createGiftSet = async () => {
    for (const opt of giftOptions) {
      if (!opt.title || !opt.message) {
        toast.error('Fill in title and message for all 3 gifts');
        return;
      }
      if (opt.image) {
        const validation = validateImageFile(opt.image, 5);
        if (!validation.valid) {
          toast.error(validation.error || 'Invalid image');
          return;
        }
      }
    }

    setIsUploading(true);
    try {
      const uploadedOptions = await Promise.all(giftOptions.map(async (opt, i) => {
        let url = `https://picsum.photos/seed/gift${i}/400/400`;
        if (opt.image) {
          const sanitizedName = sanitizeFileName(opt.image.name);
          const storageRef = ref(storage, `gifts/${Date.now()}_${sanitizedName}`);
          
          const uploadTask = uploadBytesResumable(storageRef, opt.image);

          await new Promise((resolve, reject) => {
            uploadTask.on('state_changed', 
              () => {},
              (error) => reject(error),
              () => resolve(null)
            );
          });

          url = await getDownloadURL(storageRef);
        }
        return { title: opt.title, message: opt.message, image: url };
      }));

      await addDoc(collection(db, 'giftSets'), {
        option1: uploadedOptions[0],
        option2: uploadedOptions[1],
        option3: uploadedOptions[2],
        unlocked: false,
        primary: giftSets.length === 0, // Set first gift as primary
        createdAt: new Date().toISOString()
      });

      toast.success('Gift set created! 🎁');
      setShowForm(false);
      setGiftOptions([
        { title: '', message: '', image: null },
        { title: '', message: '', image: null },
        { title: '', message: '', image: null },
      ]);
    } catch (error) {
      toast.error('Gift set creation failed');
      handleFirestoreError(error, OperationType.CREATE, 'giftSets');
    } finally {
      setIsUploading(false);
    }
  };

  const setPrimaryGift = async (giftId: string) => {
    try {
      await Promise.all(
        giftSets.map(gift =>
          updateDoc(doc(db, 'giftSets', gift.id), { primary: gift.id === giftId })
        )
      );
      toast.success('Primary gift updated! ⭐');
    } catch (error) {
      toast.error('Failed to set primary gift');
      handleFirestoreError(error, OperationType.WRITE, 'giftSets');
    }
  };

  const deleteGift = async (giftId: string) => {
    try {
      await deleteDoc(doc(db, 'giftSets', giftId));
      toast.success('Gift set deleted! 🗑️');
    } catch (error) {
      toast.error('Failed to delete gift set');
      handleFirestoreError(error, OperationType.DELETE, 'giftSets');
    }
  };

  return (
    <div className="space-y-4 pb-8">
      {/* HEADER */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-primary to-secondary text-white rounded-2xl p-5"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">🎁 MANAGE GIFTS</h1>
            <p className="text-xs text-white/70 font-bold">{giftSets.length} Gift Set{giftSets.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className={cn(
              "p-3 rounded-lg font-bold text-sm active:scale-95 transition-all",
              showForm
                ? "bg-white/20 text-white"
                : "bg-white text-primary"
            )}
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </motion.div>

      {/* CREATE FORM */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass rounded-2xl overflow-hidden"
          >
            <div className="p-4 space-y-4">
              <h2 className="text-base font-black text-slate-800">Create New Gift Pack</h2>
              
              {giftOptions.map((opt, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="space-y-2 pb-4 border-b border-white/10"
                >
                  <div className="text-xs font-bold text-primary uppercase">Gift Option {i + 1}</div>
                  
                  <input 
                    type="text"
                    value={opt.title}
                    onChange={(e) => {
                      const updated = [...giftOptions];
                      updated[i].title = e.target.value;
                      setGiftOptions(updated);
                    }}
                    placeholder="Title (e.g., Dinner Date)"
                    className="w-full bg-white/50 border-none rounded-lg px-3 py-2 text-xs focus:ring-2 ring-primary outline-none font-medium"
                  />
                  
                  <textarea
                    value={opt.message}
                    onChange={(e) => {
                      const updated = [...giftOptions];
                      updated[i].message = e.target.value;
                      setGiftOptions(updated);
                    }}
                    placeholder="Message for this gift..."
                    rows={3}
                    className="w-full bg-white/50 border-none rounded-lg px-3 py-2 text-xs focus:ring-2 ring-primary outline-none resize-none"
                  />
                  
                  <label className="block">
                    <div className="text-xs font-bold text-slate-600 mb-1">Image</div>
                    <input 
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const updated = [...giftOptions];
                        updated[i].image = e.target.files?.[0] || null;
                        setGiftOptions(updated);
                      }}
                      className="w-full text-xs file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-primary/20 file:text-primary file:font-bold hover:file:bg-primary/30"
                    />
                    {opt.image && (
                      <p className="text-[10px] text-green-600 font-bold mt-1">✓ {opt.image.name}</p>
                    )}
                  </label>
                </motion.div>
              ))}

              <button 
                onClick={createGiftSet}
                disabled={isUploading}
                className={cn(
                  "w-full py-3 rounded-lg font-black text-sm transition-all active:scale-95",
                  isUploading
                    ? "bg-slate-300 text-slate-600 cursor-not-allowed"
                    : "bg-primary hover:bg-primary/90 text-white"
                )}
              >
                {isUploading ? '📤 Uploading...' : '✨ Create Gift Pack'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GIFT SETS LIST */}
      <div className="space-y-3">
        {giftSets.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass rounded-2xl p-8 text-center"
          >
            <div className="text-4xl mb-2">🎁</div>
            <p className="text-slate-600 font-bold text-sm">No gift sets yet</p>
            <p className="text-slate-400 text-xs mt-1">Create your first gift pack above!</p>
          </motion.div>
        ) : (
          giftSets.map((gift, idx) => (
            <motion.div
              key={gift.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={cn(
                "rounded-2xl p-4 transition-all border-2",
                primaryGiftId === gift.id
                  ? "glass border-primary bg-primary/5"
                  : "glass border-transparent hover:border-primary/20"
              )}
            >
              {/* Primary Badge */}
              {primaryGiftId === gift.id && (
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-primary text-white px-2 py-1 rounded-full text-xs font-bold">
                  <Star className="w-3 h-3 fill-current" />
                  Primary
                </div>
              )}

              <div className="space-y-3">
                {/* First Gift (Main) */}
                <div className="flex gap-3">
                  <img 
                    src={gift.option1.image} 
                    alt={gift.option1.title}
                    className="w-16 h-16 rounded-lg object-cover shadow-md shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-slate-800 text-sm truncate">{gift.option1.title}</h3>
                    <p className="text-xs text-slate-600 line-clamp-2">{gift.option1.message}</p>
                    <div className="text-[10px] text-slate-400 mt-1">
                      Created: {new Date(gift.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Other gifts preview */}
                <div className="grid grid-cols-2 gap-2 pl-0">
                  <div className="flex items-center gap-2 bg-white/30 p-2 rounded-lg">
                    <img 
                      src={gift.option2.image} 
                      alt={gift.option2.title}
                      className="w-10 h-10 rounded object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs truncate">{gift.option2.title}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-white/30 p-2 rounded-lg">
                    <img 
                      src={gift.option3.image} 
                      alt={gift.option3.title}
                      className="w-10 h-10 rounded object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs truncate">{gift.option3.title}</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setPrimaryGift(gift.id)}
                    disabled={primaryGiftId === gift.id}
                    className={cn(
                      "flex-1 py-2 rounded-lg font-bold text-xs transition-all active:scale-95",
                      primaryGiftId === gift.id
                        ? "bg-primary/30 text-primary cursor-default"
                        : "bg-primary/20 text-primary hover:bg-primary/40"
                    )}
                  >
                    {primaryGiftId === gift.id ? '⭐ Active' : 'Set Primary'}
                  </button>
                  <button
                    onClick={() => deleteGift(gift.id)}
                    className="px-3 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-600 rounded-lg font-bold text-xs transition-all active:scale-95"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
