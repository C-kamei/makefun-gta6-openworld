// Solmar Bay — the city itself: a seeded grid of roads, blocks, buildings,
// parks, the beach and the landmarks the missions use. Everything here is
// pure data plus small geometry queries; nothing draws or moves.

import { BEACH_Y, H_ROADS, PALETTE, ROAD_W, V_ROADS, WATER_Y, WORLD } from './config.js';

/** Tiny deterministic RNG (mulberry32) so the city is the same every visit. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Landmarks the story and the minimap refer to by name. Every target sits
 *  on a road or open ground, never inside a building: a player (or a
 *  teleport) landing on one must never be pushed out of reach of it. */
export const LANDMARKS = {
  hideout: { name: 'Hideout — Mara\'s Garage', x: 560, y: 760 },
  marina: { name: 'Solmar Marina', x: 2620, y: 2040 },
  pier: { name: 'Sunset Pier', x: 1320, y: 2220 },
  warehouse: { name: 'Harbor Warehouse', x: 2460, y: 1240 },
  bank: { name: 'Bay Trust Bank', x: 1560, y: 1160 },
  hospital: { name: 'Solmar General', x: 1060, y: 520 },
  garage: { name: 'Rico\'s Chop Shop', x: 620, y: 1640 },
  plaza: { name: 'Palm Plaza', x: 1820, y: 760 },
};

/** One building: an axis-aligned block with a roof colour and a height hint. */
function makeBuilding(x, y, w, h, rng) {
  return {
    x, y, w, h,
    color: PALETTE.buildingRoof[Math.floor(rng() * PALETTE.buildingRoof.length)],
    shade: 0.75 + rng() * 0.25,
    roof: rng() < 0.35, // some roofs get a lighter inner slab
  };
}

/** Build the whole city once from a seed. Returns buildings, trees and parks. */
export function createCity(seed = 20261118) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const parks = [];

  // Walk the grid of blocks between neighbouring roads.
  const vEdges = [0, ...V_ROADS, WORLD.width];
  const hEdges = [0, ...H_ROADS, BEACH_Y];
  for (let bi = 0; bi < vEdges.length - 1; bi += 1) {
    for (let bj = 0; bj < hEdges.length - 1; bj += 1) {
      const x0 = vEdges[bi] + ROAD_W / 2 + 14;
      const x1 = vEdges[bi + 1] - ROAD_W / 2 - 14;
      const y0 = hEdges[bj] + ROAD_W / 2 + 14;
      const y1 = hEdges[bj + 1] - ROAD_W / 2 - 14;
      const bw = x1 - x0;
      const bh = y1 - y0;
      if (bw < 90 || bh < 90) continue;
      const roll = rng();
      if (roll < 0.14) {
        // A park: grass clearing with a ring of palm trees.
        parks.push({ x: x0, y: y0, w: bw, h: bh });
        const n = 5 + Math.floor(rng() * 5);
        for (let i = 0; i < n; i += 1) {
          trees.push({ x: x0 + 20 + rng() * (bw - 40), y: y0 + 20 + rng() * (bh - 40), r: 12 + rng() * 8 });
        }
        continue;
      }
      if (roll < 0.2) continue; // empty lot / parking: stays open ground
      // One or two buildings per block, with a gap between them.
      if (bw > 260 && rng() < 0.55) {
        const split = x0 + bw * (0.42 + rng() * 0.16);
        buildings.push(makeBuilding(x0 + 6, y0 + 8, split - x0 - 18, bh - 16, rng));
        buildings.push(makeBuilding(split + 12, y0 + 8, x1 - split - 18, bh - 16, rng));
      } else {
        buildings.push(makeBuilding(x0 + 8, y0 + 8, bw - 16, bh - 16, rng));
      }
    }
  }

  // Landmark buildings sit on top of the generated ones (they are the story's
  // set pieces, so they are placed exactly, not rolled).
  const landmarkBuildings = [
    { x: 480, y: 500, w: 150, h: 110, color: '#8d99ae', shade: 1, roof: true, label: 'hideout' },
    { x: 2380, y: 1300, w: 220, h: 170, color: '#b56576', shade: 1, roof: false, label: 'warehouse' },
    { x: 1500, y: 920, w: 130, h: 110, color: '#d9a05b', shade: 1, roof: true, label: 'bank' },
    { x: 1000, y: 470, w: 130, h: 100, color: '#e0cfa8', shade: 1, roof: true, label: 'hospital' },
    { x: 560, y: 1420, w: 130, h: 110, color: '#7fb3a8', shade: 1, roof: false, label: 'garage' },
  ];
  for (const b of landmarkBuildings) buildings.push(b);

  // Palm trees lining the beach promenade.
  for (let x = 120; x < WORLD.width - 100; x += 130) {
    trees.push({ x: x + rng() * 40, y: BEACH_Y + 26 + rng() * 30, r: 13 });
  }
  return { buildings, trees, parks, seed };
}

/** True when the point is on a road (used by traffic and the minimap). */
export function isOnRoad(x, y) {
  for (const cx of V_ROADS) if (Math.abs(x - cx) <= ROAD_W / 2) return true;
  for (const cy of H_ROADS) if (Math.abs(y - cy) <= ROAD_W / 2) return true;
  return false;
}

/** True when the point is in the water (blocks movement). */
export function isInWater(x, y) {
  return y >= WATER_Y;
}

/** Nearest road centre to a point, and whether it runs vertical. */
export function nearestRoad(x, y) {
  let best = { axis: 'v', at: V_ROADS[0], dist: Math.abs(x - V_ROADS[0]) };
  for (const cx of V_ROADS) {
    const d = Math.abs(x - cx);
    if (d < best.dist) best = { axis: 'v', at: cx, dist: d };
  }
  for (const cy of H_ROADS) {
    const d = Math.abs(y - cy);
    if (d < best.dist) best = { axis: 'h', at: cy, dist: d };
  }
  return best;
}

/** Circle-vs-buildings collision: returns the building hit, or null. */
export function collideBuildings(city, x, y, radius) {
  for (const b of city.buildings) {
    if (x + radius > b.x && x - radius < b.x + b.w && y + radius > b.y && y - radius < b.y + b.h) return b;
  }
  return null;
}

/** Push a circle out of any building it overlaps; returns true if it moved. */
export function resolveBuildingCollision(city, pos, radius) {
  const b = collideBuildings(city, pos.x, pos.y, radius);
  if (!b) return false;
  const overlapLeft = pos.x + radius - b.x;
  const overlapRight = b.x + b.w - (pos.x - radius);
  const overlapTop = pos.y + radius - b.y;
  const overlapBottom = b.y + b.h - (pos.y - radius);
  const min = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
  if (min === overlapLeft) pos.x = b.x - radius;
  else if (min === overlapRight) pos.x = b.x + b.w + radius;
  else if (min === overlapTop) pos.y = b.y - radius;
  else pos.y = b.y + b.h + radius;
  return true;
}

/** A random point on a road, for spawning traffic and pedestrians. */
export function randomRoadPoint(rng) {
  if (rng() < 0.5) {
    const cx = V_ROADS[Math.floor(rng() * V_ROADS.length)];
    return { x: cx + (rng() - 0.5) * (ROAD_W - 24), y: 60 + rng() * (BEACH_Y - 120) };
  }
  const cy = H_ROADS[Math.floor(rng() * H_ROADS.length)];
  return { x: 60 + rng() * (WORLD.width - 120), y: cy + (rng() - 0.5) * (ROAD_W - 24) };
}
