// Solmar Bay — every tuning number and colour in one place.
// The world is a fixed 3200 x 2400 top-down city; the renderer scales the
// camera view to the window, so no rule below depends on the screen size.

export const STEP = 1 / 60; // fixed simulation step, seconds

export const WORLD = { width: 3200, height: 2400 };
export const ROAD_W = 96;
export const SIDEWALK = 18;

// Vertical road centre lines and horizontal road centre lines.
export const V_ROADS = [320, 820, 1320, 1820, 2320, 2820];
export const H_ROADS = [320, 760, 1200, 1640, 2040];
export const BEACH_Y = 2220; // sand starts here; water at the very bottom
export const WATER_Y = 2330;

export const PLAYER = {
  radius: 14,
  walkSpeed: 230,
  runSpeed: 330,
  health: 100,
  pistolDamage: 34,
  fireInterval: 0.22,
};

export const CAR = {
  length: 64,
  width: 32,
  accel: 520,
  brake: 900,
  reverseAccel: 320,
  maxSpeed: 560,
  maxReverse: 180,
  turnRate: 2.6,
  grip: 3.2,
};

export const TRAFFIC_COUNT = 26;
export const PED_COUNT = 42;

export const WANTED = {
  stealCar: 1,
  shootPed: 1,
  killPed: 2,
  shootCop: 2,
  hitPed: 1,
  decaySeconds: 26, // one star fades after this long with no crime and no police near
  max: 5,
};

export const POLICE = {
  maxCars: 4,
  carSpeed: 620,
  copRunSpeed: 265,
  arrestSeconds: 0.9, // a cop touching the player this long busts them
  shootFromLevel: 4,
};

export const SAVE_KEY = 'solmar-bay.save.v1';

export const PALETTE = {
  grass: '#7fae62',
  grassDark: '#6d9c54',
  sand: '#e8d29a',
  water: '#2f7fb8',
  waterDeep: '#256a9e',
  road: '#3a3f4a',
  roadEdge: '#2e323c',
  lane: '#e8d44d',
  sidewalk: '#b9b3a4',
  buildingRoof: ['#c96f4a', '#d9a05b', '#7fb3a8', '#e0cfa8', '#b56576', '#8d99ae', '#e07a5f', '#81b29a'],
  buildingWall: '#5d5a52',
  parkTree: '#3e7d44',
  parkTreeLight: '#57a05a',
  carColors: ['#d64545', '#3f6fb5', '#e8c33c', '#e8e8e8', '#2b2b2b', '#7fb069', '#c77dff', '#f4845f', '#4ecdc4'],
  player: '#ffcf3f',
  playerShirt: '#2e6fb0',
  policeCar: '#1d3557',
  policeLightRed: '#ff2e2e',
  policeLightBlue: '#2e7dff',
  hudPanel: 'rgba(12, 18, 28, 0.72)',
  hudText: '#f4f1e8',
  hudAccent: '#ffd23f',
  objective: '#7ee081',
  danger: '#ff5a4e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const FONT_DISPLAY = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
