'use client';
import { use, useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  ChevronLeft, MapPin, Calendar, AlertTriangle, Clock,
  Ticket, UtensilsCrossed, Cloud, ChevronRight, Activity,
  Zap, Wind, Droplets, Thermometer, Eye, Radio,
  Users, TrendingUp, ShieldCheck, ArrowUp, ArrowDown,
  Navigation, BarChart2,
} from 'lucide-react';
import { MobileNav } from '@/components/layout/AppNav';
import { CrowdBar } from '@/components/ui/CrowdBar';
import { StadiumMap } from '@/components/event/StadiumMap';
import { useAuth } from '@/context/AuthContext';
import { getFoodItems, getEventById, createOrder } from '@/lib/firebase/db';
import { getStadiumConfig, subscribeToGateMetrics, subscribeToStandMetrics, subscribeToStadiumLiveData, predictBestGate, resolveVenueKey, type GateMetric, type StandMetric, type LiveTimeSlot, startDatabaseSimulator } from '@/lib/gateMetricsService';
import { calculateETA } from '@/lib/pathfindingService';
import { FoodItem, Event } from '@/types';
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer,
  Tooltip, ReferenceLine, ReferenceArea, CartesianGrid, BarChart, Bar, Cell,
} from 'recharts';

// Dynamic import so Three.js only loads client-side
const StadiumHeatmap3D = dynamic(
  () => import('@/components/event/StadiumHeatmap3D').then(m => ({ default: m.StadiumHeatmap3D })),
  { ssr: false }
);

// ── IST-aware countdown ────────────────────────────────────────────────────
function parseEventDateIST(dateStr: string, timeStr: string): Date | null {
  try {
    const raw = new Date(`${dateStr} ${timeStr}`);
    if (isNaN(raw.getTime())) return null;
    return raw;
  } catch { return null; }
}

// ── Crowd timeline mock data ───────────────────────────────────────────────
const CROWD_TEMPLATE = [
  { offset: -240, crowd: 4,  wait: 0,  label: 'Gates Open' },
  { offset: -180, crowd: 12, wait: 1,  label: '' },
  { offset: -150, crowd: 28, wait: 7,  label: '' },
  { offset: -120, crowd: 48, wait: 14, label: '-2h' },
  { offset: -90,  crowd: 66, wait: 20, label: '' },
  { offset: -60,  crowd: 80, wait: 25, label: '-1h' },
  { offset: -30,  crowd: 90, wait: 18, label: '' },
  { offset: 0,    crowd: 96, wait: 8,  label: 'Kickoff ⚽' },
  { offset: 45,   crowd: 98, wait: 0,  label: 'HT -5' },
  { offset: 60,   crowd: 44, wait: 12, label: 'Half Time' },
  { offset: 75,   crowd: 95, wait: 0,  label: '' },
  { offset: 105,  crowd: 97, wait: 0,  label: 'Full Time' },
  { offset: 120,  crowd: 70, wait: 22, label: 'Post' },
  { offset: 150,  crowd: 38, wait: 15, label: '' },
  { offset: 180,  crowd: 14, wait: 4,  label: '+3h' },
];

function buildCrowdTimeline(eventDate: Date | null) {
  const base = eventDate ?? new Date(Date.now() + 2 * 60 * 60 * 1000);
  return CROWD_TEMPLATE.map(pt => {
    const ts = new Date(base.getTime() + pt.offset * 60 * 1000);
    const hours = ts.getHours() % 12 || 12;
    const mins = String(ts.getMinutes()).padStart(2, '0');
    const ampm = ts.getHours() >= 12 ? 'PM' : 'AM';
    return { time: `${hours}:${mins} ${ampm}`, crowd: pt.crowd, wait: pt.wait, label: pt.label };
  });
}

// ── Live gate data (simulated real-time) ──────────────────────────────────
const LIVE_GATE_DATA = [
  { gate: 'A', capacity: 92, trend: 'up'   },
  { gate: 'B', capacity: 68, trend: 'down' },
  { gate: 'C', capacity: 38, trend: 'down' },
  { gate: 'D', capacity: 95, trend: 'up'   },
];

// ── Custom tooltip ─────────────────────────────────────────────────────────
function CrowdTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(0,229,255,0.3)',
      borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'white',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}{d.label ? ` · ${d.label}` : ''}</div>
      <div style={{ color: '#00E5FF', marginBottom: 2 }}>Density: {d.density || 0}%</div>
      <div style={{ color: '#94A3B8' }}>Expected Flow: ~{d.flowRate || 0} fans/min</div>
      <div style={{ color: '#10B981' }}>Expected Wait: ~{d.waitMinutes || 0} min</div>
    </div>
  );
}

// ── Pulsing "LIVE" badge ───────────────────────────────────────────────────
function LivePulse({ label = 'LIVE', size = 'md' }: { label?: string; size?: 'sm' | 'md' | 'lg' }) {
  const fs = size === 'sm' ? 9 : size === 'lg' ? 13 : 11;
  const dotSz = size === 'sm' ? 6 : size === 'lg' ? 10 : 8;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
      borderRadius: 20, padding: `3px ${size === 'lg' ? 12 : 8}px`,
      color: '#ef4444', fontWeight: 800, fontSize: fs, letterSpacing: '0.05em',
    }}>
      <span style={{
        width: dotSz, height: dotSz, borderRadius: '50%', background: '#ef4444',
        animation: 'livePulse 1.2s ease-in-out infinite',
        display: 'inline-block', flexShrink: 0,
      }} />
      {label}
    </span>
  );
}

// ── Live crowd stat chip ───────────────────────────────────────────────────
function StatChip({ icon: Icon, value, label, color }: { icon: any; value: string; label: string; color: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <Icon size={14} color={color} />
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

// ── Gate bar color ─────────────────────────────────────────────────────────
const gateColor = (cap: number) =>
  cap >= 85 ? '#ef4444' : cap >= 65 ? '#f97316' : cap >= 45 ? '#f59e0b' : '#10b981';

function getRecommendedArrivalWindow(slots: LiveTimeSlot[]) {
  if (!slots.length) return null;

  const preKickoff = slots.filter(slot => slot.minuteOffset < 0);
  const source = preKickoff.length ? preKickoff : slots;
  const minWait = Math.min(...source.map(slot => slot.waitMinutes));
  const lowWaitSlots = source.filter(slot => slot.waitMinutes <= minWait + 2);

  return {
    start: lowWaitSlots[0],
    end: lowWaitSlots[lowWaitSlots.length - 1],
    minWaitMinutes: minWait,
  };
}

export default function EventDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [event, setEvent] = useState<Event | null>(null);
  const [realGates, setRealGates] = useState<GateMetric[]>([]);
  const [stands, setStands] = useState<StandMetric[]>([]);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [crowdData, setCrowdData] = useState<LiveTimeSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [orderingItemId, setOrderingItemId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState({ h: 0, m: 0, s: 0, live: false, label: '' });
  const [isMatchDay, setIsMatchDay] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const handleExitEvent = async () => {
    if (!user || !event) return;
    setIsExiting(true);
    try {
      const { removeUserEvent } = await import('@/lib/api');
      await removeUserEvent(user.uid, event.id);
      router.push('/dashboard');
    } catch (err) {
      console.error('Failed to exit event:', err);
      alert('Failed to exit event.');
      setIsExiting(false);
    }
  };

  const handlePreOrder = async (item: FoodItem) => {
    if (!user) {
      router.push('/login');
      return;
    }
    setOrderingItemId(item.id);
    try {
      await createOrder(user.uid, {
        name: item.name,
        price: item.price,
        imageUrl: item.imageUrl,
        status: 'preparing',
        eta: '10 mins',
        counter: 'Counter A',
      } as any);
      router.push('/orders');
    } catch (err) {
      console.error('Order error:', err);
      alert('Failed to place order. Try again.');
    } finally {
      setOrderingItemId(null);
    }
  };
  // Live stats that "tick" every 5s to simulate real-time
  const liveGateDensity = realGates.length ? Math.round(realGates.reduce((sum, g) => sum + g.density, 0) / realGates.length) : 0;
  const liveStandOccupancy = stands.length ? Math.round(stands.reduce((sum, s) => sum + s.fillPct, 0) / stands.length) : 0;
  const [liveTemp, setLiveTemp] = useState(32);
  const [liveHumidity, setLiveHumidity] = useState(68);
  const [liveWind, setLiveWind] = useState(14);
  const [matchMin, setMatchMin] = useState(0);
  const [matchScore, setMatchScore] = useState({ home: 0, away: 0 });
  const liveTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Data loading ──────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }

    async function loadData() {
      try {
        const _event = await getEventById(id);
        const _food = await getFoodItems();
        const ev = _event as Event;
        setEvent(ev);
        setFoodItems(_food as FoodItem[]);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [user, authLoading, id]);

  useEffect(() => {
    if (!event) return;
    const venueKey = resolveVenueKey(event.venue || event.title || event.location);
    const evDate = parseEventDateIST(event.date, event.time) || new Date(Date.now() + 2 * 60 * 60 * 1000);

    const unsubGates = subscribeToGateMetrics(m => {
      const filtered = m.filter(g => g.venueKey === venueKey);
      const uniqueGates = Array.from(new Map(filtered.map(g => [g.gateId, g])).values());
      uniqueGates.sort((a, b) => a.gateId.localeCompare(b.gateId));
      setRealGates(prev => JSON.stringify(prev) === JSON.stringify(uniqueGates) ? prev : uniqueGates);
    });

    const unsubStands = subscribeToStandMetrics(m => {
      const filtered = m.filter(s => s.venueKey === venueKey);
      const uniqueStands = Array.from(new Map(filtered.map(s => [s.standId, s])).values());
      setStands(prev => JSON.stringify(prev) === JSON.stringify(uniqueStands) ? prev : uniqueStands);
    });

    const unsubLiveData = subscribeToStadiumLiveData(venueKey, (data) => {
      if (data && data.time_slots) {
        setCrowdData(prev => JSON.stringify(prev) === JSON.stringify(data.time_slots) ? prev : (data.time_slots as LiveTimeSlot[]));
      }
    });

    const venueName = event.venue || event.title || event.location || 'Wankhede Stadium';
    const stopSimulator = startDatabaseSimulator(venueKey, evDate, venueName);

    return () => {
      unsubGates();
      unsubStands();
      unsubLiveData();
      stopSimulator();
    };
  }, [event]);

  // ── Countdown ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!event) return;
    const evDate = parseEventDateIST(event.date, event.time);
    if (!evDate) return;

    const now = new Date();
    const hasEnded = now.getTime() > evDate.getTime() + 5 * 60 * 60 * 1000;
    setIsEnded(hasEnded);

    setIsMatchDay(
      (evDate.getFullYear() === now.getFullYear() && evDate.getMonth() === now.getMonth() && evDate.getDate() === now.getDate()) ||
      (evDate.getTime() < now.getTime() && !hasEnded)
    );

    const tick = () => {
      const diff = evDate.getTime() - Date.now();
      if (diff <= -5 * 60 * 60 * 1000) {
        setCountdown({ h: 0, m: 0, s: 0, live: false, label: 'ENDED' });
        return;
      }
      if (diff <= 0) {
        setCountdown({ h: 0, m: 0, s: 0, live: true, label: 'LIVE' });
        return;
      }
      const totalSecs = Math.floor(diff / 1000);
      const h = Math.floor(totalSecs / 3600);
      const m = Math.floor((totalSecs % 3600) / 60);
      const s = totalSecs % 60;
      const label = h > 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
      setCountdown({ h, m, s, live: false, label });
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [event]);

  // ── Live data simulation (only when LIVE) ─────────────────────────────
  useEffect(() => {
    if (!countdown.live) return;
    liveTickRef.current = setInterval(() => {
      setMatchMin(m => (m + 1) % 90);
      setLiveTemp(t => Math.round(t + (Math.random() - 0.5)));
      setLiveHumidity(h => Math.min(90, Math.max(50, Math.round(h + (Math.random() - 0.5) * 2))));
      setLiveWind(w => Math.max(5, Math.round(w + (Math.random() - 0.5) * 2)));
    }, 5000);
    return () => { if (liveTickRef.current) clearInterval(liveTickRef.current); };
  }, [countdown.live]);

  const pad = (n: number) => String(n).padStart(2, '0');
  const stadium = getStadiumConfig(event?.venue || event?.title || event?.location);
  const stadiumName = event?.venue || event?.title || stadium.stands[0]?.name || 'Stadium';


  const bestGate = useMemo(() => predictBestGate(realGates), [realGates]);
  const recommendedWindow = useMemo(() => getRecommendedArrivalWindow(crowdData), [crowdData]);
  const kickoffSlot = crowdData.find(slot => slot.minuteOffset === 0);

  const nowHM = (() => {
    const now = new Date();
    const h = now.getHours() % 12 || 12;
    const m = String(now.getMinutes()).padStart(2, '0');
    const ap = now.getHours() >= 12 ? 'PM' : 'AM';
    return `${h}:${m} ${ap}`;
  })();

  if (isLoading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⚡</div>
        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Loading Match Day Guide…</div>
      </div>
    </div>
  );
  if (!event) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)' }}>
      Event not found
    </div>
  );

  const isLive = countdown.live;

  return (
    <>
      {/* Keyframe for live pulse dot */}
      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
        @keyframes liveGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.35); }
          50% { box-shadow: 0 0 0 10px rgba(239,68,68,0); }
        }
        @keyframes scanLine {
          0% { transform: translateY(0); opacity: 0.5; }
          100% { transform: translateY(100%); opacity: 0; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .live-card-enter { animation: fadeInUp 0.4s ease both; }
      `}</style>

      {showHeatmap && event && (
        <StadiumHeatmap3D
          onClose={() => setShowHeatmap(false)}
          event={{ ...event, _targetDate: parseEventDateIST(event.date, event.time) ?? undefined }}
        />
      )}

      <div style={{ minHeight: '100vh', background: isLive ? '#05080f' : 'var(--surface)', paddingBottom: 80 }}>

        {/* ── Top nav ──────────────────────────────────────────────────── */}
        <div style={{
          background: isLive ? 'rgba(5,8,15,0.97)' : 'var(--white)',
          borderBottom: isLive ? '1px solid rgba(239,68,68,0.2)' : '1px solid var(--border)',
          padding: '12px 24px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 90,
          backdropFilter: 'blur(14px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/dashboard" style={{ color: isLive ? 'rgba(255,255,255,0.5)' : 'var(--text-secondary)' }}>
              <ChevronLeft size={20} />
            </Link>
            <span style={{ fontWeight: 700, fontSize: 16, color: isLive ? 'white' : 'var(--text-primary)' }}>
              Event Dashboard
            </span>
            {isLive && <LivePulse />}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: isLive ? 'rgba(255,255,255,0.4)' : 'var(--text-secondary)' }}>ATTENDING AS</span>
            <strong style={{ fontSize: 14, color: isLive ? 'white' : 'var(--text-primary)' }}>{user?.displayName || 'Fan'}</strong>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: isLive ? 'rgba(239,68,68,0.15)' : 'var(--cyan-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 13,
              color: isLive ? '#ef4444' : 'var(--cyan-dark)',
              border: isLive ? '2px solid rgba(239,68,68,0.4)' : '2px solid var(--cyan)',
            }}>
              {(user?.displayName || 'U').charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {/* ── Hero banner ──────────────────────────────────────────────── */}
        <div style={{ position: 'relative', height: isLive ? 300 : 260, margin: isLive ? 0 : '0 24px', borderRadius: isLive ? 0 : 'var(--radius-xl)', overflow: 'hidden' }}>
          <img src={event.imageUrl} alt={event.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{
            position: 'absolute', inset: 0,
            background: isLive
              ? 'linear-gradient(to top, rgba(5,8,15,0.97) 0%, rgba(5,8,15,0.6) 60%, rgba(5,8,15,0.3) 100%)'
              : 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.15) 100%)',
          }} />

          {/* Live scan line effect */}
          {isLive && (
            <div style={{
              position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none',
            }}>
              <div style={{
                position: 'absolute', left: 0, right: 0, height: 2,
                background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.3), transparent)',
                animation: 'scanLine 3s linear infinite',
              }} />
            </div>
          )}

          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: isLive ? '28px 28px' : '24px 28px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          }}>
            <div style={{ color: 'white' }}>
              {isLive ? (
                <div style={{ marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <LivePulse label="🔴  LIVE NOW" size="lg" />
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
                    {matchMin}' • {matchScore.home} – {matchScore.away}
                  </span>
                </div>
              ) : (
                <span className="badge" style={{
                  background: 'var(--cyan)', color: 'var(--dark)',
                  marginBottom: 10, display: 'inline-flex', alignItems: 'center', gap: 5,
                }}>
                  {isEnded ? '🏁 EVENT CONCLUDED' : `⏰ ${countdown.label} to kickoff`}
                </span>
              )}
              <h1 style={{ fontSize: isLive ? 26 : 22, fontWeight: 900, marginBottom: 6 }}>{event.title}</h1>
              <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><MapPin size={12} /> {event.venue}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Calendar size={12} /> {event.date}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Clock size={12} /> {event.time}</span>
              </div>
            </div>

            {/* Countdown clock (pre-event) */}
            {!isLive && !isEnded && (
              <div style={{ textAlign: 'right', color: 'white' }}>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 4 }}>COUNTDOWN</div>
                <div style={{ fontSize: 36, fontWeight: 900, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                  {countdown.h > 0 && `${pad(countdown.h)}:`}{pad(countdown.m)}:{pad(countdown.s)}
                </div>
              </div>
            )}

            {/* Live crowd indicator (live) */}
            {isLive && (
              <div style={{ textAlign: 'right', color: 'white' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>STADIUM OCCUPANCY</div>
                <div style={{ fontSize: 42, fontWeight: 900, color: gateColor(liveStandOccupancy), lineHeight: 1, animation: 'liveGlow 2s ease infinite' }}>{liveStandOccupancy}%</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>~{Math.round(liveStandOccupancy * 330)} / 33,000 fans</div>
              </div>
            )}
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* ══ LIVE EVENT MODE ══════════════════════════════════════════ */}
        {/* ─────────────────────────────────────────────────────────────── */}
        {isLive ? (
          <div style={{ maxWidth: 1160, margin: '0 auto', padding: '24px 24px' }}>

            {/* ── Live banner strip ──────────────────────────────────── */}
            <div className="live-card-enter" style={{
              background: 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(239,68,68,0.04) 100%)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 16, padding: '16px 22px', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 16,
            }}>
              <Radio size={20} color="#ef4444" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>SmartFlow Live Intelligence is Active</div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 }}>
                  Real-time crowd flow, gate wait times, and weather are now live — updating every 5 seconds.
                </div>
              </div>
              <button
                onClick={() => setShowHeatmap(true)}
                style={{
                  background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)',
                  borderRadius: 10, padding: '8px 16px', color: '#ef4444',
                  cursor: 'pointer', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap',
                }}
              >
                Live Stadium View →
              </button>
            </div>

            {/* ── 4-stat row ─────────────────────────────────────────── */}
            <div className="live-card-enter event-stats-row">
              <StatChip icon={Users} value={`${liveGateDensity}%`} label="Gate Crowd Density" color={gateColor(liveGateDensity)} />
              <StatChip icon={TrendingUp} value={`${bestGate?.gateId || 'B'}`} label="Best Gate" color="#10b981" />
              <StatChip icon={Thermometer} value={`${liveTemp}°C`} label="Temperature" color="#f59e0b" />
              <StatChip icon={Wind} value={`${liveWind} km/h`} label="Wind Speed" color="#22d3ee" />
            </div>

            {/* ── Main live grid ─────────────────────────────────────── */}
            <div className="event-grid">

              {/* LEFT */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* ═══ CROWD INTELLIGENCE (LIVE) ═══ */}
                <div className="live-card-enter" style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 20, padding: 24,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Activity size={18} color="#00E5FF" />
                        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'white', margin: 0 }}>Crowd Intelligence</h2>
                        <LivePulse size="sm" />
                      </div>
                      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Live gate flow across match day</p>
                    </div>
                    <span style={{ fontSize: 12, color: '#00E5FF', fontWeight: 600 }}>↘ Best window found</span>
                  </div>

                  {/* Crowd chart */}
                  {(() => {
                    const nowOffset = event && parseEventDateIST(event.date, event.time)
                      ? (Date.now() - parseEventDateIST(event.date, event.time)!.getTime()) / 60000
                      : 0;

                    const liveCrowdAverage = realGates.length ? Math.round(realGates.reduce((s, g) => s + g.density, 0) / realGates.length) : 0;

                    const dynamicCrowdData = crowdData.map(d => {
                      if (Math.abs(d.minuteOffset - nowOffset) < 20 && liveCrowdAverage > 0) {
                        return { ...d, density: Math.round((d.density + liveCrowdAverage) / 2) };
                      }
                      return d;
                    });

                    return (
                      <div style={{ height: 180, minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height={180}>
                          <AreaChart data={dynamicCrowdData} margin={{ top: 5, right: 10, bottom: 5, left: -28 }}>
                            <defs>
                              <linearGradient id="crowdGrLive" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.45} />
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis 
                              dataKey="minuteOffset" 
                              type="number"
                              domain={['dataMin', 'dataMax']}
                              tickFormatter={(val) => {
                                if (!event) return `${val}m`;
                                const evDate = parseEventDateIST(event.date, event.time);
                                if (!evDate) return `${val}m`;
                                const t = new Date(evDate.getTime() + val * 60000);
                                const h = t.getHours() % 12 || 12;
                                const m = String(t.getMinutes()).padStart(2, '0');
                                return `${h}:${m} ${t.getHours() >= 12 ? 'PM' : 'AM'}`;
                              }}
                              tick={{ fontSize: 9, fill: '#64748b' }} 
                              axisLine={false} 
                              tickLine={false} 
                              tickCount={5} 
                            />
                            <YAxis hide domain={[0, 100]} />
                            <Tooltip content={<CrowdTooltip />} />
                            <ReferenceLine
                              x={nowOffset}
                              stroke="#ef4444"
                              strokeDasharray="4 4"
                              label={{ value: 'NOW', position: 'top', fill: '#ef4444', fontSize: 9, fontWeight: 700 }}
                            />
                            {recommendedWindow && (
                              <ReferenceArea
                                x1={recommendedWindow.start.minuteOffset}
                                x2={recommendedWindow.end.minuteOffset}
                                fill="rgba(16,185,129,0.12)"
                                stroke="rgba(16,185,129,0.35)"
                                strokeDasharray="3 3"
                              />
                            )}
                            <ReferenceLine x={0} stroke="#f97316" strokeDasharray="4 4" label={{ value: 'KICKOFF', position: 'top', fontSize: 11, fontWeight: 700 }} />
                            <Area type="monotone" dataKey="density" stroke="#ef4444" fill="url(#crowdGrLive)" strokeWidth={2} dot={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  })()}
                </div>

                {/* ═══ STADIUM MAP ═══ */}
                <div className="live-card-enter" style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 20, padding: 20,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div>
                      <h2 style={{ fontSize: 17, fontWeight: 700, color: 'white', margin: '0 0 3px' }}>Stadium & Transport</h2>
                      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Live venue map · Nearest metro & parking</p>
                    </div>
                    <span style={{ fontSize: 10, background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.25)', color: '#00E5FF', padding: '3px 10px', borderRadius: 20, fontWeight: 700 }}>Satellite View</span>
                  </div>
                  <StadiumMap
                    eventName={event.title}
                    stadium={{
                      lat: stadium.center.lat,
                      lng: stadium.center.lng,
                      name: stadiumName,
                    }}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
                    {[
                      { icon: '🚇', label: 'Churchgate Station', info: '4 min walk', bg: 'rgba(29,78,216,0.08)', border: 'rgba(29,78,216,0.2)' },
                      { icon: '🅿️', label: 'P1 Stadium Parking', info: 'Gate A entry', bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.2)' },
                    ].map(t => (
                      <div key={t.label} style={{ padding: '12px 14px', borderRadius: 10, background: t.bg, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 20 }}>{t.icon}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{t.label}</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{t.info}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ═══ FOOD PRE-ORDER ═══ */}
                <div className="live-card-enter" style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 20, padding: 24,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                      <h2 style={{ fontSize: 17, fontWeight: 700, color: 'white', margin: '0 0 3px' }}>Food & Beverage Pre-order</h2>
                      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Skip the queue with SmartFlow pickup</p>
                    </div>
                    <Link href="/orders" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#00E5FF', fontWeight: 600 }}>
                      <UtensilsCrossed size={13} /> View All
                    </Link>
                  </div>
                  <div className="food-grid">
                    {foodItems.slice(0, 3).map(item => (
                      <div key={item.id} style={{ textAlign: 'center' }}>
                        <div style={{ position: 'relative', marginBottom: 8 }}>
                          <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 10 }} />
                          <span style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.7)', borderRadius: 6, fontSize: 11, fontWeight: 700, padding: '2px 7px', color: 'white' }}>₹{item.price}</span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'white', marginBottom: 2 }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>{item.vendor}</div>
                        <button 
                          onClick={() => handlePreOrder(item)}
                          disabled={orderingItemId === item.id}
                          style={{ width: '100%', padding: '6px', borderRadius: 6, border: '1px solid rgba(0,229,255,0.3)', background: 'rgba(0,229,255,0.06)', color: orderingItemId === item.id ? 'var(--text-muted)' : '#00E5FF', fontSize: 12, fontWeight: 600, cursor: orderingItemId === item.id ? 'not-allowed' : 'pointer', opacity: orderingItemId === item.id ? 0.7 : 1 }}>
                          {orderingItemId === item.id ? 'Placing...' : 'Pre-order'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* RIGHT */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* ═══ GATE ENTRY MONITOR (LIVE) ═══ */}
                <div className="live-card-enter" style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 20, padding: 20,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ShieldCheck size={16} color="#10b981" />
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'white', margin: 0 }}>Gate Entry Monitor</h3>
                    </div>
                    <LivePulse size="sm" label="LIVE" />
                  </div>

                  {/* Alert */}
                  <div style={{
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 10, padding: '10px 12px', marginBottom: 14,
                    display: 'flex', gap: 8, alignItems: 'flex-start',
                  }}>
                    <AlertTriangle size={13} color="#ef4444" style={{ marginTop: 1, flexShrink: 0 }} />
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, margin: 0 }}>
                      <strong style={{ color: '#ef4444' }}>Gate D Congestion:</strong> Heavy traffic at East Tunnel. Use Gate A or B.
                    </p>
                  </div>

                  {/* Live bars */}
                  {realGates.map(g => {
                    const col = gateColor(g.density);
                    const best = predictBestGate(realGates);
                    const recommended = bestGate?.gateId === g.gateId;
                    return (
                      <div key={g.gateId} style={{
                        padding: '12px 14px', borderRadius: 12, marginBottom: 10,
                        background: recommended ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${recommended ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)'}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, background: `${col}22`, color: col }}>
                              {g.gateId}
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>Gate {g.gateId}</span>
                            {recommended && <span style={{ fontSize: 9, background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '2px 7px', borderRadius: 10, fontWeight: 700 }}>RECOMMENDED</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginRight: 6 }}>{g.flowRate}/min</span>
                            <span style={{ fontSize: 14, fontWeight: 800, color: col }}>{g.density}%</span>
                          </div>
                        </div>
                        <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${g.density}%`, borderRadius: 3, background: col, transition: 'width 1s ease' }} />
                        </div>
                      </div>
                    );
                  })}

                  <Link href={`/event/${event.id}/stadium`} style={{
                    display: 'block', textAlign: 'center', marginTop: 8, padding: '10px',
                    borderRadius: 10, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                    color: '#10b981', fontWeight: 700, fontSize: 13, textDecoration: 'none',
                  }}>
                    Open Stadium Navigator
                  </Link>
                </div>

              </div>
            </div>
          </div>

        ) : isEnded ? (
           <div style={{ padding: '80px 24px', textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
             <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: '50%', background: 'var(--surface-2)', marginBottom: 24 }}>
               <Calendar size={40} color="var(--text-muted)" />
             </div>
             <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>Event Concluded</h2>
             <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 32 }}>
               Thank you for attending <strong>{event.title}</strong>! The SmartFlow live dashboard for this event is now closed.
             </p>
             <button
               onClick={handleExitEvent}
               disabled={isExiting}
               style={{
                 padding: '14px 32px', fontSize: 15, fontWeight: 700, borderRadius: 'var(--radius-md)',
                 background: 'var(--cyan)', color: 'var(--dark)', border: 'none', cursor: 'pointer',
                 opacity: isExiting ? 0.7 : 1, transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: 8
               }}
             >
               <ChevronLeft size={18} />
               {isExiting ? 'Exiting...' : 'Exit Event'}
             </button>
           </div>
        ) : (
          /* ─────────────────────────────────────────────────────────────── */
          /* ══ PRE-EVENT MODE (original layout) ═════════════════════════ */
          /* ─────────────────────────────────────────────────────────────── */
          isMatchDay ? (
          <div className="event-grid" style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>

            {/* LEFT column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Crowd Intelligence chart */}
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div>
                    <h2 style={{ fontSize: 17, fontWeight: 700 }}>Crowd Intelligence</h2>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Predicted gate flow throughout match day</p>
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--cyan-dark)', fontWeight: 600 }}>↘ Best window found</span>
                </div>

                <div style={{ marginTop: 16, marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--cyan-dark)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
                    RECOMMENDED ARRIVAL WINDOW
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 900 }}>
                    {recommendedWindow ? `${recommendedWindow.start.time} - ${recommendedWindow.end.time}` : 'Calculating...'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>
                    Lowest density and wait times prior to peak fan influx.
                  </div>
                </div>

                {(() => {
                  const nowOffset = event && parseEventDateIST(event.date, event.time)
                    ? (Date.now() - parseEventDateIST(event.date, event.time)!.getTime()) / 60000
                    : 0;
                  
                  const liveCrowdAverage = realGates.length ? Math.round(realGates.reduce((s, g) => s + g.density, 0) / realGates.length) : 0;
                  
                  const dynamicCrowdData = crowdData.map(d => {
                    // Inject the live real-time density into the current timeline slot so the graph physically wiggles!
                    if (Math.abs(d.minuteOffset - nowOffset) < 20 && liveCrowdAverage > 0) {
                      return { ...d, density: Math.round((d.density + liveCrowdAverage) / 2) };
                    }
                    return d;
                  });

                  return (
                    <div style={{ height: 180, marginTop: 16, minWidth: 0 }}>
                      <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={dynamicCrowdData} margin={{ top: 5, right: 10, bottom: 5, left: -28 }}>
                          <defs>
                            <linearGradient id="crowdGr" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#00E5FF" stopOpacity={0.45} />
                              <stop offset="95%" stopColor="#00E5FF" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="rgba(148,163,184,0.08)" vertical={false} />
                          <XAxis 
                            dataKey="minuteOffset" 
                            type="number"
                            domain={['dataMin', 'dataMax']}
                            tickFormatter={(val) => {
                              if (!event) return `${val}m`;
                              const evDate = parseEventDateIST(event.date, event.time);
                              if (!evDate) return `${val}m`;
                              const t = new Date(evDate.getTime() + val * 60000);
                              const h = t.getHours() % 12 || 12;
                              const m = String(t.getMinutes()).padStart(2, '0');
                              return `${h}:${m} ${t.getHours() >= 12 ? 'PM' : 'AM'}`;
                            }}
                            tick={{ fontSize: 9, fill: '#94A3B8' }} 
                            axisLine={false} 
                            tickLine={false} 
                            tickCount={5}
                          />
                          <YAxis hide domain={[0, 100]} />
                          <Tooltip content={<CrowdTooltip />} />
                          <ReferenceLine x={nowOffset} stroke="#00E5FF" strokeDasharray="4 4" label={{ value: 'NOW', position: 'top', fill: '#00BCD4', fontSize: 9, fontWeight: 700 }} />
                          {recommendedWindow && (
                            <ReferenceArea
                              x1={recommendedWindow.start.minuteOffset}
                              x2={recommendedWindow.end.minuteOffset}
                              fill="rgba(16,185,129,0.10)"
                              stroke="rgba(16,185,129,0.30)"
                              strokeDasharray="3 3"
                            />
                          )}
                          <ReferenceLine x={0} stroke="#EF4444" strokeDasharray="4 4" label={{ value: 'KICKOFF', position: 'top', fontSize: 11, fontWeight: 700 }} />
                          <Area type="monotone" dataKey="density" stroke="#00E5FF" fill="url(#crowdGr)" strokeWidth={2} dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })()}

                <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                  {[
                    { color: '#00E5FF', label: 'Now' },
                    { color: '#EF4444', label: 'Kickoff' },
                    { color: '#10B981', label: 'Best window' },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
                      <div style={{ width: 20, height: 2, borderTop: `2px dashed ${item.color}` }} />
                      {item.label}
                    </div>
                  ))}
                </div>

                {/* ── Predictive ETA Engine (Pre-Event) ──────────────── */}
                <div style={{ marginTop: 24, padding: 16, background: 'rgba(0,229,255,0.06)', borderRadius: 16, border: '1px solid rgba(0,229,255,0.15)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Zap size={16} color="#00E5FF" />
                    <span style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-primary)' }}>Predictive ETA Engine</span>
                  </div>
                  {/* Formula display */}
                  <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--border)', fontFamily: 'monospace', marginBottom: 12 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2 }}>Wait Time Formula:</div>
                    <div style={{ fontSize: 14, color: '#00E5FF', fontWeight: 700 }}>
                      T<sub style={{ fontSize: 8 }}>w</sub> = N / (R × G)
                    </div>
                    {(() => {
                      const totalN = realGates.reduce((s, g) => s + Math.round((g.density / 100) * (g.queueCapacity || 600)), 0);
                      const avgR   = realGates.length ? Math.round(realGates.reduce((s, g) => s + (g.flowRate || 25), 0) / realGates.length) : 25;
                      const G      = realGates.filter(g => g.density < 85).length || 1;
                      const eta    = calculateETA(totalN, avgR, G);
                      return (
                        <div style={{ marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>N=<strong style={{ color: 'var(--text-primary)' }}>{totalN.toLocaleString()}</strong></span>
                          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>R=<strong style={{ color: 'var(--text-primary)' }}>{avgR}/min</strong></span>
                          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>G=<strong style={{ color: 'var(--text-primary)' }}>{G} gates</strong></span>
                          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-secondary)' }}>ETA: <strong style={{ color: eta > 30 ? '#ef4444' : '#10b981', fontSize: 13 }}>{eta}m</strong></span>
                        </div>
                      );
                    })()}
                  </div>
                  {/* Per-gate ETA pills */}
                  <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                    {[...realGates].sort((a, b) => a.gateId > b.gateId ? 1 : -1).map(g => {
                      const N   = Math.round((g.density / 100) * (g.queueCapacity || 600));
                      const eta = calculateETA(N, g.flowRate || 25, 1);
                      const col = gateColor(g.density);
                      return (
                        <div key={g.gateId} style={{ minWidth: 80, background: `${col}15`, border: `1px solid ${col}40`, borderRadius: 10, padding: '8px 10px' }}>
                          <div style={{ fontSize: 10, fontWeight: 800, color: col }}>Gate {g.gateId}</div>
                          <div style={{ fontSize: 14, fontWeight: 900, color: col, marginTop: 2 }}>{eta}m</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Live Stand Occupancy (Pre-Event) ──────────────── */}
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <BarChart2 size={16} color="#a78bfa" />
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 }}>Live Stand Occupancy</div>
                  </div>
                  <div className="stands-grid">
                    {(stands.length > 0 ? stands : [
                      { standId: 'n', name: 'North', sectionLabel: 'A', fillPct: 88, lat:0, lng:0 },
                      { standId: 's', name: 'South', sectionLabel: 'B', fillPct: 74, lat:0, lng:0 },
                      { standId: 'e', name: 'East',  sectionLabel: 'C', fillPct: 96, lat:0, lng:0 },
                      { standId: 'w', name: 'West',  sectionLabel: 'D', fillPct: 63, lat:0, lng:0 },
                    ] as StandMetric[]).map(s => {
                      const col = gateColor(s.fillPct);
                      return (
                        <div key={s.standId} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>{s.name}</div>
                          <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden', marginBottom: 4 }}>
                            <div style={{ height: '100%', width: `${s.fillPct}%`, borderRadius: 3, background: col, transition: 'width 1s ease' }} />
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: col }}>{s.fillPct}%</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Stadium Map */}
              <div className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <h2 style={{ fontSize: 17, fontWeight: 700 }}>Stadium & Transport</h2>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Your location · Nearest metro & parking</p>
                  </div>
                  <span className="badge badge-cyan" style={{ fontSize: 10 }}>Satellite View</span>
                </div>
                <StadiumMap
                  eventName={event.title}
                  stadium={{
                    lat: stadium.center.lat,
                    lng: stadium.center.lng,
                    name: stadiumName,
                  }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
                  {[
                    { icon: '🚇', label: 'Churchgate Station', info: '4 min walk', color: 'rgba(29,78,216,0.08)', border: 'rgba(29,78,216,0.2)' },
                    { icon: '🅿️', label: 'P1 Stadium Parking', info: 'Gate A entry', color: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.2)' },
                  ].map(t => (
                    <div key={t.label} style={{ padding: '12px 14px', borderRadius: 10, background: t.color, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 20 }}>{t.icon}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{t.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t.info}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Analyse Crowd CTA */}
              <button
                onClick={() => setShowHeatmap(true)}
                style={{
                  width: '100%', padding: '18px 24px', borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
                  border: '1px solid rgba(0,229,255,0.3)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                  color: 'white', fontWeight: 800, fontSize: 16,
                  boxShadow: '0 0 30px rgba(0,229,255,0.12)', transition: 'all 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 40px rgba(0,229,255,0.28)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 0 30px rgba(0,229,255,0.12)')}
              >
                <Activity size={20} color="#00E5FF" />
                <span>Live Stadium View</span>
                <ChevronRight size={18} color="rgba(255,255,255,0.5)" />
              </button>

              {/* Food & Beverage */}
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h2 style={{ fontSize: 17, fontWeight: 700 }}>Food & Beverage Pre-order</h2>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Skip the queue with SmartFlow pickup</p>
                  </div>
                  <Link href="/orders" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--cyan-dark)', fontWeight: 600 }}>
                    <UtensilsCrossed size={13} /> View All
                  </Link>
                </div>
                <div className="food-grid">
                  {foodItems.slice(0, 3).map(item => (
                    <div key={item.id} style={{ textAlign: 'center' }}>
                      <div style={{ position: 'relative', marginBottom: 8 }}>
                        <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 10 }} />
                        <span style={{ position: 'absolute', top: 6, right: 6, background: 'white', borderRadius: 6, fontSize: 11, fontWeight: 700, padding: '2px 7px', boxShadow: 'var(--shadow-sm)' }}>₹{item.price}</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{item.vendor}</div>
                      <button className="btn btn-sm btn-outline" style={{ width: '100%', borderRadius: 6, color: 'var(--cyan-dark)', borderColor: 'var(--cyan-dark)', fontSize: 12 }}>
                        Pre-order
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* ── Smart Entry Recommendation (Replaces Gate Monitor) ──────────────── */}
              <div className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <Navigation size={18} color="#10b981" />
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Smart Entry</span>
                  <span style={{ marginLeft: 'auto', background: 'rgba(16,185,129,0.15)', borderRadius: 12, padding: '4px 10px', fontSize: 10, fontWeight: 800, color: '#10b981' }}>OPTIMAL</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: '#10b981', lineHeight: 1 }}>{bestGate?.name ?? 'Calculating…'}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, fontWeight: 600 }}>Lowest wait queue found</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#10b981' }}>{bestGate?.density ?? 0}%</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Density</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {realGates.map(g => {
                    const isBest = bestGate?.gateId === g.gateId;
                    const col = gateColor(g.density);
                    return (
                    <div key={g.gateId} style={{ padding: '10px 14px', border: `1px solid ${isBest ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12, background: isBest ? 'rgba(16,185,129,0.05)' : 'var(--surface)', cursor: 'pointer', transition: 'all 0.15s' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0, background: isBest ? '#10b981' : `${col}15`, color: isBest ? 'white' : col }}>
                        {g.gateId}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: isBest ? '#10b981' : 'var(--text-primary)' }}>Gate {g.gateId} {isBest && <span style={{fontSize: 9, background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '2px 6px', borderRadius: 4, marginLeft: 6}}>BEST</span>}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {g.flowRate}/min flow
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: col }}>
                          {g.waitMinutes} MIN
                        </div>
                      </div>
                    </div>
                  )})}
                </div>
                
                <Link href={`/event/${event.id}/stadium`} className="btn btn-primary btn-full" style={{ marginTop: 16, borderRadius: 10, background: '#10b981', border: 'none', color: 'white', fontWeight: 800 }}>
                  Open Stadium Navigator
                </Link>
              </div>      
            </div>
          </div>
          ) : (
            <div style={{ padding: '40px 24px', maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 40 }}>
              <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: '50%', background: 'var(--surface-2)', marginBottom: 24 }}>
                  <Calendar size={40} color="var(--text-muted)" />
                </div>
                <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>Match Day Experience Locked</h2>
                <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  SmartFlow Live Intelligence, predictive crowd mapping, and food pre-ordering will be available right here on <strong>{event.date}</strong>.
                </p>
              </div>

              <div className="card" style={{ padding: 20, maxWidth: 800, margin: '0 auto', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <h2 style={{ fontSize: 17, fontWeight: 700 }}>Stadium & Transport</h2>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Event location · Metro & parking</p>
                  </div>
                  <span className="badge badge-cyan" style={{ fontSize: 10 }}>Satellite View</span>
                </div>
                <StadiumMap
                  eventName={event.title}
                  stadium={{
                    lat: stadium.center.lat,
                    lng: stadium.center.lng,
                    name: stadiumName,
                  }}
                />
              </div>
            </div>
          )
        )}

        <MobileNav />
      </div>
    </>
  );
}
