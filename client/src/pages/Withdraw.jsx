import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { HiShieldCheck } from 'react-icons/hi';

export default function Withdraw() {
  const { user, refreshUser } = useAuth();
  const [tab, setTab] = useState('LTC');
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    api.get('/withdraw/history').then(res => setHistory(res.data.withdrawals)).catch(() => {});
  }, []);

  const ltcValue = amount ? (parseInt(amount) * 0.00001).toFixed(6) : '0.000000';

  const handleWithdraw = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/withdraw', {
        method: tab,
        amountPoints: parseInt(amount),
        destination
      });
      toast.success(res.data.message);
      setAmount('');
      setDestination('');
      refreshUser();
      const updated = await api.get('/withdraw/history');
      setHistory(updated.data.withdrawals);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Withdrawal failed');
    } finally {
      setLoading(false);
    }
  };

  const linkDiscord = async () => {
    try {
      const res = await api.get('/auth/discord');
      window.open(res.data.url, '_blank', 'width=500,height=700');
    } catch (err) {
      toast.error('Failed to start Discord linking');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Withdraw Funds</h1>
        <p className="text-on-surface-variant mt-1">Convert your points to LTC or INR</p>
      </div>

      {/* Balance Header */}
      <div className="glass-card p-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-on-surface-variant">Available Balance</p>
          <p className="text-3xl font-bold glow-text">{user?.points?.toLocaleString()} <span className="text-lg">pts</span></p>
          <p className="text-xs text-on-surface-variant">≈ {(user?.points * 0.00001).toFixed(6)} LTC</p>
        </div>
        <div className="text-right text-sm text-on-surface-variant">
          <p>Minimum: $1.00 equivalent</p>
          <p>≈ 1,000 points</p>
        </div>
      </div>

      {/* Withdraw Form */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 max-w-xl mx-auto">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {['LTC', 'UPI'].map(t => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 py-3 rounded-xl font-medium transition-all text-sm ${tab === t ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-surface-container-highest text-on-surface-variant'}`}>
              {t === 'LTC' ? '🪙 Litecoin (LTC)' : '💳 INR (UPI)'}
            </button>
          ))}
        </div>

        <form onSubmit={handleWithdraw} className="space-y-4">
          <div>
            <label className="text-sm text-on-surface-variant mb-1 block">
              {tab === 'LTC' ? 'LTC Wallet Address' : 'UPI ID'}
            </label>
            <input
              type="text"
              className="input-field"
              placeholder={tab === 'LTC' ? 'Enter your Litecoin wallet address' : 'yourname@upi'}
              value={destination}
              onChange={e => setDestination(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-sm text-on-surface-variant mb-1 block">Amount (Points)</label>
            <div className="relative">
              <input
                type="number"
                className="input-field pr-16"
                placeholder="Enter amount"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                min="1"
                max={user?.points}
                required
              />
              <button type="button" onClick={() => setAmount(String(user?.points || 0))} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-primary hover:text-primary-light">
                MAX
              </button>
            </div>
            {amount && (
              <p className="text-sm text-on-surface-variant mt-2">
                You will receive: ≈ <span className="text-success font-medium">{ltcValue} LTC</span>
              </p>
            )}
          </div>

          {/* Discord Verification */}
          {!user?.discord?.verified ? (
            <div className="bg-warning/10 border border-warning/20 rounded-xl p-4">
              <p className="text-sm text-warning mb-2">⚠️ You must verify your Discord account before withdrawing</p>
              <button type="button" onClick={linkDiscord} className="bg-indigo-600 text-white text-sm font-medium py-2 px-4 rounded-lg hover:bg-indigo-500 transition">
                🎮 Link Discord
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-success">
              <HiShieldCheck />
              <span>Discord verified: {user.discord.username}</span>
            </div>
          )}

          <button type="submit" disabled={loading || !user?.discord?.verified} className="btn-primary w-full disabled:opacity-50">
            {loading ? 'Processing...' : 'Request Withdrawal'}
          </button>
        </form>
      </motion.div>

      {/* History */}
      <div className="glass-card p-6">
        <h3 className="font-semibold mb-4">Withdrawal History</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-on-surface-variant text-left">
                <th className="pb-3 font-medium">Date</th>
                <th className="pb-3 font-medium">Method</th>
                <th className="pb-3 font-medium">Points</th>
                <th className="pb-3 font-medium">Destination</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {history.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-on-surface-variant">No withdrawals yet</td></tr>
              ) : history.map(w => (
                <tr key={w._id} className="hover:bg-surface-container-high/50 transition-colors">
                  <td className="py-3 text-on-surface-variant">{new Date(w.createdAt).toLocaleDateString()}</td>
                  <td className="py-3">
                    <span className={`badge ${w.method === 'LTC' ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400'}`}>{w.method}</span>
                  </td>
                  <td className="py-3 font-medium">{w.amountPoints.toLocaleString()}</td>
                  <td className="py-3 text-on-surface-variant font-mono text-xs">{w.destination.slice(0, 20)}...</td>
                  <td className="py-3">
                    <span className={`badge-${w.status === 'approved' ? 'success' : w.status === 'pending' ? 'pending' : 'error'}`}>{w.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
