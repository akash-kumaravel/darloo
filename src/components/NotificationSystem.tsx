import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Star, Trophy, Camera, Sparkles, X } from 'lucide-react';

interface Notification {
  id: string;
  type: 'star' | 'mission' | 'memory' | 'choice';
  title: string;
  message: string;
  timestamp: number;
}

export default function NotificationSystem() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Connect to WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    ws.current = new WebSocket(`${protocol}//${host}`);

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'notification') {
          const newNotification: Notification = {
            id: Math.random().toString(36).substr(2, 9),
            type: data.payload.type,
            title: data.payload.title,
            message: data.payload.message,
            timestamp: Date.now(),
          };
          setNotifications(prev => [newNotification, ...prev]);

          // Auto-remove after 5 seconds
          setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== newNotification.id));
          }, 5000);
        }
      } catch (e) {
        console.error('Error parsing notification:', e);
      }
    };

    return () => {
      if (ws.current) ws.current.close();
    };
  }, []);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'star': return <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />;
      case 'mission': return <Trophy className="w-5 h-5 text-primary" />;
      case 'memory': return <Camera className="w-5 h-5 text-blue-500" />;
      case 'choice': return <Sparkles className="w-5 h-5 text-purple-500" />;
      default: return <Bell className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div className="fixed top-4 left-4 right-4 z-[9999] pointer-events-none flex flex-col items-center gap-3">
      <AnimatePresence>
        {notifications.map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="w-full max-w-md bg-white/90 backdrop-blur-xl rounded-[2rem] p-4 shadow-2xl border border-white/20 pointer-events-auto flex items-center gap-4 relative overflow-hidden group"
          >
            {/* Android-style indicator */}
            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-1 bg-slate-200 rounded-full opacity-50" />
            
            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
              {getIcon(n.type)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Love App • Just Now</span>
                <button 
                  onClick={() => removeNotification(n.id)}
                  className="p-1 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-3 h-3 text-slate-400" />
                </button>
              </div>
              <h3 className="text-sm font-black text-slate-800 tracking-tight uppercase truncate">{n.title}</h3>
              <p className="text-xs text-slate-500 font-medium line-clamp-2 leading-relaxed">{n.message}</p>
            </div>

            {/* Progress bar for auto-dismiss */}
            <motion.div 
              initial={{ width: '100%' }}
              animate={{ width: 0 }}
              transition={{ duration: 5, ease: 'linear' }}
              className="absolute bottom-0 left-0 h-0.5 bg-primary/20"
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
