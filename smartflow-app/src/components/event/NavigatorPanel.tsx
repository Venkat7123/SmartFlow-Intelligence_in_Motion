'use client';

import { useState, useMemo } from 'react';
import {
  Navigation, AlertTriangle, ChevronRight, MapPin,
  Clock, CheckCircle2, ArrowRight,
} from 'lucide-react';
import type { GateMetric } from '@/lib/gateMetricsService';
import { getCurrentStatus } from '@/lib/gateMetricsService';
import {
  findPath, calculateETA,
  GATE_OPTIONS, STAND_OPTIONS,
  STADIUM_NODES,
  type NodeId, type StadiumNode,
} from '@/lib/pathfindingService';

// ── Color helpers ─────────────────────────────────────────────────────────────

function densityColor(density: number) {
  if (density >= 85) return '#ef4444';
  if (density >= 60) return '#f97316';
  if (density >= 30) return '#f59e0b';
  return '#10b981';
}

function nodeTypeIcon(type: StadiumNode['type']) {
  if (type === 'gate') return '🚪';
  if (type === 'concourse') return '🏟️';
  if (type === 'stair') return '🪜';
  return '💺';
}

function nodeTypeLabel(type: StadiumNode['type']) {
  if (type === 'gate') return 'Gate entrance';
  if (type === 'concourse') return 'Main concourse';
  if (type === 'stair') return 'Stairwell / Ramp';
  return 'Seating stand';
}

// ── SVG Stadium Mini-map ───────────────────────────────────────────────────────

function StadiumMiniMap({ path, gates }: { path: NodeId[]; gates: GateMetric[] }) {
  const pathSet = new Set(path);

  // Node grid positions (scaled to SVG canvas 200×200)
  const scale = 18;
  const offset = 10;

  return (
    <svg viewBox="0 0 200 200" width="100%" height="180"
      style={{ borderRadius: 16, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>

      {/* Stadium oval */}
      <ellipse cx="100" cy="100" rx="70" ry="65" fill="none"
        stroke="rgba(255,255,255,0.08)" strokeWidth="20" />
      <ellipse cx="100" cy="100" rx="70" ry="65" fill="none"
        stroke="rgba(255,255,255,0.04)" strokeWidth="1" />

      {/* Pitch */}
      <rect x="72" y="78" width="56" height="44" rx="4"
        fill="rgba(5,150,105,0.4)" stroke="rgba(16,185,129,0.6)" strokeWidth="1" />
      <line x1="100" y1="78" x2="100" y2="122" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
      <ellipse cx="100" cy="100" rx="10" ry="8" fill="none"
        stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />

      {/* Draw edges (path segments highlighted) */}
      {path.length > 1 && path.map((nid, i) => {
        if (i === path.length - 1) return null;
        const a = STADIUM_NODES.find(n => n.id === nid)!;
        const b = STADIUM_NODES.find(n => n.id === path[i + 1])!;
        const ax = offset + a.gridX * scale;
        const ay = offset + a.gridY * scale;
        const bx = offset + b.gridX * scale;
        const by = offset + b.gridY * scale;
        return (
          <line key={`edge-${i}`}
            x1={ax} y1={ay} x2={bx} y2={by}
            stroke="#00E5FF" strokeWidth="2.5" strokeDasharray="5 3"
            style={{ filter: 'drop-shadow(0 0 4px #00E5FF)' }}
          />
        );
      })}

      {/* Draw nodes */}
      {STADIUM_NODES.map(node => {
        const x = offset + node.gridX * scale;
        const y = offset + node.gridY * scale;
        const isOnPath = pathSet.has(node.id);
        const gateMetric = node.gateId
          ? gates.find(g => g.gateId === node.gateId)
          : null;
        const density = gateMetric?.density ?? 0;
        const col = isOnPath
          ? (node.type === 'stand' ? '#10b981' : '#00E5FF')
          : (density >= 85 ? '#ef4444' : 'rgba(255,255,255,0.2)');
        const r = node.type === 'gate' ? 8 : node.type === 'stand' ? 7 : 5;

        return (
          <g key={node.id}>
            {isOnPath && (
              <circle cx={x} cy={y} r={r + 5}
                fill="transparent" stroke={col} strokeWidth="1" opacity="0.3" />
            )}
            <circle cx={x} cy={y} r={r}
              fill={isOnPath ? col : 'rgba(0,0,0,0.7)'}
              stroke={col} strokeWidth="1.5" />
            {(node.type === 'gate' || node.type === 'stand') && (
              <text x={x} y={y + 4} textAnchor="middle"
                fontSize="7" fontWeight="bold" fill={isOnPath ? '#000' : col}>
                {node.type === 'gate' ? node.gateId || '' : (node.standId || '').slice(0, 1)}
              </text>
            )}
          </g>
        );
      })}

      {/* Legend */}
      <g transform="translate(6, 180)">
        <circle cx="6" cy="6" r="4" fill="#00E5FF" />
        <text x="14" y="10" fontSize="7" fill="rgba(255,255,255,0.4)">Your path</text>
        <circle cx="70" cy="6" r="4" fill="#ef4444" />
        <text x="78" y="10" fontSize="7" fill="rgba(255,255,255,0.4)">Critical zone</text>
      </g>
    </svg>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface Props {
  gates: GateMetric[];
  eventTitle?: string;
}

export function NavigatorPanel({ gates, eventTitle }: Props) {
  const [selectedGate, setSelectedGate]   = useState<string>('A');
  const [selectedStand, setSelectedStand] = useState<string>('North');
  const [hasRun, setHasRun]               = useState(false);

  const result = useMemo(() => {
    if (!hasRun || !gates.length) return null;
    return findPath(selectedGate, selectedStand, gates);
  }, [hasRun, selectedGate, selectedStand, gates]);

  const handleFind = () => setHasRun(true);

  // Reset when inputs change
  const handleGateChange = (v: string) => { setSelectedGate(v); setHasRun(false); };
  const handleStandChange = (v: string) => { setSelectedStand(v); setHasRun(false); };

  // Global ETA for selected gate using Tw = N / (R × G)
  const selectedGateMetric = gates.find(g => g.gateId === selectedGate);
  const gateN   = selectedGateMetric ? Math.round((selectedGateMetric.density / 100) * (selectedGateMetric.queueCapacity || 600)) : 0;
  const gateR   = selectedGateMetric?.flowRate ?? 20;
  const gateETA = calculateETA(gateN, gateR, 1);
  const gateStatus = getCurrentStatus(selectedGateMetric?.density ?? 0);

  const selectStyle: React.CSSProperties = {
    flex: 1, padding: '10px 14px', borderRadius: 12, fontSize: 14, fontWeight: 600,
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
    color: 'white', appearance: 'none', cursor: 'pointer', outline: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%' }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px',
        background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)',
        borderRadius: 20,
      }}>
        <Navigation size={20} color="#10b981" />
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'white' }}>Smart Navigator</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
            A* pathfinding · avoids critical zones
          </div>
        </div>
      </div>

      {/* ── Inputs ── */}
      <div style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div>
          <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
            Your Entry Gate
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {GATE_OPTIONS.map(g => {
              const metric = gates.find(gm => gm.gateId === g);
              const col = densityColor(metric?.density ?? 0);
              const isSelected = selectedGate === g;
              return (
                <button key={g}
                  onClick={() => handleGateChange(g)}
                  style={{
                    flex: 1, padding: '10px 6px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                    background: isSelected ? `${col}15` : 'rgba(255,255,255,0.03)',
                    border: `1.5px solid ${isSelected ? col : 'rgba(255,255,255,0.1)'}`,
                    color: isSelected ? col : 'rgba(255,255,255,0.5)',
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}>
                  {g}
                  {metric && (
                    <div style={{ fontSize: 9, marginTop: 3, opacity: 0.7 }}>{metric.density}%</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
            Stand Assignment
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {STAND_OPTIONS.map(s => {
              const isSelected = selectedStand === s;
              return (
                <button key={s}
                  onClick={() => handleStandChange(s)}
                  style={{
                    flex: 1, padding: '10px 4px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                    background: isSelected ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.03)',
                    border: `1.5px solid ${isSelected ? '#a78bfa' : 'rgba(255,255,255,0.1)'}`,
                    color: isSelected ? '#a78bfa' : 'rgba(255,255,255,0.5)',
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}>
                  {s.slice(0, 1)}
                  <div style={{ fontSize: 9, marginTop: 2, opacity: 0.7 }}>{s}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Gate status indicator */}
        {selectedGateMetric && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
            borderRadius: 10, background: `${densityColor(selectedGateMetric.density)}10`,
            border: `1px solid ${densityColor(selectedGateMetric.density)}25`,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: densityColor(selectedGateMetric.density), flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
              Gate {selectedGate} is <strong style={{ color: densityColor(selectedGateMetric.density) }}>{gateStatus}</strong> — queue wait ≈ <strong>{gateETA} min</strong>
            </span>
          </div>
        )}

        <button
          onClick={handleFind}
          style={{
            width: '100%', padding: '14px', borderRadius: 12, fontSize: 14, fontWeight: 800,
            background: 'linear-gradient(135deg, #059669, #10b981)',
            border: 'none', color: 'white', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0 4px 20px rgba(16,185,129,0.25)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 28px rgba(16,185,129,0.4)')}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(16,185,129,0.25)')}
        >
          <Navigation size={16} />
          Find My Route
        </button>
      </div>

      {/* ── Result ── */}
      {result && (
        <>
          {/* ETA summary */}
          <div style={{
            display: 'flex', gap: 12,
            background: result.etaMinutes > 30
              ? 'rgba(239,68,68,0.06)'
              : 'rgba(16,185,129,0.06)',
            border: `1px solid ${result.etaMinutes > 30 ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
            borderRadius: 16, padding: '16px 18px', alignItems: 'center',
          }}>
            <Clock size={20} color={result.etaMinutes > 30 ? '#ef4444' : '#10b981'} style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>
                Estimated Time to Seat
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: result.etaMinutes > 30 ? '#ef4444' : '#10b981', lineHeight: 1 }}>
                {result.etaMinutes} min
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>
                Gate {selectedGate} → {selectedStand} Stand · {result.nodes.length} waypoints
              </div>
            </div>
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div style={{
              background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 14, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              {result.warnings.map((w, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <AlertTriangle size={13} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Mini-map */}
          <StadiumMiniMap path={result.path} gates={gates} />

          {/* Route steps */}
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20, padding: 20,
          }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
              Route Steps
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {result.nodes.map((node, i) => {
                const isLast = i === result.nodes.length - 1;
                const gateMetric = node.gateId ? gates.find(g => g.gateId === node.gateId) : null;
                const col = gateMetric ? densityColor(gateMetric.density) : 'rgba(255,255,255,0.4)';

                return (
                  <div key={node.id}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      {/* Step indicator */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: isLast ? 'rgba(167,139,250,0.15)' : `${col}15`,
                          border: `1.5px solid ${isLast ? '#a78bfa' : col}`,
                          fontSize: 14,
                        }}>
                          {isLast ? <CheckCircle2 size={14} color="#a78bfa" /> : nodeTypeIcon(node.type)}
                        </div>
                        {!isLast && (
                          <div style={{ width: 1, flex: 1, minHeight: 16, background: 'rgba(255,255,255,0.07)', margin: '4px 0' }} />
                        )}
                      </div>

                      {/* Step info */}
                      <div style={{ paddingBottom: isLast ? 0 : 16, paddingTop: 4, flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'white', marginBottom: 2 }}>
                              {node.label}
                            </div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                              {nodeTypeLabel(node.type)}
                            </div>
                          </div>
                          {gateMetric && (
                            <div style={{ fontSize: 11, color: col, fontWeight: 700 }}>
                              {gateMetric.density}%
                            </div>
                          )}
                        </div>
                        {gateMetric && gateMetric.density >= 85 && (
                          <div style={{ marginTop: 6, fontSize: 11, color: '#ef4444', display: 'flex', gap: 4, alignItems: 'center' }}>
                            <AlertTriangle size={11} />
                            Critical — reroute if possible
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {!hasRun && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center',
          border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 20,
          color: 'rgba(255,255,255,0.25)',
        }}>
          <MapPin size={32} strokeWidth={1.5} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>Select your gate and stand</div>
          <div style={{ fontSize: 12, lineHeight: 1.5 }}>
            The A* engine will calculate the fastest crowd-avoiding route to your seat.
          </div>
        </div>
      )}
    </div>
  );
}
