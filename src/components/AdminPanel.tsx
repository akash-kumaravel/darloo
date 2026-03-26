import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
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
  X
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
  getDocs
} from 'firebase/firestore';
import { db, storage } from '../firebase';
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

    return () => {
      unsubscribeMoods();
      unsubscribeResponses();
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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tighter">GAME MASTER</h1>
          <p className="text-slate-500 text-sm font-medium">Control the Loveverse</p>
        </div>
        <div className="bg-primary/10 p-3 rounded-2xl">
          <Settings className="text-primary w-6 h-6" />
        </div>
      </div>

      <StarReactor totalStars={stats?.totalStars || 0} isAdmin={true} />

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
        <div className="glass rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-3 text-primary font-bold">
            <Calendar className="w-5 h-5" />
            Next Big Event
          </div>
          <div className="space-y-3">
            <input 
              type="text" 
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="Event Name (e.g. Anniversary)"
              className="w-full bg-white/50 border-none rounded-xl px-4 py-3 focus:ring-2 ring-primary outline-none text-sm"
            />
            <input 
              type="date" 
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full bg-white/50 border-none rounded-xl px-4 py-3 focus:ring-2 ring-primary outline-none text-sm"
            />
            <button 
              onClick={updateNextEvent}
              className="w-full bg-primary text-white py-3 rounded-xl font-bold shadow-lg shadow-primary/20"
            >
              Schedule Event
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
        <div className="glass rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between text-primary font-bold">
            <div className="flex items-center gap-3">
              <Gift className="w-5 h-5" />
              Gift Management
            </div>
            {showGiftForm && (
              <button onClick={() => setShowGiftForm(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            )}
          </div>
          
          {!showGiftForm ? (
            <button 
              onClick={() => setShowGiftForm(true)}
              className="w-full py-4 border-2 border-dashed border-primary/30 rounded-2xl flex items-center justify-center gap-2 text-primary font-bold hover:bg-primary/5 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create New Gift Set
            </button>
          ) : (
            <div className="space-y-6">
              {giftOptions.map((opt, i) => (
                <div key={i} className="bg-white/30 p-4 rounded-2xl space-y-3">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Option {i + 1}</div>
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
                    className="w-full text-[10px] file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:bg-primary/10 file:text-primary"
                  />
                </div>
              ))}
              <button 
                onClick={createGiftSet}
                disabled={isUploading}
                className="w-full bg-primary text-white py-4 rounded-2xl font-bold shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {isUploading ? 'Creating...' : 'Create Gift Set'}
              </button>
            </div>
          )}
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
    </div>
  );
}
