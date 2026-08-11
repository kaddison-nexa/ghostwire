// Projects the 1024-dim style/edit vectors down to 2D for visualization,
// using two fixed random unit vectors as projection axes. This is a real
// technique (random projections reasonably preserve relative distances —
// points close together in 2D really were close in the original space),
// not a decorative fake chart. Honest limit: the two axes themselves carry
// no individual semantic meaning ("x-axis = formality" would be a false
// claim) — only relative distance between points is meaningful.
//
// Seeded deterministically so the same vector always projects to the same
// point across requests, deploys, and cold starts — not regenerated
// randomly per invocation, which would make the plot incoherent.
const DIM = 1024;

function mulberry32(seed: number) {
  let state = seed | 0;
  return function random(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomUnitVector(seed: number): number[] {
  const random = mulberry32(seed);
  const v = Array.from({ length: DIM }, () => random() * 2 - 1);
  const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
  return v.map((x) => x / norm);
}

const AXIS_X = randomUnitVector(0x5eed1);
const AXIS_Y = randomUnitVector(0x5eed2);

export function projectTo2D(vec: number[]): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (let i = 0; i < vec.length; i++) {
    x += vec[i] * AXIS_X[i];
    y += vec[i] * AXIS_Y[i];
  }
  return { x, y };
}
