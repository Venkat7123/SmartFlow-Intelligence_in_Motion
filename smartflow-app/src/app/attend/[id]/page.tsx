'use client';
import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Search, Bell, Calendar, Clock, MapPin, Ticket, Users, CheckCircle, AlertOctagon, ShieldAlert, Loader2 } from 'lucide-react';
import { MobileNav } from '@/components/layout/AppNav';
import { useAuth } from '@/context/AuthContext';
import { getEventById, addUserEvent } from '@/lib/firebase/db';
import { Event } from '@/types';

export default function AttendPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [event, setEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stand, setStand] = useState('');
  const [section, setSection] = useState('');
  const [row, setRow] = useState('');
  const [seat, setSeat] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState('');

  // Checklist states
  const [itemsChecked, setItemsChecked] = useState<Record<string, boolean>>({
    bottles: false,
    bags: false,
    cameras: false,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    async function load() {
      try {
        const data = await getEventById(id);
        setEvent(data as Event);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [user, authLoading, id]);

  const toggleItem = (key: string) => {
    setItemsChecked(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleEnroll = async () => {
    if (!user || !event) return;
    setEnrolling(true);
    setEnrollError('');
    try {
      await addUserEvent(user.uid, {
        ...event,
        // persist extra seat details if provided
        ...(stand && { stand }),
        ...(section && { section }),
        ...(row && { row }),
        ...(seat && { seat }),
      });
      router.push(`/event/${id}`);
    } catch (err: any) {
      console.error('Enrollment failed', err);
      setEnrollError(err?.message || 'Could not enroll. Please try again.');
      setEnrolling(false);
    }
  };

  if (isLoading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
  if (!event) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Event not found</div>;


  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: 'var(--white)', borderBottom: '1px solid var(--border)', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 90 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/discover" style={{ color: 'var(--text-secondary)' }}><ChevronLeft size={20} /></Link>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Confirm Attendance</span>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <Search size={18} color="var(--text-secondary)" style={{ cursor: 'pointer' }} />
          <Bell size={18} color="var(--text-secondary)" style={{ cursor: 'pointer' }} />
        </div>
      </div>

      <div style={{ maxWidth: 1060, margin: '0 auto', padding: '32px 24px', display: 'grid', gridTemplateColumns: '1fr 320px', gap: 32 }}>
        {/* LEFT – Form */}
        <div className="card" style={{ padding: 36 }}>
          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--cyan-soft)', border: '2px solid var(--cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={13} color="var(--cyan-dark)" />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--cyan-dark)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              STEP 2 OF 2: DETAILS
            </span>
          </div>

          <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 10 }}>Finalize Your Seat</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 32, lineHeight: 1.6 }}>
            Enter your ticket details to personalize your real-time crowd guide and gate predictions.
          </p>

          {/* Seat form */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 32 }}>
            <div className="form-group">
              <label className="form-label">Stand / Tier</label>
              <input type="text" className="form-input" placeholder="e.g. North Stand" value={stand} onChange={e => setStand(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Section</label>
              <input type="text" className="form-input" placeholder="e.g. 204" value={section} onChange={e => setSection(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Row</label>
              <input type="text" className="form-input" placeholder="e.g. G" value={row} onChange={e => setRow(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Seat Number</label>
              <input type="text" className="form-input" placeholder="e.g. 42" value={seat} onChange={e => setSeat(e.target.value)} />
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', marginBottom: 28 }} />

          {/* Pre-event checklist */}
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Stadium Safety Checklist</h2>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>Confirm you have reviewed the following restricted items to ensure a smooth entry.</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
            {[
              { key: 'bottles', label: 'No Glass or Metal Bottles', desc: 'Only sealed plastic water bottles under 500ml allowed', icon: AlertOctagon, color: 'var(--danger)' },
              { key: 'bags', label: 'Large Bag Restriction', desc: 'Bags must be smaller than 30cm x 30cm or clear', icon: ShieldAlert, color: 'var(--warning)' },
              { key: 'cameras', label: 'No Pro Photography', desc: 'Lenses over 6 inches require a media pass', icon: Users, color: 'var(--text-muted)' },
            ].map(item => (
              <label key={item.key} style={{ 
                display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px', 
                border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer', 
                transition: 'all 0.15s', background: itemsChecked[item.key] ? 'rgba(16,185,129,0.04)' : 'white',
                borderColor: itemsChecked[item.key] ? 'rgba(16,185,129,0.3)' : 'var(--border)'
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <item.icon size={18} color={item.color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{item.desc}</div>
                </div>
                <input 
                  type="checkbox" 
                  checked={itemsChecked[item.key]} 
                  onChange={() => toggleItem(item.key)} 
                  style={{ width: 18, height: 18, accentColor: 'var(--success)', cursor: 'pointer' }} 
                />
              </label>
            ))}

            {/* Digital ticket – verified */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12, background: 'rgba(16,185,129,0.04)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Ticket size={18} color="var(--success)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--success)' }}>Digital Ticket Linked</div>
                <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 2 }}>SmartFlow has verified your ticket access</div>
              </div>
              <span className="badge badge-green" style={{ fontSize: 10 }}>Verified</span>
            </div>
          </div>

          {enrollError && (
            <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--danger)', fontSize: 13 }}>
              {enrollError}
            </div>
          )}
          <button
            onClick={handleEnroll}
            disabled={enrolling}
            className="btn btn-primary btn-full btn-lg"
            style={{ borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: enrolling ? 0.8 : 1, cursor: enrolling ? 'not-allowed' : 'pointer' }}
          >
            {enrolling ? (
              <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Enrolling…</>
            ) : (
              'Unlock Live Event Dashboard →'
            )}
          </button>
        </div>

        {/* RIGHT – Event Summary */}
        <div>
          {/* Event card */}
          <div className="card" style={{ overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ position: 'relative', height: 130 }}>
              <img src={event.imageUrl} alt={event.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)' }} />
              <span className="badge" style={{ position: 'absolute', top: 10, left: 10, background: 'var(--cyan)', color: 'var(--dark)', fontSize: 10 }}>{event.category}</span>
              <h2 style={{ position: 'absolute', bottom: 12, left: 14, color: 'white', fontWeight: 800, fontSize: 17 }}>{event.venue}</h2>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: 'var(--text-primary)' }}>{event.title}</div>
              {[
                { icon: Calendar, text: `${event.date} • ${event.venue}` },
                { icon: Clock, text: 'Gates open 2h before kickoff' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  <Icon size={13} /> {text}
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--cyan-dark)', fontWeight: 600 }}>
                <MapPin size={13} /> Recommended Gate B
              </div>
            </div>
          </div>

          {/* Recommended Gate */}
          <div className="card" style={{ padding: 20, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, fontSize: 14, fontWeight: 700 }}>
              🎯 Recommended Gate
            </div>
            <div style={{ background: 'var(--cyan-soft)', border: '1px solid rgba(0,229,255,0.3)', borderRadius: 12, padding: '16px', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>ENTRY PREDICTION</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--cyan-dark)' }}>GATE B</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>WAIT TIME</div>
                  <div style={{ fontSize: 22, fontWeight: 900 }}>8 min</div>
                </div>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 14 }}>
              Based on your section (<strong>{section || 'N/A'}</strong>), Gate B offers the most direct route and lowest crowd density at your expected arrival time.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex' }}>
                {['photo-1472099645785-5658abf4ff4e', 'photo-1494790108377-be9c29b29330', 'photo-1507003211169-0a1dd7228f2d'].map((id, i) => (
                  <img key={id} src={`https://images.unsplash.com/${id}?w=40&q=80`} alt="" style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid white', marginLeft: i ? -6 : 0, objectFit: 'cover' }} />
                ))}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>12k</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{event.currentCrowd || '12,400'} fans have already confirmed via SmartFlow.</span>
            </div>
          </div>

          <div className="card" style={{ padding: 16, textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>Need help with your ticket?</p>
            <Link href="#" style={{ fontSize: 14, color: 'var(--cyan-dark)', fontWeight: 600 }}>Contact Venue Support</Link>
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: '20px 16px', background: 'var(--white)', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
        © 2024 SmartFlow Technologies. All event data is provided in real-time.{' '}
        <Link href="#" style={{ color: 'var(--text-secondary)' }}>Privacy Policy</Link>{' '}
        <Link href="#" style={{ color: 'var(--text-secondary)' }}>Terms of Service</Link>
      </div>

      <MobileNav />
    </div>
  );
}
