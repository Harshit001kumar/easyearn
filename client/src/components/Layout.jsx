import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { HiHome, HiGift, HiBriefcase, HiLink, HiCurrencyDollar, HiUsers, HiCog, HiLogout, HiShieldCheck, HiStar } from 'react-icons/hi';

const navItems = [
  { to: '/dashboard', icon: HiHome, label: 'Dashboard' },
  { to: '/faucet', icon: HiGift, label: 'Faucet' },
  { to: '/offerwalls', icon: HiBriefcase, label: 'Offerwalls' },
  { to: '/tasks', icon: HiStar, label: 'Sponsors' },
  { to: '/withdraw', icon: HiCurrencyDollar, label: 'Withdraw' },
  { to: '/referrals', icon: HiUsers, label: 'Referrals' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-surface-container-low flex flex-col shrink-0">
        <div className="p-6">
          <h1 className="text-2xl font-bold glow-text">FreeCash</h1>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => isActive ? 'sidebar-link-active' : 'sidebar-link'}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{label}</span>
            </NavLink>
          ))}

          {user?.isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) => isActive ? 'sidebar-link-active' : 'sidebar-link'}
            >
              <HiShieldCheck className="w-5 h-5" />
              <span className="text-sm font-medium">Admin Panel</span>
            </NavLink>
          )}
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gradient-primary flex items-center justify-center text-white font-bold text-sm">
              {user?.email?.[0]?.toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-on-surface truncate">{user?.email}</p>
              <p className="text-xs text-on-surface-variant">{user?.points?.toLocaleString()} pts</p>
            </div>
          </div>
          <button onClick={handleLogout} className="sidebar-link w-full text-error/70 hover:text-error">
            <HiLogout className="w-5 h-5" />
            <span className="text-sm">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-surface/80 backdrop-blur-xl border-b border-white/5 px-8 py-4 flex items-center justify-between">
          <div />
          <div className="flex items-center gap-4">
            <div className="glass-card px-4 py-2 flex items-center gap-2">
              <span className="text-sm text-on-surface-variant">Balance:</span>
              <span className="text-lg font-bold glow-text">{user?.points?.toLocaleString()}</span>
              <span className="text-xs text-on-surface-variant">pts</span>
            </div>
            {user?.discord?.verified && (
              <div className="badge bg-indigo-500/20 text-indigo-400">
                🎮 {user.discord.username}
              </div>
            )}
          </div>
        </header>

        <motion.div
          className="p-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
