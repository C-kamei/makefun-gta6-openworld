# Solmar Bay — An Open-World Crime Story

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/C-kamei/makefun-gta6-openworld/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/C-kamei/makefun-gta6-openworld/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A complete open-world crime game that runs in a desktop browser from its own
static files — no network, no build step, no downloads. You are **Danny
Cole**, a courier pulled into Mara's crew in **Solmar Bay**, a sun-soaked
coastal city of your own: drive its streets, steal cars, outrun the Solmar
Bay PD, and run five story missions from a first delivery to a five-star
marina heist.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

## What's in the city

- **Open world on foot and by car** — a 3200×2400 city with a road grid,
  parks, a beach promenade and the waterfront, all explorable.
- **Traffic and pedestrians** — cars follow the roads, people stroll the
  sidewalks and flee from gunfire.
- **Cars to steal and drive** — walk up to any car and press **E**. Stealing
  one raises your wanted level.
- **Wanted level 0–5** — police cruisers chase and ram you, officers on foot
  try to arrest you, and at high heat they shoot back. Lay low and the heat
  fades.
- **Five story missions** with dialogue, objectives and a minimap marker:
  First Delivery, Borrowed Wheels, Hot Getaway, Turf Defense, The Marina
  Heist.
- **Combat** — mouse aim, click to shoot, enemy gunmen who shoot back.
- **HUD with minimap**, cash, health, wanted stars and speed.
- **Start screen, pause menu, mission list, save/load** via localStorage
  (press **Q** to quick-save).
- **Synthesized sound** — engine hum, two-tone sirens, gunshots and a
  bassline, all made with WebAudio. No audio files.

## Controls

| Keys | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive the car |
| Shift | Run |
| Mouse + click | Aim and shoot |
| E | Enter / steal a car, get out, interact |
| Esc / P | Pause |
| Tab | Mission list |
| Q | Quick-save |
| M | Mute |

## Source layout

`game/src/` is split by job: `config.js` (tuning + palette), `city.js`
(city generation + collision), `entities.js` (traffic, pedestrians, car
physics), `police.js` (wanted level + chases), `missions.js` (story),
`combat.js` (shooting + enemies), `render.js` (canvas + HUD + menus),
`input.js`, `audio.js` (WebAudio synth), `save.js`, `shots.js`
(deterministic `?shot=` staging for screenshots), `main.js` (game loop).

## make.fun

Built for the [gta6-01 bounty on make.fun](https://make.fun/bounty/gta6-01).
Try make.fun yourself: https://make.fun/?ref=fk5m5avs
