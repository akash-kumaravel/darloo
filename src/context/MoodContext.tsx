import React, { createContext, useContext, useState, useEffect } from 'react';
import { MoodType } from '../types';
import { db, auth } from '../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';

interface MoodContextType {
  currentMood: MoodType;
  setMood: (mood: MoodType) => Promise<void>;
  moodColors: {
    primary: string;
    secondary: string;
    accent: string;
    bg: string;
  };
}

const moodSettings: Record<MoodType, MoodContextType['moodColors']> = {
  happy: {
    primary: '#FFD700', // Gold
    secondary: '#FFFACD', // LemonChiffon
    accent: '#FFA500', // Orange
    bg: '#FFFBEB'
  },
  miss_you: {
    primary: '#FF69B4', // HotPink
    secondary: '#FFB6C1', // LightPink
    accent: '#DB7093', // PaleVioletRed
    bg: '#FFF5F7'
  },
  upset: {
    primary: '#4682B4', // SteelBlue
    secondary: '#B0C4DE', // LightSteelBlue
    accent: '#5F9EA0', // CadetBlue
    bg: '#F0F8FF'
  },
  tired: {
    primary: '#808080', // Gray
    secondary: '#D3D3D3', // LightGray
    accent: '#A9A9A9', // DarkGray
    bg: '#F5F5F5'
  }
};

const MoodContext = createContext<MoodContextType | undefined>(undefined);

export function MoodProvider({ children }: { children: React.ReactNode }) {
  const [currentMood, setCurrentMood] = useState<MoodType>('happy');

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const unsubscribeMood = onSnapshot(doc(db, 'moods', user.uid), (snap) => {
          if (snap.exists()) {
            setCurrentMood(snap.data().mood as MoodType);
          }
        });
        return () => unsubscribeMood();
      }
    });

    return () => unsubAuth();
  }, []);

  const setMood = async (mood: MoodType) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      // Determine if current user is admin
      const userEmail = user.email || '';
      const isAdmin = userEmail === 'akashkumaravel3@gmail.com';
      const displayName = isAdmin ? 'Admin' : (user.displayName || 'Darloo');

      // Update the mood document with full data structure
      await setDoc(doc(db, 'moods', user.uid), {
        userId: user.uid,
        userName: displayName,
        userEmail: userEmail,
        mood,
        isAdmin,
        updatedAt: new Date().toISOString(),
        timestamp: new Date()
      }, { merge: true }); // Use merge to not overwrite other fields

      // Also log the mood change
      console.log(`Mood updated: ${displayName} -> ${mood}`);
    } catch (error) {
      console.error('Mood update error:', error);
      handleFirestoreError(error, OperationType.WRITE, `moods/${user.uid}`);
    }
  };

  const value = {
    currentMood,
    setMood,
    moodColors: moodSettings[currentMood]
  };

  return (
    <MoodContext.Provider value={value}>
      <div style={{ 
        '--mood-primary': value.moodColors.primary,
        '--mood-secondary': value.moodColors.secondary,
        '--mood-accent': value.moodColors.accent,
        '--mood-bg': value.moodColors.bg
      } as any}>
        {children}
      </div>
    </MoodContext.Provider>
  );
}

export function useMood() {
  const context = useContext(MoodContext);
  if (context === undefined) {
    throw new Error('useMood must be used within a MoodProvider');
  }
  return context;
}
