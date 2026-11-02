# Treasure-Island Bridge Safety Map

An offline-first Angular application for replaying deterministic low-link DFS
over an undirected festival bridge network. The map is presentation-only; the
analysis engine validates and calculates from node and edge IDs.

## Run and verify

```bash
npm install
npm start
npm test
npm run build
```

The app starts with the candidate-created archipelago. Use **Step** to reveal
one event, **Run to End** to finish the same event sequence, and **Reset** to
restore the original graph and pre-traversal state.

## Candidate graph and independently documented result

The seven islands are Adventure Bay (A), Treasure Cove (B), Festival Harbor
(C), Lantern Island (D), Music Island (E), Sunset Beach (F), and First Aid
Island (G). It has eight undirected bridges: AB, AC, BC, CD, DE, EF, FD, EG.
Coordinates affect only the SVG layout.

| Island ID | Sorted neighbours |
| --------- | ----------------- |
| A         | B, C              |
| B         | A, C              |
| C         | A, B, D           |
| D         | C, E, F           |
| E         | D, F, G           |
| F         | D, E              |
| G         | E                 |

| Discovery order | Parent | Discovery | Low |
| --------------- | -----: | --------: | --: |
| A               |      — |         0 |   0 |
| B               |      A |         1 |   0 |
| C               |      B |         2 |   0 |
| D               |      C |         3 |   3 |
| E               |      D |         4 |   3 |
| F               |      E |         5 |   3 |
| G               |      E |         6 |   6 |

- Components: **1**
- Critical bridges (ASCII-sorted IDs): **CD, EG**
- Articulation islands (ASCII-sorted IDs): **C, D, E**

These are a hand-derived test oracle, not application input. Tests compare the
engine's independently produced output to this result.

## Replay event contract

The event record contains a one-based sequence number, kind, explanation, and
the relevant node, child, edge, low-value, or classification fields. An
undirected edge is inspected at each endpoint's sorted adjacency visit:

1. A tree edge is recorded before recursion; its child is then discovered.
2. A completed child returns to its parent and records old/new parent low.
3. The tree edge is classified with `low[child] > discovery[parent]`.
4. For a non-root parent, an articulation check records
   `low[child] >= discovery[parent]`.
5. A visited non-parent connection is inspected, then its old/new low is
   recorded (even when the value stays the same). Parent-edge inspections do
   not lower low.
6. After all neighbours, a root gets its child-count articulation check, then
   the node completes. After a root completes, the component-complete event is
   emitted.

The replay view applies only events through the current cursor. Thus the
current event, map styles, proof table, component count, and final findings all
advance from one recorded sequence. Final findings are withheld until replay
completion, while the full history remains visible after **Run to End**.

## Design and AI prompting notes

Implementation checkpoints:

1. Inspect the Angular workspace and establish the existing graph data and test
   setup.
2. Build a framework-independent validator and deterministic low-link engine.
3. Connect the engine's recorded events to an SVG map, proof table, controls,
   and final safety summary.
4. Verify traversal invariants, validation failures, replay ordering, and reset
   with focused Vitest tests and a production build.

Relevant prompt used: “Implement the Treasure-Island Bridge Safety Map
specification in this Angular workspace. Keep graph analysis deterministic and
independent of layout, validate the entire graph before traversal, make replay
events explain low-link and critical-item decisions, and add focused tests for
the required graph, validation, ordering, and reset cases.”

The implementation keeps the existing Angular stack, uses a pure TypeScript
analysis module with typed event records, and draws the map with inline SVG.
This avoids map services and runtime data dependencies. Recursive DFS was
chosen because the graph is bounded at 12 nodes and it directly represents the
required child-return order. A replay cursor folds the recorded events to keep
all visible proof state synchronized instead of running a second visual
algorithm.
