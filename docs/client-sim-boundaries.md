# Client Simulation Boundaries

This document maps the current `client.js` monolith into extraction slices for the server-authoritative migration.

## Runtime Layers

### Shared simulation candidates

- `client.js`: `stepCities`
- `client.js`: `rebuildZoneGrid`
- `client.js`: `stepCombat`
- `client.js`: `stepBullets`
- `client.js`: `stepUnits` movement logic only
- `client.js`: bot helpers and `botThink`
- `net.js`: snapshot serializer contract
- `host-sim-runtime.js`: orchestration shell for authoritative ticks
- `front-planner.js`, `squad-logic.js`, `formations.js`, `combat.js`, `card-system.js`: already reusable logic modules

### Client-only rendering and UX

- `client.js`: PIXI stage setup, HUD wiring, audio, input listeners
- `visual-tick-runtime.js`
- `remote-client-runtime.js`
- `snapshot-sync.js`
- `music-player.js`
- all `*-renderer.js`

### Transport and session

- `server.js`
- `socket-session.js`
- `action-gateway.js`
- `match-session.js`
- `host-network-runtime.js`

## High-value extraction order

### Slice 1

Move the headless-friendly economy/territory pipeline out of `client.js` first:

- `stepCities`
- `rebuildZoneGrid`
- terrain/influence helpers used by `stepCities`

This gives the server a deterministic, shared simulation foothold with low PIXI coupling.

### Slice 2

Move combat resolution that mutates authoritative state but split presentation side effects:

- `stepCombat`
- `stepBullets`
- `killUnit` rules branch
- `destroyCity` rules branch

Client effects such as sounds, floating text, and visuals should be injected as optional callbacks.

### Slice 3

Split `stepUnits` into:

- shared movement / path / collision resolution
- client-only visual sync (`u.gfx`, trails, redraws, filters)

The shared branch will be used by the Node authoritative runtime. The visual branch stays in the browser.

## Current host runtime dependency seam

`host-sim-runtime.js` already acts as the orchestrator for an authoritative tick. The install call in `client.js` is the current seam that must be replaced with shared modules:

- `stepCities`
- `botThink`
- `stepUnits`
- `stepCombat`
- `stepBullets`
- environment helpers like `getUnitAtkRange`, `shieldRadius`, `getPlanetRadius`

## Refactor rules

- Keep state mutation in shared modules.
- Move visuals, sounds, HUD, and DOM calls behind injected callbacks or leave them client-side.
- Keep `net.js` as the snapshot contract shared by server and clients.
- Avoid direct references to browser globals inside shared simulation code.
