// Boot and the one loop for SOLARA HEAT: input is read every frame, the
// world advances in fixed 1/60 s steps, and the renderer paints what is
// there. The game moves between four screens: title, play, paused and
// game over (busted or wasted), with mission banners over play.
//
// ?shot=start|play|chase|end (with &seed=N) stages that scene instead of
// running the loop, paints it twice and sets window.__shotReady for a
// screenshot. ?seed=N fixes the city and spawns for normal play too.

import { SCREEN, STEP, VIEW } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import {
  ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH,
  ACTION_RESTART, createInput,
} from './input.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function draw() {
  renderer.draw(world.state, world.state.screen, world.state.best, (g) => world.drawEntities(g));
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, (g) => world.drawEntities(g));
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const rawInput = createInput(canvas);
  let muted = false;
  let accumulator = 0;
  let last = performance.now();

  // The world steps against world-space mouse coordinates: convert the
  // canvas-space mouse through the camera once per frame.
  const input = {
    axis: () => rawInput.axis(),
    get sprint() {
      return rawInput.sprint;
    },
    get firing() {
      return rawInput.firing;
    },
    takeClick: () => rawInput.takeClick(),
    takeActions: () => rawInput.takeActions(),
    get hasMouse() {
      return rawInput.hasMouse;
    },
    get mouseX() {
      return rawInput.mouseX + world.state.camera.x - VIEW.width / 2;
    },
    get mouseY() {
      return rawInput.mouseY + world.state.camera.y - VIEW.height / 2;
    },
  };

  // Screen readers (and anyone watching the page's text) hear screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.startGame();
    accumulator = 0;
    announce('Playing. Rio Vega is on the streets of Solara Bay.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      muted = world.state.audio.setMuted(!muted);
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    const screen = world.state.screen;
    if (actions & ACTION_ENTER && screen === SCREEN.PLAYING) {
      world.toggleCar();
    }
    if (actions & ACTION_PUNCH && screen === SCREEN.PLAYING) {
      world.tryPunch();
    }
    if (actions & ACTION_RESTART && screen === SCREEN.GAME_OVER) {
      world.respawn();
      announce('Back on the streets.');
      return;
    }
    if (actions & ACTION_CONFIRM && screen === SCREEN.TITLE) {
      startGame();
      return;
    }
    if (actions & ACTION_CONFIRM && screen === SCREEN.GAME_OVER) {
      world.respawn();
      announce('Back on the streets.');
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN.PLAYING) {
      world.state.screen = SCREEN.PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN.PAUSED) {
      world.state.screen = SCREEN.PLAYING;
      announce('Playing.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    // Step the world in fixed slices while it is on a screen that moves.
    // PAUSED freezes the simulation; TITLE idles the city behind the menu.
    while (accumulator >= STEP) {
      const screen = world.state.screen;
      if (screen === SCREEN.PAUSED) break;
      const prevScreen = world.state.screen;
      world.step(STEP, input);
      accumulator -= STEP;
      if (world.state.screen === SCREEN.GAME_OVER && prevScreen !== SCREEN.GAME_OVER) {
        announce(`${world.state.overReason} Press R to get back on the streets.`);
      }
    }
    if (world.state.screen === SCREEN.PAUSED) accumulator = 0;
    draw();
  }

  // Leaving the tab pauses a running game rather than letting the PD catch Rio unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && world.state.screen === SCREEN.PLAYING) {
      world.state.screen = SCREEN.PAUSED;
      announce('Paused.');
    }
  });

  announce('SOLARA HEAT. Press Enter or click to play.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
