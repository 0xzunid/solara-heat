// SOLARA HEAT — every tuning number, colour and city constant in one place.
// Solara Bay is a fixed 3600x2600 open city: a grid of avenues and streets,
// a beach and the sea along the south edge, blocks of buildings in between.
// The camera follows Rio Vega; the renderer scales the 1280x720 view.

export const STEP = 1 / 60; // fixed simulation step, seconds

export const SCREEN = {
  TITLE: 'title',
  PLAYING: 'playing',
  PAUSED: 'paused',
  MISSION_CLEAR: 'mission-clear',
  GAME_OVER: 'game-over',
};

export const VIEW = { width: 1280, height: 720 };

export const WORLD = { width: 3600, height: 2600 };

// Road centrelines. Roads are 140 wide; lanes run 35 px either side of centre.
export const ROADS_V = [300, 900, 1500, 2100, 2700, 3300];
export const ROADS_H = [300, 850, 1400, 1950, 2350];
export const ROAD_W = 140;

// The beach strip and the sea along the south edge of the map.
export const BEACH_Y = 2460;
export const SEA_Y = 2545;

export const PLAYER = {
  radius: 14,
  walkSpeed: 175,
  sprintSpeed: 265,
  health: 100,
  startX: 900,
  startY: 850,
  startAmmo: 12,
  maxAmmo: 60,
  fireCooldown: 0.24,
  punchCooldown: 0.45,
  punchRange: 46,
  punchDamage: 34,
};

export const CAR = {
  length: 64,
  width: 30,
  accel: 420,
  brake: 620,
  maxSpeed: 540,
  reverseMax: 160,
  steer: 2.6,
  drag: 0.55,
  trafficSpeed: 150,
  policeSpeed: 580,
  health: 100,
};

export const PED = {
  radius: 11,
  walkSpeed: 62,
  fleeSpeed: 150,
};

export const COP = {
  radius: 13,
  runSpeed: 205,
  bustSeconds: 1.4,
};

export const BULLET = { speed: 950, range: 560, damage: 34 };

export const WANTED = {
  max: 5,
  decaySeconds: 22, // quiet seconds per star lost, while no police are near
  steal: 1,
  shoot: 0.5,
  killPed: 1,
  killCop: 1,
  hitPed: 1,
  ramCop: 1,
};

export const ECONOMY = {
  startCash: 50,
  fareMin: 40,
  fareMax: 85,
  dropMin: 25,
  dropMax: 60,
  bustFine: 100,
  wastedFine: 150,
};

export const SAVE_KEY = 'solara-heat-save-v1';

// Sun-soaked coastal palette: warm asphalt, pale sidewalks, pastel blocks,
// turquoise sea, sand, and the hot orange of the Solara Heat logo.
export const COLORS = {
  grass: '#7fae62',
  grassDark: '#74a158',
  sidewalk: '#cfc4a8',
  road: '#3d3a38',
  roadEdge: '#2c2a29',
  lane: '#e8d44d',
  beach: '#ecd9a0',
  sea: '#2fa8b8',
  seaDeep: '#1d7f92',
  buildingRoof: ['#c96f4a', '#d9a441', '#7d9bb5', '#b5658a', '#8a9a5b', '#5b8a7d'],
  buildingWall: '#e8ddc8',
  park: '#5d9b4a',
  player: '#ff5a1f',
  playerDark: '#c73e0e',
  pedShirt: ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1'],
  taxi: '#f7c948',
  police: '#2f6fed',
  policeDark: '#1d4fb8',
  cop: '#274b8f',
  hudBg: 'rgba(12, 14, 20, 0.72)',
  hudText: '#f5f1e6',
  gold: '#ffd23f',
  red: '#ff3b30',
  green: '#34d17b',
};
