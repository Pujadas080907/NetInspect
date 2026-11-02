export interface Island {
  id: string;
  name: string;
  x: number;
  y: number;
}

export interface Bridge {
  id: string;
  source: string;
  target: string;
}

export interface DrawBridge extends Bridge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  labelX: number;
  labelY: number;
}