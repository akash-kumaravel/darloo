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
    let unsubscribeMood: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        unsubscribeMood = onSnapshot(doc(db, 'moods', user.uid), (snap) => {
          if (snap.exists()) {
            setCurrentMood(snap.data().mood as MoodType);
          }
        });
      } else {
        if (unsubscribeMood) {
          unsubscribeMood();
          unsubscribeMood = undefined;
        }
      }
    });

    return () => {
      unsubAuth();
      if (unsubscribeMood) unsubscribeMood();
    };
  }, []);

  const setMood = async (mood: MoodType) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      await setDoc(doc(db, 'moods', user.uid), {
        userId: user.uid,
        userName: user.email === 'admin@starfall.com' ? 'Admin' : 'Darloo',
        mood,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
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
