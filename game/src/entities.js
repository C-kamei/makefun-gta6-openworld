// entities.js — player, cars, traffic, pedestrians, police, rivals and bullets.
// A stolen traffic car is REMOVED from the traffic fleet the moment it is
// taken, so it never keeps autopilot-driving itself away.
var AU_ENT = (function () {
  var CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e8c33a', '#7dd93d', '#d9d9d9', '#8a5fd9', '#3dd9c8', '#e07a3a'];
  var PED_COLORS = ['#e8b04b', '#7ab5e8', '#e87ab5', '#8ae87a', '#d9d9d9', '#b57ae8'];

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function angDiff(a, b) { var d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

  function makeCar(x, y, angle, color, opts) {
    opts = opts || {};
    return { x: x, y: y, angle: angle, speed: 0, color: color || pick(CAR_COLORS),
      traffic: !!opts.traffic, police: !!opts.police, parked: !!opts.parked,
      axis: opts.axis || 'h', dir: opts.dir || 1, lane: opts.lane || 0,
      hp: 100, dead: false, turnAt: 0 };
  }

  function roadPoint() {
    var v = AU_CITY.V_ROADS[Math.floor(Math.random() * AU_CITY.V_ROADS.length)];
    var h = AU_CITY.H_ROADS[Math.floor(Math.random() * AU_CITY.H_ROADS.length)];
    return Math.random() < 0.5 ? { x: v, y: rnd(100, 2300) } : { x: rnd(100, 3100), y: h };
  }

  function spawnTraffic(S, n) {
    while (S.cars.filter(function (c) { return c.traffic; }).length < n) {
      var p = roadPoint();
      var vertical = Math.abs(p.x - AU_CITY.V_ROADS.reduce(function (a, b) { return Math.abs(p.x - b) < Math.abs(p.x - a) ? b : a; })) < 5;
      var axis = vertical ? 'v' : 'h';
      var lane = (Math.random() < 0.5 ? -1 : 1) * 26;
      var c = makeCar(p.x + (axis === 'v' ? lane : 0), p.y + (axis === 'h' ? lane : 0),
        axis === 'v' ? (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (Math.random() < 0.5 ? 0 : Math.PI),
        pick(CAR_COLORS), { traffic: true, axis: axis, dir: Math.random() < 0.5 ? 1 : -1, lane: lane });
      c.speed = rnd(90, 150);
      S.cars.push(c);
    }
  }

  function spawnParkedCars(S) {
    // Parked cars sit on road curbs (open ground), never inside buildings.
    var spots = [[1200, 460], [800, 1260], [2000, 860], [400, 1660], [2400, 460], [1600, 2060], [2800, 860], [1200, 860]];
    spots.forEach(function (s, i) {
      S.cars.push(makeCar(s[0], s[1], (i % 2 ? Math.PI / 2 : 0), pick(CAR_COLORS), { parked: true }));
    });
  }

  function spawnPedestrians(S, n) {
    for (var i = 0; i < n; i++) {
      var p = roadPoint();
      S.peds.push({ x: p.x + rnd(-40, 40), y: p.y + rnd(-40, 40), angle: rnd(0, Math.PI * 2),
        speed: rnd(28, 55), color: pick(PED_COLORS), flee: 0, walkPhase: rnd(0, 6) });
    }
  }

  function updateTraffic(S, dt) {
    var roads = AU_CITY;
    S.cars.forEach(function (c) {
      if (!c.traffic || c.dead) return;
      var target = c.speed;
      // Slow for a car ahead on the same lane.
      S.cars.forEach(function (o) {
        if (o === c || o.dead) return;
        var dx = o.x - c.x, dy = o.y - c.y;
        var along = Math.cos(c.angle) * dx + Math.sin(c.angle) * dy;
        var side = Math.abs(-Math.sin(c.angle) * dx + Math.cos(c.angle) * dy);
        if (along > 0 && along < 70 && side < 26) target = Math.min(target, 0);
      });
      c.speed += (target - c.speed) * Math.min(1, dt * 2);
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
      // At an intersection, sometimes turn onto the crossing road.
      var nearV = roads.V_ROADS.some(function (r) { return Math.abs(c.x - r) < 8; });
      var nearH = roads.H_ROADS.some(function (r) { return Math.abs(c.y - r) < 8; });
      if (nearV && nearH && Math.random() < dt * 0.25) {
        c.angle += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
        c.axis = c.axis === 'v' ? 'h' : 'v';
      }
      if (c.x < 60 || c.x > roads.WORLD_W - 60 || c.y < 60 || c.y > roads.WORLD_H - 60) {
        c.angle += Math.PI; c.x = Math.max(80, Math.min(roads.WORLD_W - 80, c.x));
        c.y = Math.max(80, Math.min(roads.WORLD_H - 80, c.y));
      }
      var fixed = roads.collideCircle(c.x, c.y, 20);
      c.x = fixed.x; c.y = fixed.y;
    });
    // Replace traffic that was stolen so the streets stay busy.
    spawnTraffic(S, 18);
  }

  function updatePeds(S, dt) {
    S.peds.forEach(function (p) {
      var dx = S.player.x - p.x, dy = S.player.y - p.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      var gunfire = S.bullets.length > 0;
      if ((d < 160 && S.wanted > 0) || (gunfire && d < 320)) p.flee = 2.5;
      if (p.flee > 0) {
        p.flee -= dt;
        p.angle = Math.atan2(-dy, -dx);
        p.speed = 110;
      } else {
        p.speed = 40;
        if (Math.random() < dt * 0.15) p.angle += rnd(-1.2, 1.2);
      }
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
      p.walkPhase += dt * 8;
      var fixed = AU_CITY.collideCircle(p.x, p.y, 10);
      p.x = fixed.x; p.y = fixed.y;
      p.x = Math.max(30, Math.min(AU_CITY.WORLD_W - 30, p.x));
      p.y = Math.max(30, Math.min(AU_CITY.WORLD_H - 30, p.y));
    });
  }

  function nearestCar(S, x, y, maxD, filter) {
    var best = null, bestD = maxD;
    S.cars.forEach(function (c) {
      if (c.dead || (filter && !filter(c))) return;
      var d = Math.hypot(c.x - x, c.y - y);
      if (d < bestD) { bestD = d; best = c; }
    });
    return best;
  }

  function stealCar(S) {
    var p = S.player;
    if (p.inCar) { exitCar(S); return false; }
    var c = nearestCar(S, p.x, p.y, 70, function (car) { return true; });
    if (!c) return false;
    if (c.traffic) { c.traffic = false; } // leave the traffic fleet
    c.parked = false;
    p.inCar = true; p.car = c; c.speed = 0;
    AU_AUDIO.carDoor();
    if (!c.police) addWanted(S, 1, 'Grand theft auto');
    else addWanted(S, 2, 'Stole a police cruiser');
    return true;
  }

  function exitCar(S) {
    var p = S.player;
    if (!p.inCar || !p.car) return;
    var c = p.car;
    c.speed = 0;
    p.x = c.x - Math.sin(c.angle) * 34; p.y = c.y + Math.cos(c.angle) * 34;
    var fixed = AU_CITY.collideCircle(p.x, p.y, 14);
    p.x = fixed.x; p.y = fixed.y;
    p.inCar = false; p.car = null;
    AU_AUDIO.carDoor();
  }

  function addWanted(S, n, why) {
    S.wanted = Math.min(5, S.wanted + n);
    S.wantedTimer = 0;
    if (why) S.toast(why + ' — wanted level ' + S.wanted, '#ff5a4e');
  }

  function damagePlayer(S, amt) {
    var p = S.player;
    p.health -= amt;
    if (p.health <= 0) {
      p.health = 100;
      S.cash = Math.max(0, S.cash - 250);
      S.wanted = 0;
      S.cops.length = 0;
      S.policeCars.length = 0;
      if (p.inCar) { p.inCar = false; p.car = null; }
      p.x = AU_CITY.LANDMARKS.spawn.x; p.y = AU_CITY.LANDMARKS.spawn.y;
      S.toast('Wasted — dumped at Harborlight Corner, $250 hospital bill', '#ff5a4e');
      AU_AUDIO.busted();
    }
  }

  function playerShoot(S, wx, wy) {
    var p = S.player;
    if (p.inCar || S.state !== 'play') return;
    var a = Math.atan2(wy - p.y, wx - p.x);
    p.angle = a;
    S.bullets.push({ x: p.x + Math.cos(a) * 22, y: p.y + Math.sin(a) * 22,
      vx: Math.cos(a) * 950, vy: Math.sin(a) * 950, life: 0.7, from: 'player' });
    AU_AUDIO.shoot();
    if (S.wanted === 0) addWanted(S, 1, 'Shots fired in public');
  }

  function updateBullets(S, dt) {
    function step(list, fromPlayer) {
      for (var i = list.length - 1; i >= 0; i--) {
        var b = list[i];
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        var hit = b.life <= 0 || AU_CITY.buildingAt(b.x, b.y);
        if (!hit) {
          if (fromPlayer) {
            for (var j = S.enemies.length - 1; j >= 0; j--) {
              var e = S.enemies[j];
              if (Math.hypot(e.x - b.x, e.y - b.y) < 18) {
                e.hp -= 34; hit = true;
                AU_AUDIO.hit();
                if (e.hp <= 0) { S.enemies.splice(j, 1); S.onEnemyKilled(e); }
                break;
              }
            }
            if (!hit) for (var k = S.cops.length - 1; k >= 0; k--) {
              var cop = S.cops[k];
              if (Math.hypot(cop.x - b.x, cop.y - b.y) < 16) {
                cop.hp -= 34; hit = true; AU_AUDIO.hit();
                if (cop.hp <= 0) { S.cops.splice(k, 1); addWanted(S, 1, 'Officer down'); }
                break;
              }
            }
          } else {
            if (Math.hypot(S.player.x - b.x, S.player.y - b.y) < 16) {
              damagePlayer(S, 5); hit = true;
            }
          }
        }
        if (hit) list.splice(i, 1);
      }
    }
    step(S.bullets, true);
    step(S.ebullets, false);
  }

  function spawnPolice(S) {
    // Wanted 1-2: cruisers. 3+: cruisers plus foot officers.
    var wantCars = Math.min(S.wanted, 3);
    while (S.policeCars.length < wantCars) {
      var a = rnd(0, Math.PI * 2);
      var x = S.player.x + Math.cos(a) * 520, y = S.player.y + Math.sin(a) * 520;
      x = Math.max(120, Math.min(AU_CITY.WORLD_W - 120, x));
      y = Math.max(120, Math.min(AU_CITY.WORLD_H - 120, y));
      var c = makeCar(x, y, a, '#20242e', { police: true });
      S.cars.push(c); S.policeCars.push(c);
    }
    var wantCops = S.wanted >= 3 ? S.wanted - 1 : 0;
    while (S.cops.length < wantCops) {
      var a2 = rnd(0, Math.PI * 2);
      S.cops.push({ x: S.player.x + Math.cos(a2) * 300, y: S.player.y + Math.sin(a2) * 300,
        hp: 50, speed: 0, arrest: 0 });
    }
  }

  function updatePolice(S, dt) {
    if (S.wanted <= 0) {
      S.policeCars.forEach(function (c) { c.police = false; c.traffic = false; c.dead = true; });
      S.policeCars.length = 0; S.cops.length = 0;
      return;
    }
    spawnPolice(S);
    var p = S.player;
    S.policeCars.forEach(function (c) {
      if (c.dead) return;
      var target = Math.atan2(p.y - c.y, p.x - c.x);
      c.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, angDiff(c.angle, target)));
      var want = p.inCar ? 340 : 250;
      c.speed += ((want - c.speed) * Math.min(1, dt * 1.5));
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
      var fixed = AU_CITY.collideCircle(c.x, c.y, 20);
      c.x = fixed.x; c.y = fixed.y;
      var d = Math.hypot(p.x - c.x, p.y - c.y);
      if (d < 46) {
        if (p.inCar && p.car) { p.car.hp -= 12 * dt; if (Math.random() < dt * 2) AU_AUDIO.crash(); }
        else damagePlayer(S, 6 * dt);
      }
    });
    S.policeCars = S.policeCars.filter(function (c) { return !c.dead; });
    S.cars = S.cars.filter(function (c) { return !c.dead; });
    // Foot officers chase and try to arrest an on-foot player.
    S.cops.forEach(function (cop) {
      var d = Math.hypot(p.x - cop.x, p.y - cop.y);
      if (p.inCar) { cop.arrest = 0; return; }
      var a = Math.atan2(p.y - cop.y, p.x - cop.x);
      var sp = d > 200 ? 150 : 120;
      cop.x += Math.cos(a) * sp * dt; cop.y += Math.sin(a) * sp * dt;
      var f2 = AU_CITY.collideCircle(cop.x, cop.y, 12);
      cop.x = f2.x; cop.y = f2.y;
      if (d < 34) {
        cop.arrest += dt;
        if (cop.arrest > 2.2) {
          S.cash = Math.max(0, S.cash - 150);
          S.wanted = 0; S.cops.length = 0; S.policeCars.length = 0;
          p.x = AU_CITY.LANDMARKS.spawn.x; p.y = AU_CITY.LANDMARKS.spawn.y;
          S.toast('Busted — the Aurelia PD hauled you in ($150 fine)', '#ff5a4e');
          AU_AUDIO.busted();
        }
      } else cop.arrest = Math.max(0, cop.arrest - dt);
    });
    // Wanted slowly cools off when the player stays out of sight of police.
    var nearest = 1e9;
    S.policeCars.forEach(function (c) { nearest = Math.min(nearest, Math.hypot(p.x - c.x, p.y - c.y)); });
    S.cops.forEach(function (c) { nearest = Math.min(nearest, Math.hypot(p.x - c.x, p.y - c.y)); });
    if (nearest > 700) {
      S.wantedTimer += dt;
      if (S.wantedTimer > 26) { S.wanted = Math.max(0, S.wanted - 1); S.wantedTimer = 0; }
    } else S.wantedTimer = 0;
  }

  function updateEnemies(S, dt) {
    var p = S.player;
    S.enemies.forEach(function (e) {
      var d = Math.hypot(p.x - e.x, p.y - e.y);
      e.cool -= dt;
      if (d < 520 && !p.inCar) {
        e.angle = Math.atan2(p.y - e.y, p.x - e.x);
        if (d > 260) { e.x += Math.cos(e.angle) * 95 * dt; e.y += Math.sin(e.angle) * 95 * dt; }
        if (e.cool <= 0 && d < 460) {
          e.cool = rnd(1.4, 2.2);
          var a = e.angle + rnd(-0.12, 0.12);
          S.ebullets.push({ x: e.x + Math.cos(a) * 20, y: e.y + Math.sin(a) * 20,
            vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, life: 1.0, from: 'enemy' });
          AU_AUDIO.enemyShoot();
        }
      } else if (d < 520 && p.inCar) {
        e.angle = Math.atan2(p.y - e.y, p.x - e.x);
      }
      var f = AU_CITY.collideCircle(e.x, e.y, 13);
      e.x = f.x; e.y = f.y;
    });
  }

  return { makeCar: makeCar, spawnTraffic: spawnTraffic, spawnParkedCars: spawnParkedCars,
    spawnPedestrians: spawnPedestrians, updateTraffic: updateTraffic, updatePeds: updatePeds,
    stealCar: stealCar, exitCar: exitCar, addWanted: addWanted, damagePlayer: damagePlayer,
    playerShoot: playerShoot, updateBullets: updateBullets, updatePolice: updatePolice,
    updateEnemies: updateEnemies, nearestCar: nearestCar, angDiff: angDiff };
})();
