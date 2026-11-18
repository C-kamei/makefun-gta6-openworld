// Solmar Bay — the story: five missions from Mara, the crew boss, each a
// short chain of objectives with dialogue. The manager only reads the game
// state and reports what the player must do next; main.js does the acting.

import { LANDMARKS } from './city.js';

/** One objective inside a mission. */
function objective(type, label, target, extra = {}) {
  return { type, label, target, ...extra };
}

/** The five missions, in story order. */
export const MISSIONS = [
  {
    id: 'm1',
    title: 'First Delivery',
    reward: 500,
    intro: [
      'MARA: Danny. You drive courier vans, right? Good. I need a package at Sunset Pier.',
      'MARA: Grab any car, get to the pier, and don\'t dawdle. The crew is watching.',
    ],
    steps: [
      objective('enter-car', 'Get in a car (walk up to one, press E)', null),
      objective('goto', 'Drive to Sunset Pier', LANDMARKS.pier),
      objective('deliver', 'Deliver the package (press E at the pier)', LANDMARKS.pier),
    ],
    complete: 'MARA: Clean run. You\'re in, Danny. $500, and the crew knows your name now.',
  },
  {
    id: 'm2',
    title: 'Borrowed Wheels',
    reward: 1200,
    intro: [
      'MARA: Rico needs a yellow coupe that\'s sitting at the marina. It\'s not his. Yet.',
      'MARA: Take it — press E by the car — and bring it to Rico\'s Chop Shop. Quick and quiet.',
    ],
    steps: [
      objective('goto', 'Go to the yellow coupe at Solmar Marina', LANDMARKS.marina),
      objective('steal-target', 'Steal the yellow coupe (press E)', LANDMARKS.marina),
      objective('deliver-car', 'Deliver the coupe to Rico\'s Chop Shop', LANDMARKS.garage),
    ],
    complete: 'RICO: Sweet ride, kid. Mara says you\'re alright. Here\'s $1,200.',
  },
  {
    id: 'm3',
    title: 'Hot Getaway',
    reward: 1500,
    intro: [
      'MARA: The marina job made the news. The cops are on you — three stars, Danny.',
      'MARA: Lose them. Get to the hideout and lay low until the heat dies down.',
    ],
    steps: [
      objective('wanted', 'The heat is on — reach the hideout with cops on your tail', LANDMARKS.hideout),
      objective('evade', 'Lay low at the hideout until your wanted level clears', LANDMARKS.hideout),
    ],
    complete: 'MARA: They lost you. That\'s how you survive in Solmar Bay. $1,500.',
  },
  {
    id: 'm4',
    title: 'Turf Defense',
    reward: 2000,
    intro: [
      'MARA: The Vipers are hitting our warehouse. Five of them, guns out.',
      'MARA: Get to the Harbor Warehouse and clear them out. Aim with the mouse, click to shoot.',
    ],
    steps: [
      objective('goto', 'Reach the Harbor Warehouse', LANDMARKS.warehouse),
      objective('kill', 'Clear out the Vipers', LANDMARKS.warehouse, { count: 5 }),
    ],
    complete: 'MARA: Warehouse is ours. The Vipers won\'t try that again. $2,000.',
  },
  {
    id: 'm5',
    title: 'The Marina Heist',
    reward: 5000,
    intro: [
      'MARA: The big one. Bay Trust Bank, midday. Grab the cash, then run.',
      'MARA: The whole city will be after you. Get the money to the hideout and we\'re rich.',
    ],
    steps: [
      objective('goto', 'Reach Bay Trust Bank', LANDMARKS.bank),
      objective('grab', 'Grab the cash (press E at the bank)', LANDMARKS.bank),
      objective('escape', 'Escape to the hideout with the cash — five stars!', LANDMARKS.hideout),
    ],
    complete: 'MARA: We did it, Danny. $5,000 is yours. Solmar Bay is ours now.',
  },
];

/** Mission progress: which mission, which step, and per-step counters. */
export function createMissionState() {
  return {
    index: 0,
    step: 0,
    kills: 0,
    started: false,
    done: false,
    storyDone: false,
  };
}

/** The mission currently in play, or null when the story is finished. */
export function currentMission(state) {
  if (state.storyDone || state.index >= MISSIONS.length) return null;
  return MISSIONS[state.index];
}

/** The objective the player is working on right now. */
export function currentObjective(state) {
  const mission = currentMission(state);
  if (!mission) return null;
  return mission.steps[Math.min(state.step, mission.steps.length - 1)];
}

/** Short label for the HUD: "Mission 2 — Borrowed Wheels: <objective>". */
export function objectiveLabel(state) {
  const mission = currentMission(state);
  if (!mission) return 'Free roam — Solmar Bay is yours. Press M for missions.';
  const obj = currentObjective(state);
  if (!obj) return mission.title;
  let label = obj.label;
  if (obj.type === 'kill') label += ` (${state.kills}/${obj.count})`;
  return `Mission ${state.index + 1} — ${mission.title}: ${label}`;
}

/** Advance to the next step (or the next mission) and say what happened. */
export function advanceMission(state) {
  const mission = currentMission(state);
  if (!mission) return { event: 'none' };
  state.step += 1;
  state.kills = 0;
  if (state.step >= mission.steps.length) {
    const reward = mission.reward;
    state.index += 1;
    state.step = 0;
    state.started = false;
    if (state.index >= MISSIONS.length) {
      state.storyDone = true;
      return { event: 'story-done', reward, line: mission.complete };
    }
    return { event: 'mission-done', reward, line: mission.complete, next: MISSIONS[state.index] };
  }
  return { event: 'step-done' };
}

/** Start the current mission: show its intro and reset its counters. */
export function startMission(state) {
  const mission = currentMission(state);
  if (!mission) return null;
  state.started = true;
  state.step = 0;
  state.kills = 0;
  return mission;
}

/** Reset the mission state after a bust or a death: same mission, from step 0. */
export function restartMission(state) {
  state.step = 0;
  state.kills = 0;
  state.started = false;
}
