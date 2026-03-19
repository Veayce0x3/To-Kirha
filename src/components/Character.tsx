import { useEffect, useRef, useState } from 'react';
import { Direction, resolveSprite } from '../assets/personnage';
import { Equipement } from '../data/vetements';

// ============================================================
// Props — position et mouvement gérés par le parent
// ============================================================

interface CharacterProps {
  direction:    Direction;
  isMoving:     boolean;
  isHarvesting: boolean;
  equipment:    Equipement;
  size?:        number; // largeur px (hauteur = size × 2)
}

// ============================================================
// Sprite vêtement par slot/id
// ============================================================

const BASE = import.meta.env.BASE_URL;

function vetSrc(slot: string, id: number): string {
  return `${BASE}assets/personnage/vetements/${slot}/${id}.png`;
}

// ============================================================
// Composant — 6 calques CSS superposés
// ============================================================

export function Character({
  direction,
  isMoving,
  isHarvesting,
  equipment,
  size = 40,
}: CharacterProps) {
  const [frame, setFrame] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cycle de frames : 4 pour marche, 3 pour récolte
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (isMoving || isHarvesting) {
      const maxFrame = isHarvesting ? 3 : 4;
      intervalRef.current = setInterval(
        () => setFrame(f => (f + 1) % maxFrame),
        170,
      );
    } else {
      setFrame(0);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isMoving, isHarvesting]);

  const sprite = resolveSprite(direction, isMoving, isHarvesting, frame);

  const layer: React.CSSProperties = {
    position:       'absolute',
    top: 0, left: 0,
    width:          '100%',
    height:         '100%',
    objectFit:      'contain',
    imageRendering: 'pixelated',
  };

  return (
    <div style={{ position: 'relative', width: size, height: size * 2, imageRendering: 'pixelated' }}>

      {/* Calque 1 : Corps de base */}
      <img src={sprite} alt="personnage" style={layer} />

      {/* Calque 2 : Haut */}
      {equipment.haut != null && (
        <img src={vetSrc('haut', equipment.haut)} alt="" style={layer}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      )}

      {/* Calque 3 : Bas */}
      {equipment.bas != null && (
        <img src={vetSrc('bas', equipment.bas)} alt="" style={layer}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      )}

      {/* Calque 4 : Chaussures */}
      {equipment.chaussures != null && (
        <img src={vetSrc('chaussures', equipment.chaussures)} alt="" style={layer}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      )}

      {/* Calque 5 : Chapeau */}
      {equipment.chapeau != null && (
        <img src={vetSrc('chapeau', equipment.chapeau)} alt="" style={layer}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      )}

      {/* Calque 6 : Accessoire */}
      {equipment.accessoire != null && (
        <img src={vetSrc('accessoires', equipment.accessoire)} alt="" style={layer}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      )}
    </div>
  );
}
