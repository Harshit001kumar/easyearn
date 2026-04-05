import { useState, useEffect } from 'react';
import api from '../api';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { HiClipboardCopy, HiUsers, HiCash } from 'react-icons/hi';

export default function Referrals() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/referrals')
      .then(res => setData(res.data))
      .catch(() => toast.error('Failed to load referral data'))
      .finally(() => setLoading(false));
  }, []);

  const copyLink = () => {
    navigator.clipboard.writeText(data.referralLink);
    toast.success('Referral link copied!');
  };

  const copyCode = () => {
    navigator.clipboard.writeText(data.referralCode);
    toast.success('Referral code copied!');
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Referral Program</h1>
        <p className="text-on-surface-variant mt-1">Earn 10% of your friends' earnings forever</p>
      </div>

      {/* Main Referral Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8">
        <div className="mb-6">
          <label className="text-sm text-on-surface-variant mb-2 block">Your Referral Link</label>
          <div className="flex gap-2">
            <input type="text" readOnly value={data?.referralLink || ''} className="input-field flex-1 font-mono text-sm" />
            <button onClick={copyLink} className="btn-primary flex items-center gap-2 shrink-0">
              <HiClipboardCopy /> Copy
            </button>
          </div>
        </div>

        <div className="mb-6">
          <span className="text-sm text-on-surface-variant">Your Code: </span>
          <button onClick={copyCode} className="inline-flex items-center gap-1 bg-primary/20 text-primary px-3 py-1 rounded-full text-sm font-bold hover:bg-primary/30 transition">
            {data?.referralCode} <HiClipboardCopy className="w-3 h-3" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="stat-card text-center">
            <HiUsers className="w-8 h-8 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold">{data?.totalReferrals || 0}</p>
            <p className="text-xs text-on-surface-variant">Total Referrals</p>
          </div>
          <div className="stat-card text-center">
            <HiUsers className="w-8 h-8 mx-auto text-success mb-2" />
            <p className="text-2xl font-bold text-success">{data?.activeReferrals || 0}</p>
            <p className="text-xs text-on-surface-variant">Active</p>
          </div>
          <div className="stat-card text-center">
            <HiCash className="w-8 h-8 mx-auto text-amber-400 mb-2" />
            <p className="text-2xl font-bold text-amber-400">{data?.totalCommission?.toLocaleString() || 0}</p>
            <p className="text-xs text-on-surface-variant">Points Earned</p>
          </div>
        </div>
      </motion.div>

      {/* How It Works */}
      <div className="glass-card p-8">
        <h3 className="text-lg font-semibold mb-6">How It Works</h3>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { step: '1', title: 'Share Your Link', desc: 'Send your unique referral link to friends' },
            { step: '2', title: 'Friends Sign Up & Earn', desc: 'They register and start completing tasks' },
            { step: '3', title: 'You Get 10%', desc: 'Earn 10% commission on all their earnings' }
          ].map(s => (
            <div key={s.step} className="text-center">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3 font-bold text-lg">{s.step}</div>
              <h4 className="font-semibold mb-1">{s.title}</h4>
              <p className="text-sm text-on-surface-variant">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Referral List */}
      <div className="glass-card p-6">
        <h3 className="font-semibold mb-4">Your Referrals</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-on-surface-variant text-left">
                <th className="pb-3 font-medium">User</th>
                <th className="pb-3 font-medium">Joined</th>
                <th className="pb-3 font-medium">Commission</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {!data?.referrals?.length ? (
                <tr><td colSpan={4} className="py-8 text-center text-on-surface-variant">No referrals yet. Share your link!</td></tr>
              ) : data.referrals.map((r, i) => (
                <tr key={i} className="hover:bg-surface-container-high/50 transition-colors">
                  <td className="py-3">{r.email}</td>
                  <td className="py-3 text-on-surface-variant">{new Date(r.joinedAt).toLocaleDateString()}</td>
                  <td className="py-3 text-success font-medium">+{r.commissionEarned}</td>
                  <td className="py-3">
                    <span className={`badge ${r.isActive ? 'badge-success' : 'bg-gray-500/20 text-gray-400'}`}>
                      {r.isActive ? 'Active' : 'Inactive'}
                    </span>
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
