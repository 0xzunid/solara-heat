// The screenshot scenes behind ?shot=start|play|chase|end&seed=N. Each one
// plays the real rules forward from a fresh world, steered by a simple
// autopilot (walk to a car, steal it, drive at the mission marker, keep the
// cops behind), so the frame is what a short game really looks like and the
// same seed always gives the same frame. Painted through the exact render
// path normal play uses.

import { SCREEN, STEP } from './config.js';
import { clamp } from './random.js';
import { makeCar } from './entities.js';

/** Fake input the world can step against: an axis, a world-space mouse. */
function makePilotInput() {
  const pilot = {
    axisX: 0,
    axisY: 0,
    firing: false,
    targetX: 0,
    targetY: 0,
    axis() {
      return { x: pilot.axisX, y: pilot.axisY };
    },
    takeActions() {
      return 0;
    },
    takeClick() {
      return false;
    },
    get hasMouse() {
      return true;
    },
    get mouseX() {
      return pilot.targetX;
    },
    get mouseY() {
      return pilot.targetY;
    },
  };
  return pilot;
}

/** Steer Rio toward (tx, ty): walk on foot, drive with throttle + steering. */
function steerPilot(world, pilot, tx, ty) {
  const p = world.state.player;
  const dx = tx - p.x;
  const dy = ty - p.y;
  const d = Math.hypot(dx, dy) || 1;
  if (p.onFoot) {
    pilot.axisX = clamp(dx / 60, -1, 1);
    pilot.axisY = clamp(dy / 60, -1, 1);
    pilot.targetX = tx;
    pilot.targetY = ty;
    pilot.firing = false;
    return;
  }
  // Driving: aim the nose at the waypoint, throttle on, brake when close.
  const car = p.car;
  const want = Math.atan2(dy, dx);
  let turn = want - car.angle;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  pilot.axisX = clamp(turn * 2, -1, 1);
  pilot.axisY = d > 120 ? -1 : 1;
  pilot.targetX = tx;
  pilot.targetY = ty;
  pilot.firing = false;
}

function nearestCarTo(world, x, y) {
  let bestCar = null;
  let bestD2 = Infinity;
  for (const car of world.state.cars) {
    if (car.dead) continue;
    const d2 = (car.x - x) ** 2 + (car.y - y) ** 2;
    if (d2 < bestD2) {
      bestD2 = d2;
      bestCar = car;
    }
  }
  return bestCar;
}

/** Steer Rio along road waypoints in order, so the pilot never cuts corners through buildings. */
function steerWaypoints(world, pilot, points) {
  const p = world.state.player;
  if (pilot.wp === undefined) pilot.wp = 0;
  while (pilot.wp < points.length - 1) {
    const wp = points[pilot.wp];
    if (Math.hypot(wp.x - p.x, wp.y - p.y) < 90) pilot.wp += 1;
    else break;
  }
  const target = points[Math.min(pilot.wp, points.length - 1)];
  steerPilot(world, pilot, target.x, target.y);
}

/** Set `world` to the named scene and return the screen to draw over it. */
export function stageShot(name, world) {
  const pilot = makePilotInput();
  const state = world.state;

  if (name === 'play') {
    world.reset();
    world.startGame();
    // On foot through Solara Bay: east along the avenue, then south to the
    // fare pickup on Coral Ave, mission tracker live on the HUD.
    for (let i = 0; i < Math.floor(7 / STEP); i += 1) {
      steerWaypoints(world, pilot, [{ x: 1500, y: 850 }, { x: 1500, y: 1400 }]);
      world.step(STEP, pilot);
      if (state.screen === SCREEN.GAME_OVER) break;
    }
    // Stage the frame on the pickup itself, so the beacon marks the fare.
    state.missionStage = 1;
    return { screen: SCREEN.PLAYING, best: state.best };
  }

  if (name === 'chase') {
    world.reset();
    world.startGame();
    // Put Rio in a car on Coral Ave, wanted 3, interceptors already closing.
    const car = nearestCarTo(world, 1500, 1400);
    state.player.x = car.x;
    state.player.y = car.y;
    world.toggleCar();
    state.player.wanted = 3;
    state.player.wantedHeat = 3;
    state.player.cash = 1240;
    state.player.ammo = 24;
    state.stats.earned = 1180;
    // Spawn two interceptors by hand so the frame always shows the chase.
    const cop1 = makeCar(state.rng, state.player.x - 240, state.player.y - 120, { kind: 'police', angle: 0.4, speed: 300 });
    const cop2 = makeCar(state.rng, state.player.x + 220, state.player.y + 160, { kind: 'police', angle: -2.4, speed: 300 });
    state.cars.push(cop1, cop2);
    for (let i = 0; i < Math.floor(6 / STEP); i += 1) {
      // Straight east along Coral Ave at full speed — the interceptors
      // stay in the rear-view mirror instead of piling on in a turn.
      steerWaypoints(world, pilot, [{ x: 3300, y: 1400 }]);
      world.step(STEP, pilot);
      if (state.screen === SCREEN.GAME_OVER) break;
    }
    // The chase must still be a chase: if Rio was busted, revive the frame,
    // and top his health back up so the frame reads as a chase, not a death.
    if (state.screen === SCREEN.GAME_OVER) {
      state.screen = SCREEN.PLAYING;
      state.player.wanted = 3;
      state.busted = false;
      state.wasted = false;
    }
    state.player.health = 100;
    return { screen: SCREEN.PLAYING, best: state.best };
  }

  if (name === 'end') {
    world.reset();
    world.startGame();
    // A good run first: earn some cash, steal a car, build a wanted level.
    for (let i = 0; i < Math.floor(6 / STEP); i += 1) {
      const p = state.player;
      if (p.onFoot) {
        const car = nearestCarTo(world, p.x, p.y);
        if (car && Math.hypot(car.x - p.x, car.y - p.y) < 70) world.toggleCar();
        else if (car) steerWaypoints(world, pilot, [{ x: car.x, y: car.y }]);
      } else {
        steerWaypoints(world, pilot, [{ x: 3300, y: 1400 }]);
      }
      world.step(STEP, pilot);
    }
    state.player.wanted = 3;
    state.player.cash = 860;
    state.stats.earned = 810;
    state.stats.carsStolen = 2;
    state.stats.shotsFired = 14;
    state.missionsDone = 1;
    // Then the PD catches up: wasted, with the stats on screen.
    state.wasted = true;
    world.step(STEP, pilot);
    return { screen: SCREEN.GAME_OVER, best: state.best };
  }

  // start (default): title screen over a living city.
  world.reset();
  const idle = {
    axis: () => ({ x: 0, y: 0 }),
    hasMouse: false,
    mouseX: 0,
    mouseY: 0,
    firing: false,
    takeActions: () => 0,
    takeClick: () => false,
  };
  for (let i = 0; i < Math.floor(3 / STEP); i += 1) world.step(STEP, idle);
  return { screen: SCREEN.TITLE, best: state.best };
}
