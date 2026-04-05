import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { HiUsers, HiClock, HiCurrencyDollar, HiTrendingUp } from 'react-icons/hi';

export default function AdminPanel() {
  const [stats, setStats] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, wdRes, usersRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/withdrawals'),
        api.get('/admin/users')
      ]);
      setStats(statsRes.data);
      setWithdrawals(wdRes.data.withdrawals);
      setUsers(usersRes.data.users);
    } catch (err) {
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawal = async (id, status) => {
    try {
      await api.patch(`/admin/withdrawals/${id}`, { status });
      toast.success(`Withdrawal ${status}`);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const handleBan = async (userId) => {
    try {
      const res = await api.patch(`/admin/users/${userId}/ban`);
      toast.success(res.data.message);
      loadData();
    } catch (err) {
      toast.error('Failed');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-error">Admin Panel</h1>

      {/* Tabs */}
      <div className="flex gap-2">
        {['overview', 'withdrawals', 'users'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-xl text-sm font-medium transition ${tab === t ? 'bg-primary/20 text-primary' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: HiUsers, label: 'Total Users', value: stats?.totalUsers, color: 'text-primary' },
            { icon: HiClock, label: 'Pending Withdrawals', value: stats?.pendingWithdrawals, color: 'text-warning' },
            { icon: HiTrendingUp, label: 'Points Distributed', value: stats?.totalPointsDistributed?.toLocaleString(), color: 'text-success' },
            { icon: HiCurrencyDollar, label: 'Total Withdrawn', value: stats?.totalWithdrawn?.toLocaleString(), color: 'text-error' }
          ].map(s => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="stat-card">
              <s.icon className={`w-6 h-6 ${s.color}`} />
              <p className="text-2xl font-bold">{s.value || 0}</p>
              <p className="text-xs text-on-surface-variant">{s.label}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Withdrawals */}
      {tab === 'withdrawals' && (
        <div className="glass-card p-6">
          <h3 className="font-semibold mb-4">Pending Withdrawals</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-on-surface-variant text-left">
                  <th className="pb-3">User</th>
                  <th className="pb-3">Discord</th>
                  <th className="pb-3">Points</th>
                  <th className="pb-3">Method</th>
                  <th className="pb-3">Destination</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {withdrawals.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-on-surface-variant">No pending withdrawals</td></tr>
                ) : withdrawals.map(w => (
                  <tr key={w._id}>
                    <td className="py-3">{w.userId?.email}</td>
                    <td className="py-3 text-on-surface-variant">{w.userId?.discord?.username || 'N/A'}</td>
                    <td className="py-3 font-medium">{w.amountPoints.toLocaleString()}</td>
                    <td className="py-3"><span className={`badge ${w.method === 'LTC' ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400'}`}>{w.method}</span></td>
                    <td className="py-3 font-mono text-xs">{w.destination}</td>
                    <td className="py-3 flex gap-2">
                      <button onClick={() => handleWithdrawal(w._id, 'approved')} className="btn-success text-xs">Approve</button>
                      <button onClick={() => handleWithdrawal(w._id, 'rejected')} className="btn-danger text-xs">Reject</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Users */}
      {tab === 'users' && (
        <div className="glass-card p-6">
          <h3 className="font-semibold mb-4">All Users</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-on-surface-variant text-left">
                  <th className="pb-3">Email</th>
                  <th className="pb-3">Points</th>
                  <th className="pb-3">Discord</th>
                  <th className="pb-3">IP</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map(u => (
                  <tr key={u._id}>
                    <td className="py-3">{u.email}</td>
                    <td className="py-3 font-medium">{u.points?.toLocaleString()}</td>
                    <td className="py-3 text-on-surface-variant">{u.discord?.username || '—'}</td>
                    <td className="py-3 font-mono text-xs text-on-surface-variant">{u.ip || '—'}</td>
                    <td className="py-3">{u.isBanned ? <span className="badge-error">Banned</span> : <span className="badge-success">Active</span>}</td>
                    <td className="py-3">
                      <button onClick={() => handleBan(u._id)} className={u.isBanned ? 'btn-success text-xs' : 'btn-danger text-xs'}>
                        {u.isBanned ? 'Unban' : 'Ban'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
