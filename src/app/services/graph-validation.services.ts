import { GraphDefinition } from '../models/graph.model';


export class GraphValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(issues.join(' '));
    this.name = 'GraphValidationError';
  }
}

const ID_PATTERN = /^[A-Z][A-Z0-9_-]{0,15}$/;

export function validateGraph(graph: GraphDefinition): string[] {
  const issues: string[] = [];
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    return ['Graph must contain node and edge arrays.'];
  }

  if (graph.nodes.length < 1 || graph.nodes.length > 12) {
    issues.push(`Graph must contain 1 to 12 nodes; received ${graph.nodes.length}.`);
  }
  if (graph.edges.length > 20) {
    issues.push(`Graph must contain no more than 20 edges; received ${graph.edges.length}.`);
  }

  const nodeIds = new Set<string>();
  for (const [index, node] of graph.nodes.entries()) {
    const label = typeof node?.id === 'string' ? node.id : `node at index ${index}`;
    if (typeof node?.id !== 'string' || !ID_PATTERN.test(node.id)) {
      issues.push(`${label} has an invalid ID; use [A-Z][A-Z0-9_-]{0,15}.`);
    } else if (nodeIds.has(node.id)) {
      issues.push(`Node ${node.id} has a duplicate ID.`);
    } else {
      nodeIds.add(node.id);
    }

    if (typeof node?.name !== 'string' || node.name.trim().length === 0) {
      issues.push(`${label} must have a non-empty display name.`);
    }
    if (!Number.isFinite(node?.x) || node.x < 0 || node.x > 100) {
      issues.push(`${label} has an invalid x coordinate; expected a finite value from 0 to 100.`);
    }
    if (!Number.isFinite(node?.y) || node.y < 0 || node.y > 100) {
      issues.push(`${label} has an invalid y coordinate; expected a finite value from 0 to 100.`);
    }
  }

  const edgeIds = new Set<string>();
  const endpointPairs = new Set<string>();
  for (const [index, edge] of graph.edges.entries()) {
    const label = typeof edge?.id === 'string' ? edge.id : `edge at index ${index}`;
    if (typeof edge?.id !== 'string' || !ID_PATTERN.test(edge.id)) {
      issues.push(`${label} has an invalid ID; use [A-Z][A-Z0-9_-]{0,15}.`);
    } else if (edgeIds.has(edge.id)) {
      issues.push(`Edge ${edge.id} has a duplicate ID.`);
    } else {
      edgeIds.add(edge.id);
    }

    if (typeof edge?.source !== 'string' || !nodeIds.has(edge.source)) {
      issues.push(`${label} references unknown source endpoint ${String(edge?.source)}.`);
    }
    if (typeof edge?.target !== 'string' || !nodeIds.has(edge.target)) {
      issues.push(`${label} references unknown target endpoint ${String(edge?.target)}.`);
    }
    if (typeof edge?.source === 'string' && edge.source === edge.target) {
      issues.push(`${label} is a self-loop at ${edge.source}.`);
    }
    if (
      typeof edge?.source === 'string' &&
      typeof edge?.target === 'string' &&
      edge.source !== edge.target
    ) {
      const pair = [edge.source, edge.target].sort().join('|');
      if (endpointPairs.has(pair)) {
        issues.push(`${label} duplicates the connection between ${pair.replace('|', ' and ')}.`);
      } else {
        endpointPairs.add(pair);
      }
    }
  }

  return issues;
}