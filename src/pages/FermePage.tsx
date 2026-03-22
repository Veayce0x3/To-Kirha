import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { ResourceId } from '../data/resources';
import { ANIMALS, canCollectPuits, getSecondsUntilPuitsReset, Animal } from '../data/ferme';
import { emojiByResourceId, getNomRessource } from '../utils/resourceUtils';
import { useT } from '../utils/i18n';

function formatTimer(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`;
  if (m > 0) return `${m}min ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

// ── Vue bâtiment (emplacements d'un animal) ─────────────────

function BuildingView({ animal, onBack }: { animal: Animal; onBack: () => void }) {
  const { lang } = useT();
  const [, setTick] = useState(0);

  const personageNiveau        = useGameStore(s => s.personageNiveau);
  const animauxDerniereRecolte = useGameStore(s => s.animauxDerniereRecolte);
  const setAnimauxDerniereRecolte = useGameStore(s => s.setAnimauxDerniereRecolte);
  const ajouterRessource       = useGameStore(s => s.ajouterRessource);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const buildingUnlocked = personageNiveau >= animal.niveauPersonnageRequis;
  const slots = animal.slotLevels;
  const cooldownsArr = animauxDerniereRecolte[animal.id] ?? [];

  function collectSlot(slotIndex: number) {
    const last = cooldownsArr[slotIndex] ?? 0;
    if (Date.now() - last < animal.cooldownMs) return;
    ajouterRessource(animal.resourceId, animal.production);
    setAnimauxDerniereRecolte(animal.id, slotIndex, Date.now());
  }

  const unlockedCount = slots.filter((lvl) => personageNiveau >= lvl).length;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={onBack}>← Ferme</button>
        <span style={s.headerTitle}>{animal.emoji} {animal.nomBatiment}</span>
        <div style={{ width: 60 }} />
      </div>

      <div style={s.content}>

        {/* Ressource produite */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'#fff', border:'1px solid rgba(212,100,138,0.15)', borderRadius:12, marginBottom:14 }}>
          <span style={{ fontSize:28 }}>{emojiByResourceId(animal.resourceId)}</span>
          <div>
            <span style={{ color:'#1e0a16', fontSize:13, fontWeight:800, display:'block' }}>
              {getNomRessource(animal.resourceId, lang)} ×{animal.production}
            </span>
            <span style={{ color:'#7a4060', fontSize:10 }}>
              {lang === 'en' ? 'per slot · cooldown' : 'par slot · recharge'} {formatTimer(animal.cooldownMs / 1000)}
            </span>
          </div>
          <div style={{ marginLeft:'auto', textAlign:'right' }}>
            <span style={{ color:'#c43070', fontSize:11, fontWeight:700 }}>
              {unlockedCount}/10 {lang === 'en' ? 'slots' : 'emplacements'}
            </span>
          </div>
        </div>

        {/* Grille des emplacements */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {slots.map((reqLvl, slotIndex) => {
            const slotUnlocked = buildingUnlocked && personageNiveau >= reqLvl;
            const last = cooldownsArr[slotIndex] ?? 0;
            const elapsed = Date.now() - last;
            const ready = slotUnlocked && elapsed >= animal.cooldownMs;
            const secondsLeft = ready || !slotUnlocked ? 0 : Math.max(0, Math.ceil((animal.cooldownMs - elapsed) / 1000));

            return (
              <div key={slotIndex} style={{
                background: slotUnlocked ? '#fff' : 'rgba(212,100,138,0.04)',
                border: `1.5px solid ${slotUnlocked ? (ready ? 'rgba(106,191,68,0.4)' : 'rgba(212,100,138,0.2)') : 'rgba(212,100,138,0.1)'}`,
                borderRadius: 14, padding: '12px', display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 8, opacity: slotUnlocked ? 1 : 0.55,
              }}>
                <div style={{ fontSize: 26, lineHeight: 1 }}>
                  {slotUnlocked ? animal.emoji : '🔒'}
                </div>
                <span style={{ color: '#1e0a16', fontSize: 11, fontWeight: 700 }}>
                  #{slotIndex + 1}
                </span>

                {!slotUnlocked ? (
                  <span style={{ color: '#9a6080', fontSize: 9, textAlign: 'center' }}>
                    {lang === 'en' ? `Perso lv. ${reqLvl}` : `Perso niv. ${reqLvl}`}
                  </span>
                ) : ready ? (
                  <span style={{ color: '#6abf44', fontSize: 10, fontWeight: 700 }}>✅ Prêt</span>
                ) : (
                  <span style={{ color: '#9a6080', fontSize: 10 }}>⏱ {formatTimer(secondsLeft)}</span>
                )}

                {slotUnlocked && (
                  <button
                    style={{
                      width: '100%', padding: '7px 0',
                      background: ready ? 'linear-gradient(135deg,#6abf44,#3a8f1e)' : 'rgba(212,100,138,0.08)',
                      border: ready ? 'none' : '1px solid rgba(212,100,138,0.15)',
                      borderRadius: 8, color: ready ? '#fff' : '#9a6080',
                      fontSize: 11, fontWeight: 700,
                      cursor: ready ? 'pointer' : 'default', opacity: ready ? 1 : 0.6,
                    }}
                    disabled={!ready}
                    onClick={() => collectSlot(slotIndex)}
                  >
                    {ready ? (lang === 'en' ? '🌾 Collect' : '🌾 Récolter') : '⏳'}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Info déblocage */}
        <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(212,100,138,0.04)', border: '1px solid rgba(212,100,138,0.1)', borderRadius: 10 }}>
          <p style={{ color: '#9a6080', fontSize: 10, margin: 0, lineHeight: 1.6 }}>
            {lang === 'en'
              ? `Slots unlock progressively as your character levels up. Next slot at lv. ${slots.find(l => l > personageNiveau) ?? '—'}.`
              : `Les emplacements se débloquent progressivement avec le niveau personnage. Prochain emplacement au niv. ${slots.find(l => l > personageNiveau) ?? '—'}.`}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Vue principale Ferme ─────────────────────────────────────

export function FermePage() {
  const navigate = useNavigate();
  const { lang } = useT();
  const [, setTick] = useState(0);
  const [selectedAnimal, setSelectedAnimal] = useState<string | null>(null);

  const personageNiveau        = useGameStore(s => s.personageNiveau);
  const puitsDerniereRecolte   = useGameStore(s => s.puitsDerniereRecolte);
  const animauxDerniereRecolte = useGameStore(s => s.animauxDerniereRecolte);
  const setPuitsDerniereRecolte = useGameStore(s => s.setPuitsDerniereRecolte);
  const ajouterRessource        = useGameStore(s => s.ajouterRessource);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const puitsReady = canCollectPuits(puitsDerniereRecolte);
  const puitsCooldownLeft = puitsReady ? 0 : getSecondsUntilPuitsReset();

  function collecterPuits() {
    if (!puitsReady) return;
    ajouterRessource(ResourceId.EAU, 1);
    setPuitsDerniereRecolte(Date.now());
  }

  // Si un bâtiment est sélectionné, afficher sa vue dédiée
  if (selectedAnimal) {
    const animal = ANIMALS.find(a => a.id === selectedAnimal);
    if (animal) {
      return <BuildingView animal={animal} onBack={() => setSelectedAnimal(null)} />;
    }
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate('/home')}>← Accueil</button>
        <span style={s.headerTitle}>🌾 Ferme</span>
        <div style={{ width: 60 }} />
      </div>

      <div style={s.content}>

        {/* ─── Niveau personnage (rappel) ─── */}
        <div style={s.infoBar}>
          <span style={{ fontSize: 14 }}>👤</span>
          <span style={{ color: '#7a4060', fontSize: 12, fontWeight: 700 }}>
            {lang === 'en' ? 'Character Lv.' : 'Personnage Niv.'} {personageNiveau}
          </span>
        </div>

        {/* ─── Le Puits ─── */}
        <div style={s.section}>
          <div style={s.sectionHeader}>
            <span style={{ fontSize: 20 }}>💧</span>
            <span style={{ color: '#1e0a16', fontSize: 14, fontWeight: 800 }}>
              {lang === 'en' ? 'The Well' : 'Le Puits'}
            </span>
          </div>
          <p style={{ color: '#7a4060', fontSize: 11, margin: '0 0 12px', lineHeight: 1.5 }}>
            {lang === 'en'
              ? 'Collect 1 unit of water per day (resets at midnight Paris time).'
              : 'Récoltez 1 unité d\'eau par jour (reset à 00h00 heure française).'}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: puitsReady ? 'rgba(41,182,246,0.12)' : 'rgba(212,100,138,0.06)', border: `1.5px solid ${puitsReady ? 'rgba(41,182,246,0.4)' : 'rgba(212,100,138,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
              💧
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ color: '#1e0a16', fontSize: 12, fontWeight: 700, display: 'block' }}>Eau ×1</span>
              {puitsReady ? (
                <span style={{ color: '#6abf44', fontSize: 11, fontWeight: 700 }}>
                  {lang === 'en' ? '✅ Ready to collect!' : '✅ Prêt à récolter !'}
                </span>
              ) : (
                <span style={{ color: '#7a4060', fontSize: 11 }}>
                  {lang === 'en' ? 'Next collect in' : 'Prochain dans'} {formatTimer(puitsCooldownLeft)}
                </span>
              )}
            </div>
            <button
              style={{ padding: '9px 16px', background: puitsReady ? 'linear-gradient(135deg,#29b6f6,#0288d1)' : 'rgba(212,100,138,0.08)', border: puitsReady ? 'none' : '1px solid rgba(212,100,138,0.2)', borderRadius: 10, color: puitsReady ? '#fff' : '#9a6080', fontSize: 12, fontWeight: 700, cursor: puitsReady ? 'pointer' : 'default', opacity: puitsReady ? 1 : 0.6 }}
              onClick={collecterPuits}
              disabled={!puitsReady}
            >
              {puitsReady ? (lang === 'en' ? '💧 Collect' : '💧 Récolter') : '⏳'}
            </button>
          </div>
        </div>

        {/* ─── Bâtiments ─── */}
        <div style={s.section}>
          <div style={s.sectionHeader}>
            <span style={{ fontSize: 20 }}>🐾</span>
            <span style={{ color: '#1e0a16', fontSize: 14, fontWeight: 800 }}>
              {lang === 'en' ? 'Buildings' : 'Bâtiments'}
            </span>
          </div>
          <p style={{ color: '#7a4060', fontSize: 11, margin: '0 0 12px', lineHeight: 1.5 }}>
            {lang === 'en'
              ? 'Each building has up to 10 slots. Tap to manage your animals.'
              : 'Chaque bâtiment dispose de 10 emplacements. Tapez pour gérer vos animaux.'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ANIMALS.map(animal => {
              const unlocked = personageNiveau >= animal.niveauPersonnageRequis;
              const cooldownsArr = animauxDerniereRecolte[animal.id] ?? [];
              // Compter combien de slots sont prêts
              const unlockedSlots = animal.slotLevels.filter(lvl => personageNiveau >= lvl).length;
              const readySlots = unlockedSlots > 0
                ? animal.slotLevels.slice(0, unlockedSlots).filter((_, i) => {
                    const last = cooldownsArr[i] ?? 0;
                    return Date.now() - last >= animal.cooldownMs;
                  }).length
                : 0;

              return (
                <button
                  key={animal.id}
                  style={{
                    ...s.buildingCard,
                    opacity: unlocked ? 1 : 0.55,
                    borderColor: unlocked ? (readySlots > 0 ? 'rgba(106,191,68,0.4)' : 'rgba(212,100,138,0.2)') : 'rgba(212,100,138,0.1)',
                    cursor: unlocked ? 'pointer' : 'default',
                    textAlign: 'left',
                  }}
                  disabled={!unlocked}
                  onClick={() => unlocked && setSelectedAnimal(animal.id)}
                >
                  <div style={{ fontSize: 36, lineHeight: 1, marginRight: 14 }}>{animal.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ color: '#1e0a16', fontSize: 14, fontWeight: 800 }}>{animal.nomBatiment}</span>
                      {!unlocked && (
                        <span style={{ background: 'rgba(196,48,112,0.1)', color: '#c43070', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8 }}>
                          🔒 Niv. {animal.niveauPersonnageRequis}
                        </span>
                      )}
                      {unlocked && readySlots > 0 && (
                        <span style={{ background: 'rgba(106,191,68,0.15)', color: '#4a8f2a', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8 }}>
                          {readySlots} prêt{readySlots > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 14 }}>{emojiByResourceId(animal.resourceId)}</span>
                      <span style={{ color: '#7a4060', fontSize: 11 }}>
                        {getNomRessource(animal.resourceId, lang)}
                      </span>
                    </div>
                    {unlocked && (
                      <span style={{ color: '#9a6080', fontSize: 10 }}>
                        {unlockedSlots}/10 {lang === 'en' ? 'slots' : 'emplacements'} · {lang === 'en' ? 'tap to manage' : 'appuyer pour gérer'}
                      </span>
                    )}
                    {!unlocked && (
                      <span style={{ color: '#9a6080', fontSize: 10 }}>
                        {lang === 'en' ? `Unlock at character level ${animal.niveauPersonnageRequis}` : `Débloqué au niveau personnage ${animal.niveauPersonnageRequis}`}
                      </span>
                    )}
                  </div>
                  {unlocked && <span style={{ color: '#9a6080', fontSize: 16 }}>→</span>}
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:        { position: 'absolute', inset: 0, background: '#fdf0f5', display: 'flex', flexDirection: 'column' },
  header:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(253,240,245,0.96)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(212,100,138,0.15)', flexShrink: 0 },
  backBtn:     { color: '#7a4060', fontSize: '13px', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' },
  headerTitle: { color: '#1e0a16', fontSize: '16px', fontWeight: 800 },
  content:     { flex: 1, overflowY: 'auto', padding: '12px 16px', paddingBottom: 90 },
  infoBar:     { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(212,100,138,0.05)', border: '1px solid rgba(212,100,138,0.12)', borderRadius: 10, marginBottom: 14 },
  section:     { background: '#fff', border: '1px solid rgba(212,100,138,0.15)', borderRadius: 16, padding: '14px', marginBottom: 14 },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  buildingCard:  { background: '#fdf0f5', border: '1.5px solid', borderRadius: 14, padding: '12px', display: 'flex', alignItems: 'center', width: '100%', boxSizing: 'border-box' as const },
};
