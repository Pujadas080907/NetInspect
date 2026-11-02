import{ ReplayEvent }from '../models/replay.model';

export interface NodeReplayState {
  parent: string | null;
  discovery: number;
  low: number;
  complete: boolean;
  articulation: boolean;
}

export interface ReplayState {
  nodes: Map<string, NodeReplayState>;
  edges: Map<string, 'tree' | 'non-tree' | 'bridge' | 'safe-cycle'>;
  completedComponents: number;
}

export function buildReplayState(events: ReplayEvent[]): ReplayState {
    const nodes = new Map<string, NodeReplayState>();
    const edges = new Map<string, 'tree' | 'non-tree' | 'bridge' | 'safe-cycle'>();
    let completedComponents = 0;

    for (const event of events) {
      if (event.kind === 'discover' && event.nodeId && event.discovery !== undefined) {
        nodes.set(event.nodeId, {
          parent: event.parentId ?? null,
          discovery: event.discovery,
          low: event.newLow ?? event.discovery,
          complete: false,
          articulation: false,
        });
      } else if (
        (event.kind === 'return-from-child' || event.kind === 'back-edge-low') &&
        event.nodeId &&
        event.newLow !== undefined
      ) {
        const node = nodes.get(event.nodeId);
        if (node) {
          node.low = event.newLow;
        }
      } else if (event.kind === 'inspect-tree' && event.edgeId) {
        edges.set(event.edgeId, 'tree');
      } else if (event.kind === 'inspect-visited' && event.edgeId) {
        edges.set(event.edgeId, 'non-tree');
      } else if (event.kind === 'tree-edge-classification' && event.edgeId) {
        edges.set(event.edgeId, event.isBridge ? 'bridge' : 'safe-cycle');
      } else if (event.kind === 'articulation-check' && event.nodeId && event.isArticulation) {
        const node = nodes.get(event.nodeId);
        if (node) {
          node.articulation = true;
        }
      } else if (event.kind === 'node-complete' && event.nodeId) {
        const node = nodes.get(event.nodeId);
        if (node) {
          node.complete = true;
        }
      } else if (event.kind === 'component-complete') {
        completedComponents += 1;
      }
    }

    return { nodes, edges, completedComponents };
  }