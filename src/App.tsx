import React, { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
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
        } else {
          // New user
          try {
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'Player',
              email: firebaseUser.email || '',
              role: firebaseUser.email === 'akashkumaravel3@gmail.com' ? 'admin' : 'user',
              photo: firebaseUser.photoURL || '',
            };
            await firebaseSetDoc(doc(db, 'users', firebaseUser.uid), newProfile);
            setProfile(newProfile);
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, `users/${firebaseUser.uid}`);
          }
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const initializeStats = async () => {
      try {
        await firebaseSetDoc(doc(db, 'stats', 'global'), {
          totalStars: 0,
          level: 1,
          xp: 0
        });
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, 'stats/global');
      }
    };

    const statsUnsubscribe = onSnapshot(doc(db, 'stats', 'global'), (doc) => {
      if (doc.exists()) {
        setStats(doc.data() as GameStats);
      } else {
        // Initialize stats if not exist
        initializeStats();
      }
    });

    return () => statsUnsubscribe();
  }, [user]);

  const handleLogin = async () => {
    // Google sign-in removed
    toast.error('Please use Admin Login');
  };

  const handleLogout = () => {
    signOut(auth);
    setIsAdminMode(false);
    setActiveTab('home');
  };

  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminUser === 'Admin' && adminPass === 'Akash@0901') {
      // For this demo, we'll just sign in with Google but treat as admin
      // In a real app, this would be a separate auth flow
      handleLogin();
      toast.success('Admin Access Granted 👑');
    } else {
      toast.error('Invalid Credentials');
    }
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

        {!showAdminLogin ? (
          <div className="w-full max-w-xs space-y-4">
            <button 
              onClick={() => setShowAdminLogin(true)}
              className="w-full bg-primary text-white py-4 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all"
            >
              Admin Login
            </button>
          </div>
        ) : (
          <motion.form 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleAdminLogin}
            className="w-full max-w-xs glass p-6 rounded-3xl space-y-4"
          >
            <div className="text-sm font-black text-primary uppercase tracking-widest mb-4">Game Master Login</div>
            <input 
              type="text" 
              placeholder="Username" 
              value={adminUser}
              onChange={(e) => setAdminUser(e.target.value)}
              className="w-full bg-white/50 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary text-sm"
            />
            <input 
              type="password" 
              placeholder="Password" 
              value={adminPass}
              onChange={(e) => setAdminPass(e.target.value)}
              className="w-full bg-white/50 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary text-sm"
            />
            <button 
              type="submit"
              className="w-full bg-primary text-white py-3 rounded-xl font-bold shadow-lg shadow-primary/20"
            >
              Unlock Vault
            </button>
            <button 
              type="button"
              onClick={() => setShowAdminLogin(false)}
              className="text-xs font-bold text-slate-400 uppercase tracking-widest"
            >
              Back to Player Login
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
                  <img src={profile?.photo} alt={profile?.name} className="w-24 h-24 rounded-full border-4 border-white shadow-xl mx-auto" />
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
