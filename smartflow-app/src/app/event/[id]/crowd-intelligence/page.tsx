'use client';

import { use, useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, Activity, RefreshCw, Radio, Users,
  Zap, BarChart2, Clock, Shield, TrendingUp, AlertTriangle,
  Navigation, MapPin,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getEventById } from '@/lib/firebase/db';
import {
  getStadiumConfig, resolveVenueKey,
  subscribeToGateMetrics, subscribeToStandMetrics,
  subscribeToRecentCrowdLog, startDatabaseSimulator,
  type GateMetric, type StandMetric, type CrowdLogEntry, getCurrentStatus,
} from '@/lib/gateMetricsService';
import { CrowdIntelligencePanel } from '@/components/event/CrowdIntelligencePanel';
import { NavigatorPanel } from '@/components/event/NavigatorPanel';
import { Event } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseEventDate(dateStr: string, timeStr: string): Date | null {
  try {
    const raw = new Date(`${dateStr} ${timeStr}`);
    return isNaN(raw.getTime()) ? null : raw;
  } catch { return null; }
}

function densityColor(d: number) {
  if (d >= 85) return '#ef4444';
  if (d >= 60) return '#f97316';
  if (d >= 30) return '#f59e0b';
  return '#10b981';
}

function statusLabel(d: number) {
  if (d >= 85) return 'Critical';
  if (d >= 60) return 'Crowded';
  if (d >= 30) return 'Filling';
  return 'Clear';
}

function LivePulse({ label = 'LIVE' }: { label?: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
      borderRadius: 20, padding: '3px 10px', color: '#ef4444',
      fontWeight: 800, fontSize: 11, letterSpacing: '0.05em',
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%', background: '#ef4444',
        animation: 'ciLivePulse 1.2s ease-in-out infinite', display: 'inline-block',
      }} />
      {label}
    </span>
  );
}

// ── Central Stadium Schematic Heatmap ─────────────────────────────────────────

function StadiumSchematic({ gates, stands }: { gates: GateMetric[]; stands: StandMetric[] }) {
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    if (gates.length || stands.length) setLastRefresh(new Date());
  }, [gates, stands]);

  const gateMap = useMemo(() =>
    Object.fromEntries(gates.map(g => [g.gateId, g])), [gates]);
  const standMap = useMemo(() =>
    Object.fromEntries(stands.map(s => [s.standId, s])), [stands]);

  // Stand config: position classes + labels
  const STAND_CFG = [
    { id: 'North', label: 'North Stand', pos: { top: '10%',  left: '50%', transform: 'translateX(-50%)' } },
    { id: 'South', label: 'South Stand', pos: { bottom: '10%', left: '50%', transform: 'translateX(-50%)' } },
    { id: 'East',  label: 'East Stand',  pos: { top: '50%',  right: '8%', transform: 'translateY(-50%)' } },
    { id: 'West',  label: 'West Stand',  pos: { top: '50%',  left: '8%',  transform: 'translateY(-50%)' } },
  ] as const;

  const GATE_CFG = [
    { id: 'A', label: 'Gate A', pos: { top: '-6%',    left: '50%',  transform: 'translateX(-50%)' } },
    { id: 'B', label: 'Gate B', pos: { bottom: '-6%', left: '50%',  transform: 'translateX(-50%)' } },
    { id: 'C', label: 'Gate C', pos: { top: '50%',    right: '-5%', transform: 'translateY(-50%)' } },
    { id: 'D', label: 'Gate D', pos: { top: '50%',    left: '-5%',  transform: 'translateY(-50%)' } },
  ] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      {/* Title row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'white' }}>Live Stadium Heatmap</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
            Real-time gate queues & stand occupancy
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {lastRefresh && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
              {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <LivePulse />
        </div>
      </div>

      {/* ── Schematic oval ── */}
      <div style={{
        flex: 1, position: 'relative', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        minHeight: 320,
      }}>
        {/* Outer oval (stadium shell) */}
        <div style={{
          position: 'absolute', inset: '5%',
          borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.07)',
          background: 'radial-gradient(ellipse at center, rgba(15,23,42,0.9) 0%, rgba(2,6,23,0.95) 100%)',
        }} />

        {/* Concourse ring */}
        <div style={{
          position: 'absolute', inset: '18%',
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.05)',
        }} />

        {/* Stand blobs (filled seats) */}
        {STAND_CFG.map(cfg => {
          const s = standMap[cfg.id];
          const fill = s?.fillPct ?? 0;
          const col = densityColor(fill);
          const size = 60 + fill * 0.6;
          return (
            <div key={cfg.id} style={{
              position: 'absolute', ...cfg.pos,
              width: size, height: size * 0.7,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${col}55 0%, ${col}22 55%, transparent 80%)`,
              filter: 'blur(12px)',
              transition: 'all 1.5s ease', pointerEvents: 'none',
            }} />
          );
        })}

        {/* Gate glow blobs (outside queues) */}
        {GATE_CFG.map(cfg => {
          const g = gateMap[cfg.id];
          const density = g?.density ?? 0;
          const col = densityColor(density);
          const sz = 30 + density * 0.5;
          return (
            <div key={cfg.id} style={{
              position: 'absolute', ...cfg.pos,
              width: sz, height: sz, borderRadius: '50%',
              background: `radial-gradient(circle, ${col}99 0%, ${col}44 50%, transparent 75%)`,
              filter: 'blur(8px)',
              transition: 'all 1.2s ease', pointerEvents: 'none',
              zIndex: 10,
            }} />
          );
        })}

        {/* Pitch */}
        <div style={{
          position: 'relative', zIndex: 20,
          width: '26%', height: '19%',
          background: 'linear-gradient(135deg, #065f46, #059669)',
          borderRadius: 6,
          border: '1.5px solid rgba(255,255,255,0.3)',
          boxShadow: '0 0 24px rgba(5,150,105,0.3)',
        }}>
          <div style={{ position: 'absolute', inset: 6, border: '1px solid rgba(255,255,255,0.4)', borderRadius: 2 }} />
          <div style={{ position: 'absolute', left: '50%', top: 6, bottom: 6, width: 1, background: 'rgba(255,255,255,0.4)' }} />
          <div style={{ position: 'absolute', left: '50%', top: '50%', width: '28%', height: '55%', transform: 'translate(-50%,-50%)', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.4)' }} />
        </div>

        {/* Stand info labels */}
        {STAND_CFG.map(cfg => {
          const s = standMap[cfg.id];
          const fill = s?.fillPct ?? 0;
          const col = densityColor(fill);
          return (
            <div key={`lbl-${cfg.id}`} style={{
              position: 'absolute', ...cfg.pos,
              zIndex: 30, textAlign: 'center', pointerEvents: 'none',
            }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {cfg.label}
              </div>
              <div style={{ fontSize: 14, fontWeight: 900, color: col }}>{fill}%</div>
            </div>
          );
        })}

        {/* Gate pill labels */}
        {GATE_CFG.map(cfg => {
          const g = gateMap[cfg.id];
          const density = g?.density ?? 0;
          const col = densityColor(density);
          return (
            <div key={`gate-lbl-${cfg.id}`} style={{
              position: 'absolute', ...cfg.pos,
              zIndex: 40,
              background: 'rgba(5,12,28,0.92)',
              border: `1.5px solid ${col}`,
              borderRadius: 8, padding: '5px 9px',
              minWidth: 72, textAlign: 'center',
              boxShadow: `0 0 16px ${col}33`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ background: col, color: '#020617', fontSize: 8, fontWeight: 900, borderRadius: 3, padding: '0 4px' }}>
                  {cfg.id}
                </span>
                <span style={{ fontSize: 11, fontWeight: 900, color: col }}>{density}%</span>
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'white' }}>{g?.name || cfg.label}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>
                {g ? `${g.waitMinutes}m · ${statusLabel(density)}` : 'Loading…'}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Heatmap legend strip ── */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {[
          { col: '#10b981', label: 'Clear', threshold: '< 30%' },
          { col: '#f59e0b', label: 'Filling', threshold: '30–59%' },
          { col: '#f97316', label: 'Crowded', threshold: '60–84%' },
          { col: '#ef4444', label: 'Critical', threshold: '≥ 85%' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, background: `${item.col}10`, border: `1px solid ${item.col}25` }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.col }} />
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: item.col }}>{item.label}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{item.threshold}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Per-stand occupancy bars */}
      <div style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16, padding: 16,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          Stand Occupancy Breakdown
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {STAND_CFG.map(cfg => {
            const s = standMap[cfg.id];
            const fill = s?.fillPct ?? 0;
            const col = densityColor(fill);
            return (
              <div key={cfg.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'white' }}>{cfg.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: col }}>{fill}%</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${fill}%`, borderRadius: 3, background: `linear-gradient(90deg, #8b5cf6, ${col})`, transition: 'width 1.5s ease' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Summary Stat Chip ─────────────────────────────────────────────────────────

function SummaryStat({ icon: Icon, value, label, color }: { icon: any; value: string; label: string; color: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 0, padding: '14px 16px',
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Icon size={14} color={color} />
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CrowdIntelligancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [event, setEvent] = useState<Event | null>(null);
  const [gates, setGates]   = useState<GateMetric[]>([]);
  const [stands, setStands] = useState<StandMetric[]>([]);
  const [crowdLog, setCrowdLog] = useState<CrowdLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [lastRefresh, setLastRefresh] = useState(0); // seconds ago
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }

    async function load() {
      try {
        const ev = await getEventById(id);
        setEvent(ev as Event);
      } catch (e) { console.error(e); }
      finally { setIsLoading(false); }
    }
    load();
  }, [user, authLoading, id]);

  useEffect(() => {
    if (!event) return;
    const venueKey  = resolveVenueKey(event.venue || event.title || event.location);
    const venueName = event.venue || event.title || event.location || 'Wankhede Stadium';
    const evDate    = parseEventDate(event.date, event.time) || new Date(Date.now() + 2 * 3600 * 1000);

    const unsub1 = subscribeToGateMetrics(m => {
      const filtered = m.filter(g => g.venueKey === venueKey);
      const deduped  = Array.from(new Map(filtered.map(g => [g.gateId, g])).values()).sort((a, b) => a.gateId.localeCompare(b.gateId));
      setGates(deduped);
      setRefreshTick(t => t + 1);
      setLastRefresh(0);
    });
    const unsub2 = subscribeToStandMetrics(m => {
      setStands(m.filter(s => s.venueKey === venueKey));
    });
    const unsub3 = subscribeToRecentCrowdLog(venueKey, 40, rows => setCrowdLog(rows));

    const stopSim = startDatabaseSimulator(venueKey, evDate, venueName);

    // Auto-refresh counter
    timerRef.current = setInterval(() => {
      setLastRefresh(s => s + 1);
    }, 1000);

    return () => {
      unsub1(); unsub2(); unsub3(); stopSim();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [event]);

  const minutesUntilEvent = useMemo(() => {
    if (!event) return 0;
    const evDate = parseEventDate(event.date, event.time);
    if (!evDate) return 0;
    return (evDate.getTime() - Date.now()) / 60000;
  }, [event, refreshTick]);

  const venueKey = resolveVenueKey(event?.venue || event?.title || event?.location);

  const avgDensity = gates.length ? Math.round(gates.reduce((s, g) => s + g.density, 0) / gates.length) : 0;
  const avgWait    = gates.length ? Math.round(gates.reduce((s, g) => s + g.waitMinutes, 0) / gates.length) : 0;
  const criticalGates = gates.filter(g => g.density >= 85).length;
  const bestGate   = gates.length ? [...gates].sort((a, b) => a.density - b.density)[0] : null;

  if (isLoading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617', color: 'white' }}>
      <div style={{ textAlign: 'center' }}>
        <Activity size={36} color="#00E5FF" style={{ marginBottom: 12 }} />
        <div style={{ fontWeight: 700 }}>Loading Crowd Intelligence…</div>
      </div>
    </div>
  );

  if (!event) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617', color: 'white' }}>
      Event not found
    </div>
  );

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; font-family: 'Inter', system-ui, sans-serif; }
        @keyframes ciLivePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.35; transform: scale(0.7); }
        }
        @keyframes ciSpin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#020617', color: 'white', paddingBottom: 40 }}>

        {/* ── Top Nav ── */}
        <div style={{
          background: 'rgba(2,6,23,0.97)', borderBottom: '1px solid rgba(0,229,255,0.1)',
          padding: '14px 28px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 90,
          backdropFilter: 'blur(14px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href={`/event/${id}`} style={{ color: 'rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center' }}>
              <ChevronLeft size={20} />
            </Link>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(0,229,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(0,229,255,0.2)' }}>
              <Activity size={18} color="#00E5FF" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Crowd Intelligence</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{event.title}</div>
            </div>
            <LivePulse label="LIVE · Firestore" />
          </div>

          {/* Refresh indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
            <RefreshCw size={13}
              style={{
                animation: lastRefresh < 2 ? 'ciSpin 0.6s linear' : 'none',
                color: lastRefresh < 2 ? '#00E5FF' : 'inherit',
              }}
            />
            <span>Updated {lastRefresh}s ago · Auto-refresh 10s</span>
          </div>
        </div>

        {/* ── Summary stat row ── */}
        <div style={{ padding: '20px 28px 0', maxWidth: 1400, margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <SummaryStat icon={Users}      value={`${avgDensity}%`}       label="Avg Gate Density"  color="#00E5FF" />
            <SummaryStat icon={Clock}      value={`${avgWait} min`}        label="Avg Wait Time"     color="#f59e0b" />
            <SummaryStat icon={Navigation} value={`Gate ${bestGate?.gateId ?? '—'}`} label="Best Entry"  color="#10b981" />
            <SummaryStat icon={AlertTriangle} value={`${criticalGates}`}  label="Critical Gates"    color={criticalGates > 0 ? '#ef4444' : '#10b981'} />
            <SummaryStat icon={BarChart2}  value={`${stands.length ? Math.round(stands.reduce((s, st) => s + st.fillPct, 0) / stands.length) : 0}%`} label="Stand Avg Fill" color="#a78bfa" />
          </div>

          {/* ── Main 3-column grid ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, alignItems: 'start' }}>

            {/* LEFT — Crowd Intelligence Panel */}
            <div style={{
              background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 24, padding: 24, display: 'flex', flexDirection: 'column', gap: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <Zap size={18} color="#00E5FF" />
                <div style={{ fontWeight: 800, fontSize: 16, color: 'white' }}>Intelligence Panel</div>
              </div>
              <CrowdIntelligencePanel
                gates={gates}
                crowdLog={crowdLog}
                minutesUntilEvent={minutesUntilEvent}
                eventTime={event.time}
                venueKey={venueKey}
              />
            </div>

            {/* CENTER — Stadium Schematic Heatmap */}
            <div style={{
              background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 24, padding: 24,
            }}>
              <StadiumSchematic gates={gates} stands={stands} />
            </div>

            {/* RIGHT — Navigator Panel */}
            <div style={{
              background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 24, padding: 24, display: 'flex', flexDirection: 'column', gap: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <Navigation size={18} color="#10b981" />
                <div style={{ fontWeight: 800, fontSize: 16, color: 'white' }}>Smart Navigator</div>
              </div>
              <NavigatorPanel gates={gates} eventTitle={event.title} />
            </div>
          </div>

          {/* ── Bottom strip — Full crowd log table ── */}
          <div style={{
            marginTop: 24,
            background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 24, padding: 24,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Radio size={16} color="#a78bfa" />
                <div style={{ fontWeight: 800, fontSize: 15, color: 'white' }}>Full Simulation Data Log</div>
                <span style={{ fontSize: 11, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', color: '#a78bfa', borderRadius: 20, padding: '2px 8px' }}>
                  crowd_log · Firestore
                </span>
              </div>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                {crowdLog.length} entries (latest 40)
              </span>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              {/* Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '130px 80px 80px 100px 110px 90px minmax(140px,1fr)',
                gap: 0, padding: '8px 14px',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
              }}>
                {['Timestamp', 'Gate', 'Stand', 'Count', 'Category', 'Status', 'Coordinates'].map(h => (
                  <div key={h} style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {h}
                  </div>
                ))}
              </div>

              {/* Rows */}
              <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                {crowdLog.length === 0 ? (
                  <div style={{ padding: '40px 14px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
                    Simulator writing first batch of data… (10s)
                  </div>
                ) : (
                  crowdLog.map((entry, i) => {
                    const col = entry.status === 'Critical' ? '#ef4444' : entry.status === 'Crowded' ? '#f97316' : entry.status === 'Filling' ? '#f59e0b' : '#10b981';
                    const ts  = new Date(entry.timestamp);
                    const timeStr = ts.toLocaleTimeString();
                    return (
                      <div key={entry.id || i} style={{
                        display: 'grid',
                        gridTemplateColumns: '130px 80px 80px 100px 110px 90px minmax(140px,1fr)',
                        gap: 0, padding: '9px 14px',
                        background: i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
                        borderLeft: `3px solid ${col}40`,
                        fontSize: 12,
                        transition: 'background 0.2s',
                      }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                        onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent')}
                      >
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>{timeStr}</div>
                        <div style={{ fontWeight: 700, color: entry.category === 'Entry' ? '#00E5FF' : 'rgba(255,255,255,0.3)' }}>
                          {entry.gate_id ? `Gate ${entry.gate_id}` : '—'}
                        </div>
                        <div style={{ fontWeight: 700, color: entry.category === 'Seating' ? '#a78bfa' : 'rgba(255,255,255,0.3)' }}>
                          {entry.stand_id ? `${entry.stand_id}` : '—'}
                        </div>
                        <div style={{ fontWeight: 700, color: col }}>{entry.current_count.toLocaleString()}</div>
                        <div style={{ color: 'rgba(255,255,255,0.4)' }}>
                          <span style={{ background: entry.category === 'Entry' ? 'rgba(0,229,255,0.1)' : 'rgba(167,139,250,0.1)', borderRadius: 6, padding: '2px 7px', fontSize: 11, fontWeight: 600 }}>
                            {entry.category}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: col, flexShrink: 0 }} />
                          <span style={{ color: col, fontWeight: 700 }}>{entry.status}</span>
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, fontFamily: 'monospace' }}>
                          {entry.coordinates.lat.toFixed(4)}, {entry.coordinates.lng.toFixed(4)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
