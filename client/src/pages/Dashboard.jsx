import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { HiTrendingUp, HiCurrencyDollar, HiUsers, HiGift, HiBriefcase, HiLink, HiCash } from 'react-icons/hi';

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard')
      .then(res => setData(res.data))
      .catch(err => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const claimDailyBonus = async () => {
    try {
      const res = await api.post('/dashboard/daily-bonus');
      toast.success(res.data.message);
      // Refresh data
      const updated = await api.get('/dashboard');
      setData(updated.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to claim bonus');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const stats = data?.stats || {};
  const txns = data?.recentTransactions || [];

  const typeIcons = {
    faucet: <HiGift className="text-green-400" />,
    offerwall: <HiBriefcase className="text-amber-400" />,
    shortlink: <HiLink className="text-blue-400" />,
    referral: <HiUsers className="text-purple-400" />,
    withdrawal: <HiCash className="text-red-400" />,
    daily_bonus: <HiGift className="text-cyan-400" />,
    admin_adjust: <HiCurrencyDollar className="text-yellow-400" />
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="stat-card">
          <div className="flex items-center justify-between">
            <span className="text-sm text-on-surface-variant">Total Balance</span>
            <HiTrendingUp className="text-success" />
          </div>
          <p className="text-3xl font-bold glow-text">{data?.user?.points?.toLocaleString()}</p>
          <p className="text-xs text-on-surface-variant">≈ {data?.user?.ltcEquivalent?.toFixed(6)} LTC</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="stat-card">
          <div className="flex items-center justify-between">
            <span className="text-sm text-on-surface-variant">Total Earned</span>
            <HiCurrencyDollar className="text-primary" />
          </div>
          <p className="text-3xl font-bold">{stats.totalEarned?.toLocaleString()}</p>
          <p className="text-xs text-on-surface-variant">Lifetime earnings</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="stat-card">
          <div className="flex items-center justify-between">
            <span className="text-sm text-on-surface-variant">Referral Earnings</span>
            <HiUsers className="text-secondary" />
          </div>
          <p className="text-3xl font-bold">{stats.referralEarnings?.toLocaleString()}</p>
          <p className="text-xs text-on-surface-variant">{stats.referralCount} referrals</p>
        </motion.div>
      </div>

      {/* Quick Actions + Daily Bonus */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h3 className="font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { to: '/faucet', icon: HiGift, label: 'Claim Faucet', color: 'text-green-400' },
              { to: '/offerwalls', icon: HiBriefcase, label: 'Offerwalls', color: 'text-amber-400' },
              { to: '/withdraw', icon: HiCurrencyDollar, label: 'Withdraw', color: 'text-blue-400' },
              { to: '/referrals', icon: HiUsers, label: 'Referrals', color: 'text-purple-400' }
            ].map(a => (
              <a key={a.to} href={a.to} className="glass-card-hover p-4 flex flex-col items-center gap-2 text-center">
                <a.icon className={`w-8 h-8 ${a.color}`} />
                <span className="text-xs font-medium">{a.label}</span>
              </a>
            ))}
          </div>
        </div>

        <div className="glass-card p-6">
          <h3 className="font-semibold mb-4">Daily Bonus</h3>
          <div className="flex items-center gap-2 mb-4">
            {[1, 2, 3, 4, 5, 6, 7].map(d => (
              <div key={d} className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all ${d <= (stats.dailyStreak || 0) ? 'bg-primary text-white' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                {d}
              </div>
            ))}
          </div>
          <p className="text-sm text-on-surface-variant mb-3">
            Current streak: <span className="text-primary font-bold">{stats.dailyStreak || 0}</span> days
          </p>
          <button onClick={claimDailyBonus} disabled={!stats.canClaimDaily} className={`w-full ${stats.canClaimDaily ? 'btn-primary' : 'btn-secondary opacity-50 cursor-not-allowed'}`}>
            {stats.canClaimDaily ? '🎁 Claim Daily Bonus' : 'Already Claimed Today'}
          </button>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="glass-card p-6">
        <h3 className="font-semibold mb-4">Recent Transactions</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-on-surface-variant text-left">
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">Details</th>
                <th className="pb-3 font-medium">Points</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {txns.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-on-surface-variant">No transactions yet. Start earning!</td></tr>
              ) : txns.map(tx => (
                <tr key={tx._id} className="hover:bg-surface-container-high/50 transition-colors">
                  <td className="py-3 flex items-center gap-2 capitalize">
                    {typeIcons[tx.type]} {tx.type.replace('_', ' ')}
                  </td>
                  <td className="py-3 text-on-surface-variant">{tx.details || '—'}</td>
                  <td className={`py-3 font-medium ${tx.points >= 0 ? 'text-success' : 'text-error'}`}>
                    {tx.points >= 0 ? '+' : ''}{tx.points}
                  </td>
                  <td className="py-3">
                    <span className={`badge-${tx.status === 'completed' ? 'success' : tx.status === 'pending' ? 'pending' : 'error'}`}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="py-3 text-on-surface-variant">{new Date(tx.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
