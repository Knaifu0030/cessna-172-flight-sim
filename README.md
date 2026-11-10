# Cessna 172 Flight Sim

VOCB Skyhawk trainer

Browser flight simulator: Cessna 172S at Coimbatore International (VOCB).
One self-contained HTML page; three.js r128 is loaded from cdnjs, everything
else (models, textures, sound) is generated in code.

## Build and run

    npm ci
    npm run build            # writes dist/index.html
    npm start                # http://localhost:8080

`dist/index.html` is already built and is the same file that is published.

## Layout

| File | What it holds |
|---|---|
| `template.html` | Page shell, all CSS, menu / HUD / debrief markup |
| `src/01_core.js` | Constants, aerodrome data, terrain height, settings store |
| `src/02_env.js` | Clock, sun and moon, weather presets, atmosphere, wind, ATIS |
| `src/03_fdm.js` | Flight model: aerodynamics, engine and propeller, landing gear, systems |
| `src/04_geom.js` | Geometry batching, lofts, wing sections, textures, light points |
| `src/05_world.js` | Terrain, hills, sky, stars, clouds, rain, city, trees, roads |
| `src/06_airport.js` | Runway, taxiways, aprons, markings, lighting, PAPI, buildings |
| `src/07_model.js` | Cessna exterior, animated surfaces, cockpit interior and 3D controls |
| `src/08_panel.js` | Analog and glass instrument panels, nav radio logic, moving map |
| `src/09_input.js` | Keyboard, mouse, gamepad (remappable), touch, tilt, cockpit actions |
| `src/10_audio.js` | Synthesised engine, wind, stall horn and effects (Web Audio) |
| `src/11_lessons.js` | Start positions, flight metrics, Tower prompts, 8 lessons, debriefs |
| `src/12_ui.js` | Menus, weather and settings controls, HUD, touch controls, debrief |
| `src/13_main.js` | Renderer, lighting, camera views, main loop, start / pause / reset |

Modules are concatenated in filename order into one closure; they share the
`FS` namespace and the helpers defined in `01_core.js`.

## Tests (optional)

Install dependencies with `npm ci`, then `npx playwright install chromium`.
Run `npm test` for flight-model diagnostics and `npm run test:browser` for
asserted desktop/mobile checks: loading, rendering, start, pause/resume, and
initialization of all eight lessons. Set `TEST_URL` to check a deployed site.
Optionally set `CHROMIUM_PATH` to an existing Chromium executable.

- `flight_model_check.js`: runs the flight model alone in Node and prints
  approach power, lift-off, climb, stall and top speed. Run from the project
  root: `node tests/flight_model_check.js`.
- `fly.js` + `harness.js`: load `dist/index.html` in headless Chromium and fly
  scripted lessons (`circuit_lesson.js`, `takeoff_approach_efato.js`,
  `taxi_and_startup.js`). Run from the repository root.

## Tuning points

- Aircraft weight, lift, drag and propeller constants: `FS.P` and the flap
  tables at the top of `src/03_fdm.js`.
- Aerodrome coordinates and frequencies: `AD` in `src/01_core.js`.
- Apron, taxiway and building rectangles: `A.paved`, `A.stands`,
  `A.buildings` at the top of `src/06_airport.js`.
- Quality presets: `pickQuality()` in `src/13_main.js`.
