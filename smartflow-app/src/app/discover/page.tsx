'use client';
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Search, SlidersHorizontal, Bookmark, Clock } from 'lucide-react';
import { Sidebar, MobileNav } from '@/components/layout/AppNav';
import { PageHeader } from '@/components/layout/PageHeader';
import { EventCard } from '@/components/discover/EventCard';
import { getEvents } from '@/lib/firebase/db';
import { useAuth } from '@/context/AuthContext';
import { Event } from '@/types';

const categories = ['IPL Cricket', 'Football', 'Concert'];
const locations = ['Chennai', 'Bengaluru', 'Mumbai', 'Kolkata', 'Delhi', 'Hyderabad'];

export default function DiscoverPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showLive, setShowLive] = useState(true);
  const [showUpcoming, setShowUpcoming] = useState(true);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [activeView, setActiveView] = useState<'Recent' | 'Saved'>('Recent');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    async function loadEvents() {
      try {
        const data = await getEvents();
        setEvents(data as Event[]);
      } catch (err) {
        console.error('Error fetching global events:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadEvents();
  }, [user, authLoading]);

  const toggleCategory = (c: string) =>
    setSelectedCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  const sortedAndFilteredEvents = events
    .filter(e => {
      // @ts-ignore
      const loc = e.location || 'Chennai';

      // Filter out events that have ended (5 hours post-kickoff)
      const evDate = new Date(`${e.date} ${e.time}`);
      const now = new Date();
      if (!isNaN(evDate.getTime())) {
        const hasEnded = now.getTime() > evDate.getTime() + 5 * 60 * 60 * 1000;
        if (hasEnded) return false;
      }

      if (selectedCategories.length && !selectedCategories.includes(e.category)) return false;
      if (showLive && !showUpcoming && !e.isLive) return false;
      if (!showLive && showUpcoming && e.isLive) return false;
      if (selectedLocations.length && !selectedLocations.includes(loc)) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.isLive && !b.isLive) return -1;
      if (!a.isLive && b.isLive) return 1;
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateA - dateB;
    });

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <PageHeader title="Explore Events" />

        <div className="page-body">
          <div className="discover-grid">
            {/* ===== FILTER SIDEBAR ===== */}
            <aside>
              <div 
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', paddingBottom: 16, borderBottom: '1px solid var(--border)' }}
                onClick={() => setIsFilterOpen(!isFilterOpen)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                  <SlidersHorizontal size={15} color="var(--cyan-dark)" />
                  Filters
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button style={{ fontSize: 12, color: 'var(--cyan-dark)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); setSelectedCategories([]); setSelectedLocations([]); setShowLive(true); setShowUpcoming(true); }}
                  >
                    Reset All
                  </button>
                  <span className="filter-toggle-icon" style={{ color: 'var(--text-muted)' }}>
                    {isFilterOpen ? '▲' : '▼'}
                  </span>
                </div>
              </div>

              <div className={`filter-content ${isFilterOpen ? 'open' : ''}`} style={{ paddingTop: 20 }}>

              {/* Categories */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 12 }}>Categories</div>
                {categories.map(c => (
                  <label key={c} className="checkbox-item">
                    <input type="checkbox" checked={selectedCategories.includes(c)} onChange={() => toggleCategory(c)} />
                    {c}
                  </label>
                ))}
              </div>

              {/* Locations */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 12 }}>Locations</div>
                {locations.map(loc => (
                  <label key={loc} className="checkbox-item">
                    <input type="checkbox"
                      checked={selectedLocations.includes(loc)}
                      onChange={() => setSelectedLocations(prev => prev.includes(loc) ? prev.filter(x => x !== loc) : [...prev, loc])}
                    />
                    {loc}
                  </label>
                ))}
              </div>

              {/* Event Status */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 12 }}>Event Status</div>
                <label className="checkbox-item" style={{ color: 'var(--danger)' }}>
                  <input type="checkbox" checked={showLive} onChange={e => setShowLive(e.target.checked)} style={{ accentColor: 'var(--danger)' }} />
                  Live Now
                </label>
                <label className="checkbox-item">
                  <input type="checkbox" checked={showUpcoming} onChange={e => setShowUpcoming(e.target.checked)} />
                  Upcoming
                </label>
              </div>

              {/* AI Tip */}
              <div style={{ background: 'var(--cyan-soft)', border: '1px solid rgba(0,229,255,0.2)', borderRadius: 'var(--radius-md)', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: 'var(--cyan-dark)', fontWeight: 700, fontSize: 13 }}>
                  ⚡ SmartFlow Tip
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Select your city from the top bar to see events happening near you!
                </p>
              </div>
              </div>
            </aside>

            {/* ===== MAIN CONTENT ===== */}
            <main>
              <div className="discover-header">
                <div>
                  <h1 style={{ fontSize: 22, fontWeight: 900 }}>Explore Live Events</h1>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
                    Browse IPL cricket, football and concerts across India.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button onClick={() => setActiveView('Recent')} className={`btn btn-sm ${activeView === 'Recent' ? 'btn-dark' : 'btn-outline'}`} style={{ borderRadius: 8, gap: 6 }}>
                    <Clock size={13} /> Recent
                  </button>
                  <button onClick={() => setActiveView('Saved')} className={`btn btn-sm ${activeView === 'Saved' ? 'btn-dark' : 'btn-outline'}`} style={{ borderRadius: 8, gap: 6 }}>
                    <Bookmark size={13} /> Saved
                  </button>
                </div>
              </div>

              {isLoading ? (
                <p style={{ padding: 20, color: 'var(--text-muted)' }}>Loading events...</p>
              ) : (
                <>
                  <div className="grid-2">
                    {sortedAndFilteredEvents.map(event => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>

                  {/* Pagination */}
                  {sortedAndFilteredEvents.length > 0 && (
                    <div style={{ textAlign: 'center', marginTop: 40, color: 'var(--text-secondary)', fontSize: 14 }}>
                      <p style={{ marginBottom: 16 }}>Showing {sortedAndFilteredEvents.length} events</p>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
                        {[1].map((p, i) => (
                          <button
                            key={i}
                            className={`btn btn-sm btn-dark`}
                            style={{ borderRadius: 8, width: 36, padding: '7px 0' }}
                          >
                            {p}
                          </button>
                        ))}
                        <button className="btn btn-sm btn-outline" style={{ borderRadius: 8, width: 36, padding: '7px 0', opacity: 0.5, cursor: 'not-allowed' }}>›</button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {!isLoading && sortedAndFilteredEvents.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
                  <p>No events match your filters. Try adjusting them.</p>
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
