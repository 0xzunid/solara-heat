// SOLARA HEAT's world: the city, everyone in it, and the rules that move
// them. The world owns the player, traffic, pedestrians, police, bullets,
// pickups, missions and side jobs; the renderer only paints what is here.
// One fixed step (1/60 s) advances everything; ?shot= scenes drive the
// same step function with a scripted pilot input.

import {
  BEACH_Y, BULLET, CAR, COLORS, COP, ECONOMY, PED, PLAYER, ROADS_H, ROADS_V,
  SAVE_KEY, SCREEN, SEA_Y, WANTED, WORLD,
} from './config.js';
import { angleDelta, clamp, createRandom, dist2, onRoad } from './random.js';
import { createAudio } from './audio.js';
import {
  burst, makeBullet, makeCar, makeCop, makeFloater, makeParticle, makePed,
  makePickup, makePlayer,
} from './entities.js';
import { addWanted, damagePlayer, updatePolice } from './police.js';
import {
  BANK, MISSIONS, SAFEHOUSE, completeMission, currentMission, startMission,
  updateMission,
} from './missions.js';

const TRAFFIC_TARGET = 14;
const PED_TARGET = 26;

/** Points the city generator must keep clear of buildings. */
const KEEP_CLEAR = [
  SAFEHOUSE,
  BANK,
  { x: 1500, y: 1400 },
  { x: 2700, y: 850 },
  { x: 2100, y: 1950 },
  { x: 3300, y: 300 },
  { x: 300, y: 2350 },
  { x: PLAYER.startX, y: PLAYER.startY },
];

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Build Solara Bay's blocks: pastel-roofed buildings, a park, palms. */
function buildCity(rng) {
  const buildings = [];
  const palms = [];
  const vEdges = [0, ...ROADS_V.map((x) => x - 70), ...ROADS_V.map((x) => x + 70), WORLD.width].sort((a, b) => a - b);
  const hEdges = [0, ...ROADS_H.map((y) => y - 70), ...ROADS_H.map((y) => y + 70), BEACH_Y].sort((a, b) => a - b);
  // Blocks are the rectangles between neighbouring road edges.
  const vSpans = [];
  for (let i = 0; i + 1 < vEdges.length; i += 2) vSpans.push([vEdges[i], vEdges[i + 1]]);
  const hSpans = [];
  for (let i = 0; i + 1 < hEdges.length; i += 2) hSpans.push([hEdges[i], hEdges[i + 1]]);

  for (const [vx0, vx1] of vSpans) {
    for (const [hy0, hy1] of hSpans) {
      const bw = vx1 - vx0;
      const bh = hy1 - hy0;
      if (bw < 90 || bh < 90) continue;
      // One block in five is a park, not buildings.
      if (rng.chance(0.18)) {
        buildings.push({
          x: vx0, y: hy0, w: bw, h: bh, park: true, color: COLORS.park, roof: COLORS.park,
        });
        continue;
      }
      const cols = bw > 420 ? 2 : 1;
      const rows = bh > 380 ? 2 : 1;
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          const w = bw / cols - 36;
          const h = bh / rows - 36;
          const b = {
            x: vx0 + 18 + (c * bw) / cols,
            y: hy0 + 18 + (r * bh) / rows,
            w,
            h,
            park: false,
            color: rng.pick(COLORS.buildingRoof),
            roof: rng.pick(COLORS.buildingRoof),
          };
          const clear = KEEP_CLEAR.every((pt) =>
            !(pt.x > b.x - 40 && pt.x < b.x + b.w + 40 && pt.y > b.y - 40 && pt.y < b.y + b.h + 40));
          if (clear) buildings.push(b);
        }
      }
    }
  }
  // Palms along the beach and a few on the avenues.
  for (let x = 120; x < WORLD.width; x += 170) {
    palms.push({ x: x + rng.range(-30, 30), y: BEACH_Y + rng.range(18, 55) });
  }
  for (let i = 0; i < 24; i += 1) {
    const rx = ROADS_V[Math.floor(rng.next() * ROADS_V.length)] + (rng.chance(0.5) ? -95 : 95);
    const ry = rng.range(120, BEACH_Y - 120);
    palms.push({ x: rx, y: ry });
  }
  return { buildings, palms };
}

export function createWorld(rng) {
  const audio = createAudio();
  const { buildings, palms } = buildCity(rng);

  const state = {
    rng,
    audio,
    screen: SCREEN.TITLE,
    time: 0,
    player: makePlayer(PLAYER.startX, PLAYER.startY),
    cars: [],
    peds: [],
    cops: [],
    bullets: [],
    particles: [],
    floaters: [],
    pickups: [],
    buildings,
    palms,
    missionIndex: 0,
    missionStage: 0,
    missionTimer: 0,
    missionHold: 0,
    fare: null,
    fareTimer: 0,
    fareSpawnTimer: 6,
    dropTimer: 14,
    quietTimer: 0,
    spawnTimer: 0,
    hurtCooldown: 0,
    ramCooldown: 0,
    busted: false,
    wasted: false,
    banner: null,
    bannerTimer: 0,
    stats: { earned: 0, carsStolen: 0, shotsFired: 0, pedsDown: 0, missionsDone: 0 },
    missionsDone: 0,
    best: 0,
    camera: { x: PLAYER.startX, y: PLAYER.startY },
    overReason: '',
    saveData: null,
  };

  function loadSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function saveGame() {
    const data = {
      cash: Math.floor(state.player.cash),
      missionIndex: state.missionIndex,
      best: Math.max(state.best, state.stats.earned),
      missionsDone: state.missionsDone,
    };
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch { /* storage unavailable: the game still plays */ }
    state.saveData = data;
  }

  function applySave(data) {
    if (!data) return;
    state.player.cash = data.cash ?? ECONOMY.startCash;
    state.missionIndex = Math.min(data.missionIndex ?? 0, MISSIONS.length);
    state.best = data.best ?? 0;
    state.missionsDone = data.missionsDone ?? 0;
  }

  state.saveData = loadSave();
  if (state.saveData) applySave(state.saveData);

  function reset() {
    state.time = 0;
    state.player = makePlayer(PLAYER.startX, PLAYER.startY);
    if (state.saveData) applySave(state.saveData);
    state.cars = [];
    state.peds = [];
    state.cops = [];
    state.bullets = [];
    state.particles = [];
    state.floaters = [];
    state.pickups = [];
    state.missionStage = 0;
    state.missionTimer = 0;
    state.missionHold = 0;
    state.fare = null;
    state.fareTimer = 0;
    state.fareSpawnTimer = 6;
    state.dropTimer = 14;
    state.quietTimer = 0;
    state.spawnTimer = 0;
    state.hurtCooldown = 0;
    state.ramCooldown = 0;
    state.busted = false;
    state.wasted = false;
    state.banner = null;
    state.bannerTimer = 0;
    state.stats = { earned: 0, carsStolen: 0, shotsFired: 0, pedsDown: 0, missionsDone: state.missionsDone };
    state.screen = SCREEN.TITLE;
    state.camera = { x: PLAYER.startX, y: PLAYER.startY };
    state.overReason = '';
    spawnTraffic(true);
    spawnPeds();
    // The gold coupe for "Hot Wheels", parked by the pier from the start.
    const coupe = makeCar(rng, 2100, 1950, { kind: 'parked', angle: Math.PI / 2, color: '#e8c33a' });
    coupe.driver = false;
    state.cars.push(coupe);
    // A taxi waiting at the Marina Hotel for the first fare.
    const taxi = makeCar(rng, 2700, 900, { kind: 'taxi', angle: 0 });
    taxi.driver = false;
    state.cars.push(taxi);
    startMission(state);
  }

  function randomRoadPoint() {
    if (rng.chance(0.5)) {
      const rx = ROADS_V[Math.floor(rng.next() * ROADS_V.length)];
      return { x: rx + (rng.chance(0.5) ? -35 : 35), y: rng.range(80, BEACH_Y - 80) };
    }
    const ry = ROADS_H[Math.floor(rng.next() * ROADS_H.length)];
    return { x: rng.range(80, WORLD.width - 80), y: ry + (rng.chance(0.5) ? -35 : 35) };
  }

  function spawnTraffic(initial) {
    while (state.cars.filter((c) => c.kind === 'traffic' || c.kind === 'taxi').length < TRAFFIC_TARGET) {
      const pt = randomRoadPoint();
      const vertical = Math.abs(pt.x - ROADS_V.reduce((a, b) => (Math.abs(b - pt.x) < Math.abs(a - pt.x) ? b : a))) < 40;
      const car = makeCar(rng, pt.x, pt.y, {
        kind: rng.chance(0.15) ? 'taxi' : 'traffic',
        angle: vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI),
        roadAxis: vertical ? 'v' : 'h',
      });
      car.speed = car.cruise;
      state.cars.push(car);
      if (!initial) break;
    }
  }

  function spawnPeds() {
    while (state.peds.length < PED_TARGET) {
      const pt = randomRoadPoint();
      const x = clamp(pt.x + rng.range(-120, 120), 60, WORLD.width - 60);
      const y = clamp(pt.y + rng.range(-120, 120), 60, BEACH_Y - 60);
      state.peds.push(makePed(rng, x, y));
    }
  }

  function startGame() {
    reset();
    state.screen = SCREEN.PLAYING;
    state.audio.unlock();
  }

  /** Push a circle out of every building it overlaps; returns true on hit. */
  function collideBuildings(x, y, r) {
    for (const b of state.buildings) {
      if (b.park) continue;
      const cx = clamp(x, b.x, b.x + b.w);
      const cy = clamp(y, b.y, b.y + b.h);
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        const d = Math.sqrt(d2) || 0.001;
        const push = r - d;
        return { x: x + (dx / d) * push, y: y + (dy / d) * push, hit: true };
      }
    }
    return { x, y, hit: false };
  }

  function nearestCar(x, y, maxDist) {
    let bestCar = null;
    let bestD2 = maxDist * maxDist;
    for (const car of state.cars) {
      if (car.dead) continue;
      const d2 = dist2(x, y, car.x, car.y);
      if (d2 < bestD2) {
        bestD2 = d2;
        bestCar = car;
      }
    }
    return bestCar;
  }

  function enterCar(car) {
    const p = state.player;
    const wasStolen = !!car.stolen;
    if (car.driver && car.kind !== 'police') {
      // The driver bails and runs; taking a car with a driver is a crime.
      car.driver = false;
      const driver = makePed(rng, car.x + 40, car.y);
      driver.state = 'flee';
      driver.fleeTimer = 4;
      state.peds.push(driver);
    }
    // Taking any car that is not already Rio's counts as a steal, once.
    if (!wasStolen) {
      car.stolen = true;
      state.stats.carsStolen += 1;
      addWanted(p, WANTED.steal);
      state.floaters.push(makeFloater(car.x, car.y - 40, 'CAR STOLEN! +1★', '#ff3b30'));
      state.audio.crash();
    }
    p.car = car;
    p.onFoot = false;
    p.x = car.x;
    p.y = car.y;
    car.speed = 0;
  }

  function exitCar() {
    const p = state.player;
    const car = p.car;
    if (!car) return;
    p.car = null;
    p.onFoot = true;
    p.x = clamp(car.x + Math.cos(car.angle + Math.PI / 2) * 44, 20, WORLD.width - 20);
    p.y = clamp(car.y + Math.sin(car.angle + Math.PI / 2) * 44, 20, WORLD.height - 20);
    p.speed = 0;
    car.speed = Math.max(0, car.speed - 60);
  }

  function fireBullet() {
    const p = state.player;
    p.fireTimer = PLAYER.fireCooldown;
    p.ammo -= 1;
    state.stats.shotsFired += 1;
    const mx = p.x + Math.cos(p.aimAngle) * 26;
    const my = p.y + Math.sin(p.aimAngle) * 26;
    state.bullets.push(makeBullet(mx, my, p.aimAngle));
    burst(state.particles, mx, my, '#ffd23f', 4, 160, 0.15, 3);
    state.audio.shoot();
    // Firing where people can see it draws the heat.
    const witnessed = state.peds.some((pd) => pd.alive && dist2(p.x, p.y, pd.x, pd.y) < 450 * 450)
      || state.cops.some((c) => dist2(p.x, p.y, c.x, c.y) < 500 * 500);
    if (witnessed) addWanted(p, WANTED.shoot);
  }

  function punch() {
    const p = state.player;
    p.punchTimer = PLAYER.punchCooldown;
    state.audio.punch();
    const range = PLAYER.punchRange;
    for (const pd of state.peds) {
      if (!pd.alive) continue;
      const d = Math.hypot(pd.x - p.x, pd.y - p.y);
      if (d < range + PED.radius) {
        const ang = Math.atan2(pd.y - p.y, pd.x - p.x);
        if (Math.abs(ang - p.aimAngle) < 1.1 || d < 24) {
          pd.alive = false;
          pd.state = 'down';
          state.stats.pedsDown += 1;
          addWanted(p, WANTED.hitPed);
          burst(state.particles, pd.x, pd.y, '#ff8c42', 6, 140, 0.4, 4);
        }
      }
    }
    for (const cop of state.cops) {
      if (!cop.alive) continue;
      const d = Math.hypot(cop.x - p.x, cop.y - p.y);
      if (d < range + COP.radius) {
        cop.alive = false;
        addWanted(p, WANTED.killCop);
        burst(state.particles, cop.x, cop.y, '#ff8c42', 6, 140, 0.4, 4);
      }
    }
  }

  function updatePlayer(dt, input) {
    const p = state.player;
    p.fireTimer = Math.max(0, p.fireTimer - dt);
    p.punchTimer = Math.max(0, p.punchTimer - dt);
    p.hurtTimer = Math.max(0, p.hurtTimer - dt);
    p.bustedTimer = Math.max(0, p.bustedTimer - 0.4 * dt);

    // Aim follows the mouse in world space; without a mouse, face movement.
    if (input.hasMouse) {
      p.aimAngle = Math.atan2(input.mouseY - p.y, input.mouseX - p.x);
    }

    if (p.onFoot) {
      const axis = input.axis();
      const speed = input.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
      p.moving = axis.x !== 0 || axis.y !== 0;
      p.speed = p.moving ? speed : 0;
      if (p.moving) {
        // Move one axis at a time so Rio slides along walls instead of
        // sticking on building corners when walking diagonally.
        const nx = p.x + axis.x * speed * dt;
        p.x = collideBuildings(nx, p.y, PLAYER.radius).x;
        const ny = p.y + axis.y * speed * dt;
        p.y = collideBuildings(p.x, ny, PLAYER.radius).y;
        if (!input.hasMouse) p.aimAngle = Math.atan2(axis.y, axis.x);
        p.angle = p.aimAngle;
      }
      p.x = clamp(p.x, 16, WORLD.width - 16);
      p.y = clamp(p.y, 16, WORLD.height - 16);
      // Wading: the sea slows Rio and the beach is soft ground.
      if (p.y > SEA_Y) {
        p.y = SEA_Y;
      }
      if (input.firing && p.fireTimer <= 0 && p.ammo > 0) fireBullet();
      else if (input.firing && p.fireTimer <= 0 && p.ammo <= 0 && p.punchTimer <= 0) punch();
    } else {
      // Driving: W/S throttle and brake, A/D steer (stronger at speed).
      const car = p.car;
      const axis = input.axis();
      const along = axis.y * -1; // W is up on screen = forward
      if (along > 0) car.speed += CAR.accel * dt;
      else if (along < 0) car.speed -= (car.speed > 0 ? CAR.brake : CAR.accel * 0.7) * dt;
      else car.speed -= car.speed * CAR.drag * dt * 2;
      car.speed = clamp(car.speed, -CAR.reverseMax, CAR.maxSpeed);
      const steerAmount = axis.x * CAR.steer * clamp(Math.abs(car.speed) / 220, 0, 1) * (car.speed >= 0 ? 1 : -1);
      car.angle += steerAmount * dt;
      // Move one axis at a time so the car slides along walls instead of
      // sticking on building corners.
      const dx = Math.cos(car.angle) * car.speed * dt;
      const dy = Math.sin(car.angle) * car.speed * dt;
      const fx = collideBuildings(car.x + dx, car.y, 30);
      if (fx.hit) {
        if (Math.abs(car.speed) > 260 && state.hurtCooldown <= 0) {
          state.audio.crash();
          damagePlayer(state, 6, car.x, car.y);
          car.speed *= -0.35;
        } else {
          car.speed *= 0.55;
        }
        car.x = fx.x;
      } else {
        car.x += dx;
      }
      const fy = collideBuildings(car.x, car.y + dy, 30);
      if (fy.hit) {
        if (Math.abs(car.speed) > 260 && state.hurtCooldown <= 0) {
          state.audio.crash();
          damagePlayer(state, 6, car.x, car.y);
          car.speed *= -0.35;
        } else {
          car.speed *= 0.55;
        }
        car.y = fy.y;
      } else {
        car.y += dy;
      }
      car.x = clamp(car.x, 30, WORLD.width - 30);
      car.y = clamp(car.y, 30, WORLD.height - 30);
      if (car.y > SEA_Y - 10) {
        car.y = SEA_Y - 10;
        car.speed *= 0.4;
      }
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      p.aimAngle = car.angle;
      p.speed = Math.abs(car.speed);
      state.audio.engine(Math.abs(car.speed) / CAR.maxSpeed);
      if (Math.abs(car.speed) > 300) {
        // Tyre smoke at speed.
        state.particles.push(makeParticle(
          car.x - Math.cos(car.angle) * 30, car.y - Math.sin(car.angle) * 30,
          -Math.cos(car.angle) * 40, -Math.sin(car.angle) * 40,
          0.5, 'rgba(200,200,200,0.5)', 5,
        ));
      }
    }

    // Health creeps back when Rio is out of trouble.
    if (p.health < PLAYER.health && p.wanted === 0 && state.hurtCooldown <= 0) {
      p.health = Math.min(PLAYER.health, p.health + 2.5 * dt);
    }
  }

  function updateTraffic(dt) {
    const p = state.player;
    for (const car of state.cars) {
      if (car.dead || car.kind === 'police' || car === p.car) continue;
      if (!car.driver) {
        car.speed = Math.max(0, car.speed - 200 * dt);
        continue;
      }
      // Follow the road: drive along the current axis, turn at intersections.
      const onV = Math.abs(car.x - ROADS_V.reduce((a, b) => (Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a))) < 45;
      const onH = Math.abs(car.y - ROADS_H.reduce((a, b) => (Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a))) < 45;
      if (onV && onH && rng.chance(0.006)) {
        // Turn onto the crossing road.
        car.roadAxis = car.roadAxis === 'v' ? 'h' : 'v';
        car.angle = car.roadAxis === 'v'
          ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2)
          : (rng.chance(0.5) ? 0 : Math.PI);
      }
      // Slow for the car ahead.
      let ahead = null;
      for (const other of state.cars) {
        if (other === car || other.dead) continue;
        const dx = other.x - car.x;
        const dy = other.y - car.y;
        const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
        const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
        if (along > 0 && along < 78 && side < 26) {
          ahead = other;
          break;
        }
      }
      const target = ahead ? Math.max(0, ahead.speed - 20) : car.cruise;
      car.speed += clamp(target - car.speed, -320 * dt, 200 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      // Wrap around the city edge onto another road.
      if (car.x < 40 || car.x > WORLD.width - 40 || car.y < 40 || car.y > BEACH_Y - 40) {
        const pt = randomRoadPoint();
        car.x = pt.x;
        car.y = pt.y;
        car.speed = car.cruise;
      }
      if (car.health <= 0) {
        car.dead = true;
        car.driver = false;
        car.smoke = 1;
      }
      if (car.smoke > 0) {
        car.smoke = Math.max(0, car.smoke - dt * 0.2);
        state.particles.push(makeParticle(
          car.x, car.y - 10, rng.range(-12, 12), rng.range(-30, -10), 0.8, 'rgba(120,120,120,0.6)', 6,
        ));
      }
    }
    // Gentle car-car separation so traffic does not pile up.
    for (let i = 0; i < state.cars.length; i += 1) {
      for (let j = i + 1; j < state.cars.length; j += 1) {
        const a = state.cars[i];
        const b = state.cars[j];
        if (a.dead || b.dead) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.01 && d < 56) {
          const push = (56 - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
          if (a === p.car || b === p.car) {
            const other = a === p.car ? b : a;
            if (other.kind === 'police' && Math.abs(p.car.speed) > 120 && state.ramCooldown <= 0) {
              state.ramCooldown = 2;
              addWanted(p, WANTED.ramCop);
            }
          }
        }
      }
    }
    state.cars = state.cars.filter((c) => !(c.dead && c.kind === 'traffic' && Math.hypot(c.x - p.x, c.y - p.y) > 900));
    spawnTraffic(false);
  }

  function updatePeds(dt) {
    const p = state.player;
    for (const pd of state.peds) {
      if (!pd.alive) continue;
      pd.retarget -= dt;
      const danger = state.bullets.length > 0 && dist2(pd.x, pd.y, p.x, p.y) < 420 * 420;
      if (danger || pd.state === 'flee') {
        pd.state = 'flee';
        pd.fleeTimer -= dt;
        const away = Math.atan2(pd.y - p.y, pd.x - p.x);
        pd.targetAngle = away;
        pd.speed = PED.fleeSpeed;
        if (pd.fleeTimer <= 0) pd.state = 'walk';
      } else {
        pd.speed = PED.walkSpeed;
        if (pd.retarget <= 0) {
          pd.retarget = rng.range(2, 6);
          pd.targetAngle = rng.range(0, Math.PI * 2);
        }
      }
      // Turn the short way: a plain clamp would spin a ped the long way
      // around when the target angle crosses the -PI/PI seam.
      pd.angle += clamp(angleDelta(pd.angle, pd.targetAngle), -2.5 * dt, 2.5 * dt);
      // One axis at a time, so pedestrians slide along walls.
      pd.x = collideBuildings(pd.x + Math.cos(pd.angle) * pd.speed * dt, pd.y, PED.radius).x;
      pd.y = collideBuildings(pd.x, pd.y + Math.sin(pd.angle) * pd.speed * dt, PED.radius).y;
      pd.x = clamp(pd.x, 20, WORLD.width - 20);
      pd.y = clamp(pd.y, 20, BEACH_Y - 20);
      // The player's car running a pedestrian over is a crime.
      if (!p.onFoot && p.car && dist2(pd.x, pd.y, p.x, p.y) < 34 * 34) {
        pd.alive = false;
        pd.state = 'down';
        state.stats.pedsDown += 1;
        addWanted(p, WANTED.hitPed);
        burst(state.particles, pd.x, pd.y, '#ff8c42', 8, 160, 0.5, 4);
        state.floaters.push(makeFloater(pd.x, pd.y - 24, 'PEDESTRIAN DOWN! +1★', '#ff3b30'));
      }
    }
    state.peds = state.peds.filter((pd) => pd.alive || pd.state === 'down');
    while (state.peds.filter((pd) => pd.alive).length < PED_TARGET) {
      const pt = randomRoadPoint();
      state.peds.push(makePed(rng, clamp(pt.x + rng.range(-100, 100), 60, WORLD.width - 60), clamp(pt.y + rng.range(-100, 100), 60, BEACH_Y - 60)));
    }
  }

  function updateBullets(dt) {
    const p = state.player;
    for (const b of state.bullets) {
      if (!b.alive) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.travelled += BULLET.speed * dt;
      if (b.travelled > BULLET.range || b.x < 0 || b.x > WORLD.width || b.y < 0 || b.y > WORLD.height) {
        b.alive = false;
        continue;
      }
      for (const bd of state.buildings) {
        if (bd.park) continue;
        if (b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h) {
          b.alive = false;
          burst(state.particles, b.x, b.y, '#e8d44d', 3, 120, 0.2, 3);
          break;
        }
      }
      if (!b.alive) continue;
      for (const pd of state.peds) {
        if (pd.alive && dist2(b.x, b.y, pd.x, pd.y) < (PED.radius + 6) ** 2) {
          pd.alive = false;
          pd.state = 'down';
          state.stats.pedsDown += 1;
          addWanted(p, WANTED.killPed);
          burst(state.particles, pd.x, pd.y, '#ff8c42', 8, 160, 0.5, 4);
          b.alive = false;
          break;
        }
      }
      if (!b.alive) continue;
      for (const cop of state.cops) {
        if (cop.alive && dist2(b.x, b.y, cop.x, cop.y) < (COP.radius + 6) ** 2) {
          cop.alive = false;
          addWanted(p, WANTED.killCop);
          burst(state.particles, cop.x, cop.y, '#ff8c42', 8, 160, 0.5, 4);
          b.alive = false;
          break;
        }
      }
      if (!b.alive) continue;
      for (const car of state.cars) {
        if (car.dead || car === p.car) continue;
        const dx = b.x - car.x;
        const dy = b.y - car.y;
        const along = Math.abs(dx * Math.cos(car.angle) + dy * Math.sin(car.angle));
        const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
        if (along < 34 && side < 18) {
          car.health -= BULLET.damage;
          burst(state.particles, b.x, b.y, '#e8d44d', 4, 140, 0.25, 3);
          if (car.health <= 0 && car.kind !== 'police') {
            car.dead = true;
            if (car.driver) {
              car.driver = false;
              const driver = makePed(rng, car.x + 40, car.y);
              driver.state = 'flee';
              driver.fleeTimer = 4;
              state.peds.push(driver);
            }
          }
          b.alive = false;
          break;
        }
      }
    }
    state.bullets = state.bullets.filter((b) => b.alive);
  }

  function updatePickups(dt) {
    const p = state.player;
    state.dropTimer -= dt;
    if (state.dropTimer <= 0) {
      state.dropTimer = 25;
      const pt = randomRoadPoint();
      const kind = state.rng.chance(0.7) ? 'cash' : (state.rng.chance(0.5) ? 'ammo' : 'health');
      const amount = kind === 'cash'
        ? state.rng.int(ECONOMY.dropMin, ECONOMY.dropMax)
        : kind === 'ammo' ? 12 : 30;
      state.pickups.push(makePickup(state.rng, pt.x, pt.y, kind, amount));
    }
    for (const pk of state.pickups) {
      if (!pk.alive) continue;
      pk.ttl -= dt;
      pk.bob += dt * 4;
      if (pk.ttl <= 0) {
        pk.alive = false;
        continue;
      }
      if (dist2(p.x, p.y, pk.x, pk.y) < 40 * 40) {
        pk.alive = false;
        if (pk.pickupKind === 'cash') {
          p.cash += pk.amount;
          state.stats.earned += pk.amount;
          state.floaters.push(makeFloater(p.x, p.y - 30, `+$${pk.amount}`, '#34d17b'));
        } else if (pk.pickupKind === 'ammo') {
          p.ammo = Math.min(60, p.ammo + pk.amount);
          state.floaters.push(makeFloater(p.x, p.y - 30, `+${pk.amount} AMMO`, '#ffd23f'));
        } else {
          p.health = Math.min(PLAYER.health, p.health + pk.amount);
          state.floaters.push(makeFloater(p.x, p.y - 30, `+${pk.amount} HEALTH`, '#34d17b'));
        }
        state.audio.pickup();
      }
    }
    state.pickups = state.pickups.filter((pk) => pk.alive);
  }

  function updateFare(dt) {
    const p = state.player;
    state.fareSpawnTimer -= dt;
    if (!state.fare && state.fareSpawnTimer <= 0 && state.screen === SCREEN.PLAYING) {
      state.fareSpawnTimer = 45;
      // A fare waves from a roadside near Rio.
      const angle = state.rng.range(0, Math.PI * 2);
      const fx = clamp(p.x + Math.cos(angle) * state.rng.range(350, 700), 100, WORLD.width - 100);
      const fy = clamp(p.y + Math.sin(angle) * state.rng.range(350, 700), 100, BEACH_Y - 100);
      const dest = randomRoadPoint();
      const ped = makePed(state.rng, fx, fy);
      ped.state = 'walk';
      state.peds.push(ped);
      state.fare = {
        ped,
        x: fx,
        y: fy,
        dest,
        pay: state.rng.int(ECONOMY.fareMin, ECONOMY.fareMax),
        pickedUp: false,
        timer: 75,
      };
      state.floaters.push(makeFloater(fx, fy - 30, 'FARE — pick up!', '#ffd23f'));
    }
    if (!state.fare) return;
    const fare = state.fare;
    fare.timer -= dt;
    if (fare.timer <= 0) {
      state.floaters.push(makeFloater(fare.x, fare.y - 30, 'Fare left.', '#e8e4da'));
      state.fare = null;
      return;
    }
    if (!fare.pickedUp) {
      if (!p.onFoot && p.car && dist2(p.x, p.y, fare.x, fare.y) < 90 * 90) {
        fare.pickedUp = true;
        fare.ped.alive = false;
        state.floaters.push(makeFloater(p.x, p.y - 30, 'Passenger aboard — drive!', '#ffd23f'));
        state.audio.pickup();
      }
    } else if (dist2(p.x, p.y, fare.dest.x, fare.dest.y) < 90 * 90) {
      p.cash += fare.pay;
      state.stats.earned += fare.pay;
      state.floaters.push(makeFloater(p.x, p.y - 30, `FARE +$${fare.pay}`, '#34d17b'));
      state.audio.mission();
      state.fare = null;
    }
  }

  function gameOver(reason) {
    state.screen = SCREEN.GAME_OVER;
    state.overReason = reason;
    state.best = Math.max(state.best, state.stats.earned);
    state.audio.busted();
    state.audio.siren(false);
    state.audio.engine(0);
    saveGame();
  }

  function step(dt, input) {
    if (state.screen === SCREEN.TITLE) {
      // The title screen idles over a living city behind the menu.
      state.time += dt;
      updateTraffic(dt);
      updatePeds(dt);
      for (const pt of state.particles) {
        pt.life -= dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
      }
      state.particles = state.particles.filter((pt) => pt.life > 0);
      return;
    }
    if (state.screen !== SCREEN.PLAYING) return;

    state.time += dt;
    state.hurtCooldown = Math.max(0, state.hurtCooldown - dt);
    state.ramCooldown = Math.max(0, state.ramCooldown - dt);
    if (state.bannerTimer > 0) {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0) state.banner = null;
    }

    // Enter / exit a car and punching are driven from main.js, which owns
    // the edge-triggered actions; the step function never consumes them.
    updatePlayer(dt, input);
    if (state.player.onFoot) state.audio.engine(0);
    updateTraffic(dt);
    updatePeds(dt);
    updateBullets(dt);
    updatePickups(dt);
    updateFare(dt);
    updatePolice(state, dt);

    // Missions pay, fail, or restart.
    const missionResult = updateMission(state, dt);
    if (missionResult === 'complete') {
      const mission = MISSIONS[state.missionIndex];
      const reward = completeMission(state);
      state.player.cash += reward;
      state.stats.earned += reward;
      state.banner = `${mission.name} COMPLETE — +$${reward}`;
      state.bannerTimer = 3.2;
      state.audio.mission();
      saveGame();
      startMission(state);
    } else if (missionResult === 'failed') {
      state.banner = 'MISSION FAILED — try again';
      state.bannerTimer = 3;
      state.audio.busted();
      startMission(state);
    }

    // Particles and floating texts settle.
    for (const pt of state.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
    }
    state.particles = state.particles.filter((pt) => pt.life > 0);
    for (const fl of state.floaters) {
      fl.life -= dt;
      fl.y -= 26 * dt;
    }
    state.floaters = state.floaters.filter((fl) => fl.life > 0);

    // Siren while wanted; engine hum while driving.
    state.audio.siren(state.player.wanted >= 1);
    state.audio.update(dt);

    // Camera follows Rio.
    state.camera.x = clamp(state.player.x, 640, WORLD.width - 640);
    state.camera.y = clamp(state.player.y, 360, WORLD.height - 360);

    if (state.busted) {
      const fine = Math.min(state.player.cash, ECONOMY.bustFine);
      state.player.cash -= fine;
      gameOver(`BUSTED — the Solara PD caught Rio. Fine $${fine}.`);
    } else if (state.wasted) {
      const fine = Math.min(state.player.cash, ECONOMY.wastedFine);
      state.player.cash -= fine;
      gameOver(`WASTED — Rio is down. Hospital bill $${fine}.`);
    }
  }

  /** Respawn after a bust: back at Maya's garage, heat gone, cash lighter. */
  function respawn() {
    const p = state.player;
    p.health = PLAYER.health;
    p.wanted = 0;
    p.wantedHeat = 0;
    p.bustedTimer = 0;
    p.onFoot = true;
    p.car = null;
    p.x = SAFEHOUSE.x;
    p.y = SAFEHOUSE.y;
    p.ammo = Math.max(p.ammo, PLAYER.startAmmo);
    state.busted = false;
    state.wasted = false;
    state.cops = [];
    state.cars = state.cars.filter((c) => c.kind !== 'police');
    state.screen = SCREEN.PLAYING;
    state.camera.x = p.x;
    state.camera.y = p.y;
    saveGame();
  }

  function drawEntities(g) {
    const p = state.player;
    const t = state.time;

    // Mission target beacon: a column of light and a ring on the ground.
    const mission = currentMission(state);
    if (mission && state.screen === SCREEN.PLAYING) {
      const stage = mission.stages[state.missionStage];
      if (stage && stage.target) {
        const tx = stage.target.x;
        const ty = stage.target.y;
        const pulse = 0.5 + Math.sin(t * 4) * 0.2;
        g.fillStyle = `rgba(255, 210, 63, ${0.34 + pulse * 0.16})`;
        g.fillRect(tx - 32, ty - 320, 64, 320);
        g.strokeStyle = '#ffd23f';
        g.lineWidth = 5;
        g.beginPath();
        g.arc(tx, ty, 46 + Math.sin(t * 4) * 6, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = '#ffd23f';
        g.beginPath();
        g.arc(tx, ty, 8, 0, Math.PI * 2);
        g.fill();
        // A chevron above the target so it reads from across the street.
        g.beginPath();
        g.moveTo(tx, ty - 64);
        g.lineTo(tx - 12, ty - 84);
        g.lineTo(tx + 12, ty - 84);
        g.closePath();
        g.fill();
      }
    }
    // Fare passenger marker.
    if (state.fare && !state.fare.pickedUp) {
      g.fillStyle = '#ffd23f';
      g.beginPath();
      g.arc(state.fare.x, state.fare.y - 26, 5 + Math.sin(t * 5) * 2, 0, Math.PI * 2);
      g.fill();
    }
    if (state.fare && state.fare.pickedUp) {
      const d = state.fare.dest;
      g.strokeStyle = '#34d17b';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(d.x, d.y, 40 + Math.sin(t * 4) * 5, 0, Math.PI * 2);
      g.stroke();
    }

    // Pickups: cash drops, ammo, health.
    for (const pk of state.pickups) {
      const bob = Math.sin(pk.bob) * 3;
      g.save();
      g.translate(pk.x, pk.y + bob);
      if (pk.pickupKind === 'cash') {
        g.fillStyle = '#1f7a44';
        g.fillRect(-11, -7, 22, 14);
        g.fillStyle = '#34d17b';
        g.fillRect(-9, -5, 18, 10);
        g.fillStyle = '#0c3d20';
        g.font = 'bold 11px sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('$', 0, 0.5);
      } else if (pk.pickupKind === 'ammo') {
        g.fillStyle = '#8a6d1f';
        g.fillRect(-9, -7, 18, 14);
        g.fillStyle = '#ffd23f';
        g.fillRect(-6, -4, 12, 8);
      } else {
        g.fillStyle = '#e8e4da';
        g.fillRect(-9, -9, 18, 18);
        g.fillStyle = '#ff3b30';
        g.fillRect(-2.5, -7, 5, 14);
        g.fillRect(-7, -2.5, 14, 5);
      }
      g.restore();
    }

    // Pedestrians.
    for (const pd of state.peds) {
      if (!pd.alive && pd.state !== 'down') continue;
      g.save();
      g.translate(pd.x, pd.y);
      if (pd.state === 'down') {
        g.rotate(pd.angle + Math.PI / 2);
        g.fillStyle = pd.shirt;
        g.beginPath();
        g.ellipse(0, 0, 13, 7, 0, 0, Math.PI * 2);
        g.fill();
      } else {
        g.rotate(pd.angle);
        g.fillStyle = '#2c2a29';
        g.beginPath();
        g.arc(9, 0, 4.5, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = pd.shirt;
        g.beginPath();
        g.arc(0, 0, 8, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#e8b98a';
        g.beginPath();
        g.arc(0, 0, 4.5, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }

    // On-foot officers.
    for (const cop of state.cops) {
      g.save();
      g.translate(cop.x, cop.y);
      g.rotate(cop.angle);
      g.fillStyle = '#274b8f';
      g.beginPath();
      g.arc(0, 0, 10, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#dfe9ff';
      g.beginPath();
      g.arc(4, 0, 5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#1d4fb8';
      g.fillRect(8, -2, 10, 4);
      g.restore();
    }

    // Cars.
    for (const car of state.cars) {
      if (car.dead && car.kind === 'traffic') continue;
      g.save();
      g.translate(car.x, car.y);
      g.rotate(car.angle);
      const len = CAR.length;
      const wid = CAR.width;
      // Wheels.
      g.fillStyle = '#141414';
      g.fillRect(-len / 2 + 6, -wid / 2 - 3, 12, 6);
      g.fillRect(len / 2 - 18, -wid / 2 - 3, 12, 6);
      g.fillRect(-len / 2 + 6, wid / 2 - 3, 12, 6);
      g.fillRect(len / 2 - 18, wid / 2 - 3, 12, 6);
      // Body.
      g.fillStyle = car.color;
      g.beginPath();
      g.roundRect(-len / 2, -wid / 2, len, wid, 8);
      g.fill();
      // Windshield + roof.
      g.fillStyle = 'rgba(20, 30, 40, 0.85)';
      g.fillRect(-6, -wid / 2 + 4, 12, wid - 8);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(len / 2 - 16, -wid / 2 + 4, 8, wid - 8);
      // Headlights.
      g.fillStyle = '#fff6b0';
      g.fillRect(len / 2 - 2, -wid / 2 + 3, 3, 5);
      g.fillRect(len / 2 - 2, wid / 2 - 8, 3, 5);
      if (car.kind === 'police') {
        g.fillStyle = '#ffffff';
        g.fillRect(-14, -wid / 2 + 3, 28, wid - 6);
        g.fillStyle = '#1d4fb8';
        g.font = 'bold 9px sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('PD', 0, 0);
        // Flashing light bar.
        const phase = Math.floor(state.time * 4 + car.sirenPhase) % 2 === 0;
        g.fillStyle = phase ? '#ff3b30' : '#2f6fed';
        g.beginPath();
        g.arc(-2, -wid / 2 - 1, 5, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = phase ? '#2f6fed' : '#ff3b30';
        g.beginPath();
        g.arc(-2, wid / 2 + 1, 5, 0, Math.PI * 2);
        g.fill();
      }
      if (car.kind === 'taxi') {
        g.fillStyle = '#111111';
        g.font = 'bold 9px sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('TAXI', 0, 0);
      }
      if (car.smoke > 0) {
        g.fillStyle = 'rgba(90,90,90,0.5)';
        g.beginPath();
        g.arc(-len / 2, 0, 10, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }

    // Bullets.
    g.strokeStyle = '#ffd23f';
    g.lineWidth = 3;
    for (const b of state.bullets) {
      g.beginPath();
      g.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
      g.lineTo(b.x, b.y);
      g.stroke();
    }

    // Rio Vega.
    g.save();
    g.translate(p.x, p.y);
    if (p.onFoot) {
      g.rotate(p.aimAngle);
      if (p.hurtTimer > 0 && Math.floor(t * 14) % 2 === 0) g.globalAlpha = 0.45;
      // Shadow.
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.beginPath();
      g.ellipse(0, 3, 13, 9, 0, 0, Math.PI * 2);
      g.fill();
      // Body: orange jacket, the heat of Solara.
      g.fillStyle = COLORS.player;
      g.beginPath();
      g.arc(0, 0, 11, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#e8b98a';
      g.beginPath();
      g.arc(3, 0, 5.5, 0, Math.PI * 2);
      g.fill();
      // Pistol in hand.
      g.fillStyle = '#222222';
      g.fillRect(8, -2, 12, 4);
      // A thin ring so Rio reads at a glance, even on busy asphalt.
      g.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(0, 0, 20, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    } else {
      g.restore();
      // A ring marks Rio's car.
      g.strokeStyle = 'rgba(255, 90, 31, 0.8)';
      g.lineWidth = 2.5;
      g.beginPath();
      g.arc(p.x, p.y, 42 + Math.sin(t * 5) * 3, 0, Math.PI * 2);
      g.stroke();
    }

    // Particles.
    for (const pt of state.particles) {
      g.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      g.fillStyle = pt.color;
      g.beginPath();
      g.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;

    // Floating texts.
    g.font = 'bold 15px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const fl of state.floaters) {
      g.globalAlpha = Math.min(1, fl.life / 0.6);
      g.fillStyle = fl.color;
      g.fillText(fl.text, fl.x, fl.y);
    }
    g.globalAlpha = 1;
  }

  return {
    state,
    reset,
    startGame,
    step,
    respawn,
    saveGame,
    drawEntities,
    loadSave,
    /** E pressed: get in the nearest car, or climb out of Rio's. */
    toggleCar() {
      const p = state.player;
      if (state.screen !== SCREEN.PLAYING) return;
      if (p.onFoot) {
        const car = nearestCar(p.x, p.y, 78);
        if (car) enterCar(car);
      } else {
        exitCar();
      }
    },
    /** F pressed: a punch, on foot only. */
    tryPunch() {
      const p = state.player;
      if (state.screen === SCREEN.PLAYING && p.onFoot && p.punchTimer <= 0) punch();
    },
  };
}
