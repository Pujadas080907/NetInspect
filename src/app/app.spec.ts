import { TestBed } from '@angular/core/testing';
import { ARCHIPELAGO, cloneArchipelago } from './data/archipelago.data';
import { App } from './app';
import {
  analyzeGraph,
  GraphDefinition,
  GraphValidationError,
  ReplayEvent,
} from './services/graph-analysis';

describe('low-link graph analysis', () => {
  it('documents the deterministic main archipelago proof', () => {
    const result = analyzeGraph(cloneArchipelago());

    expect(Object.fromEntries(result.adjacency)).toEqual({
      A: ['B', 'C'],
      B: ['A', 'C'],
      C: ['A', 'B', 'D'],
      D: ['C', 'E', 'F'],
      E: ['D', 'F', 'G'],
      F: ['D', 'E'],
      G: ['E'],
    });
    expect(result.discoveryOrder).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    expect(result.proof).toEqual([
      { id: 'A', parent: null, discovery: 0, low: 0 },
      { id: 'B', parent: 'A', discovery: 1, low: 0 },
      { id: 'C', parent: 'B', discovery: 2, low: 0 },
      { id: 'D', parent: 'C', discovery: 3, low: 3 },
      { id: 'E', parent: 'D', discovery: 4, low: 3 },
      { id: 'F', parent: 'E', discovery: 5, low: 3 },
      { id: 'G', parent: 'E', discovery: 6, low: 6 },
    ]);
    expect(result.componentCount).toBe(1);
    expect(result.bridgeIds).toEqual(['CD', 'EG']);
    expect(result.articulationIds).toEqual(['C', 'D', 'E']);
  });

  it('does not depend on source node or edge array order', () => {
    const shuffled = cloneArchipelago();
    shuffled.nodes.reverse();
    shuffled.edges.reverse();

    const expected = analyzeGraph(ARCHIPELAGO);
    const actual = analyzeGraph(shuffled);
    expect(actual.discoveryOrder).toEqual(expected.discoveryOrder);
    expect(actual.proof).toEqual(expected.proof);
    expect(actual.componentCount).toBe(expected.componentCount);
    expect(actual.bridgeIds).toEqual(expected.bridgeIds);
    expect(actual.articulationIds).toEqual(expected.articulationIds);
    expect(Object.fromEntries(actual.adjacency)).toEqual(Object.fromEntries(expected.adjacency));
  });

  it('finds no critical items in a cycle-only graph', () => {
    const cycle: GraphDefinition = {
      nodes: [
        { id: 'A', name: 'A', x: 10, y: 10 },
        { id: 'B', name: 'B', x: 50, y: 10 },
        { id: 'C', name: 'C', x: 30, y: 60 },
      ],
      edges: [
        { id: 'AB', source: 'A', target: 'B' },
        { id: 'BC', source: 'B', target: 'C' },
        { id: 'CA', source: 'C', target: 'A' },
      ],
    };

    const result = analyzeGraph(cycle);
    expect(result.componentCount).toBe(1);
    expect(result.bridgeIds).toEqual([]);
    expect(result.articulationIds).toEqual([]);
  });

  it('uses root child count and counts disconnected and isolated components', () => {
    const graph: GraphDefinition = {
      nodes: [
        { id: 'A', name: 'A', x: 10, y: 10 },
        { id: 'B', name: 'B', x: 20, y: 20 },
        { id: 'C', name: 'C', x: 30, y: 30 },
        { id: 'D', name: 'D', x: 40, y: 40 },
        { id: 'E', name: 'E', x: 50, y: 50 },
        { id: 'F', name: 'F', x: 60, y: 60 },
      ],
      edges: [
        { id: 'AB', source: 'A', target: 'B' },
        { id: 'AC', source: 'A', target: 'C' },
        { id: 'DE', source: 'D', target: 'E' },
      ],
    };

    const result = analyzeGraph(graph);
    expect(result.discoveryOrder).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(result.componentCount).toBe(3);
    expect(result.bridgeIds).toEqual(['AB', 'AC', 'DE']);
    expect(result.articulationIds).toEqual(['A']);
    expect(result.proof.filter((node) => node.parent === null).map((node) => node.id)).toEqual([
      'A',
      'D',
      'F',
    ]);
  });

  it('propagates a back-connection low value to ancestors', () => {
    const result = analyzeGraph({
      nodes: [
        { id: 'A', name: 'A', x: 10, y: 10 },
        { id: 'B', name: 'B', x: 20, y: 20 },
        { id: 'C', name: 'C', x: 30, y: 30 },
      ],
      edges: [
        { id: 'AB', source: 'A', target: 'B' },
        { id: 'AC', source: 'A', target: 'C' },
        { id: 'BC', source: 'B', target: 'C' },
      ],
    });

    expect(result.proof.find((node) => node.id === 'C')?.low).toBe(0);
    expect(result.proof.find((node) => node.id === 'B')?.low).toBe(0);
    expect(
      result.events.some((event) => event.kind === 'back-edge-low' && event.newLow === 0),
    ).toBe(true);
  });

  it('uses strict bridge and inclusive non-root articulation inequalities', () => {
    const equalityCase = analyzeGraph({
      nodes: ['A', 'B', 'C', 'D'].map((id, index) => ({
        id,
        name: id,
        x: index * 10,
        y: index * 10,
      })),
      edges: [
        { id: 'AB', source: 'A', target: 'B' },
        { id: 'BC', source: 'B', target: 'C' },
        { id: 'CD', source: 'C', target: 'D' },
        { id: 'DB', source: 'D', target: 'B' },
      ],
    });

    expect(equalityCase.proof.find((node) => node.id === 'C')?.low).toBe(1);
    expect(equalityCase.bridgeIds).toEqual(['AB']);
    expect(equalityCase.articulationIds).toEqual(['B']);
    expect(
      equalityCase.events.some(
        (event) =>
          event.kind === 'articulation-check' && event.nodeId === 'B' && event.isArticulation,
      ),
    ).toBe(true);
  });

  it('emits inspection, discovery, return, classification, and articulation in fixed order', () => {
    const { events } = analyzeGraph(ARCHIPELAGO);
    const index = (kind: ReplayEvent['kind'], edgeId: string): number =>
      events.findIndex((event) => event.kind === kind && event.edgeId === edgeId);
    const treeInspection = index('inspect-tree', 'CD');
    const childDiscovery = events.findIndex(
      (event) => event.kind === 'discover' && event.nodeId === 'D',
    );
    const childCompletion = events.findIndex(
      (event) => event.kind === 'node-complete' && event.nodeId === 'D',
    );
    const returnFromChild = index('return-from-child', 'CD');
    const classification = index('tree-edge-classification', 'CD');
    const articulationCheck = events.findIndex(
      (event) =>
        event.kind === 'articulation-check' && event.nodeId === 'C' && event.childId === 'D',
    );

    expect(treeInspection).toBeLessThan(childDiscovery);
    expect(childDiscovery).toBeLessThan(childCompletion);
    expect(childCompletion).toBeLessThan(returnFromChild);
    expect(returnFromChild).toBeLessThan(classification);
    expect(classification).toBeLessThan(articulationCheck);
  });

  it('rejects invalid coordinates and duplicate IDs before traversal', () => {
    const invalidCoordinate: GraphDefinition = {
      nodes: [{ id: 'A', name: 'A', x: 101, y: 10 }],
      edges: [],
    };
    const duplicateId: GraphDefinition = {
      nodes: [
        { id: 'A', name: 'A', x: 10, y: 10 },
        { id: 'A', name: 'Another A', x: 20, y: 20 },
      ],
      edges: [],
    };

    expect(() => analyzeGraph(invalidCoordinate)).toThrow(GraphValidationError);
    expect(() => analyzeGraph(invalidCoordinate)).toThrow(/A has an invalid x coordinate/i);
    expect(() => analyzeGraph(duplicateId)).toThrow(/Node A has a duplicate ID/);
  });
});

describe('app replay controls', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
  });

  it('steps and completes the same event history, then resets to the candidate graph', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const expected = analyzeGraph(ARCHIPELAGO);

    app.step();
    expect(app.cursor()).toBe(1);
    expect(app.currentEvent()?.sequence).toBe(1);
    app.runToEnd();
    expect(app.visibleEvents()).toEqual(expected.events);
    expect(app.isComplete()).toBe(true);
    expect(app.analysis()?.bridgeIds).toEqual(['CD', 'EG']);

    app.reset();
    expect(app.cursor()).toBe(0);
    expect(app.visibleEvents()).toEqual([]);
    expect(app.graph()).toEqual(ARCHIPELAGO);
    app.runToEnd();
    expect(app.visibleEvents()).toEqual(expected.events);
    expect(app.analysis()?.proof).toEqual(expected.proof);
  });

  it('clears replay and results when invalid input is loaded', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.step();
    app.loadGraph({
      nodes: [{ id: 'A', name: 'A', x: 101, y: 10 }],
      edges: [],
    });

    expect(app.analysis()).toBeNull();
    expect(app.cursor()).toBe(0);
    expect(app.visibleEvents()).toEqual([]);
    expect(app.graph()).toEqual({ nodes: [], edges: [] });
    expect(app.errorMessage()).toContain('invalid x coordinate');
  });
});
