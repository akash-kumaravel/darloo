import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Send, 
  Calendar, 
  Image as ImageIcon, 
  Gift, 
  MessageSquare,
  Clock,
  Trash2,
  Settings,
  X,
  ChevronRight,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  Trophy,
  Camera,
  Heart,
  Star
} from 'lucide-react';
import { uploadToImgBB } from '../lib/imgbb';
import { 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  collection, 
  addDoc, 
  onSnapshot,
  query,
  orderBy,
  limit,
  getDocs,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { GameStats, UserProfile, DailyMessage, NextEvent, UserMood, ChoiceResponse, GiftSet } from '../types';
import { toast } from 'sonner';
import StarReactor from './StarReactor';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';
import { Smile, Heart as HeartIcon, Frown, Moon } from 'lucide-react';
import { cn } from '../lib/utils';

interface AdminPanelProps {
  stats: GameStats | null;
  profile: UserProfile | null;
}

export default function AdminPanel({ stats, profile }: AdminPanelProps) {
  const [dailyMsg, setDailyMsg] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [memoryCaption, setMemoryCaption] = useState('');
  const [memoryImage, setMemoryImage] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showGiftForm, setShowGiftForm] = useState(false);
  const [userMoods, setUserMoods] = useState<UserMood[]>([]);
  const [choiceResponses, setChoiceResponses] = useState<ChoiceResponse[]>([]);
  const [showChoiceForm, setShowChoiceForm] = useState(false);
  const [existingGiftSets, setExistingGiftSets] = useState<GiftSet[]>([]);
  const [currentEvent, setCurrentEvent] = useState<NextEvent | null>(null);
  const [memories, setMemories] = useState<any[]>([]);
  const [choiceMoments, setChoiceMoments] = useState<any[]>([]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    ws.current = new WebSocket(`${protocol}//${host}`);

    return () => {
      if (ws.current) ws.current.close();
    };
  }, []);

  const sendNotification = (type: 'star' | 'mission' | 'memory' | 'choice', title: string, message: string) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'notification',
        payload: { type, title, message }
      }));
    }
  };

  // Love Tasks State
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskStars, setTaskStars] = useState(5);
  const [tasks, setTasks] = useState<any[]>([]);
  const [showTaskForm, setShowTaskForm] = useState(false);

  // Bucket List State
  const [bucketTitle, setBucketTitle] = useState('');
  const [bucketDesc, setBucketDesc] = useState('');
  const [bucketList, setBucketList] = useState<any[]>([]);
  const [showBucketForm, setShowBucketForm] = useState(false);
  const [isCompletingBucketItem, setIsCompletingBucketItem] = useState<string | null>(null);
  const [bucketImage, setBucketImage] = useState<File | null>(null);

  // Choice Moment Form State
  const [choiceQuestion, setChoiceQuestion] = useState('');
  const [choiceOptions, setChoiceOptions] = useState([
    { label: '', emoji: '🎬', response: '', reward: 5 },
    { label: '', emoji: '🌆', response: '', reward: 5 },
  ]);

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const unsubscribeMoods = onSnapshot(
      query(
        collection(db, 'moods'), 
        where('updatedAt', '>=', todayISO),
        orderBy('updatedAt', 'desc')
      ), 
      (snap) => {
        const moods = snap.docs.map(doc => doc.data() as UserMood);
        setUserMoods(moods);
      }
    );

    const unsubscribeResponses = onSnapshot(
      query(
        collection(db, 'choiceResponses'), 
        where('createdAt', '>=', todayISO),
        orderBy('createdAt', 'desc'), 
        limit(20)
      ),
      (snap) => {
        const responses = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChoiceResponse));
        setChoiceResponses(responses);
      }
    );

    const unsubscribeTasks = onSnapshot(
      query(collection(db, 'tasks'), orderBy('createdAt', 'desc')),
      (snap) => {
        const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTasks(docs);
      }
    );

    const unsubscribeBucket = onSnapshot(
      query(collection(db, 'bucketList'), orderBy('createdAt', 'desc')),
      (snap) => {
        const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setBucketList(docs);
      }
    );

    return () => {
      unsubscribeMoods();
      unsubscribeResponses();
      unsubscribeTasks();
      unsubscribeBucket();
    };
  }, []);

  useEffect(() => {
    const unsubscribeEvent = onSnapshot(doc(db, 'events', 'next'), (doc) => {
      if (doc.exists()) {
        setCurrentEvent(doc.data() as NextEvent);
      } else {
        setCurrentEvent(null);
      }
    });

    const unsubscribeMemories = onSnapshot(
      query(collection(db, 'memories'), orderBy('createdAt', 'desc')),
      (snap) => {
        setMemories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );

    const unsubscribeChoices = onSnapshot(
      query(collection(db, 'choiceMoments'), orderBy('createdAt', 'desc')),
      (snap) => {
        setChoiceMoments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );

    return () => {
      unsubscribeEvent();
      unsubscribeMemories();
      unsubscribeChoices();
    };
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'giftSets'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const sets = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as GiftSet));
      setExistingGiftSets(sets);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'giftSets');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const cleanupOldResponses = async () => {
      try {
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        const q = query(collection(db, 'choiceResponses'), where('createdAt', '<', oneDayAgo.toISOString()));
        const oldResponses = await getDocs(q);
        
        if (!oldResponses.empty) {
          const batch = writeBatch(db);
          oldResponses.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
          console.log(`Cleaned up ${oldResponses.size} old choice responses.`);
        }
      } catch (error) {
        console.error('Error cleaning up old responses:', error);
      }
    };

    cleanupOldResponses();
  }, []);

  const [giftOptions, setGiftOptions] = useState([
    { title: '', image: null as File | null, isPrimary: true },
    { title: '', image: null as File | null, isPrimary: false },
    { title: '', image: null as File | null, isPrimary: false },
  ]);

  const updateDailyMessage = async () => {
    if (!dailyMsg) return;
    try {
      await setDoc(doc(db, 'messages', 'daily'), {
        dailyMessage: dailyMsg,
        updatedAt: new Date().toISOString()
      });
      toast.success('Daily message updated! 💌');
      setDailyMsg('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'messages/daily');
    }
  };

  const updateNextEvent = async () => {
    if (!eventName || !eventDate) return;
    try {
      await setDoc(doc(db, 'events', 'next'), {
        nextEvent: eventName,
        countdown: new Date(eventDate).toISOString()
      });
      toast.success('Event scheduled! 📅');
      setEventName('');
      setEventDate('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'events/next');
    }
  };

  const deleteNextEvent = async () => {
    try {
      await deleteDoc(doc(db, 'events', 'next'));
      toast.success('Event deleted! 🗑️');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'events/next');
    }
  };

  const uploadMemory = async () => {
    if (!memoryImage || !memoryCaption) return;
    
    // Check file size (limit to 5MB)
    if (memoryImage.size > 5 * 1024 * 1024) {
      toast.error('Image is too large (max 5MB)');
      return;
    }

    setIsUploading(true);
    console.log('Starting memory upload to ImgBB...', memoryImage.name);
    try {
      const url = await uploadToImgBB(memoryImage);
      console.log('ImgBB URL obtained:', url);

      await addDoc(collection(db, 'memories'), {
        weeklyMemory: memoryCaption,
        image: url,
        caption: memoryCaption,
        createdAt: new Date().toISOString()
      });

      toast.success('Memory uploaded! 📸');
      sendNotification('memory', 'New Memory Shared! 📸', memoryCaption);
      setMemoryCaption('');
      setMemoryImage(null);
    } catch (error) {
      console.error('Upload error details:', error);
      toast.error('Upload failed. Check console for details.');
      handleFirestoreError(error, OperationType.CREATE, 'memories');
    } finally {
      setIsUploading(false);
      console.log('Upload process finished.');
    }
  };

  const deleteMemory = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'memories', id));
      toast.success('Memory deleted! 🗑️');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `memories/${id}`);
    }
  };

  const createGiftSet = async () => {
    // Check all images first
    for (const opt of giftOptions) {
      if (opt.image && opt.image.size > 5 * 1024 * 1024) {
        toast.error(`Image for ${opt.title || 'gift'} is too large (max 5MB)`);
        return;
      }
    }

    setIsUploading(true);
    console.log('Starting gift set creation...');
    try {
      const uploadedOptions = await Promise.all(giftOptions.map(async (opt, i) => {
        let url = `https://picsum.photos/seed/gift${i}/400/400`;
        if (opt.image) {
          console.log(`Uploading gift image ${i + 1} to ImgBB:`, opt.image.name);
          url = await uploadToImgBB(opt.image);
          console.log(`Gift image ${i + 1} URL:`, url);
        }
        const isPrimary = opt.isPrimary || false;
        return { 
          title: opt.title || `Gift ${i + 1}`, 
          message: 'A special surprise!', 
          image: url,
          isPrimary: isPrimary
        };
      }));

      console.log('Final uploaded options:', uploadedOptions);
      console.log('All gift images processed. Saving to Firestore...');
      const docRef = await addDoc(collection(db, 'giftSets'), {
        option1: uploadedOptions[0],
        option2: uploadedOptions[1],
        option3: uploadedOptions[2],
        unlocked: false,
        createdAt: new Date().toISOString()
      });
      console.log('Gift set created with ID:', docRef.id);

      toast.success('Gift set created! 🎁');
      setShowGiftForm(false);
      setGiftOptions([
        { title: '', image: null, isPrimary: true },
        { title: '', image: null, isPrimary: false },
        { title: '', image: null, isPrimary: false },
      ]);
    } catch (error) {
      console.error('Gift set creation error:', error);
      toast.error('Gift set creation failed. Check console.');
      handleFirestoreError(error, OperationType.CREATE, 'giftSets');
    } finally {
      setIsUploading(false);
      console.log('Gift set creation process finished.');
    }
  };

  const deleteGiftSet = async (id: string) => {
    try {
      // In a real app we'd delete from storage too, but for now just firestore
      await updateDoc(doc(db, 'giftSets', id), { deleted: true });
      toast.success('Gift set removed');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `giftSets/${id}`);
    }
  };

  const createChoiceMoment = async () => {
    if (!choiceQuestion || choiceOptions.some(opt => !opt.label || !opt.response)) {
      toast.error('Please fill in all choice fields');
      return;
    }

    try {
      // Deactivate other moments first
      const q = query(collection(db, 'choiceMoments'));
      const activeMoments = await getDocs(q);
      await Promise.all(activeMoments.docs.map(d => updateDoc(d.ref, { active: false })));

      await addDoc(collection(db, 'choiceMoments'), {
        question: choiceQuestion,
        options: choiceOptions,
        active: true,
        createdAt: new Date().toISOString()
      });

      toast.success('Choice Moment activated! ✨');
      sendNotification('choice', 'New Choice Moment! ✨', choiceQuestion);
      setShowChoiceForm(false);
      setChoiceQuestion('');
      setChoiceOptions([
        { label: '', emoji: '🎬', response: '', reward: 5 },
        { label: '', emoji: '🌆', response: '', reward: 5 },
      ]);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'choiceMoments');
    }
  };

  const deleteChoiceMoment = async (id: string) => {
    try {
      // Cascading delete: delete all associated responses
      const q = query(collection(db, 'choiceResponses'), where('momentId', '==', id));
      const responses = await getDocs(q);
      
      const batch = writeBatch(db);
      responses.docs.forEach((doc) => batch.delete(doc.ref));
      batch.delete(doc(db, 'choiceMoments', id));
      
      await batch.commit();
      toast.success('Choice moment and responses deleted! 🗑️');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `choiceMoments/${id}`);
    }
  };

  const resetStats = async () => {
    setIsResetting(true);
    try {
      // 1. Reset global stats
      await updateDoc(doc(db, 'stats', 'global'), {
        totalStars: 0,
        giftsReceived: 0,
        lastGiftStarCount: 0
      });

      // 2. Clear unlocked gifts collection (in batches of 10 to stay under rules 'get' limit)
      const collectionSnap = await getDocs(collection(db, 'collection'));
      if (!collectionSnap.empty) {
        const chunks = [];
        for (let i = 0; i < collectionSnap.docs.length; i += 10) {
          chunks.push(collectionSnap.docs.slice(i, i + 10));
        }
        for (const chunk of chunks) {
          const batch = writeBatch(db);
          chunk.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }
      }

      // 3. Reset gift sets unlocked status
      const giftSetsSnap = await getDocs(collection(db, 'giftSets'));
      if (!giftSetsSnap.empty) {
        const batch = writeBatch(db);
        giftSetsSnap.docs.forEach((doc) => {
          batch.update(doc.ref, { 
            unlocked: false,
            unlockedAt: null 
          });
        });
        await batch.commit();
      }

      // 4. Clear choice responses
      const responsesSnap = await getDocs(collection(db, 'choiceResponses'));
      if (!responsesSnap.empty) {
        const chunks = [];
        for (let i = 0; i < responsesSnap.docs.length; i += 10) {
          chunks.push(responsesSnap.docs.slice(i, i + 10));
        }
        for (const chunk of chunks) {
          const batch = writeBatch(db);
          chunk.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }
      }

      // 5. Clear moods
      const moodsSnap = await getDocs(collection(db, 'moods'));
      if (!moodsSnap.empty) {
        const batch = writeBatch(db);
        moodsSnap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }

      toast.success('Everything reset successfully! 🔄');
      setShowResetConfirm(false);
    } catch (error: any) {
      console.error('Reset error:', error);
      toast.error('Reset failed: ' + (error.message || 'Unknown error'));
      handleFirestoreError(error, OperationType.UPDATE, 'stats/global');
    } finally {
      setIsResetting(false);
    }
  };

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle) return;

    try {
      await addDoc(collection(db, 'tasks'), {
        title: taskTitle,
        description: taskDesc,
        stars: taskStars,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      setTaskTitle('');
      setTaskDesc('');
      setTaskStars(5);
      setShowTaskForm(false);
      toast.success('Love Mission assigned! 🚀');
      sendNotification('mission', 'New Love Mission! 🚀', taskTitle);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tasks');
    }
  };

  const approveTask = async (taskId: string) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        status: 'approved_by_admin',
        approvedAt: new Date().toISOString()
      });
      toast.success('Task approved! User can now claim stars. ✨');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      toast.success('Task deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tasks/${taskId}`);
    }
  };

  const createBucketItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bucketTitle) return;

    try {
      await addDoc(collection(db, 'bucketList'), {
        title: bucketTitle,
        description: bucketDesc,
        status: 'todo',
        createdAt: new Date().toISOString()
      });
      setBucketTitle('');
      setBucketDesc('');
      setShowBucketForm(false);
      toast.success('Added to Bucket List! 🌍');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'bucketList');
    }
  };

  const completeBucketItem = async (itemId: string, title: string) => {
    if (!bucketImage) {
      toast.error('Please select a photo of the memory! 📸');
      return;
    }

    setIsUploading(true);
    try {
      const imageUrl = await uploadToImgBB(bucketImage);
      
      const batch = writeBatch(db);
      const completedAt = new Date().toISOString();

      // Update bucket item
      batch.update(doc(db, 'bucketList', itemId), {
        status: 'completed',
        image: imageUrl,
        completedAt: completedAt
      });

      // Create Memory automatically
      const memoryRef = doc(collection(db, 'memories'));
      batch.set(memoryRef, {
        weeklyMemory: `Bucket List Fulfilled: ${title}`,
        image: imageUrl,
        caption: `We finally did it! ${title} ❤️`,
        createdAt: completedAt
      });

      await batch.commit();
      
      setBucketImage(null);
      setIsCompletingBucketItem(null);
      toast.success('Bucket List item fulfilled and added to Memories! 🥂');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bucketList/${itemId}`);
    } finally {
      setIsUploading(false);
    }
  };

  const activateBucketItem = async (itemId: string) => {
    try {
      await updateDoc(doc(db, 'bucketList', itemId), {
        status: 'todo'
      });
      toast.success('Dream activated! ✨');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bucketList/${itemId}`);
    }
  };

  const deleteBucketItem = async (itemId: string) => {
    try {
      await deleteDoc(doc(db, 'bucketList', itemId));
      toast.success('Item removed from Bucket List');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `bucketList/${itemId}`);
    }
  };

  const getMoodIcon = (mood: string) => {
    switch (mood) {
      case 'happy': return <Smile className="text-yellow-500" />;
      case 'miss_you': return <HeartIcon className="text-pink-500 fill-pink-500" />;
      case 'upset': return <Frown className="text-blue-500" />;
      case 'tired': return <Moon className="text-gray-500" />;
      default: return <Smile />;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tighter">GAME MASTER</h1>
          <p className="text-slate-500 text-sm font-medium">Control the starfall</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowResetConfirm(true)}
            className="bg-red-50 text-red-500 p-3 rounded-2xl hover:bg-red-100 transition-colors"
            title="Reset All Stats"
          >
            <RotateCcw className="w-6 h-6" />
          </button>
          <div className="bg-primary/10 p-3 rounded-2xl">
            <Settings className="text-primary w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowResetConfirm(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm glass p-8 rounded-[2.5rem] space-y-6 text-center shadow-2xl border-2 border-white/20"
            >
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <RotateCcw className="w-10 h-10 text-red-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-slate-800 tracking-tighter">RESET EVERYTHING?</h2>
                <p className="text-sm text-slate-500 font-medium">
                  This will reset all stars, clear all unlocked gifts, and wipe all responses. This action is permanent.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={resetStats}
                  disabled={isResetting}
                  className="w-full bg-red-500 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-red-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isResetting ? (
                    <>
                      <RotateCcw className="w-4 h-4 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    'Yes, Reset All'
                  )}
                </button>
                <button 
                  onClick={() => setShowResetConfirm(false)}
                  className="w-full bg-slate-100 text-slate-500 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <StarReactor 
        totalStars={stats?.totalStars || 0} 
        giftsReceived={stats?.giftsReceived || 0} 
        lastGiftStarCount={stats?.lastGiftStarCount || 0}
        isAdmin={true} 
        isGiftReady={false}
      />

      {/* Mood Monitor */}
      <div className="glass rounded-3xl p-6 space-y-4">
        <div className="flex items-center gap-3 text-primary font-bold">
          <Smile className="w-5 h-5" />
          Mood Monitor
        </div>
        <div className="space-y-3">
          {userMoods.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No moods reported yet...</p>
          ) : (
            userMoods.map((m, i) => (
              <div key={i} className="flex items-center justify-between bg-white/30 p-3 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                    {getMoodIcon(m.mood)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-700">{m.userName}</div>
                    <div className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">
                      {new Date(m.updatedAt).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                <div className="text-xs font-black text-primary uppercase tracking-widest">
                  {m.mood.replace('_', ' ')}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Choice Responses Monitor */}
      <div className="glass rounded-3xl p-6 space-y-4">
        <div className="flex items-center gap-3 text-primary font-bold">
          <Sparkles className="w-5 h-5" />
          Choice Responses
        </div>
        <div className="space-y-3">
          {choiceResponses.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No responses yet...</p>
          ) : (
            choiceResponses.map((r, i) => (
              <div key={i} className="bg-white/30 p-4 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-slate-700">{r.userName}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">
                    {new Date(r.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-xs text-slate-500 italic">"{r.question}"</div>
                <div className="flex items-center gap-2 bg-white/50 p-2 rounded-xl">
                  <span className="text-lg">{r.choiceEmoji}</span>
                  <span className="text-xs font-bold text-primary uppercase tracking-widest">
                    {r.choiceLabel}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Love Missions Management */}
      <div className="glass rounded-3xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-primary font-bold">
            <Trophy className="w-5 h-5" />
            Love Missions
          </div>
          <button 
            onClick={() => setShowTaskForm(!showTaskForm)}
            className="p-2 bg-primary/10 rounded-xl text-primary hover:bg-primary/20 transition-all"
          >
            {showTaskForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>

        <AnimatePresence>
          {showTaskForm && (
            <motion.form 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={createTask}
              className="space-y-3 overflow-hidden"
            >
              <input 
                type="text" 
                placeholder="Mission Title (e.g., Eat before 10 AM)" 
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="w-full bg-white/50 border-2 border-transparent rounded-2xl px-4 py-3 outline-none focus:border-primary/30 text-sm font-medium"
              />
              <textarea 
                placeholder="Description" 
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                className="w-full bg-white/50 border-2 border-transparent rounded-2xl px-4 py-3 outline-none focus:border-primary/30 text-sm font-medium h-20 resize-none"
              />
              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center gap-2 bg-white/50 rounded-2xl px-4 py-3">
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  <input 
                    type="number" 
                    value={taskStars}
                    onChange={(e) => setTaskStars(parseInt(e.target.value))}
                    className="bg-transparent outline-none text-sm font-black w-full"
                  />
                </div>
                <button 
                  type="submit"
                  className="bg-primary text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20"
                >
                  Assign
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="space-y-3">
          {tasks.filter(t => t.status !== 'claimed').map((task) => (
            <div key={task.id} className="bg-white/30 p-4 rounded-2xl space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">{task.title}</h3>
                  <p className="text-[10px] text-slate-500 font-medium mt-1">{task.description}</p>
                </div>
                <button 
                  onClick={() => deleteTask(task.id)}
                  className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-yellow-400/10 text-yellow-600 px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1">
                    <Star className="w-3 h-3 fill-yellow-400" />
                    {task.stars}
                  </div>
                  <div className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest",
                    task.status === 'pending' ? "bg-slate-100 text-slate-400" :
                    task.status === 'completed_by_user' ? "bg-blue-100 text-blue-500 animate-pulse" :
                    "bg-green-100 text-green-500"
                  )}>
                    {task.status.replace(/_/g, ' ')}
                  </div>
                </div>

                {task.status === 'completed_by_user' && (
                  <button 
                    onClick={() => approveTask(task.id)}
                    className="bg-green-500 text-white px-3 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-green-500/20 flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Approve
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bucket List Management */}
      <div className="glass rounded-3xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-primary font-bold">
            <Plus className="w-5 h-5" />
            Bucket List
          </div>
          <button 
            onClick={() => setShowBucketForm(!showBucketForm)}
            className="p-2 bg-primary/10 rounded-xl text-primary hover:bg-primary/20 transition-all"
          >
            {showBucketForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>

        <AnimatePresence>
          {showBucketForm && (
            <motion.form 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={createBucketItem}
              className="space-y-3 overflow-hidden"
            >
              <input 
                type="text" 
                placeholder="Dream Title (e.g., Visit Paris)" 
                value={bucketTitle}
                onChange={(e) => setBucketTitle(e.target.value)}
                className="w-full bg-white/50 border-2 border-transparent rounded-2xl px-4 py-3 outline-none focus:border-primary/30 text-sm font-medium"
              />
              <textarea 
                placeholder="Description" 
                value={bucketDesc}
                onChange={(e) => setBucketDesc(e.target.value)}
                className="w-full bg-white/50 border-2 border-transparent rounded-2xl px-4 py-3 outline-none focus:border-primary/30 text-sm font-medium h-20 resize-none"
              />
              <button 
                type="submit"
                className="w-full bg-primary text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20"
              >
                Add to List
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="space-y-3">
          {bucketList.map((item) => (
            <div key={item.id} className="bg-white/30 p-4 rounded-2xl space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className={cn(
                    "text-sm font-black uppercase tracking-tight",
                    item.status === 'completed' ? "text-slate-400 line-through" : item.status === 'pending' ? "text-orange-500 italic" : "text-slate-800"
                  )}>
                    {item.title}
                    {item.status === 'pending' && <span className="ml-2 text-[8px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full not-italic">PROPOSED</span>}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium mt-1">{item.description}</p>
                </div>
                <div className="flex gap-1">
                  {item.status === 'pending' && (
                    <button 
                      onClick={() => activateBucketItem(item.id)}
                      className="p-2 text-orange-500 hover:bg-orange-50 transition-all rounded-xl"
                      title="Activate Dream"
                    >
                      <Sparkles className="w-4 h-4" />
                    </button>
                  )}
                  <button 
                    onClick={() => deleteBucketItem(item.id)}
                    className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {item.status === 'todo' && (
                <div className="pt-2">
                  {isCompletingBucketItem === item.id ? (
                    <div className="space-y-3 bg-white/50 p-3 rounded-xl border border-white">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">Complete Mission</span>
                        <button onClick={() => setIsCompletingBucketItem(null)}>
                          <X className="w-3 h-3 text-slate-400" />
                        </button>
                      </div>
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => setBucketImage(e.target.files?.[0] || null)}
                        className="hidden"
                        id={`bucket-img-${item.id}`}
                      />
                      <label 
                        htmlFor={`bucket-img-${item.id}`}
                        className="w-full aspect-video bg-white/50 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/30 transition-all overflow-hidden"
                      >
                        {bucketImage ? (
                          <img 
                            src={URL.createObjectURL(bucketImage)} 
                            className="w-full h-full object-cover" 
                            alt="Preview" 
                          />
                        ) : (
                          <>
                            <Camera className="w-6 h-6 text-slate-300" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Upload Photo</span>
                          </>
                        )}
                      </label>
                      <button 
                        onClick={() => completeBucketItem(item.id, item.title)}
                        disabled={isUploading || !bucketImage}
                        className="w-full bg-green-500 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-green-500/20 disabled:opacity-50"
                      >
                        {isUploading ? 'Uploading...' : 'Fulfill Dream'}
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setIsCompletingBucketItem(item.id)}
                      className="w-full py-3 bg-white/50 rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-white transition-all flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Mark as Fulfilled
                    </button>
                  )}
                </div>
              )}

              {item.status === 'completed' && (
                <div className="flex items-center gap-2 text-green-500">
                  <Sparkles className="w-3 h-3" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Fulfilled on {new Date(item.completedAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Daily Message */}
        <div className="glass rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-3 text-primary font-bold">
            <MessageSquare className="w-5 h-5" />
            Daily Message
          </div>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={dailyMsg}
              onChange={(e) => setDailyMsg(e.target.value)}
              placeholder="Type something sweet..."
              className="flex-1 bg-white/50 border-none rounded-xl px-4 py-3 focus:ring-2 ring-primary outline-none text-sm"
            />
            <button 
              onClick={updateDailyMessage}
              className="bg-primary text-white p-3 rounded-xl shadow-lg shadow-primary/20"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Next Event */}
        <div className="relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-secondary/20 opacity-50" />
          <div className="relative glass rounded-[2.5rem] p-8 space-y-6 border-2 border-white/40 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center shadow-inner">
                  <Calendar className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tighter text-slate-800">NEXT BIG EVENT</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Countdown to Magic</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {currentEvent && (
                  <button 
                    onClick={deleteNextEvent}
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all rounded-xl"
                    title="Delete current event"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                <motion.div 
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 4 }}
                  className="bg-white p-2 rounded-xl shadow-sm"
                >
                  <Clock className="w-5 h-5 text-primary" />
                </motion.div>
              </div>
            </div>

            {currentEvent && (
              <div className="bg-white/40 p-4 rounded-2xl border border-white/60">
                <div className="text-xs font-black text-primary uppercase tracking-widest mb-1">Current Scheduled Event:</div>
                <div className="text-sm font-bold text-slate-700">{currentEvent.nextEvent}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                  {new Date(currentEvent.countdown).toLocaleDateString()} at {new Date(currentEvent.countdown).toLocaleTimeString()}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Event Title</label>
                <input 
                  type="text" 
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="e.g. Anniversary"
                  className="w-full bg-white/60 border-2 border-transparent rounded-2xl px-5 py-4 outline-none focus:border-primary/30 focus:bg-white transition-all text-sm font-bold shadow-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Target Date</label>
                <input 
                  type="date" 
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full bg-white/60 border-2 border-transparent rounded-2xl px-5 py-4 outline-none focus:border-primary/30 focus:bg-white transition-all text-sm font-bold shadow-sm"
                />
              </div>
            </div>

            <button 
              onClick={updateNextEvent}
              className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-slate-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 group"
            >
              <span>Schedule Event</span>
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Memory Upload */}
        <div className="glass rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-3 text-primary font-bold">
            <ImageIcon className="w-5 h-5" />
            Memory of the Week
          </div>
          <div className="space-y-3">
            <input 
              type="file" 
              accept="image/*"
              onChange={(e) => setMemoryImage(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
            />
            <input 
              type="text" 
              value={memoryCaption}
              onChange={(e) => setMemoryCaption(e.target.value)}
              placeholder="Caption for this memory..."
              className="w-full bg-white/50 border-none rounded-xl px-4 py-3 focus:ring-2 ring-primary outline-none text-sm"
            />
            <button 
              onClick={uploadMemory}
              disabled={isUploading}
              className="w-full bg-primary text-white py-3 rounded-xl font-bold shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              {isUploading ? 'Uploading...' : 'Upload Memory'}
            </button>

            {memories.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Existing Memories</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {memories.map((m) => (
                    <div key={m.id} className="bg-white/30 p-2 rounded-2xl flex items-center gap-3 group">
                      <img src={m.image} className="w-10 h-10 rounded-lg object-cover" alt="" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold text-slate-700 truncate">{m.caption}</div>
                        <div className="text-[8px] text-slate-400 uppercase">{new Date(m.createdAt).toLocaleDateString()}</div>
                      </div>
                      <button 
                        onClick={() => deleteMemory(m.id)}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Gift Management */}
        <div className="glass rounded-3xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-primary font-bold">
              <Gift className="w-6 h-6" />
              <span className="text-xl tracking-tighter">GIFT MANAGEMENT</span>
            </div>
            <button 
              onClick={() => setShowGiftForm(true)}
              className="bg-primary text-white px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
            >
              + Create New
            </button>
          </div>
          
          <div className="space-y-4">
            {existingGiftSets.filter(s => !(s as any).deleted).length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-[2rem] bg-slate-50/50">
                <Gift className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No gift sets deployed</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {existingGiftSets.filter(s => !(s as any).deleted).map((set) => (
                  <div key={set.id} className="bg-white/40 border border-white/60 p-5 rounded-[2rem] flex items-center justify-between group hover:bg-white/60 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="relative w-14 h-14">
                        <img 
                          src={set.option1.isPrimary ? set.option1.image : set.option2.isPrimary ? set.option2.image : set.option3.image} 
                          className="w-full h-full object-cover rounded-2xl shadow-md"
                          alt="Gift"
                        />
                        <div className="absolute -top-2 -right-2 bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center shadow-lg">
                          <Sparkles className="w-3 h-3" />
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-800 uppercase tracking-tight">
                          {set.option1.isPrimary ? set.option1.title : set.option2.isPrimary ? set.option2.title : set.option3.title}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn(
                            "text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest",
                            set.unlocked ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"
                          )}>
                            {set.unlocked ? 'UNLOCKED' : 'ACTIVE'}
                          </span>
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                            {new Date(set.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => deleteGiftSet(set.id)}
                      className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all rounded-xl"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Choice Moments */}
        <div className="glass rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between text-primary font-bold">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5" />
              Choice Moments
            </div>
            {showChoiceForm && (
              <button onClick={() => setShowChoiceForm(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            )}
          </div>

          {!showChoiceForm ? (
            <button 
              onClick={() => setShowChoiceForm(true)}
              className="w-full py-4 border-2 border-dashed border-primary/30 rounded-2xl flex items-center justify-center gap-2 text-primary font-bold hover:bg-primary/5 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Activate Choice Moment
            </button>
          ) : (
            <div className="space-y-4">
              <input 
                type="text" 
                value={choiceQuestion}
                onChange={(e) => setChoiceQuestion(e.target.value)}
                placeholder="Question (e.g. What should we do today?)"
                className="w-full bg-white/50 border-none rounded-xl px-4 py-3 focus:ring-2 ring-primary outline-none text-sm"
              />
              <div className="space-y-3">
                {choiceOptions.map((opt, i) => (
                  <div key={i} className="bg-white/30 p-4 rounded-2xl space-y-2 relative group">
                    {choiceOptions.length > 2 && (
                      <button 
                        onClick={() => {
                          const newOpts = choiceOptions.filter((_, idx) => idx !== i);
                          setChoiceOptions(newOpts);
                        }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={opt.emoji}
                        onChange={(e) => {
                          const newOpts = [...choiceOptions];
                          newOpts[i].emoji = e.target.value;
                          setChoiceOptions(newOpts);
                        }}
                        placeholder="Emoji"
                        className="w-12 bg-white/50 border-none rounded-xl px-2 py-2 text-center text-sm outline-none"
                      />
                      <input 
                        type="text" 
                        value={opt.label}
                        onChange={(e) => {
                          const newOpts = [...choiceOptions];
                          newOpts[i].label = e.target.value;
                          setChoiceOptions(newOpts);
                        }}
                        placeholder="Option Label"
                        className="flex-1 bg-white/50 border-none rounded-xl px-4 py-2 text-sm outline-none"
                      />
                    </div>
                    <input 
                      type="text" 
                      value={opt.response}
                      onChange={(e) => {
                        const newOpts = [...choiceOptions];
                        newOpts[i].response = e.target.value;
                        setChoiceOptions(newOpts);
                      }}
                      placeholder="Response Message"
                      className="w-full bg-white/50 border-none rounded-xl px-4 py-2 text-sm outline-none"
                    />
                  </div>
                ))}
                
                {choiceOptions.length < 5 && (
                  <button 
                    onClick={() => setChoiceOptions([...choiceOptions, { label: '', emoji: '✨', response: '', reward: 5 }])}
                    className="w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs font-bold hover:bg-white/50 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-3 h-3" />
                    Add Another Option
                  </button>
                )}
              </div>
              <button 
                onClick={createChoiceMoment}
                className="w-full bg-primary text-white py-4 rounded-2xl font-bold shadow-lg shadow-primary/20"
              >
                Activate Moment
              </button>
            </div>
          )}

          {choiceMoments.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Choice Moments</div>
              <div className="space-y-2">
                {choiceMoments.map((m) => (
                  <div key={m.id} className="bg-white/30 p-3 rounded-2xl flex items-center justify-between group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {m.active && <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />}
                        <div className="text-xs font-bold text-slate-700 truncate">{m.question}</div>
                      </div>
                      <div className="text-[8px] text-slate-400 uppercase font-bold tracking-tighter">
                        {new Date(m.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button 
                      onClick={() => deleteChoiceMoment(m.id)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all rounded-xl"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Gift Creation Modal - Redesigned for Android/Mobile feel */}
      <AnimatePresence>
        {showGiftForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] bg-slate-950/40 backdrop-blur-sm flex items-end sm:items-center justify-center overflow-hidden"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="bg-white w-full h-[92vh] sm:h-auto sm:max-h-[90vh] sm:max-w-4xl rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Android-style Top App Bar */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-20">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setShowGiftForm(false)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-slate-600" />
                  </button>
                  <h2 className="text-xl font-bold text-slate-900">Create Gift Set</h2>
                </div>
                <button 
                  onClick={createGiftSet}
                  disabled={isUploading || giftOptions.some(o => !o.title)}
                  className="px-4 py-2 bg-primary text-white rounded-full text-sm font-bold shadow-md shadow-primary/20 disabled:opacity-50 active:scale-95 transition-all"
                >
                  {isUploading ? 'Saving...' : 'Save'}
                </button>
              </div>

              {/* Modal Body - Scrollable */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 pb-24">
                <div className="space-y-2">
                  <p className="text-xs font-bold text-primary uppercase tracking-widest">Triple Mystery Deployment</p>
                  <p className="text-sm text-slate-500">Configure three options for the mystery gift. One will be the primary surprise.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {giftOptions.map((opt, i) => (
                    <motion.div 
                      key={i} 
                      className={cn(
                        "relative p-5 rounded-3xl border-2 transition-all flex flex-col gap-4",
                        opt.isPrimary ? "bg-primary/5 border-primary shadow-sm" : "bg-slate-50 border-transparent"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-[10px] font-black">{i + 1}</span>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Option</span>
                        </div>
                        <button
                          onClick={() => {
                            const newOpts = giftOptions.map((o, idx) => ({
                              ...o,
                              isPrimary: idx === i
                            }));
                            setGiftOptions(newOpts);
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                            opt.isPrimary ? "bg-primary text-white" : "bg-white text-slate-400 border border-slate-200"
                          )}
                        >
                          {opt.isPrimary ? 'PRIMARY' : 'SET PRIMARY'}
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div 
                          className="relative aspect-square bg-white rounded-2xl border-2 border-dashed border-slate-200 overflow-hidden group cursor-pointer flex items-center justify-center"
                        >
                          {opt.image ? (
                            <img 
                              src={URL.createObjectURL(opt.image)} 
                              className="w-full h-full object-cover" 
                              alt="Preview" 
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-2 text-slate-300">
                              <ImageIcon className="w-8 h-8" />
                              <span className="text-[10px] font-black uppercase tracking-widest">Add Image</span>
                            </div>
                          )}
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={(e) => {
                              const newOpts = [...giftOptions];
                              newOpts[i].image = e.target.files?.[0] || null;
                              setGiftOptions(newOpts);
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Title</label>
                          <input 
                            type="text" 
                            value={opt.title}
                            onChange={(e) => {
                              const newOpts = [...giftOptions];
                              newOpts[i].title = e.target.value;
                              setGiftOptions(newOpts);
                            }}
                            placeholder="e.g. Secret Box"
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-primary transition-all"
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Bottom Action Bar - Mobile Only */}
              <div className="sm:hidden p-4 bg-white border-t border-slate-100 sticky bottom-0 z-20">
                <button 
                  onClick={createGiftSet}
                  disabled={isUploading || giftOptions.some(o => !o.title)}
                  className="w-full bg-slate-900 text-white py-4 rounded-2xl text-sm font-black tracking-widest uppercase shadow-xl disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  {isUploading ? (
                    <>
                      <Clock className="w-5 h-5 animate-spin" />
                      <span>SAVING...</span>
                    </>
                  ) : (
                    'DEPLOY GIFT SET'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
