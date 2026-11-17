// The minimap: a scaled-down Solara Bay in the corner of the HUD — roads,
// the sea, the mission target, Rio, traffic, police and pickups, all as
// dots and lines a player can read at a glance.

import { BEACH_Y, ROADS_H, ROADS_V, SEA_Y, WORLD } from './config.js';
import { currentTarget } from './missions.js';

/** Draw the minimap inside the rectangle (x, y, w, h) of the HUD canvas. */
export function drawMinimap(g, state, x, y, w, h) {
  const sx = w / WORLD.width;
  const sy = h / WORLD.height;

  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();

  // Land, beach and sea.
  g.fillStyle = '#5d8a48';
  g.fillRect(x, y, w, h);
  g.fillStyle = '#e8d191';
  g.fillRect(x, y + BEACH_Y * sy, w, (SEA_Y - BEACH_Y) * sy);
  g.fillStyle = '#1d7f92';
  g.fillRect(x, y + SEA_Y * sy, w, h - SEA_Y * sy);

  // Roads.
  g.strokeStyle = '#3d3a38';
  g.lineWidth = Math.max(2, 140 * sx);
  g.beginPath();
  for (const rx of ROADS_V) {
    g.moveTo(x + rx * sx, y);
    g.lineTo(x + rx * sx, y + BEACH_Y * sy);
  }
  for (const ry of ROADS_H) {
    g.moveTo(x, y + ry * sy);
    g.lineTo(x + w, y + ry * sy);
  }
  g.stroke();

  const dot = (wx, wy, color, r) => {
    g.fillStyle = color;
    g.beginPath();
    g.arc(x + wx * sx, y + wy * sy, r, 0, Math.PI * 2);
    g.fill();
  };

  // Cash drops and pickups.
  for (const pk of state.pickups) {
    if (pk.alive) dot(pk.x, pk.y, '#34d17b', 2.5);
  }
  // Traffic.
  for (const car of state.cars) {
    if (car.kind === 'traffic' || car.kind === 'taxi') dot(car.x, car.y, '#ffffff', 1.8);
  }
  // Police, in red.
  for (const car of state.cars) {
    if (car.kind === 'police') dot(car.x, car.y, '#ff3b30', 2.6);
  }
  for (const cop of state.cops) dot(cop.x, cop.y, '#ff3b30', 2.2);

  // Mission target, pulsing yellow.
  const target = currentTarget(state);
  if (target) {
    const pulse = 3.5 + Math.sin(state.time * 5) * 1.5;
    g.strokeStyle = '#ffd23f';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(x + target.x * sx, y + target.y * sy, pulse + 3, 0, Math.PI * 2);
    g.stroke();
    dot(target.x, target.y, '#ffd23f', 3);
  }

  // Rio, a white arrow pointing where he faces.
  const p = state.player;
  const px = x + p.x * sx;
  const py = y + p.y * sy;
  g.save();
  g.translate(px, py);
  g.rotate(p.aimAngle);
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#111111';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(6, 0);
  g.lineTo(-4, -4);
  g.lineTo(-4, 4);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();

  // Frame.
  g.restore();
  g.strokeStyle = 'rgba(245, 241, 230, 0.85)';
  g.lineWidth = 2;
  g.strokeRect(x + 1, y + 1, w - 2, h - 2);
}
