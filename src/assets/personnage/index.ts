// ============================================================
// URLs des sprites du personnage jouable
// Assets dans public/assets/personnage/
// ============================================================

const BASE = import.meta.env.BASE_URL;
const p = (path: string) => `${BASE}assets/personnage/${path}`;

export type Direction = 'face' | 'dos' | 'gauche' | 'droite';

// ── Sprites de base (immobile) ─────────────────────────────
export const PersonnageBase: Record<Direction, string> = {
  face:   p('base/face.png'),
  dos:    p('base/dos.png'),
  gauche: p('base/gauche.png'),
  droite: p('base/droite.png'),
};

// ── Sprites de marche (4 frames par direction) ─────────────
export const PersonnageMarche: Record<Direction, [string, string, string, string]> = {
  face:   [p('marche/face/frame1.png'),   p('marche/face/frame2.png'),   p('marche/face/frame3.png'),   p('marche/face/frame4.png')],
  dos:    [p('marche/dos/frame1.png'),    p('marche/dos/frame2.png'),    p('marche/dos/frame3.png'),    p('marche/dos/frame4.png')],
  gauche: [p('marche/gauche/frame1.png'), p('marche/gauche/frame2.png'), p('marche/gauche/frame3.png'), p('marche/gauche/frame4.png')],
  droite: [p('marche/droite/frame1.png'), p('marche/droite/frame2.png'), p('marche/droite/frame3.png'), p('marche/droite/frame4.png')],
};

// ── Sprites de récolte (3 frames) ─────────────────────────
export const PersonnageRecolte: [string, string, string] = [
  p('recolte/frame1.png'),
  p('recolte/frame2.png'),
  p('recolte/frame3.png'),
];

// ── Résout le sprite actif ─────────────────────────────────
export function resolveSprite(
  direction: Direction,
  isMoving: boolean,
  isHarvesting: boolean,
  frame: number,
): string {
  if (isHarvesting) return PersonnageRecolte[frame % 3];
  if (isMoving)     return PersonnageMarche[direction][frame % 4];
  return PersonnageBase[direction];
}

// ── Helpers mouvement ──────────────────────────────────────

export function calcDirection(
  from: { x: number; y: number },
  to:   { x: number; y: number },
): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'droite' : 'gauche';
  return dy >= 0 ? 'face' : 'dos';
}

export function calcTransitionMs(
  from: { x: number; y: number },
  to:   { x: number; y: number },
): number {
  const dx   = to.x - from.x;
  const dy   = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return Math.max(350, dist * 50); // 50ms par % de distance, min 350ms
}
