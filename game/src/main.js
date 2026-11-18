// main.js — game state, loop, player/car controls, camera, save/load, menus.
// State machine: title -> play <-> pause -> won. Progress autosaves on every
// mission completion and can be saved/loaded from the pause menu.
(function () {
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  AU_INPUT.init(canvas);

  var SAVE_KEY = 'portAureliaSave.v1';

  function newState() {
    var S = {
      state: 'title', time: 0, cash: 0, wanted: 0, wantedTimer: 0,
      missionIndex: 0, missionStage: 0,
      player: { x: AU_CITY.LANDMARKS.spawn.x, y: AU_CITY.LANDMARKS.spawn.y,
        angle: 0, health: 100, inCar: false, car: null },
      cars: [], peds: [], cops: [], policeCars: [], enemies: [],
      bullets: [], ebullets: [],
      camera: { x: 0, y: 0 },
      toasts: [], dialogue: [], promptText: '',
      menuButtons: [], hasSave: false, showHelp: false,
      fireCool: 0, lastMission: 0, cruise: false
    };
    S.toast = function (text, color) {
      S.toasts.push({ text: text, color: color || '#fff', life: 3.2 });
      if (S.toasts.length > 3) S.toasts.shift();
    };
    S.say = function (lines) { S.dialogue = lines.slice(); };
    S.onEnemyKilled = function (e) {
      if (e.role === 'boss') S.toast('VEX IS DOWN', '#ffd24a');
      else S.toast('Rival down', '#fff');
    };
    return S;
  }

  var S = newState();
  S.hasSave = !!localStorage.getItem(SAVE_KEY);

  function saveGame() {
    var p = S.player;
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      missionIndex: S.missionIndex, cash: S.cash, health: p.health,
      x: p.x, y: p.y, wanted: S.wanted
    }));
    S.hasSave = true;
    S.toast('Game saved', '#7dd93d');
  }

  function loadGame() {
    var raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    try {
      var d = JSON.parse(raw);
      S.cars.length = 0; S.peds.length = 0; S.enemies.length = 0;
      S.cops.length = 0; S.policeCars.length = 0;
      S.player.x = d.x; S.player.y = d.y; S.player.health = d.health || 100;
      S.player.inCar = false; S.player.car = null;
      S.cash = d.cash || 0; S.wanted = d.wanted || 0;
      AU_ENT.spawnParkedCars(S); AU_ENT.spawnTraffic(S, 18); AU_ENT.spawnPedestrians(S, 24);
      AU_MISSIONS.startMission(S, d.missionIndex || 0);
      S.state = 'play';
      return true;
    } catch (e) { return false; }
  }

  function startNewGame() {
    var keep = S.hasSave;
    S = newState(); S.hasSave = keep;
    window.__AU.S = S;
    AU_ENT.spawnParkedCars(S); AU_ENT.spawnTraffic(S, 18); AU_ENT.spawnPedestrians(S, 24);
    AU_MISSIONS.startMission(S, 0);
    S.state = 'play';
    AU_AUDIO.ensure();
  }

  function updatePlayer(dt) {
    var p = S.player;
    var ix = (AU_INPUT.down('d') || AU_INPUT.down('arrowright') ? 1 : 0) -
             (AU_INPUT.down('a') || AU_INPUT.down('arrowleft') ? 1 : 0);
    var iy = (AU_INPUT.down('s') || AU_INPUT.down('arrowdown') ? 1 : 0) -
             (AU_INPUT.down('w') || AU_INPUT.down('arrowup') ? 1 : 0);
    if (p.inCar && p.car) {
      var c = p.car;
      var fwd = (AU_INPUT.down('w') || AU_INPUT.down('arrowup') ? 1 : 0) -
                (AU_INPUT.down('s') || AU_INPUT.down('arrowdown') ? 1 : 0);
      if (S.cruise && fwd === 0) fwd = 1; // staged screenshots keep driving
      var steer = (AU_INPUT.down('a') || AU_INPUT.down('arrowleft') ? 1 : 0) -
                  (AU_INPUT.down('d') || AU_INPUT.down('arrowright') ? 1 : 0);
      var maxSpd = 430;
      c.speed += fwd * 260 * dt;
      c.speed -= c.speed * 0.55 * dt;
      if (fwd === 0) c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), 120 * dt);
      c.speed = Math.max(-140, Math.min(maxSpd, c.speed));
      c.angle += steer * 1.9 * dt * Math.min(1, Math.abs(c.speed) / 120) * Math.sign(c.speed || 1);
      var nx = c.x + Math.cos(c.angle) * c.speed * dt;
      var ny = c.y + Math.sin(c.angle) * c.speed * dt;
      var fixed = AU_CITY.collideCircle(nx, ny, 20);
      if (Math.abs(fixed.x - nx) > 0.5 || Math.abs(fixed.y - ny) > 0.5) {
        if (Math.abs(c.speed) > 180) AU_AUDIO.crash();
        c.speed *= 0.4;
      }
      c.x = fixed.x; c.y = fixed.y;
      p.x = c.x; p.y = c.y; p.angle = c.angle;
      // Ram traffic out of the way a little.
      S.cars.forEach(function (o) {
        if (o === c || o.dead) return;
        var d = Math.hypot(o.x - c.x, o.y - c.y);
        if (d < 44 && d > 0.01) {
          o.x += (o.x - c.x) / d * (44 - d);
          o.y += (o.y - c.y) / d * (44 - d);
        }
      });
    } else {
      var run = AU_INPUT.down('shift') ? 1.55 : 1;
      var sp = 175 * run;
      var len = Math.hypot(ix, iy);
      if (len > 0) {
        p.x += ix / len * sp * dt;
        p.y += iy / len * sp * dt;
      }
      var f2 = AU_CITY.collideCircle(p.x, p.y, 13);
      p.x = f2.x; p.y = f2.y;
      // Aim at the mouse.
      var mw = S.camera.x + AU_INPUT.mouse.x;
      var mh = S.camera.y + AU_INPUT.mouse.y;
      p.angle = Math.atan2(mh - p.y, mw - p.x);
      // Fire while the mouse button is held.
      S.fireCool -= dt;
      if (AU_INPUT.mouse.down && S.fireCool <= 0) {
        S.fireCool = 0.18;
        AU_ENT.playerShoot(S, mw, mh);
      }
    }
    // Health slowly recovers when the heat is off.
    if (S.wanted === 0 && p.health < 100) p.health = Math.min(100, p.health + 4 * dt);
  }

  function updateCamera() {
    var p = S.player;
    var tx = p.x - 640, ty = p.y - 400;
    S.camera.x += (tx - S.camera.x) * 0.12;
    S.camera.y += (ty - S.camera.y) * 0.12;
    S.camera.x = Math.max(0, Math.min(AU_CITY.WORLD_W - 1280, S.camera.x));
    S.camera.y = Math.max(0, Math.min(AU_CITY.WORLD_H - 800, S.camera.y));
  }

  function updatePrompt() {
    var p = S.player;
    if (p.inCar) { S.promptText = 'E — get out   ·   W/S drive   ·   A/D steer'; return; }
    var c = AU_ENT.nearestCar(S, p.x, p.y, 70, null);
    if (c) { S.promptText = 'E — steal the ' + (c.police ? 'police cruiser' : 'car'); return; }
    var m = AU_MISSIONS.current(S);
    if (m) {
      var t = m.target(S);
      var d = Math.hypot(p.x - t.x, p.y - t.y);
      if (d < 200) { S.promptText = m.brief; return; }
    }
    S.promptText = '';
  }

  function clickIn(b) {
    var mx = AU_INPUT.mouse.x, my = AU_INPUT.mouse.y;
    return mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h;
  }

  function handleMenus() {
    // In play state clicks belong to the world (shooting / dialogue), not menus.
    if (S.state === 'play') return;
    var clicked = AU_INPUT.consumeClick();
    var enter = AU_INPUT.pressed('enter');
    if (S.state === 'title') {
      if (S.showHelp) {
        if (clicked || enter) S.showHelp = false;
        return;
      }
      if (clicked) {
        for (var i = 0; i < S.menuButtons.length; i++) {
          var b = S.menuButtons[i];
          if (!clickIn(b)) continue;
          if (b.label === 'HOW TO PLAY') S.showHelp = true;
          else if (b.label === 'CONTINUE' && S.hasSave) { loadGame(); }
          else startNewGame();
        }
      } else if (enter) startNewGame();
      return;
    }
    if (S.state === 'pause') {
      if (clicked) {
        for (var j = 0; j < S.menuButtons.length; j++) {
          var b2 = S.menuButtons[j];
          if (!clickIn(b2)) continue;
          if (b2.label === 'RESUME') S.state = 'play';
          else if (b2.label === 'SAVE GAME') saveGame();
          else if (b2.label === 'LOAD GAME') { if (loadGame()) S.toast('Save loaded', '#7dd93d'); }
          else if (b2.label === 'RESTART STORY') startNewGame();
          else if (b2.label === 'BACK TO TITLE') { S.state = 'title'; AU_AUDIO.stopLoops(); }
        }
      }
      return;
    }
    if (S.state === 'won') {
      if (clicked) {
        for (var k = 0; k < S.menuButtons.length; k++)
          if (clickIn(S.menuButtons[k])) startNewGame();
      }
      return;
    }
  }

  function update(dt) {
    S.time += dt;
    for (var i = S.toasts.length - 1; i >= 0; i--) {
      S.toasts[i].life -= dt;
      if (S.toasts[i].life <= 0) S.toasts.splice(i, 1);
    }
    if (S.state === 'play') {
      // Dialogue pauses the world; Enter/click advances it.
      if (S.dialogue.length > 0) {
        if (AU_INPUT.pressed('enter') || AU_INPUT.consumeClick()) S.dialogue.shift();
        updateCamera();
        return;
      }
      if (AU_INPUT.pressed('p') || AU_INPUT.pressed('escape')) { S.state = 'pause'; AU_AUDIO.stopLoops(); return; }
      if (AU_INPUT.pressed('m')) { AU_AUDIO.toggleMute(); S.toast(AU_AUDIO.isMuted() ? 'Sound muted' : 'Sound on', '#fff'); }
      if (AU_INPUT.pressed('e')) AU_ENT.stealCar(S);
      updatePlayer(dt);
      AU_ENT.updateTraffic(S, dt);
      AU_ENT.updatePeds(S, dt);
      AU_ENT.updatePolice(S, dt);
      AU_ENT.updateEnemies(S, dt);
      AU_ENT.updateBullets(S, dt);
      AU_MISSIONS.updateMission(S, dt);
      if (S.missionIndex !== S.lastMission) { S.lastMission = S.missionIndex; saveGame(); }
      updatePrompt();
      updateCamera();
      var spd = S.player.inCar && S.player.car ? Math.abs(S.player.car.speed) / 430 : 0;
      AU_AUDIO.setEngine(spd, S.wanted);
    }
  }

  // Staged screenshot scenes (?shot=...) — applied once, before the first frame.
  var shotName = AU_SHOTS.param();
  if (shotName) {
    AU_ENT.spawnParkedCars(S); AU_ENT.spawnPedestrians(S, 24);
    AU_SHOTS.apply(S, shotName);
    S.lastMission = S.missionIndex;
    updateCamera();
  }

  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    handleMenus();
    update(dt);
    AU_RENDER.render(S, ctx);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Debug hook for scripted playtests (not part of the game UI).
  window.__AU = { S: S, startNewGame: startNewGame, loadGame: loadGame, saveGame: saveGame };
})();
