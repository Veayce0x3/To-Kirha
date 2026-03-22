import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { ResourceId } from '../data/resources';
import { ANIMALS, canCollectPuits, getSecondsUntilPuitsReset, PUITS_COOLDOWN_MS } from '../data/ferme';
import { emojiByResourceId, getNomRessource } from '../utils/resourceUtils';
import { useT } from '../utils/i18n';
import { TEST_MODE } from '../data/metiers';

function formatTimer(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`;
  if (m > 0) return `${m}min ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

export function FermePage() {
  const navigate = useNavigate();
  const { lang }  = useT();
  const [, setTick] = useState(0);

  const personageNiveau           = useGameStore(s => s.personageNiveau);
  const puitsDerniereRecolte      = useGameStore(s => s.puitsDerniereRecolte);
  const animauxDerniereRecolte    = useGameStore(s => s.animauxDerniereRecolte);
  const setPuitsDerniereRecolte   = useGameStore(s => s.setPuitsDerniereRecolte);
  const setAnimauxDerniereRecolte = useGameStore(s => s.setAnimauxDerniereRecolte);
  const ajouterRessource          = useGameStore(s => s.ajouterRessource);

  // Tick chaque seconde pour rafraîchir les timers
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const puitsReady = canCollectPuits(puitsDerniereRecolte);
  const puitsCooldownLeft = puitsReady ? 0 : getSecondsUntilPuitsReset(puitsDerniereRecolte);

  function collecterPuits() {
    if (!puitsReady) return;
    ajouterRessource(ResourceId.EAU, 1);
    setPuitsDerniereRecolte(Date.now());
  }

  function collecterAnimal(animalId: string, resourceId: ResourceId, production: number) {
    const last = animauxDerniereRecolte[animalId] ?? 0;
    const animal = ANIMALS.find(a => a.id === animalId);
    if (!animal) return;
    if (Date.now() - last < animal.cooldownMs) return;
    ajouterRessource(resourceId, production);
    setAnimauxDerniereRecolte(animalId, Date.now());
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
          <span style={{ fontSize:14 }}>👤</span>
          <span style={{ color:'#7a4060', fontSize:12, fontWeight:700 }}>
            {lang === 'en' ? 'Character Lv.' : 'Personnage Niv.'} {personageNiveau}
          </span>
          {TEST_MODE && (
            <span style={{ marginLeft:'auto', background:'rgba(249,168,37,0.15)', color:'#b07010', fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:6 }}>
              TEST MODE
            </span>
          )}
        </div>

        {/* ─── Le Puits ─── */}
        <div style={s.section}>
          <div style={s.sectionHeader}>
            <span style={{ fontSize:20 }}>💧</span>
            <span style={{ color:'#1e0a16', fontSize:14, fontWeight:800 }}>
              {lang === 'en' ? 'The Well' : 'Le Puits'}
            </span>
          </div>
          <p style={{ color:'#7a4060', fontSize:11, margin:'0 0 12px', lineHeight:1.5 }}>
            {lang === 'en'
              ? 'Collect 1 unit of water per day (resets at midnight Paris time).'
              : 'Récoltez 1 unité d\'eau par jour (reset à 00h00 heure française).'}
            {TEST_MODE && ` [TEST: ${PUITS_COOLDOWN_MS / 1000}s cooldown]`}
          </p>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:56, height:56, borderRadius:16, background: puitsReady ? 'rgba(41,182,246,0.12)' : 'rgba(212,100,138,0.06)', border:`1.5px solid ${puitsReady ? 'rgba(41,182,246,0.4)' : 'rgba(212,100,138,0.15)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>
              💧
            </div>
            <div style={{ flex:1 }}>
              <span style={{ color:'#1e0a16', fontSize:12, fontWeight:700, display:'block' }}>Eau ×1</span>
              {puitsReady ? (
                <span style={{ color:'#6abf44', fontSize:11, fontWeight:700 }}>
                  {lang === 'en' ? '✅ Ready to collect!' : '✅ Prêt à récolter !'}
                </span>
              ) : (
                <span style={{ color:'#7a4060', fontSize:11 }}>
                  {lang === 'en' ? 'Next collect in' : 'Prochain dans'} {formatTimer(puitsCooldownLeft)}
                </span>
              )}
            </div>
            <button
              style={{ padding:'9px 16px', background: puitsReady ? 'linear-gradient(135deg,#29b6f6,#0288d1)' : 'rgba(212,100,138,0.08)', border: puitsReady ? 'none' : '1px solid rgba(212,100,138,0.2)', borderRadius:10, color: puitsReady ? '#fff' : '#9a6080', fontSize:12, fontWeight:700, cursor: puitsReady ? 'pointer' : 'default', opacity: puitsReady ? 1 : 0.6 }}
              onClick={collecterPuits}
              disabled={!puitsReady}
            >
              {puitsReady ? (lang === 'en' ? '💧 Collect' : '💧 Récolter') : '⏳'}
            </button>
          </div>
        </div>

        {/* ─── Animaux ─── */}
        <div style={s.section}>
          <div style={s.sectionHeader}>
            <span style={{ fontSize:20 }}>🐾</span>
            <span style={{ color:'#1e0a16', fontSize:14, fontWeight:800 }}>
              {lang === 'en' ? 'Animals' : 'Animaux'}
            </span>
          </div>
          <p style={{ color:'#7a4060', fontSize:11, margin:'0 0 12px', lineHeight:1.5 }}>
            {lang === 'en'
              ? 'Animals produce resources. Unlock them by leveling up your character.'
              : 'Les animaux produisent des ressources. Débloquez-les en montant le niveau de votre personnage.'}
          </p>

          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {ANIMALS.map(animal => {
              const unlocked = personageNiveau >= animal.niveauPersonnageRequis;
              const lastHarvest = animauxDerniereRecolte[animal.id] ?? 0;
              const elapsed = Date.now() - lastHarvest;
              const ready = unlocked && elapsed >= animal.cooldownMs;
              const secondsLeft = ready ? 0 : Math.max(0, Math.ceil((animal.cooldownMs - elapsed) / 1000));

              return (
                <div key={animal.id} style={{ ...s.animalCard, opacity: unlocked ? 1 : 0.55, borderColor: unlocked ? (ready ? 'rgba(106,191,68,0.35)' : 'rgba(212,100,138,0.15)') : 'rgba(212,100,138,0.1)' }}>
                  <div style={{ fontSize:32, lineHeight:1, marginRight:12 }}>{animal.emoji}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                      <span style={{ color:'#1e0a16', fontSize:13, fontWeight:800 }}>{animal.nom}</span>
                      {!unlocked && (
                        <span style={{ background:'rgba(196,48,112,0.1)', color:'#c43070', fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:8 }}>
                          🔒 Niv. {animal.niveauPersonnageRequis}
                        </span>
                      )}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                      <span style={{ fontSize:14 }}>{emojiByResourceId(animal.resourceId)}</span>
                      <span style={{ color:'#7a4060', fontSize:11 }}>
                        {getNomRessource(animal.resourceId, lang)} ×{animal.production}
                      </span>
                    </div>
                    {unlocked && (
                      ready ? (
                        <span style={{ color:'#6abf44', fontSize:11, fontWeight:700 }}>
                          {lang === 'en' ? '✅ Ready!' : '✅ Prêt !'}
                        </span>
                      ) : (
                        <span style={{ color:'#9a6080', fontSize:10 }}>
                          ⏱ {formatTimer(secondsLeft)}
                        </span>
                      )
                    )}
                    {!unlocked && (
                      <span style={{ color:'#9a6080', fontSize:10 }}>
                        {lang === 'en' ? `Unlock at character level ${animal.niveauPersonnageRequis}` : `Débloqué au niveau personnage ${animal.niveauPersonnageRequis}`}
                      </span>
                    )}
                  </div>
                  {unlocked && (
                    <button
                      style={{ padding:'8px 14px', background: ready ? 'linear-gradient(135deg,#6abf44,#3a8f1e)' : 'rgba(212,100,138,0.08)', border: ready ? 'none' : '1px solid rgba(212,100,138,0.15)', borderRadius:10, color: ready ? '#fff' : '#9a6080', fontSize:11, fontWeight:700, cursor: ready ? 'pointer' : 'default', opacity: ready ? 1 : 0.6, flexShrink:0 }}
                      disabled={!ready}
                      onClick={() => collecterAnimal(animal.id, animal.resourceId, animal.production)}
                    >
                      {ready ? (lang === 'en' ? '🌾 Collect' : '🌾 Récolter') : '⏳'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:    { position:'absolute', inset:0, background:'#fdf0f5', display:'flex', flexDirection:'column' },
  header:  { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background:'rgba(253,240,245,0.96)', backdropFilter:'blur(8px)', borderBottom:'1px solid rgba(212,100,138,0.15)', flexShrink:0 },
  backBtn: { color:'#7a4060', fontSize:'13px', fontWeight:600, background:'none', border:'none', cursor:'pointer' },
  headerTitle: { color:'#1e0a16', fontSize:'16px', fontWeight:800 },
  content: { flex:1, overflowY:'auto', padding:'12px 16px', paddingBottom:90 },
  infoBar: { display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:'rgba(212,100,138,0.05)', border:'1px solid rgba(212,100,138,0.12)', borderRadius:10, marginBottom:14 },
  section: { background:'#fff', border:'1px solid rgba(212,100,138,0.15)', borderRadius:16, padding:'14px', marginBottom:14 },
  sectionHeader: { display:'flex', alignItems:'center', gap:8, marginBottom:8 },
  animalCard: { background:'#fdf0f5', border:'1.5px solid', borderRadius:14, padding:'12px', display:'flex', alignItems:'center' },
};
