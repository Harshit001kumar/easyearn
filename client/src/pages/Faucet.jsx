import { useState, useEffect, useRef } from 'react';
import api from '../api';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { HiLightningBolt, HiClock } from 'react-icons/hi';

export default function Faucet() {
  const [status, setStatus] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    loadStatus();
    return () => clearInterval(timerRef.current);
  }, []);

  const loadStatus = async () => {
    try {
      const res = await api.get('/faucet/status');
      setStatus(res.data);
      if (!res.data.canClaim && res.data.remainingMs > 0) {
        startTimer(res.data.remainingMs);
      }
    } catch (err) {
      toast.error('Failed to load faucet status');
    }
  };

  const startTimer = (ms) => {
    setCountdown(Math.ceil(ms / 1000));
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          loadStatus();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleClaim = async () => {
    setClaiming(true);
    try {
      const res = await api.post('/faucet/claim', { captchaToken: 'demo' });
      // Redirect to shortlink
      if (res.data.shortlink) {
        toast.success('Redirecting to shortlink...');
        window.open(res.data.shortlink, '_blank');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Claim failed');
      if (err.response?.data?.remainingMs) {
        startTimer(err.response.data.remainingMs);
      }
    } finally {
      setClaiming(false);
    }
  };

  const canClaim = status?.canClaim && countdown === 0;
  const progress = countdown > 0 ? ((300 - countdown) / 300) * 100 : 100;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Faucet</h1>

      {/* Ad Placeholder */}
      <div className="glass-card p-4 text-center text-on-surface-variant text-sm border border-dashed border-white/10">
        <p>📢 Advertisement Space (728x90)</p>
      </div>

      {/* Main Claim Card */}
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-10 max-w-lg mx-auto text-center">
        <div className="relative w-32 h-32 mx-auto mb-6">
          {/* Circular progress */}
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
            <circle cx="50" cy="50" r="45" fill="none" stroke="url(#gradient)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${progress * 2.83} 283`} className="transition-all duration-1000" />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7e51ff" />
                <stop offset="100%" stopColor="#00d4ec" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            {countdown > 0 ? (
              <span className="text-2xl font-bold text-on-surface">{formatTime(countdown)}</span>
            ) : (
              <HiLightningBolt className="w-10 h-10 text-primary animate-pulse" />
            )}
          </div>
        </div>

        <h2 className="text-xl font-bold mb-2">Claim Your Points</h2>
        <p className="text-on-surface-variant text-sm mb-6">Earn 1–5 points every 5 minutes</p>

        <button
          onClick={handleClaim}
          disabled={!canClaim || claiming}
          className={`w-full py-4 text-lg font-bold rounded-xl transition-all duration-300 ${
            canClaim
              ? 'bg-gradient-primary text-white hover:shadow-lg hover:shadow-primary/25 hover:scale-[1.02]'
              : 'bg-surface-container-highest text-on-surface-variant cursor-not-allowed'
          }`}
        >
          {claiming ? 'Processing...' : canClaim ? '⚡ CLAIM NOW' : `Wait ${formatTime(countdown)}`}
        </button>

        <p className="text-xs text-on-surface-variant mt-4">
          ⚠️ You must complete a shortlink to verify your claim
        </p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
        <div className="stat-card text-center">
          <p className="text-2xl font-bold text-success">{status?.todayClaims || 0}</p>
          <p className="text-xs text-on-surface-variant">Today's Claims</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-2xl font-bold">{status?.totalFaucetEarnings?.toLocaleString() || 0}</p>
          <p className="text-xs text-on-surface-variant">Total Earned</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-2xl font-bold text-primary">1-5</p>
          <p className="text-xs text-on-surface-variant">Points/Claim</p>
        </div>
      </div>

      {/* Side Ad */}
      <div className="glass-card p-4 text-center text-on-surface-variant text-sm border border-dashed border-white/10 max-w-xs mx-auto">
        <p>📢 Sidebar Ad (300x250)</p>
      </div>
    </div>
  );
}
