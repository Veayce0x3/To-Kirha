import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { ResourceId } from '../data/resources';
import { MetierId } from '../data/metiers';
import { useT } from '../utils/i18n';
import { emojiByResourceId, getNomRessource } from '../utils/resourceUtils';

// ── Pool de 50 quêtes (10 par métier) ────────────────────────

interface Quest {
  rids:   number[];
  qtys:   number[];
  reward: number;
  diff:   1 | 2 | 3 | 4 | 5;
}

const QUEST_POOL: Quest[] = [
  // Bûcheron (IDs 1–9)
  { rids:[1],    qtys:[5],   reward:0.5, diff:1 },
  { rids:[2],    qtys:[4],   reward:0.8, diff:1 },
  { rids:[3],    qtys:[3],   reward:1.0, diff:2 },
  { rids:[1,2],  qtys:[3,2], reward:1.2, diff:2 },
  { rids:[4],    qtys:[3],   reward:1.5, diff:2 },
  { rids:[3,5],  qtys:[2,2], reward:1.8, diff:3 },
  { rids:[6],    qtys:[2],   reward:2.2, diff:3 },
  { rids:[5,6],  qtys:[2,1], reward:2.5, diff:4 },
  { rids:[7,8],  qtys:[1,1], reward:3.0, diff:4 },
  { rids:[9],    qtys:[1],   reward:5.0, diff:5 },
  // Paysan (IDs 11–19)
  { rids:[11],   qtys:[5],   reward:0.5, diff:1 },
  { rids:[12],   qtys:[4],   reward:0.8, diff:1 },
  { rids:[13],   qtys:[3],   reward:1.0, diff:2 },
  { rids:[11,12],qtys:[3,2], reward:1.2, diff:2 },
  { rids:[14],   qtys:[3],   reward:1.5, diff:2 },
  { rids:[13,15],qtys:[2,2], reward:1.8, diff:3 },
  { rids:[16],   qtys:[2],   reward:2.2, diff:3 },
  { rids:[15,16],qtys:[2,1], reward:2.5, diff:4 },
  { rids:[17,18],qtys:[1,1], reward:3.0, diff:4 },
  { rids:[19],   qtys:[1],   reward:5.0, diff:5 },
  // Pêcheur (IDs 21–29)
  { rids:[21],   qtys:[5],   reward:0.5, diff:1 },
  { rids:[22],   qtys:[4],   reward:0.8, diff:1 },
  { rids:[23],   qtys:[3],   reward:1.0, diff:2 },
  { rids:[21,22],qtys:[3,2], reward:1.2, diff:2 },
  { rids:[24],   qtys:[3],   reward:1.5, diff:2 },
  { rids:[23,25],qtys:[2,2], reward:1.8, diff:3 },
  { rids:[26],   qtys:[2],   reward:2.2, diff:3 },
  { rids:[25,26],qtys:[2,1], reward:2.5, diff:4 },
  { rids:[27,28],qtys:[1,1], reward:3.0, diff:4 },
  { rids:[29],   qtys:[1],   reward:5.0, diff:5 },
  // Mineur (IDs 31–39)
  { rids:[31],   qtys:[5],   reward:0.5, diff:1 },
  { rids:[32],   qtys:[4],   reward:0.8, diff:1 },
  { rids:[33],   qtys:[3],   reward:1.0, diff:2 },
  { rids:[31,32],qtys:[3,2], reward:1.2, diff:2 },
  { rids:[34],   qtys:[3],   reward:1.5, diff:2 },
  { rids:[33,35],qtys:[2,2], reward:1.8, diff:3 },
  { rids:[36],   qtys:[2],   reward:2.2, diff:3 },
  { rids:[35,36],qtys:[2,1], reward:2.5, diff:4 },
  { rids:[37,38],qtys:[1,1], reward:3.0, diff:4 },
  { rids:[39],   qtys:[1],   reward:5.0, diff:5 },
  // Alchimiste (IDs 41–49)
  { rids:[41],   qtys:[5],   reward:0.5, diff:1 },
  { rids:[42],   qtys:[4],   reward:0.8, diff:1 },
  { rids:[43],   qtys:[3],   reward:1.0, diff:2 },
  { rids:[41,42],qtys:[3,2], reward:1.2, diff:2 },
  { rids:[44],   qtys:[3],   reward:1.5, diff:2 },
  { rids:[43,45],qtys:[2,2], reward:1.8, diff:3 },
  { rids:[46],   qtys:[2],   reward:2.2, diff:3 },
  { rids:[45,46],qtys:[2,1], reward:2.5, diff:4 },
  { rids:[47,48],qtys:[1,1], reward:3.0, diff:4 },
  { rids:[49],   qtys:[1],   reward:5.0, diff:5 },
];

// ── Helpers ──────────────────────────────────────────────────

function hashSeed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed >>> 0;
  const rand = () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function questCountForLevel(niveau: number): number {
  if (niveau >= 60) return 10;
  if (niveau >= 55) return 8;
  if (niveau >= 45) return 7;
  if (niveau >= 35) return 6;
  if (niveau >= 25) return 5;
  if (niveau >= 15) return 4;
  if (niveau >= 10) return 3;
  if (niveau >= 5)  return 2;
  return 1;
}

function getParisDate(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
}

function getSecondsUntilMidnightParis(): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const h = parseInt(parts.find(p => p.type === 'hour')!.value);
  const m = parseInt(parts.find(p => p.type === 'minute')!.value);
  const sc = parseInt(parts.find(p => p.type === 'second')!.value);
  return 86400 - (h * 3600 + m * 60 + sc);
}

function formatCountdown(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

const DIFF_STARS = ['','★','★★','★★★','★★★★','★★★★★'];
const DIFF_COLOR = ['','#6abf44','#f9a825','#f97316','#c43070','#8a25d4'];

// Retourne le métier d'une ressource (IDs 1–50)
function metierForRid(rid: number): MetierId {
  if (rid <= 10) return 'bucheron';
  if (rid <= 20) return 'paysan';
  if (rid <= 30) return 'pecheur';
  if (rid <= 40) return 'mineur';
  return 'alchimiste';
}

// Retourne le niveau métier requis pour récolter une ressource
function niveauRequisForRid(rid: number): number {
  const pos = (rid - 1) % 10; // position dans le métier (0 = premier)
  return pos === 0 ? 1 : pos * 10;
}

// ── Composant principal ───────────────────────────────────────

export function TemplePage() {
  const navigate               = useNavigate();
  const { t, lang }            = useT();
  const inventaire             = useGameStore(s => s.inventaire);
  const personageNiveau        = useGameStore(s => s.personageNiveau);
  const metiers                = useGameStore(s => s.metiers);
  const ajouterKirha           = useGameStore(s => s.ajouterKirha);
  const retirerRessource       = useGameStore(s => s.retirerRessource);
  const templeCompleted        = useGameStore(s => s.templeCompleted);
  const templeCompletedDate    = useGameStore(s => s.templeCompletedDate);
  const templeResetUsed        = useGameStore(s => s.templeResetUsed);
  const templeResetDate        = useGameStore(s => s.templeResetDate);
  const templeSlotRerolls      = useGameStore(s => s.templeSlotRerolls);
  const completerQueteTemple   = useGameStore(s => s.completerQueteTemple);
  const resetTempleQuetes      = useGameStore(s => s.resetTempleQuetes);
  const resetQueteTempleManuel = useGameStore(s => s.resetQueteTempleManuel);

  const [countdown, setCountdown] = useState(getSecondsUntilMidnightParis());
  const today = getParisDate();

  useEffect(() => {
    if (templeCompletedDate && templeCompletedDate !== today) resetTempleQuetes();
  }, [today, templeCompletedDate, resetTempleQuetes]);

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(getSecondsUntilMidnightParis());
      if (templeCompletedDate && templeCompletedDate !== getParisDate()) resetTempleQuetes();
    }, 1000);
    return () => clearInterval(id);
  }, [templeCompletedDate, resetTempleQuetes]);

  // Construire les quêtes du jour — filtrées par niveau, seeded + rerolls par slot
  const questCount = questCountForLevel(personageNiveau);

  // Filtrer les quêtes accessibles selon les niveaux métier du joueur
  const accessiblePool = QUEST_POOL.filter(q =>
    q.rids.every(rid => (metiers[metierForRid(rid)]?.niveau ?? 1) >= niveauRequisForRid(rid))
  );
  // Garantir au moins 1 quête accessible (fallback : les 5 quêtes de base, une par métier)
  const effectivePool  = accessiblePool.length > 0 ? accessiblePool : QUEST_POOL.filter(q => q.rids.every(rid => niveauRequisForRid(rid) === 1));
  const actualCount    = Math.min(questCount, effectivePool.length);

  const shuffled   = seededShuffle(effectivePool, hashSeed(today));
  const POOL       = effectivePool.length;

  const todayQuests: Quest[] = Array.from({ length: actualCount }, (_, i) => {
    const rerolls = templeSlotRerolls?.[i] ?? 0;
    // offset: pour r rerolls sur slot i, utilise l'indice (actualCount*rerolls + i) dans le tableau shufflé
    const idx = (actualCount * rerolls + i) % POOL;
    return shuffled[idx];
  });

  const completedIndices: number[] = (templeCompletedDate === today) ? (templeCompleted ?? []) : [];
  const resetsLeft = 1 - (templeResetDate === today ? templeResetUsed : 0);

  function completer(questIndex: number) {
    const quest = todayQuests[questIndex];
    if (!quest) return;
    for (let j = 0; j < quest.rids.length; j++) {
      if (Math.floor(inventaire[quest.rids[j] as ResourceId] ?? 0) < quest.qtys[j]) return;
    }
    for (let j = 0; j < quest.rids.length; j++) {
      retirerRessource(quest.rids[j] as ResourceId, quest.qtys[j]);
    }
    ajouterKirha(quest.reward);
    completerQueteTemple(questIndex);
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate('/home')}>{t('nav.back_home')}</button>
        <span style={s.headerTitle}>{t('temple.title')}</span>
        <div style={{ width:80 }} />
      </div>

      <div style={{ padding:'16px', paddingBottom:90 }}>

        {/* Intro */}
        <div style={s.introCard}>
          <span style={{ fontSize:'36px' }}>⛩️</span>
          <div style={{ flex:1 }}>
            <p style={{ color:'#1e0a16', fontSize:'14px', fontWeight:800, margin:0 }}>{t('temple.subtitle')}</p>
            <p style={{ color:'#7a4060', fontSize:'11px', margin:'4px 0 0' }}>
              {lang === 'en' ? 'Reset (midnight 🇫🇷): ' : 'Reset (minuit 🇫🇷) : '}
              <strong style={{ fontFamily:'monospace', color:'#c4306e' }}>{formatCountdown(countdown)}</strong>
            </p>
          </div>
        </div>

        {/* Niveau Perso + quêtes actives */}
        <div style={{ display:'flex', gap:8, marginBottom:12 }}>
          <div style={{ flex:1, padding:'8px 10px', background:'rgba(196,48,112,0.07)', border:'1px solid rgba(196,48,112,0.18)', borderRadius:12, textAlign:'center' }}>
            <span style={{ color:'#c43070', fontSize:18, fontWeight:900, display:'block' }}>{questCount}</span>
            <span style={{ color:'#7a4060', fontSize:9, fontWeight:700 }}>
              {lang === 'en' ? 'QUESTS/DAY' : 'QUÊTES/JOUR'}
            </span>
          </div>
          <div style={{ flex:2, padding:'8px 12px', background:'rgba(249,168,37,0.06)', border:'1px solid rgba(249,168,37,0.22)', borderRadius:12 }}>
            <span style={{ color:'#1e0a16', fontSize:11, fontWeight:700, display:'block' }}>
              {lang === 'en' ? `Lv. ${personageNiveau} Character` : `Personnage Lv. ${personageNiveau}`}
            </span>
            <span style={{ color:'#7a4060', fontSize:10 }}>
              {personageNiveau < 60
                ? (lang === 'en' ? `Up to 10 quests at Lv.60` : `Jusqu'à 10 quêtes au Lv.60`)
                : (lang === 'en' ? '🎉 Max quests!' : '🎉 Maximum débloqué !')}
            </span>
          </div>
          <div style={{ flex:1, padding:'8px 10px', background: resetsLeft > 0 ? 'rgba(249,168,37,0.08)' : 'rgba(212,100,138,0.04)', border:`1px solid ${resetsLeft > 0 ? 'rgba(249,168,37,0.28)' : 'rgba(212,100,138,0.12)'}`, borderRadius:12, textAlign:'center' }}>
            <span style={{ color: resetsLeft > 0 ? '#b07010' : '#9a6080', fontSize:18, fontWeight:900, display:'block' }}>{resetsLeft}</span>
            <span style={{ color:'#7a4060', fontSize:9, fontWeight:700 }}>REROLLS</span>
          </div>
        </div>

        {/* Quêtes */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {todayQuests.map((quest, i) => {
            if (!quest) return null;
            const isCompleted = completedIndices.includes(i);
            const canComplete = !isCompleted && quest.rids.every((rid, j) =>
              Math.floor(inventaire[rid as ResourceId] ?? 0) >= quest.qtys[j]
            );

            return (
              <div key={i} style={{
                ...s.questCard,
                borderColor: isCompleted ? 'rgba(106,191,68,0.4)' : 'rgba(196,48,112,0.18)',
                background:  isCompleted ? 'rgba(106,191,68,0.05)' : '#ffffff',
              }}>
                {/* Badge difficulté */}
                <span style={{ position:'absolute', top:8, right:10, color: DIFF_COLOR[quest.diff], fontSize:10, fontWeight:700 }}>
                  {DIFF_STARS[quest.diff]}
                </span>

                {/* Icône(s) */}
                <div style={s.questIconWrap}>
                  {quest.rids.length === 1
                    ? <span style={{ fontSize:28 }}>{emojiByResourceId(quest.rids[0])}</span>
                    : (
                      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                        {quest.rids.map(rid => (
                          <span key={rid} style={{ fontSize:18 }}>{emojiByResourceId(rid)}</span>
                        ))}
                      </div>
                    )
                  }
                </div>

                {/* Détails */}
                <div style={{ flex:1, minWidth:0 }}>
                  {quest.rids.map((rid, j) => {
                    const stock = Math.floor(inventaire[rid as ResourceId] ?? 0);
                    const needed = quest.qtys[j];
                    const ok = stock >= needed;
                    return (
                      <div key={rid} style={{ display:'flex', alignItems:'center', gap:5 }}>
                        <span style={{ color:'#1e0a16', fontSize:12, fontWeight:700 }}>
                          ×{needed} {getNomRessource(rid, lang)}
                        </span>
                        <span style={{ color: ok ? '#5a9a30' : '#c43070', fontSize:10 }}>({stock})</span>
                      </div>
                    );
                  })}
                  <span style={{ color:'#f9a825', fontSize:12, fontWeight:700, marginTop:3, display:'block' }}>
                    +{quest.reward} $KIRHA
                  </span>
                </div>

                {/* Boutons */}
                <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end', flexShrink:0 }}>
                  {isCompleted ? (
                    <span style={{ color:'#6abf44', fontSize:11, fontWeight:800 }}>{t('temple.completed')}</span>
                  ) : (
                    <button
                      disabled={!canComplete}
                      onClick={() => completer(i)}
                      style={{
                        ...s.offrirBtn,
                        background: canComplete ? 'linear-gradient(135deg,#c4306e,#8a25d4)' : 'rgba(212,100,138,0.08)',
                        color:      canComplete ? '#fff' : '#9a6080',
                        border:     canComplete ? 'none' : '1px solid rgba(212,100,138,0.18)',
                        opacity:    canComplete ? 1 : 0.55,
                        cursor:     canComplete ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {canComplete ? t('temple.quest_label') : t('temple.insufficient')}
                    </button>
                  )}
                  {!isCompleted && resetsLeft > 0 && (
                    <button
                      style={{ padding:'3px 8px', background:'rgba(249,168,37,0.1)', border:'1px solid rgba(249,168,37,0.32)', borderRadius:8, color:'#b07010', fontSize:9, fontWeight:700, cursor:'pointer' }}
                      onClick={() => resetQueteTempleManuel(i)}
                    >
                      🔄 {lang === 'en' ? 'Reroll' : 'Changer'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:    { position:'absolute', inset:0, background:'#fdf0f5', overflowY:'auto' },
  header:  { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background:'rgba(253,240,245,0.96)', backdropFilter:'blur(8px)', borderBottom:'1px solid rgba(212,100,138,0.15)', position:'sticky', top:0, zIndex:10 },
  backBtn: { color:'#7a4060', fontSize:'13px', fontWeight:600, background:'none', border:'none', cursor:'pointer' },
  headerTitle: { color:'#1e0a16', fontSize:'16px', fontWeight:800 },
  introCard: {
    display:'flex', alignItems:'center', gap:14,
    background:'#ffffff', border:'1px solid rgba(196,48,112,0.18)',
    borderRadius:16, padding:'14px 16px', marginBottom:14,
  },
  questCard: {
    position:'relative' as const,
    display:'flex', alignItems:'center', gap:12,
    border:'1px solid', borderRadius:14, padding:'12px 14px 12px 12px',
  },
  questIconWrap: {
    width:44, height:44, borderRadius:10, flexShrink:0,
    background:'rgba(212,100,138,0.06)', border:'1px solid rgba(212,100,138,0.13)',
    display:'flex', alignItems:'center', justifyContent:'center',
  },
  offrirBtn: {
    padding:'6px 10px', borderRadius:10, fontSize:11, fontWeight:800,
    whiteSpace:'nowrap' as const,
  },
};
