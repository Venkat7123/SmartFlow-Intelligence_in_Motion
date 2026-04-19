/**
 * gateMetricsService.ts
 *
 * Handles all Firestore read/write for real-time gate AND stand crowd density.
 *
 * Collections:
 *   gateMetrics/{gateId}      — outside gate queues
 *   standMetrics/{standId}     — inside stadium seating sections
 *   crowd_log/{auto-id}        — time-series simulation log per the spec
 *   stadium_live_data/{venue}  — time-slot predictions
 */

import { db } from '@/lib/firebase/config';
import { collection, doc, setDoc, onSnapshot, addDoc, query, orderBy, limit } from 'firebase/firestore';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GateMetric {
  gateId: string;
  name: string;
  density: number;       // 0–100, outside crowd queue intensity
  flowRate: number;      // Fans processed per minute
  queueCapacity: number; // Max fan capacity in outer perimeter queue
  waitMinutes: number;   // Calculated using predictable heuristic model
  lat: number;
  lng: number;
  updatedAt: number;
  venueKey?: string;
}

export interface StandMetric {
  standId: string;       // 'North' | 'South' | 'East' | 'West'
  name: string;
  sectionLabel: string;  // e.g. "Home Stand", "Fan Zone"
  fillPct: number;       // 0–100, how full the seating section is
  lat: number;           // centre of the stand section
  lng: number;
  spreadLat: number;     // Gaussian spread radius in degrees (lat)
  spreadLng: number;     // Gaussian spread radius in degrees (lng)
  updatedAt: number;
  venueKey?: string;
}

export interface LiveTimeSlot {
  time: string;
  minuteOffset: number;
  density: number;
  crowd: number;
  flowRate: number;
  waitMinutes: number;
  label?: string;
  recommended?: boolean;
}

/** Persistent crowd log entry written to Firestore `crowd_log` collection */
export interface CrowdLogEntry {
  id?: string;
  timestamp: number;
  gate_id: string;
  stand_id: string;
  current_count: number;
  coordinates: { lat: number; lng: number };
  status: 'Normal' | 'Crowded' | 'Filling' | 'Critical';
  category: 'Entry' | 'Seating';
  venueKey: string;
}

/** Returns a human-readable density status label */
export function getCurrentStatus(density: number): 'Normal' | 'Crowded' | 'Filling' | 'Critical' {
  if (density >= 85) return 'Critical';
  if (density >= 60) return 'Crowded';
  if (density >= 30) return 'Filling';
  return 'Normal';
}

/**
 * Baseline crowd counts per gate (fans) at 4:30 PM (−180 min before kickoff).
 * These grow incrementally every 15 minutes via PHASE_ADDITIVE multipliers.
 */
const GATE_BASELINES: Record<string, number> = {
  A: 50, B: 100, C: 75, D: 125,
};

/**
 * Additive increments applied per 15-min phase window.
 * minuteOffset is relative to kickoff (0).
 * Matches the spec: +2, +5, +20, +50 as event approaches.
 */
const PHASE_ADDITIVE: { from: number; to: number; additive: number }[] = [
  { from: -180, to: -165, additive: 2  },   // 4:30 → 4:45 PM
  { from: -165, to: -150, additive: 5  },   // 4:45 → 5:00 PM
  { from: -150, to: -120, additive: 20 },   // 5:00 → 5:30 PM (peak surge begins)
  { from: -120, to: -90,  additive: 50 },   // 5:30 → 6:00 PM
  { from: -90,  to: -60,  additive: 50 },   // 6:00 → 6:30 PM
  { from: -60,  to: -30,  additive: 20 },   // 6:30 → 7:00 PM
  { from: -30,  to: 0,    additive: 5  },   // 7:00 → 7:30 PM
];

/** Derives an absolute crowd count from baselines + accumulated additives */
export function getBaselineCrowdCount(gateId: string, minutesUntilEvent: number): number {
  const base = GATE_BASELINES[gateId] ?? 75;
  let total = base;
  // Accumulate increments for each phase that has elapsed
  for (const phase of PHASE_ADDITIVE) {
    if (minutesUntilEvent > phase.from) continue; // phase hasn't started yet
    // How many 15-min ticks fit in this phase?
    const elapsed = Math.min(phase.from, minutesUntilEvent) - Math.max(phase.to, minutesUntilEvent);
    const ticks = Math.floor(Math.abs(elapsed) / 15);
    total += ticks * phase.additive;
  }
  return Math.max(0, total);
}

function isPermissionError(error: unknown) {
  return error instanceof Error && /permission/i.test(error.message);
}

// ── Dynamic Arena Configurations ──────────────────────────────────────────────

export interface StadiumConfig {
  center: { lat: number, lng: number };
  gates: Omit<GateMetric, 'density' | 'waitMinutes' | 'updatedAt' | 'flowRate' | 'queueCapacity'>[];
  stands: Omit<StandMetric, 'fillPct' | 'updatedAt'>[];
}

const ARENAS: Record<string, StadiumConfig> = {
  'M. A. Chidambaram Stadium': {
    center: { lat: 13.0627, lng: 80.2792 },
    gates: [
      { gateId: 'A', name: 'North Gate',       lat: 13.0634, lng: 80.2792 },
      { gateId: 'B', name: 'South Gate',       lat: 13.0620, lng: 80.2792 },
      { gateId: 'C', name: 'East Entrance',    lat: 13.0627, lng: 80.2800 },
      { gateId: 'D', name: 'West Entrance',    lat: 13.0627, lng: 80.2784 },
    ],
    stands: [
      { standId: 'North', name: 'Anna Pavilion',   sectionLabel: 'Home Stand',      lat: 13.0633, lng: 80.2792, spreadLat: 0.0003, spreadLng: 0.0006 },
      { standId: 'South', name: 'Ladies Stand',    sectionLabel: 'Away Fans',       lat: 13.0621, lng: 80.2792, spreadLat: 0.0003, spreadLng: 0.0006 },
      { standId: 'East',  name: 'Cyber Tower End', sectionLabel: 'Fan Zone',        lat: 13.0627, lng: 80.2799, spreadLat: 0.0006, spreadLng: 0.0003 },
      { standId: 'West',  name: 'VP Stand',        sectionLabel: 'Premium Seating', lat: 13.0627, lng: 80.2785, spreadLat: 0.0006, spreadLng: 0.0003 },
    ],
  },

  'Wankhede Stadium': {
    center: { lat: 18.9388, lng: 72.8258 },
    gates: [
      { gateId: 'A', name: 'Main North Gate', lat: 18.93940, lng: 72.82680 },
      { gateId: 'B', name: 'West Plaza Entrance', lat: 18.93780, lng: 72.82630 },
      { gateId: 'C', name: 'VIP South Gate', lat: 18.93800, lng: 72.82480 },
      { gateId: 'D', name: 'East Side Tunnel', lat: 18.93970, lng: 72.82500 },
    ],
    stands: [
      { standId: 'North', name: 'North Stand', sectionLabel: 'Home Stand', lat: 18.93950, lng: 72.82570, spreadLat: 0.00030, spreadLng: 0.00060 },
      { standId: 'South', name: 'South Stand', sectionLabel: 'Away Fans', lat: 18.93780, lng: 72.82570, spreadLat: 0.00030, spreadLng: 0.00060 },
      { standId: 'East', name: 'East Stand', sectionLabel: 'Fan Zone', lat: 18.93870, lng: 72.82720, spreadLat: 0.00060, spreadLng: 0.00025 },
      { standId: 'West', name: 'West Stand', sectionLabel: 'Premium Seating', lat: 18.93870, lng: 72.82420, spreadLat: 0.00060, spreadLng: 0.00025 },
    ]
  },
  'Chase Center': {
    center: { lat: 37.7679, lng: -122.3874 },
    gates: [
      { gateId: 'A', name: 'West Plaza (3rd St)', lat: 37.7679, lng: -122.3884 },
      { gateId: 'B', name: 'East Bayfront', lat: 37.7679, lng: -122.3860 },
      { gateId: 'C', name: 'North VIP', lat: 37.7686, lng: -122.3874 },
      { gateId: 'D', name: 'South Entrance', lat: 37.7670, lng: -122.3874 },
    ],
    stands: [
      { standId: 'North', name: 'North Concourse', sectionLabel: 'Upper Bowl', lat: 37.7684, lng: -122.3874, spreadLat: 0.00020, spreadLng: 0.00040 },
      { standId: 'South', name: 'South Concourse', sectionLabel: 'Lower Bowl', lat: 37.7672, lng: -122.3874, spreadLat: 0.00020, spreadLng: 0.00040 },
      { standId: 'East', name: 'East Baseline', sectionLabel: 'Fan Zone', lat: 37.7679, lng: -122.3865, spreadLat: 0.00030, spreadLng: 0.00015 },
      { standId: 'West', name: 'West Baseline', sectionLabel: 'VIP Courtside', lat: 37.7679, lng: -122.3880, spreadLat: 0.00030, spreadLng: 0.00015 },
    ]
  },
  'MetLife Stadium': {
    center: { lat: 40.8128, lng: -74.0742 },
    gates: [
      { gateId: 'A', name: 'Pepsi Gate', lat: 40.8138, lng: -74.0742 },
      { gateId: 'B', name: 'Verizon Gate', lat: 40.8118, lng: -74.0742 },
      { gateId: 'C', name: 'MetLife Gate', lat: 40.8128, lng: -74.0755 },
      { gateId: 'D', name: 'HCLTech Gate', lat: 40.8128, lng: -74.0729 },
    ],
    stands: [
      { standId: 'North', name: 'North Endzone', sectionLabel: 'General', lat: 40.8135, lng: -74.0742, spreadLat: 0.00040, spreadLng: 0.00060 },
      { standId: 'South', name: 'South Endzone', sectionLabel: 'General', lat: 40.8121, lng: -74.0742, spreadLat: 0.00040, spreadLng: 0.00060 },
      { standId: 'East', name: 'East Sideline', sectionLabel: 'Lower Tier', lat: 40.8128, lng: -74.0734, spreadLat: 0.00080, spreadLng: 0.00030 },
      { standId: 'West', name: 'West Sideline', sectionLabel: 'Club Level', lat: 40.8128, lng: -74.0750, spreadLat: 0.00080, spreadLng: 0.00030 },
    ]
  },  
  'Metropolis Stadium': { // Wembley Stadium
    center: { lat: 51.5560, lng: -0.2795 },
    gates: [
      { gateId: 'A', name: 'Olympic Way (Pedway)', lat: 51.5574, lng: -0.2795 },
      { gateId: 'B', name: 'South Way Entrance', lat: 51.5550, lng: -0.2780 },
      { gateId: 'C', name: 'Royal Box VIP', lat: 51.5560, lng: -0.2810 },
      { gateId: 'D', name: 'East Plaza', lat: 51.5560, lng: -0.2780 },
    ],
    stands: [
      { standId: 'North', name: 'North Stand', sectionLabel: 'Home Fans', lat: 51.5568, lng: -0.2795, spreadLat: 0.0004, spreadLng: 0.0008 },
      { standId: 'South', name: 'South Stand', sectionLabel: 'Away Fans', lat: 51.5552, lng: -0.2795, spreadLat: 0.0004, spreadLng: 0.0008 },
      { standId: 'East', name: 'East Stand', sectionLabel: 'Family Zone', lat: 51.5560, lng: -0.2782, spreadLat: 0.0008, spreadLng: 0.0004 },
      { standId: 'West', name: 'West Stand', sectionLabel: 'Premium', lat: 51.5560, lng: -0.2808, spreadLat: 0.0008, spreadLng: 0.0004 },
    ]
  },
  'Diamond Park': { // Fenway Park
    center: { lat: 42.3467, lng: -71.0972 },
    gates: [
      { gateId: 'A', name: 'Yawkey Way (Jersey St)', lat: 42.3460, lng: -71.0978 },
      { gateId: 'B', name: 'Gate C (Lansdowne)', lat: 42.3475, lng: -71.0965 },
      { gateId: 'C', name: 'Gate D', lat: 42.3460, lng: -71.0960 },
      { gateId: 'D', name: 'Gate E (Bleachers)', lat: 42.3475, lng: -71.0950 },
    ],
    stands: [
      { standId: 'North', name: 'Green Monster', sectionLabel: 'Left Field', lat: 42.3470, lng: -71.0978, spreadLat: 0.0002, spreadLng: 0.0001 },
      { standId: 'South', name: 'Grandstand', sectionLabel: 'Home Plate', lat: 42.3462, lng: -71.0972, spreadLat: 0.0002, spreadLng: 0.0004 },
      { standId: 'East', name: 'Right Field Roof', sectionLabel: 'Right Field', lat: 42.3465, lng: -71.0960, spreadLat: 0.0003, spreadLng: 0.0002 },
      { standId: 'West', name: 'Bleachers', sectionLabel: 'Center Field', lat: 42.3478, lng: -71.0955, spreadLat: 0.0002, spreadLng: 0.0004 },
    ]
  },
  'Velocity Arena': { // Indianapolis Motor Speedway
    center: { lat: 39.7983, lng: -86.2339 },
    gates: [
      { gateId: 'A', name: 'Gate 1 (Main)', lat: 39.7930, lng: -86.2339 },
      { gateId: 'B', name: 'Gate 2', lat: 39.7950, lng: -86.2320 },
      { gateId: 'C', name: 'Gate 6 (Infield)', lat: 39.7983, lng: -86.2330 },
      { gateId: 'D', name: 'Gate 9', lat: 39.8030, lng: -86.2339 },
    ],
    stands: [
      { standId: 'North', name: 'North Vista', sectionLabel: 'Turn 4', lat: 39.8020, lng: -86.2350, spreadLat: 0.0010, spreadLng: 0.0010 },
      { standId: 'South', name: 'South Vista', sectionLabel: 'Turn 1', lat: 39.7940, lng: -86.2350, spreadLat: 0.0010, spreadLng: 0.0010 },
      { standId: 'East', name: 'Tower Terrace', sectionLabel: 'Straightaway', lat: 39.7983, lng: -86.2320, spreadLat: 0.0030, spreadLng: 0.0005 },
      { standId: 'West', name: 'Paddock', sectionLabel: 'Main Stretch', lat: 39.7983, lng: -86.2350, spreadLat: 0.0030, spreadLng: 0.0005 },
    ]
  },
  'Horizon Center': { // Crypto.com Arena
    center: { lat: 34.0430, lng: -118.2673 },
    gates: [
      { gateId: 'A', name: 'Star Plaza (Figueroa)', lat: 34.0438, lng: -118.2665 },
      { gateId: 'B', name: 'Chick Hearn Ct', lat: 34.0440, lng: -118.2673 },
      { gateId: 'C', name: 'VIP Entry (11th St)', lat: 34.0422, lng: -118.2673 },
      { gateId: 'D', name: 'Figueroa South', lat: 34.0425, lng: -118.2660 },
    ],
    stands: [
      { standId: 'North', name: '100 Level North', sectionLabel: 'Lower Bowl', lat: 34.0436, lng: -118.2673, spreadLat: 0.0003, spreadLng: 0.0006 },
      { standId: 'South', name: '100 Level South', sectionLabel: 'Lower Bowl', lat: 34.0424, lng: -118.2673, spreadLat: 0.0003, spreadLng: 0.0006 },
      { standId: 'East', name: 'Suites East', sectionLabel: 'Premier', lat: 34.0430, lng: -118.2665, spreadLat: 0.0005, spreadLng: 0.0002 },
      { standId: 'West', name: 'Suites West', sectionLabel: 'VIP', lat: 34.0430, lng: -118.2680, spreadLat: 0.0005, spreadLng: 0.0002 },
    ]
  },
  'Grand Dome': { // The O2 Arena
    center: { lat: 51.5030, lng: 0.0032 },
    gates: [
      { gateId: 'A', name: 'Main Peninsula', lat: 51.5020, lng: 0.0032 },
      { gateId: 'B', name: 'East Entry', lat: 51.5030, lng: 0.0050 },
      { gateId: 'C', name: 'North Gateway', lat: 51.5040, lng: 0.0032 },
      { gateId: 'D', name: 'West Dock', lat: 51.5030, lng: 0.0010 },
    ],
    stands: [
      { standId: 'North', name: 'Lower Tier North', sectionLabel: 'General', lat: 51.5035, lng: 0.0032, spreadLat: 0.0003, spreadLng: 0.0005 },
      { standId: 'South', name: 'Lower Tier South', sectionLabel: 'General', lat: 51.5025, lng: 0.0032, spreadLat: 0.0003, spreadLng: 0.0005 },
      { standId: 'East', name: 'Stage Right', sectionLabel: 'Floor', lat: 51.5030, lng: 0.0040, spreadLat: 0.0004, spreadLng: 0.0002 },
      { standId: 'West', name: 'Stage Left', sectionLabel: 'Floor', lat: 51.5030, lng: 0.0020, spreadLat: 0.0004, spreadLng: 0.0002 },
    ]
  },
  'Oak Field': { // Old Trafford
    center: { lat: 53.4631, lng: -2.2913 },
    gates: [
      { gateId: 'A', name: 'Sir Matt Busby Way', lat: 53.4638, lng: -2.2905 },
      { gateId: 'B', name: 'East Stand Gate', lat: 53.4631, lng: -2.2890 },
      { gateId: 'C', name: 'Stretford End Entry', lat: 53.4631, lng: -2.2930 },
      { gateId: 'D', name: 'South Stand VIP', lat: 53.4622, lng: -2.2913 },
    ],
    stands: [
      { standId: 'North', name: 'Sir Alex Ferguson Stand', sectionLabel: 'Main', lat: 53.4637, lng: -2.2913, spreadLat: 0.0003, spreadLng: 0.0010 },
      { standId: 'South', name: 'Sir Bobby Charlton Stand', sectionLabel: 'Premium', lat: 53.4625, lng: -2.2913, spreadLat: 0.0003, spreadLng: 0.0010 },
      { standId: 'East', name: 'East Stand', sectionLabel: 'Scoreboard End', lat: 53.4631, lng: -2.2898, spreadLat: 0.0006, spreadLng: 0.0003 },
      { standId: 'West', name: 'Stretford End', sectionLabel: 'Home Fans', lat: 53.4631, lng: -2.2925, spreadLat: 0.0006, spreadLng: 0.0003 },
    ]
  },
  'Eden Gardens': {
    center: { lat: 22.5646, lng: 88.3433 },
    gates: [
      { gateId: 'A', name: 'Club House Gate', lat: 22.5656, lng: 88.3433 },
      { gateId: 'B', name: 'Pavilion Entrance', lat: 22.5636, lng: 88.3433 },
      { gateId: 'C', name: 'High Court End Gate', lat: 22.5646, lng: 88.3443 },
      { gateId: 'D', name: 'River End Gate', lat: 22.5646, lng: 88.3423 },
    ],
    stands: [
      { standId: 'North', name: 'High Court End', sectionLabel: 'General', lat: 22.5654, lng: 88.3433, spreadLat: 0.0003, spreadLng: 0.0006 },
      { standId: 'South', name: 'Pavilion End', sectionLabel: 'Premium', lat: 22.5638, lng: 88.3433, spreadLat: 0.0003, spreadLng: 0.0006 },
      { standId: 'East', name: 'B.C. Roy Club House', sectionLabel: 'VIP', lat: 22.5646, lng: 88.3441, spreadLat: 0.0006, spreadLng: 0.0003 },
      { standId: 'West', name: 'River End', sectionLabel: 'General', lat: 22.5646, lng: 88.3425, spreadLat: 0.0006, spreadLng: 0.0003 },
    ]
  },
  'Arun Jaitley Stadium': {
    center: { lat: 28.6378, lng: 77.2432 },
    gates: [
      { gateId: 'A', name: 'Ambedkar Stadium Gate', lat: 28.6388, lng: 77.2432 },
      { gateId: 'B', name: 'Bahadur Shah Zafar Marg Gate', lat: 28.6368, lng: 77.2432 },
      { gateId: 'C', name: 'Delhi Gate', lat: 28.6378, lng: 77.2442 },
      { gateId: 'D', name: 'Feroz Shah Kotla Gate', lat: 28.6378, lng: 77.2422 },
    ],
    stands: [
      { standId: 'North', name: 'North Stand', sectionLabel: 'General', lat: 28.6386, lng: 77.2432, spreadLat: 0.0003, spreadLng: 0.0006 },
      { standId: 'South', name: 'South Stand', sectionLabel: 'Premium', lat: 28.6370, lng: 77.2432, spreadLat: 0.0003, spreadLng: 0.0006 },
      { standId: 'East', name: 'East Stand', sectionLabel: 'VIP', lat: 28.6378, lng: 77.2440, spreadLat: 0.0006, spreadLng: 0.0003 },
      { standId: 'West', name: 'West Stand', sectionLabel: 'General', lat: 28.6378, lng: 77.2424, spreadLat: 0.0006, spreadLng: 0.0003 },
    ]
  },
  'Rajiv Gandhi International Cricket Stadium': {
    center: { lat: 17.3995, lng: 78.5539 },
    gates: [
      { gateId: 'A', name: 'North Gate', lat: 17.4005, lng: 78.5539 },
      { gateId: 'B', name: 'South Gate', lat: 17.3985, lng: 78.5539 },
      { gateId: 'C', name: 'East Pavilion', lat: 17.3995, lng: 78.5549 },
      { gateId: 'D', name: 'West Pavilion', lat: 17.3995, lng: 78.5529 },
    ],
    stands: [
      { standId: 'North', name: 'North Pavilion', sectionLabel: 'General', lat: 17.4003, lng: 78.5539, spreadLat: 0.0003, spreadLng: 0.0006 },
      { standId: 'South', name: 'South Pavilion', sectionLabel: 'Premium', lat: 17.3987, lng: 78.5539, spreadLat: 0.0003, spreadLng: 0.0006 },
      { standId: 'East', name: 'East Stand', sectionLabel: 'VIP', lat: 17.3995, lng: 78.5547, spreadLat: 0.0006, spreadLng: 0.0003 },
      { standId: 'West', name: 'West Stand', sectionLabel: 'General', lat: 17.3995, lng: 78.5531, spreadLat: 0.0006, spreadLng: 0.0003 },
    ]
  },
  'M. Chinnaswamy Stadium': {
    center: { lat: 12.9788, lng: 77.5996 },
    gates: [
      { gateId: 'A', name: 'Cubbon Road Entrance', lat: 12.9798, lng: 77.5996 },
      { gateId: 'B', name: 'MG Road Entrance', lat: 12.9778, lng: 77.5996 },
      { gateId: 'C', name: 'Queens Road Gate', lat: 12.9788, lng: 77.6006 },
      { gateId: 'D', name: 'Link Road Gate', lat: 12.9788, lng: 77.5986 },
    ],
    stands: [
      { standId: 'North', name: 'P Pavilion', sectionLabel: 'Premium', lat: 12.9796, lng: 77.5996, spreadLat: 0.0003, spreadLng: 0.0006 },
      { standId: 'South', name: 'Pavilion End', sectionLabel: 'VIP', lat: 12.9780, lng: 77.5996, spreadLat: 0.0003, spreadLng: 0.0006 },
      { standId: 'East', name: 'East Stand', sectionLabel: 'General', lat: 12.9788, lng: 77.6004, spreadLat: 0.0006, spreadLng: 0.0003 },
      { standId: 'West', name: 'West Stand', sectionLabel: 'General', lat: 12.9788, lng: 77.5988, spreadLat: 0.0006, spreadLng: 0.0003 },
    ]
  },
  'Sree Kanteerava Stadium': {
    center: { lat: 12.9696, lng: 77.5929 },
    gates: [
      { gateId: 'A', name: 'Main Gate', lat: 12.9706, lng: 77.5929 },
      { gateId: 'B', name: 'South Gate', lat: 12.9686, lng: 77.5929 },
      { gateId: 'C', name: 'East Gate', lat: 12.9696, lng: 77.5939 },
      { gateId: 'D', name: 'West Gate', lat: 12.9696, lng: 77.5919 },
    ],
    stands: [
      { standId: 'North', name: 'North Stand', sectionLabel: 'Away Fans', lat: 12.9704, lng: 77.5929, spreadLat: 0.0003, spreadLng: 0.0006 },
      { standId: 'South', name: 'South Stand', sectionLabel: 'Home Fans', lat: 12.9688, lng: 77.5929, spreadLat: 0.0003, spreadLng: 0.0006 },
      { standId: 'East', name: 'East Stand', sectionLabel: 'Premium', lat: 12.9696, lng: 77.5937, spreadLat: 0.0006, spreadLng: 0.0003 },
      { standId: 'West', name: 'West Stand', sectionLabel: 'VIP', lat: 12.9696, lng: 77.5921, spreadLat: 0.0006, spreadLng: 0.0003 },
    ]
  },
  'Jawaharlal Nehru Stadium': {
    center: { lat: 28.5828, lng: 77.2344 },
    gates: [
      { gateId: 'A', name: 'VIP Gate', lat: 28.5838, lng: 77.2344 },
      { gateId: 'B', name: 'South Gate', lat: 28.5818, lng: 77.2344 },
      { gateId: 'C', name: 'East Gate', lat: 28.5828, lng: 77.2354 },
      { gateId: 'D', name: 'West Gate', lat: 28.5828, lng: 77.2334 },
    ],
    stands: [
      { standId: 'North', name: 'North Stand', sectionLabel: 'Premium', lat: 28.5836, lng: 77.2344, spreadLat: 0.0003, spreadLng: 0.0006 },
      { standId: 'South', name: 'South Stand', sectionLabel: 'General', lat: 28.5820, lng: 77.2344, spreadLat: 0.0003, spreadLng: 0.0006 },
      { standId: 'East', name: 'East Stand', sectionLabel: 'General', lat: 28.5828, lng: 77.2352, spreadLat: 0.0006, spreadLng: 0.0003 },
      { standId: 'West', name: 'West Stand', sectionLabel: 'VIP', lat: 28.5828, lng: 77.2336, spreadLat: 0.0006, spreadLng: 0.0003 },
    ]
  },
  'D.Y. Patil Stadium': {
    center: { lat: 19.0435, lng: 73.0258 },
    gates: [
      { gateId: 'A', name: 'North Gate', lat: 19.0445, lng: 73.0258 },
      { gateId: 'B', name: 'South Gate', lat: 19.0425, lng: 73.0258 },
      { gateId: 'C', name: 'East Gate', lat: 19.0435, lng: 73.0268 },
      { gateId: 'D', name: 'West Gate', lat: 19.0435, lng: 73.0248 },
    ],
    stands: [
      { standId: 'North', name: 'North Stand', sectionLabel: 'General', lat: 19.0443, lng: 73.0258, spreadLat: 0.0003, spreadLng: 0.0006 },
      { standId: 'South', name: 'South Stand', sectionLabel: 'Premium', lat: 19.0427, lng: 73.0258, spreadLat: 0.0003, spreadLng: 0.0006 },
      { standId: 'East', name: 'East Stand', sectionLabel: 'VIP', lat: 19.0435, lng: 73.0266, spreadLat: 0.0006, spreadLng: 0.0003 },
      { standId: 'West', name: 'West Stand', sectionLabel: 'General', lat: 19.0435, lng: 73.0250, spreadLat: 0.0006, spreadLng: 0.0003 },
    ]
  },
  'YMCA Grounds': {
    center: { lat: 13.0232, lng: 80.2312 },
    gates: [
      { gateId: 'A', name: 'Main Gate', lat: 13.0242, lng: 80.2312 },
      { gateId: 'B', name: 'Rear Gate', lat: 13.0222, lng: 80.2312 },
      { gateId: 'C', name: 'East Gate', lat: 13.0232, lng: 80.2322 },
      { gateId: 'D', name: 'West Gate', lat: 13.0232, lng: 80.2302 },
    ],
    stands: [
      { standId: 'North', name: 'North Pavilion', sectionLabel: 'Premium', lat: 13.0240, lng: 80.2312, spreadLat: 0.0003, spreadLng: 0.0006 },
      { standId: 'South', name: 'South Pavilion', sectionLabel: 'General', lat: 13.0224, lng: 80.2312, spreadLat: 0.0003, spreadLng: 0.0006 },
      { standId: 'East', name: 'East Stand', sectionLabel: 'General', lat: 13.0232, lng: 80.2320, spreadLat: 0.0006, spreadLng: 0.0003 },
      { standId: 'West', name: 'West Stand', sectionLabel: 'VIP', lat: 13.0232, lng: 80.2304, spreadLat: 0.0006, spreadLng: 0.0003 },
    ]
  },
  'Salt Lake Stadium': {
    center: { lat: 22.5695, lng: 88.4093 },
    gates: [
      { gateId: 'A', name: 'VIP Gate 1', lat: 22.5705, lng: 88.4093 },
      { gateId: 'B', name: 'South Gate 3', lat: 22.5685, lng: 88.4093 },
      { gateId: 'C', name: 'East Gate 4', lat: 22.5695, lng: 88.4103 },
      { gateId: 'D', name: 'West Gate 2', lat: 22.5695, lng: 88.4083 },
    ],
    stands: [
      { standId: 'North', name: 'East Bengal Stand', sectionLabel: 'Home Fans', lat: 22.5703, lng: 88.4093, spreadLat: 0.0003, spreadLng: 0.0006 },
      { standId: 'South', name: 'Mohun Bagan Stand', sectionLabel: 'Away Fans', lat: 22.5687, lng: 88.4093, spreadLat: 0.0003, spreadLng: 0.0006 },
      { standId: 'East', name: 'Ramp Stand East', sectionLabel: 'General', lat: 22.5695, lng: 88.4101, spreadLat: 0.0006, spreadLng: 0.0003 },
      { standId: 'West', name: 'VIP Stand', sectionLabel: 'Premium', lat: 22.5695, lng: 88.4085, spreadLat: 0.0006, spreadLng: 0.0003 },
    ]
  }
};
function normalizeVenue(input?: string) {
  return (input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const STADIUM_ALIASES: Record<string, string[]> = {
  'Wankhede Stadium':            ['wankhede', 'mumbai'],
  'M. A. Chidambaram Stadium':   ['chidambaram', 'chepauk', 'chennai', 'csk', 'mac stadium'], // ✅ ADD
  'Chase Center':                ['chase center', 'warriors', 'golden state'],
  'MetLife Stadium':             ['metlife', 'met life'],
  'Metropolis Stadium':          ['metropolis', 'wembley'],
  'Diamond Park':                ['diamond park', 'fenway'],
  'Velocity Arena':              ['velocity arena', 'motor speedway', 'indianapolis'],
  'Horizon Center':              ['horizon center', 'crypto.com', 'cryptocom'],
  'Grand Dome':                  ['grand dome', 'o2 arena', 'the o2'],
  'Oak Field':                   ['oak field', 'old trafford'],
  'Eden Gardens':                ['eden gardens', 'kolkata'],
  'Arun Jaitley Stadium':        ['arun jaitley', 'delhi', 'feroz shah kotla'],
  'Rajiv Gandhi International Cricket Stadium': ['rajiv gandhi', 'hyderabad', 'uppal'],
  'M. Chinnaswamy Stadium':      ['chinnaswamy', 'bengaluru', 'bangalore'],
  'Sree Kanteerava Stadium':     ['kanteerava', 'bengaluru', 'bangalore'],
  'Jawaharlal Nehru Stadium':    ['jawaharlal nehru', 'delhi'],
  'D.Y. Patil Stadium':          ['dy patil', 'mumbai', 'navi mumbai'],
  'YMCA Grounds':                ['ymca grounds', 'chennai'],
  'Salt Lake Stadium':           ['salt lake', 'kolkata', 'vybk'],
};
export function getStadiumConfig(venue?: string): StadiumConfig {
  const normalized = normalizeVenue(venue);
  if (venue && ARENAS[venue]) {
    return ARENAS[venue];
  }

  if (normalized) {
    for (const [arenaName, aliases] of Object.entries(STADIUM_ALIASES)) {
      const normalizedArena = normalizeVenue(arenaName);
      if (normalized === normalizedArena || aliases.some(alias => normalized.includes(alias))) {
        return ARENAS[arenaName];
      }
    }

    for (const arenaName of Object.keys(ARENAS)) {
      const normalizedArena = normalizeVenue(arenaName);
      if (normalized.includes(normalizedArena) || normalizedArena.includes(normalized)) {
        return ARENAS[arenaName];
      }
    }
  }

  // Default to Wankhede (or could be MetLife) if unknown venue is passed
  return ARENAS['Wankhede Stadium'];
}

// ── Time curve helpers ────────────────────────────────────────────────────────

/**
 * Returns a 0–1 intensity for *outside* gate queues.
 * Peaks just before the event, drops once inside.
 */
function gateTimeFactor(minutesUntilEvent: number): number {
  if (minutesUntilEvent > 180) return 0.02;
  if (minutesUntilEvent > 90)  return 0.05 + (180 - minutesUntilEvent) / 180 * 0.15;
  if (minutesUntilEvent > 30)  return 0.20 + (90  - minutesUntilEvent) / 90  * 0.50;
  if (minutesUntilEvent > 0)   return 0.70 + (30  - minutesUntilEvent) / 30  * 0.28;
  if (minutesUntilEvent > -15) return 0.98 - (-minutesUntilEvent) / 15 * 0.20; // gate queues drain
  if (minutesUntilEvent > -60) return 0.78 - (-minutesUntilEvent - 15) / 45 * 0.50;
  return Math.max(0.02, 0.28 + minutesUntilEvent / 200);
}

/**
 * Returns a 0–1 intensity for *inside* stand occupancy.
 * Lags ~15 min behind gate flow: people enter → walk to seat.
 * Stays near 100% during the match.
 */
function standTimeFactor(minutesUntilEvent: number): number {
  const lag = minutesUntilEvent + 15; // stands lag gates by ~15 min
  if (lag > 180)  return 0.00;
  if (lag > 90)   return 0.02 + (180 - lag) / 180 * 0.08;
  if (lag > 30)   return 0.10 + (90  - lag) / 90  * 0.40;
  if (lag > 0)    return 0.50 + (30  - lag) / 30  * 0.45;
  // Match in progress — stands stay near full, slight churn at half-time
  if (minutesUntilEvent > -45)  return 0.95 - (-minutesUntilEvent) / 45 * 0.10;
  if (minutesUntilEvent > -55)  return 0.85 - (-minutesUntilEvent - 45) / 10 * 0.20; // half-time dip
  if (minutesUntilEvent > -105) return 0.65 + (-minutesUntilEvent - 55) / 50 * 0.30; // 2nd half refill
  if (minutesUntilEvent > -120) return 0.95 - (-minutesUntilEvent - 105) / 15 * 0.20; // late exits
  return Math.max(0.01, 0.75 + minutesUntilEvent / 300);
}

// Gate peak multipliers (how full each gate gets at peak)
const GATE_PEAK: Record<string, number> = {
  A: 0.95, B: 0.72, C: 0.42, D: 0.80,
};

// Stand peak multipliers (section capacity varies)
const STAND_PEAK: Record<string, number> = {
  North: 0.98,   // home fans — always packed
  East:  0.85,   // fan zone — buzzing
  West:  0.78,   // premium — slightly less dense
  South: 0.60,   // away fans — partial fill
};

// ── Write to Firestore ────────────────────────────────────────────────────────

// ?? Prediction Engine & Database Simulator ????????????????????????????????????

export function resolveVenueKey(venue?: string) {
  return (venue || 'default').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 20);
}

function calculateWaitMinutes(density: number, flowRate: number, queueCapacity = 600) {
  return Math.max(0, Math.round(((density / 100) * queueCapacity) / Math.max(1, flowRate) + 2));
}

function formatSlotTime(base: Date, offsetMinutes: number) {
  const ts = new Date(base.getTime() + offsetMinutes * 60 * 1000);
  const hours = ts.getHours() % 12 || 12;
  const mins = String(ts.getMinutes()).padStart(2, '0');
  const ampm = ts.getHours() >= 12 ? 'PM' : 'AM';
  return `${hours}:${mins} ${ampm}`;
}

/**
 * predictBestGate identifies the gate with the lowest expected wait time.
 */
export function predictBestGate(gates: GateMetric[]): GateMetric | null {
  if (!gates.length) return null;

  let bestGate: GateMetric | null = null;
  let lowestWait = Infinity;

  for (const gate of gates) {
    const waitMinutes = calculateWaitMinutes(gate.density, gate.flowRate, gate.queueCapacity);
    const candidate = { ...gate, waitMinutes };
    if (waitMinutes < lowestWait) {
      lowestWait = waitMinutes;
      bestGate = candidate;
    }
  }

  return bestGate;
}

export async function simulateDBLiveData(venueKey: string, eventKickoff: Date) {
  const slots: LiveTimeSlot[] = [];

  for (let offset = -240; offset <= 120; offset += 30) {
    const densityFactor = gateTimeFactor(-offset);
    const density = Math.min(100, Math.max(5, Math.round(densityFactor * 100)));
    const flowRate = 300 + Math.round(densityFactor * 500);
    const waitMinutes = calculateWaitMinutes(density, flowRate, 1200);

    slots.push({
      time: formatSlotTime(eventKickoff, offset),
      minuteOffset: offset,
      density,
      crowd: density,
      flowRate,
      waitMinutes,
      label: offset === 0 ? 'Kickoff' : offset === -120 ? '-2h' : '',
    });
  }

  const preKickoffSlots = slots.filter(slot => slot.minuteOffset < 0);
  const candidateSlots = preKickoffSlots.length ? preKickoffSlots : slots;
  const bestWait = Math.min(...candidateSlots.map(slot => slot.waitMinutes));
  const recommendedSlots = candidateSlots.filter(slot => slot.waitMinutes <= bestWait + 2);
  const recommendedWindow = recommendedSlots.length
    ? {
        start: recommendedSlots[0].time,
        end: recommendedSlots[recommendedSlots.length - 1].time,
        minWaitMinutes: bestWait,
      }
    : null;

  const payload = {
    venueKey,
    time_slots: slots,
    recommendedWindow,
    updatedAt: Date.now(),
  };

  await setDoc(doc(collection(db, 'stadium_live_data'), venueKey), payload);
}

/**
 * Writes one row per gate and stand to `crowd_log` in Firestore.
 * This is the time-series log that powers the data table in the analytics page.
 */
export async function writeSimulationLog(venueKey: string, minutesUntilEvent: number, venueName?: string) {
  const config = getStadiumConfig(venueName);
  const now = Date.now();
  const logCol = collection(db, 'crowd_log');

  const gateWrites = config.gates.map(async gate => {
    const peak = GATE_PEAK[gate.gateId] ?? 0.6;
    const jitter = (Math.random() - 0.5) * 0.06;
    const densityFraction = Math.min(1, Math.max(0, gateTimeFactor(minutesUntilEvent) * peak + jitter));
    const density = Math.round(densityFraction * 100);
    const baselineCount = getBaselineCrowdCount(gate.gateId, minutesUntilEvent);
    const current_count = Math.max(0, Math.round(baselineCount * (1 + densityFraction)));
    const status = getCurrentStatus(density);

    const entry: CrowdLogEntry = {
      timestamp: now,
      gate_id: gate.gateId,
      stand_id: '',
      current_count,
      coordinates: { lat: gate.lat, lng: gate.lng },
      status,
      category: 'Entry',
      venueKey,
    };
    try { await addDoc(logCol, entry); } catch (e) { if (!isPermissionError(e)) console.warn('crowd_log gate write failed:', e); }
  });

  const standWrites = config.stands.map(async stand => {
    const peak = STAND_PEAK[stand.standId] ?? 0.7;
    const jitter = (Math.random() - 0.5) * 0.04;
    const fillFraction = Math.min(1, Math.max(0, standTimeFactor(minutesUntilEvent) * peak + jitter));
    const fillPct = Math.round(fillFraction * 100);
    const current_count = Math.round(fillFraction * 8000); // ~8000 seats per stand section
    const status = getCurrentStatus(fillPct);

    const entry: CrowdLogEntry = {
      timestamp: now,
      gate_id: '',
      stand_id: stand.standId,
      current_count,
      coordinates: { lat: stand.lat, lng: stand.lng },
      status,
      category: 'Seating',
      venueKey,
    };
    try { await addDoc(logCol, entry); } catch (e) { if (!isPermissionError(e)) console.warn('crowd_log stand write failed:', e); }
  });

  await Promise.allSettled([...gateWrites, ...standWrites]);
}

export function startDatabaseSimulator(venueKey: string, evDate: Date, venueName: string) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = () => {
    const now = Date.now();
    const target = evDate.getTime();
    const minutesUntilEvent = (target - now) / 60000;

    writeAllMetrics(minutesUntilEvent, venueName).catch(error => {
      if (!isPermissionError(error)) console.warn('Gate metrics update failed:', error);
    });
    simulateDBLiveData(venueKey, evDate).catch(error => {
      if (!isPermissionError(error)) console.warn('Live stadium data update failed:', error);
    });
    // Write persistent crowd_log rows every tick
    writeSimulationLog(venueKey, minutesUntilEvent, venueName).catch(error => {
      if (!isPermissionError(error)) console.warn('Simulation log write failed:', error);
    });

    timer = setTimeout(tick, 10000 + Math.floor(Math.random() * 5000));
  };

  tick();
  return () => {
    if (timer) clearTimeout(timer);
  };
}

export async function writeAllMetrics(minutesUntilEvent: number, venue?: string) {
  const config = getStadiumConfig(venue);
  const venueKey = resolveVenueKey(venue);
  const now = Date.now();

  const gateCol = collection(db, 'gateMetrics');
  const standCol = collection(db, 'standMetrics');

  const gateWrites = config.gates.map(async gate => {
    const peak = GATE_PEAK[gate.gateId] ?? 0.6;
    const jitter = (Math.random() - 0.5) * 0.06;
    const density = Math.min(100, Math.max(0, Math.round((gateTimeFactor(minutesUntilEvent) * peak + jitter) * 100)));

    const queueCapacity = 600;
    const baseFlowRate = 45;
    const flowRate = Math.max(10, Math.round(baseFlowRate + (Math.random() - 0.5) * 10));

    const waitMinutes = calculateWaitMinutes(density, flowRate, queueCapacity);

    await setDoc(doc(gateCol, `${venueKey}_${gate.gateId}`), {
      ...gate, density, flowRate, queueCapacity, waitMinutes, updatedAt: now, venueKey
    });
  });

  const standWrites = config.stands.map(async stand => {
    const peak = STAND_PEAK[stand.standId] ?? 0.7;
    const jitter = (Math.random() - 0.5) * 0.04;
    const fillPct = Math.min(100, Math.max(0, Math.round((standTimeFactor(minutesUntilEvent) * peak + jitter) * 100)));
    await setDoc(doc(standCol, `${venueKey}_${stand.standId}`), { ...stand, fillPct, updatedAt: now, venueKey });
  });

  await Promise.all([...gateWrites, ...standWrites]);
}

export function subscribeToGateMetrics(cb: (m: GateMetric[]) => void) {
  return onSnapshot(
    collection(db, 'gateMetrics'),
    snap => {
      const metrics: GateMetric[] = [];
      snap.forEach(d => d.exists() && metrics.push(d.data() as GateMetric));
      cb(metrics);
    },
    error => {
      if (!isPermissionError(error)) {
        console.warn('Gate Metrics Subscription Warning (Likely missing Firestore Rules):', error.message);
      }
    }
  );
}

export function subscribeToStandMetrics(cb: (m: StandMetric[]) => void) {
  return onSnapshot(
    collection(db, 'standMetrics'),
    snap => {
      const metrics: StandMetric[] = [];
      snap.forEach(d => d.exists() && metrics.push(d.data() as StandMetric));
      cb(metrics);
    },
    error => {
      if (!isPermissionError(error)) {
        console.warn('Stand Metrics Subscription Warning (Likely missing Firestore Rules):', error.message);
      }
    }
  );
}

export function subscribeToStadiumLiveData(venueKey: string, cb: (data: any) => void) {
  return onSnapshot(
    doc(collection(db, 'stadium_live_data'), venueKey),
    snap => {
      cb(snap.exists() ? snap.data() : null);
    },
    error => {
      if (!isPermissionError(error)) {
        console.warn('Stadium Live Data Subscription Warning:', error.message);
      }
    }
  );
}

/**
 * Subscribe to the most recent `limit` entries from `crowd_log` for a given venue.
 * Returns unsubscribe function. Ordered by timestamp descending.
 */
export function subscribeToRecentCrowdLog(venueKey: string, maxRows: number, cb: (entries: CrowdLogEntry[]) => void) {
  const q = query(
    collection(db, 'crowd_log'),
    orderBy('timestamp', 'desc'),
    limit(maxRows)
  );
  return onSnapshot(
    q,
    snap => {
      const entries: CrowdLogEntry[] = [];
      snap.forEach(d => {
        if (d.exists()) {
          const data = d.data() as CrowdLogEntry;
          if (data.venueKey === venueKey) {
            entries.push({ ...data, id: d.id });
          }
        }
      });
      cb(entries);
    },
    error => {
      if (!isPermissionError(error)) {
        console.warn('Crowd Log Subscription Warning:', error.message);
      }
    }
  );
}
