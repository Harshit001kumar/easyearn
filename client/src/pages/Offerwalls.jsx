import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { HiBriefcase, HiExternalLink, HiLightningBolt, HiStar } from 'react-icons/hi';

export default function Offerwalls() {
  const { user } = useAuth();

  const offerwalls = [
    {
      name: 'RevToo',
      desc: 'Complete surveys, install apps, watch videos, and sign up for services to earn big rewards.',
      badge: 'High Paying',
      color: 'border-violet-500/30',
      badgeColor: 'bg-violet-500/20 text-violet-400',
      earnings: 'Up to 1,000 Points per offer',
      url: `https://wall.revtoo.com/?apiKey=lt0au9qtus3tljbaf1pbmbpq3kefcc&userId=${user?.id}`
    }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Offerwalls</h1>
        <p className="text-on-surface-variant mt-1">Complete tasks and earn points instantly</p>
      </div>

      {/* Offerwall Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {offerwalls.map((wall, i) => (
          <motion.div
            key={wall.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`glass-card p-8 border ${wall.color} hover:shadow-lg transition-all duration-300`}
          >
            <div className="flex items-start justify-between mb-4">
              <HiBriefcase className="w-10 h-10 text-primary" />
              <span className={`badge ${wall.badgeColor}`}>{wall.badge}</span>
            </div>
            <h3 className="text-xl font-bold mb-2">{wall.name}</h3>
            <p className="text-on-surface-variant text-sm mb-4">{wall.desc}</p>
            <div className="flex items-center gap-2 text-sm text-success mb-6">
              <HiStar className="w-4 h-4" />
              <span>{wall.earnings}</span>
            </div>
            <a href={wall.url} target="_blank" rel="noopener noreferrer" className="btn-primary inline-flex items-center gap-2">
              Start Earning <HiExternalLink />
            </a>
          </motion.div>
        ))}
      </div>

      {/* How It Works */}
      <div className="glass-card p-8">
        <h3 className="text-lg font-semibold mb-6">How It Works</h3>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { step: '1', title: 'Open RevToo', desc: 'Click "Start Earning" to open the offerwall' },
            { step: '2', title: 'Complete the Task', desc: 'Follow instructions carefully to earn credit' },
            { step: '3', title: 'Earn 60% Reward', desc: 'Points are credited automatically via postback' }
          ].map(s => (
            <div key={s.step} className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center mx-auto mb-3 font-bold text-lg">{s.step}</div>
              <h4 className="font-semibold mb-1">{s.title}</h4>
              <p className="text-sm text-on-surface-variant">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
