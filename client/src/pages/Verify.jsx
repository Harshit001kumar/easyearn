import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

export default function Verify() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [result, setResult] = useState(null);
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }

    api.get(`/faucet/verify?token=${token}`)
      .then(res => {
        setStatus('success');
        setResult(res.data);
        toast.success(res.data.message);
      })
      .catch(err => {
        setStatus('error');
        toast.error(err.response?.data?.error || 'Verification failed');
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-10 max-w-md w-full text-center">
        {status === 'verifying' && (
          <>
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <h2 className="text-xl font-bold mb-2">Verifying...</h2>
            <p className="text-on-surface-variant text-sm">Please wait while we verify your claim.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">✅</span>
            </div>
            <h2 className="text-xl font-bold mb-2">Claim Successful!</h2>
            <p className="text-3xl font-bold glow-text my-4">+{result?.pointsEarned} Points</p>
            <p className="text-on-surface-variant text-sm mb-6">New balance: {result?.newBalance?.toLocaleString()} Points</p>
            <button onClick={() => navigate('/faucet')} className="btn-primary">
              Back to Faucet
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-error/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">❌</span>
            </div>
            <h2 className="text-xl font-bold mb-2">Verification Failed</h2>
            <p className="text-on-surface-variant text-sm mb-6">The token is invalid, expired, or already used.</p>
            <button onClick={() => navigate('/faucet')} className="btn-primary">
              Try Again
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
