// The Solara Bay PD: wanted stars, police interceptors that hunt Rio's car,
// on-foot officers who try to bust him, and the quiet timer that lets the
// heat die down when nobody is watching.

import { CAR, COP, WANTED, WORLD } from './config.js';
import { angleDelta, clamp } from './random.js';
import { makeCar, makeCop } from './entities.js';

const SPAWN_DIST = 650;

/** Add heat to the wanted level, clamped at the 5-star max. */
export function addWanted(player, amount) {
  player.wanted = clamp(player.wanted + amount, 0, WANTED.max);
  player.wantedHeat = player.wanted;
}

function nearestRoadPoint(rng, x, y) {
  // Drop a police unit on a road near the player, at spawn distance.
  const roadsV = [300, 900, 1500, 2100, 2700, 3300];
  const roadsH = [300, 850, 1400, 1950, 2350];
  for (let tries = 0; tries < 12; tries += 1) {
    const vertical = rng.chance(0.5);
    let px;
    let py;
    if (vertical) {
      px = roadsV[Math.floor(rng.next() * roadsV.length)];
      py = clamp(y + (rng.chance(0.5) ? -1 : 1) * rng.range(500, 900), 100, WORLD.height - 100);
    } else {
      px = clamp(x + (rng.chance(0.5) ? -1 : 1) * rng.range(500, 900), 100, WORLD.width - 100);
      py = roadsH[Math.floor(rng.next() * roadsH.length)];
    }
    const d = Math.hypot(px - x, py - y);
    if (d > 420 && d < 1100) return { x: px, y: py };
  }
  return { x: clamp(x + SPAWN_DIST, 100, WORLD.width - 100), y: clamp(y, 100, WORLD.height - 100) };
}

function policeCarCount(wanted) {
  return Math.min(4, wanted);
}

function copCount(wanted) {
  return wanted >= 2 ? Math.min(4, wanted - 1) : 0;
}

/**
 * Keep the police response matched to the wanted level, steer the
 * interceptors, march the officers, and decay the heat when Rio is quiet
 * and unseen. Mutates the world state in place.
 */
export function updatePolice(state, dt) {
  const p = state.player;
  const rng = state.rng;

  // --- Wanted decay: quiet, unseen, and out of trouble. ---
  const policeNear = state.cars.some((c) => c.kind === 'police' && Math.hypot(c.x - p.x, c.y - p.y) < 420)
    || state.cops.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 380);
  if (p.wanted > 0 && !policeNear && state.quietTimer !== undefined) {
    state.quietTimer += dt;
    if (state.quietTimer >= WANTED.decaySeconds) {
      state.quietTimer = 0;
      p.wanted = Math.max(0, p.wanted - 1);
      p.wantedHeat = p.wanted;
    }
  } else {
    state.quietTimer = 0;
  }

  // --- Spawn interceptors up to the wanted level. ---
  const wantCars = policeCarCount(Math.floor(p.wanted));
  const haveCars = state.cars.filter((c) => c.kind === 'police' && !c.dead).length;
  if (haveCars < wantCars && state.spawnTimer <= 0) {
    const spot = nearestRoadPoint(rng, p.x, p.y);
    const car = makeCar(rng, spot.x, spot.y, { kind: 'police', angle: 0, speed: 120 });
    car.sirenPhase = rng.range(0, 6.28);
    state.cars.push(car);
    state.spawnTimer = 1.2;
  }
  state.spawnTimer = Math.max(0, state.spawnTimer - dt);

  // --- Spawn on-foot officers. ---
  const wantCops = copCount(Math.floor(p.wanted));
  if (state.cops.length < wantCops && state.spawnTimer <= 0) {
    const spot = nearestRoadPoint(rng, p.x, p.y);
    state.cops.push(makeCop(spot.x, spot.y));
    state.spawnTimer = 1.2;
  }

  // --- Interceptor AI: steer at Rio, ram, and keep up. ---
  for (const car of state.cars) {
    if (car.kind !== 'police' || car.dead) continue;
    const target = Math.atan2(p.y - car.y, p.x - car.x);
    const turn = clamp(angleDelta(car.angle, target), -2.4 * dt, 2.4 * dt);
    car.angle += turn;
    const wantSpeed = Math.min(CAR.policeSpeed, 380 + p.wanted * 45);
    car.speed += clamp(wantSpeed - car.speed, -500 * dt, 320 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(car.x, 40, WORLD.width - 40);
    car.y = clamp(car.y, 40, WORLD.height - 40);
    // Ram damage when the interceptor reaches Rio.
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < 46 && state.hurtCooldown <= 0) {
      damagePlayer(state, 12, car.x, car.y);
      car.speed *= -0.3;
    }
  }

  // --- Officer AI: run Rio down on foot, bust him on contact. ---
  for (const cop of state.cops) {
    if (!cop.alive) continue;
    const d = Math.hypot(p.x - cop.x, p.y - cop.y);
    const target = Math.atan2(p.y - cop.y, p.x - cop.x);
    cop.angle += clamp(angleDelta(cop.angle, target), -3 * dt, 3 * dt);
    cop.speed = COP.runSpeed;
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    if (p.onFoot && d < 30 && p.wanted > 0) {
      p.bustedTimer += dt;
      if (p.bustedTimer >= COP.bustSeconds) {
        state.busted = true;
      }
    }
    if (d > 1500) cop.alive = false; // lost him: the officer gives up
  }
  state.cops = state.cops.filter((c) => c.alive);

  // Despawn police far away once the heat is gone.
  if (p.wanted === 0) {
    for (const car of state.cars) {
      if (car.kind === 'police' && Math.hypot(car.x - p.x, car.y - p.y) > 1300) car.dead = true;
    }
    state.cars = state.cars.filter((c) => !(c.kind === 'police' && c.dead));
  }
}

export function damagePlayer(state, amount, fromX, fromY) {
  const p = state.player;
  if (state.screen !== 'playing' || state.hurtCooldown > 0) return;
  p.health -= amount;
  p.hurtTimer = 0.5;
  state.hurtCooldown = 0.7;
  state.audio.crash();
  if (p.health <= 0) {
    p.health = 0;
    state.wasted = true;
  }
}
