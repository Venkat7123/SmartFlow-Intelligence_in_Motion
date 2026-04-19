'use client';

import { useEffect, useRef, useState } from 'react';
import {
  MapPin, ShieldCheck, BarChart2, Navigation, Clock, Users,
  X, Wifi, Activity, Zap, TrendingUp,
} from 'lucide-react';
import {
  GateMetric, StandMetric,
  getStadiumConfig, resolveVenueKey,
  subscribeToGateMetrics, subscribeToStandMetrics, writeAllMetrics,
} from '@/lib/gateMetricsService';
import { calculateETA } from '@/lib/pathfindingService';

import { Event } from '@/types';

type Props = {
  onClose: () => void;
  event?: Event & { _targetDate?: Date };
};

declare global { interface Window { google: any; _liveMapsCallback?: () => void; } }

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusLabel(density: number) {
  if (density >= 85) return 'Packed';
  if (density >= 60) return 'Busy';
  if (density >= 30) return 'Moderate';
  return 'Clear';
}
function statusColor(density: number) {
  if (density >= 85) return '#ef4444';
  if (density >= 60) return '#f59e0b';
  if (density >= 30) return '#00E5FF';
  return '#10b981';
}

// Gaussian scatter around a gate (outside queue crowd)
function gatePointCloud(g: any, gate: GateMetric) {
  const pts: any[] = [];
  const count = Math.round(5 + (gate.density / 100) * 200);
  const maxR  = 0.0001 + (gate.density / 100) * 0.0007;

  for (let i = 0; i < count; i++) {
    const u1 = Math.random(), u2 = Math.random();
    const gauss = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
    const r = Math.abs(gauss) * maxR * 0.4;
    const theta = Math.random() * 2 * Math.PI;
    const lat = gate.lat + r * Math.sin(theta);
    const lng = gate.lng + r * Math.cos(theta);
    const weight = Math.max(0.05, 1 - r / maxR);
    pts.push({ location: new g.maps.LatLng(lat, lng), weight });
  }
  // Hot-spot at the gate mouth
  pts.push({ location: new g.maps.LatLng(gate.lat, gate.lng), weight: 4 });
  return pts;
}

// Dense Gaussian cloud inside a stand section (filled seats)
function standPointCloud(g: any, stand: StandMetric) {
  const pts: any[] = [];
  // More points = fuller stand
  const count = Math.round(10 + (stand.fillPct / 100) * 300);

  for (let i = 0; i < count; i++) {
    // Box-Muller — bivariate Gaussian to fill the stand oval
    const u1 = Math.random(), u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
    const z1 = Math.sqrt(-2 * Math.log(Math.max(u2, 1e-10))) * Math.sin(2 * Math.PI * u1);
    const lat = stand.lat + z0 * stand.spreadLat * 0.45;
    const lng = stand.lng + z1 * stand.spreadLng * 0.45;
    // Uniform weight so the stand shows as a solid blob, not a peaked spike
    pts.push({ location: new g.maps.LatLng(lat, lng), weight: 0.7 + Math.random() * 0.3 });
  }
  // A centre anchor to keep the blob solid even at low fill
  pts.push({ location: new g.maps.LatLng(stand.lat, stand.lng), weight: 2 });
  return pts;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StadiumHeatmap3D({ onClose, event }: Props) {
  const [active, setActive] = useState(false);
  const [gates,  setGates]  = useState<GateMetric[]>([]);
  const [stands, setStands] = useState<StandMetric[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const venueDesc = event?.venue || event?.title || event?.location;
  const config = getStadiumConfig(venueDesc);
  const venueKey = resolveVenueKey(venueDesc);
  const STADIUM_CENTER = config.center;

  const mapRef          = useRef<HTMLDivElement>(null);
  const mapInstance     = useRef<any>(null);
  const heatLayerRef    = useRef<any>(null);
  const markersRef      = useRef<any[]>([]);
  const mapReadyRef     = useRef(false);

  useEffect(() => {
    setActive(true);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  // ── 1. Firestore subscriptions ──────────────────────────────────────────
  useEffect(() => {
    const u1 = subscribeToGateMetrics(m => { setGates(m.filter(g => g.venueKey === venueKey)); setLastUpdated(new Date()); });
    const u2 = subscribeToStandMetrics(m => { setStands(m.filter(s => s.venueKey === venueKey)); setLastUpdated(new Date()); });
    return () => { u1(); u2(); };
  }, [venueKey]);

  // ── 2. Simulator tick: write density every 5 s ──────────────────────────
  useEffect(() => {
    function tick() {
      const now    = Date.now();
      const target = event?._targetDate ? event._targetDate.getTime() : now + 45 * 60 * 1000;
      writeAllMetrics((target - now) / 60000, event?.venue || event?.title || event?.location).catch(console.error);
    }
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [event]);

  // ── 3. Initialise Google Maps ────────────────────────────────────────────
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE' || !mapRef.current) return;

    function initMap() {
      const g = window.google;
      if (!mapRef.current || !g?.maps?.visualization) return;
      if (mapInstance.current) {
        // Map already exists — just re-center it to the correct venue
        mapInstance.current.setCenter(STADIUM_CENTER);
        mapInstance.current.setZoom(17.5);
        return;
      }
      mapInstance.current = new g.maps.Map(mapRef.current, {
        center: STADIUM_CENTER, zoom: 17.5,
        mapTypeId: 'satellite', tilt: 45, heading: -20,
        disableDefaultUI: true, zoomControl: true, scrollwheel: true,
      });
      mapReadyRef.current = true;
    }

    const SCRIPT_ID = 'gmaps-script';
    // If the map object with visualization already exists
    if (window.google?.maps?.visualization) { 
      initMap(); 
    } else if (!document.getElementById(SCRIPT_ID)) {
      window._liveMapsCallback = initMap;
      const s = document.createElement('script');
      s.id = SCRIPT_ID;
      s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=visualization&callback=_liveMapsCallback`;
      s.async = true; s.defer = true;
      document.head.appendChild(s);
    } else {
      const prev = window._liveMapsCallback;
      window._liveMapsCallback = () => { prev?.(); initMap(); };
    }
  }, [STADIUM_CENTER.lat, STADIUM_CENTER.lng]);

  // ── 3b. If map already exists and venue changes, re-center immediately ──────
  useEffect(() => {
    if (mapInstance.current && window.google?.maps) {
      mapInstance.current.setCenter(STADIUM_CENTER);
      mapInstance.current.setZoom(17.5);
      // Destroy heatmap so it gets rebuilt at the new venue
      if (heatLayerRef.current) {
        heatLayerRef.current.setMap(null);
        heatLayerRef.current = null;
      }
      // Remove old markers
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [STADIUM_CENTER.lat, STADIUM_CENTER.lng]);

  // ── 4. Redraw heatmap whenever data changes ──────────────────────────────
  useEffect(() => {
    const g = window.google;
    const map = mapInstance.current;
    if (!g?.maps?.visualization || !map) return;
    if (gates.length === 0 && stands.length === 0) return;

    const allPts: any[] = [];

    // Background ring — general concourse around the stadium
    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * Math.PI * 2;
      allPts.push({
        location: new g.maps.LatLng(
          STADIUM_CENTER.lat + Math.sin(angle) * 0.00065,
          STADIUM_CENTER.lng + Math.cos(angle) * 0.00085,
        ),
        weight: 0.1,
      });
    }

    // Gate queue clouds (outside)
    gates.forEach(gate => allPts.push(...gatePointCloud(g, gate)));

    // Stand fill clouds (inside)
    stands.forEach(stand => allPts.push(...standPointCloud(g, stand)));

    if (heatLayerRef.current) {
      heatLayerRef.current.setData(allPts);
    } else {
      heatLayerRef.current = new g.maps.visualization.HeatmapLayer({
        data: allPts, map,
        radius: 28, opacity: 0.88,
        gradient: [
          'rgba(0,0,0,0)', 'rgba(0,0,0,0)',
          '#065f46', '#10b981',
          '#a3e635', '#fbbf24', '#f97316',
          '#ef4444', '#b91c1c',
        ],
      });
    }

    // Clear & redraw gate markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    gates.forEach(gate => {
      const accent = statusColor(gate.density);
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="148" height="64" viewBox="0 0 148 64">
          <rect width="148" height="48" rx="10" fill="rgba(8,14,30,0.96)" stroke="${accent}" stroke-width="1.8"/>
          <polygon points="59,48 74,64 89,48" fill="rgba(8,14,30,0.96)" stroke="${accent}" stroke-width="1.5" stroke-linejoin="round"/>
          <rect x="10" y="10" width="28" height="28" rx="6" fill="${accent}22" stroke="${accent}" stroke-width="1.5"/>
          <text x="24" y="29" text-anchor="middle" fill="${accent}" font-size="13" font-weight="900" font-family="system-ui,sans-serif">${gate.gateId}</text>
          <text x="48" y="24" fill="white" font-size="13" font-weight="800" font-family="system-ui,sans-serif">${gate.name}</text>
          <text x="48" y="40" fill="${accent}" font-size="11" font-weight="600" font-family="system-ui,sans-serif">${statusLabel(gate.density)} · ${gate.waitMinutes}m wait</text>
          <circle cx="134" cy="14" r="5" fill="${accent}" opacity="0.9"/>
          <text x="120" y="18" text-anchor="end" fill="white" font-size="11" font-weight="700" font-family="system-ui,sans-serif">${gate.density}%</text>
        </svg>`;
      const marker = new g.maps.Marker({
        position: { lat: gate.lat, lng: gate.lng }, map,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
          scaledSize: new g.maps.Size(148, 64),
          anchor: new g.maps.Point(74, 64),
        }, zIndex: 200,
      });
      markersRef.current.push(marker);
    });
  }, [gates, stands]);

  // ── Derived values ───────────────────────────────────────────────────────
  const hasKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY &&
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE';

  const displayGates: GateMetric[] = gates.length > 0
    ? gates
    : config.gates.map(g => ({ ...g, density: 0, waitMinutes: 0, updatedAt: 0, flowRate: 0, queueCapacity: 0 }));

  const displayStands: StandMetric[] = stands.length > 0
    ? stands
    : config.stands.map(s => ({ ...s, fillPct: 0, updatedAt: 0 }));

  const emptiest = [...displayGates].sort((a, b) => a.density - b.density)[0];
  const minutesUntilEvent = event?._targetDate ? Math.round((event._targetDate.getTime() - Date.now()) / 60000) : undefined;

  // ── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100, background: '#020617',
      color: 'white', display: 'flex', flexDirection: 'column',
      opacity: active ? 1 : 0, transition: 'opacity 0.4s ease',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <style>{`
        @keyframes fadePulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '14px 28px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(2,6,23,0.95)', backdropFilter: 'blur(20px)', zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(0,229,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(0,229,255,0.2)' }}>
            <MapPin size={22} color="#00E5FF" />
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: '-0.01em' }}>Stadium Live View</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Gates + stands · real-time Firestore heatmap</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 20, padding: '6px 14px' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'fadePulse 1.5s infinite' }} />
            <span style={{ fontSize: 12, fontWeight: 800, color: '#ef4444' }}>LIVE</span>
            {lastUpdated && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>· {lastUpdated.toLocaleTimeString()}</span>}
          </div>
          <button onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: 12, padding: '10px 18px', cursor: 'pointer', fontWeight: 800, fontSize: 14 }}>
            <X size={18} /> Close
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="stadium-grid">

        {/* Map */}
        <div className="stadium-map-container">
          {hasKey ? (
            <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
          ) : (
            /* CSS heatmap — fully data-driven */
            <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 50%, #0b1e3d 0%, #020617 100%)' }}>
              <style>{`
                @keyframes heatPulse { 0%,100%{opacity:1;transform:translate(-50%,-50%) scale(1)} 50%{opacity:0.75;transform:translate(-50%,-50%) scale(1.08)} }
                @keyframes heatPulseCrit { 0%,100%{opacity:1;transform:translate(-50%,-50%) scale(1)} 50%{opacity:0.6;transform:translate(-50%,-50%) scale(1.18)} }
                @keyframes heatRing { 0%{transform:translate(-50%,-50%) scale(1);opacity:0.7} 100%{transform:translate(-50%,-50%) scale(2.6);opacity:0} }
              `}</style>

              {/* Background heat gradient — scales with average density */}
              {(() => {
                const avgD = displayGates.length ? displayGates.reduce((s,g)=>s+g.density,0)/displayGates.length : 0;
                return (
                  <div style={{
                    position: 'absolute', inset: 0, pointerEvents: 'none',
                    background: `radial-gradient(ellipse 65% 55% at 50% 50%, rgba(239,68,68,${(avgD/100)*0.14}) 0%, rgba(249,115,22,${(avgD/100)*0.08}) 45%, transparent 75%)`,
                    transition: 'background 2s ease',
                  }} />
                );
              })()}

              {/* Stand heat blobs — inside oval, scaled by live fillPct */}
              {displayStands.map((s, i) => {
                const standPos = [
                  { left: '50%', top: '12%' },
                  { left: '50%', top: '88%' },
                  { left: '88%', top: '50%' },
                  { left: '12%', top: '50%' },
                ][i % 4];
                const fill = s.fillPct;
                const col = fill >= 85 ? '#ef4444' : fill >= 60 ? '#f97316' : fill >= 30 ? '#f59e0b' : '#10b981';
                const radius = 70 + fill * 1.7;   // 70px (0%) → 240px (100%)
                const opacity = 0.22 + (fill / 100) * 0.65;
                const blur = 18 + fill * 0.2;
                const isCrit = fill >= 85;
                return (
                  <div key={s.standId}>
                    {isCrit && (
                      <div style={{ position: 'absolute', left: standPos.left, top: standPos.top, width: radius, height: radius * 0.6, borderRadius: '50%', border: `2px solid ${col}`, transform: 'translate(-50%,-50%)', animation: 'heatRing 2.2s ease-out infinite', pointerEvents: 'none' }} />
                    )}
                    <div style={{
                      position: 'absolute', ...standPos,
                      width: radius, height: radius * 0.6, borderRadius: '50%',
                      background: `radial-gradient(ellipse at center, ${col}${Math.round(opacity*255).toString(16).padStart(2,'0')} 0%, ${col}66 40%, ${col}22 65%, transparent 85%)`,
                      filter: `blur(${blur}px)`,
                      transform: 'translate(-50%,-50%)',
                      animation: isCrit ? 'heatPulseCrit 1.8s ease-in-out infinite' : 'heatPulse 2.8s ease-in-out infinite',
                      transition: 'width 1.5s ease, height 1.5s ease',
                      pointerEvents: 'none',
                      mixBlendMode: 'screen' as React.CSSProperties['mixBlendMode'],
                    }} />
                    <div style={{ position: 'absolute', ...standPos, transform: 'translate(-50%,-50%)', zIndex: 40, textAlign: 'center', pointerEvents: 'none' }}>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{s.sectionLabel}</div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: 'white' }}>{s.name}</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: col }}>{fill}%</div>
                    </div>
                  </div>
                );
              })}

              {/* Gate heat blobs — perimeter, scaled by live density */}
              {displayGates.map((g, i) => {
                const gatePos = [
                  { left: '50%', top: '4%'  },
                  { left: '50%', top: '96%' },
                  { left: '96%', top: '50%' },
                  { left: '4%',  top: '50%' },
                ][i % 4];
                const d = g.density;
                const col = statusColor(d);
                const radius = 40 + d * 1.5;   // 40px empty → 190px critical
                const opacity = 0.45 + (d / 100) * 0.55;
                const blur = 10 + d * 0.28;
                const isCrit = d >= 85;
                return (
                  <div key={g.gateId}>
                    {isCrit && [0, 1].map(r => (
                      <div key={r} style={{ position: 'absolute', left: gatePos.left, top: gatePos.top, width: radius * 1.6, height: radius * 1.6, borderRadius: '50%', border: `2px solid ${col}`, transform: 'translate(-50%,-50%)', animation: `heatRing 2s ease-out ${r * 0.9}s infinite`, pointerEvents: 'none' }} />
                    ))}
                    <div style={{
                      position: 'absolute', ...gatePos,
                      width: radius, height: radius, borderRadius: '50%',
                      background: `radial-gradient(circle, ${col}${Math.round(opacity*255).toString(16).padStart(2,'0')} 0%, ${col}77 30%, ${col}33 58%, transparent 80%)`,
                      filter: `blur(${blur}px)`,
                      transform: 'translate(-50%,-50%)',
                      animation: isCrit ? 'heatPulseCrit 1.6s ease-in-out infinite' : 'heatPulse 2.5s ease-in-out infinite',
                      transition: 'width 1.2s ease, height 1.2s ease',
                      pointerEvents: 'none',
                      mixBlendMode: 'screen' as React.CSSProperties['mixBlendMode'],
                    }} />
                    {/* Gate pill */}
                    <div style={{ position: 'absolute', ...gatePos, transform: 'translate(-50%,-50%)', zIndex: 60, background: 'rgba(4,10,24,0.94)', border: `1.5px solid ${col}`, borderRadius: 10, padding: '7px 11px', minWidth: 110, textAlign: 'center', boxShadow: `0 0 22px ${col}55` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ background: col, color: '#020617', borderRadius: 4, padding: '0 6px', fontSize: 9, fontWeight: 900 }}>{g.gateId}</span>
                        <span style={{ fontSize: 14, fontWeight: 900, color: col }}>{d}%</span>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: 'white' }}>{g.name}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>⏱ {g.waitMinutes}m · {statusLabel(d)}</div>
                      <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: 5 }}>
                        <div style={{ height: '100%', width: `${d}%`, background: `linear-gradient(90deg,#10b981,${col})`, borderRadius: 2, transition: 'width 1.5s ease' }} />
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Stadium oval shells */}
              <div style={{ position: 'absolute', inset: '8% 12%', borderRadius: '50% / 45%', border: '1px solid rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', inset: '15% 19%', borderRadius: '50% / 45%', border: '1px solid rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

              {/* Pitch */}
              <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: '22%', height: '15%', background: 'linear-gradient(135deg,#065f46,#059669)', borderRadius: 8, border: '2px solid rgba(255,255,255,0.3)', boxShadow: '0 0 32px rgba(16,185,129,0.35)', zIndex: 30 }}>
                <div style={{ position: 'absolute', inset: 7, border: '1px solid rgba(255,255,255,0.45)', borderRadius: 3 }} />
                <div style={{ position: 'absolute', left: '50%', top: 7, bottom: 7, width: 1, background: 'rgba(255,255,255,0.45)' }} />
                <div style={{ position: 'absolute', left: '50%', top: '50%', width: '26%', height: '50%', transform: 'translate(-50%,-50%)', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.45)' }} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 8, fontWeight: 800, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.15em' }}>PITCH</div>
                </div>
              </div>

              <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', fontSize: 10, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
                Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for satellite view
              </div>
            </div>
          )}

          {/* HUD tag */}
          <div style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(2,6,23,0.88)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.08)', padding: '8px 14px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Wifi size={14} color="#00E5FF" />
            <span style={{ fontSize: 13, fontWeight: 700 }}>Firestore Live · 5s tick</span>
          </div>

          {/* Stats bar */}
          <div className="stadium-stats-bar">
            {[
              { label: 'Gate Avg', value: `${displayGates.length ? Math.round(displayGates.reduce((a,g)=>a+g.density,0)/displayGates.length) : 0}%`, icon: Users, color: '#00E5FF' },
              { label: 'Best Entry', value: emptiest?.name ?? '—', icon: Navigation, color: '#10b981' },
              { label: 'Avg Wait', value: `${Math.round(displayGates.reduce((s, m) => s + m.waitMinutes, 0) / (displayGates.length || 1))}m`, icon: Clock, color: '#f59e0b' },
              { label: 'Stands Avg', value: `${displayStands.length ? Math.round(displayStands.reduce((a,s)=>a+s.fillPct,0)/displayStands.length) : 0}%`, icon: BarChart2, color: '#a78bfa' },
            ].map(item => (
              <div key={item.label} style={{ background: 'rgba(5,12,24,0.88)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '14px 16px', backdropFilter: 'blur(16px)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <item.icon size={15} color={item.color} />
                  <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, color: 'rgba(255,255,255,0.4)' }}>{item.label}</span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, overflowY: 'auto' }}>

          {/* ── Gate Crowd Queue ──────────────────────────── */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <ShieldCheck size={18} color="#10b981" />
              <span style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)' }}>Gate Crowd Queue</span>
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              {[...displayGates].sort((a, b) => a.gateId > b.gateId ? 1 : -1).map(gate => {
                const accent = statusColor(gate.density);
                return (
                  <div key={gate.gateId}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${accent}15`, border: `1px solid ${accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: accent, fontSize: 13 }}>
                          {gate.gateId}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 14 }}>{gate.name}</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{statusLabel(gate.density)} · {gate.waitMinutes}m wait</div>
                        </div>
                      </div>
                      <div style={{ color: accent, fontWeight: 900, fontSize: 17 }}>{gate.density}%</div>
                    </div>
                    <div style={{ height: 5, borderRadius: 5, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${gate.density}%`, background: `linear-gradient(90deg,#10b981,${accent})`, borderRadius: 5, transition: 'width 1.2s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Stand Occupancy ───────────────────────────── */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <BarChart2 size={18} color="#a78bfa" />
              <span style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)' }}>Stand Occupancy</span>
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              {displayStands.map(stand => {
                const accent = statusColor(stand.fillPct);
                return (
                  <div key={stand.standId}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14 }}>{stand.name}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{stand.sectionLabel} · {statusLabel(stand.fillPct)}</div>
                      </div>
                      <div style={{ color: accent, fontWeight: 900, fontSize: 17 }}>{stand.fillPct}%</div>
                    </div>
                    <div style={{ height: 5, borderRadius: 5, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${stand.fillPct}%`, background: `linear-gradient(90deg,#8b5cf6,${accent})`, borderRadius: 5, transition: 'width 1.4s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Predictive ETA Engine ──────────────────────── */}
          <div style={{ background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.14)', borderRadius: 24, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Zap size={18} color="#00E5FF" />
              <span style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)' }}>Predictive ETA Engine</span>
            </div>

            {/* Per-gate ETA pills */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[...displayGates].sort((a, b) => a.gateId > b.gateId ? 1 : -1).map(g => {
                const N   = Math.round((g.density / 100) * (g.queueCapacity || 600));
                const eta = calculateETA(N, g.flowRate || 25, 1);
                const col = statusColor(g.density);
                return (
                  <div key={g.gateId} style={{ background: `${col}0f`, border: `1px solid ${col}30`, borderRadius: 12, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: col }}>Gate {g.gateId}</span>
                      <span style={{ fontSize: 15, fontWeight: 900, color: col }}>{eta}m</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{g.density}% · {g.flowRate || 25}/min</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Smart Entry Recommendation ──────────────── */}
          <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 24, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Navigation size={18} color="#10b981" />
              <span style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)' }}>Smart Entry</span>
              <span style={{ marginLeft: 'auto', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 800, color: '#10b981' }}>OPTIMAL</span>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 30, fontWeight: 900, color: '#10b981', lineHeight: 1, marginBottom: 4 }}>{emptiest?.name ?? 'Calculating…'}</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Density <strong style={{ color: '#10b981' }}>{emptiest?.density ?? 0}%</strong></span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Wait <strong style={{ color: '#10b981' }}>{emptiest?.waitMinutes ?? 0} min</strong></span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Flow <strong style={{ color: '#10b981' }}>{emptiest?.flowRate ?? 25}/min</strong></span>
              </div>
            </div>

            {/* Compare all gates (sorted by density) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[...displayGates].sort((a, b) => a.density - b.density).map((g, rank) => {
                const col = statusColor(g.density);
                const isBest = rank === 0;
                return (
                  <div key={g.gateId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 10, background: isBest ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)', border: isBest ? '1px solid rgba(16,185,129,0.2)' : '1px solid transparent' }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: `${col}18`, border: `1px solid ${col}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: col, flexShrink: 0 }}>{g.gateId}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${g.density}%`, background: col, borderRadius: 2, transition: 'width 1.2s ease' }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, color: col, flexShrink: 0 }}>{g.density}%</span>
                    {isBest && <span style={{ fontSize: 9, color: '#10b981', fontWeight: 900, letterSpacing: '0.05em' }}>BEST</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '14px 18px' }}>
            <div style={{ display: 'grid', gap: 8 }}>
              {[
                { col: '#b91c1c', label: 'Packed — 85–100%' },
                { col: '#f97316', label: 'Busy — 60–84%' },
                { col: '#fbbf24', label: 'Moderate — 30–59%' },
                { col: '#10b981', label: 'Clear — 0–29%' },
              ].map(item => (
                <div key={item.col} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: item.col, flexShrink: 0 }} />
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default StadiumHeatmap3D;