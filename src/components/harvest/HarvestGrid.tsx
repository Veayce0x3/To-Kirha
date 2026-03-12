import { useRef, useEffect, useState } from 'react';
import { HarvestSlot } from './HarvestSlot';
import { SlotAvecTimer } from '../../hooks/useHarvest';
import { Ressource } from '../../data/metiers';
import { ResourceId } from '../../data/resources';

interface HarvestGridProps {
  slots:                  SlotAvecTimer[];
  ressources_disponibles: Ressource[];
  onStart:                (slotIndex: number, resourceId: ResourceId) => void;
  onCollect:              (slotIndex: number) => void;
}

export function HarvestGrid({ slots, ressources_disponibles, onStart, onCollect }: HarvestGridProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [slotW, setSlotW] = useState(64);

  // Calcul dynamique de la taille des slots : 5 par ligne, 8px de gap
  useEffect(() => {
    const calc = () => {
      if (ref.current) {
        const available = ref.current.offsetWidth - 32; // 16px padding chaque côté
        setSlotW(Math.floor((available - 4 * 8) / 5));
      }
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);

  const slotH = Math.floor(slotW * 1.35);

  const renderRow = (rowSlots: SlotAvecTimer[]) => (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
      {rowSlots.map(slot => (
        <HarvestSlot
          key={slot.index}
          slot={slot}
          slotWidth={slotW}
          slotHeight={slotH}
          ressources_disponibles={ressources_disponibles}
          onStart={id => onStart(slot.index, id)}
          onCollect={() => onCollect(slot.index)}
        />
      ))}
    </div>
  );

  return (
    <div ref={ref} style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {renderRow(slots.slice(0, 5))}
      {renderRow(slots.slice(5, 10))}
    </div>
  );
}
