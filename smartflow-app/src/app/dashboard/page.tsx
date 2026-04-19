'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Plus, MapPin, Calendar, ChevronRight, Bell, Zap } from 'lucide-react';
import { Sidebar, MobileNav } from '@/components/layout/AppNav';
import { PageHeader } from '@/components/layout/PageHeader';
import { EventCard } from '@/components/discover/EventCard';
import { useState, useEffect } from 'react';
import { getEvents, getMyEvents } from '@/lib/firebase/db';
import { useAuth } from '@/context/AuthContext';
import { Event } from '@/types';


function isEventEnded(dateStr: string, timeStr: string) {
  try {
    const raw = new Date(`${dateStr} ${timeStr}`);
    if (isNaN(raw.getTime())) return false;
    // 5 hours after kickoff
    return Date.now() > raw.getTime() + 5 * 60 * 60 * 1000;
  } catch { return false; }
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('Live Now');
  const [discoverEvents, setDiscoverEvents] = useState<Event[]>([]);
  const [userEvents, setUserEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    async function loadData() {
      setIsLoading(true);
      try {
        const events = await getEvents();
        const loc = localStorage.getItem('smartflow_loc') || 'Chennai';
        const filteredEvents = (events as Event[])
          .filter(ev => ev.location === loc)
          .filter(ev => !isEventEnded(ev.date, ev.time))
          .sort((a, b) => {
            if (a.isLive && !b.isLive) return -1;
            if (!a.isLive && b.isLive) return 1;
            return new Date(a.date).getTime() - new Date(b.date).getTime();
          });
        setDiscoverEvents(filteredEvents);
        
        const ownerId = user?.uid || 'u1';
        const myEvts = await getMyEvents(ownerId);
        setUserEvents((myEvts as Event[]).filter(ev => !isEventEnded(ev.date, ev.time)));
      } catch (e) {
        console.error('Failed to grab dashboard data', e);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadData();

    // Listen for custom location changes from the header dropdown
    const handleLocationChange = () => loadData();
    window.addEventListener('locationChanged', handleLocationChange);
    return () => window.removeEventListener('locationChanged', handleLocationChange);
  }, [user, authLoading]);

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <PageHeader title="Your SmartFlow Hub">
          
        </PageHeader>

        <div className="page-body">

          {/* Your Events */}
          <div style={{ marginBottom: 40 }}>
            <div className="section-header">
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>YOUR UPCOMING EVENTS</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Keep track of your registered events and real-time crowd status.
                </p>
              </div>
              <Link href="/discover" className="btn btn-outline btn-sm">View All</Link>
            </div>

            {isLoading ? (
              <p style={{padding: 20, color: 'var(--text-muted)'}}>Loading your events...</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
                {userEvents.map(event => (
                  <div key={event.id} className="card" style={{ overflow: 'hidden', display: 'flex', gap: 16, padding: 16, alignItems: 'flex-start' }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <img src={event.imageUrl} alt={event.title} style={{ width: 80, height: 80, borderRadius: 10, objectFit: 'cover' }} />
                      {event.isLive && (
                        <span className="badge badge-live" style={{ position: 'absolute', top: 4, left: 4, fontSize: 8, padding: '2px 6px' }}>LIVE</span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, lineHeight: 1.3 }}>{event.title}</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 3 }}>
                        <MapPin size={11} /> {event.venue}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
                        <Calendar size={11} /> {event.date} • {event.time}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Link href={`/event/${event.id}`} className="btn btn-primary btn-sm" style={{ borderRadius: 8, whiteSpace: 'nowrap' }}>
                          Launch Guide <ChevronRight size={12} />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add event card */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, border: '2px dashed var(--border)', background: 'transparent', minHeight: 120, cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--cyan)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
                >
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                    <Plus size={18} color="var(--text-muted)" />
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>Add New Event</span>
                </div>
              </div>
            )}
          </div>

          {/* Discover Section */}
          <div>
            <div className="section-header">
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', fontStyle: 'italic' }}>DISCOVER</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Explore what&apos;s happening around you and plan your visit.
                </p>
              </div>
            </div>

            {isLoading ? (
              <p style={{padding: 20, color: 'var(--text-muted)'}}>Discovering events...</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                {discoverEvents.map(event => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            )}

            <div style={{ textAlign: 'center', marginTop: 40, paddingBottom: 24 }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
                You&apos;ve explored all live events in your area.
              </p>
              <button className="btn btn-outline">Load More Events</button>
            </div>
          </div>
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
