'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ChevronRight } from 'lucide-react';
import { Sidebar, MobileNav } from '@/components/layout/AppNav';
import { PageHeader } from '@/components/layout/PageHeader';
import { getUserProfile, updateUserProfile, getMyEvents } from '@/lib/firebase/db';
import { Event } from '@/types';

function isEventEnded(dateStr: string, timeStr: string) {
  try {
    const raw = new Date(`${dateStr} ${timeStr}`);
    if (isNaN(raw.getTime())) return false;
    // 5 hours after kickoff
    return Date.now() > raw.getTime() + 5 * 60 * 60 * 1000;
  } catch { return false; }
}

export default function ProfilePage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  
  const [profile, setProfile] = useState<any>({
    eventsAttended: 0,
    milesWalked: 0,
    smartEntries: 0,
    ordersMade: 0,
    location: 'Loading...',
  });

  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [pastEvents, setPastEvents] = useState<Event[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    async function loadData() {
      if (!user?.uid) return;
      const [data, events] = await Promise.all([
        getUserProfile(user.uid),
        getMyEvents(user.uid)
      ]);
      
      if (data) {
        setProfile((prev: any) => ({ ...prev, ...data }));
      }
      
      if (events) {
        const evs = events as Event[];
        const upcoming = evs.filter(ev => !isEventEnded(ev.date, ev.time));
        const past = evs.filter(ev => isEventEnded(ev.date, ev.time));
        setUpcomingEvents(upcoming);
        setPastEvents(past);
        
        // Update profile stat if backend didn't provide one or it's 0
        setProfile((prev: any) => ({
          ...prev,
          eventsAttended: Math.max(prev.eventsAttended || 0, past.length)
        }));
      }
    }
    loadData();
  }, [user, authLoading]);

  const stats = [
    { icon: '🏟️', label: 'Events Attended', value: profile.eventsAttended },
    { icon: '📍', label: 'Miles Walked', value: profile.milesWalked },
    { icon: '⚡', label: 'Smart Entries', value: profile.smartEntries },
    { icon: '🛒', label: 'Orders Made', value: profile.ordersMade },
  ];

  const handleSignOut = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error("Failed to log out", error);
    }
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <PageHeader title="My SmartFlow Account" showSearch={false} />

        <div className="page-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: '800px', margin: '0 auto' }}>
            
            {/* Profile header card */}
            <div className="card" style={{ padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 24 }}>
              <div style={{ flex: 1 }}>
                <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 4 }}>{user?.displayName || "Stadium Fan"}</h1>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                  {user?.email || "No email provided"}
                </div>
              </div>
            </div>

            {/* Events Attended / Stats directly below user */}
            <div className="card" style={{ padding: '24px 28px' }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Lifetime Statistics</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>Your overall SmartFlow journey and activity metrics.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {stats.map(s => (
                  <div key={s.label} style={{ padding: '16px 12px', textAlign: 'center', background: 'var(--surface)', borderRadius: 12 }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                    <div style={{ fontSize: 22, fontWeight: 900 }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming events */}
            <div className="card" style={{ padding: '24px 28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800 }}>Upcoming Events</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>Events you are confirmed to attend.</p>
                </div>
                <Link href="/discover" style={{ fontSize: 14, color: 'var(--cyan-dark)', fontWeight: 600 }}>View All</Link>
              </div>
              {upcomingEvents.length > 0 ? (
                upcomingEvents.map(ev => {
                  const evDate = new Date(`${ev.date} ${ev.time}`);
                  const isLive = Date.now() >= evDate.getTime() && Date.now() <= evDate.getTime() + 5 * 60 * 60 * 1000;
                  
                  return (
                    <Link key={ev.id} href={`/event/${ev.id}`} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: isLive ? 'rgba(239,68,68,0.1)' : 'var(--cyan-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {isLive ? '🔴' : '🎟️'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{ev.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>{ev.date} • {ev.venue}</div>
                      </div>
                      {isLive ? (
                        <span className="badge badge-live" style={{ fontSize: 9, padding: '2px 8px' }}>LIVE</span>
                      ) : (
                        <span className="badge badge-cyan" style={{ fontSize: 9 }}>upcoming</span>
                      )}
                      <ChevronRight size={14} color="var(--text-muted)" />
                    </Link>
                  );
                })
              ) : (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
                  No upcoming events.
                  <div style={{ marginTop: 12 }}>
                    <Link href="/discover" className="btn btn-outline btn-sm">Find an Event</Link>
                  </div>
                </div>
              )}
            </div>

            {/* Past events (Archive) */}
            {pastEvents.length > 0 && (
              <div className="card" style={{ padding: '24px 28px' }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Past Events</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>Events you have attended in the past.</p>
                {pastEvents.map(ev => (
                  <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: '1px solid var(--border)', opacity: 0.7 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      🏟️
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{ev.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>{ev.date} • {ev.venue}</div>
                    </div>
                    <span className="badge" style={{ fontSize: 9 }}>concluded</span>
                    <ChevronRight size={14} color="var(--text-muted)" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer style={{ textAlign: 'center', padding: '20px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span>© 2023 SmartFlow Technologies Inc. All rights reserved.</span>
          <div style={{ display: 'flex', gap: 20 }}>
            {['Privacy Policy', 'Terms of Service', 'Accessibility Help'].map(l => (
              <Link key={l} href="#" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{l}</Link>
            ))}
          </div>
        </footer>
      </div>
      <MobileNav />
    </div>
  );
}
