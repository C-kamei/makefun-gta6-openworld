// Solmar Bay — the renderer: one canvas, two jobs. It paints the world
// (ground, roads, buildings, cars, people, bullets, particles) through a
// camera that follows the player, then the HUD (cash, wanted stars, health,
// objective, minimap, prompts, dialogue) and the menus in screen space.

import {
  BEACH_Y, CAR, FONT, FONT_DISPLAY, H_ROADS, PALETTE, ROAD_W, V_ROADS, WATER_Y, WORLD,
} from './config.js';
import { isOnRoad, LANDMARKS } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_MISSIONS = 'missions';
export const SCREEN_STORY = 'story';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let viewW = 1280;
  let viewH = 800;
  let scale = 1;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    viewW = Math.max(320, rect.width);
    viewH = Math.max(240, rect.height);
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = Math.min(viewW / 1280, viewH / 800);
  }
  resize();
  window.addEventListener('resize', resize);

  /** Camera: centred on the player, clamped so it never leaves the city. */
  function cameraFor(target) {
    const w = viewW / scale;
    const h = viewH / scale;
    return {
      x: Math.max(0, Math.min(WORLD.width - w, target.x - w / 2)),
      y: Math.max(0, Math.min(WORLD.height - h, target.y - h / 2)),
      zoom: scale,
    };
  }

  function worldToScreen(camera, x, y) {
    return { x: (x - camera.x) * camera.zoom, y: (y - camera.y) * camera.zoom };
  }

  function drawGround(camera) {
    const s = camera.zoom;
    const x0 = camera.x;
    const y0 = camera.y;
    const x1 = camera.x + viewW / s;
    const y1 = camera.y + viewH / s;
    // Grass base.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, viewW, viewH);
    // Beach and water at the bottom of the city.
    if (y1 > BEACH_Y) {
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(0, (BEACH_Y - y0) * s, viewW, (Math.min(y1, WATER_Y) - BEACH_Y) * s);
    }
    if (y1 > WATER_Y) {
      ctx.fillStyle = PALETTE.water;
      ctx.fillRect(0, (WATER_Y - y0) * s, viewW, (y1 - WATER_Y) * s);
      ctx.fillStyle = PALETTE.waterDeep;
      for (let wx = 0; wx < 8; wx += 1) {
        const wy = WATER_Y + 18 + wx * 9;
        if (wy < y1) ctx.fillRect(((wx * 397) % 3200 - x0) * s, (wy - y0) * s, 90 * s, 3 * s);
      }
    }
    // (Parks are painted with the roads, below.)
  }

  function drawRoads(camera, game) {
    const s = camera.zoom;
    const x0 = camera.x;
    const y0 = camera.y;
    // Sidewalk halo around every road, then the asphalt.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const cx of V_ROADS) ctx.fillRect((cx - ROAD_W / 2 - 16 - x0) * s, 0, (ROAD_W + 32) * s, viewH);
    for (const cy of H_ROADS) ctx.fillRect(0, (cy - ROAD_W / 2 - 16 - y0) * s, viewW, (ROAD_W + 32) * s);
    ctx.fillStyle = PALETTE.road;
    for (const cx of V_ROADS) ctx.fillRect((cx - ROAD_W / 2 - x0) * s, 0, ROAD_W * s, viewH);
    for (const cy of H_ROADS) ctx.fillRect(0, (cy - ROAD_W / 2 - y0) * s, viewW, ROAD_W * s);
    // Centre dashes.
    ctx.fillStyle = PALETTE.lane;
    const dash = 26;
    const gap = 30;
    for (const cx of V_ROADS) {
      const sx = (cx - x0) * s;
      if (sx < -4 || sx > viewW + 4) continue;
      for (let y = -((y0 % (dash + gap)) + dash + gap); y < viewH + dash; y += dash + gap) {
        ctx.fillRect(sx - 2 * s, y, 4 * s, dash * s);
      }
    }
    for (const cy of H_ROADS) {
      const sy = (cy - y0) * s;
      if (sy < -4 || sy > viewH + 4) continue;
      for (let x = -((x0 % (dash + gap)) + dash + gap); x < viewW + dash; x += dash + gap) {
        ctx.fillRect(x, sy - 2 * s, dash * s, 4 * s);
      }
    }
    // Parks over the grass.
    for (const park of game.city.parks) {
      ctx.fillStyle = PALETTE.grassDark;
      ctx.fillRect((park.x - x0) * s, (park.y - y0) * s, park.w * s, park.h * s);
    }
  }

  function drawBuildings(camera, game) {
    const s = camera.zoom;
    const x0 = camera.x;
    const y0 = camera.y;
    for (const b of game.city.buildings) {
      const sx = (b.x - x0) * s;
      const sy = (b.y - y0) * s;
      if (sx > viewW || sy > viewH || sx + b.w * s < 0 || sy + b.h * s < 0) continue;
      // Drop shadow, then the walls, then the roof.
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(sx + 6 * s, sy + 8 * s, b.w * s, b.h * s);
      ctx.fillStyle = PALETTE.buildingWall;
      ctx.fillRect(sx, sy, b.w * s, b.h * s);
      ctx.fillStyle = b.color;
      ctx.globalAlpha = b.shade;
      ctx.fillRect(sx + 4 * s, sy + 4 * s, (b.w - 8) * s, (b.h - 8) * s);
      ctx.globalAlpha = 1;
      if (b.roof) {
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(sx + 12 * s, sy + 12 * s, (b.w - 24) * s, (b.h - 24) * s);
      }
      if (b.label) {
        ctx.fillStyle = 'rgba(12,18,28,0.75)';
        ctx.fillRect(sx, sy - 18 * s, (b.w) * s, 16 * s);
        ctx.fillStyle = '#f4f1e8';
        ctx.font = `bold ${Math.max(9, 11 * s)}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(LANDMARKS[b.label]?.name ?? b.label, sx + (b.w / 2) * s, sy - 6 * s);
      }
    }
    // Palm trees: a trunk dot and a green crown.
    for (const t of game.city.trees) {
      const p = worldToScreen(camera, t.x, t.y);
      if (p.x < -20 || p.x > viewW + 20 || p.y < -20 || p.y > viewH + 20) continue;
      ctx.fillStyle = '#8a6d3b';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.parkTree;
      ctx.beginPath();
      ctx.arc(p.x, p.y, t.r * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.parkTreeLight;
      ctx.beginPath();
      ctx.arc(p.x - 3 * s, p.y - 3 * s, t.r * 0.55 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCarShape(car, isPlayer) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const len = CAR.length;
    const wid = CAR.width;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-len / 2 + 4, -wid / 2 + 5, len, wid);
    ctx.fillStyle = car.color;
    roundRect(-len / 2, -wid / 2, len, wid, 8);
    ctx.fill();
    // Windshield, roof, headlights.
    ctx.fillStyle = 'rgba(20,30,44,0.85)';
    ctx.fillRect(len * 0.08, -wid / 2 + 4, len * 0.22, wid - 8);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(-len * 0.28, -wid / 2 + 4, len * 0.3, wid - 8);
    ctx.fillStyle = '#fff8c9';
    ctx.fillRect(len / 2 - 3, -wid / 2 + 3, 3, 6);
    ctx.fillRect(len / 2 - 3, wid / 2 - 9, 3, 6);
    if (car.kind === 'police') {
      const phase = Math.sin(car.sirenPhase || 0) > 0;
      ctx.fillStyle = phase ? PALETTE.policeLightRed : PALETTE.policeLightBlue;
      ctx.fillRect(-6, -wid / 2 - 2, 12, 5);
      ctx.fillStyle = '#f4f1e8';
      ctx.font = `bold 9px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', 0, 3);
    }
    if (car.kind === 'target') {
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 2;
      ctx.strokeRect(-len / 2 - 4, -wid / 2 - 4, len + 8, wid + 8);
    }
    if (isPlayer) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(-len / 2 - 2, -wid / 2 - 2, len + 4, wid + 4);
    }
    ctx.restore();
    // Smoke from a battered car.
    if (car.smoke > 0) {
      ctx.fillStyle = `rgba(120,120,120,${Math.min(0.6, car.smoke)})`;
      ctx.beginPath();
      ctx.arc(car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20, 8 + Math.random() * 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawPersonShape(x, y, angle, color, isPlayer, isCop) {
    ctx.save();
    ctx.translate(x, y);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 6, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body: a circle with a facing tick.
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 6, Math.sin(angle) * 6, 5, 0, Math.PI * 2);
    ctx.fill();
    if (isPlayer) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.stroke();
      // The pistol: a short barrel in the aim direction.
      ctx.strokeStyle = '#1d2126';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 12, Math.sin(angle) * 12);
      ctx.lineTo(Math.cos(angle) * 24, Math.sin(angle) * 24);
      ctx.stroke();
    }
    if (isCop) {
      ctx.fillStyle = '#1d3557';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd23f';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PD', 0, 3);
    }
    ctx.restore();
  }

  function drawMarker(camera, target, time, label) {
    if (!target) return;
    const p = worldToScreen(camera, target.x, target.y);
    const bob = Math.sin(time * 4) * 6;
    const onScreen = p.x > 30 && p.x < viewW - 30 && p.y > 30 && p.y < viewH - 30;
    if (onScreen) {
      ctx.save();
      ctx.translate(p.x, p.y + bob - 46);
      ctx.fillStyle = PALETTE.hudAccent;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-11, -16);
      ctx.lineTo(11, -16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1d2126';
      ctx.beginPath();
      ctx.arc(0, -22, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.hudAccent;
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', 0, -18);
      ctx.restore();
    } else {
      // Off-screen: an arrow at the screen edge pointing the way.
      const cx = Math.max(40, Math.min(viewW - 40, p.x));
      const cy = Math.max(40, Math.min(viewH - 40, p.y));
      const ang = Math.atan2(p.y - cy, p.x - cx);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.fillStyle = PALETTE.hudAccent;
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-8, -11);
      ctx.lineTo(-8, 11);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    if (label) {
      ctx.fillStyle = 'rgba(12,18,28,0.7)';
      ctx.font = `bold 12px ${FONT}`;
      const w = ctx.measureText(label).width + 16;
      ctx.fillRect(p.x - w / 2, p.y - 78 + bob, w, 20);
      ctx.fillStyle = '#f4f1e8';
      ctx.textAlign = 'center';
      ctx.fillText(label, p.x, p.y - 64 + bob);
    }
  }

  function drawWorld(game, camera, time) {
    drawGround(camera);
    drawRoads(camera, game);
    drawBuildings(camera, game);
    // The mission marker lives in screen space, so it goes before the
    // world transform below. Landmarks with their own building label
    // (hideout, warehouse, bank, hospital, garage) skip the marker's text
    // label so the two never print on top of each other.
    const obj = game.objective;
    if (obj && obj.target) {
      const noLabel = [LANDMARKS.hideout, LANDMARKS.warehouse, LANDMARKS.bank, LANDMARKS.hospital, LANDMARKS.garage];
      drawMarker(camera, obj.target, time, noLabel.includes(obj.target) ? null : obj.target.name);
    }
    const s = camera.zoom;
    ctx.save();
    ctx.translate(-camera.x * s, -camera.y * s);
    ctx.scale(s, s);
    // Parked and target cars.
    for (const car of game.parked) drawCarShape(car, false);
    if (game.targetCar && !game.targetCarTaken) drawCarShape(game.targetCar, false);
    // Traffic.
    for (const car of game.traffic) drawCarShape(car, false);
    // Police cruisers.
    for (const car of game.policeCars) drawCarShape(car, false);
    // The player's car, if they are driving.
    if (game.playerCar) drawCarShape(game.playerCar, true);
    // Pedestrians.
    for (const ped of game.peds) {
      const panicking = ped.panic > 0;
      drawPersonShape(ped.x, ped.y, ped.angle, panicking ? '#ff8a7a' : ped.color, false, false);
    }
    // Enemies.
    for (const e of game.enemies) {
      if (!e.alive) continue;
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#8c2f39';
      ctx.beginPath();
      ctx.arc(e.x, e.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1d2126';
      ctx.beginPath();
      ctx.arc(e.x + Math.cos(e.angle) * 6, e.y + Math.sin(e.angle) * 6, 5, 0, Math.PI * 2);
      ctx.fill();
      // Health bar.
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(e.x - 16, e.y - 26, 32, 5);
      ctx.fillStyle = '#ff5a4e';
      ctx.fillRect(e.x - 16, e.y - 26, 32 * Math.max(0, e.health / 100), 5);
    }
    // Cops on foot.
    for (const cop of game.cops) drawPersonShape(cop.x, cop.y, cop.angle, '#1d3557', false, true);
    // The player on foot.
    if (!game.playerCar) {
      drawPersonShape(game.player.x, game.player.y, game.player.aimAngle, PALETTE.player, true, false);
    }
    // Bullets.
    ctx.fillStyle = '#ffe98a';
    for (const b of game.bullets) {
      ctx.fillRect(b.x - 3, b.y - 1.5, 7, 3);
    }
    // Particles.
    for (const p of game.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawMinimap(game) {
    const mw = 200;
    const mh = 150;
    const mx = viewW - mw - 14;
    const my = 14;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    ctx.fillStyle = PALETTE.hudPanel;
    roundRect(mx - 6, my - 6, mw + 12, mh + 12, 8);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(mx, my, mw, mh);
    ctx.clip();
    ctx.fillStyle = '#5d8a4a';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect(mx, my + BEACH_Y * sy, mw, mh - BEACH_Y * sy);
    ctx.fillStyle = '#2f7fb8';
    ctx.fillRect(mx, my + WATER_Y * sy, mw, mh - WATER_Y * sy);
    ctx.strokeStyle = '#3a3f4a';
    ctx.lineWidth = 3;
    for (const cx of V_ROADS) {
      ctx.beginPath();
      ctx.moveTo(mx + cx * sx, my);
      ctx.lineTo(mx + cx * sx, my + mh);
      ctx.stroke();
    }
    for (const cy of H_ROADS) {
      ctx.beginPath();
      ctx.moveTo(mx, my + cy * sy);
      ctx.lineTo(mx + mw, my + cy * sy);
      ctx.stroke();
    }
    // Buildings as faint blocks.
    ctx.fillStyle = 'rgba(40,40,48,0.55)';
    for (const b of game.city.buildings) ctx.fillRect(mx + b.x * sx, my + b.y * sy, Math.max(1, b.w * sx), Math.max(1, b.h * sy));
    // Mission marker.
    const obj = game.objective;
    if (obj && obj.target) {
      const pulse = 3 + Math.sin(performance.now() / 200) * 1.5;
      ctx.fillStyle = PALETTE.hudAccent;
      ctx.beginPath();
      ctx.arc(mx + obj.target.x * sx, my + obj.target.y * sy, pulse + 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police as red dots, player as a white arrow.
    ctx.fillStyle = '#ff3b30';
    for (const car of game.policeCars) {
      ctx.beginPath();
      ctx.arc(mx + car.x * sx, my + car.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const cop of game.cops) {
      ctx.beginPath();
      ctx.arc(mx + cop.x * sx, my + cop.y * sy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const px = mx + game.player.x * sx;
    const py = my + game.player.y * sy;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(game.playerCar ? game.playerCar.angle : game.player.aimAngle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `bold 11px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('SOLMAR BAY', mx, my + mh + 18);
  }

  function drawHud(game) {
    // Top-left: cash, wanted stars, health.
    ctx.fillStyle = PALETTE.hudPanel;
    roundRect(14, 14, 240, 96, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.hudAccent;
    ctx.font = `bold 22px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(`$${game.cash.toLocaleString('en-US')}`, 28, 42);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `13px ${FONT}`;
    ctx.fillText(game.playerName, 28, 62);
    // Wanted stars.
    const stars = game.wanted.level;
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < stars ? PALETTE.hudAccent : 'rgba(255,255,255,0.25)';
      const cx = 30 + i * 26;
      const cy = 88;
      drawStar(cx, cy, 11);
    }
    // Health bar under the panel.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(14, 120, 240, 14, 7);
    ctx.fill();
    ctx.fillStyle = game.player.health > 30 ? '#7ee081' : '#ff5a4e';
    roundRect(14, 120, 240 * Math.max(0, game.player.health / 100), 14, 7);
    ctx.fill();
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `bold 11px ${FONT}`;
    ctx.fillText(`HEALTH ${Math.ceil(game.player.health)}`, 22, 131);
    drawMinimap(game);
    // Objective bar at the bottom.
    const objText = game.objectiveLabel;
    ctx.fillStyle = PALETTE.hudPanel;
    const ow = Math.min(viewW - 28, ctx.measureText(objText).width + 200);
    roundRect((viewW - ow) / 2, viewH - 52, ow, 38, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.objective;
    ctx.font = `bold 14px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(objText, viewW / 2, viewH - 28);
    // Speed when driving.
    if (game.playerCar) {
      ctx.fillStyle = PALETTE.hudPanel;
      roundRect(viewW - 130, viewH - 110, 116, 48, 10);
      ctx.fill();
      ctx.fillStyle = PALETTE.hudText;
      ctx.font = `bold 22px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(Math.abs(game.playerCar.speed) * 0.24)}`, viewW - 44, viewH - 78);
      ctx.font = '11px sans-serif';
      ctx.fillText('km/h', viewW - 24, viewH - 78);
    }
    // Context prompt.
    if (game.prompt) {
      ctx.fillStyle = PALETTE.hudPanel;
      const pw = ctx.measureText(game.prompt).width + 28;
      roundRect((viewW - pw) / 2, viewH - 108, pw, 30, 8);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 14px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(game.prompt, viewW / 2, viewH - 88);
    }
    // Toast (saved / mission complete).
    if (game.toast && game.toastTime > 0) {
      ctx.globalAlpha = Math.min(1, game.toastTime);
      ctx.fillStyle = PALETTE.hudPanel;
      const tw = ctx.measureText(game.toast).width + 32;
      roundRect((viewW - tw) / 2, 130, tw, 34, 9);
      ctx.fill();
      ctx.fillStyle = PALETTE.hudAccent;
      ctx.font = `bold 15px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(game.toast, viewW / 2, 152);
      ctx.globalAlpha = 1;
    }
    // Controls hint, bottom-left — hidden while a prompt pill is showing
    // so the two never print over each other.
    if (!game.prompt) {
      ctx.fillStyle = 'rgba(12,18,28,0.55)';
      ctx.font = `12px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText('WASD move/drive · E enter car / interact · Mouse aim, click shoot · Esc pause · Q save · M mute', 16, viewH - 64);
    }
  }

  function drawStar(cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? r : r * 0.45;
      const x = cx + Math.cos(ang) * rad;
      const y = cy + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawDialogue(game) {
    const lines = game.dialogue;
    if (!lines || lines.length === 0) return;
    const line = lines[game.dialogueIndex];
    const boxH = 92;
    ctx.fillStyle = 'rgba(10,14,22,0.88)';
    roundRect(60, viewH - boxH - 70, viewW - 120, boxH, 12);
    ctx.fill();
    ctx.strokeStyle = PALETTE.hudAccent;
    ctx.lineWidth = 2;
    roundRect(60, viewH - boxH - 70, viewW - 120, boxH, 12);
    ctx.stroke();
    ctx.fillStyle = PALETTE.hudAccent;
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = 'left';
    const speaker = line.split(':')[0];
    ctx.fillText(speaker, 84, viewH - boxH - 44);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `16px ${FONT}`;
    wrapText(line.slice(speaker.length + 1).trim(), 84, viewH - boxH - 20, viewW - 168, 22);
    ctx.fillStyle = 'rgba(244,241,232,0.6)';
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText('E / click to continue', viewW - 84, viewH - 84);
  }

  function wrapText(text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let cy = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, cy);
        line = word;
        cy += lineHeight;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, x, cy);
  }

  function drawTitle(game) {
    // A drifting view of the city behind the menu.
    const drift = { x: 1600 + Math.sin(performance.now() / 9000) * 500, y: 1200 + Math.cos(performance.now() / 11000) * 350 };
    const camera = cameraFor(drift);
    drawWorld({ ...game, objective: null, prompt: null, toast: null }, camera, performance.now() / 1000);
    ctx.fillStyle = 'rgba(8, 14, 26, 0.55)';
    ctx.fillRect(0, 0, viewW, viewH);
    // Sun.
    const sunX = viewW * 0.78;
    const sunY = viewH * 0.2;
    const grad = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 180);
    grad.addColorStop(0, 'rgba(255, 214, 90, 0.95)');
    grad.addColorStop(0.4, 'rgba(255, 170, 60, 0.45)');
    grad.addColorStop(1, 'rgba(255, 170, 60, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(sunX - 180, sunY - 180, 360, 360);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.font = `bold ${Math.round(84 * Math.min(1.2, scale + 0.2))}px ${FONT_DISPLAY}`;
    ctx.fillText('SOLMAR BAY', viewW / 2, viewH * 0.3);
    ctx.fillStyle = '#f4f1e8';
    ctx.font = `bold 22px ${FONT_DISPLAY}`;
    ctx.fillText('AN OPEN-WORLD CRIME STORY', viewW / 2, viewH * 0.3 + 44);
    ctx.font = `15px ${FONT}`;
    ctx.fillStyle = 'rgba(244,241,232,0.85)';
    ctx.fillText('Steal cars. Outrun the law. Run five missions for Mara\'s crew.', viewW / 2, viewH * 0.3 + 78);
    // Menu.
    const items = [
      { key: '1', label: 'New Game', active: true },
      { key: '2', label: game.hasSave ? 'Continue — $' + game.cash.toLocaleString('en-US') + ' · Mission ' + (game.missions.index + 1) : 'Continue (no save yet)', active: game.hasSave },
      { key: '3', label: 'How to Play', active: true },
    ];
    const menuY = viewH * 0.52;
    items.forEach((item, i) => {
      const y = menuY + i * 52;
      const selected = game.menuIndex === i;
      if (selected) {
        ctx.fillStyle = 'rgba(255, 210, 63, 0.18)';
        roundRect(viewW / 2 - 220, y - 30, 440, 42, 10);
        ctx.fill();
        ctx.strokeStyle = PALETTE.hudAccent;
        ctx.lineWidth = 2;
        roundRect(viewW / 2 - 220, y - 30, 440, 42, 10);
        ctx.stroke();
      }
      ctx.fillStyle = item.active ? '#f4f1e8' : 'rgba(244,241,232,0.4)';
      ctx.font = `bold 20px ${FONT}`;
      ctx.fillText(`${item.key}  ${item.label}`, viewW / 2, y);
    });
    ctx.font = `13px ${FONT}`;
    ctx.fillStyle = 'rgba(244,241,232,0.7)';
    ctx.fillText('WASD move / drive · E enter & steal cars · Mouse aim, click to shoot · Esc pause · Q quick-save', viewW / 2, viewH - 48);
    ctx.fillText('A fully original game — its own city, crew and story. No network, no downloads.', viewW / 2, viewH - 26);
    if (game.showHelp) {
      ctx.fillStyle = 'rgba(8, 14, 26, 0.9)';
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.fillStyle = '#f4f1e8';
      ctx.font = `bold 28px ${FONT_DISPLAY}`;
      ctx.fillText('HOW TO PLAY', viewW / 2, viewH * 0.2);
      ctx.font = `16px ${FONT}`;
      ctx.textAlign = 'left';
      const help = [
        'You are Danny Cole, a courier pulled into Mara\'s crew in Solmar Bay.',
        '',
        'ON FOOT — WASD to walk (Shift to run). Aim with the mouse, click to shoot.',
        'DRIVING — Walk up to any car and press E to get in (stealing one raises',
        'your wanted level). W accelerates, S brakes / reverses, A and D steer.',
        'Press E again to get out.',
        '',
        'WANTED — Stars rise when you steal, shoot or hit people. Police cruisers',
        'chase and ram you; officers on foot will try to arrest you. Lay low and',
        'the heat fades. Get busted or shot and you wake up at Solmar General.',
        '',
        'MISSIONS — Follow the yellow marker on the map. Finish all five to take',
        'the city. Your progress, cash and position save with Q (or from pause).',
        '',
        'Press E, click, or Esc to close this help.',
      ];
      help.forEach((line, i) => ctx.fillText(line, viewW / 2 - 320, viewH * 0.26 + i * 26));
    }
  }

  function drawPaused(game) {
    ctx.fillStyle = 'rgba(8, 14, 26, 0.72)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.font = `bold 48px ${FONT_DISPLAY}`;
    ctx.fillText('PAUSED', viewW / 2, viewH * 0.3);
    ctx.fillStyle = '#f4f1e8';
    ctx.font = '19px sans-serif';
    const items = ['1  Resume', '2  Save game (Q)', '3  Missions', '4  Quit to title'];
    items.forEach((label, i) => {
      const y = viewH * 0.42 + i * 44;
      if (game.menuIndex === i) {
        ctx.fillStyle = 'rgba(255, 210, 63, 0.18)';
        roundRect(viewW / 2 - 180, y - 26, 360, 36, 9);
        ctx.fill();
      }
      ctx.fillStyle = '#f4f1e8';
      ctx.fillText(label, viewW / 2, y);
    });
    ctx.font = '14px sans-serif';
    ctx.fillStyle = 'rgba(244,241,232,0.7)';
    ctx.fillText('Esc resumes · M toggles sound', viewW / 2, viewH * 0.42 + items.length * 44 + 20);
  }

  function drawEndScreen(title, subtitle, accent) {
    ctx.fillStyle = 'rgba(8, 14, 26, 0.78)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = `bold 64px ${FONT_DISPLAY}`;
    ctx.fillText(title, viewW / 2, viewH * 0.38);
    ctx.fillStyle = '#f4f1e8';
    ctx.font = '20px sans-serif';
    ctx.fillText(subtitle, viewW / 2, viewH * 0.38 + 44);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = 'rgba(244,241,232,0.75)';
    ctx.fillText('Press Enter or click to continue', viewW / 2, viewH * 0.38 + 92);
  }

  function drawMissions(game) {
    ctx.fillStyle = 'rgba(8, 14, 26, 0.82)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.font = `bold 34px ${FONT_DISPLAY}`;
    ctx.fillText('MARA\'S CREW — MISSIONS', viewW / 2, viewH * 0.16);
    ctx.font = '17px sans-serif';
    MISSIONS_LIST.forEach((m, i) => {
      const y = viewH * 0.24 + i * 62;
      const done = i < game.missions.index || game.missions.storyDone;
      const current = i === game.missions.index && !game.missions.storyDone;
      ctx.fillStyle = current ? 'rgba(255, 210, 63, 0.16)' : 'rgba(255,255,255,0.04)';
      roundRect(viewW / 2 - 330, y - 24, 660, 50, 10);
      ctx.fill();
      ctx.fillStyle = done ? '#7ee081' : current ? '#ffd23f' : 'rgba(244,241,232,0.55)';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${done ? '✓' : current ? '▶' : '·'}  ${i + 1}. ${m.title}`, viewW / 2 - 310, y + 6);
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(244,241,232,0.7)';
      ctx.font = '15px sans-serif';
      ctx.fillText(`$${m.reward.toLocaleString('en-US')}`, viewW / 2 + 310, y + 6);
    });
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(244,241,232,0.75)';
    ctx.font = '15px sans-serif';
    ctx.fillText('Cash: $' + game.cash.toLocaleString('en-US') + '   ·   Esc / Tab to close', viewW / 2, viewH * 0.24 + MISSIONS_LIST.length * 62 + 20);
  }

  return {
    get viewW() { return viewW; },
    get viewH() { return viewH; },
    cameraFor,
    worldToScreen,
    draw(game, screen, time) {
      ctx.clearRect(0, 0, viewW, viewH);
      if (screen === SCREEN_TITLE) {
        drawTitle(game);
        return;
      }
      const camera = cameraFor(game.playerCar || game.player);
      drawWorld(game, camera, time);
      if (screen === SCREEN_PLAY) {
        drawHud(game);
        drawDialogue(game);
      } else if (screen === SCREEN_PAUSED) {
        drawHud(game);
        drawPaused(game);
      } else if (screen === SCREEN_BUSTED) {
        drawEndScreen('BUSTED', 'The Solmar Bay PD caught up with you. You wake up at the hospital — lighter by $200.', '#7fb3ff');
      } else if (screen === SCREEN_WASTED) {
        drawEndScreen('WASTED', 'Danny is down. The crew drags him to Solmar General — minus $200.', '#ff5a4e');
      } else if (screen === SCREEN_MISSIONS) {
        drawHud(game);
        drawMissions(game);
      } else if (screen === SCREEN_STORY) {
        drawEndScreen('SOLMAR BAY IS YOURS', 'All five missions complete. The crew runs the city — free roam, Danny.', '#ffd23f');
      }
    },
  };
}

// The mission list the missions screen shows; kept here so the renderer
// never imports the mission logic.
const MISSIONS_LIST = [
  { title: 'First Delivery', reward: 500 },
  { title: 'Borrowed Wheels', reward: 1200 },
  { title: 'Hot Getaway', reward: 1500 },
  { title: 'Turf Defense', reward: 2000 },
  { title: 'The Marina Heist', reward: 5000 },
];
