import React, { useState, useEffect } from 'react';
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
  ChevronDown,
  ChevronRight,
  Zap,
  BarChart3
} from 'lucide-react';
import { 
  doc, 
  setDoc, 
  updateDoc, 
  collection, 
  addDoc, 
  onSnapshot,
  query,
  orderBy,
  limit,
  getDocs,
  deleteDoc
} from 'firebase/firestore';
import { db, storage, auth } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { GameStats, UserProfile, DailyMessage, NextEvent, UserMood, ChoiceResponse } from '../types';
import { toast } from 'sonner';
import StarReactor from './StarReactor';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';
import { Smile, Heart as HeartIcon, Frown, Moon, Sparkles } from 'lucide-react';

interface AdminPanelProps {
  stats: GameStats | null;
  profile: UserProfile | null;
  onNavigateToGifts?: () => void;
}

interface EventItem extends NextEvent {
  id?: string;
}

interface GiftSetItem {
  id: string;
  option1: { title: string; message: string; image: string };
  option2: { title: string; message: string; image: string };
  option3: { title: string; message: string; image: string };
  unlocked: boolean;
  primary?: boolean;
  createdAt: string;
}

export default function AdminPanel({ stats, profile, onNavigateToGifts }: AdminPanelProps) {
  const [dailyMsg, setDailyMsg] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [userMoods, setUserMoods] = useState<UserMood[]>([]);
  const [choiceResponses, setChoiceResponses] = useState<ChoiceResponse[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [expandedSection, setExpandedSection] = useState<string>('');
  const [giftSets, setGiftSets] = useState<GiftSetItem[]>([]);
  const [primaryGiftId, setPrimaryGiftId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeMoods = onSnapshot(collection(db, 'moods'), (snap) => {
      const moods = snap.docs.map(doc => doc.data() as UserMood);
      setUserMoods(moods);
    });

    const unsubscribeResponses = onSnapshot(
      query(collection(db, 'choiceResponses'), orderBy('createdAt', 'desc'), limit(10)),
      (snap) => {
        const responses = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChoiceResponse));
        setChoiceResponses(responses);
      }
    );

    const unsubscribeEvents = onSnapshot(
      query(collection(db, 'events'), orderBy('createdAt', 'desc')),
      (snap) => {
        const eventList = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as EventItem));
        setEvents(eventList);
      }
    );

    const unsubscribeGifts = onSnapshot(
      collection(db, 'giftSets'),
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

    return () => {
      unsubscribeMoods();
      unsubscribeResponses();
      unsubscribeEvents();
      unsubscribeGifts();
    };
  }, []);
  const [giftOptions, setGiftOptions] = useState([
    { title: '', message: '', image: null as File | null },
    { title: '', message: '', image: null as File | null },
    { title: '', message: '', image: null as File | null },
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
      await addDoc(collection(db, 'events'), {
        nextEvent: eventName,
        countdown: new Date(eventDate).toISOString(),
        createdAt: new Date().toISOString()
      });
      toast.success('Event scheduled! 📅');
      setEventName('');
      setEventDate('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'events');
    }
  };

  const deleteEvent = async (eventId: string) => {
    try {
      await deleteDoc(doc(db, 'events', eventId));
      toast.success('Event deleted! 🗑️');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'events');
      toast.error('Failed to delete event');
    }
  };

  const setPrimaryGift = async (giftId: string) => {
    try {
      // Remove primary from all gifts
      await Promise.all(
        giftSets.map(gift =>
          updateDoc(doc(db, 'giftSets', gift.id), { primary: gift.id === giftId })
        )
      );
      toast.success('Primary gift set! 🎁');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'giftSets');
      toast.error('Failed to set primary gift');
    }
  };

  const adjustStars = async (change: number) => {
    if (!auth.currentUser) {
      toast.error('User not found');
      return;
    }

    try {
      const currentStars = stats?.totalStars || 0;
      const newStars = Math.max(0, currentStars + change);
      
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        totalStars: newStars
      });

      toast.success(`Stars ${change > 0 ? 'added' : 'reduced'}! ✨ (${newStars} total)`);
      setStarAdjustment(0);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users');
      toast.error('Failed to adjust stars');
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
    console.log('Starting memory upload...', memoryImage.name);
    try {
      const storageRef = ref(storage, `memories/${Date.now()}_${memoryImage.name}`);
      console.log('Storage ref created:', storageRef.fullPath);
      
      const uploadTask = uploadBytesResumable(storageRef, memoryImage);

      await new Promise((resolve, reject) => {
        uploadTask.on('state_changed', 
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log('Upload is ' + progress + '% done');
          }, 
          (error) => {
            console.error('Upload task failed:', error);
            reject(error);
          }, 
          () => {
            console.log('Upload task completed successfully');
            resolve(null);
          }
        );
      });
      
      const url = await getDownloadURL(storageRef);
      console.log('Download URL obtained:', url);

      await addDoc(collection(db, 'memories'), {
        weeklyMemory: memoryCaption,
        image: url,
        caption: memoryCaption,
        createdAt: new Date().toISOString()
      });

      toast.success('Memory uploaded! 📸');
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
          console.log(`Uploading gift image ${i + 1}:`, opt.image.name);
          const storageRef = ref(storage, `gifts/${Date.now()}_${opt.image.name}`);
          
          const uploadTask = uploadBytesResumable(storageRef, opt.image);

          await new Promise((resolve, reject) => {
            uploadTask.on('state_changed', 
              (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log(`Gift ${i + 1} upload is ${progress}% done`);
              }, 
              (error) => {
                console.error(`Gift ${i + 1} upload failed:`, error);
                reject(error);
              }, 
              () => {
                console.log(`Gift ${i + 1} upload completed`);
                resolve(null);
              }
            );
          });

          url = await getDownloadURL(storageRef);
          console.log(`Gift image ${i + 1} URL:`, url);
        }
        return { title: opt.title || `Gift ${i + 1}`, message: opt.message || 'A special surprise!', image: url };
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
        { title: '', message: '', image: null },
        { title: '', message: '', image: null },
        { title: '', message: '', image: null },
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
      setShowChoiceForm(false);
      setChoiceQuestion('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'choiceMoments');
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
    <div className="space-y-3 pb-6">
      {/* HEADER */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-primary to-secondary text-white rounded-2xl p-5"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">⚡ ADMIN</h1>
            <p className="text-xs text-white/70 font-bold">Control Center</p>
          </div>
          <Settings className="w-7 h-7" />
        </div>
      </motion.div>

      {/* STARS SECTION */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="glass rounded-2xl p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-bold text-primary uppercase">Stars</label>
          <div className="text-2xl font-black text-primary">{stats?.totalStars || 0}⭐</div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => adjustStars(-5)}
            className="bg-red-500/20 hover:bg-red-500/40 text-red-600 font-bold py-2 rounded-lg text-xs transition-colors active:scale-95"
          >
            -5
          </button>
          <button
            onClick={() => adjustStars(-1)}
            className="bg-orange-500/20 hover:bg-orange-500/40 text-orange-600 font-bold py-2 rounded-lg text-xs transition-colors active:scale-95"
          >
            -1
          </button>
          <button
            onClick={() => adjustStars(5)}
            className="bg-green-500/20 hover:bg-green-500/40 text-green-600 font-bold py-2 rounded-lg text-xs transition-colors active:scale-95"
          >
            +5
          </button>
          <button
            onClick={() => adjustStars(25)}
            className="bg-primary/20 hover:bg-primary/40 text-primary font-bold py-2 rounded-lg text-xs transition-colors active:scale-95"
          >
            +25
          </button>
        </div>
      </motion.div>

      {/* DAILY MESSAGE SECTION */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-2xl p-4"
      >
        <label className="text-xs font-bold text-primary mb-2 uppercase block">Daily Message 💌</label>
        <input 
          type="text" 
          value={dailyMsg}
          onChange={(e) => setDailyMsg(e.target.value)}
          placeholder="Type a message..."
          maxLength={100}
          className="w-full bg-white/50 border-none rounded-lg px-3 py-2 text-xs font-medium mb-2 focus:ring-2 ring-primary outline-none"
        />
        <button 
          onClick={updateDailyMessage}
          className="w-full bg-primary hover:bg-primary/90 text-white py-2 rounded-lg font-bold text-xs transition-colors active:scale-95"
        >
          Send
        </button>
      </motion.div>

      {/* EVENTS SECTION */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="glass rounded-2xl p-4"
      >
        <label className="text-xs font-bold text-primary mb-3 uppercase block">Events 📅</label>
        
        <div className="space-y-2 mb-3">
          <input 
            type="text" 
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder="Event name"
            className="w-full bg-white/50 border-none rounded-lg px-3 py-2 text-xs focus:ring-2 ring-primary outline-none"
          />
          <input 
            type="datetime-local" 
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="w-full bg-white/50 border-none rounded-lg px-3 py-2 text-xs focus:ring-2 ring-primary outline-none"
          />
          <button 
            onClick={updateNextEvent}
            className="w-full bg-primary hover:bg-primary/90 text-white py-2 rounded-lg font-bold text-xs transition-colors active:scale-95"
          >
            Add Event
          </button>
        </div>

        {/* Events List */}
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {events.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">No events</p>
          ) : (
            events.map((evt) => (
              <motion.div
                key={evt.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between bg-white/30 p-2 rounded-lg group hover:bg-white/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-800 text-xs truncate">{evt.nextEvent}</div>
                  <div className="text-[10px] text-slate-500">{new Date(evt.countdown).toLocaleDateString()}</div>
                </div>
                <button
                  onClick={() => evt.id && deleteEvent(evt.id)}
                  className="ml-2 px-2 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-600 rounded text-xs transition-all"
                >
                  🗑️
                </button>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>

      {/* PRIMARY GIFT DISPLAY */}
      {giftSets.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-2xl p-4 border-2 border-primary/30"
        >
          <label className="text-xs font-bold text-primary mb-3 uppercase block">⭐ Primary Gift</label>
          <div className="space-y-2">
            {giftSets.map((gift) => (
              <motion.button
                key={gift.id}
                onClick={() => setPrimaryGift(gift.id)}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "w-full p-3 rounded-lg text-left transition-all text-xs font-bold",
                  primaryGiftId === gift.id
                    ? "bg-primary/30 border-2 border-primary text-primary"
                    : "bg-white/20 border-2 border-transparent hover:bg-white/30"
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div>{gift.option1.title}</div>
                    <div className="text-[10px] opacity-70">Set on {new Date(gift.createdAt).toLocaleDateString()}</div>
                  </div>
                  {primaryGiftId === gift.id && <div className="text-lg">✓</div>}
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* GIFT MANAGEMENT LINK */}
      <motion.button
        onClick={onNavigateToGifts}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="w-full glass rounded-2xl p-4 text-primary font-bold text-sm active:scale-95 transition-transform flex items-center justify-between hover:bg-white/5"
      >
        <span>🎁 Manage Gifts</span>
        <ChevronRight className="w-4 h-4" />
      </motion.button>
    </div>
  );
}
