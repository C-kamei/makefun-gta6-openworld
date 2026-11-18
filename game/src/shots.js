// Solmar Bay — the screenshot scenes behind ?shot=drive|chase|mission|start.
// Each one builds a real game state (a fresh world, a real mission in
// progress, real traffic and police) and plays it forward a fixed number of
// steps with a scripted driver, so the frame is what actual play looks like
// and the same seed always gives the same frame.

import { STEP } from './config.js';
import { LANDMARKS } from './city.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/** Steer a car toward a point: throttle, brake for sharp turns, steer. */
function driveToward(game, target) {
  const car = game.playerCar;
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return {
    throttle: Math.abs(diff) < 1.2 ? 1 : 0.3,
    brake: Math.abs(diff) > 2.4 ? 1 : 0,
    steer: Math.max(-1, Math.min(1, diff * 2.4)),
  };
}

/**
 * Stage a scene on a fresh game: returns the screen to draw and the game
 * object the renderer should paint. The game keeps running its own update
 * through `stageDrive`, so traffic and police move for real.
 */
export function stageShot(name, game, seed) {
  game.reset(seed);
  if (name === 'start') {
    return { screen: SCREEN_TITLE, game };
  }
  if (name === 'drive') {
    // Mission 1 in progress: Danny driving south down the main drag toward
    // the pier, one star of heat, traffic around, HUD and minimap all live.
    game.startStory();
    game.putPlayerInCar(1320, 900, Math.PI / 2, '#3f6fb5');
    game.wanted.level = 1;
    game.wanted.decayTimer = 999;
    game.wanted.sinceCrime = 0;
    game.objective = { type: 'goto', label: 'Drive to Sunset Pier', target: LANDMARKS.pier };
    game.objectiveLabel = 'Mission 1 — First Delivery: Drive to Sunset Pier';
    const target = LANDMARKS.pier;
    for (let i = 0; i < 60 * 2.5; i += 1) {
      if (game.playerCar) game.driveStep(driveToward(game, target), STEP);
      game.worldStep(STEP);
    }
    return { screen: SCREEN_PLAY, game };
  }
  if (name === 'chase') {
    // Mission 3: three stars, two cruisers on Danny's tail, racing west
    // along the waterfront road toward the hideout.
    game.startStory();
    game.missions.index = 2;
    game.missions.step = 0;
    game.putPlayerInCar(2100, 1640, Math.PI, '#d64545');
    game.wanted.level = 3;
    game.wanted.decayTimer = 999;
    game.wanted.sinceCrime = 0;
    game.objective = { type: 'wanted', label: 'Reach the hideout — lose the cops!', target: LANDMARKS.hideout };
    game.objectiveLabel = 'Mission 3 — Hot Getaway: Reach the hideout — lose the cops!';
    game.spawnPoliceForShot();
    // Straight west down the waterfront road: the car stays at speed and
    // the cruisers stay in frame behind it.
    const waypoints = [{ x: 1820, y: 1640 }, { x: 820, y: 1640 }];
    let wp = 0;
    for (let i = 0; i < 60 * 5.5; i += 1) {
      if (wp < waypoints.length && Math.hypot(game.playerCar.x - waypoints[wp].x, game.playerCar.y - waypoints[wp].y) < 70) wp += 1;
      const target = waypoints[Math.min(wp, waypoints.length - 1)];
      if (game.playerCar) game.driveStep(driveToward(game, target), STEP);
      game.worldStep(STEP);
    }
    return { screen: SCREEN_PLAY, game };
  }
  if (name === 'mission') {
    // Mission 4 on foot: Danny at the warehouse, Vipers shooting, one down.
    game.startStory();
    game.missions.index = 3;
    game.missions.step = 1;
    game.missions.kills = 1;
    game.player.x = 2460;
    game.player.y = 1500;
    game.player.aimAngle = Math.PI / 2;
    game.wanted.level = 2;
    game.wanted.decayTimer = 999;
    game.wanted.sinceCrime = 0;
    game.spawnEnemiesForShot();
    game.objective = { type: 'kill', label: 'Clear out the Vipers (1/5)', target: LANDMARKS.warehouse };
    game.objectiveLabel = 'Mission 4 — Turf Defense: Clear out the Vipers (1/5)';
    for (let i = 0; i < 60 * 2; i += 1) game.worldStep(STEP);
    // One shot mid-flight toward the nearest Viper, for the action frame.
    const enemy = game.enemies.find((e) => e.alive);
    if (enemy) {
      const ang = Math.atan2(enemy.y - game.player.y, enemy.x - game.player.x);
      game.fireBullet(ang);
      game.worldStep(STEP * 4);
    }
    return { screen: SCREEN_PLAY, game };
  }
  return { screen: SCREEN_TITLE, game };
}
