'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Zap, Search, Bell, MapPin, ChevronDown, User, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface PageHeaderProps {
  title: string;
  showSearch?: boolean;
  children?: React.ReactNode;
}

export function PageHeader({ title, showSearch = true, children }: PageHeaderProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useState('Loading...');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const CITIES = ['Chennai', 'Bengaluru', 'Mumbai', 'Kolkata', 'Delhi', 'Hyderabad'];

  useEffect(() => {
    const saved = localStorage.getItem('smartflow_loc');
    setLocation(saved || 'Chennai');
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChangeLocation = (city: string) => {
    setLocation(city);
    localStorage.setItem('smartflow_loc', city);
    window.dispatchEvent(new Event('locationChanged'));
    setIsDropdownOpen(false);
  };

  return (
    <header className="page-header">
      <div className="page-title">{title}</div>
      {showSearch && (
        <div className="search-bar">
          <Search size={14} className="search-icon" />
          <input type="text" placeholder="Search teams, venues, or artists..." />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {location !== 'Loading...' && (
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              style={{ 
                display: 'flex', alignItems: 'center', gap: 6, 
                background: 'var(--surface)', border: '1px solid var(--border)', 
                padding: '6px 14px', borderRadius: 20, cursor: 'pointer', 
                color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600,
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--cyan)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
            >
              <MapPin size={14} color="var(--cyan)" />
              {location}
              <ChevronDown size={14} style={{ marginLeft: 2, transform: isDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-muted)' }} />
            </button>
            
            {isDropdownOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 8,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '8px 0', minWidth: 160,
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 100
              }}>
                <div style={{ padding: '4px 16px 8px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Select City
                </div>
                {CITIES.map(city => (
                  <button
                    key={city}
                    onClick={() => handleChangeLocation(city)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '8px 16px', background: 'none', border: 'none',
                      color: location === city ? 'var(--cyan)' : 'var(--text-primary)',
                      fontSize: 13, fontWeight: location === city ? 700 : 500,
                      cursor: 'pointer', transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
                  >
                    {city}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {children}
        <button style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <Bell size={20} />
        </button>

        {/* Profile Dropdown (Mobile Only) */}
        <div className="mobile-profile-only" style={{ position: 'relative' }} ref={profileRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--cyan-soft)', border: '1px solid var(--cyan)', 
              cursor: 'pointer', color: 'var(--cyan-dark)', transition: 'all 0.15s'
            }}
          >
            <User size={16} />
          </button>
          
          {isProfileOpen && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 8,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '8px 0', minWidth: 200,
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 100
            }}>
              {user ? (
                <>
                  <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.displayName || 'User'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.email}
                    </div>
                  </div>
                  <Link href="/profile" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', fontSize: 14, color: 'var(--text-primary)', textDecoration: 'none', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
                  >
                    <User size={14} /> View Profile
                  </Link>
                  <button 
                    onClick={() => {
                      logout();
                      setIsProfileOpen(false);
                    }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', fontSize: 14, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
                  >
                    <LogOut size={14} /> Logout
                  </button>
                </>
              ) : (
                <div style={{ padding: '8px 16px', fontSize: 14, color: 'var(--text-secondary)' }}>Not logged in</div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return <div className="app-layout">{children}</div>;
}
