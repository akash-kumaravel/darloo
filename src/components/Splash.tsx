import React from 'react';
import { motion } from 'motion/react';
import { Heart } from 'lucide-react';

export default function Splash() {
  return (
    <motion.div 
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] cinematic-gradient flex flex-col items-center justify-center"
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: [0.5, 1.2, 1], opacity: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="relative"
      >
        <Heart className="w-32 h-32 text-primary fill-primary" />
        <motion.div
          animate={{ 
            scale: [1, 1.5, 1],
            opacity: [0.5, 0, 0.5]
          }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute inset-0 bg-primary rounded-full blur-2xl -z-10"
        />
      </motion.div>
      <motion.h1
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-4xl font-bold mt-8 tracking-tighter text-slate-800"
      >
        starfall
      </motion.h1>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: 100 }}
        className="h-1 bg-primary rounded-full mt-4"
      />
    </motion.div>
  );
}
