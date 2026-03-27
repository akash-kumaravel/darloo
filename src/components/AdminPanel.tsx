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
  ChevronRight,
  Sparkles,
  Star
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
  where,
  increment,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { GameStats, UserProfile, DailyMessage, NextEvent, UserMood, ChoiceResponse, GiftSet } from '../types';
import { toast } from 'sonner';
import StarReactor from './StarReactor';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';
import { uploadToImgbb } from '../lib/imgbb-upload';
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
  const [rewardedResponses, setRewardedResponses] = useState<Set<string>>(new Set());

  // Choice Moment Form State
  const [choiceQuestion, setChoiceQuestion] = useState('');
  const [choiceOptions, setChoiceOptions] = useState([
    { label: '', emoji: '🎬', response: '', reward: 5 },
    { label: '', emoji: '🌆', response: '', reward: 5 },
    { label: '', emoji: '🏡', response: '', reward: 5 },
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
        // Track which responses have been rewarded
        const rewarded = new Set(
          responses.filter(r => r.rewarded).map(r => r.id)
        );
        setRewardedResponses(rewarded);
      }
    );

    return () => {
      unsubscribeMoods();
      unsubscribeResponses();
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

  const [giftOptions, setGiftOptions] = useState([
    { title: '', message: '', image: null as File | null, isPrimary: true },
    { title: '', message: '', image: null as File | null, isPrimary: false },
    { title: '', message: '', image: null as File | null, isPrimary: false },
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

  const uploadMemory = async () => {
    if (!memoryImage || !memoryCaption) return;
    
    // Check file size (limit to 10MB for Imgbb)
    if (memoryImage.size > 10 * 1024 * 1024) {
      toast.error('Image is too large (max 10MB)');
      return;
    }

    setIsUploading(true);
    console.log('Starting memory upload to Imgbb...', memoryImage.name);
    try {
      const imageUrl = await uploadToImgbb(memoryImage);
      console.log('Image URL obtained:', imageUrl);

      await addDoc(collection(db, 'memories'), {
        weeklyMemory: memoryCaption,
        image: imageUrl,
        caption: memoryCaption,
        createdAt: new Date().toISOString()
      });

      toast.success('Memory uploaded! 📸');
      setMemoryCaption('');
      setMemoryImage(null);
    } catch (error) {
      console.error('Upload error details:', error);
      toast.error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}. Check browser console.`);
      handleFirestoreError(error, OperationType.CREATE, 'memories');
    } finally {
      setIsUploading(false);
      console.log('Upload process finished.');
    }
  };

  const createGiftSet = async () => {
    // Check all images first
    for (const opt of giftOptions) {
      if (!opt.image) {
        toast.error(`Please select an image for ${opt.title || 'gift'}`);
        return;
      }
      if (opt.image.size > 10 * 1024 * 1024) {
        toast.error(`Image for ${opt.title || 'gift'} is too large (max 10MB)`);
        return;
      }
    }

    setIsUploading(true);
    console.log('Starting gift set creation...');
    try {
      const uploadedOptions = await Promise.all(giftOptions.map(async (opt, i) => {
        if (!opt.image) {
          throw new Error(`Image ${i + 1} is missing. All gifts must have images.`);
        }

        console.log(`Uploading gift image ${i + 1}:`, opt.image.name);
        const imageUrl = await uploadToImgbb(opt.image);
        console.log(`Gift image ${i + 1} URL:`, imageUrl);
        
        const isPrimary = opt.isPrimary || false;
        return { 
          title: opt.title || `Gift ${i + 1}`, 
          message: opt.message || 'A special surprise!', 
          image: imageUrl,
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
        { title: '', message: '', image: null, isPrimary: true },
        { title: '', message: '', image: null, isPrimary: false },
        { title: '', message: '', image: null, isPrimary: false },
      ]);
    } catch (error) {
      console.error('Gift set creation error:', error);
      toast.error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}. Check browser console.`);
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

  const rewardChoiceResponse = async (response: ChoiceResponse) => {
    if (rewardedResponses.has(response.id)) {
      toast.error('Already rewarded this choice');
      return;
    }

    try {
      // Award 1 star to the user's stats
      const statsRef = doc(db, 'stats', 'global');
      await updateDoc(statsRef, {
        totalStars: increment(1),
        xp: increment(10)
      });

      // Mark the response as rewarded in Firestore
      await updateDoc(doc(db, 'choiceResponses', response.id), {
        rewarded: true
      });

      // Mark the response as rewarded in local state
      setRewardedResponses(prev => new Set([...prev, response.id]));
      toast.success(`${response.userName}'s choice rewarded! +1 Star ⭐`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'stats/global');
    }
  };

  const resetAllStats = async () => {
    if (!confirm('⚠️ This will reset ALL stars and gifts to 0! Are you sure?')) {
      return;
    }

    try {
      const statsRef = doc(db, 'stats', 'global');
      await updateDoc(statsRef, {
        totalStars: 0,
        giftsReceived: 0,
        lastGiftStarCount: 0
      });
      toast.success('All stats reset! 🔄');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'stats/global');
    }
  };

  const deleteChoiceResponse = async (response: ChoiceResponse) => {
    if (!confirm(`Delete "${response.choiceLabel}" response from ${response.userName}? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'choiceResponses', response.id));
      // Remove from local rewarded set
      setRewardedResponses(prev => {
        const newSet = new Set(prev);
        newSet.delete(response.id);
        return newSet;
      });
      toast.success('Response deleted! 🗑️');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'choiceResponses');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tighter">GAME MASTER</h1>
          <p className="text-slate-500 text-sm font-medium">Control the starfall</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={resetAllStats}
          className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-600 px-4 py-2 rounded-2xl transition-all font-bold text-sm uppercase tracking-widest"
        >
          <Settings className="w-5 h-5" />
          Reset Stats
        </motion.button>
      </div>

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
                  <div>
                    <span className="text-sm font-black text-slate-700">{r.userName}</span>
                    <span className="text-[10px] text-slate-400 font-bold ml-1">(ID: {r.userId.slice(0, 8)}...)</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">
                    {new Date(r.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-xs text-slate-500 italic">"{r.question}"</div>
                <div className="flex items-center justify-between bg-white/50 p-3 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{r.choiceEmoji}</span>
                    <span className="text-xs font-bold text-primary uppercase tracking-widest">
                      {r.choiceLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => rewardChoiceResponse(r)}
                      disabled={rewardedResponses.has(r.id)}
                      className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold uppercase transition-all ${
                        rewardedResponses.has(r.id)
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 shadow-sm'
                      }`}
                    >
                      <Star className="w-4 h-4" />
                      Add Star
                    </button>
                    <button
                      onClick={() => deleteChoiceResponse(r)}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold uppercase transition-all bg-red-100 text-red-700 hover:bg-red-200 shadow-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
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
              <motion.div 
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ repeat: Infinity, duration: 4 }}
                className="bg-white p-2 rounded-xl shadow-sm"
              >
                <Clock className="w-5 h-5 text-primary" />
              </motion.div>
            </div>

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
                  <div key={i} className="bg-white/30 p-4 rounded-2xl space-y-2">
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
              </div>
              <button 
                onClick={createChoiceMoment}
                className="w-full bg-primary text-white py-4 rounded-2xl font-bold shadow-lg shadow-primary/20"
              >
                Activate Moment
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Gift Creation Modal - Moved to root for better stacking context */}
      <AnimatePresence>
        {showGiftForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-2xl flex items-start justify-center p-4 overflow-y-auto pt-12"
          >
            <motion.div
              initial={{ scale: 0.9, y: 100, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 100, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-white/90 backdrop-blur-md rounded-[4rem] w-full max-w-5xl shadow-[0_0_100px_rgba(0,0,0,0.2)] border-[12px] border-white relative mb-24 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-12 bg-gradient-to-br from-slate-50 to-white border-b border-slate-100 relative">
                <div className="absolute top-12 right-12">
                  <button 
                    onClick={() => setShowGiftForm(false)}
                    className="bg-slate-900 text-white p-5 rounded-full shadow-2xl hover:scale-110 active:scale-90 transition-all group"
                  >
                    <X className="w-8 h-8 group-hover:rotate-90 transition-transform duration-500" />
                  </button>
                </div>

                <div className="flex items-center gap-8">
                  <div className="w-24 h-24 bg-primary rounded-[2rem] flex items-center justify-center shadow-[0_20px_40px_rgba(255,77,109,0.3)] rotate-3">
                    <Gift className="w-12 h-12 text-white" />
                  </div>
                  <div>
                    <h2 className="text-5xl font-black tracking-tighter text-slate-900 leading-none">NEW GIFT SET</h2>
                    <p className="text-sm font-black text-primary uppercase tracking-[0.5em] mt-3">Triple Mystery Deployment</p>
                  </div>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-12 space-y-12">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {giftOptions.map((opt, i) => (
                    <motion.div 
                      key={i} 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className={cn(
                        "relative p-8 rounded-[3.5rem] border-4 transition-all duration-700 flex flex-col gap-8",
                        opt.isPrimary ? "bg-primary/5 border-primary shadow-2xl shadow-primary/10" : "bg-slate-50/50 border-transparent hover:bg-slate-100/50"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center text-xs font-black">{i + 1}</span>
                          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Option</span>
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
                            "px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest transition-all",
                            opt.isPrimary ? "bg-primary text-white shadow-xl shadow-primary/30" : "bg-white text-slate-400 hover:text-primary shadow-md"
                          )}
                        >
                          {opt.isPrimary ? 'PRIMARY' : 'SELECT'}
                        </button>
                      </div>

                      <div className="space-y-6">
                        <div className="relative aspect-square bg-white rounded-[2.5rem] border-4 border-dashed border-slate-200 overflow-hidden group cursor-pointer shadow-inner">
                          {opt.image ? (
                            <img 
                              src={URL.createObjectURL(opt.image)} 
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                              alt="Preview" 
                            />
                          ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-300 group-hover:text-primary transition-colors">
                              <ImageIcon className="w-12 h-12" />
                              <span className="text-xs font-black uppercase tracking-widest">Add Visual</span>
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

                        <div className="space-y-4">
                          <input 
                            type="text" 
                            value={opt.title}
                            onChange={(e) => {
                              const newOpts = [...giftOptions];
                              newOpts[i].title = e.target.value;
                              setGiftOptions(newOpts);
                            }}
                            placeholder="Gift Title"
                            className="w-full bg-white border-2 border-transparent rounded-2xl px-6 py-4 text-sm font-black outline-none shadow-sm focus:border-primary/30 focus:shadow-xl transition-all"
                          />
                          <textarea 
                            value={opt.message}
                            onChange={(e) => {
                              const newOpts = [...giftOptions];
                              newOpts[i].message = e.target.value;
                              setGiftOptions(newOpts);
                            }}
                            placeholder="Write a sweet message..."
                            className="w-full bg-white border-2 border-transparent rounded-2xl px-6 py-4 text-sm font-medium outline-none shadow-sm focus:border-primary/30 focus:shadow-xl transition-all resize-none h-32"
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="pt-8">
                  <button 
                    onClick={createGiftSet}
                    disabled={isUploading || giftOptions.some(o => !o.title || !o.message)}
                    className="w-full bg-slate-900 text-white py-8 rounded-[3rem] text-xl font-black tracking-[0.5em] uppercase shadow-[0_30px_60px_rgba(15,23,42,0.3)] disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] transition-all relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-white/20 to-primary/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                    {isUploading ? (
                      <div className="flex items-center justify-center gap-6">
                        <Clock className="w-8 h-8 animate-spin" />
                        <span>INITIATING MAGIC...</span>
                      </div>
                    ) : (
                      'DEPLOY GIFT SET'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
