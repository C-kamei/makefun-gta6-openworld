// Solmar Bay — the game itself: state, the fixed-step loop, screens, and
// the rules that tie the city, the police, the missions and combat together.
// Everything the renderer paints and the screenshots stage comes from the
// `game` object built here.

import { BEACH_Y, CAR, PALETTE, PLAYER, STEP, WANTED, WORLD } from './config.js';
import { createCity, isInWater, LANDMARKS, resolveBuildingCollision } from './city.js';
import {
  collideCar, createParkedCars, createPedestrians, createTraffic, makeCar,
  makeTargetCar, seededRng, stepCarPhysics, updatePedestrians, updateTraffic,
} from './entities.js';
import {
  addWanted, createWanted, makeCop, makePoliceCar, nearestPoliceDistance,
  separatePoliceCars, spawnPoliceCarNear, stepPoliceCar, updateCops,
  updateWanted, wantedCruiserCount,
} from './police.js';
import {
  advanceMission, currentMission, currentObjective, MISSIONS, objectiveLabel,
  restartMission, startMission,
} from './missions.js';
import { burst, makeBullet, makeEnemy, updateBullets, updateEnemies, updateParticles } from './combat.js';
import { createAudio } from './audio.js';
import { clearSave, hasSave, loadSave, saveGame } from './save.js';
import { createInput, ACTION_CONFIRM, ACTION_ENTER_CAR, ACTION_MISSIONS, ACTION_MUTE, ACTION_PAUSE, ACTION_SAVE } from './input.js';
import {
  createRenderer, SCREEN_BUSTED, SCREEN_MISSIONS, SCREEN_PAUSED, SCREEN_PLAY,
  SCREEN_STORY, SCREEN_TITLE, SCREEN_WASTED,
} from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const PLAYER_SPAWN = { x: 820, y: 700 }; // on the road by the hideout, never inside a building
const HOSPITAL_SPAWN = { x: 1060, y: 620 };

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Build a fresh game world from a seed. */
export function createGame(seed = 20261118) {
  const rng = seededRng(seed);
  const city = createCity(seed);
  const game = {
    seed,
    city,
    cash: 250,
    playerName: 'Danny Cole',
    player: {
      x: PLAYER_SPAWN.x, y: PLAYER_SPAWN.y,
      angle: 0, aimAngle: -Math.PI / 2,
      health: PLAYER.health,
      fireTimer: 0, hurtTimer: 0, lastDamage: 99,
    },
    playerCar: null,
    traffic: createTraffic(26, rng),
    peds: createPedestrians(42, rng),
    parked: createParkedCars(),
    targetCar: makeTargetCar(),
    targetCarTaken: false,
    policeCars: [],
    cops: [],
    enemies: [],
    bullets: [],
    particles: [],
    wanted: createWanted(),
    missions: { index: 0, step: 0, kills: 0, started: false, done: false, storyDone: false },
    hasCash: false,
    objective: null,
    objectiveLabel: '',
    prompt: null,
    toast: null,
    toastTime: 0,
    dialogue: [],
    dialogueIndex: 0,
    menuIndex: 0,
    showHelp: false,
    hasSave: hasSave(),
    stats: { carsStolen: 0, shotsFired: 0, missionsDone: 0, busted: 0 },
    scare: null,
    time: 0,
  };
  refreshObjective(game);
  return game;
}

/** Refresh the HUD objective from the mission state. */
function refreshObjective(game) {
  const mission = currentMission(game.missions);
  game.objective = currentObjective(game.missions);
  game.objectiveLabel = objectiveLabel(game.missions);
  if (!mission) game.objective = null;
}

/** Put the player in a fresh car at a spot (used by the screenshot staging). */
function putPlayerInCar(game, x, y, angle, color) {
  const car = makeCar(x, y, angle, color, 'player');
  car.driver = 'player';
  game.playerCar = car;
  game.player.x = x;
  game.player.y = y;
  return car;
}

/** The nearest car the player could get into (within 70 px, slow enough). */
function nearestEnterableCar(game) {
  const cars = [...game.parked, game.targetCar, ...game.traffic, ...game.policeCars];
  let best = null;
  let bestDist = 78;
  for (const car of cars) {
    if (car === game.playerCar) continue;
    if (Math.abs(car.speed) > 40) continue;
    const d = distance(game.player, car);
    if (d < bestDist) {
      best = car;
      bestDist = d;
    }
  }
  return best;
}

/** Get in a car: parked cars are free, traffic and police cars are theft. */
function enterCar(game, car, audio) {
  const wasParked = car.kind === 'parked' || car.kind === 'target';
  // A stolen traffic car leaves the traffic fleet, or its autopilot would
  // keep driving it while the player steers.
  const ti = game.traffic.indexOf(car);
  if (ti >= 0) game.traffic.splice(ti, 1);
  game.playerCar = car;
  car.driver = 'player';
  car.kind = 'player';
  game.player.x = car.x;
  game.player.y = car.y;
  if (!wasParked) {
    addWanted(game.wanted, WANTED.stealCar);
    game.stats.carsStolen += 1;
    game.toast = 'Car stolen! The cops are coming.';
    game.toastTime = 3;
    // The driver legs it.
    game.peds.push({ id: 9000 + Math.floor(Math.random() * 900), x: car.x + 30, y: car.y, angle: Math.random() * 6, speed: 120, color: '#f4a261', panic: 3, wander: 1 });
    audio.crash();
  } else {
    audio.click();
  }
  if (car === game.targetCar) game.targetCarTaken = true;
}

/** Step out of the car, on foot beside it. */
function exitCar(game) {
  const car = game.playerCar;
  if (!car) return;
  game.playerCar = null;
  game.player.x = car.x - Math.sin(car.angle) * 30;
  game.player.y = car.y + Math.cos(car.angle) * 30;
  game.player.aimAngle = car.angle;
  car.kind = car === game.targetCar ? 'target' : 'parked';
  car.driver = null;
  car.speed = 0;
  if (!game.parked.includes(car) && car !== game.targetCar) game.parked.push(car);
}

/** Fire the pistol toward an angle. */
function fireBullet(game, angle, audio) {
  if (game.player.fireTimer > 0 || game.playerCar) return;
  game.player.fireTimer = PLAYER.fireInterval;
  game.stats.shotsFired += 1;
  const px = game.player.x + Math.cos(angle) * 22;
  const py = game.player.y + Math.sin(angle) * 22;
  game.bullets.push(makeBullet(px, py, angle, 'player'));
  burst(game.particles, px, py, 4, '#ffe98a', 200);
  game.scare = { x: game.player.x, y: game.player.y };
  audio.shoot();
}

/** Where the Viper gunmen stand for mission 4: on the road south of the
 *  warehouse, in the open — never on a roof or inside a building. */
const WAREHOUSE_ENEMIES = [
  { x: 2360, y: 1640 },
  { x: 2460, y: 1640 },
  { x: 2560, y: 1640 },
  { x: 2660, y: 1640 },
  { x: 2410, y: 1690 },
];

function makeWarehouseEnemies() {
  return WAREHOUSE_ENEMIES.map((p) => makeEnemy(p.x, p.y));
}

/** Begin the current mission: intro dialogue plus its setup. */
function beginMission(game) {
  const mission = startMission(game.missions);
  if (!mission) return;
  game.dialogue = [...mission.intro];
  game.dialogueIndex = 0;
  if (mission.id === 'm3') {
    game.wanted.level = 3;
    game.wanted.decayTimer = WANTED.decaySeconds;
    game.wanted.sinceCrime = 0;
  }
  if (mission.id === 'm4') {
    game.enemies = makeWarehouseEnemies();
  }
  if (mission.id === 'm5') game.hasCash = false;
  refreshObjective(game);
}

/** Mission complete: pay out, toast, jingle, save, and start the next one. */
function completeMission(game, result, audio) {
  game.cash += result.reward;
  game.stats.missionsDone += 1;
  game.toast = `Mission complete! +$${result.reward.toLocaleString('en-US')}`;
  game.toastTime = 4;
  audio.missionDone();
  saveGame(game);
  if (result.event === 'story-done') {
    game.dialogue = [result.line];
    game.dialogueIndex = 0;
    refreshObjective(game);
    return 'story';
  }
  game.dialogue = [result.line, `MARA: Next job — ${result.next.title}. Check the marker.`];
  game.dialogueIndex = 0;
  refreshObjective(game);
  return 'next';
}

/** Check whether the current objective is done; advance when it is. */
function checkObjective(game, audio, interactPressed) {
  const mission = currentMission(game.missions);
  const obj = currentObjective(game.missions);
  if (!mission || !obj || !game.missions.started) return null;
  const near = (target, radius) => target && distance(game.player, target) < radius;
  let done = false;
  switch (obj.type) {
    case 'enter-car':
      done = !!game.playerCar;
      break;
    case 'goto':
      done = near(obj.target, 100);
      break;
    case 'deliver':
      done = near(obj.target, 110) && interactPressed;
      break;
    case 'steal-target':
      done = game.playerCar === game.targetCar;
      break;
    case 'deliver-car':
      done = game.playerCar === game.targetCar && near(obj.target, 120);
      break;
    case 'wanted':
      done = near(obj.target, 130) && game.wanted.level >= 1;
      break;
    case 'evade':
      done = near(obj.target, 160) && game.wanted.level === 0;
      break;
    case 'kill':
      done = game.missions.kills >= obj.count;
      break;
    case 'grab':
      done = near(obj.target, 110) && interactPressed;
      if (done) {
        game.hasCash = true;
        game.wanted.level = 5;
        game.wanted.decayTimer = WANTED.decaySeconds;
        game.wanted.sinceCrime = 0;
        game.toast = 'Cash grabbed! Five stars — RUN!';
        game.toastTime = 4;
      }
      break;
    case 'escape':
      done = game.hasCash && near(obj.target, 130);
      break;
    default:
      break;
  }
  if (!done) return null;
  const result = advanceMission(game.missions);
  if (result.event === 'step-done') {
    refreshObjective(game);
    audio.pickup();
    return 'step';
  }
  return completeMission(game, result, audio);
}

/** Busted or wasted: lose $200, wake at the hospital, restart the mission. */
function penalize(game, kind, audio) {
  game.cash = Math.max(0, game.cash - 200);
  game.stats.busted += 1;
  game.wanted.level = 0;
  game.wanted.decayTimer = 0;
  game.policeCars = [];
  game.cops = [];
  game.bullets = [];
  game.hasCash = false;
  if (game.playerCar) {
    game.playerCar = null;
  }
  game.player.x = HOSPITAL_SPAWN.x;
  game.player.y = HOSPITAL_SPAWN.y;
  game.player.health = PLAYER.health;
  game.player.fireTimer = 0;
  restartMission(game.missions);
  refreshObjective(game);
  saveGame(game);
  audio.bust();
  return kind === 'busted' ? SCREEN_BUSTED : SCREEN_WASTED;
}

/** One world step: traffic, people, police, combat, wanted, missions.
 *  `actions` are the edge-triggered input actions already taken this frame. */
function worldStep(game, dt, input, audio, actions = 0) {
  game.time += dt;
  const player = game.player;
  player.fireTimer = Math.max(0, player.fireTimer - dt);
  player.hurtTimer = Math.max(0, player.hurtTimer - dt);
  player.lastDamage += dt;
  if (player.lastDamage > 5 && player.health < PLAYER.health) {
    player.health = Math.min(PLAYER.health, player.health + 3 * dt);
  }

  updateTraffic(game.traffic, dt, Math.random);
  // Keep the streets busy: replace cars the player stole or wrecked.
  if (game.traffic.length < 20) {
    const fresh = createTraffic(1, Math.random);
    for (const car of fresh) {
      if (distance(car, player) > 500) game.traffic.push(car);
    }
  }
  updatePedestrians(game.peds, dt, game.city, game.scare);
  game.scare = null;
  updateParticles(game.particles, dt);

  // --- The player ---
  const interact = !!(actions & ACTION_ENTER_CAR);
  if (game.playerCar) {
    const car = game.playerCar;
    const drive = input ? input.drive() : { throttle: 0, brake: 0, steer: 0 };
    stepCarPhysics(car, drive.throttle, drive.brake, drive.steer, dt);
    collideCar(game.city, car);
    player.x = car.x;
    player.y = car.y;
    player.aimAngle = car.angle;
    // Bump traffic and police cars.
    for (const other of [...game.traffic, ...game.policeCars]) {
      if (other === car) continue;
      const d = distance(car, other);
      if (d < 58 && d > 0.01) {
        const push = (58 - d) / 2;
        const nx = (other.x - car.x) / d;
        const ny = (other.y - car.y) / d;
        other.x += nx * push;
        other.y += ny * push;
        car.x -= nx * push * 0.4;
        car.y -= ny * push * 0.4;
        if (Math.abs(car.speed) > 180) {
          audio.crash();
          car.speed *= 0.6;
          other.speed *= 0.5;
        }
      }
    }
    // Running over a pedestrian is a crime.
    for (let i = game.peds.length - 1; i >= 0; i -= 1) {
      const ped = game.peds[i];
      if (Math.abs(car.speed) > 60 && distance(car, ped) < 34) {
        game.peds.splice(i, 1);
        addWanted(game.wanted, WANTED.hitPed);
        game.toast = 'You hit a pedestrian! +1 star';
        game.toastTime = 2.5;
        burst(game.particles, ped.x, ped.y, 10, '#ff8a7a', 200);
        audio.crash();
      }
    }
    if (interact) exitCar(game);
    if (car.health < 40) car.smoke = Math.max(car.smoke, 0.4);
    car.smoke = Math.max(0, car.smoke - dt * 0.2);
  } else {
    // On foot.
    const move = input ? input.moveVector() : { x: 0, y: 0 };
    const speed = input && input.running() ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const nx = player.x + move.x * speed * dt;
    const ny = player.y + move.y * speed * dt;
    const pos = { x: nx, y: player.y };
    if (!isInWater(nx, player.y) && nx > 20 && nx < WORLD.width - 20) {
      if (!resolveBuildingCollision(game.city, pos, PLAYER.radius)) player.x = nx;
      else player.x = pos.x;
    }
    const pos2 = { x: player.x, y: ny };
    if (!isInWater(player.x, ny) && ny > 20 && ny < BEACH_Y - 8) {
      if (!resolveBuildingCollision(game.city, pos2, PLAYER.radius)) player.y = ny;
      else player.y = pos2.y;
    }
    // Aim follows the mouse.
    if (input) {
      const mouse = input.mouse();
      const camera = game.renderer.cameraFor(player);
      const wx = camera.x + mouse.x / camera.zoom;
      const wy = camera.y + mouse.y / camera.zoom;
      player.aimAngle = Math.atan2(wy - player.y, wx - player.x);
      if (input.firing()) fireBullet(game, player.aimAngle, audio);
    }
    if (interact) {
      const car = nearestEnterableCar(game);
      if (car) enterCar(game, car, audio);
    }
  }

  // --- Police ---
  const wantCount = wantedCruiserCount(game.wanted.level);
  while (game.policeCars.length < wantCount) {
    game.policeCars.push(spawnPoliceCarNear(player, Math.random, game.city));
  }
  while (game.policeCars.length > wantCount) game.policeCars.pop();
  for (const car of game.policeCars) {
    stepPoliceCar(car, player, dt);
    collideCar(game.city, car);
    // A cruiser ramming the player on foot hurts.
    if (!game.playerCar && distance(car, player) < 34 && player.hurtTimer <= 0) {
      player.health -= 12;
      player.hurtTimer = 1;
      player.lastDamage = 0;
      audio.hit();
    }
    // A cruiser ramming the player's car slows it down.
    if (game.playerCar && distance(car, game.playerCar) < 56 && Math.abs(car.speed) > 120) {
      game.playerCar.speed *= 0.82;
      car.speed *= 0.7;
      audio.crash();
    }
  }
  separatePoliceCars(game.policeCars);
  const wantCops = game.wanted.level >= 2 && !game.playerCar ? Math.min(2, game.wanted.level - 1) : 0;
  while (game.cops.length < wantCops) {
    const a = Math.random() * Math.PI * 2;
    game.cops.push(makeCop(player.x + Math.cos(a) * 420, player.y + Math.sin(a) * 420));
  }
  while (game.cops.length > wantCops) game.cops.pop();
  const busted = updateCops(game.cops, player, dt);
  if (busted === 'busted') return penalize(game, 'busted', audio);
  // Cops shoot at five stars... and from four.
  if (game.wanted.level >= POLICE_SHOOT_FROM) {
    for (const cop of game.cops) {
      cop.shootTimer -= dt;
      if (cop.shootTimer <= 0 && distance(cop, player) < 480) {
        cop.shootTimer = 1.4 + Math.random();
        const aim = Math.atan2(player.y - cop.y, player.x - cop.x) + (Math.random() - 0.5) * 0.3;
        game.bullets.push(makeBullet(cop.x + Math.cos(aim) * 20, cop.y + Math.sin(aim) * 20, aim, 'enemy'));
        audio.enemyShoot();
      }
    }
  }
  updateWanted(game.wanted, dt, nearestPoliceDistance(game.policeCars, player));
  if (game.wanted.level === 0) {
    game.policeCars = [];
    game.cops = [];
  }

  // --- Combat ---
  updateEnemies(game.enemies, dt, player, game.bullets, () => audio.enemyShoot());
  const events = updateBullets(game.bullets, dt, {
    enemies: game.enemies, cops: game.cops, peds: game.peds,
    traffic: game.traffic, parked: game.parked, policeCars: game.policeCars,
    playerCar: game.playerCar, city: game.city,
  });
  for (const event of events) {
    if (event.type === 'hit-enemy') {
      burst(game.particles, event.x, event.y, 8, '#ff5a4e', 180);
      if (event.killed) {
        game.missions.kills += 1;
        game.toast = `Viper down (${game.missions.kills}/5)`;
        game.toastTime = 2;
        refreshObjective(game);
      }
    } else if (event.type === 'hit-cop') {
      const idx = game.cops.indexOf(event.cop);
      if (idx >= 0) game.cops.splice(idx, 1);
      addWanted(game.wanted, 2);
      burst(game.particles, event.x, event.y, 8, '#7fb3ff', 180);
      game.toast = 'You shot a cop! +2 stars';
      game.toastTime = 2.5;
    } else if (event.type === 'hit-ped') {
      const idx = game.peds.indexOf(event.ped);
      if (idx >= 0) game.peds.splice(idx, 1);
      addWanted(game.wanted, WANTED.killPed);
      burst(game.particles, event.x, event.y, 8, '#ff8a7a', 180);
      game.toast = 'Pedestrian down! +2 stars';
      game.toastTime = 2.5;
    } else if (event.type === 'hit-car') {
      burst(game.particles, event.x, event.y, 5, '#ffd23f', 150);
    } else if (event.type === 'hit-wall') {
      burst(game.particles, event.x, event.y, 3, '#e8e8e8', 120);
    }
  }
  // Enemy bullets hitting the player on foot.
  for (let i = game.bullets.length - 1; i >= 0; i -= 1) {
    const b = game.bullets[i];
    if (b.owner === 'enemy' && !game.playerCar && distance(b, player) < 16) {
      game.bullets.splice(i, 1);
      player.health -= b.damage;
      player.hurtTimer = 0.4;
      player.lastDamage = 0;
      audio.hit();
      burst(game.particles, player.x, player.y, 6, '#ff5a4e', 160);
    }
  }
  if (player.health <= 0) return penalize(game, 'wasted', audio);

  // --- Missions ---
  const missionResult = checkObjective(game, audio, interact);
  if (missionResult === 'story') return SCREEN_STORY;

  // --- Prompts ---
  game.prompt = null;
  if (!game.playerCar) {
    const car = nearestEnterableCar(game);
    if (car) game.prompt = car.kind === 'parked' || car.kind === 'target' ? 'Press E to get in the car' : 'Press E to steal the car';
  } else {
    game.prompt = 'E to get out  ·  W/S drive  ·  A/D steer';
  }
  const obj = currentObjective(game.missions);
  if (obj && (obj.type === 'deliver' || obj.type === 'grab') && obj.target && distance(player, obj.target) < 110) {
    game.prompt = obj.type === 'deliver' ? 'Press E to deliver the package' : 'Press E to grab the cash';
  }

  game.toastTime = Math.max(0, game.toastTime - dt);
  return null;
}

const POLICE_SHOOT_FROM = 4;

/** Apply a save to a fresh game. */
function applySave(game, data) {
  game.cash = data.cash;
  game.missions.index = Math.min(data.missionIndex, MISSIONS.length - 1);
  game.missions.step = data.missionStep;
  game.missions.storyDone = !!data.storyDone;
  game.missions.started = false;
  game.player.x = data.player.x;
  game.player.y = data.player.y;
  game.player.health = data.player.health;
  game.wanted.level = data.wanted || 0;
  if (data.stats) game.stats = { ...game.stats, ...data.stats };
  refreshObjective(game);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const audio = createAudio();
let game = createGame(seed);
game.renderer = renderer;

// Methods the screenshot staging (shots.js) and the playtest use. They close
// over the outer `game` binding, so they keep working after `game` is
// replaced by a fresh world (new game, continue, reset).
function attachGameMethods(g) {
  g.renderer = renderer;
  g.reset = function resetGame(newSeed) {
    const fresh = createGame(newSeed ?? seed);
    const methods = {
      reset: g.reset, startStory: g.startStory, enterNearestCar: g.enterNearestCar,
      driveStep: g.driveStep, worldStep: g.worldStep,
      spawnPoliceForShot: g.spawnPoliceForShot, spawnEnemiesForShot: g.spawnEnemiesForShot,
      fireBullet: g.fireBullet, putPlayerInCar: g.putPlayerInCar,
    };
    Object.keys(game).forEach((key) => delete game[key]);
    Object.assign(game, fresh);
    Object.assign(game, methods);
    game.renderer = renderer;
    refreshObjective(game);
  };
  g.startStory = function startStoryFn() {
    beginMission(game);
    game.dialogue = [];
    game.dialogueIndex = 0;
  };
  g.enterNearestCar = function enterNearestCarFn() {
    const car = nearestEnterableCar(game);
    if (car) enterCar(game, car, audio);
    return car;
  };
  g.driveStep = function driveStepFn(drive, dt) {
    if (!game.playerCar) return;
    const car = game.playerCar;
    stepCarPhysics(car, drive.throttle, drive.brake, drive.steer, dt);
    collideCar(game.city, car);
    game.player.x = car.x;
    game.player.y = car.y;
    game.player.aimAngle = car.angle;
  };
  g.worldStep = function worldStepFn(dt) {
    worldStep(game, dt, null, audio, 0);
  };
  g.spawnPoliceForShot = function spawnPoliceForShotFn() {
    // Cruisers right behind the player's car, closing in — the chase frame.
    const car = game.playerCar;
    const behind = car ? car.angle : 0;
    while (game.policeCars.length < 2) {
      const i = game.policeCars.length;
      const back = 320 + i * 170;
      const side = (i === 0 ? -46 : 46);
      const px = game.player.x - Math.cos(behind) * back - Math.sin(behind) * side;
      const py = game.player.y - Math.sin(behind) * back + Math.cos(behind) * side;
      const cruiser = makePoliceCar(px, py, behind);
      cruiser.speed = 380;
      game.policeCars.push(cruiser);
    }
  };
  g.spawnEnemiesForShot = function spawnEnemiesForShotFn() {
    game.enemies = makeWarehouseEnemies();
    game.enemies[0].alive = false;
    game.enemies[0].health = 0;
  };
  g.fireBullet = function fireBulletFn(angle) {
    game.player.fireTimer = 0;
    fireBullet(game, angle, audio);
  };
  g.putPlayerInCar = function putPlayerInCarFn(x, y, angle, color) {
    return putPlayerInCar(game, x, y, angle, color);
  };
  // Test-only helpers for the scripted playtest (no gameplay effect).
  g.debug = {
    teleport(x, y) {
      game.player.x = x;
      game.player.y = y;
      if (game.playerCar) {
        game.playerCar.x = x;
        game.playerCar.y = y;
        game.playerCar.speed = 0;
      }
    },
    beginMission() {
      beginMission(game);
    },
    setMission(index) {
      game.missions.index = index;
      game.missions.step = 0;
      game.missions.kills = 0;
      game.missions.started = false;
      refreshObjective(game);
    },
    exitCar() {
      if (game.playerCar) exitCar(game);
    },
  };
}
attachGameMethods(game);

function announce(message) {
  status.textContent = message;
}

function runShot(name) {
  const staged = stageShot(name, game, seed);
  // Toasts are transient gameplay feedback; a mid-fade toast in a still
  // reads as a smudge, so staged frames are always toast-free.
  game.toast = null;
  game.toastTime = 0;
  let painted = 0;
  function paint() {
    renderer.draw(game, staged.screen, game.time);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  function newGame() {
    game = createGame(seed);
    attachGameMethods(game);
    screen = SCREEN_PLAY;
    beginMission(game);
    announce('Playing. Mission 1: First Delivery.');
    audio.unlock();
  }

  function continueGame() {
    const data = loadSave();
    if (!data) return;
    game = createGame(seed);
    attachGameMethods(game);
    applySave(game, data);
    screen = SCREEN_PLAY;
    beginMission(game);
    announce('Continuing. ' + game.objectiveLabel);
    audio.unlock();
  }

  function handleTitleInput() {
    const actions = input.takeActions();
    const pressed = input.takePressed();
    if (pressed.has('arrowup') || pressed.has('w')) game.menuIndex = (game.menuIndex + 2) % 3;
    if (pressed.has('arrowdown') || pressed.has('s')) game.menuIndex = (game.menuIndex + 1) % 3;
    if (pressed.has('1')) game.menuIndex = 0;
    if (pressed.has('2')) game.menuIndex = 1;
    if (pressed.has('3')) game.menuIndex = 2;
    if (game.showHelp) {
      if (actions & (ACTION_CONFIRM | ACTION_PAUSE)) game.showHelp = false;
      return;
    }
    if (!(actions & ACTION_CONFIRM)) return;
    if (game.menuIndex === 0) {
      audio.unlock();
      newGame();
    } else if (game.menuIndex === 1) {
      if (game.hasSave) continueGame();
      else audio.click();
    } else {
      game.showHelp = true;
    }
  }

  function handlePauseInput() {
    const actions = input.takeActions();
    const pressed = input.takePressed();
    if (pressed.has('arrowup') || pressed.has('w')) game.menuIndex = (game.menuIndex + 3) % 4;
    if (pressed.has('arrowdown') || pressed.has('s')) game.menuIndex = (game.menuIndex + 1) % 4;
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PLAY;
      return;
    }
    if (pressed.has('1')) game.menuIndex = 0;
    if (pressed.has('2')) game.menuIndex = 1;
    if (pressed.has('3')) game.menuIndex = 2;
    if (pressed.has('4')) game.menuIndex = 3;
    if (actions & ACTION_CONFIRM) {
      if (game.menuIndex === 0) screen = SCREEN_PLAY;
      else if (game.menuIndex === 1) {
        if (saveGame(game)) {
          game.toast = 'Game saved';
          game.toastTime = 2.5;
        }
        screen = SCREEN_PLAY;
      } else if (game.menuIndex === 2) {
        screen = SCREEN_MISSIONS;
      } else {
        screen = SCREEN_TITLE;
        game.menuIndex = 0;
      }
    }
  }

  function step() {
    // Dialogue pauses the world; E or click advances it.
    if (game.dialogue.length > 0) {
      const actions = input.takeActions();
      if (actions & (ACTION_CONFIRM | ACTION_ENTER_CAR)) {
        game.dialogueIndex += 1;
        if (game.dialogueIndex >= game.dialogue.length) {
          game.dialogue = [];
          game.dialogueIndex = 0;
        }
        audio.click();
      }
      return;
    }
    const actions = input.takeActions();
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      game.menuIndex = 0;
      announce('Paused.');
      return;
    }
    if (actions & ACTION_MISSIONS) {
      screen = SCREEN_MISSIONS;
      return;
    }
    if (actions & ACTION_SAVE) {
      if (saveGame(game)) {
        game.toast = 'Game saved (Q)';
        game.toastTime = 2.5;
      }
    }
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      game.toast = audio.isMuted() ? 'Sound off' : 'Sound on';
      game.toastTime = 1.5;
    }
    if (!game.missions.started && !game.missions.storyDone) beginMission(game);
    const result = worldStep(game, STEP, input, audio, actions);
    if (result === SCREEN_BUSTED || result === SCREEN_WASTED) {
      screen = result;
      announce(result === SCREEN_BUSTED ? 'Busted.' : 'Wasted.');
    } else if (result === SCREEN_STORY) {
      screen = SCREEN_STORY;
      announce('Story complete.');
    }
    audio.engine(game.playerCar ? game.playerCar.speed : 0, !!game.playerCar);
    audio.siren(game.wanted.level, STEP);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (screen === SCREEN_TITLE) {
      handleTitleInput();
    } else if (screen === SCREEN_PAUSED) {
      handlePauseInput();
    } else if (screen === SCREEN_MISSIONS) {
      const actions = input.takeActions();
      if (actions & (ACTION_PAUSE | ACTION_MISSIONS | ACTION_CONFIRM)) screen = SCREEN_PLAY;
    } else if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED || screen === SCREEN_STORY) {
      const actions = input.takeActions();
      if (actions & ACTION_CONFIRM) {
        if (screen === SCREEN_STORY) {
          screen = SCREEN_PLAY;
        } else {
          screen = SCREEN_PLAY;
          beginMission(game);
        }
      }
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        step();
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) break;
      }
    }
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_MISSIONS
      || screen === SCREEN_BUSTED || screen === SCREEN_WASTED || screen === SCREEN_STORY) {
      renderer.draw(game, screen, game.time);
    } else {
      renderer.draw(game, screen, game.time);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // A debug handle for the scripted playtest (and nothing else).
  window.__solmar = {
    game: () => game,
    screen: () => screen,
    version: 'solmar-bay-1',
  };

  announce('Solmar Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shotName) runShot(shotName);
else runGame();
