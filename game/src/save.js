// Solmar Bay — save and load through localStorage. A save holds the
// player's money, story progress, position, health and wanted level; cars
// and traffic are rebuilt fresh, so a save is small and always loadable.

import { SAVE_KEY } from './config.js';

/** The shape of a save, written as one JSON object. */
export function buildSave(game) {
  return {
    version: 1,
    savedAt: Date.now(),
    cash: game.cash,
    missionIndex: game.missions.index,
    missionStep: game.missions.step,
    storyDone: game.missions.storyDone,
    player: {
      x: game.player.x,
      y: game.player.y,
      health: game.player.health,
    },
    wanted: game.wanted.level,
    stats: game.stats,
  };
}

export function saveGame(game) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(buildSave(game)));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage off: nothing to clear.
  }
}

/** A short "Saved 12:03" style stamp for the HUD toast. */
export function saveTimeLabel(data) {
  const date = new Date(data.savedAt);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
