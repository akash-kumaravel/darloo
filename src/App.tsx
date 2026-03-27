import React, { useState, useEffect } from 'react';
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
import { getStars } from './services/api';

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
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<GameStats>(() => {
    const saved = localStorage.getItem('loveverse_stats');
    return saved ? JSON.parse(saved) : { totalStars: 0, level: 1, xp: 0 };
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showUserLogin, setShowUserLogin] = useState(false);
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [userPass, setUserPass] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  // Check localStorage for existing auth
  useEffect(() => {
    const savedAuth = localStorage.getItem('loveverse_auth');
    const savedRole = localStorage.getItem('loveverse_role');
    const savedProfile = localStorage.getItem('loveverse_profile');
    
    if (savedAuth === 'true' && savedProfile) {
      try {
        const userData = JSON.parse(savedProfile) as UserProfile;
        setProfile(userData);
        setIsAdminMode(savedRole === 'admin');
        
        const mockUser = {
          uid: userData.uid,
          email: userData.email,
          displayName: userData.name,
          photoURL: userData.photo,
          emailVerified: false,
          isAnonymous: false,
          metadata: {},
          providerData: [],
          phoneNumber: null,
          tenantId: null,
          delete: async () => {},
          getIdToken: async () => '',
          getIdTokenResult: async () => ({ token: '', expirationTime: '', authTime: '', issuedAtTime: '', signInProvider: null, signInSecondFactor: null, claims: {} }),
          reload: async () => {},
          toJSON: () => ({}),
        } as any;
        setUser(mockUser);
      } catch (error) {
        console.error('Error loading user profile:', error);
        localStorage.removeItem('loveverse_auth');
        localStorage.removeItem('loveverse_role');
        localStorage.removeItem('loveverse_profile');
      }
    }
    setLoading(false);
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminUser === 'Admin' && adminPass === 'Akash@0901') {
      const adminProfile: UserProfile = {
        uid: 'admin_user_akash',
        name: 'Admin',
        email: 'admin@loveverse.com',
        role: 'admin',
        photo: '',
      };
      
      localStorage.setItem('loveverse_auth', 'true');
      localStorage.setItem('loveverse_role', 'admin');
      localStorage.setItem('loveverse_profile', JSON.stringify(adminProfile));
      
      // Fetch stars from server
      const serverStars = await getStars();
      const newStats: GameStats = {
        totalStars: serverStars,
        level: 1,
        xp: 0
      };
      setStats(newStats);
      localStorage.setItem('loveverse_stats', JSON.stringify(newStats));
      
      const mockUser = {
        uid: 'admin_user_akash',
        email: 'admin@loveverse.com',
        displayName: 'Admin',
        photoURL: '',
        emailVerified: false,
        isAnonymous: false,
        metadata: {},
        providerData: [],
        phoneNumber: null,
        tenantId: null,
        delete: async () => {},
        getIdToken: async () => '',
        getIdTokenResult: async () => ({ token: '', expirationTime: '', authTime: '', issuedAtTime: '', signInProvider: null, signInSecondFactor: null, claims: {} }),
        reload: async () => {},
        toJSON: () => ({}),
      } as any;
      
      setUser(mockUser);
      setProfile(adminProfile);
      setIsAdminMode(true);
      setAdminUser('');
      setAdminPass('');
      setShowAdminLogin(false);
      toast.success('Welcome Admin! 👑');
    } else {
      toast.error('Invalid Admin Credentials');
    }
  };

  const handleUserLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userPass === 'Libii@1109') {
      const userProfile: UserProfile = {
        uid: 'user_libii',
        name: 'Libii',
        email: 'libii@loveverse.com',
        role: 'user',
        photo: '',
      };
      
      localStorage.setItem('loveverse_auth', 'true');
      localStorage.setItem('loveverse_role', 'user');
      localStorage.setItem('loveverse_profile', JSON.stringify(userProfile));
      
      // Fetch stars from server
      const serverStars = await getStars();
      const newStats: GameStats = {
        totalStars: serverStars,
        level: 1,
        xp: 0
      };
      setStats(newStats);
      localStorage.setItem('loveverse_stats', JSON.stringify(newStats));
      
      const mockUser = {
        uid: 'user_libii',
        email: 'libii@loveverse.com',
        displayName: 'Libii',
        photoURL: '',
        emailVerified: false,
        isAnonymous: false,
        metadata: {},
        providerData: [],
        phoneNumber: null,
        tenantId: null,
        delete: async () => {},
        getIdToken: async () => '',
        getIdTokenResult: async () => ({ token: '', expirationTime: '', authTime: '', issuedAtTime: '', signInProvider: null, signInSecondFactor: null, claims: {} }),
        reload: async () => {},
        toJSON: () => ({}),
      } as any;
      
      setUser(mockUser);
      setProfile(userProfile);
      setIsAdminMode(false);
      setUserPass('');
      setShowUserLogin(false);
      toast.success('Welcome Libii! 💖');
    } else {
      toast.error('Invalid Password');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('loveverse_auth');
    localStorage.removeItem('loveverse_role');
    localStorage.removeItem('loveverse_profile');
    setUser(null);
    setProfile(null);
    setIsAdminMode(false);
    setActiveTab('home');
    setShowAdminLogin(false);
    setShowUserLogin(false);
  };

  const handleStarAdded = (newTotal: number) => {
    setStats({ ...stats, totalStars: newTotal } as GameStats);
    localStorage.setItem('loveverse_stats', JSON.stringify({ ...stats, totalStars: newTotal }));
  };

  if (showSplash) return <Splash />;
  if (loading) return <div className="h-screen w-screen flex items-center justify-center cinematic-gradient"><Heart className="text-primary animate-pulse w-12 h-12" /></div>;

  if (!user || !profile) {
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

        {!showAdminLogin && !showUserLogin ? (
          <div className="w-full max-w-xs space-y-4">
            <button 
              onClick={() => setShowAdminLogin(true)}
              className="w-full bg-gradient-to-r from-purple-600 to-primary text-white py-4 rounded-2xl font-bold shadow-lg shadow-purple-500/40 hover:shadow-purple-500/60 transition-all"
            >
              👑 Admin Login
            </button>
            <button 
              onClick={() => setShowUserLogin(true)}
              className="w-full bg-gradient-to-r from-primary to-pink-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-primary/40 hover:shadow-primary/60 transition-all"
            >
              💖 User Login
            </button>
          </div>
        ) : null}

        {showAdminLogin && (
          <motion.form 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleAdminLogin}
            className="w-full max-w-xs glass p-6 rounded-3xl space-y-4"
          >
            <div className="text-sm font-black text-primary uppercase tracking-widest mb-4">👑 Admin Console</div>
            <input 
              type="text" 
              placeholder="Username" 
              value={adminUser}
              onChange={(e) => setAdminUser(e.target.value)}
              autoComplete="off"
              className="w-full bg-white/50 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary text-sm"
            />
            <input 
              type="password" 
              placeholder="Password" 
              value={adminPass}
              onChange={(e) => setAdminPass(e.target.value)}
              autoComplete="off"
              className="w-full bg-white/50 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary text-sm"
            />
            <button 
              type="submit"
              className="w-full bg-primary text-white py-3 rounded-xl font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all"
            >
              Enter Admin
            </button>
            <button 
              type="button"
              onClick={() => {
                setShowAdminLogin(false);
                setAdminUser('');
                setAdminPass('');
              }}
              className="text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600"
            >
              Back
            </button>
          </motion.form>
        )}

        {showUserLogin && (
          <motion.form 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleUserLogin}
            className="w-full max-w-xs glass p-6 rounded-3xl space-y-4"
          >
            <div className="text-sm font-black text-primary uppercase tracking-widest mb-4">💖 Enter Heart</div>
            <div className="text-center font-bold text-slate-700">Welcome Libii</div>
            <input 
              type="password" 
              placeholder="Password" 
              value={userPass}
              onChange={(e) => setUserPass(e.target.value)}
              autoComplete="off"
              className="w-full bg-white/50 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary text-sm"
            />
            <button 
              type="submit"
              className="w-full bg-primary text-white py-3 rounded-xl font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all"
            >
              Enter App
            </button>
            <button 
              type="button"
              onClick={() => {
                setShowUserLogin(false);
                setUserPass('');
              }}
              className="text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600"
            >
              Back
            </button>
          </motion.form>
        )}

        <div className="mt-8 text-xs text-slate-400 uppercase tracking-widest font-bold">
          For Two Hearts Only ❤️
        </div>
        <Toaster position="top-center" richColors />
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
                <AdminPanel stats={stats} profile={profile} onStarAdded={handleStarAdded} />
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
              <GiftSystem totalStars={stats?.totalStars || 0} onGiftOpened={() => {}} />
            </motion.div>
          )}

          {activeTab === 'scrapbook' && (
            <motion.div
              key="scrapbook"
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
                  <div className="w-24 h-24 rounded-full border-4 border-primary shadow-xl mx-auto bg-primary/20 flex items-center justify-center">
                    <UserIcon className="w-12 h-12 text-primary" />
                  </div>
                  <div className="absolute bottom-0 right-0 bg-primary p-2 rounded-full shadow-lg">
                    <Heart className="w-4 h-4 text-white fill-white" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold mt-4">{profile?.name || 'Libii'}</h2>
                <p className="text-slate-500">{profile?.email || 'libii@loveverse.com'}</p>
                <div className="mt-6 inline-block px-4 py-1 bg-primary/10 text-primary rounded-full text-sm font-bold uppercase tracking-wider">
                  {profile?.role === 'admin' ? '👑 Admin' : 'User'}
                </div>

                <div className="mt-12 space-y-4">
                  {profile?.role === 'admin' && (
                    <button 
                      onClick={() => setIsAdminMode(!isAdminMode)}
                      className="w-full py-4 glass rounded-2xl flex items-center justify-between px-6 font-bold text-slate-700 hover:bg-primary/10 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <Settings className="w-5 h-5 text-primary" />
                        {isAdminMode ? 'Switch to Player View' : 'Switch to Admin View'}
                      </div>
                      <ChevronRight className="w-5 h-5 text-primary" />
                    </button>
                  )}
                  <button 
                    onClick={handleLogout}
                    className="w-full py-4 glass rounded-2xl flex items-center justify-between px-6 font-bold text-red-500 hover:bg-red-500/10 transition-all"
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
