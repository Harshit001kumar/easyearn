import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { HiStar, HiExternalLink, HiCheckCircle, HiClock, HiXCircle, HiUpload, HiPhotograph, HiX } from 'react-icons/hi';

const IMGBB_API_KEY = '7a4a20ced81eb3bf1c1bca4ab1449659'; // Free ImgBB API key

export default function CustomTasks() {
  const [tasks, setTasks] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // task object or null
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [textProof, setTextProof] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tasksRes, subsRes] = await Promise.all([
        api.get('/tasks'),
        api.get('/tasks/my-submissions')
      ]);
      setTasks(tasksRes.data.tasks);
      setSubmissions(subsRes.data.submissions);
    } catch (err) {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  // Get the user's submission for a specific task
  const getSubmission = (taskId) => {
    return submissions.find(s => s.taskId?._id === taskId || s.taskId === taskId);
  };

  // Upload image to ImgBB
  const uploadToImgBB = async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=a2c27d49d3ba8fc3624da38e50af7dfe`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!data.success) throw new Error('Image upload failed');
    return data.data.url;
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB');
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!modal) return;
    if (modal.reqProof && !imageFile && !textProof.trim()) {
      toast.error('Please provide proof (image or text)');
      return;
    }

    setUploading(true);
    try {
      let proof = textProof.trim();

      // Upload image if selected
      if (imageFile) {
        toast.loading('Uploading image...', { id: 'upload' });
        const imageUrl = await uploadToImgBB(imageFile);
        proof = imageUrl;
        toast.dismiss('upload');
      }

      await api.post(`/tasks/${modal._id}/submit`, { proof });
      toast.success('Proof submitted! Awaiting review.');
      setModal(null);
      setImageFile(null);
      setImagePreview(null);
      setTextProof('');
      loadData();
    } catch (err) {
      toast.dismiss('upload');
      toast.error(err.response?.data?.error || 'Submission failed');
    } finally {
      setUploading(false);
    }
  };

  const statusBadge = (status) => {
    switch (status) {
      case 'pending': return <span className="badge bg-yellow-500/20 text-yellow-400 inline-flex items-center gap-1"><HiClock className="w-3.5 h-3.5" /> Pending</span>;
      case 'approved': return <span className="badge bg-emerald-500/20 text-emerald-400 inline-flex items-center gap-1"><HiCheckCircle className="w-3.5 h-3.5" /> Approved</span>;
      case 'rejected': return <span className="badge bg-red-500/20 text-red-400 inline-flex items-center gap-1"><HiXCircle className="w-3.5 h-3.5" /> Rejected</span>;
      default: return null;
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Sponsors</h1>
        <p className="text-on-surface-variant mt-1">Complete sponsored tasks and earn points</p>
      </div>

      {/* Task Cards */}
      {tasks.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <HiStar className="w-12 h-12 text-on-surface-variant mx-auto mb-4 opacity-40" />
          <p className="text-on-surface-variant">No tasks available right now. Check back later!</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tasks.map((task, i) => {
            const sub = getSubmission(task._id);
            const isDone = sub && (sub.status === 'pending' || sub.status === 'approved');

            return (
              <motion.div
                key={task._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={`glass-card p-6 border transition-all duration-300 ${isDone ? 'border-emerald-500/20 opacity-80' : 'border-violet-500/20 hover:border-violet-500/40 hover:shadow-lg hover:shadow-violet-500/5'}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center">
                    <HiStar className="w-5 h-5 text-violet-400" />
                  </div>
                  {sub ? statusBadge(sub.status) : (
                    <span className="badge bg-violet-500/20 text-violet-400">+{task.rewardAmount} pts</span>
                  )}
                </div>

                <h3 className="text-lg font-bold mb-2">{task.title}</h3>
                <p className="text-on-surface-variant text-sm mb-4 line-clamp-3">{task.description}</p>

                <div className="flex items-center gap-2 text-sm text-emerald-400 mb-5">
                  <HiStar className="w-4 h-4" />
                  <span>Reward: {task.rewardAmount.toLocaleString()} Points</span>
                </div>

                <div className="flex items-center gap-2">
                  {task.link && (
                    <a href={task.link} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs inline-flex items-center gap-1.5 flex-1 justify-center">
                      Open Link <HiExternalLink />
                    </a>
                  )}
                  {!isDone ? (
                    <button onClick={() => setModal(task)} className="btn-primary text-xs flex-1">
                      {task.reqProof ? 'Submit Proof' : 'Claim'}
                    </button>
                  ) : (
                    <button disabled className="btn-primary text-xs flex-1 opacity-50 cursor-not-allowed">
                      {sub.status === 'pending' ? 'Under Review' : 'Completed'}
                    </button>
                  )}
                </div>

                {sub?.status === 'rejected' && sub.reason && (
                  <p className="mt-3 text-xs text-red-400 bg-red-500/10 rounded-lg p-2">Reason: {sub.reason}</p>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Submit Proof Modal */}
      <AnimatePresence>
        {modal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => { if (!uploading) setModal(null); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card p-8 w-full max-w-md border border-violet-500/20"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Submit Proof</h3>
                <button onClick={() => { if (!uploading) setModal(null); }} className="text-on-surface-variant hover:text-on-surface transition">
                  <HiX className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-on-surface-variant mb-1">Task</p>
                <p className="font-semibold">{modal.title}</p>
                <p className="text-sm text-emerald-400 mt-1">+{modal.rewardAmount} pts on approval</p>
              </div>

              {modal.reqProof && (
                <>
                  {/* Image Upload Area */}
                  <div className="mb-4">
                    <label className="text-sm text-on-surface-variant mb-2 block">Upload Screenshot</label>
                    {!imagePreview ? (
                      <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-violet-500/40 transition-colors">
                        <HiPhotograph className="w-10 h-10 text-on-surface-variant mb-2 opacity-40" />
                        <span className="text-sm text-on-surface-variant">Click to upload image</span>
                        <span className="text-xs text-on-surface-variant mt-1 opacity-60">PNG, JPG, GIF up to 10MB</span>
                        <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                      </label>
                    ) : (
                      <div className="relative">
                        <img src={imagePreview} alt="Preview" className="w-full h-40 object-cover rounded-xl border border-white/10" />
                        <button
                          onClick={() => { setImageFile(null); setImagePreview(null); }}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500/80 text-white flex items-center justify-center hover:bg-red-500 transition"
                        >
                          <HiX className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* OR Divider */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-xs text-on-surface-variant">OR paste text/link</span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>

                  {/* Text Proof */}
                  <div className="mb-6">
                    <input
                      type="text"
                      placeholder="e.g. your username or a link..."
                      value={textProof}
                      onChange={(e) => setTextProof(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-surface-container-high border border-white/10 text-sm focus:border-primary/50 focus:outline-none transition"
                      disabled={!!imageFile}
                    />
                  </div>
                </>
              )}

              <button
                onClick={handleSubmit}
                disabled={uploading}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <HiUpload className="w-4 h-4" />
                    Submit
                  </>
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* My Submissions History */}
      {submissions.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="font-semibold mb-4">My Submissions</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-on-surface-variant text-left">
                  <th className="pb-3">Task</th>
                  <th className="pb-3">Reward</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {submissions.map(s => (
                  <tr key={s._id}>
                    <td className="py-3 font-medium">{s.taskId?.title || 'Deleted Task'}</td>
                    <td className="py-3">{s.taskId?.rewardAmount?.toLocaleString() || '—'} pts</td>
                    <td className="py-3">{statusBadge(s.status)}</td>
                    <td className="py-3 text-on-surface-variant">{new Date(s.createdAt).toLocaleDateString()}</td>
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
