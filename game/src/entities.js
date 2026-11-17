// Entity factories for SOLARA HEAT. Entities are plain objects; the world
// owns the lists and the update rules, the renderer owns how they look.
// Nothing here knows about the screen, the camera or the DOM.

import { BULLET, CAR, COLORS, PED, PLAYER } from './config.js';

let nextId = 1;

export function makePlayer(x, y) {
  return {
    id: nextId++,
    kind: 'player',
    x,
    y,
    angle: -Math.PI / 2,
    aimAngle: -Math.PI / 2,
    health: PLAYER.health,
    cash: 50,
    ammo: PLAYER.startAmmo,
    wanted: 0,
    wantedHeat: 0,
    onFoot: true,
    car: null, // the car object Rio is driving, or null
    speed: 0,
    fireTimer: 0,
    punchTimer: 0,
    hurtTimer: 0,
    bustedTimer: 0,
    sprinting: false,
    moving: false,
  };
}

const CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e8c33a', '#e8e4da', '#5b5b66', '#7fb069', '#c77dff', '#ff8c42'];

/** A traffic car, a parked car, a taxi, or a police interceptor. */
export function makeCar(rng, x, y, opts = {}) {
  const kind = opts.kind || 'traffic';
  return {
    id: nextId++,
    kind,
    x,
    y,
    angle: opts.angle ?? 0,
    speed: opts.speed ?? 0,
    color: opts.color ?? (kind === 'police' ? COLORS.police : kind === 'taxi' ? COLORS.taxi : rng.pick(CAR_COLORS)),
    health: CAR.health,
    driver: kind === 'traffic' || kind === 'taxi',
    roadAxis: opts.roadAxis || 'v', // 'v' drives along a vertical road, 'h' along a horizontal one
    roadIndex: opts.roadIndex ?? 0,
    dir: opts.dir || 1,
    lane: opts.lane ?? 35,
    cruise: CAR.trafficSpeed * rng.range(0.8, 1.15),
    stuck: 0,
    smoke: 0,
    sirenPhase: rng.range(0, 6.28),
    dead: false,
  };
}

/** A pedestrian strolling the sidewalks of Solara Bay. */
export function makePed(rng, x, y) {
  return {
    id: nextId++,
    kind: 'ped',
    x,
    y,
    angle: rng.range(0, Math.PI * 2),
    speed: 0,
    targetAngle: rng.range(0, Math.PI * 2),
    shirt: rng.pick(COLORS.pedShirt),
    state: 'walk', // walk | flee | down
    fleeTimer: 0,
    retarget: rng.range(1, 4),
    alive: true,
  };
}

/** An on-foot Solara Bay police officer. */
export function makeCop(x, y) {
  return {
    id: nextId++,
    kind: 'cop',
    x,
    y,
    angle: 0,
    speed: 0,
    alive: true,
  };
}

export function makeBullet(x, y, angle) {
  return {
    id: nextId++,
    kind: 'bullet',
    x,
    y,
    vx: Math.cos(angle) * BULLET.speed,
    vy: Math.sin(angle) * BULLET.speed,
    travelled: 0,
    alive: true,
  };
}

/** Cash drop, ammo box or health pack left on the street. */
export function makePickup(rng, x, y, kind, amount) {
  return {
    id: nextId++,
    kind: 'pickup',
    pickupKind: kind, // 'cash' | 'ammo' | 'health'
    x,
    y,
    amount,
    ttl: kind === 'cash' ? 40 : 60,
    bob: rng.range(0, 6.28),
    alive: true,
  };
}

export function makeParticle(x, y, vx, vy, life, color, size) {
  return { id: nextId++, kind: 'particle', x, y, vx, vy, life, maxLife: life, color, size };
}

export function makeFloater(x, y, text, color) {
  return { id: nextId++, kind: 'floater', x, y, text, color, life: 1.4, maxLife: 1.4 };
}

/** A puff of tyre smoke, muzzle flash sparks or a blood-free impact burst. */
export function burst(list, x, y, color, count, speed, life, size) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.8);
    list.push(makeParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.6 + Math.random() * 0.7), color, size));
  }
}
