// Solmar Bay — combat: the player's pistol, enemy gunmen, bullets, and the
// little bursts of sparks and smoke that sell a hit. Enemies are simple:
// they stand their ground, take cover in numbers, and shoot back badly.

import { PLAYER } from './config.js';

/** A bullet: a fast point with an owner ('player' or 'enemy'). */
export function makeBullet(x, y, angle, owner) {
  return {
    x, y,
    vx: Math.cos(angle) * 900,
    vy: Math.sin(angle) * 900,
    owner,
    life: 0.9,
    damage: owner === 'player' ? PLAYER.pistolDamage : 9,
  };
}

/** An enemy gunman: health, a spot he defends, and a shaky trigger finger. */
export function makeEnemy(x, y) {
  return {
    x, y,
    homeX: x, homeY: y,
    angle: 0,
    health: 100,
    shootTimer: 0.8 + Math.random() * 1.2,
    alive: true,
    flash: 0,
  };
}

/** A particle: a fading spark, puff of smoke, or splash of colour. */
export function makeParticle(x, y, vx, vy, life, color, size) {
  return { x, y, vx, vy, life, maxLife: life, color, size };
}

export function burst(particles, x, y, count, color, speed = 160) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    particles.push(makeParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.3 + Math.random() * 0.3, color, 2 + Math.random() * 3));
  }
}

export function updateParticles(particles, dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 2.4 * dt;
    p.vy *= 1 - 2.4 * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

/** Move bullets; report every hit as an event the game can act on.
 *  Events: { type: 'hit-enemy'|'hit-cop'|'hit-ped'|'hit-car'|'hit-wall', ... } */
export function updateBullets(bullets, dt, world) {
  const events = [];
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead) {
      const hit = findBulletHit(b, world);
      if (hit) {
        events.push(hit);
        dead = true;
      }
    }
    if (dead) bullets.splice(i, 1);
  }
  return events;
}

/** What a bullet runs into first: a person, a car, or a building wall. */
function findBulletHit(b, world) {
  // People first: enemies, then cops, then pedestrians.
  for (const e of world.enemies) {
    if (e.alive && Math.hypot(e.x - b.x, e.y - b.y) < 18) {
      e.health -= b.damage;
      e.flash = 0.12;
      if (e.health <= 0) e.alive = false;
      return { type: 'hit-enemy', enemy: e, x: b.x, y: b.y, killed: !e.alive };
    }
  }
  for (const cop of world.cops) {
    if (Math.hypot(cop.x - b.x, cop.y - b.y) < 16) {
      return { type: 'hit-cop', cop, x: b.x, y: b.y };
    }
  }
  if (b.owner === 'player') {
    for (const ped of world.peds) {
      if (Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
        return { type: 'hit-ped', ped, x: b.x, y: b.y };
      }
    }
  }
  // Cars: the player's car, traffic, parked cars, cruisers.
  const cars = [...world.traffic, ...world.parked, ...world.policeCars];
  if (world.playerCar) cars.push(world.playerCar);
  for (const car of cars) {
    const dx = b.x - car.x;
    const dy = b.y - car.y;
    const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const across = -dx * Math.sin(car.angle) + dy * Math.cos(car.angle);
    if (Math.abs(along) < 34 && Math.abs(across) < 20) {
      car.health -= b.damage * 0.4;
      if (car.health < 40) car.smoke = Math.max(car.smoke, 0.5);
      return { type: 'hit-car', car, x: b.x, y: b.y };
    }
  }
  // Buildings stop bullets.
  for (const bd of world.city.buildings) {
    if (b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h) {
      return { type: 'hit-wall', x: b.x, y: b.y };
    }
  }
  return null;
}

/** Enemies shoot back at the player with poor aim and a slow trigger. */
export function updateEnemies(enemies, dt, player, bullets, onShoot) {
  for (const e of enemies) {
    if (!e.alive) continue;
    e.flash = Math.max(0, e.flash - dt);
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy);
    e.angle = Math.atan2(dy, dx);
    // Drift back toward their post if the player drags them far away.
    const homeDist = Math.hypot(e.x - e.homeX, e.y - e.homeY);
    if (homeDist > 260) {
      e.x += ((e.homeX - e.x) / homeDist) * 90 * dt;
      e.y += ((e.homeY - e.y) / homeDist) * 90 * dt;
    }
    e.shootTimer -= dt;
    if (dist < 520 && e.shootTimer <= 0) {
      e.shootTimer = 1.1 + Math.random() * 0.9;
      const aim = e.angle + (Math.random() - 0.5) * 0.28;
      bullets.push(makeBullet(e.x + Math.cos(aim) * 22, e.y + Math.sin(aim) * 22, aim, 'enemy'));
      if (onShoot) onShoot(e.x, e.y);
    }
  }
}
