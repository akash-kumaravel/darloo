import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Star, Gift, Calendar, MessageSquare, ChevronRight, Clock, Camera } from 'lucide-react';
import { doc, onSnapshot, collection, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../firebase';
import { GameStats, UserProfile, DailyMessage, NextEvent, Memory, GiftSet } from '../types';
import StarReactor from './StarReactor';
import GiftSystem from './GiftSystem';
import MoodEngine from './MoodEngine';
import ChoiceMoments from './ChoiceMoments';
import LoveTasks from './LoveTasks';
import BucketList from './BucketList';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';

interface UserPanelProps {
  stats: GameStats | null;
  profile: UserProfile | null;
}

export default function UserPanel({ stats, profile }: UserPanelProps) {
  const [dailyMsg, setDailyMsg] = useState<DailyMessage | null>(null);
  const [nextEvent, setNextEvent] = useState<NextEvent | null>(null);
  const [latestMemory, setLatestMemory] = useState<Memory | null>(null);
  const [activeGiftSet, setActiveGiftSet] = useState<GiftSet | null>(null);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const msgPath = 'messages/daily';
    const msgUnsub = onSnapshot(doc(db, 'messages', 'daily'), (doc) => {
      if (doc.exists()) setDailyMsg(doc.data() as DailyMessage);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, msgPath);
    });

    const eventPath = 'events/next';
    const eventUnsub = onSnapshot(doc(db, 'events', 'next'), (doc) => {
      if (doc.exists()) setNextEvent(doc.data() as NextEvent);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, eventPath);
    });

    const memoryPath = 'memories';
    const memoryUnsub = onSnapshot(
      query(collection(db, memoryPath), orderBy('createdAt', 'desc'), limit(1)),
      (snap) => {
        if (!snap.empty) setLatestMemory({ id: snap.docs[0].id, ...snap.docs[0].data() } as Memory);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, memoryPath);
      }
    );

    const giftPath = 'giftSets';
    const giftUnsub = onSnapshot(
      query(collection(db, giftPath), where('unlocked', '==', false), orderBy('createdAt', 'asc'), limit(1)),
      (snap) => {
        if (!snap.empty) {
          setActiveGiftSet({ id: snap.docs[0].id, ...snap.docs[0].data() } as GiftSet);
        } else {
          setActiveGiftSet(null);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, giftPath);
      }
    );

    return () => {
      msgUnsub();
      eventUnsub();
      memoryUnsub();
      giftUnsub();
    };
  }, []);

  useEffect(() => {
    if (!nextEvent) return;
    
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const target = new Date(nextEvent.countdown).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft('Happening Now! ❤️');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      setTimeLeft(`${days}d ${hours}h ${minutes}m`);
    }, 1000);

    return () => clearInterval(interval);
  }, [nextEvent]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img 
              src={profile?.role === 'user' ? '/profile.png' : (profile?.photo || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin')} 
              alt={profile?.name} 
              className="w-12 h-12 rounded-full border-2 border-white shadow-lg object-cover" 
              referrerPolicy="no-referrer"
            />
            <div className="absolute -bottom-1 -right-1 bg-primary p-1 rounded-full">
              <Heart className="w-2 h-2 text-white fill-white" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter">HELLO, {profile?.role === 'admin' ? profile?.name?.split(' ')[0].toUpperCase() : 'DARLOO'}</h1>
            <div className="flex items-center gap-1 text-[10px] font-bold text-primary uppercase tracking-widest">
              <Gift className="w-2 h-2" />
              Gifts Received: {stats?.giftsReceived || 0}
            </div>
          </div>
        </div>
        <div className="glass px-4 py-2 rounded-2xl flex items-center gap-2">
          <Heart className="w-4 h-4 text-primary fill-primary" />
          <span className="text-sm font-black text-slate-700">{stats?.totalStars || 0}</span>
        </div>
      </div>

      {/* Daily Message */}
      <AnimatePresence>
        {dailyMsg && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-3xl p-6 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <MessageSquare className="w-12 h-12" />
            </div>
            <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">Message of the Day</div>
            <p className="text-lg font-medium text-slate-700 italic leading-relaxed">
              "{dailyMsg.dailyMessage}"
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Star Reactor */}
      <StarReactor 
        totalStars={stats?.totalStars || 0} 
        giftsReceived={stats?.giftsReceived || 0} 
        lastGiftStarCount={stats?.lastGiftStarCount || 0}
        isAdmin={profile?.role === 'admin'} 
        isGiftReady={!!activeGiftSet && (stats?.totalStars || 0) >= (stats?.lastGiftStarCount || 0) + 25}
        onOpenGift={() => setShowGiftModal(true)}
      />

      {/* Mood Engine */}
      <MoodEngine />

      {/* Choice Moments */}
      <ChoiceMoments />

      {/* Love Missions */}
      <LoveTasks isAdmin={profile?.role === 'admin'} />

      {/* Bucket List */}
      <BucketList isAdmin={profile?.role === 'admin'} />

      {/* Gift System Modal */}
      <AnimatePresence>
        {showGiftModal && (
          <GiftSystem 
            activeGiftSet={activeGiftSet}
            totalStars={stats?.totalStars || 0}
            lastGiftStarCount={stats?.lastGiftStarCount || 0}
            onClose={() => setShowGiftModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Next Event & Memory */}
      <div className="grid grid-cols-2 gap-4">
        {nextEvent && (
          <div className="glass rounded-3xl p-5 flex flex-col justify-between aspect-square">
            <div className="bg-primary/10 w-10 h-10 rounded-xl flex items-center justify-center">
              <Calendar className="text-primary w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Next Event</div>
              <div className="font-bold text-slate-800 leading-tight mb-1">{nextEvent.nextEvent}</div>
              <div className="text-xs font-black text-primary flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {timeLeft}
              </div>
            </div>
          </div>
        )}

        {latestMemory && (
          <div className="glass rounded-3xl p-5 flex flex-col justify-between aspect-square overflow-hidden relative group">
            <img 
              src={latestMemory.image} 
              alt="Memory" 
              className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:scale-110 transition-transform duration-500" 
            />
            <div className="relative z-10 bg-white/80 w-10 h-10 rounded-xl flex items-center justify-center">
              <Camera className="text-primary w-5 h-5" />
            </div>
            <div className="relative z-10">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Latest Memory</div>
              <div className="text-xs font-bold text-slate-800 line-clamp-2">{latestMemory.caption}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
