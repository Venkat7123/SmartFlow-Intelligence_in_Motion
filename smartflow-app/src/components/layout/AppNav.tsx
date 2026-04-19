'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Zap, Search, LayoutDashboard, User, LogOut, ChevronsLeft, ChevronsRight, Map } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getUserProfile } from '@/lib/firebase/db';

const navItems = [
  { href: '/dashboard', label: 'My Events', icon: LayoutDashboard },
  { href: '/discover', label: 'Explore', icon: Search },
  { href: '/profile', label: 'Profile', icon: User },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [dbName, setDbName] = useState<string>('');
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    async function load() {
      if (user?.uid) {
        const p = await getUserProfile(user.uid);
        if (p?.name) {
          setDbName(p.name);
        }
      }
    }
    load();
  }, [user]);

  useEffect(() => {
    if (collapsed) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
    return () => document.body.classList.remove('sidebar-collapsed');
  }, [collapsed]);

  const handleLogout = async () => {
    if (!window.confirm('Are you sure you want to logout?')) return;
    try {
      await logout();
      router.push('/');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div style={{ 
        display: 'flex', 
        flexDirection: collapsed ? 'column' : 'row',
        alignItems: 'center', 
        justifyContent: collapsed ? 'center' : 'space-between', 
        gap: collapsed ? 16 : 0,
        marginBottom: 32 
      }}>
        <Link href="/" className="sidebar-logo" style={{ marginBottom: 0, gap: collapsed ? 0 : 10, overflow: 'visible', fontSize: 16 }}>
          <div className="logo-icon" style={{ flexShrink: 0 }}>
            <Zap size={18} fill="currentColor" />
          </div>
          {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>SMARTFLOW</span>}
        </Link>
        <button 
          onClick={() => setCollapsed(!collapsed)} 
          style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: '50%',
            background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'none';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
          }}
        >
          {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
        </button>
      </div>
      <nav className="sidebar-nav">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`sidebar-link ${pathname === href ? 'active' : ''}`}
            title={collapsed ? label : ''}
          >
            <Icon size={16} style={{ flexShrink: 0 }} />
            {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>{label}</span>}
          </Link>
        ))}
      </nav>
      <div style={{ marginTop: 'auto', paddingBottom: 24, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        {!collapsed && user && (
          <div style={{ padding: '0 16px 16px 16px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Logged in as</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.displayName || user.email?.split('@')[0]}
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="sidebar-link"
          style={{ 
            width: '100%', border: 'none', background: 'none', cursor: 'pointer', 
            color: 'var(--danger)', textAlign: 'left',
            display: 'flex', alignItems: 'center', gap: 12
          }}
          title={collapsed ? "Logout" : ''}
        >
          <LogOut size={16} style={{ flexShrink: 0 }} />
          {!collapsed && <span style={{ fontWeight: 600 }}>Logout</span>}
        </button>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="mobile-nav">
      <div className="mobile-nav-inner">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`mobile-nav-item ${pathname === href ? 'active' : ''}`}
          >
            <Icon size={20} />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
