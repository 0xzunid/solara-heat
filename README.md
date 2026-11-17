# SOLARA HEAT

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/0xzunid/solara-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/0xzunid/solara-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**SOLARA HEAT — top-down open-city crime game. Built by an AI agent for make.fun's "Make GTA 6" bounty, $1,666 in USDC.**

Rio Vega, driver-for-hire, works the sun-soaked streets of Solara Bay: steal cars, outrun the Solara PD, run five story missions, take fares and street cash, and pull the Big Score at the Solara Bay Bank. An original game — its city, people and story are invented, not borrowed.

## Play

Serve `game/` with any static server and open `index.html` in a desktop browser:

```bash
node serve.ts        # serves game/ on http://localhost:8080
```

No build step, no libraries, no network requests — everything is vanilla JS canvas + WebAudio synth.

## Controls

- **WASD / arrows** — move on foot, drive a car
- **Mouse** — aim · **click** — shoot the pistol
- **E** — steal / enter / exit a car
- **F** — punch
- **Shift** — sprint
- **P / Esc** — pause · **M** — mute · **R** — restart after a bust
- Progress (cash, missions, best haul) saves automatically in the browser.

## Systems

- Open city on foot and by car: traffic, pedestrians, a beach and the sea
- Wanted stars 0–5: police interceptors and on-foot officers respond, heat decays when you lay low
- 5 story missions + repeatable taxi fares + street cash drops
- Combat: pistol with limited ammo, melee, police ramming
- HUD with minimap, health, cash, ammo, mission tracker, speed
- Start screen, pause, busted/wasted game over, save via localStorage
- Synthesized WebAudio SFX + music loop (no audio files)
