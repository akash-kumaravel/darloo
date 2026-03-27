export type Role = 'user' | 'admin';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: Role;
  photo: string;
}

export interface GameStats {
  totalStars: number;
  giftsReceived: number;
  lastGiftStarCount?: number;
  lastStarGivenAt?: string;
}

export interface GiftOption {
  title: string;
  message: string;
  image: string;
  isPrimary?: boolean;
}

export interface GiftSet {
  id: string;
  option1: GiftOption;
  option2: GiftOption;
  option3: GiftOption;
  unlocked: boolean;
  createdAt: string;
}

export interface CollectionItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  date: string;
  image: string;
}

export interface DailyMessage {
  dailyMessage: string;
  updatedAt: string;
}

export interface NextEvent {
  nextEvent: string;
  countdown: string;
}

export interface Memory {
  id: string;
  weeklyMemory: string;
  image: string;
  caption: string;
  createdAt: string;
}

export type MoodType = 'happy' | 'miss_you' | 'upset' | 'tired';

export interface UserMood {
  userId: string;
  userName: string;
  mood: MoodType;
  updatedAt: string;
}

export interface ChoiceOption {
  label: string;
  emoji: string;
  response: string;
  reward: number;
}

export interface ChoiceMoment {
  id: string;
  question: string;
  options: ChoiceOption[];
  active: boolean;
  createdAt: string;
}

export interface ChoiceResponse {
  id: string;
  userId: string;
  userName: string;
  momentId: string;
  question: string;
  choiceLabel: string;
  choiceEmoji: string;
  createdAt: string;
  rewarded?: boolean;
}
