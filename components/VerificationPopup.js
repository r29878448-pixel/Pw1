'use client';

import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, ExternalLink, ShieldAlert, Loader2, Lock, CheckCircle2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

export interface VerificationPopupRef {
  open: () => void;
  checkStatus: () => boolean;
}

const VerificationPopup = forwardRef<VerificationPopupRef>((_, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const checkVerificationStatus = () => {
    const storedData = localStorage.getItem('verification_data');
    if (!storedData) return false;

    try {
      const data = JSON.parse(storedData);
      const now = new Date().getTime();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      return (now - data.timestamp < twentyFourHours);
    } catch (e) {
      return false;
    }
  };

  useImperativeHandle(ref, () => ({
    open: () => setIsOpen(true),
    checkStatus: checkVerificationStatus
  }));

  useEffect(() => {
    const verified = checkVerificationStatus();
    setIsVerified(verified);

    // If on a protected page (not home or token) and not verified, show popup
    if (pathname !== '/' && pathname !== '/token' && !verified) {
      setIsOpen(true);
    }
  }, [pathname]);

  const handleVerify = async () => {
    setLoading(true);
    try {
      let userId = localStorage.getItem('user_id');
      if (!userId) {
        userId = 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        localStorage.setItem('user_id', userId);
      }

      const token = Math.random().toString(36).substr(2, 15) + Date.now();
      const longUrl = `${window.location.origin}/token?token=${token}&uid=${userId}`;
      
      const apiToken = process.env.NEXT_PUBLIC_VPLINK_API_TOKEN || 'S5NM8hcPtUkqfYtsaF54DoSyBnpYGC6bpZ6Cac6-';
      const shortenApiUrl = `https://sahiurl.com/api?api=${apiToken}&url=${encodeURIComponent(longUrl)}`;
      
      const response = await fetch(`/api/proxy?url=${encodeURIComponent(shortenApiUrl)}`);
      if (!response.ok) throw new Error('Failed to shorten link');
      
      const data = await response.json();
      
      if (data.status === 'success' && data.shortenedUrl) {
        let finalUrl = data.shortenedUrl;
        if (typeof finalUrl === 'string') {
          finalUrl = finalUrl.replace(/^"+|"+$/g, '');
        }
        window.location.href = finalUrl;
      } else {
        window.location.href = longUrl;
      }
    } catch (error) {
      console.error('Verification error:', error);
      const token = Math.random().toString(36).substr(2, 15) + Date.now();
      window.location.href = `${window.location.origin}/token?token=${token}`;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            onClick={() => {
              if (pathname === '/') setIsOpen(false);
            }}
          />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 30 }}
            className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-[3rem] overflow-hidden shadow-[0_0_50px_rgba(229,9,20,0.15)] p-10 text-center"
          >
            {/* Premium Accent */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />

            {/* Security Icon */}
            <div className="mb-8 flex justify-center">
              <div className="relative">
                <div className="p-6 bg-primary/5 rounded-[2rem] border border-primary/20">
                  <Lock className="w-14 h-14 text-primary" />
                </div>
                <motion.div 
                  animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 3 }}
                  className="absolute -inset-4 bg-primary/10 blur-2xl rounded-full -z-10"
                />
              </div>
            </div>

            <h2 className="text-3xl font-black text-white mb-4 tracking-tighter uppercase">
              Secure <span className="text-primary">Gateway</span>
            </h2>
            
            <p className="text-white/40 text-sm mb-10 leading-relaxed font-medium">
              This batch is protected. Complete a quick verification to unlock premium access for the next 24 hours.
            </p>

            <div className="flex flex-col gap-4">
              <button 
                onClick={handleVerify}
                disabled={loading}
                className="group relative flex items-center justify-center gap-3 w-full py-5 bg-primary rounded-2xl font-black text-white transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_10px_20px_rgba(229,9,20,0.3)] disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                
                {loading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="tracking-widest uppercase text-xs">Processing...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-6 h-6" />
                    <span className="tracking-widest uppercase text-xs">Unlock Access</span>
                    <ExternalLink className="w-4 h-4 opacity-30" />
                  </>
                )}
              </button>
              
              <div className="flex items-center justify-center gap-3 mt-4">
                <div className="flex items-center gap-1.5 text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500/50" />
                  Bot Protection
                </div>
                <div className="w-1 h-1 bg-white/10 rounded-full" />
                <div className="flex items-center gap-1.5 text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500/50" />
                  24h Validity
                </div>
              </div>
            </div>

            {/* Footer Note */}
            <div className="mt-10 pt-8 border-t border-white/5">
              <p className="text-[9px] text-white/20 leading-relaxed font-bold uppercase tracking-widest">
                Trusted by 50,000+ Students
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});

VerificationPopup.displayName = 'VerificationPopup';

export default VerificationPopup;
