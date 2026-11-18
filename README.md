# Port Aurelia — Open-World Crime Game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/C-kamei/makefun-gta6-openworld/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/C-kamei/makefun-gta6-openworld/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original top-down 2D open-world crime game set in **Port Aurelia**, a fictional
sun-soaked coastal city. You play Mara Voss, an ex-courier in debt to the fixer
Rook. Steal cars, outrun the Aurelia PD, and run five story missions — from a
dockside pickup to a bank job to a final showdown with Vex at the Marina.

## Play

Serve `game/` with any static server (for example `node serve.ts`) and open
`http://localhost:8080`. The game runs entirely offline: pure HTML/CSS/JS, no
libraries, no network requests, synthesized WebAudio sound.

## Controls

- **WASD / arrows** — move on foot, drive when in a car
- **Shift** — run
- **Mouse** — aim · **Click** — shoot
- **E** — steal / exit a car
- **P / Esc** — pause (save / load / restart)
- **M** — mute

## Features

- A city to explore on foot and by car, with traffic, pedestrians and parked cars
- Car theft, a 0–5 wanted level, police cruisers and foot officers who chase and arrest
- Five story missions with dialogue, objectives and a minimap marker
- Combat, health, cash and progression; save/load via localStorage
- HUD with minimap, wanted stars, health, cash and speed; start screen and pause menu
- Synthesized sound effects, engine hum and sirens — no audio files

## Structure

- `game/src/audio.js` — synthesized WebAudio effects and engine/siren loops
- `game/src/input.js` — keyboard + mouse state
- `game/src/city.js` — the city: roads, buildings, beach, landmarks
- `game/src/entities.js` — player, traffic, pedestrians, police, rivals, bullets
- `game/src/missions.js` — the five story missions
- `game/src/render.js` — canvas drawing, HUD, minimap, menus
- `game/src/shots.js` — deterministic `?shot=` scenes for screenshots
- `game/src/main.js` — game state, loop, controls, camera, save/load

---

Built for the [make.fun GTA 6 bounty](https://make.fun/?ref=fk5m5avs).
