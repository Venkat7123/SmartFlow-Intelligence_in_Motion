'use client';
import { useEffect, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TransportPoint {
  lat: number;
  lng: number;
  type: 'metro' | 'parking';
  label: string;
  eta: string;
  line: string;
}

export interface StadiumMapProps {
  /** Display name shown in the info-window title */
  eventName?: string;
  /** The venue / stadium to centre the map on */
  stadium: {
    lat: number;
    lng: number;
    name: string;
  };
  /** The viewer's current location (optional) */
  userLocation?: {
    lat: number;
    lng: number;
  };
  /** Nearby transport & parking points (optional) */
  transport?: TransportPoint[];
}

// ─── Default fallback (only used when no prop is supplied) ────────────────────

const DEFAULT_STADIUM = { lat: 18.9388, lng: 72.8258, name: 'Wankhede Stadium' };

const DEFAULT_TRANSPORT: TransportPoint[] = [
  { lat: 18.9320, lng: 72.8195, type: 'metro',   label: 'Churchgate Station',   eta: '4 min walk',  line: 'Western Line'   },
  { lat: 18.9415, lng: 72.8285, type: 'metro',   label: 'Marine Lines Station', eta: '6 min walk',  line: 'Central Line'   },
  { lat: 18.9365, lng: 72.8248, type: 'parking', label: 'P1 — Stadium Parking', eta: 'Gate A entry', line: '120 spaces'     },
  { lat: 18.9370, lng: 72.8228, type: 'parking', label: 'P2 — Overflow Lot',    eta: 'Gate C entry', line: '80 spaces left' },
];

declare global { interface Window { google: any; _mapsMapCallback?: () => void; } }

// ─── Component ────────────────────────────────────────────────────────────────

export function StadiumMap({
  eventName,
  stadium   = DEFAULT_STADIUM,
  userLocation,
  transport = DEFAULT_TRANSPORT,
}: StadiumMapProps) {
  const mapRef      = useRef<HTMLDivElement>(null);
  // Keep a ref to the map instance so we can re-center when the stadium changes
  const mapInstance = useRef<any>(null);

  // Re-center and rebuild markers whenever the stadium or transport data changes
  useEffect(() => {
    if (!mapInstance.current) return; // map not ready yet – initMap handles first render
    const g = window.google;
    if (!g?.maps) return;
    mapInstance.current.setCenter(stadium);
    rebuildMarkers(g, mapInstance.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stadium.lat, stadium.lng, transport]);

  // ── Map initialisation ──────────────────────────────────────────────────────

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE' || !mapRef.current) return;

    function rebuildMarkersLocal(g: any, map: any) {
      rebuildMarkers(g, map);
    }

    function initMap() {
      const g = window.google;
      if (!mapRef.current || !g) return;

      // Only create the map once; subsequent stadium changes just re-center
      if (!mapInstance.current) {
        mapInstance.current = new g.maps.Map(mapRef.current, {
          center:             stadium,          // ← dynamic
          zoom:               17,
          mapTypeId:          'satellite',
          tilt:               0,
          heading:            0,
          disableDefaultUI:   true,
          zoomControl:        true,
          mapTypeControl:     false,
          streetViewControl:  false,
          fullscreenControl:  false,
        });
      } else {
        mapInstance.current.setCenter(stadium); // re-center if map already existed
      }

      rebuildMarkersLocal(g, mapInstance.current);
    }

    const SCRIPT_ID = 'gmaps-script';
    if (window.google?.maps) {
      initMap();
    } else if (!document.getElementById(SCRIPT_ID)) {
      window._mapsMapCallback = initMap;
      const script = document.createElement('script');
      script.id    = SCRIPT_ID;
      script.src   = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=visualization&callback=_mapsMapCallback`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    } else {
      const prev = window._mapsMapCallback;
      window._mapsMapCallback = () => { prev?.(); initMap(); };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stadium.lat, stadium.lng]);

  // ── Marker builder (extracted so it can be called from both effects) ─────────

  function rebuildMarkers(g: any, map: any) {
    // Clear existing markers by replacing the map's overlayMapTypes is not needed;
    // instead we store marker refs. For brevity here we create a closure-fresh set.
    // In a larger app, keep a markersRef array and call marker.setMap(null) first.

    // Stadium marker
    const stadiumMarker = new g.maps.Marker({
      position: stadium, map,
      title: eventName || stadium.name,    // ← uses the dynamic stadium name
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="18" fill="#EF4444" stroke="white" stroke-width="3"/>
            <text x="20" y="26" text-anchor="middle" fill="white" font-size="18">🏟️</text>
          </svg>`
        ),
        scaledSize: new g.maps.Size(40, 40),
        anchor:     new g.maps.Point(20, 20),
      },
    });

    const stadiumInfo = new g.maps.InfoWindow({
      content: `<div style="font-family:sans-serif;padding:6px 2px">
        <strong style="font-size:14px">${eventName || stadium.name}</strong><br/>
        <span style="color:#64748b;font-size:12px">📍 ${stadium.name}</span>
      </div>`,
    });
    stadiumMarker.addListener('click', () => stadiumInfo.open(map, stadiumMarker));

    // User location (only if provided)
    if (userLocation) {
      new g.maps.Marker({
        position: userLocation, map,
        title: 'Your Location', zIndex: 10,
        icon: {
          path:          g.maps.SymbolPath.CIRCLE,
          scale:         10,
          fillColor:     '#00E5FF',
          fillOpacity:   1,
          strokeColor:   'white',
          strokeWeight:  3,
        },
      });
    }

    // Transport markers
    transport.forEach(t => {
      const icon = t.type === 'metro'
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><rect width="36" height="36" rx="8" fill="#1D4ED8"/><text x="18" y="24" text-anchor="middle" fill="white" font-size="18">🚇</text></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><rect width="36" height="36" rx="8" fill="#16A34A"/><text x="18" y="24" text-anchor="middle" fill="white" font-size="16">🅿️</text></svg>`;

      const marker = new g.maps.Marker({
        position: { lat: t.lat, lng: t.lng }, map,
        title: t.label,
        icon: {
          url:       'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(icon),
          scaledSize: new g.maps.Size(36, 36),
          anchor:     new g.maps.Point(18, 18),
        },
      });

      const info = new g.maps.InfoWindow({
        content: `<div style="font-family:sans-serif;padding:6px 2px;min-width:160px">
          <strong style="font-size:13px">${t.label}</strong><br/>
          <span style="color:#64748b;font-size:12px">${t.line}</span><br/>
          <span style="color:#059669;font-size:12px;font-weight:600">⏱ ${t.eta}</span>
        </div>`,
      });
      marker.addListener('click', () => info.open(map, marker));
    });
  }

  const hasKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY &&
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE';

  return (
    <div style={{ position: 'relative', minHeight: 320, borderRadius: 12, overflow: 'visible', background: '#0f172a' }}>
      <div style={{ position: 'relative', height: 280, borderRadius: 12, overflow: 'hidden' }}>
        {hasKey ? (
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 10,
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          }}>
            <div style={{ fontSize: 44 }}>🗺️</div>
            {/* Now shows the dynamic stadium name in the fallback UI too */}
            <div style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>{stadium.name}</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>
              Add your Google Maps API key to <code style={{ color: '#00E5FF' }}>.env.local</code><br />
              <code style={{ color: '#94a3b8', fontSize: 11 }}>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key</code>
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 16 }}>
              {[
                { icon: '🏟️', label: stadium.name },
                { icon: '🚇', label: `${transport.filter(t => t.type === 'metro').length} Metro` },
                { icon: '🅿️', label: `${transport.filter(t => t.type === 'parking').length} Parking` },
                ...(userLocation ? [{ icon: '🔵', label: 'You' }] : []),
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                  <span>{item.icon}</span><span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{
          position: 'absolute', bottom: 12, left: 12, background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)', borderRadius: 10, padding: '8px 12px',
          display: 'flex', flexDirection: 'column', gap: 5, zIndex: 10,
        }}>
          {[
            ...(userLocation ? [{ icon: '🔵', label: 'Your Location' }] : []),
            { icon: '🏟️', label: stadium.name },
            { icon: '🚇', label: 'Metro / Train' },
            { icon: '🅿️', label: 'Parking' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'white' }}>
              <span>{item.icon}</span><span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}