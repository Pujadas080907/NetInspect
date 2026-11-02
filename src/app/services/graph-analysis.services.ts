import { Bridge } from '../models/island.model';
import { GraphDefinition } from '../models/graph.model';
import { AnalysisResult } from '../models/analysis.model';
import {
  GraphValidationError,
  validateGraph
} from './graph-validation.services';

import {
  ReplayEvent
} from '../models/replay.model';




export function analyzeGraph(graph: GraphDefinition): AnalysisResult {
  const issues = validateGraph(graph);
  if (issues.length > 0) {
    throw new GraphValidationError(issues);
  }

  const nodeIds = graph.nodes.map((node) => node.id).sort();
  const adjacency = new Map(nodeIds.map((id) => [id, [] as string[]]));
  const edgeByPair = new Map<string, Bridge>();

  for (const edge of graph.edges) {
    adjacency.get(edge.source)?.push(edge.target);
    adjacency.get(edge.target)?.push(edge.source);
    edgeByPair.set(pairKey(edge.source, edge.target), edge);
  }
  for (const neighbours of adjacency.values()) {
    neighbours.sort();
  }

  const discovery = new Map<string, number>();
  const low = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const articulation = new Set<string>();
  const bridges = new Set<string>();
  const discoveryOrder: string[] = [];
  const events: ReplayEvent[] = [];
  let clock = 0;
  let componentCount = 0;

  const emit = (event: Omit<ReplayEvent, 'sequence'>): void => {
    events.push({ ...event, sequence: events.length + 1 });
  };

  const visit = (nodeId: string): void => {
    const parentId = parent.get(nodeId) ?? null;
    discovery.set(nodeId, clock);
    low.set(nodeId, clock);
    discoveryOrder.push(nodeId);
    emit({
      kind: 'discover',
      nodeId,
      parentId,
      discovery: clock,
      newLow: clock,
      message: `Discover ${nodeId} at ${clock}; set low[${nodeId}] = ${clock}${parentId ? ` (parent ${parentId})` : ' (component root)'}.`,
    });
    clock += 1;

    let childCount = 0;
    for (const neighbour of adjacency.get(nodeId) ?? []) {
      const edge = edgeByPair.get(pairKey(nodeId, neighbour));
      if (!edge) {
        throw new Error(`Missing edge for validated connection ${nodeId}–${neighbour}.`);
      }

      if (!discovery.has(neighbour)) {
        childCount += 1;
        emit({
          kind: 'inspect-tree',
          nodeId,
          childId: neighbour,
          edgeId: edge.id,
          message: `Inspect ${edge.id} (${nodeId}–${neighbour}): unvisited neighbour, so this is a DFS-tree edge.`,
        });
        parent.set(neighbour, nodeId);
        visit(neighbour);

        const oldLow = low.get(nodeId);
        const childLow = low.get(neighbour);
        if (oldLow === undefined || childLow === undefined) {
          throw new Error(`Missing low-link value while returning from ${neighbour} to ${nodeId}.`);
        }
        const newLow = Math.min(oldLow, childLow);
        low.set(nodeId, newLow);
        emit({
          kind: 'return-from-child',
          nodeId,
          childId: neighbour,
          edgeId: edge.id,
          oldLow,
          newLow,
          message: `Return ${neighbour} → ${nodeId}: low[${nodeId}] ${oldLow} → ${newLow} using low[${neighbour}] = ${childLow}.`,
        });

        const parentDiscovery = discovery.get(nodeId);
        const childDiscovery = discovery.get(neighbour);
        if (parentDiscovery === undefined || childDiscovery === undefined) {
          throw new Error(`Missing discovery value while classifying edge ${edge.id}.`);
        }
        const isBridge = childLow > parentDiscovery;
        if (isBridge) {
          bridges.add(edge.id);
        }
        emit({
          kind: 'tree-edge-classification',
          nodeId,
          childId: neighbour,
          edgeId: edge.id,
          isBridge,
          message: isBridge
            ? `Classify ${edge.id}: low[${neighbour}] = ${childLow} > discovery[${nodeId}] = ${parentDiscovery}; bridge.`
            : `Classify ${edge.id}: low[${neighbour}] = ${childLow} ≤ discovery[${nodeId}] = ${parentDiscovery}; not a bridge.`,
        });

        if (parentId !== null) {
          const isArticulation = childLow >= parentDiscovery;
          if (isArticulation) {
            articulation.add(nodeId);
          }
          emit({
            kind: 'articulation-check',
            nodeId,
            childId: neighbour,
            isArticulation,
            message: isArticulation
              ? `Articulation check: low[${neighbour}] = ${childLow} ≥ discovery[${nodeId}] = ${parentDiscovery}; removing ${nodeId} separates this child subtree.`
              : `Articulation check: low[${neighbour}] = ${childLow} < discovery[${nodeId}] = ${parentDiscovery}; this child subtree reconnects above ${nodeId}.`,
          });
        }
      } else if (neighbour === parentId) {
        emit({
          kind: 'inspect-parent',
          nodeId,
          childId: neighbour,
          edgeId: edge.id,
          message: `Inspect ${edge.id} (${nodeId}–${neighbour}): this is the parent edge; it does not lower low[${nodeId}].`,
        });
      } else {
        const oldLow = low.get(nodeId);
        const neighbourDiscovery = discovery.get(neighbour);
        if (oldLow === undefined || neighbourDiscovery === undefined) {
          throw new Error(`Missing low-link value while inspecting ${nodeId}–${neighbour}.`);
        }
        emit({
          kind: 'inspect-visited',
          nodeId,
          childId: neighbour,
          edgeId: edge.id,
          message: `Inspect ${edge.id} (${nodeId}–${neighbour}): neighbour already visited; compare low[${nodeId}] with discovery[${neighbour}] = ${neighbourDiscovery}.`,
        });
        const newLow = Math.min(oldLow, neighbourDiscovery);
        low.set(nodeId, newLow);
        emit({
          kind: 'back-edge-low',
          nodeId,
          childId: neighbour,
          edgeId: edge.id,
          oldLow,
          newLow,
          message:
            oldLow === newLow
              ? `Back-connection update: low[${nodeId}] remains ${oldLow} via discovery[${neighbour}] = ${neighbourDiscovery}.`
              : `Back-connection update: low[${nodeId}] ${oldLow} → ${newLow} via discovery[${neighbour}] = ${neighbourDiscovery}.`,
        });
      }
    }

    if (parentId === null) {
      const isArticulation = childCount >= 2;
      if (isArticulation) {
        articulation.add(nodeId);
      }
      emit({
        kind: 'articulation-check',
        nodeId,
        childCount,
        isArticulation,
        message: isArticulation
          ? `Root articulation check: ${childCount} DFS-tree children (at least 2); removing ${nodeId} splits its component.`
          : `Root articulation check: ${childCount} DFS-tree child${childCount === 1 ? '' : 'ren'} (fewer than 2); ${nodeId} is not an articulation point.`,
      });
    }

    emit({
      kind: 'node-complete',
      nodeId,
      message: `Finish island ${nodeId} with discovery = ${discovery.get(nodeId)} and low = ${low.get(nodeId)}.`,
    });
  };

  for (const rootId of nodeIds) {
    if (!discovery.has(rootId)) {
      componentCount += 1;
      parent.set(rootId, null);
      visit(rootId);
      emit({
        kind: 'component-complete',
        nodeId: rootId,
        component: componentCount,
        message: `Component ${componentCount} complete; its deterministic DFS root was ${rootId}.`,
      });
    }
  }

  const proof = nodeIds.map((id) => {
    const discoveredAt = discovery.get(id);
    const lowValue = low.get(id);
    if (discoveredAt === undefined || lowValue === undefined) {
      throw new Error(`Traversal did not produce proof values for ${id}.`);
    }
    return {
      id,
      parent: parent.get(id) ?? null,
      discovery: discoveredAt,
      low: lowValue,
    };
  });

  return {
    adjacency,
    discoveryOrder,
    proof,
    componentCount,
    bridgeIds: [...bridges].sort(),
    articulationIds: [...articulation].sort(),
    events,
  };
}

function pairKey(first: string, second: string): string {
  return [first, second].sort().join('|');
}
