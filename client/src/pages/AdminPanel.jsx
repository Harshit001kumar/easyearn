import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { HiUsers, HiClock, HiCurrencyDollar, HiTrendingUp, HiStar, HiClipboardCheck, HiTrash, HiExternalLink } from 'react-icons/hi';

export default function AdminPanel() {
  const [stats, setStats] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  // Task management state
  const [tasks, setTasks] = useState([]);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', rewardAmount: '', reqProof: true, link: '' });
  const [creatingTask, setCreatingTask] = useState(false);

  // Submission review state
  const [submissions, setSubmissions] = useState([]);
  const [reviewLoading, setReviewLoading] = useState(false);

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

  const loadTasks = async () => {
    try {
      const res = await api.get('/admin/tasks');
      setTasks(res.data.tasks);
    } catch (err) {
      toast.error('Failed to load tasks');
    }
  };

  const loadSubmissions = async () => {
    setReviewLoading(true);
    try {
      const res = await api.get('/admin/task-submissions');
      setSubmissions(res.data.submissions);
    } catch (err) {
      toast.error('Failed to load submissions');
    } finally {
      setReviewLoading(false);
    }
  };

  // Load tasks/submissions when switching to those tabs
  useEffect(() => {
    if (tab === 'tasks') loadTasks();
    if (tab === 'submissions') loadSubmissions();
  }, [tab]);

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

  // ─── Task CRUD ───
  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!taskForm.title || !taskForm.description || !taskForm.rewardAmount) {
      toast.error('Fill in all required fields');
      return;
    }
    setCreatingTask(true);
    try {
      await api.post('/admin/tasks', {
        ...taskForm,
        rewardAmount: Number(taskForm.rewardAmount)
      });
      toast.success('Task created!');
      setTaskForm({ title: '', description: '', rewardAmount: '', reqProof: true, link: '' });
      loadTasks();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create task');
    } finally {
      setCreatingTask(false);
    }
  };

  const handleDeleteTask = async (id) => {
    if (!confirm('Delete this task and all its submissions?')) return;
    try {
      await api.delete(`/admin/tasks/${id}`);
      toast.success('Task deleted');
      loadTasks();
    } catch (err) {
      toast.error('Failed to delete task');
    }
  };

  const handleToggleTask = async (id, isActive) => {
    try {
      await api.patch(`/admin/tasks/${id}`, { isActive: !isActive });
      toast.success(`Task ${!isActive ? 'activated' : 'deactivated'}`);
      loadTasks();
    } catch (err) {
      toast.error('Failed');
    }
  };

  // ─── Submission Review ───
  const handleReviewSubmission = async (id, status, reason = '') => {
    try {
      await api.patch(`/admin/task-submissions/${id}`, { status, reason });
      toast.success(`Submission ${status}`);
      loadSubmissions();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-error">Admin Panel</h1>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {['overview', 'withdrawals', 'users', 'tasks', 'submissions'].map(t => (
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

      {/* ═══ MANAGE TASKS TAB ═══ */}
      {tab === 'tasks' && (
        <div className="space-y-6">
          {/* Create Task Form */}
          <div className="glass-card p-6 border border-violet-500/20">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><HiStar className="w-5 h-5 text-violet-400" /> Create New Task</h3>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-on-surface-variant mb-1 block">Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Join our Discord"
                    value={taskForm.title}
                    onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-surface-container-high border border-white/10 text-sm focus:border-primary/50 focus:outline-none transition"
                  />
                </div>
                <div>
                  <label className="text-sm text-on-surface-variant mb-1 block">Reward (Points) *</label>
                  <input
                    type="number"
                    placeholder="e.g. 500"
                    min="0"
                    value={taskForm.rewardAmount}
                    onChange={e => setTaskForm({ ...taskForm, rewardAmount: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-surface-container-high border border-white/10 text-sm focus:border-primary/50 focus:outline-none transition"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-on-surface-variant mb-1 block">Description *</label>
                <textarea
                  placeholder="Describe what the user needs to do..."
                  rows={3}
                  value={taskForm.description}
                  onChange={e => setTaskForm({ ...taskForm, description: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-high border border-white/10 text-sm focus:border-primary/50 focus:outline-none transition resize-none"
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-on-surface-variant mb-1 block">Task Link (optional)</label>
                  <input
                    type="url"
                    placeholder="https://discord.gg/your-server"
                    value={taskForm.link}
                    onChange={e => setTaskForm({ ...taskForm, link: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-surface-container-high border border-white/10 text-sm focus:border-primary/50 focus:outline-none transition"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={taskForm.reqProof}
                      onChange={e => setTaskForm({ ...taskForm, reqProof: e.target.checked })}
                      className="w-4 h-4 rounded accent-primary"
                    />
                    <span className="text-sm">Require proof (screenshot/text)</span>
                  </label>
                </div>
              </div>
              <button type="submit" disabled={creatingTask} className="btn-primary">
                {creatingTask ? 'Creating...' : 'Create Task'}
              </button>
            </form>
          </div>

          {/* Existing Tasks List */}
          <div className="glass-card p-6">
            <h3 className="font-semibold mb-4">Existing Tasks ({tasks.length})</h3>
            {tasks.length === 0 ? (
              <p className="text-on-surface-variant text-sm py-4 text-center">No tasks created yet.</p>
            ) : (
              <div className="space-y-3">
                {tasks.map(task => (
                  <div key={task._id} className={`flex items-center justify-between p-4 rounded-xl border transition ${task.isActive ? 'border-white/10 bg-surface-container-high/50' : 'border-red-500/20 bg-red-500/5 opacity-60'}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{task.title}</h4>
                        <span className="badge bg-violet-500/20 text-violet-400 text-xs">+{task.rewardAmount} pts</span>
                        {!task.isActive && <span className="badge bg-red-500/20 text-red-400 text-xs">Inactive</span>}
                      </div>
                      <p className="text-sm text-on-surface-variant mt-1 line-clamp-1">{task.description}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleToggleTask(task._id, task.isActive)}
                        className={`text-xs px-3 py-1.5 rounded-lg transition ${task.isActive ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'}`}
                      >
                        {task.isActive ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task._id)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"
                      >
                        <HiTrash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ REVIEW SUBMISSIONS TAB ═══ */}
      {tab === 'submissions' && (
        <div className="glass-card p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><HiClipboardCheck className="w-5 h-5 text-emerald-400" /> Pending Submissions</h3>
          {reviewLoading ? (
            <div className="flex items-center justify-center h-32"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : submissions.length === 0 ? (
            <p className="text-on-surface-variant text-sm py-8 text-center">No pending submissions to review.</p>
          ) : (
            <div className="space-y-4">
              {submissions.map(s => (
                <div key={s._id} className="p-5 rounded-xl border border-white/10 bg-surface-container-high/50 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold">{s.taskId?.title || 'Unknown Task'}</h4>
                      <p className="text-sm text-on-surface-variant">By: <span className="text-on-surface">{s.userId?.email}</span></p>
                      <p className="text-xs text-on-surface-variant mt-1">{new Date(s.createdAt).toLocaleString()}</p>
                    </div>
                    <span className="badge bg-violet-500/20 text-violet-400">+{s.taskId?.rewardAmount || 0} pts</span>
                  </div>

                  {/* Proof Display */}
                  {s.proof && (
                    <div className="mt-2">
                      <p className="text-xs text-on-surface-variant mb-2">Proof Submitted:</p>
                      {s.proof.match(/\.(jpg|jpeg|png|gif|webp)/i) || s.proof.startsWith('https://i.ibb.co') ? (
                        <a href={s.proof} target="_blank" rel="noopener noreferrer">
                          <img src={s.proof} alt="Proof" className="max-w-sm max-h-48 rounded-lg border border-white/10 object-cover hover:opacity-80 transition" />
                        </a>
                      ) : (
                        <a href={s.proof.startsWith('http') ? s.proof : '#'} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all inline-flex items-center gap-1">
                          {s.proof} {s.proof.startsWith('http') && <HiExternalLink className="w-3.5 h-3.5" />}
                        </a>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => handleReviewSubmission(s._id, 'approved')}
                      className="btn-success text-sm flex-1"
                    >
                      ✅ Approve & Credit Points
                    </button>
                    <button
                      onClick={() => {
                        const reason = prompt('Rejection reason (optional):');
                        handleReviewSubmission(s._id, 'rejected', reason || '');
                      }}
                      className="btn-danger text-sm flex-1"
                    >
                      ❌ Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
