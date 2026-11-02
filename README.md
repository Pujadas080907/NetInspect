# Agent Guide — Treasure-Island Bridge Safety Map

Keep this guide aligned with the implementation. Prefer focused changes that
preserve the existing Angular structure and deterministic graph behavior.

## Project

A local Angular application that visualizes an undirected island-and-bridge
graph and replays low-link DFS. No backend, database, account, external map
service, or live bridge data is needed.

Run from `NetInspect_Frontend`:

- `npm start` — local development server
- `npm test -- --watch=false` — Vitest tests
- `npm run build` — production build

## Where things live

- `src/app/data/archipelago.data.ts` — candidate-created graph and clone helper.
- `src/app/models/island.model.ts` — island and bridge types.
- `src/app/services/graph-analysis.ts` — graph validation, deterministic
  adjacency, low-link DFS, results, and replay events. Keep it independent of
  Angular and presentation.
- `src/app/app.ts` — owns graph, analysis, replay cursor, and derived display
  state; implements Load, Step, Run to End, and Reset.
- `src/app/app.html` — map, replay, proof table, controls, and findings.
- `src/app/app.css` and `src/styles.css` — application presentation.
- `src/app/app.spec.ts` — algorithm and replay tests.
- `README.md` — run instructions, event contract, candidate graph oracle, and
  design notes.

Do not add duplicate components or layers just to match a generic example.
The UI must display engine results, not implement another graph algorithm.

## Graph and analysis rules

- IDs match `[A-Z][A-Z0-9_-]{0,15}`. Nodes have a non-empty name and finite
  `x`/`y` coordinates in `[0, 100]`.
- Support 1–12 nodes and at most 20 undirected edges. Edge IDs must be unique;
  endpoints must exist and differ; duplicate unordered connections are invalid.
- Validate the complete graph before analysis. Invalid input clears stale
  analysis and replay and shows a useful error.
- Coordinates affect the map only. Sort roots and each adjacency list by
  ascending ASCII node ID. Use one zero-based discovery clock across components.
- For visited non-parent neighbors, update low using their discovery value.
  Classify bridges with `low[child] > discovery[parent]`, non-root articulation
  points with `low[child] >= discovery[node]`, and roots by DFS-tree child count.
- Sort final bridge and articulation IDs in ascending ASCII order.

## Replay and UI behavior

The engine records the complete event sequence once. The replay cursor reveals
events in order; it must not rerun DFS. Step advances one event. Run to End
selects the final event. Reset and Load My Archipelago restore the bundled
graph and pre-traversal view.

The UI derives map styles, table values, component count, and event explanation
from the selected event history. Keep the final critical-item summary hidden
until replay completes. Use labels, symbols, or line styles as well as color.

Current event vocabulary and ordering:

1. `discover` records discovery and initial low.
2. `inspect-tree` is emitted before recursively visiting a new child.
3. After the child completes: `return-from-child`, `tree-edge-classification`,
   then the non-root `articulation-check`.
4. `inspect-parent` records the parent edge without lowering low.
5. `inspect-visited` is followed by `back-edge-low`, including when low stays
   unchanged.
6. After all neighbors: root `articulation-check` where applicable, then
   `node-complete`; after each root, `component-complete`.

An undirected edge is encountered from both adjacency entries. Keep that
policy and event order deterministic, and update the README and tests if they
change.

## Candidate graph oracle

The bundled graph has islands A–G and bridges AB, AC, BC, CD, DE, EF, FD, EG.

Sorted adjacency:
- A: B, C
- B: A, C
- C: A, B, D
- D: C, E, F
- E: D, F, G
- F: D, E
- G: E

Discovery order: A, B, C, D, E, F, G.  
Parent / discovery / low:
- A: null / 0 / 0
- B: A / 1 / 0
- C: B / 2 / 0
- D: C / 3 / 3
- E: D / 4 / 3
- F: E / 5 / 3
- G: E / 6 / 6

Components: 1. Bridges: CD, EG. Articulation islands: C, D, E.
These values are a test oracle only; never use them to drive application
decisions.

## Tests and change checklist

Keep tests for shuffled input order, cycle-only graphs, disconnected and
isolated nodes, back-connection low propagation, bridge and articulation
inequalities, root child counts, validation failures, event ordering, replay,
and reset.

Before finishing a change, run the focused tests and production build. Update
the README when graph data, validation, event ordering, or user-facing behavior
changes. Avoid unrelated edits and unnecessary dependencies.