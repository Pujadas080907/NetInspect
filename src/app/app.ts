import { Component, computed, signal } from '@angular/core';
import { ARCHIPELAGO, cloneArchipelago } from './data/archipelago.data';
import {
  AnalysisResult,
  analyzeGraph,
  GraphDefinition,
  GraphValidationError,
  ReplayEvent,
} from './services/graph-analysis';

interface NodeReplayState {
  parent: string | null;
  discovery: number;
  low: number;
  complete: boolean;
  articulation: boolean;
}

interface ReplayState {
  nodes: Map<string, NodeReplayState>;
  edges: Map<string, 'tree' | 'non-tree' | 'bridge' | 'safe-cycle'>;
  completedComponents: number;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  readonly graph = signal<GraphDefinition>(cloneArchipelago());
  readonly analysis = signal<AnalysisResult | null>(null);
  readonly cursor = signal(0);
  readonly errorMessage = signal('');
  readonly events = computed(() => this.analysis()?.events ?? []);
  readonly visibleEvents = computed(() => this.events().slice(0, this.cursor()));
  readonly currentEvent = computed(() => this.visibleEvents().at(-1) ?? null);
  readonly isComplete = computed(
    () => this.events().length > 0 && this.cursor() >= this.events().length,
  );
  readonly completionPercent = computed(() =>
    this.events().length === 0 ? 0 : Math.round((this.cursor() / this.events().length) * 100),
  );
  readonly replayState = computed(() => this.buildReplayState(this.visibleEvents()));
  readonly edgeViews = computed(() => {
    const nodes = new Map(this.graph().nodes.map((node) => [node.id, node]));
    return this.graph().edges.flatMap((edge) => {
      const source = nodes.get(edge.source);
      const target = nodes.get(edge.target);
      return source && target ? [{ ...edge, source, target }] : [];
    });
  });
  readonly sortedNodes = computed(() =>
    [...this.graph().nodes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
  );

  constructor() {
    this.loadGraph(ARCHIPELAGO);
  }

  loadMyArchipelago(): void {
    this.loadGraph(ARCHIPELAGO);
  }

  loadGraph(graph: GraphDefinition): void {
    this.cursor.set(0);
    this.analysis.set(null);
    this.errorMessage.set('');
    try {
      const result = analyzeGraph(graph);
      this.graph.set({
        nodes: graph.nodes.map((node) => ({ ...node })),
        edges: graph.edges.map((edge) => ({ ...edge })),
      });
      this.analysis.set(result);
    } catch (error) {
      if (error instanceof GraphValidationError) {
        this.graph.set({ nodes: [], edges: [] });
        this.errorMessage.set(error.issues.join(' '));
        return;
      }
      throw error;
    }
  }

  step(): void {
    if (this.cursor() < this.events().length) {
      this.cursor.update((value) => value + 1);
    }
  }

  runToEnd(): void {
    this.cursor.set(this.events().length);
  }

  reset(): void {
    this.loadGraph(cloneArchipelago());
  }

  nodeState(nodeId: string): NodeReplayState | undefined {
    return this.replayState().nodes.get(nodeId);
  }

  nodeClass(nodeId: string): string {
    const state = this.nodeState(nodeId);
    const event = this.currentEvent();
    const isCurrent = event?.nodeId === nodeId || event?.childId === nodeId;
    return [
      'island-marker',
      state ? 'node-visited' : 'node-unvisited',
      state?.complete ? 'node-complete' : '',
      state?.articulation ? 'node-articulation' : '',
      isCurrent ? 'node-current' : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  edgeClass(edgeId: string): string {
    const state = this.replayState().edges.get(edgeId);
    return [
      'bridge-line',
      state ? `edge-${state}` : 'edge-unvisited',
      this.currentEvent()?.edgeId === edgeId ? 'edge-current' : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  private buildReplayState(events: ReplayEvent[]): ReplayState {
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
}
