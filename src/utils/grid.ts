// ============================================================
// Grille de déplacement + pathfinding A* (8 directions)
// ============================================================

export interface Cell {
  col: number;
  row: number;
}

export type Grid = boolean[][];

// ── Construction ────────────────────────────────────────────

export function createGrid(cols: number, rows: number, blocked: Cell[] = []): Grid {
  const grid: Grid = Array.from({ length: rows }, () => Array(cols).fill(true));
  for (const { col, row } of blocked) {
    if (row >= 0 && row < rows && col >= 0 && col < cols) {
      grid[row][col] = false;
    }
  }
  return grid;
}

// ── A* 8 directions ─────────────────────────────────────────

const SQRT2 = Math.SQRT2;

const DIRS = [
  { dc:  0, dr: -1, cost: 1      }, // N
  { dc:  0, dr:  1, cost: 1      }, // S
  { dc: -1, dr:  0, cost: 1      }, // W
  { dc:  1, dr:  0, cost: 1      }, // E
  { dc: -1, dr: -1, cost: SQRT2  }, // NW
  { dc:  1, dr: -1, cost: SQRT2  }, // NE
  { dc: -1, dr:  1, cost: SQRT2  }, // SW
  { dc:  1, dr:  1, cost: SQRT2  }, // SE
];

function cellKey(c: Cell): string {
  return `${c.col},${c.row}`;
}

// Chebyshev distance — admissible pour 8 directions
function heuristic(a: Cell, b: Cell): number {
  const dc = Math.abs(a.col - b.col);
  const dr = Math.abs(a.row - b.row);
  return Math.max(dc, dr);
}

/**
 * Chemin de `start` à `end` (start inclus).
 * Supporte 8 directions. Ne coupe pas les coins diagonaux.
 */
export function findPath(grid: Grid, start: Cell, end: Cell): Cell[] {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  if (!grid[end.row]?.[end.col]) return [];
  if (start.col === end.col && start.row === end.row) return [start];

  const openSet = new Set<string>([cellKey(start)]);
  const cameFrom = new Map<string, Cell>();
  const gScore   = new Map<string, number>();
  const fScore   = new Map<string, number>();

  gScore.set(cellKey(start), 0);
  fScore.set(cellKey(start), heuristic(start, end));

  while (openSet.size > 0) {
    let current!: Cell;
    let bestF = Infinity;
    for (const k of openSet) {
      const f = fScore.get(k) ?? Infinity;
      if (f < bestF) { bestF = f; const [c, r] = k.split(',').map(Number); current = { col: c, row: r }; }
    }

    const currentKey = cellKey(current);

    if (current.col === end.col && current.row === end.row) {
      const path: Cell[] = [current];
      let cur = currentKey;
      while (cameFrom.has(cur)) {
        const parent = cameFrom.get(cur)!;
        path.unshift(parent);
        cur = cellKey(parent);
      }
      return path;
    }

    openSet.delete(currentKey);

    for (const { dc, dr, cost } of DIRS) {
      const nc = current.col + dc;
      const nr = current.row + dr;

      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || !grid[nr][nc]) continue;

      // Anti-coin : diagonal bloquée si les deux cardinaux adjacents sont bloqués
      if (dc !== 0 && dr !== 0) {
        if (!grid[current.row + dr]?.[current.col] && !grid[current.row]?.[current.col + dc]) continue;
      }

      const nKey = cellKey({ col: nc, row: nr });
      const tentG = (gScore.get(currentKey) ?? Infinity) + cost;

      if (tentG < (gScore.get(nKey) ?? Infinity)) {
        cameFrom.set(nKey, current);
        gScore.set(nKey, tentG);
        fScore.set(nKey, tentG + heuristic({ col: nc, row: nr }, end));
        openSet.add(nKey);
      }
    }
  }

  return [];
}

// ── Conversion grille ↔ % CSS ────────────────────────────────

export function cellToPercent(col: number, row: number, cols: number, rows: number) {
  return { x: ((col + 0.5) / cols) * 100, y: ((row + 0.5) / rows) * 100 };
}

export function percentToCell(x: number, y: number, cols: number, rows: number): Cell {
  return {
    col: Math.min(cols - 1, Math.max(0, Math.floor((x / 100) * cols))),
    row: Math.min(rows - 1, Math.max(0, Math.floor((y / 100) * rows))),
  };
}
