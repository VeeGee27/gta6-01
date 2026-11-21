# Solara Bay — Make GTA 6

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/VeeGee27/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/VeeGee27/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game in the spirit of GTA 6, playable offline in a desktop browser from static files. Rico Vega returns to Solara Bay, a sun-soaked coastal city — explore it on foot and by car, steal vehicles, outrun the SBPD, and work eight story missions for Mara Solis.

## What is in it

- A 3D city (three.js, vendored) — Downtown, Marina and Old Town, a beach, a pier and the sea, golden-hour light.
- On foot and by car: third-person camera, sprint, jump, punch, shoot, arcade driving with six car models.
- Traffic and pedestrians: AI cars on the road grid, walkers on the sidewalks who flee when scared.
- Wanted level and police: 1–5 stars, patrol cars that chase and ram, roadblocks at 3 stars, the Air One helicopter at 4.
- Eight story missions with briefings, waypoints, objectives, payouts and respect.
- HUD with a live minimap, health and armour, cash, wanted stars, speedometer, weapon slots and radio.
- Save and continue via localStorage; synthesized WebAudio sound (engine, sirens, gunshots, two radio stations).

## Play

Serve `game/` with any static server (`node serve.ts`, then open http://localhost:8080) and play with keyboard and mouse: WASD move, mouse look, E enter/exit car, F punch, click shoot, 1–4 weapons, Shift sprint, Space handbrake, R radio, M mute, Esc pause, Q missions.

## Entry

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with the vendored make.fun library:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Screenshots under `screenshots/` are real renders of the game's own code: a driving chase, a street on foot, a mission in progress, and a police chase at dusk.
