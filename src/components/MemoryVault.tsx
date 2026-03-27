import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Heart, Maximize2, X, Plus, Image as ImageIcon, Send, Loader2 } from 'lucide-react';
import { collection, query, onSnapshot, orderBy, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Memory } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';
import { uploadToImgbb } from '../lib/imgbb-upload';
import { toast } from 'sonner';

export default function MemoryVault() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [caption, setCaption] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const path = 'memories';
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Memory));
      setMemories(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, []);

  const handleUpload = async () => {
    console.log('📸 Memory upload started');
    
    if (!image || !caption) {
      toast.error('Please select an image and add a caption');
      return;
    }

    if (image.size > 10 * 1024 * 1024) {
      toast.error('Image is too large (max 10MB)');
      return;
    }

    setIsUploading(true);
    console.log('🚀 Calling uploadToImgbb...');
    
    try {
      const imageUrl = await uploadToImgbb(image);
      console.log('✅ Got URL from Imgbb:', imageUrl);

      await addDoc(collection(db, 'memories'), {
        image: imageUrl,
        caption: caption,
        createdAt: new Date().toISOString(),
        userId: auth.currentUser?.uid
      });

      toast.success('Memory added! 📸');
      setCaption('');
      setImage(null);
      setShowUpload(false);
    } catch (error) {
      console.error('❌ Memory upload error:', error);
      toast.error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}. Check console.`);
      handleFirestoreError(error, OperationType.CREATE, 'memories');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tighter">MEMORY VAULT</h1>
          <p className="text-slate-500 text-sm font-medium">Capturing Our Journey</p>
        </div>
        <div className="bg-primary/10 p-3 rounded-2xl">
          <Camera className="text-primary w-6 h-6" />
        </div>
      </div>

      {/* Upload Container */}
      <div className="glass rounded-3xl p-6">
        {!showUpload ? (
          <button 
            onClick={() => setShowUpload(true)}
            className="w-full py-8 border-2 border-dashed border-primary/30 rounded-2xl flex flex-col items-center justify-center gap-3 text-primary font-bold hover:bg-primary/5 transition-all group"
          >
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus className="w-6 h-6" />
            </div>
            <span>Add New Memory</span>
          </button>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800">New Memory</h3>
              <button onClick={() => setShowUpload(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div 
              onClick={() => fileInputRef.current?.click()}
              className="relative aspect-video bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-200 transition-colors overflow-hidden"
            >
              {image ? (
                <img 
                  src={URL.createObjectURL(image)} 
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
                onChange={(e) => setImage(e.target.files?.[0] || null)}
              />
            </div>

            <div className="flex gap-2">
              <input 
                type="text" 
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write a caption..."
                className="flex-1 bg-white/50 border-none rounded-xl px-4 py-3 focus:ring-2 ring-primary outline-none text-sm"
              />
              <button 
                onClick={handleUpload}
                disabled={isUploading}
                className="bg-primary text-white p-3 rounded-xl shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Heart className="w-8 h-8 text-primary animate-pulse" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {memories.map((memory, index) => (
            <motion.div
              key={memory.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => setSelectedMemory(memory)}
              className="relative aspect-square glass rounded-3xl overflow-hidden cursor-pointer group"
            >
              <img 
                src={memory.image} 
                alt={memory.caption} 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Maximize2 className="text-white w-6 h-6" />
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {selectedMemory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6"
          >
            <button 
              onClick={() => setSelectedMemory(null)}
              className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors"
            >
              <X className="w-8 h-8" />
            </button>

            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-lg space-y-6"
            >
              <div className="bg-white p-3 rounded-2xl shadow-2xl rotate-1">
                <img 
                  src={selectedMemory.image} 
                  alt="Memory" 
                  className="w-full aspect-square object-cover rounded-xl" 
                />
                <div className="py-6 px-2">
                  <p className="text-slate-800 font-medium text-lg leading-relaxed font-serif">
                    {selectedMemory.caption}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <span>{new Date(selectedMemory.createdAt).toLocaleDateString()}</span>
                    <Heart className="w-3 h-3 text-primary fill-primary" />
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
