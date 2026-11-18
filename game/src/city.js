// city.js — Port Aurelia: a fictional sun-soaked coastal city.
// Grid roads, seeded building blocks, a beach strip on the south shore.
// Every mission landmark sits on a road intersection (open ground), never
// inside a building, so collision push-out can never strand the player
// outside an objective radius.
var AU_CITY = (function () {
  var WORLD_W = 3200, WORLD_H = 2400;
  var ROAD_W = 110; // full road width
  var V_ROADS = [400, 800, 1200, 1600, 2000, 2400, 2800];
  var H_ROADS = [400, 800, 1200, 1600, 2000];
  var BEACH_Y = 2240; // south of here is sand and sea

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var PALETTE = ['#c98f5f', '#b57a4e', '#8fa3b8', '#a8b6c4', '#d9a05b', '#7d8ea3', '#c4b49a', '#9a6b4f'];
  var KINDS = ['apartments', 'offices', 'shops', 'hotel', 'warehouse', 'cafe', 'market', 'studio'];

  var buildings = [];
  (function generate() {
    var rnd = mulberry32(20261118);
    var xs = [0].concat(V_ROADS).concat([WORLD_W]);
    var ys = [0].concat(H_ROADS).concat([WORLD_H]);
    for (var bi = 0; bi < xs.length - 1; bi++) {
      for (var bj = 0; bj < ys.length - 1; bj++) {
        var x0 = xs[bi] + (bi === 0 ? 40 : ROAD_W / 2 + 22);
        var x1 = xs[bi + 1] - (bi === xs.length - 2 ? 40 : ROAD_W / 2 + 22);
        var y0 = ys[bj] + (bj === 0 ? 40 : ROAD_W / 2 + 22);
        var y1 = ys[bj + 1] - (bj === ys.length - 2 ? 40 : ROAD_W / 2 + 22);
        if (y0 > BEACH_Y - 60) continue; // beach strip stays open
        if (x1 - x0 < 130 || y1 - y0 < 110) continue;
        var n = 1 + Math.floor(rnd() * 2);
        for (var k = 0; k < n; k++) {
          var w = 90 + rnd() * 110, h = 80 + rnd() * 100;
          var bx = x0 + rnd() * Math.max(1, (x1 - x0) - w);
          var by = y0 + rnd() * Math.max(1, (y1 - y0) - h);
          if (by + h > BEACH_Y - 20) by = BEACH_Y - 20 - h;
          var b = { x: bx, y: by, w: w, h: h,
            color: PALETTE[Math.floor(rnd() * PALETTE.length)],
            kind: KINDS[Math.floor(rnd() * KINDS.length)], label: null };
          var overlap = false;
          for (var j = 0; j < buildings.length; j++) {
            var o = buildings[j];
            if (bx < o.x + o.w + 18 && bx + w + 18 > o.x && by < o.y + o.h + 18 && by + h + 18 > o.y) { overlap = true; break; }
          }
          if (!overlap) buildings.push(b);
        }
      }
    }
    // Named landmark buildings, placed well clear of their road markers.
    function named(x, y, w, h, color, label) {
      buildings.push({ x: x, y: y, w: w, h: h, color: color, kind: 'landmark', label: label });
    }
    named(1290, 1820, 150, 110, '#7d6a9a', 'DOCKS');
    named(2090, 460, 140, 100, '#5f7d6a', 'GARAGE');
    named(1690, 1020, 160, 120, '#9a7d5f', 'PLAZA');
    named(2490, 1420, 150, 110, '#6a7d9a', 'AURELIA BANK');
    named(890, 620, 140, 100, '#8a6a7d', 'HIDEOUT');
    named(2620, 1820, 170, 120, '#5f8a7d', 'MARINA');
  })();

  // Landmarks: all on road intersections (open ground by construction).
  var LANDMARKS = {
    docks:   { x: 1200, y: 2000, name: 'Docks — pickup point' },
    garage:  { x: 2000, y: 400,  name: 'Rook\u2019s Garage' },
    plaza:   { x: 1600, y: 1200, name: 'Meridian Plaza' },
    bank:    { x: 2400, y: 1600, name: 'Aurelia Bank' },
    hideout: { x: 800,  y: 800,  name: 'Hideout' },
    marina:  { x: 2800, y: 2000, name: 'Marina' },
    spawn:   { x: 400,  y: 400,  name: 'Harborlight Corner' }
  };

  function onRoad(x, y) {
    for (var i = 0; i < V_ROADS.length; i++) if (Math.abs(x - V_ROADS[i]) < ROAD_W / 2) return true;
    for (var j = 0; j < H_ROADS.length; j++) if (Math.abs(y - H_ROADS[j]) < ROAD_W / 2) return true;
    return false;
  }

  function buildingAt(x, y) {
    for (var i = 0; i < buildings.length; i++) {
      var b = buildings[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  }

  // Push a circle out of every building it overlaps. Returns corrected {x,y}.
  function collideCircle(x, y, r) {
    for (var i = 0; i < buildings.length; i++) {
      var b = buildings[i];
      var cx = Math.max(b.x, Math.min(x, b.x + b.w));
      var cy = Math.max(b.y, Math.min(y, b.y + b.h));
      var dx = x - cx, dy = y - cy;
      var d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 < 0.01) { x = b.x - r; continue; }
        var d = Math.sqrt(d2);
        x = cx + dx / d * r; y = cy + dy / d * r;
      }
    }
    return { x: Math.max(20, Math.min(WORLD_W - 20, x)),
             y: Math.max(20, Math.min(WORLD_H - 20, y)) };
  }

  function distToRoad(x, y) {
    var best = 1e9;
    for (var i = 0; i < V_ROADS.length; i++) best = Math.min(best, Math.abs(x - V_ROADS[i]));
    for (var j = 0; j < H_ROADS.length; j++) best = Math.min(best, Math.abs(y - H_ROADS[j]));
    return best;
  }

  return { WORLD_W: WORLD_W, WORLD_H: WORLD_H, ROAD_W: ROAD_W,
    V_ROADS: V_ROADS, H_ROADS: H_ROADS, BEACH_Y: BEACH_Y,
    buildings: buildings, LANDMARKS: LANDMARKS,
    onRoad: onRoad, buildingAt: buildingAt, collideCircle: collideCircle,
    distToRoad: distToRoad, mulberry32: mulberry32 };
})();
