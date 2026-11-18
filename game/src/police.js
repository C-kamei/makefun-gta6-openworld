// Solmar Bay — the law: the wanted level, police cruisers that chase and
// ram, and officers on foot who try to arrest the player. The heat rises
// with crimes and cools when the player stays clean and unseen.

import { CAR, POLICE, WANTED, WORLD } from './config.js';
import { collideCar, makeCar, stepCarPhysics } from './entities.js';

/** The wanted state: level 0–5, a decay clock, and a crime cooldown. */
export function createWanted() {
  return { level: 0, decayTimer: 0, sinceCrime: 99, heat: 0 };
}

/** Commit a crime: raise the level and reset the decay clock. */
export function addWanted(wanted, amount) {
  wanted.level = Math.min(WANTED.max, wanted.level + amount);
  wanted.decayTimer = WANTED.decaySeconds;
  wanted.sinceCrime = 0;
}

/** Cool the heat: one star fades when the player has been clean a while
 *  and no cruiser is close enough to keep the chase alive. */
export function updateWanted(wanted, dt, nearestPoliceDist) {
  wanted.sinceCrime += dt;
  if (wanted.level === 0) return;
  if (wanted.sinceCrime > 6 && nearestPoliceDist > 420) {
    wanted.decayTimer -= dt;
    if (wanted.decayTimer <= 0) {
      wanted.level -= 1;
      wanted.decayTimer = WANTED.decaySeconds;
    }
  }
}

/** A police cruiser: a car with sirens and a target it never stops chasing. */
export function makePoliceCar(x, y, angle) {
  const car = makeCar(x, y, angle, '#1d3557', 'police');
  car.driver = 'police';
  car.targetSpeed = POLICE.carSpeed;
  car.sirenPhase = Math.random() * Math.PI * 2;
  return car;
}

/** An officer on foot: runs the player down and holds them for an arrest. */
export function makeCop(x, y) {
  return {
    x, y,
    angle: 0,
    speed: POLICE.copRunSpeed,
    holdTime: 0,
    shootTimer: 1 + Math.random(),
  };
}

/** How many cruisers the current heat calls for. */
export function wantedCruiserCount(level) {
  if (level <= 0) return 0;
  if (level === 1) return 1;
  if (level === 2) return 2;
  if (level === 3) return 3;
  return POLICE.maxCars;
}

/** Spawn a cruiser on a road near the player, just out of sight. */
export function spawnPoliceCarNear(player, rng, city) {
  const angle = rng() * Math.PI * 2;
  const dist = 700 + rng() * 300;
  let x = player.x + Math.cos(angle) * dist;
  let y = player.y + Math.sin(angle) * dist;
  x = Math.max(80, Math.min(WORLD.width - 80, x));
  y = Math.max(80, Math.min(WORLD.height - 160, y));
  const car = makePoliceCar(x, y, Math.atan2(player.y - y, player.x - x));
  return car;
}

/** Steer a cruiser at the player like a heat-seeking car: point at the
 *  target, throttle hard, brake only to turn. Ramming is the point. */
export function stepPoliceCar(car, target, dt) {
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const wantAngle = Math.atan2(dy, dx);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const dist = Math.hypot(dx, dy);
  const throttle = dist > 60 ? 1 : 0.4;
  const brake = Math.abs(diff) > 1.9 && Math.abs(car.speed) > 200 ? 1 : 0;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  stepCarPhysics(car, throttle, brake, steer, dt);
  car.sirenPhase += dt * 7;
}

/** Keep cruisers from piling onto each other: a gentle push apart. */
export function separatePoliceCars(cars) {
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 70 && dist > 0.01) {
        const push = (70 - dist) / 2;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }
}

/** Officers run at the player; one who stays close long enough busts them.
 *  Returns 'busted' when the arrest completes, else null. */
export function updateCops(cops, player, dt) {
  for (const cop of cops) {
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    const dist = Math.hypot(dx, dy);
    cop.angle = Math.atan2(dy, dx);
    if (dist > 34) {
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      cop.holdTime = Math.max(0, cop.holdTime - dt * 2);
    } else {
      cop.holdTime += dt;
      if (cop.holdTime >= POLICE.arrestSeconds) return 'busted';
    }
  }
  return null;
}

/** Distance from the player to the nearest cruiser (Infinity when none). */
export function nearestPoliceDistance(cars, player) {
  let best = Infinity;
  for (const car of cars) best = Math.min(best, Math.hypot(car.x - player.x, car.y - player.y));
  return best;
}
