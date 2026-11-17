// The painter for SOLARA HEAT: the city, the HUD with its minimap, and the
// title / pause / game-over screens. The camera follows Rio; the world
// draws its entities through the callback, exactly as normal play does.

import {
  BEACH_Y, COLORS, ROADS_H, ROADS_V, SEA_Y, VIEW, WORLD,
} from './config.js';
import { clamp } from './random.js';
import { BANK, SAFEHOUSE, currentMission, currentObjective } from './missions.js';
import { drawMinimap } from './minimap.js';

const MINIMAP = { x: VIEW.width - 216, y: 16, w: 200, h: 142 };

function drawStar(g, x, y, r, filled) {
  g.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(ang) * rad;
    const py = y + Math.sin(ang) * rad;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fillStyle = filled ? COLORS.gold : 'rgba(245, 241, 230, 0.25)';
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  g.lineWidth = 1;
  g.stroke();
}

export function createRenderer(canvas) {
  const g = canvas.getContext('2d');

  function drawBackground(state) {
    const cam = state.camera;
    const left = cam.x - VIEW.width / 2;
    const top = cam.y - VIEW.height / 2;
    const right = cam.x + VIEW.width / 2;
    const bottom = cam.y + VIEW.height / 2;

    // Grass, with a subtle checker of mowing strips.
    g.fillStyle = COLORS.grass;
    g.fillRect(left, top, VIEW.width, VIEW.height);
    g.fillStyle = COLORS.grassDark;
    const strip = 180;
    for (let y = Math.floor(top / strip) * strip; y < bottom; y += strip) {
      for (let x = Math.floor(left / strip) * strip; x < right; x += strip) {
        if (((x + y) / strip) % 2 === 0) g.fillRect(x, y, strip, strip);
      }
    }

    // Beach and sea along the south edge.
    g.fillStyle = COLORS.beach;
    g.fillRect(left, BEACH_Y, VIEW.width, SEA_Y - BEACH_Y);
    g.fillStyle = COLORS.sea;
    g.fillRect(left, SEA_Y, VIEW.width, WORLD.height - SEA_Y);
    g.fillStyle = COLORS.seaDeep;
    for (let y = SEA_Y + 18; y < WORLD.height; y += 34) {
      g.fillRect(left, y, VIEW.width, 5);
    }

    // Sidewalks, then roads, then lane markings and crosswalks.
    g.fillStyle = COLORS.sidewalk;
    for (const rx of ROADS_V) g.fillRect(rx - 82, 0, 164, BEACH_Y);
    for (const ry of ROADS_H) g.fillRect(0, ry - 82, WORLD.width, 164);
    g.fillStyle = COLORS.road;
    for (const rx of ROADS_V) g.fillRect(rx - 70, 0, 140, BEACH_Y);
    for (const ry of ROADS_H) g.fillRect(0, ry - 70, WORLD.width, 140);

    g.fillStyle = COLORS.lane;
    for (const rx of ROADS_V) {
      for (let y = 20; y < BEACH_Y; y += 44) {
        let inCross = false;
        for (const ry of ROADS_H) if (Math.abs(y - ry) < 90) inCross = true;
        if (!inCross) g.fillRect(rx - 2, y, 4, 22);
      }
    }
    for (const ry of ROADS_H) {
      for (let x = 20; x < WORLD.width; x += 44) {
        let inCross = false;
        for (const rx of ROADS_V) if (Math.abs(x - rx) < 90) inCross = true;
        if (!inCross) g.fillRect(x, ry - 2, 22, 4);
      }
    }
    // Crosswalk stripes at every intersection.
    g.fillStyle = 'rgba(232, 228, 218, 0.85)';
    for (const rx of ROADS_V) {
      for (const ry of ROADS_H) {
        for (let i = -3; i <= 3; i += 1) {
          g.fillRect(rx + i * 18 - 5, ry - 78, 10, 22);
          g.fillRect(rx + i * 18 - 5, ry + 56, 10, 22);
        }
      }
    }

    // Buildings and parks.
    for (const b of state.buildings) {
      if (b.x + b.w < left || b.x > right || b.y + b.h < top || b.y > bottom) continue;
      if (b.park) {
        g.fillStyle = b.color;
        g.fillRect(b.x, b.y, b.w, b.h);
        g.fillStyle = '#3f7a34';
        for (let i = 0; i < Math.floor(b.w / 46); i += 1) {
          for (let j = 0; j < Math.floor(b.h / 46); j += 1) {
            g.beginPath();
            g.arc(b.x + 26 + i * 46, b.y + 26 + j * 46, 12, 0, Math.PI * 2);
            g.fill();
          }
        }
        continue;
      }
      g.fillStyle = COLORS.buildingWall;
      g.fillRect(b.x, b.y, b.w, b.h);
      g.fillStyle = b.roof;
      g.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      g.fillStyle = 'rgba(255, 255, 255, 0.28)';
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          g.fillRect(b.x + 14 + i * 34, b.y + 14 + j * 34, 12, 9);
        }
      }
    }

    // Palms.
    for (const palm of state.palms) {
      if (palm.x < left || palm.x > right || palm.y < top || palm.y > bottom) continue;
      g.strokeStyle = '#7a5230';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(palm.x, palm.y);
      g.lineTo(palm.x + 3, palm.y - 16);
      g.stroke();
      g.fillStyle = '#3f9e4d';
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2;
        g.beginPath();
        g.ellipse(palm.x + 3 + Math.cos(a) * 9, palm.y - 16 + Math.sin(a) * 6, 10, 4, a, 0, Math.PI * 2);
        g.fill();
      }
    }

    // Landmark labels: Maya's garage (safehouse) and the bank.
    g.font = 'bold 13px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(12, 14, 20, 0.75)';
    g.fillRect(SAFEHOUSE.x - 72, SAFEHOUSE.y - 30, 144, 22);
    g.fillStyle = COLORS.gold;
    g.fillText("MAYA'S GARAGE", SAFEHOUSE.x, SAFEHOUSE.y - 19);
    g.fillStyle = 'rgba(12, 14, 20, 0.75)';
    g.fillRect(BANK.x - 62, BANK.y - 30, 124, 22);
    g.fillStyle = '#ffffff';
    g.fillText('SOLARA BANK', BANK.x, BANK.y - 19);
  }

  function drawHud(state) {
    const p = state.player;
    const mission = currentMission(state);

    // Top-left cluster: health, cash, ammo.
    g.fillStyle = COLORS.hudBg;
    g.beginPath();
    g.roundRect(14, 14, 250, 92, 10);
    g.fill();
    g.fillStyle = '#f5f1e6';
    g.font = 'bold 13px sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('RIO VEGA', 26, 30);
    // Health bar.
    g.fillStyle = '#3a1512';
    g.fillRect(26, 44, 150, 12);
    g.fillStyle = p.health > 30 ? COLORS.green : COLORS.red;
    g.fillRect(26, 44, 150 * clamp(p.health / 100, 0, 1), 12);
    g.fillStyle = '#f5f1e6';
    g.font = 'bold 12px sans-serif';
    g.fillText(`${Math.ceil(p.health)}`, 182, 50);
    g.font = 'bold 16px sans-serif';
    g.fillStyle = COLORS.gold;
    g.fillText(`$${Math.floor(p.cash)}`, 26, 76);
    g.fillStyle = '#f5f1e6';
    g.font = 'bold 13px sans-serif';
    g.fillText(`AMMO ${p.ammo}`, 120, 76);
    g.fillText(p.onFoot ? 'ON FOOT' : 'DRIVING', 26, 96);

    // Wanted stars, top centre.
    const stars = Math.floor(p.wanted);
    g.fillStyle = COLORS.hudBg;
    g.beginPath();
    g.roundRect(VIEW.width / 2 - 110, 14, 220, 44, 10);
    g.fill();
    g.fillStyle = '#f5f1e6';
    g.font = 'bold 13px sans-serif';
    g.textAlign = 'left';
    g.fillText('WANTED', VIEW.width / 2 - 98, 36);
    for (let i = 0; i < 5; i += 1) {
      drawStar(g, VIEW.width / 2 - 8 + i * 26, 36, 10, i < stars);
    }
    if (p.wanted > 0 && p.bustedTimer > 0) {
      g.fillStyle = COLORS.red;
      g.font = 'bold 13px sans-serif';
      g.fillText('BUST INCOMING!', VIEW.width / 2 - 50, 52);
    }

    // Minimap, top right.
    g.fillStyle = COLORS.hudBg;
    g.beginPath();
    g.roundRect(MINIMAP.x - 6, MINIMAP.y - 6, MINIMAP.w + 12, MINIMAP.h + 12, 10);
    g.fill();
    drawMinimap(g, state, MINIMAP.x, MINIMAP.y, MINIMAP.w, MINIMAP.h);

    // Mission tracker, bottom left.
    g.fillStyle = COLORS.hudBg;
    g.beginPath();
    g.roundRect(14, VIEW.height - 84, 430, 70, 10);
    g.fill();
    g.fillStyle = COLORS.gold;
    g.font = 'bold 13px sans-serif';
    g.textAlign = 'left';
    g.fillText(mission ? `MISSION ${state.missionIndex + 1}/5 — ${mission.name}` : 'FREE ROAM', 26, VIEW.height - 62);
    g.fillStyle = '#f5f1e6';
    g.font = '13px sans-serif';
    g.fillText(currentObjective(state), 26, VIEW.height - 40);
    const stage = mission ? mission.stages[state.missionStage] : null;
    if (stage && stage.timer) {
      const left = Math.max(0, stage.timer - state.missionTimer);
      g.fillStyle = left < 15 ? COLORS.red : COLORS.gold;
      g.font = 'bold 14px sans-serif';
      g.fillText(`${Math.ceil(left)}s`, 26, VIEW.height - 20);
    }
    if (state.fare) {
      g.fillStyle = '#34d17b';
      g.font = 'bold 13px sans-serif';
      g.fillText(state.fare.pickedUp ? `FARE — drop off ($${state.fare.pay})` : `FARE — pick up the passenger ($${state.fare.pay})`, 200, VIEW.height - 20);
    }

    // Speed + hints, bottom right.
    if (!p.onFoot && p.car) {
      g.fillStyle = COLORS.hudBg;
      g.beginPath();
      g.roundRect(VIEW.width - 150, VIEW.height - 60, 136, 46, 10);
      g.fill();
      g.fillStyle = '#f5f1e6';
      g.font = 'bold 22px sans-serif';
      g.textAlign = 'right';
      g.fillText(`${Math.round(Math.abs(p.car.speed) * 0.22)} mph`, VIEW.width - 26, VIEW.height - 36);
    }
    g.fillStyle = 'rgba(245, 241, 230, 0.75)';
    g.font = '12px sans-serif';
    g.textAlign = 'right';
    g.fillText('WASD move/drive · mouse aim · click shoot · E car · F punch · P pause · M mute', VIEW.width - 14, VIEW.height - 8);

    // Mission banner.
    if (state.banner) {
      g.save();
      g.globalAlpha = Math.min(1, state.bannerTimer);
      g.font = 'bold 20px sans-serif';
      const bw = g.measureText(state.banner).width + 60;
      g.fillStyle = COLORS.hudBg;
      g.beginPath();
      g.roundRect(VIEW.width / 2 - bw / 2, 84, bw, 46, 10);
      g.fill();
      g.fillStyle = COLORS.gold;
      g.textAlign = 'center';
      g.fillText(state.banner, VIEW.width / 2, 107);
      g.restore();
    }
  }

  function drawTitle(state, best) {
    g.fillStyle = 'rgba(10, 12, 24, 0.62)';
    g.fillRect(0, 0, VIEW.width, VIEW.height);
    // Sun.
    const sunX = VIEW.width / 2;
    const sunY = 190;
    const grad = g.createRadialGradient(sunX, sunY, 10, sunX, sunY, 190);
    grad.addColorStop(0, 'rgba(255, 210, 63, 0.95)');
    grad.addColorStop(0.55, 'rgba(255, 120, 40, 0.55)');
    grad.addColorStop(1, 'rgba(255, 120, 40, 0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(sunX, sunY, 190, 0, Math.PI * 2);
    g.fill();

    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#ffd23f';
    g.font = 'bold 92px sans-serif';
    g.fillText('SOLARA HEAT', VIEW.width / 2, 190);
    g.fillStyle = '#f5f1e6';
    g.font = 'bold 24px sans-serif';
    g.fillText('An open-city crime game — Solara Bay', VIEW.width / 2, 258);
    g.font = '17px sans-serif';
    g.fillText('Rio Vega, driver-for-hire. Steal cars, outrun the PD, run five missions,', VIEW.width / 2, 300);
    g.fillText('and take the Big Score at the Solara Bay Bank.', VIEW.width / 2, 324);

    g.fillStyle = '#ffd23f';
    g.font = 'bold 22px sans-serif';
    g.fillText('Press ENTER or click to play', VIEW.width / 2, 400);
    if (state.saveData) {
      g.fillStyle = '#34d17b';
      g.font = 'bold 17px sans-serif';
      g.fillText(`Saved game found — $${Math.floor(state.saveData.cash)}, mission ${Math.min(state.saveData.missionIndex + 1, 5)}/5. Your progress carries over.`, VIEW.width / 2, 436);
    }
    g.fillStyle = '#f5f1e6';
    g.font = '15px sans-serif';
    g.fillText('WASD move / drive · mouse aim · click shoot · E steal & enter cars · F punch', VIEW.width / 2, 500);
    g.fillText('Shift sprint · P pause · M mute · R restart after a bust', VIEW.width / 2, 524);
    g.fillText('Save is automatic — missions, cash and best score live in this browser.', VIEW.width / 2, 556);
    if (best > 0) {
      g.fillStyle = COLORS.gold;
      g.font = 'bold 16px sans-serif';
      g.fillText(`Best haul so far: $${Math.floor(best)}`, VIEW.width / 2, 596);
    }
    g.fillStyle = 'rgba(245, 241, 230, 0.6)';
    g.font = '13px sans-serif';
    g.fillText('An original game — its city, people and story are invented, not borrowed.', VIEW.width / 2, 660);
  }

  function drawPaused() {
    g.fillStyle = 'rgba(10, 12, 24, 0.6)';
    g.fillRect(0, 0, VIEW.width, VIEW.height);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#f5f1e6';
    g.font = 'bold 64px sans-serif';
    g.fillText('PAUSED', VIEW.width / 2, VIEW.height / 2 - 30);
    g.font = '18px sans-serif';
    g.fillText('P or Esc to keep playing · M to mute', VIEW.width / 2, VIEW.height / 2 + 30);
  }

  function drawGameOver(state, best) {
    const p = state.player;
    g.fillStyle = 'rgba(10, 12, 24, 0.72)';
    g.fillRect(0, 0, VIEW.width, VIEW.height);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = COLORS.red;
    g.font = 'bold 84px sans-serif';
    g.fillText(state.wasted ? 'WASTED' : 'BUSTED', VIEW.width / 2, 200);
    g.fillStyle = '#f5f1e6';
    g.font = '20px sans-serif';
    g.fillText(state.overReason, VIEW.width / 2, 268);
    g.font = 'bold 22px sans-serif';
    g.fillText(`Cash: $${Math.floor(p.cash)}   ·   Best haul: $${Math.floor(best)}`, VIEW.width / 2, 330);
    g.font = '17px sans-serif';
    g.fillText(`Missions done: ${state.missionsDone}/5   ·   Cars stolen: ${state.stats.carsStolen}   ·   Shots fired: ${state.stats.shotsFired}`, VIEW.width / 2, 366);
    g.fillStyle = '#ffd23f';
    g.font = 'bold 22px sans-serif';
    g.fillText('Press R — back on the streets', VIEW.width / 2, 430);
    g.fillStyle = '#f5f1e6';
    g.font = '15px sans-serif';
    g.fillText('Your cash and mission progress are saved.', VIEW.width / 2, 468);
  }

  function draw(state, screen, best, drawEntities) {
    g.clearRect(0, 0, VIEW.width, VIEW.height);
    // Camera: a slow drift over the city on the title screen, Rio elsewhere.
    const cam = { x: state.camera.x, y: state.camera.y };
    if (screen === 'title') {
      cam.x = 1800 + Math.cos(state.time * 0.05) * 700;
      cam.y = 1300 + Math.sin(state.time * 0.04) * 450;
    }
    g.save();
    g.translate(VIEW.width / 2 - cam.x, VIEW.height / 2 - cam.y);
    drawBackground(state);
    drawEntities(g);
    g.restore();

    // Hurt vignette.
    if (state.player.hurtTimer > 0 && screen === 'playing') {
      g.fillStyle = `rgba(255, 40, 30, ${0.18 * (state.player.hurtTimer / 0.5)})`;
      g.fillRect(0, 0, VIEW.width, VIEW.height);
    }

    if (screen === 'playing' || screen === 'paused') drawHud(state);
    if (screen === 'title') drawTitle(state, best);
    if (screen === 'paused') drawPaused();
    if (screen === 'game-over') drawGameOver(state, best);
  }

  return { draw };
}
