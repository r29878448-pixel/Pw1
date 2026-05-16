'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, X, ArrowRight, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePathname } from 'next/navigation';

export function TelegramPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Reset or show popup on every page change as requested (no cooldown)
  useEffect(() => {
    // Show after a short delay
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [pathname]);

  const handleJoin = () => {
    window.open('https://t.me/Study_Portalz', '_blank');
    setIsOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={() => setIsOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 40 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-[320px] bg-white rounded-[2.5rem] shadow-[0_20px_60px_rgba(36,161,222,0.3)] overflow-hidden border border-white/20"
          >
            {/* Premium Header */}
            <div className="relative h-28 bg-[#24A1DE] flex flex-col items-center justify-center text-white overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#24A1DE] via-[#24A1DE] to-[#36b9f5]" />
              
              {/* Glassy Orbs */}
              <div className="absolute -top-10 -left-10 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
              <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-white/20 rounded-full blur-2xl" />

              <motion.div 
                animate={{ 
                  y: [0, -4, 0],
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="relative z-10 w-14 h-14 bg-white rounded-2xl p-3.5 shadow-2xl flex items-center justify-center mb-1 border-4 border-white/20"
              >
                 <Send className="w-full h-full text-[#24A1DE] fill-current" />
              </motion.div>
              
              <button 
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 z-20 p-1 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 pt-5 flex flex-col items-center text-center">
              <div className="space-y-2.5 mb-6">
                <div className="flex items-center justify-center space-x-1 mb-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="w-0.5 h-3 bg-[#24A1DE]/20 rounded-full" />
                  ))}
                </div>
                <h2 className="text-lg font-black text-gray-900 tracking-tight leading-tight">
                  JOIN OUR <br/> COMMUNITY
                </h2>
                <div className="flex items-center justify-center space-x-2 bg-blue-50 px-3 py-1 rounded-full w-fit mx-auto border border-blue-100/50">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                  <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest leading-none">
                    42.5K+ Premium Students
                  </span>
                </div>
                <p className="text-gray-500 text-[11px] font-medium leading-relaxed px-4">
                  Get <span className="text-gray-900 font-bold">Exclusive Notes</span> and direct updates from Sachin Sir.
                </p>
              </div>

              <div className="w-full space-y-3">
                <Button 
                  onClick={handleJoin}
                  className="w-full h-12 bg-gray-900 hover:bg-[#24A1DE] text-white rounded-2xl text-[10px] font-black shadow-xl transition-all active:scale-95 group relative overflow-hidden uppercase tracking-[0.2em]"
                >
                  JOIN TELEGRAM
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
                
                <button 
                  onClick={() => setIsOpen(false)}
                  className="w-full py-1 text-gray-400 text-[9px] font-bold uppercase tracking-[0.3em] hover:text-blue-600 transition-colors"
                >
                  I&apos;m already joined
                </button>
              </div>
            </div>

            {/* Premium Edge */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
              }
