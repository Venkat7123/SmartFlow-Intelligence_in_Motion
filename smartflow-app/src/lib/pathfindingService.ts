/**
 * pathfindingService.ts
 *
 * A* pathfinding engine for stadium crowd-aware navigation.
 *
 * Graph: Gates → Concourses → Stairs → Stands
 * Weights: increased by crowd density; Critical zones penalized ×5 (effectively avoided).
 * Formula: ETA = sum(edge costs) + gate wait time (Tw = N / R × G)
 */

import type { GateMetric } from './gateMetricsService';

// ── Node Definitions ──────────────────────────────────────────────────────────

export type NodeId =
  | 'GATE_A' | 'GATE_B' | 'GATE_C' | 'GATE_D'
  | 'CON_N'  | 'CON_S'  | 'CON_E'  | 'CON_W'
  | 'STAIR_NE' | 'STAIR_NW' | 'STAIR_SE' | 'STAIR_SW'
  | 'STAND_NORTH' | 'STAND_SOUTH' | 'STAND_EAST' | 'STAND_WEST';

export type NodeType = 'gate' | 'concourse' | 'stair' | 'stand';

export interface StadiumNode {
  id: NodeId;
  label: string;
  type: NodeType;
  gateId?: string;       // For gate nodes — links to GateMetric
  standId?: string;      // For stand nodes — 'North' | 'South' | 'East' | 'West'
  // Normalized grid position (0–10) for heuristic
  gridX: number;
  gridY: number;
}

// All nodes in the stadium navigation graph
export const STADIUM_NODES: StadiumNode[] = [
  // ── Gates (perimeter, 4 compass points) ──
  { id: 'GATE_A', label: 'Gate A', type: 'gate', gateId: 'A', gridX: 5, gridY: 0  },
  { id: 'GATE_B', label: 'Gate B', type: 'gate', gateId: 'B', gridX: 5, gridY: 10 },
  { id: 'GATE_C', label: 'Gate C', type: 'gate', gateId: 'C', gridX: 10, gridY: 5 },
  { id: 'GATE_D', label: 'Gate D', type: 'gate', gateId: 'D', gridX: 0,  gridY: 5 },

  // ── Concourses (inner ring connecting gates & stairs) ──
  { id: 'CON_N',  label: 'North Concourse', type: 'concourse', gridX: 5, gridY: 2  },
  { id: 'CON_S',  label: 'South Concourse', type: 'concourse', gridX: 5, gridY: 8  },
  { id: 'CON_E',  label: 'East Concourse',  type: 'concourse', gridX: 8, gridY: 5  },
  { id: 'CON_W',  label: 'West Concourse',  type: 'concourse', gridX: 2, gridY: 5  },

  // ── Stairs (corner connectors) ──
  { id: 'STAIR_NE', label: 'Stairs NE', type: 'stair', gridX: 8, gridY: 2 },
  { id: 'STAIR_NW', label: 'Stairs NW', type: 'stair', gridX: 2, gridY: 2 },
  { id: 'STAIR_SE', label: 'Stairs SE', type: 'stair', gridX: 8, gridY: 8 },
  { id: 'STAIR_SW', label: 'Stairs SW', type: 'stair', gridX: 2, gridY: 8 },

  // ── Stands (inner seating sections) ──
  { id: 'STAND_NORTH', label: 'North Stand', type: 'stand', standId: 'North', gridX: 5, gridY: 3  },
  { id: 'STAND_SOUTH', label: 'South Stand', type: 'stand', standId: 'South', gridX: 5, gridY: 7  },
  { id: 'STAND_EAST',  label: 'East Stand',  type: 'stand', standId: 'East',  gridX: 7, gridY: 5  },
  { id: 'STAND_WEST',  label: 'West Stand',  type: 'stand', standId: 'West',  gridX: 3, gridY: 5  },
];

// ── Edge Adjacency Graph {from: [to, baseCost]} ───────────────────────────────

interface Edge { to: NodeId; baseCost: number; }
const ADJACENCY: Record<NodeId, Edge[]> = {
  // Gates → Concourses
  'GATE_A': [{ to: 'CON_N',  baseCost: 2 }, { to: 'STAIR_NE', baseCost: 3 }, { to: 'STAIR_NW', baseCost: 3 }],
  'GATE_B': [{ to: 'CON_S',  baseCost: 2 }, { to: 'STAIR_SE', baseCost: 3 }, { to: 'STAIR_SW', baseCost: 3 }],
  'GATE_C': [{ to: 'CON_E',  baseCost: 2 }, { to: 'STAIR_NE', baseCost: 3 }, { to: 'STAIR_SE', baseCost: 3 }],
  'GATE_D': [{ to: 'CON_W',  baseCost: 2 }, { to: 'STAIR_NW', baseCost: 3 }, { to: 'STAIR_SW', baseCost: 3 }],

  // Concourses ↔ Concourses
  'CON_N':  [{ to: 'GATE_A', baseCost: 2 }, { to: 'CON_E',  baseCost: 3 }, { to: 'CON_W',  baseCost: 3 }, { to: 'STAND_NORTH', baseCost: 1 }],
  'CON_S':  [{ to: 'GATE_B', baseCost: 2 }, { to: 'CON_E',  baseCost: 3 }, { to: 'CON_W',  baseCost: 3 }, { to: 'STAND_SOUTH', baseCost: 1 }],
  'CON_E':  [{ to: 'GATE_C', baseCost: 2 }, { to: 'CON_N',  baseCost: 3 }, { to: 'CON_S',  baseCost: 3 }, { to: 'STAND_EAST',  baseCost: 1 }],
  'CON_W':  [{ to: 'GATE_D', baseCost: 2 }, { to: 'CON_N',  baseCost: 3 }, { to: 'CON_S',  baseCost: 3 }, { to: 'STAND_WEST',  baseCost: 1 }],

  // Stairs → Concourses + Stands
  'STAIR_NE': [{ to: 'GATE_A', baseCost: 3 }, { to: 'GATE_C', baseCost: 3 }, { to: 'CON_N', baseCost: 2 }, { to: 'CON_E', baseCost: 2 }, { to: 'STAND_NORTH', baseCost: 2 }, { to: 'STAND_EAST', baseCost: 2 }],
  'STAIR_NW': [{ to: 'GATE_A', baseCost: 3 }, { to: 'GATE_D', baseCost: 3 }, { to: 'CON_N', baseCost: 2 }, { to: 'CON_W', baseCost: 2 }, { to: 'STAND_NORTH', baseCost: 2 }, { to: 'STAND_WEST', baseCost: 2 }],
  'STAIR_SE': [{ to: 'GATE_B', baseCost: 3 }, { to: 'GATE_C', baseCost: 3 }, { to: 'CON_S', baseCost: 2 }, { to: 'CON_E', baseCost: 2 }, { to: 'STAND_SOUTH', baseCost: 2 }, { to: 'STAND_EAST', baseCost: 2 }],
  'STAIR_SW': [{ to: 'GATE_B', baseCost: 3 }, { to: 'GATE_D', baseCost: 3 }, { to: 'CON_S', baseCost: 2 }, { to: 'CON_W', baseCost: 2 }, { to: 'STAND_SOUTH', baseCost: 2 }, { to: 'STAND_WEST', baseCost: 2 }],

  // Stands (terminal nodes — no outgoing edges in normal pathfinding)
  'STAND_NORTH': [{ to: 'CON_N',    baseCost: 1 }, { to: 'STAIR_NE', baseCost: 2 }, { to: 'STAIR_NW', baseCost: 2 }],
  'STAND_SOUTH': [{ to: 'CON_S',    baseCost: 1 }, { to: 'STAIR_SE', baseCost: 2 }, { to: 'STAIR_SW', baseCost: 2 }],
  'STAND_EAST':  [{ to: 'CON_E',    baseCost: 1 }, { to: 'STAIR_NE', baseCost: 2 }, { to: 'STAIR_SE', baseCost: 2 }],
  'STAND_WEST':  [{ to: 'CON_W',    baseCost: 1 }, { to: 'STAIR_NW', baseCost: 2 }, { to: 'STAIR_SW', baseCost: 2 }],
};

// ── Helper & Heuristic ────────────────────────────────────────────────────────

function nodeById(id: NodeId): StadiumNode {
  return STADIUM_NODES.find(n => n.id === id)!;
}

function heuristic(a: NodeId, b: NodeId): number {
  const na = nodeById(a), nb = nodeById(b);
  return Math.abs(na.gridX - nb.gridX) + Math.abs(na.gridY - nb.gridY);
}

/**
 * Cost multiplier for traversing a node based on gate crowd density.
 * Critical nodes (≥85%) are heavily penalized to force rerouting.
 */
function densityMultiplier(nodeId: NodeId, gateMetrics: GateMetric[]): number {
  const node = nodeById(nodeId);
  if (node.type === 'gate' && node.gateId) {
    const metric = gateMetrics.find(g => g.gateId === node.gateId);
    if (metric) {
      if (metric.density >= 85) return 5.0;  // Critical — avoid
      if (metric.density >= 60) return 2.5;  // Busy — costly
      if (metric.density >= 30) return 1.5;  // Moderate — slight penalty
    }
  }
  return 1.0;
}

// ── A* Algorithm ──────────────────────────────────────────────────────────────

export interface PathResult {
  path: NodeId[];
  nodes: StadiumNode[];
  totalCost: number;
  etaMinutes: number;
  warnings: string[]; // congestion alerts along the route
}

/**
 * Finds the optimal path from a starting gate to a target stand.
 * Uses A* with crowd-density-weighted edges.
 *
 * @param fromGate  - Gate ID string: 'A' | 'B' | 'C' | 'D'
 * @param toStand   - Stand ID: 'North' | 'South' | 'East' | 'West'
 * @param gateMetrics - Live gate metrics from Firestore
 * @returns PathResult with ordered nodes, cost, ETA, and warnings
 */
export function findPath(
  fromGate: string,
  toStand: string,
  gateMetrics: GateMetric[]
): PathResult {
  const startId = `GATE_${fromGate.toUpperCase()}` as NodeId;
  const goalId  = `STAND_${toStand.toUpperCase()}` as NodeId;

  // Sanity check
  if (!ADJACENCY[startId] || !ADJACENCY[goalId]) {
    return { path: [], nodes: [], totalCost: 0, etaMinutes: 0, warnings: ['Invalid gate or stand selection'] };
  }

  // A* open set — priority queue (min-heap via sorted array for simplicity)
  const openSet = new Set<NodeId>([startId]);
  const cameFrom = new Map<NodeId, NodeId>();
  const gScore = new Map<NodeId, number>();
  const fScore = new Map<NodeId, number>();

  STADIUM_NODES.forEach(n => { gScore.set(n.id, Infinity); fScore.set(n.id, Infinity); });
  gScore.set(startId, 0);
  fScore.set(startId, heuristic(startId, goalId));

  while (openSet.size > 0) {
    // Get node with lowest fScore
    const current = [...openSet].reduce((best, n) =>
      (fScore.get(n) ?? Infinity) < (fScore.get(best) ?? Infinity) ? n : best
    ) as NodeId;

    if (current === goalId) {
      // Reconstruct path
      const path: NodeId[] = [];
      let node: NodeId | undefined = current;
      while (node) { path.unshift(node); node = cameFrom.get(node); }

      const pathNodes = path.map(nodeById);
      const totalCost = gScore.get(goalId) ?? 0;

      // ETA: base walking minutes (each cost unit ≈ 1 min) + gate wait from Tw = N / (R × G)
      const startGate = gateMetrics.find(g => g.gateId === fromGate.toUpperCase());
      const gateWait  = startGate ? startGate.waitMinutes : 5;
      const etaMinutes = Math.round(totalCost * 1.2 + gateWait); // 1.2 min per cost unit

      // Congestion warnings for Critical nodes on the path
      const warnings: string[] = [];
      for (const nid of path) {
        const n = nodeById(nid);
        if (n.type === 'gate' && n.gateId) {
          const metric = gateMetrics.find(g => g.gateId === n.gateId);
          if (metric && metric.density >= 85) {
            warnings.push(`⚠️ ${n.label} is critically congested (${metric.density}%)`);
          }
        }
      }

      return { path, nodes: pathNodes, totalCost, etaMinutes, warnings };
    }

    openSet.delete(current);

    const edges = ADJACENCY[current] ?? [];
    for (const edge of edges) {
      const neighborMultiplier = densityMultiplier(edge.to, gateMetrics);
      const tentativeG = (gScore.get(current) ?? Infinity) + edge.baseCost * neighborMultiplier;

      if (tentativeG < (gScore.get(edge.to) ?? Infinity)) {
        cameFrom.set(edge.to, current);
        gScore.set(edge.to, tentativeG);
        fScore.set(edge.to, tentativeG + heuristic(edge.to, goalId));
        openSet.add(edge.to);
      }
    }
  }

  return { path: [], nodes: [], totalCost: 0, etaMinutes: 0, warnings: ['No path found'] };
}

// ── ETA Formula Utility ──────────────────────────────────────────────────────

/**
 * Calculate predictive wait time using Tw = N / (R × G)
 * @param N - current crowd count at gate
 * @param R - throughput rate per minute (fans/min)
 * @param G - number of active (open) entry gates
 */
export function calculateETA(N: number, R: number, G: number): number {
  if (R <= 0 || G <= 0) return 0;
  return Math.max(0, Math.round(N / (R * G)));
}

// ── Gate / Stand Selector Helpers ────────────────────────────────────────────

export const GATE_OPTIONS = ['A', 'B', 'C', 'D'] as const;
export const STAND_OPTIONS = ['North', 'South', 'East', 'West'] as const;
export type GateOption  = typeof GATE_OPTIONS[number];
export type StandOption = typeof STAND_OPTIONS[number];
