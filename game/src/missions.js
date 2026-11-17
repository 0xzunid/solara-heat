// The story of SOLARA HEAT: five missions for Rio Vega, driver-for-hire,
// plus repeatable side work (taxi fares and street cash drops). A mission is
// a list of stages; each stage names an objective, a target point and what
// completes it. The world calls updateMission every step; this module only
// describes the story and moves stages forward.

export const MISSIONS = [
  {
    name: 'First Fare',
    brief: 'Maya needs a driver. Get in any car, pick up the fare on Coral Ave, and drop them at the Marina Hotel.',
    reward: 150,
    stages: [
      { objective: 'Get in a car', target: null, needsCar: true },
      { objective: 'Pick up the fare on Coral Ave', target: { x: 1500, y: 1400 }, radius: 90 },
      { objective: 'Drop the fare at the Marina Hotel', target: { x: 2700, y: 850 }, radius: 90 },
    ],
  },
  {
    name: 'Hot Wheels',
    brief: 'A client wants the gold coupe parked by the pier — no questions. Steal it and bring it to Maya\u2019s garage.',
    reward: 300,
    stages: [
      { objective: 'Find the gold coupe by the pier', target: { x: 2100, y: 1950 }, radius: 120 },
      { objective: 'Steal the gold coupe (E)', target: { x: 2100, y: 1950 }, radius: 120, needsSteal: true },
      { objective: 'Deliver the coupe to Maya\u2019s garage', target: { x: 450, y: 450 }, radius: 100, needsCar: true },
    ],
  },
  {
    name: 'Beach Run',
    brief: 'A package is waiting on Sunset Row. Grab it and get it to the south pier in 90 seconds — the tide waits for no one.',
    reward: 400,
    stages: [
      { objective: 'Pick up the package on Sunset Row', target: { x: 3300, y: 300 }, radius: 90 },
      { objective: 'Deliver the package to the south pier — 90s!', target: { x: 300, y: 2350 }, radius: 90, timer: 90 },
    ],
  },
  {
    name: 'Heat Wave',
    brief: 'The Solara PD is on your tail. Lose the heat: stay out of sight and survive 60 seconds with the cops hunting you.',
    reward: 500,
    stages: [
      { objective: 'Survive the heat — 60s', target: null, timer: 60, timerCompletes: true, forceWanted: 3 },
    ],
  },
  {
    name: 'The Big Score',
    brief: 'The Solara Bay Bank. Walk in, grab the cash, and get back to Maya\u2019s garage before the whole city locks down.',
    reward: 1000,
    stages: [
      { objective: 'Reach the Solara Bay Bank', target: { x: 1500, y: 850 }, radius: 110 },
      { objective: 'Grab the cash — hold your nerve', target: { x: 1500, y: 850 }, radius: 110, holdSeconds: 3, forceWanted: 5 },
      { objective: 'Escape to Maya\u2019s garage', target: { x: 450, y: 450 }, radius: 100 },
    ],
  },
];

export const SAFEHOUSE = { x: 450, y: 450 };
export const BANK = { x: 1500, y: 850 };

/** The mission Rio is on right now, or null once the story is done. */
export function currentMission(state) {
  return state.missionIndex < MISSIONS.length ? MISSIONS[state.missionIndex] : null;
}

/** Objective text for the HUD tracker. */
export function currentObjective(state) {
  const mission = currentMission(state);
  if (!mission) {
    return state.fare ? 'Fare: drop off your passenger' : 'Free roam — fares and cash drops pay';
  }
  const stage = mission.stages[state.missionStage];
  return `${mission.name}: ${stage.objective}`;
}

/** The world-space target the minimap and the HUD arrow point at. */
export function currentTarget(state) {
  const mission = currentMission(state);
  if (!mission) return state.fare ? state.fare.dest : null;
  const stage = mission.stages[state.missionStage];
  if (stage.target) return stage.target;
  if (state.fare) return state.fare.dest;
  return null;
}

/** (Re)start the current mission: reset its stage and timers. */
export function startMission(state) {
  state.missionStage = 0;
  state.missionTimer = 0;
  state.missionHold = 0;
  const mission = currentMission(state);
  if (!mission) return;
  const stage = mission.stages[0];
  if (stage.forceWanted) {
    state.player.wanted = Math.max(state.player.wanted, stage.forceWanted);
    state.player.wantedHeat = state.player.wanted;
  }
}

/**
 * Advance the current mission one step. Returns 'complete' when a mission
 * pays out, 'failed' when a timed stage runs out, else null. Side effects
 * (cash, banners, save) live in the world, which reads the return.
 */
export function updateMission(state, dt) {
  const mission = currentMission(state);
  if (!mission) return null;
  const stage = mission.stages[state.missionStage];
  const p = state.player;

  if (stage.timer) {
    state.missionTimer += dt;
    if (state.missionTimer >= stage.timer) {
      // A survival stage completes when its clock runs out; a delivery
      // stage fails when its clock runs out.
      if (stage.timerCompletes) return advance(state, mission);
      return 'failed';
    }
  }

  if (stage.needsCar && !p.car) return null;
  if (stage.needsSteal && (!p.car || !p.car.stolen)) return null;

  if (stage.holdSeconds) {
    const d2 = (p.x - stage.target.x) ** 2 + (p.y - stage.target.y) ** 2;
    if (d2 < stage.radius * stage.radius) {
      state.missionHold += dt;
      if (state.missionHold >= stage.holdSeconds) {
        if (stage.forceWanted) {
          p.wanted = Math.max(p.wanted, stage.forceWanted);
          p.wantedHeat = p.wanted;
        }
        return advance(state, mission);
      }
    } else {
      state.missionHold = 0;
    }
    return null;
  }

  if (stage.target) {
    const d2 = (p.x - stage.target.x) ** 2 + (p.y - stage.target.y) ** 2;
    if (d2 < stage.radius * stage.radius) return advance(state, mission);
  } else if (stage.needsCar || stage.needsSteal) {
    return advance(state, mission);
  }
  return null;
}

function advance(state, mission) {
  state.missionStage += 1;
  state.missionTimer = 0;
  state.missionHold = 0;
  if (state.missionStage >= mission.stages.length) return 'complete';
  const next = mission.stages[state.missionStage];
  if (next.forceWanted) {
    state.player.wanted = Math.max(state.player.wanted, next.forceWanted);
    state.player.wantedHeat = state.player.wanted;
  }
  return null;
}

/** Pay out a finished mission and move to the next one. */
export function completeMission(state) {
  const mission = currentMission(state);
  if (!mission) return 0;
  state.missionIndex += 1;
  state.missionsDone += 1;
  state.missionStage = 0;
  state.missionTimer = 0;
  state.missionHold = 0;
  return mission.reward;
}
