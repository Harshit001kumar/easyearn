import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HiLightningBolt, HiBriefcase, HiLink, HiCurrencyDollar, HiShieldCheck, HiUsers } from 'react-icons/hi';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } })
};

export default function Landing() {
  return (
    <div className="min-h-screen bg-surface">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold glow-text">FreeCash</h1>
          <div className="hidden md:flex items-center gap-8 text-sm text-on-surface-variant">
            <a href="#how" className="hover:text-on-surface transition">How It Works</a>
            <a href="#features" className="hover:text-on-surface transition">Features</a>
            <a href="#withdraw" className="hover:text-on-surface transition">Withdraw</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="btn-secondary text-sm py-2 px-4">Login</Link>
            <Link to="/register" className="btn-primary text-sm py-2 px-4">Sign Up</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero" />
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, rgba(139,92,246,0.3) 0%, transparent 50%), radial-gradient(circle at 70% 50%, rgba(6,182,212,0.2) 0%, transparent 50%)' }} />
        <div className="relative max-w-7xl mx-auto px-6 py-32 md:py-40">
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="max-w-3xl">
            <h1 className="text-5xl md:text-7xl font-extrabold leading-tight mb-6">
              Earn <span className="glow-text">Crypto</span> & <span className="glow-text">Cash</span>.
              <br />Anytime. Anywhere.
            </h1>
            <p className="text-lg md:text-xl text-on-surface-variant max-w-2xl mb-10">
              Complete simple tasks, claim faucets, and withdraw your earnings in Litecoin or INR via UPI. No minimums, just rewards.
            </p>
            <div className="flex gap-4">
              <Link to="/register" className="btn-primary text-lg py-4 px-8">Start Earning →</Link>
              <a href="#how" className="btn-secondary text-lg py-4 px-8">Learn More</a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-surface-container-low py-12">
        <div className="max-w-5xl mx-auto grid grid-cols-3 gap-8 text-center">
          {[
            { label: 'Total Users', value: '5,200+' },
            { label: 'Total Payouts', value: '$12,400+' },
            { label: 'Tasks Available', value: '500+' }
          ].map((stat, i) => (
            <motion.div key={stat.label} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <p className="text-3xl md:text-4xl font-bold glow-text">{stat.value}</p>
              <p className="text-on-surface-variant mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section id="how" className="py-24 max-w-6xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">How It Works</h2>
        <div className="grid md:grid-cols-4 gap-8">
          {[
            { icon: HiUsers, title: 'Register', desc: 'Create a free account in seconds' },
            { icon: HiBriefcase, title: 'Complete Tasks', desc: 'Offerwalls, surveys, and shortlinks' },
            { icon: HiLightningBolt, title: 'Earn Points', desc: '1 Point = 0.00001 LTC' },
            { icon: HiCurrencyDollar, title: 'Withdraw', desc: 'Cash out in LTC or INR (UPI)' }
          ].map((step, i) => (
            <motion.div key={step.title} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="glass-card p-6 text-center">
              <step.icon className="w-12 h-12 mx-auto text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
              <p className="text-sm text-on-surface-variant">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-surface-container-low">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">Earning Methods</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: HiLightningBolt, title: 'Faucet', desc: 'Claim free points every 5 minutes. Quick and easy.', color: 'text-green-400' },
              { icon: HiBriefcase, title: 'Offerwalls', desc: 'Complete surveys, install apps, and complete tasks for big rewards via RevToo.', color: 'text-amber-400' },
              { icon: HiLink, title: 'Shortlinks', desc: 'Visit shortlinks via ShrinkMe and earn points after verification.', color: 'text-blue-400' }
            ].map((f, i) => (
              <motion.div key={f.title} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="glass-card-hover p-8">
                <f.icon className={`w-10 h-10 ${f.color} mb-4`} />
                <h3 className="text-xl font-semibold mb-2">{f.title}</h3>
                <p className="text-on-surface-variant">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Withdraw */}
      <section id="withdraw" className="py-24 max-w-6xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">Withdrawal Options</h2>
        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {[
            { title: 'Litecoin (LTC)', desc: 'Withdraw directly to your LTC wallet', badge: 'Crypto', color: 'border-amber-500/30' },
            { title: 'INR via UPI', desc: 'Instant withdrawal to your UPI ID', badge: 'Fiat', color: 'border-green-500/30' }
          ].map((w, i) => (
            <motion.div key={w.title} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className={`glass-card p-8 border ${w.color}`}>
              <span className="badge bg-primary/20 text-primary mb-4">{w.badge}</span>
              <h3 className="text-xl font-semibold mb-2">{w.title}</h3>
              <p className="text-on-surface-variant mb-4">{w.desc}</p>
              <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                <HiShieldCheck className="text-success" />
                <span>Minimum $1.00 equivalent</span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-surface-container-low border-t border-white/5 py-12">
        <div className="max-w-6xl mx-auto px-6 text-center text-on-surface-variant text-sm">
          <p className="mb-2">© {new Date().getFullYear()} FreeCash. All rights reserved.</p>
          <p>Earn crypto responsibly. 1 Point = 0.00001 LTC.</p>
        </div>
      </footer>
    </div>
  );
}
