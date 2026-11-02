export type ReplayEventKind =
  | 'discover'
  | 'inspect-tree'
  | 'inspect-parent'
  | 'inspect-visited'
  | 'back-edge-low'
  | 'return-from-child'
  | 'tree-edge-classification'
  | 'articulation-check'
  | 'node-complete'
  | 'component-complete';

export interface ReplayEvent {
  sequence: number;
  kind: ReplayEventKind;
  message: string;
  nodeId?: string;
  childId?: string;
  edgeId?: string;
  parentId?: string | null;
  discovery?: number;
  oldLow?: number;
  newLow?: number;
  isBridge?: boolean;
  isArticulation?: boolean;
  childCount?: number;
  component?: number;
}

export interface NodeProof {
  id: string;
  parent: string | null;
  discovery: number;
  low: number;
}
