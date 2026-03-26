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
}

interface EventItem extends NextEvent {
  id?: string;
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
  const [events, setEvents] = useState<EventItem[]>([]);
  const [starAdjustment, setStarAdjustment] = useState(0);
  const [expandedSection, setExpandedSection] = useState<string>('');

  // Choice Moment Form State
  const [choiceQuestion, setChoiceQuestion] = useState('');
  const [choiceOptions, setChoiceOptions] = useState([
    { label: '', emoji: '🎬', response: '', reward: 5 },
    { label: '', emoji: '🌆', response: '', reward: 5 },
    { label: '', emoji: '🏡', response: '', reward: 5 },
  ]);

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

    return () => {
      unsubscribeMoods();
      unsubscribeResponses();
      unsubscribeEvents();
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
    <div className="space-y-4 pb-6">
      {/* ADMIN HEADER */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-primary to-secondary text-white rounded-3xl p-6"
      >
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-black tracking-tighter">⚡ GAME MASTER</h1>
            <p className="text-sm text-white/80 font-bold">Full control over Loveverse</p>
          </div>
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
            <Settings className="w-7 h-7" />
          </div>
        </div>
      </motion.div>

      {/* STAR MONITOR & CONTROL */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-3xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-primary font-bold text-lg">
            <Zap className="w-6 h-6" />
            Star Control
          </div>
          <div className="text-3xl font-black text-primary">{stats?.totalStars || 0} ⭐</div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => adjustStars(-5)}
            className="flex-1 bg-red-500/20 hover:bg-red-500/40 text-red-600 font-black py-3 rounded-xl transition-colors active:scale-95"
          >
            - 5 Stars
          </button>
          <button
            onClick={() => adjustStars(-1)}
            className="flex-1 bg-orange-500/20 hover:bg-orange-500/40 text-orange-600 font-black py-3 rounded-xl transition-colors active:scale-95"
          >
            - 1 Star
          </button>
          <button
            onClick={() => adjustStars(5)}
            className="flex-1 bg-green-500/20 hover:bg-green-500/40 text-green-600 font-black py-3 rounded-xl transition-colors active:scale-95"
          >
            + 5 Stars
          </button>
          <button
            onClick={() => adjustStars(25)}
            className="flex-1 bg-primary/20 hover:bg-primary/40 text-primary font-black py-3 rounded-xl transition-colors active:scale-95"
          >
            + 25 Stars
          </button>
        </div>
      </motion.div>

      {/* EVENTS MANAGEMENT */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="glass rounded-3xl overflow-hidden"
      >
        <motion.button
          onClick={() => setExpandedSection(expandedSection === 'events' ? '' : 'events')}
          className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3 text-primary font-bold text-lg">
            <Calendar className="w-6 h-6" />
            Events Management
          </div>
          <motion.div
            animate={{ rotate: expandedSection === 'events' ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <ChevronDown className="w-5 h-5 text-primary" />
          </motion.div>
        </motion.button>

        <AnimatePresence>
          {expandedSection === 'events' && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden border-t border-white/10"
            >
              <div className="p-6 space-y-4">
                {/* Create Event Form */}
                <div className="space-y-3 pb-4 border-b border-white/10">
                  <div className="text-sm font-bold text-primary uppercase tracking-widest">Create New Event</div>
                  <input 
                    type="text" 
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="Event Name"
                    className="w-full bg-white/50 border-none rounded-2xl px-4 py-3 focus:ring-2 ring-primary outline-none text-sm font-medium"
                  />
                  <input 
                    type="datetime-local" 
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full bg-white/50 border-none rounded-2xl px-4 py-3 focus:ring-2 ring-primary outline-none text-sm"
                  />
                  <button 
                    onClick={updateNextEvent}
                    className="w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-2xl font-black transition-colors active:scale-95"
                  >
                    + Schedule Event
                  </button>
                </div>

                {/* Events List */}
                <div className="space-y-2">
                  <div className="text-sm font-bold text-slate-500 uppercase tracking-widest">Active Events</div>
                  {events.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-3">No events scheduled</p>
                  ) : (
                    events.map((evt, idx) => (
                      <motion.div
                        key={evt.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ delay: idx * 0.05 }}
                        className="flex items-center justify-between bg-white/30 p-4 rounded-2xl group hover:bg-white/40 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-slate-800 truncate">{evt.nextEvent}</div>
                          <div className="text-xs text-slate-500 mt-1">
                            {new Date(evt.countdown).toLocaleDateString()} {new Date(evt.countdown).toLocaleTimeString()}
                          </div>
                        </div>
                        <button
                          onClick={() => evt.id && deleteEvent(evt.id)}
                          className="ml-3 p-2 bg-red-500/20 hover:bg-red-500/40 text-red-600 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
                          title="Delete event"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* MESSAGING & CONTENT */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="glass rounded-3xl overflow-hidden"
      >
        <motion.button
          onClick={() => setExpandedSection(expandedSection === 'messaging' ? '' : 'messaging')}
          className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3 text-primary font-bold text-lg">
            <MessageSquare className="w-6 h-6" />
            Messaging & Content
          </div>
          <motion.div
            animate={{ rotate: expandedSection === 'messaging' ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <ChevronDown className="w-5 h-5 text-primary" />
          </motion.div>
        </motion.button>

        <AnimatePresence>
          {expandedSection === 'messaging' && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden border-t border-white/10"
            >
              <div className="p-6 space-y-4 border-b border-white/10">
                <div className="text-sm font-bold text-slate-500 uppercase tracking-widest">Daily Message</div>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={dailyMsg}
                    onChange={(e) => setDailyMsg(e.target.value)}
                    placeholder="Type something sweet..."
                    className="flex-1 bg-white/50 border-none rounded-2xl px-4 py-3 focus:ring-2 ring-primary outline-none text-sm"
                  />
                  <button 
                    onClick={updateDailyMessage}
                    className="bg-primary hover:bg-primary/90 text-white p-3 rounded-2xl shadow-lg shadow-primary/20"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="text-sm font-bold text-slate-500 uppercase tracking-widest">Memory of the Week</div>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => setMemoryImage(e.target.files?.[0] || null)}
                  className="w-full text-xs file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-primary/20 file:text-primary hover:file:bg-primary/30 cursor-pointer"
                />
                <input 
                  type="text" 
                  value={memoryCaption}
                  onChange={(e) => setMemoryCaption(e.target.value)}
                  placeholder="Memory caption..."
                  className="w-full bg-white/50 border-none rounded-2xl px-4 py-3 focus:ring-2 ring-primary outline-none text-sm"
                />
                <button 
                  onClick={uploadMemory}
                  disabled={isUploading}
                  className="w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-2xl font-bold disabled:opacity-50 transition-colors active:scale-95"
                >
                  {isUploading ? '⏳ Uploading...' : '📤 Upload Memory'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* MONITORING */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="glass rounded-3xl overflow-hidden"
      >
        <motion.button
          onClick={() => setExpandedSection(expandedSection === 'monitoring' ? '' : 'monitoring')}
          className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3 text-primary font-bold text-lg">
            <BarChart3 className="w-6 h-6" />
            Mood & Response Monitor
          </div>
          <motion.div
            animate={{ rotate: expandedSection === 'monitoring' ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <ChevronDown className="w-5 h-5 text-primary" />
          </motion.div>
        </motion.button>

        <AnimatePresence>
          {expandedSection === 'monitoring' && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden border-t border-white/10"
            >
              <div className="p-6 space-y-6">
                {/* Mood Monitor */}
                <div className="space-y-3">
                  <div className="text-sm font-bold text-slate-500 uppercase tracking-widest">Recent Moods</div>
                  {userMoods.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-3">No moods reported yet</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {userMoods.map((m, i) => (
                        <div key={i} className="flex items-center justify-between bg-white/30 p-3 rounded-2xl">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm shrink-0">
                              {getMoodIcon(m.mood)}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-700 truncate">{m.userName}</div>
                              <div className="text-[9px] text-slate-400">{new Date(m.updatedAt).toLocaleTimeString()}</div>
                            </div>
                          </div>
                          <div className="text-[9px] font-black text-primary uppercase tracking-widest shrink-0">
                            {m.mood.replace('_', ' ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Choice Responses */}
                <div className="border-t border-white/10 pt-4 space-y-3">
                  <div className="text-sm font-bold text-slate-500 uppercase tracking-widest">Choice Responses</div>
                  {choiceResponses.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-3">No responses yet</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {choiceResponses.map((r, i) => (
                        <div key={i} className="bg-white/20 p-3 rounded-2xl space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700">{r.userName}</span>
                            <span className="text-[9px] text-slate-400">{new Date(r.createdAt).toLocaleTimeString()}</span>
                          </div>
                          <div className="flex items-center gap-2 bg-white/40 p-2 rounded-xl">
                            <span className="text-base">{r.choiceEmoji}</span>
                            <span className="text-[9px] font-bold text-primary uppercase">{r.choiceLabel}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* GIFT MANAGEMENT */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="glass rounded-3xl overflow-hidden"
      >
        <motion.button
          onClick={() => setExpandedSection(expandedSection === 'gifts' ? '' : 'gifts')}
          className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3 text-primary font-bold text-lg">
            <Gift className="w-6 h-6" />
            Gift Management
          </div>
          <motion.div
            animate={{ rotate: expandedSection === 'gifts' ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <ChevronDown className="w-5 h-5 text-primary" />
          </motion.div>
        </motion.button>

        <AnimatePresence>
          {expandedSection === 'gifts' && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden border-t border-white/10"
            >
              <div className="p-6 space-y-4">
                {!showGiftForm ? (
                  <button 
                    onClick={() => setShowGiftForm(true)}
                    className="w-full py-4 border-2 border-dashed border-primary/30 rounded-2xl flex items-center justify-center gap-2 text-primary font-bold hover:bg-primary/5 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    Create New Gift Set
                  </button>
                ) : (
                  <div className="space-y-4">
                    <button 
                      onClick={() => setShowGiftForm(false)}
                      className="w-full text-right text-slate-500 hover:text-slate-700 text-sm font-bold"
                    >
                      ✕ Close
                    </button>
                    {giftOptions.map((opt, i) => (
                      <div key={i} className="bg-white/30 p-4 rounded-2xl space-y-3">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Option {i + 1}</div>
                        <input 
                          type="text" 
                          value={opt.title}
                          onChange={(e) => {
                            const newOpts = [...giftOptions];
                            newOpts[i].title = e.target.value;
                            setGiftOptions(newOpts);
                          }}
                          placeholder="Gift Title"
                          className="w-full bg-white/50 border-none rounded-xl px-4 py-2 text-sm outline-none"
                        />
                        <input 
                          type="text" 
                          value={opt.message}
                          onChange={(e) => {
                            const newOpts = [...giftOptions];
                            newOpts[i].message = e.target.value;
                            setGiftOptions(newOpts);
                          }}
                          placeholder="Gift Message"
                          className="w-full bg-white/50 border-none rounded-xl px-4 py-2 text-sm outline-none"
                        />
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={(e) => {
                            const newOpts = [...giftOptions];
                            newOpts[i].image = e.target.files?.[0] || null;
                            setGiftOptions(newOpts);
                          }}
                          className="w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:bg-primary/10 file:text-primary cursor-pointer"
                        />
                      </div>
                    ))}
                    <button 
                      onClick={createGiftSet}
                      disabled={isUploading}
                      className="w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-2xl font-bold disabled:opacity-50 transition-colors active:scale-95"
                    >
                      {isUploading ? '⏳ Creating...' : '🎁 Create Gift Set'}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* CHOICE MOMENTS MANAGEMENT */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="glass rounded-3xl overflow-hidden"
      >
        <motion.button
          onClick={() => setExpandedSection(expandedSection === 'choices' ? '' : 'choices')}
          className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3 text-primary font-bold text-lg">
            <Sparkles className="w-6 h-6" />
            Choice Moments
          </div>
          <motion.div
            animate={{ rotate: expandedSection === 'choices' ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <ChevronDown className="w-5 h-5 text-primary" />
          </motion.div>
        </motion.button>

        <AnimatePresence>
          {expandedSection === 'choices' && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden border-t border-white/10"
            >
              <div className="p-6 space-y-4">
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
                    <button 
                      onClick={() => setShowChoiceForm(false)}
                      className="w-full text-right text-slate-500 hover:text-slate-700 text-sm font-bold"
                    >
                      ✕ Close
                    </button>
                    <input 
                      type="text" 
                      value={choiceQuestion}
                      onChange={(e) => setChoiceQuestion(e.target.value)}
                      placeholder="Question (e.g. What should we do today?)"
                      className="w-full bg-white/50 border-none rounded-2xl px-4 py-3 focus:ring-2 ring-primary outline-none text-sm"
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
                      className="w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-2xl font-bold transition-colors active:scale-95"
                    >
                      ✨ Activate Moment
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
