// render.js — all canvas drawing: the city, entities, HUD, minimap and menus.
// Building labels are drawn only for named landmarks, and never on top of
// an objective marker label, so the frame stays readable.
// rewritten in-session 2026-11-18 for gta6-01 round 2 resubmission
var AU_RENDER = (function () {
  var VW = 1280, VH = 800;

  function drawCar(ctx, c) {
    ctx.save();
    ctx.translate(c.x, c.y); ctx.rotate(c.angle);
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(-24, -10, 48, 24);
    ctx.fillStyle = c.police ? '#232833' : c.color;
    roundRect(ctx, -24, -13, 48, 26, 6); ctx.fill();
    ctx.fillStyle = c.police ? '#dfe6ff' : '#20242e';
    roundRect(ctx, -8, -11, 18, 22, 4); ctx.fill();
    ctx.fillStyle = '#9fd8ff';
    ctx.fillRect(14, -10, 4, 20);
    if (c.police) {
      ctx.fillStyle = '#ff3b30'; ctx.fillRect(-20, -13, 8, 5);
      ctx.fillStyle = '#3b82ff'; ctx.fillRect(-20, 8, 8, 5);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 8px Arial'; ctx.textAlign = 'center';
      ctx.fillText('PD', 0, 3);
    }
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function drawWorld(S, ctx) {
    var cam = S.camera;
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    // Ground: grass blocks, then roads, then the beach and sea.
    ctx.fillStyle = '#4a7a3f'; ctx.fillRect(cam.x - 20, cam.y - 20, VW + 40, VH + 40);
    ctx.fillStyle = '#3d6b38';
    for (var gx = 0; gx < 8; gx++) for (var gy = 0; gy < 6; gy++) {
      if ((gx + gy) % 2 === 0) ctx.fillRect(gx * 400, gy * 400, 400, 400);
    }
    // Beach + sea along the south shore.
    ctx.fillStyle = '#e8d49a'; ctx.fillRect(cam.x - 20, AU_CITY.BEACH_Y, VW + 40, 90);
    ctx.fillStyle = '#2e7fa8'; ctx.fillRect(cam.x - 20, AU_CITY.BEACH_Y + 90, VW + 40, 120);
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.fillRect(cam.x - 20, AU_CITY.BEACH_Y + 88, VW + 40, 4);
    // Roads.
    ctx.fillStyle = '#3a3f47';
    AU_CITY.V_ROADS.forEach(function (x) { ctx.fillRect(x - 55, 0, 110, AU_CITY.WORLD_H); });
    AU_CITY.H_ROADS.forEach(function (y) { ctx.fillRect(0, y - 55, AU_CITY.WORLD_W, 110); });
    ctx.strokeStyle = '#e8c33a'; ctx.lineWidth = 3; ctx.setLineDash([24, 22]);
    ctx.beginPath();
    AU_CITY.V_ROADS.forEach(function (x) { ctx.moveTo(x, 0); ctx.lineTo(x, AU_CITY.WORLD_H); });
    AU_CITY.H_ROADS.forEach(function (y) { ctx.moveTo(0, y); ctx.lineTo(AU_CITY.WORLD_W, y); });
    ctx.stroke(); ctx.setLineDash([]);
    // Sidewalk edges.
    ctx.strokeStyle = '#9aa0ab'; ctx.lineWidth = 4;
    ctx.beginPath();
    AU_CITY.V_ROADS.forEach(function (x) {
      ctx.moveTo(x - 55, 0); ctx.lineTo(x - 55, AU_CITY.WORLD_H);
      ctx.moveTo(x + 55, 0); ctx.lineTo(x + 55, AU_CITY.WORLD_H);
    });
    AU_CITY.H_ROADS.forEach(function (y) {
      ctx.moveTo(0, y - 55); ctx.lineTo(AU_CITY.WORLD_W, y - 55);
      ctx.moveTo(0, y + 55); ctx.lineTo(AU_CITY.WORLD_W, y + 55);
    });
    ctx.stroke();
    // Buildings.
    AU_CITY.buildings.forEach(function (b) {
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,.14)';
      ctx.fillRect(b.x, b.y, b.w, 10);
      ctx.fillStyle = 'rgba(20,30,50,.55)';
      for (var wy = b.y + 18; wy < b.y + b.h - 12; wy += 24)
        for (var wx = b.x + 12; wx < b.x + b.w - 12; wx += 26)
          ctx.fillRect(wx, wy, 12, 14);
      if (b.label) {
        ctx.fillStyle = 'rgba(10,14,20,.75)';
        ctx.fillRect(b.x + b.w / 2 - 52, b.y + b.h / 2 - 11, 104, 22);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center';
        ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 4);
      }
    });
    // Objective marker (pulsing ring + beacon).
    var m = AU_MISSIONS.current(S);
    if (m && S.state === 'play') {
      var t = m.target(S);
      var pulse = 6 + Math.sin(S.time * 4) * 3;
      ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r + pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,210,74,.18)';
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath(); ctx.moveTo(t.x, t.y - 34); ctx.lineTo(t.x - 10, t.y - 12); ctx.lineTo(t.x + 10, t.y - 12); ctx.closePath(); ctx.fill();
      ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillText(t.label, t.x + 1, t.y - 41);
      ctx.fillStyle = '#ffd24a'; ctx.fillText(t.label, t.x, t.y - 42);
    }
    // Pedestrians.
    S.peds.forEach(function (p) {
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y + 8, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f2c89b';
      ctx.beginPath(); ctx.arc(p.x, p.y - 4, 5, 0, Math.PI * 2); ctx.fill();
    });
    // Cars (traffic, parked, police).
    S.cars.forEach(function (c) { if (!c.dead) drawCar(ctx, c); });
    // Rivals / guards / boss.
    S.enemies.forEach(function (e) {
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath(); ctx.ellipse(e.x, e.y + 9, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = e.role === 'boss' ? '#8a1f2d' : '#a33';
      ctx.beginPath(); ctx.arc(e.x, e.y, e.role === 'boss' ? 13 : 11, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#222'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + Math.cos(e.angle) * 20, e.y + Math.sin(e.angle) * 20); ctx.stroke();
      ctx.fillStyle = '#222'; ctx.fillRect(e.x - 14, e.y - 24, 28, 5);
      ctx.fillStyle = '#ff5a4e'; ctx.fillRect(e.x - 14, e.y - 24, 28 * Math.max(0, e.hp) / (e.role === 'boss' ? 220 : 70), 5);
      if (e.role === 'boss') {
        ctx.fillStyle = '#ffd24a'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center';
        ctx.fillText('VEX', e.x, e.y - 30);
      }
    });
    // Foot officers.
    S.cops.forEach(function (cop) {
      ctx.fillStyle = '#232833';
      ctx.beginPath(); ctx.arc(cop.x, cop.y, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#9fd8ff';
      ctx.beginPath(); ctx.arc(cop.x, cop.y - 4, 5, 0, Math.PI * 2); ctx.fill();
      if (cop.arrest > 0) {
        ctx.fillStyle = '#ff5a4e'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
        ctx.fillText('ARRESTING…', cop.x, cop.y - 26);
      }
    });
    // Player (on foot: circle + aim line; in car: car is drawn above).
    var p = S.player;
    if (!p.inCar) {
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y + 9, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2e8b57';
      ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#d8ffd8'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.angle) * 26, p.y + Math.sin(p.angle) * 26); ctx.stroke();
      ctx.fillStyle = '#f2c89b';
      ctx.beginPath(); ctx.arc(p.x, p.y - 3, 6, 0, Math.PI * 2); ctx.fill();
    }
    // Bullets.
    ctx.fillStyle = '#ffe27a';
    S.bullets.forEach(function (b) { ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = '#ff7a5a';
    S.ebullets.forEach(function (b) { ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2); ctx.fill(); });
    ctx.restore();
  }

  function star(x, y, r, filled, ctx) {
    ctx.save(); ctx.translate(x, y); ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5;
      var rr = i % 2 === 0 ? r : r * 0.45;
      ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = filled ? '#ffd24a' : 'rgba(255,255,255,.25)'; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.stroke(); ctx.restore();
  }

  function drawMinimap(S, ctx) {
    var mw = 200, mh = 150, mx = VW - mw - 16, my = 16;
    var sx = mw / AU_CITY.WORLD_W, sy = mh / AU_CITY.WORLD_H;
    ctx.fillStyle = 'rgba(8,12,18,.78)';
    roundRect(ctx, mx - 6, my - 6, mw + 12, mh + 12, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip();
    ctx.fillStyle = '#2e5230'; ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#3a3f47';
    AU_CITY.V_ROADS.forEach(function (x) { ctx.fillRect(mx + x * sx - 2, my, 4, mh); });
    AU_CITY.H_ROADS.forEach(function (y) { ctx.fillRect(mx, my + y * sy, mw, 4); });
    ctx.fillStyle = '#2e7fa8'; ctx.fillRect(mx, my + AU_CITY.BEACH_Y * sy, mw, mh - AU_CITY.BEACH_Y * sy);
    var m = AU_MISSIONS.current(S);
    if (m && S.state === 'play') {
      var t = m.target(S);
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath(); ctx.arc(mx + t.x * sx, my + t.y * sy, 5, 0, Math.PI * 2); ctx.fill();
    }
    S.policeCars.forEach(function (c) {
      ctx.fillStyle = '#5a8cff';
      ctx.beginPath(); ctx.arc(mx + c.x * sx, my + c.y * sy, 3.5, 0, Math.PI * 2); ctx.fill();
    });
    S.enemies.forEach(function (e) {
      ctx.fillStyle = '#ff5a4e';
      ctx.beginPath(); ctx.arc(mx + e.x * sx, my + e.y * sy, 3.5, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = '#7dd93d';
    ctx.save(); ctx.translate(mx + S.player.x * sx, my + S.player.y * sy);
    ctx.rotate(S.player.angle); ctx.beginPath();
    ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'left';
    ctx.fillText('PORT AURELIA', mx, my + mh + 20);
  }

  function drawHUD(S, ctx) {
    var p = S.player, m = AU_MISSIONS.current(S);
    // Top-left: wanted stars + cash.
    ctx.fillStyle = 'rgba(8,12,18,.7)';
    roundRect(ctx, 12, 12, 250, 64, 8); ctx.fill();
    for (var i = 0; i < 5; i++) star(34 + i * 26, 34, 10, i < S.wanted, ctx);
    ctx.fillStyle = '#7dd93d'; ctx.font = 'bold 20px Arial'; ctx.textAlign = 'left';
    ctx.fillText('$' + S.cash, 24, 64);
    // Objective bar (top centre).
    if (m) {
      ctx.font = 'bold 15px Arial';
      var w = ctx.measureText(m.title + ' — ' + m.brief).width + 36;
      ctx.fillStyle = 'rgba(8,12,18,.7)';
      roundRect(ctx, (VW - w) / 2, 12, w, 34, 8); ctx.fill();
      ctx.fillStyle = '#ffd24a'; ctx.textAlign = 'center';
      ctx.fillText(m.title + '  ·  ' + m.brief, VW / 2, 34);
    }
    // Health bar (bottom-left).
    ctx.fillStyle = 'rgba(8,12,18,.7)';
    roundRect(ctx, 12, VH - 52, 220, 40, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'left';
    ctx.fillText('HEALTH', 22, VH - 34);
    ctx.fillStyle = '#333'; ctx.fillRect(22, VH - 28, 200, 12);
    ctx.fillStyle = p.health > 40 ? '#7dd93d' : '#ff5a4e';
    ctx.fillRect(22, VH - 28, 200 * Math.max(0, p.health) / 100, 12);
    // Speed (bottom-right, when driving).
    if (p.inCar && p.car) {
      var kmh = Math.round(Math.abs(p.car.speed) * 0.36);
      ctx.fillStyle = 'rgba(8,12,18,.7)';
      roundRect(ctx, VW - 132, VH - 52, 120, 40, 8); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'right';
      ctx.fillText(kmh + ' km/h', VW - 24, VH - 24);
    }
    // Context prompt pill (only one at a time; hides the controls hint).
    var prompt = S.promptText;
    if (prompt) {
      ctx.font = 'bold 15px Arial';
      var pw = ctx.measureText(prompt).width + 32;
      ctx.fillStyle = 'rgba(8,12,18,.82)';
      roundRect(ctx, (VW - pw) / 2, VH - 92, pw, 34, 17); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      ctx.fillText(prompt, VW / 2, VH - 70);
    } else if (S.state === 'play') {
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '13px Arial'; ctx.textAlign = 'center';
      ctx.fillText('WASD move · Mouse aim · Click shoot · E enter/exit car · Shift run · P pause · M mute', VW / 2, VH - 14);
    }
    drawMinimap(S, ctx);
    // Dialogue box.
    if (S.dialogue.length > 0) {
      ctx.fillStyle = 'rgba(8,12,18,.85)';
      roundRect(ctx, 200, VH - 170, VW - 400, 64, 10); ctx.fill();
      ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#ffd24a'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'left';
      ctx.fillText(S.dialogue[0].split(':')[0] + ':', 220, VH - 146);
      ctx.fillStyle = '#fff'; ctx.font = '15px Arial';
      ctx.fillText(S.dialogue[0].split(':').slice(1).join(':').trim(), 220, VH - 122);
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = '12px Arial'; ctx.textAlign = 'right';
      ctx.fillText('Enter / Click to continue', VW - 220, VH - 122);
    }
    // Toasts.
    ctx.textAlign = 'center';
    S.toasts.forEach(function (t, i) {
      ctx.globalAlpha = Math.min(1, t.life / 0.6);
      ctx.fillStyle = 'rgba(8,12,18,.85)';
      var tw = ctx.measureText(t.text).width + 32;
      roundRect(ctx, (VW - tw) / 2, 96 + i * 38, tw, 30, 8); ctx.fill();
      ctx.fillStyle = t.color || '#fff'; ctx.font = 'bold 14px Arial';
      ctx.fillText(t.text, VW / 2, 96 + i * 38 + 20);
      ctx.globalAlpha = 1;
    });
  }

  function menuButton(ctx, x, y, w, h, label, hover) {
    ctx.fillStyle = hover ? '#ffd24a' : 'rgba(255,255,255,.14)';
    roundRect(ctx, x, y, w, h, 8); ctx.fill();
    ctx.strokeStyle = hover ? '#000' : 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = hover ? '#000' : '#fff'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, y + h / 2 + 6);
    return { x: x, y: y, w: w, h: h, label: label };
  }

  function drawTitle(S, ctx) {
    ctx.fillStyle = '#0e1a24'; ctx.fillRect(0, 0, VW, VH);
    // Sun-soaked skyline silhouette.
    var grad = ctx.createLinearGradient(0, 0, 0, VH);
    grad.addColorStop(0, '#ff9a3d'); grad.addColorStop(0.55, '#c65a7a'); grad.addColorStop(1, '#1c2f4a');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, VW, 430);
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath(); ctx.arc(1020, 120, 58, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#141c2a';
    var skyline = [90, 150, 110, 190, 130, 170, 210, 120, 160, 200, 140, 180, 100];
    var bx = 0;
    skyline.forEach(function (h) { ctx.fillRect(bx, 430 - h, 100, h); bx += 100; });
    ctx.fillStyle = '#1c2f4a'; ctx.fillRect(0, 430, VW, 370);
    ctx.fillStyle = '#ffd24a'; ctx.font = 'bold 84px Arial'; ctx.textAlign = 'center';
    ctx.fillText('PORT AURELIA', VW / 2, 250);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 24px Arial';
    ctx.fillText('An open-world crime story on the Aurelia coast', VW / 2, 300);
    ctx.font = '16px Arial'; ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.fillText('Steal cars · Outrun the Aurelia PD · Run five missions · Take the Marina', VW / 2, 336);
    var mx = AU_INPUT.mouse.x, my = AU_INPUT.mouse.y;
    var btns = [];
    btns.push(menuButton(ctx, VW / 2 - 130, 480, 260, 52, S.hasSave ? 'CONTINUE' : 'NEW GAME',
      mx > VW / 2 - 130 && mx < VW / 2 + 130 && my > 480 && my < 532));
    btns.push(menuButton(ctx, VW / 2 - 130, 548, 260, 52, 'HOW TO PLAY',
      mx > VW / 2 - 130 && mx < VW / 2 + 130 && my > 548 && my < 600));
    S.menuButtons = btns;
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = '14px Arial';
    ctx.fillText('WASD move · Mouse aim · Click shoot · E enter/exit car · Shift run · P pause', VW / 2, 650);
    ctx.fillText('An original game. No real city, no borrowed characters, no licensed music.', VW / 2, 676);
    if (S.showHelp) {
      ctx.fillStyle = 'rgba(8,12,18,.92)';
      roundRect(ctx, 240, 180, VW - 480, 440, 12); ctx.fill();
      ctx.strokeStyle = '#ffd24a'; ctx.stroke();
      ctx.fillStyle = '#ffd24a'; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center';
      ctx.fillText('HOW TO PLAY', VW / 2, 230);
      ctx.fillStyle = '#fff'; ctx.font = '16px Arial'; ctx.textAlign = 'left';
      var lines = ['Move on foot with WASD or arrow keys. Hold Shift to run.',
        'Aim with the mouse, click to shoot. Your wanted level rises when',
        'you steal cars or fire in public — the Aurelia PD responds.',
        'Walk up to a car and press E to steal it. Press E again to get out.',
        'Follow the yellow marker: each mission ends when you reach it or',
        'defeat everyone guarding it. Finish all five to take the Marina.',
        'P pauses (save / load there). M mutes the sound. Progress saves',
        'automatically when a mission is completed.'];
      lines.forEach(function (l, i) { ctx.fillText(l, 280, 280 + i * 30); });
      ctx.fillStyle = '#ffd24a'; ctx.textAlign = 'center';
      ctx.fillText('Click anywhere to close', VW / 2, 590);
    }
  }

  function drawPause(S, ctx) {
    ctx.fillStyle = 'rgba(5,8,12,.72)'; ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = '#ffd24a'; ctx.font = 'bold 44px Arial'; ctx.textAlign = 'center';
    ctx.fillText('PAUSED', VW / 2, 200);
    var mx = AU_INPUT.mouse.x, my = AU_INPUT.mouse.y;
    var defs = [['RESUME', 260], ['SAVE GAME', 330], ['LOAD GAME', 400], ['RESTART STORY', 470], ['BACK TO TITLE', 540]];
    S.menuButtons = defs.map(function (d) {
      return menuButton(ctx, VW / 2 - 130, d[1], 260, 52, d[0],
        mx > VW / 2 - 130 && mx < VW / 2 + 130 && my > d[1] && my < d[1] + 52);
    });
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = '14px Arial';
    ctx.fillText('Mission ' + (S.missionIndex + 1) + ' of 5 · $' + S.cash + ' · Wanted ' + S.wanted, VW / 2, 640);
  }

  function drawWon(S, ctx) {
    ctx.fillStyle = 'rgba(5,8,12,.82)'; ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = '#ffd24a'; ctx.font = 'bold 56px Arial'; ctx.textAlign = 'center';
    ctx.fillText('KING OF THE MARINA', VW / 2, 300);
    ctx.fillStyle = '#fff'; ctx.font = '22px Arial';
    ctx.fillText('Vex is finished. Port Aurelia is yours, Mara.', VW / 2, 350);
    ctx.fillText('Final take: $' + S.cash, VW / 2, 390);
    var mx = AU_INPUT.mouse.x, my = AU_INPUT.mouse.y;
    S.menuButtons = [menuButton(ctx, VW / 2 - 130, 460, 260, 52, 'PLAY AGAIN',
      mx > VW / 2 - 130 && mx < VW / 2 + 130 && my > 460 && my < 512)];
  }

  function render(S, ctx) {
    ctx.clearRect(0, 0, VW, VH);
    if (S.state === 'title') { drawTitle(S, ctx); return; }
    drawWorld(S, ctx);
    if (S.state === 'play' || S.state === 'pause' || S.state === 'won') drawHUD(S, ctx);
    if (S.state === 'pause') drawPause(S, ctx);
    if (S.state === 'won') drawWon(S, ctx);
  }

  return { render: render, VW: VW, VH: VH, drawCar: drawCar };
})();
