import React, { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInAnonymously, 
  signOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc as firebaseSetDoc, 
  onSnapshot, 
  collection, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, GameStats, Role } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  Star, 
  Gift, 
  Camera, 
  User as UserIcon, 
  Settings, 
  LogOut,
  Lock,
  ChevronRight
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { cn } from './lib/utils';
import { handleFirestoreError, OperationType } from './lib/firestore-error';

// Components
import AdminPanel from './components/AdminPanel';
import UserPanel from './components/UserPanel';
import GiftSystem from './components/GiftSystem';
import Scrapbook from './components/Scrapbook';
import MemoryVault from './components/MemoryVault';
import Navigation from './components/Navigation';
import Splash from './components/Splash';
import { MoodProvider } from './context/MoodContext';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  const [showLoginMode, setShowLoginMode] = useState<'selection' | 'admin' | 'user'>('selection');
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [userPass, setUserPass] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          setProfile(userDoc.data() as UserProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async (role: 'admin' | 'user', name: string) => {
    try {
      const { user: firebaseUser } = await signInAnonymously(auth);
      const newProfile: UserProfile = {
        uid: firebaseUser.uid,
        name: name,
        email: role === 'admin' ? 'admin@loveverse.com' : 'darloo@loveverse.com',
        role: role,
        photo: role === 'admin' ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin' : 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop',
      };
      await firebaseSetDoc(doc(db, 'users', firebaseUser.uid), newProfile);
      setProfile(newProfile);
      toast.success(`Welcome to LOVEVERSE, ${name} ❤️`);
    } catch (error: any) {
      if (error.code === 'auth/admin-restricted-operation') {
        toast.error('Anonymous Auth is disabled. Please enable it in Firebase Console.', {
          duration: 10000,
          description: 'Go to Authentication > Sign-in method > Add new provider > Anonymous > Enable'
        });
      } else {
        toast.error('Login failed: ' + (error.message || 'Unknown error'));
      }
      console.error(error);
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminUser === 'Admin' && adminPass === 'Akash@0901') {
      handleLogin('admin', 'Admin');
    } else {
      toast.error('Invalid Credentials');
    }
  };

  const handleUserLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (userPass === 'Libii@1109') {
      handleLogin('user', 'Darloo');
    } else {
      toast.error('Invalid Password');
    }
  };

  useEffect(() => {
    if (!user) return;

    const initializeStats = async () => {
      try {
        await firebaseSetDoc(doc(db, 'stats', 'global'), {
          totalStars: 0,
          giftsReceived: 0,
          lastGiftStarCount: 0
        });
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, 'stats/global');
      }
    };

    const statsUnsubscribe = onSnapshot(doc(db, 'stats', 'global'), (doc) => {
      if (doc.exists()) {
        setStats(doc.data() as GameStats);
      } else {
        initializeStats();
      }
    });

    return () => statsUnsubscribe();
  }, [user]);

  const handleLogout = () => {
    signOut(auth);
    setIsAdminMode(false);
    setActiveTab('home');
    setShowLoginMode('selection');
    setAdminUser('');
    setAdminPass('');
    setUserPass('');
  };

  if (showSplash) return <Splash />;
  if (loading) return <div className="h-screen w-screen flex items-center justify-center cinematic-gradient"><Heart className="text-primary animate-pulse w-12 h-12" /></div>;

  if (!user) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center cinematic-gradient p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-12"
        >
          <div className="relative">
            <Heart className="w-24 h-24 text-primary fill-primary animate-float" />
            <motion.div 
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute -top-2 -right-2 bg-white rounded-full p-2 shadow-lg"
            >
              <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
            </motion.div>
          </div>
          <h1 className="text-4xl font-bold mt-6 tracking-tighter text-slate-800">LOVEVERSE</h1>
          <p className="text-slate-500 mt-2 font-medium">A Private Cinematic Love Game</p>
        </motion.div>

        {showLoginMode === 'selection' ? (
          <div className="w-full max-w-xs space-y-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowLoginMode('user')}
              className="w-full glass py-6 rounded-3xl flex flex-col items-center justify-center gap-2 font-bold text-slate-700 hover:bg-white transition-all group"
            >
              <Heart className="w-8 h-8 text-primary group-hover:fill-primary transition-all" />
              <span className="text-lg">Enter as Darloo</span>
            </motion.button>
            
            <button 
              onClick={() => setShowLoginMode('admin')}
              className="text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-primary transition-colors"
            >
              Admin Access
            </button>
          </div>
        ) : showLoginMode === 'admin' ? (
          <motion.form 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleAdminLogin}
            className="w-full max-w-xs glass p-8 rounded-[2.5rem] space-y-4 border-2 border-white/20 shadow-2xl"
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Game Master</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enter Credentials</p>
            </div>

            <div className="space-y-3">
              <input 
                type="text" 
                placeholder="Username" 
                value={adminUser}
                onChange={(e) => setAdminUser(e.target.value)}
                className="w-full bg-white/50 border-2 border-transparent rounded-2xl px-5 py-4 outline-none focus:border-primary/30 focus:bg-white transition-all text-sm font-medium"
              />
              <input 
                type="password" 
                placeholder="Password" 
                value={adminPass}
                onChange={(e) => setAdminPass(e.target.value)}
                className="w-full bg-white/50 border-2 border-transparent rounded-2xl px-5 py-4 outline-none focus:border-primary/30 focus:bg-white transition-all text-sm font-medium"
              />
            </div>

            <button 
              type="submit"
              className="w-full bg-primary text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all mt-4"
            >
              Unlock Vault
            </button>
            
            <button 
              type="button"
              onClick={() => setShowLoginMode('selection')}
              className="w-full text-xs font-bold text-slate-400 uppercase tracking-widest py-2"
            >
              Back
            </button>
          </motion.form>
        ) : (
          <motion.form 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleUserLogin}
            className="w-full max-w-xs glass p-8 rounded-[2.5rem] space-y-6 border-2 border-white/20 shadow-2xl"
          >
            <div className="text-center">
              <motion.div 
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 3 }}
                className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <Heart className="w-10 h-10 text-primary fill-primary/20" />
              </motion.div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tighter mb-1">WELCOME MY DEAR WIFE</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enter your secret password</p>
            </div>

            <input 
              type="password" 
              placeholder="Your Secret Password" 
              value={userPass}
              onChange={(e) => setUserPass(e.target.value)}
              className="w-full bg-white/50 border-2 border-transparent rounded-2xl px-5 py-4 outline-none focus:border-primary/30 focus:bg-white transition-all text-sm font-medium text-center tracking-[0.5em]"
            />

            <button 
              type="submit"
              className="w-full bg-primary text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Enter Loveverse
            </button>
            
            <button 
              type="button"
              onClick={() => setShowLoginMode('selection')}
              className="w-full text-xs font-bold text-slate-400 uppercase tracking-widest py-2"
            >
              Back
            </button>
          </motion.form>
        )}

        <div className="mt-8 text-xs text-slate-400 uppercase tracking-widest font-bold">
          For Two Hearts Only
        </div>
        <Toaster position="top-center" />
      </div>
    );
  }

  return (
    <MoodProvider>
      <div className="min-h-screen cinematic-gradient pb-24 overflow-x-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-6"
            >
              {isAdminMode ? (
                <AdminPanel stats={stats} profile={profile} />
              ) : (
                <UserPanel stats={stats} profile={profile} />
              )}
            </motion.div>
          )}

          {activeTab === 'gifts' && (
            <motion.div
              key="gifts"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6"
            >
              <Scrapbook />
            </motion.div>
          )}

          {activeTab === 'memories' && (
            <motion.div
              key="memories"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="p-6"
            >
              <MemoryVault />
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-6"
            >
              <div className="glass rounded-3xl p-8 text-center">
                <div className="relative inline-block">
                  <img 
                    src={profile?.role === 'user' ? 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop' : (profile?.photo || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin')} 
                    alt={profile?.name} 
                    className="w-24 h-24 rounded-full border-4 border-white shadow-xl mx-auto object-cover" 
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute bottom-0 right-0 bg-primary p-2 rounded-full shadow-lg">
                    <Heart className="w-4 h-4 text-white fill-white" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold mt-4">{profile?.name}</h2>
                <p className="text-slate-500">{profile?.email}</p>
                <div className="mt-6 inline-block px-4 py-1 bg-primary/10 text-primary rounded-full text-sm font-bold uppercase tracking-wider">
                  {profile?.role}
                </div>

                <div className="mt-12 space-y-4">
                  {profile?.role === 'admin' && (
                    <button 
                      onClick={() => setIsAdminMode(!isAdminMode)}
                      className="w-full py-4 glass rounded-2xl flex items-center justify-between px-6 font-bold text-slate-700"
                    >
                      <div className="flex items-center gap-3">
                        <Settings className="w-5 h-5 text-primary" />
                        {isAdminMode ? 'Switch to Player View' : 'Enter Game Master Mode'}
                      </div>
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  )}
                  <button 
                    onClick={handleLogout}
                    className="w-full py-4 glass rounded-2xl flex items-center justify-between px-6 font-bold text-red-500"
                  >
                    <div className="flex items-center gap-3">
                      <LogOut className="w-5 h-5" />
                      Logout
                    </div>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
        <Toaster position="top-center" richColors />
      </div>
    </MoodProvider>
  );
}
