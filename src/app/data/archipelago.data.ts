import { Bridge } from '../models/island.model';
import { GraphDefinition } from '../models/graph.model';

export const ARCHIPELAGO: GraphDefinition = {
  nodes: [
    { id: 'A', name: 'Adventure Bay', x: 10, y: 50 },
    { id: 'B', name: 'Treasure Cove', x: 25, y: 75 },
    { id: 'C', name: 'Festival Harbor', x: 30, y: 35 },
    { id: 'D', name: 'Lantern Island', x: 50, y: 35 },
    { id: 'E', name: 'Music Island', x: 70, y: 50 },
    { id: 'F', name: 'Sunset Beach', x: 70, y: 20 },
    { id: 'G', name: 'First Aid Island', x: 90, y: 65 },
  ],
  edges: [
    { id: 'AB', source: 'A', target: 'B' },
    { id: 'AC', source: 'A', target: 'C' },
    { id: 'BC', source: 'B', target: 'C' },
    { id: 'CD', source: 'C', target: 'D' },
    { id: 'DE', source: 'D', target: 'E' },
    { id: 'EF', source: 'E', target: 'F' },
    { id: 'FD', source: 'F', target: 'D' },
    { id: 'EG', source: 'E', target: 'G' },
  ],
};

export function cloneArchipelago(graph: GraphDefinition = ARCHIPELAGO): GraphDefinition {
  return {
    nodes: graph.nodes.map((node) => ({ ...node })),
    edges: graph.edges.map((edge: Bridge) => ({ ...edge })),
  };
}
