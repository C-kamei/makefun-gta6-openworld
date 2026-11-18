// Solmar Bay — the living city: traffic cars that follow the road grid,
// pedestrians who stroll the sidewalks and flee from gunfire, and the
// arcade car physics every drivable car shares (player, traffic, police).

import { BEACH_Y, CAR, H_ROADS, PALETTE, ROAD_W, V_ROADS, WORLD } from './config.js';
import { isInWater, makeRng, nearestRoad, randomRoadPoint, resolveBuildingCollision } from './city.js';

let nextId = 1;

/** A car: position, heading, speed, colour, and who (if anyone) drives it. */
export function makeCar(x, y, angle, color, kind = 'traffic') {
  return {
    id: nextId += 1,
    kind, x, y, angle, speed: 0, color,
    driver: kind === 'traffic' ? 'traffic' : null,
    health: 100,
    smoke: 0,
    // traffic-only autopilot state
    roadAxis: 'v', roadAt: x, dir: 1, targetSpeed: 120 + Math.random() * 60,
    stuck: 0,
  };
}

/** Arcade car step: throttle/brake/reverse + steering that bites with speed. */
export function stepCarPhysics(car, throttle, brake, steer, dt) {
  const forward = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
  if (throttle > 0) car.speed += CAR.accel * throttle * dt;
  if (brake > 0) {
    if (car.speed > 5) car.speed -= CAR.brake * brake * dt;
    else car.speed -= CAR.reverseAccel * brake * dt;
  }
  // Rolling drag and a soft cap.
  car.speed -= car.speed * 0.55 * dt;
  if (car.speed > CAR.maxSpeed) car.speed = CAR.maxSpeed;
  if (car.speed < -CAR.maxReverse) car.speed = -CAR.maxReverse;
  if (Math.abs(car.speed) < 4 && throttle === 0 && brake === 0) car.speed = 0;
  const steerAmount = steer * CAR.turnRate * dt * Math.min(1, Math.abs(car.speed) / 120) * Math.sign(car.speed || 1);
  car.angle += steerAmount;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  return forward;
}

/** Keep a car inside the world and out of buildings and the water. */
export function collideCar(city, car) {
  const half = CAR.length / 2;
  if (car.x < half) { car.x = half; car.speed *= 0.4; }
  if (car.x > WORLD.width - half) { car.x = WORLD.width - half; car.speed *= 0.4; }
  if (car.y < half) { car.y = half; car.speed *= 0.4; }
  if (car.y > BEACH_Y - 10) { car.y = BEACH_Y - 10; car.speed *= 0.4; }
  const pos = { x: car.x, y: car.y };
  if (resolveBuildingCollision(city, pos, CAR.width / 2 + 6)) {
    car.x = pos.x;
    car.y = pos.y;
    car.speed *= 0.3;
  }
}

/** Spawn the traffic fleet on the roads. */
export function createTraffic(count, rng) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const p = randomRoadPoint(rng);
    const road = nearestRoad(p.x, p.y);
    const angle = road.axis === 'v' ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
    const car = makeCar(p.x, p.y, angle, PALETTE.carColors[Math.floor(rng() * PALETTE.carColors.length)]);
    car.roadAxis = road.axis;
    car.roadAt = road.at;
    car.dir = angle === 0 || angle === Math.PI / 2 ? 1 : -1;
    car.speed = car.targetSpeed;
    cars.push(car);
  }
  return cars;
}

/** One traffic car follows its road; at an intersection it may turn. */
function stepTrafficCar(car, dt, rng) {
  const lane = 20; // right-hand lane offset
  if (car.roadAxis === 'v') {
    const targetX = car.roadAt + (car.dir === 1 ? lane : -lane);
    car.x += (targetX - car.x) * Math.min(1, dt * 4);
    car.y += car.dir * car.speed * dt;
    car.angle = car.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
    // Turn at a cross street now and then, or bounce at the world edge.
    const nearCross = H_ROADS.some((cy) => Math.abs(car.y - cy) < 14);
    if (nearCross && rng() < 0.012) {
      const cy = H_ROADS.reduce((a, b) => (Math.abs(car.y - a) < Math.abs(car.y - b) ? a : b));
      car.roadAxis = 'h';
      car.roadAt = cy;
      car.y = cy;
      car.dir = rng() < 0.5 ? 1 : -1;
    } else if (car.y < 80) { car.dir = 1; car.y = 80; }
    else if (car.y > BEACH_Y - 80) { car.dir = -1; car.y = BEACH_Y - 80; }
  } else {
    const targetY = car.roadAt + (car.dir === 1 ? lane : -lane);
    car.y += (targetY - car.y) * Math.min(1, dt * 4);
    car.x += car.dir * car.speed * dt;
    car.angle = car.dir === 1 ? 0 : Math.PI;
    const nearCross = V_ROADS.some((cx) => Math.abs(car.x - cx) < 14);
    if (nearCross && rng() < 0.012) {
      const cx = V_ROADS.reduce((a, b) => (Math.abs(car.x - a) < Math.abs(car.x - b) ? a : b));
      car.roadAxis = 'v';
      car.roadAt = cx;
      car.x = cx;
      car.dir = rng() < 0.5 ? 1 : -1;
    } else if (car.x < 80) { car.dir = 1; car.x = 80; }
    else if (car.x > WORLD.width - 80) { car.dir = -1; car.x = WORLD.width - 80; }
  }
}

/** Advance traffic; cars ahead slow for the car in front of them. */
export function updateTraffic(cars, dt, rng) {
  for (const car of cars) {
    let slowed = false;
    for (const other of cars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 90 && dist > 1) {
        const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
        if (ahead > 0 && Math.abs(dx * Math.sin(car.angle) - dy * Math.cos(car.angle)) < 26) {
          slowed = true;
          break;
        }
      }
    }
    const want = slowed ? 0 : car.targetSpeed;
    car.speed += (want - car.speed) * Math.min(1, dt * 1.5);
    stepTrafficCar(car, dt, rng);
  }
}

/** A pedestrian: strolls the sidewalks, panics and runs from gunfire. */
export function makePedestrian(x, y, rng) {
  return {
    id: nextId += 1,
    x, y,
    angle: rng() * Math.PI * 2,
    speed: 26 + rng() * 22,
    color: ['#e07a5f', '#81b29a', '#f2cc8f', '#a78bfa', '#6d6875', '#f4a261'][Math.floor(rng() * 6)],
    panic: 0,
    wander: 1 + rng() * 3,
  };
}

export function createPedestrians(count, rng) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const p = randomRoadPoint(rng);
    // Nudge pedestrians onto the sidewalk beside the road.
    const road = nearestRoad(p.x, p.y);
    if (road.axis === 'v') p.x = road.at + (rng() < 0.5 ? 1 : -1) * (ROAD_W / 2 + 10);
    else p.y = road.at + (rng() < 0.5 ? 1 : -1) * (ROAD_W / 2 + 10);
    peds.push(makePedestrian(p.x, p.y, rng));
  }
  return peds;
}

/** Pedestrians wander; a panicked one runs away from the scare point. */
export function updatePedestrians(peds, dt, city, scare) {
  for (const ped of peds) {
    ped.wander -= dt;
    if (ped.wander <= 0) {
      ped.wander = 1 + Math.random() * 3;
      ped.angle += (Math.random() - 0.5) * 2.2;
    }
    let speed = ped.speed;
    if (scare && Math.hypot(ped.x - scare.x, ped.y - scare.y) < 320) {
      ped.panic = 2.5;
      ped.angle = Math.atan2(ped.y - scare.y, ped.x - scare.x);
      speed = ped.speed * 3.4;
    }
    if (ped.panic > 0) ped.panic -= dt;
    const nx = ped.x + Math.cos(ped.angle) * speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * speed * dt;
    if (!isInWater(nx, ny) && nx > 20 && nx < WORLD.width - 20 && ny > 20 && ny < BEACH_Y - 8) {
      const pos = { x: nx, y: ny };
      if (!resolveBuildingCollision(city, pos, 12)) {
        ped.x = pos.x;
        ped.y = pos.y;
      } else {
        ped.angle += Math.PI / 2;
      }
    } else {
      ped.angle += Math.PI / 2;
    }
  }
}

/** Parked cars the player can steal, parked at the curb of a road. */
export function createParkedCars() {
  const spots = [
    { x: 860, y: 620, angle: 0, color: '#3f6fb5' },
    { x: 1360, y: 1120, angle: Math.PI / 2, color: '#e8c33c' },
    { x: 2500, y: 2000, angle: 0, color: '#e8e8e8' },
    { x: 860, y: 1560, angle: -Math.PI / 2, color: '#d64545' },
    { x: 2100, y: 360, angle: Math.PI, color: '#7fb069' },
    { x: 1100, y: 2000, angle: 0, color: '#2b2b2b' },
  ];
  return spots.map((s) => {
    const car = makeCar(s.x, s.y, s.angle, s.color, 'parked');
    car.driver = null;
    return car;
  });
}

/** The mission-2 target: a yellow sports coupe parked at the marina road. */
export function makeTargetCar() {
  const car = makeCar(2580, 2000, Math.PI / 2, '#ffd23f', 'target');
  car.driver = null;
  return car;
}

export function seededRng(seed) {
  return makeRng(seed);
}
