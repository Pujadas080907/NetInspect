import {ReplayEvent, NodeProof} from './replay.model';

export interface AnalysisResult {
  adjacency: Map<string, string[]>;
  discoveryOrder: string[];
  proof: NodeProof[];
  componentCount: number;
  bridgeIds: string[];
  articulationIds: string[];
  events: ReplayEvent[];
}
