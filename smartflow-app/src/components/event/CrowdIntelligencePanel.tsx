'use client';

import { useMemo } from 'react';
import { Activity, TrendingUp, Clock, AlertTriangle, Zap, Users } from 'lucide-react';
import type { GateMetric, CrowdLogEntry } from '@/lib/gateMetricsService';
import { getCurrentStatus, getBaselineCrowdCount } from '@/lib/gateMetricsService';
import { calculateETA } from '@/lib/pathfindingService';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  gates: GateMetric[];
  crowdLog: CrowdLogEntry[];
  minutesUntilEvent: number;
  eventTime: string; // e.g. "7:30 PM"
  venueKey: string;
}

// ── Phase timeline definition ──────────────────────────────────────────────────

const PHASES = [
  { label: '4:30 PM', offset: -180, additive: '+2',  surgeClass: false },
  { label: '4:45 PM', offset: -165, additive: '+5',  surgeClass: false },
  { label: '5:00 PM', offset: -150, additive: '+20', surgeClass: true  },
  { label: '5:30 PM', offset: -120, additive: '+50', surgeClass: true  },
  { label: '6:00 PM', offset: -90,  additive: '+50', surgeClass: true  },
  { label: '6:30 PM', offset: -60,  additive: '+20', surgeClass: false },
  { label: '7:00 PM', offset: -30,  additive: '+5',  surgeClass: false },
  { label: '7:30 PM', offset: 0,    additive: '🎯',  surgeClass: false },
];

// ── Color helpers ──────────────────────────────────────────────────────────────

function statusColor(status: string) {
  if (status === 'Critical') return '#ef4444';
  if (status === 'Crowded')  return '#f97316';
  if (status === 'Filling')  return '#f59e0b';
  return '#10b981';
}

function densityColor(density: number) {
  if (density >= 85) return '#ef4444';
  if (density >= 60) return '#f97316';
  if (density >= 30) return '#f59e0b';
  return '#10b981';
}

function formatTimestamp(ts: number) {
  const d = new Date(ts);
  const h = d.getHours() % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ap = d.getHours() >= 12 ? 'PM' : 'AM';
  return `${h}:${m}:${s} ${ap}`;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function CrowdIntelligencePanel({ gates, crowdLog, minutesUntilEvent, eventTime, venueKey }: Props) {
  // Active phase based on current minutesUntilEvent
  const activePhaseIdx = useMemo(() => {
    for (let i = PHASES.length - 1; i >= 0; i--) {
      if (minutesUntilEvent <= PHASES[i].offset) return i;
    }
    return 0;
  }, [minutesUntilEvent]);

  const isSurgeWindow = minutesUntilEvent >= -150 && minutesUntilEvent <= -60;

  // Global ETA using Tw = N / (R × G)
  const totalN = gates.reduce((sum, g) => sum + (g.density / 100) * (g.queueCapacity || 600), 0);
  const avgR   = gates.length ? gates.reduce((sum, g) => sum + g.flowRate, 0) / gates.length : 20;
  const G      = gates.filter(g => g.density < 85).length || 1;
  const globalETA = calculateETA(Math.round(totalN), Math.round(avgR), G);

  // Baseline crowd counts for current phase
  const baselineCounts = useMemo(() =>
    ['A', 'B', 'C', 'D'].map(id => ({
      gate: id,
      count: getBaselineCrowdCount(id, minutesUntilEvent),
    })),
    [minutesUntilEvent]
  );

  // Recent log entries for the table (gate entries only, max 12)
  const recentGateLog = useMemo(() =>
    crowdLog.filter(e => e.category === 'Entry').slice(0, 12),
    [crowdLog]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%' }}>

      {/* ── Surge Alert ── */}
      {isSurgeWindow && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(249,115,22,0.08))',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 16, padding: '14px 18px',
          display: 'flex', gap: 12, alignItems: 'flex-start',
          animation: 'ciPulse 2s ease infinite',
        }}>
          <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ color: '#ef4444', fontWeight: 800, fontSize: 14, marginBottom: 3 }}>
              Peak Surge Window Active — 5:00 PM to 6:30 PM
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 1.5 }}>
              This is the highest fan influx period. Gate queues are growing rapidly.
              Consider using Gate C or D to avoid congestion.
            </div>
          </div>
        </div>
      )}

      {/* ── ETA Widget — Tw = N / (R × G) ── */}
      <div style={{
        background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.15)',
        borderRadius: 20, padding: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Zap size={16} color="#00E5FF" />
          <span style={{ fontSize: 13, fontWeight: 800, color: '#00E5FF', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Predictive ETA Engine
          </span>
        </div>

        {/* Formula display */}
        <div style={{
          background: 'rgba(0,0,0,0.4)', borderRadius: 12, padding: '12px 16px',
          fontFamily: 'monospace', marginBottom: 16, border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Wait Time Formula:</div>
          <div style={{ fontSize: 15, color: '#00E5FF', fontWeight: 700 }}>
            T<sub style={{ fontSize: 10 }}>w</sub> = N / (R × G)
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
              N = <strong style={{ color: 'white' }}>{Math.round(totalN).toLocaleString()}</strong> fans
            </span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
              R = <strong style={{ color: 'white' }}>{Math.round(avgR)}</strong>/min
            </span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
              G = <strong style={{ color: 'white' }}>{G}</strong> active gates
            </span>
          </div>
        </div>

        {/* Result */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>
              GLOBAL ETA
            </div>
            <div style={{ fontSize: 42, fontWeight: 900, color: globalETA > 30 ? '#ef4444' : globalETA > 15 ? '#f97316' : '#10b981', lineHeight: 1 }}>
              {globalETA}<span style={{ fontSize: 18, opacity: 0.6 }}>min</span>
            </div>
          </div>
          {/* Per-gate ETA pills */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {gates.map(g => {
              const gN = Math.round((g.density / 100) * (g.queueCapacity || 600));
              const eta = calculateETA(gN, g.flowRate, 1);
              const col = densityColor(g.density);
              return (
                <div key={g.gateId} style={{
                  background: `${col}10`, border: `1px solid ${col}30`,
                  borderRadius: 10, padding: '8px 10px',
                }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Gate {g.gateId}</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: col }}>{eta}m</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{g.flowRate}/min · {g.density}%</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Phase / Multiplier Timeline ── */}
      <div style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20, padding: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <TrendingUp size={16} color="#a78bfa" />
          <span style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Crowd Multiplier Timeline
          </span>
        </div>

        {/* Baseline counts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 16 }}>
          {baselineCounts.map(({ gate, count }) => (
            <div key={gate} style={{
              textAlign: 'center', padding: '8px 6px',
              background: 'rgba(255,255,255,0.03)', borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 3 }}>Gate {gate}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#a78bfa' }}>{count.toLocaleString()}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>fans</div>
            </div>
          ))}
        </div>

        {/* Phase strip */}
        <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
          <div style={{ display: 'flex', gap: 4, minWidth: 'max-content' }}>
            {PHASES.map((ph, idx) => {
              const isActive  = idx === activePhaseIdx;
              const isPast    = idx < activePhaseIdx;
              const isSurge   = ph.surgeClass;
              const bg = isActive ? 'rgba(0,229,255,0.15)' : isPast ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)';
              const border = isActive ? '1px solid rgba(0,229,255,0.4)' : isSurge ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(255,255,255,0.07)';
              const addColor = isSurge ? '#ef4444' : '#10b981';

              return (
                <div key={ph.label} style={{
                  minWidth: 66, padding: '8px 6px', textAlign: 'center',
                  background: bg, border, borderRadius: 10,
                  opacity: isPast ? 0.5 : 1,
                  transition: 'all 0.3s ease',
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: isActive ? '#00E5FF' : 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                    {ph.label}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: addColor }}>
                    {ph.additive}
                  </div>
                  {isSurge && (
                    <div style={{ fontSize: 8, color: '#ef4444', fontWeight: 700, marginTop: 3, letterSpacing: '0.05em' }}>SURGE</div>
                  )}
                  {isActive && (
                    <div style={{ fontSize: 8, color: '#00E5FF', fontWeight: 700, marginTop: 3 }}>NOW</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 10, lineHeight: 1.5 }}>
          Each bar shows the fan count increment added per 15-minute window.
          Surge window (5:00–6:30 PM) has the highest influx rate.
        </div>
      </div>

      {/* ── Live Crowd Log Table ── */}
      <div style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20, padding: 20, flex: 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Activity size={16} color="#00E5FF" />
          <span style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Live Data Log
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
            crowd_log · Firestore
          </span>
        </div>

        {/* Table header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '85px 60px 50px 80px 80px',
          gap: 0, padding: '6px 10px', marginBottom: 4,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          {['Timestamp', 'Gate/Stand', 'Count', 'Category', 'Status'].map(h => (
            <div key={h} style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {h}
            </div>
          ))}
        </div>

        {/* Table rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 240, overflowY: 'auto' }}>
          {recentGateLog.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
              Waiting for first log entry…
            </div>
          ) : (
            recentGateLog.map((entry, i) => {
              const col = statusColor(entry.status);
              const label = entry.category === 'Entry' ? `Gate ${entry.gate_id}` : `${entry.stand_id} Stand`;
              return (
                <div key={entry.id || i} style={{
                  display: 'grid', gridTemplateColumns: '85px 60px 50px 80px 80px',
                  gap: 0, padding: '7px 10px', borderRadius: 8,
                  background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                  borderLeft: `3px solid ${col}40`,
                }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatTimestamp(entry.timestamp)}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'white' }}>{label}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: col }}>{entry.current_count.toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{entry.category}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: col, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: col, fontWeight: 700 }}>{entry.status}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <style>{`
        @keyframes ciPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
