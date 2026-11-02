import { Component, computed, signal } from '@angular/core';
import { ARCHIPELAGO, cloneArchipelago } from './data/archipelago.data';
import { AnalysisResult } from './models/analysis.model';
import {analyzeGraph,} from './services/graph-analysis.services';
import { GraphValidationError } from './services/graph-validation.services';
import { GraphDefinition } from './models/graph.model';

import { buildReplayState, NodeReplayState } from './services/replay.services';



@Component({
  selector: 'app-root',
  standalone: true,
  imports: [],
  templateUrl: './app.html',
})

export class App {

  readonly graph = signal<GraphDefinition>(cloneArchipelago());
  readonly isGraphLoading = signal(false);
  readonly analysis = signal<AnalysisResult | null>(null);
  readonly cursor = signal(0);
  readonly errorMessage = signal('');
  readonly events = computed(() => this.analysis()?.events ?? []);
  readonly visibleEvents = computed(() => this.events().slice(0, this.cursor()));
  readonly currentEvent = computed(() => this.visibleEvents().at(-1) ?? null);
  readonly isComplete = computed(() => this.events().length > 0 && this.cursor() >= this.events().length);
  readonly completionPercent = computed(() =>
    this.events().length === 0 ? 0 : Math.round((this.cursor() / this.events().length) * 100),
  );

  readonly replayState = computed(() => buildReplayState(this.visibleEvents()));
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

  // loadMyArchipelago(): void {
  //   this.loadGraph(ARCHIPELAGO);
  // }

  async loadMyArchipelago(): Promise<void> {
  if (this.isGraphLoading()) return;

  this.isGraphLoading.set(true);

  try {
    await new Promise<void>((resolve) => setTimeout(resolve, 700));
    this.loadGraph(ARCHIPELAGO);
  } finally {
    this.isGraphLoading.set(false);
  }
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
    ].filter(Boolean).join(' ');
  }

  edgeClass(edgeId: string): string {
    const state = this.replayState().edges.get(edgeId);
    return [
      'bridge-line',
      state ? `edge-${state}` : 'edge-unvisited',
      this.currentEvent()?.edgeId === edgeId ? 'edge-current' : '',
    ].filter(Boolean).join(' ');
  }


}
