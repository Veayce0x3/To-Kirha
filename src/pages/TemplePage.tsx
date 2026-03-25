import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore, xpRequis } from '../store/gameStore';
import { ResourceId } from '../data/resources';
import { useT } from '../utils/i18n';
import { emojiByResourceId } from '../utils/resourceUtils';

// ── Toutes les quêtes possibles ────────────────────────────
const ALL_QUESTS = [
  { rid: 1  as ResourceId, qty: 5, reward: 0.5,  label: '5 Frêne' },
  { rid: 11 as ResourceId, qty: 5, reward: 0.5,  label: '5 Blé' },
  { rid: 21 as ResourceId, qty: 5, reward: 0.5,  label: '5 Carpes' },
  { rid: 31 as ResourceId, qty: 5, reward: 0.5,  label: '5 Pierre' },
  { rid: 41 as ResourceId, qty: 5, reward: 0.5,  label: '5 Pissenlit' },
  { rid: 2  as ResourceId, qty: 3, reward: 0.8,  label: '3 Séquoia' },
  { rid: 12 as ResourceId, qty: 3, reward: 0.8,  label: '3 Orge' },
  { rid: 22 as ResourceId, qty: 3, reward: 0.8,  label: '3 Saumon' },
  { rid: 32 as ResourceId, qty: 3, reward: 1.0,  label: '3 Charbon' },
  { rid: 3  as ResourceId, qty: 2, reward: 1.2,  label: '2 Chêne' },
];

function getParisDate(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
}

function getDayOfYearParis(): number {
  const paris = getParisDate();
  const [y, m, d] = paris.split('-').map(Number);
  const start = new Date(y, 0, 0);
  const current = new Date(y, m - 1, d);
  return Math.round((current.getTime() - start.getTime()) / 86_400_000);
}

function getSecondsUntilMidnightParis(): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const h = parseInt(parts.find(p => p.type === 'hour')!.value);
  const m = parseInt(parts.find(p => p.type === 'minute')!.value);
  const s = parseInt(parts.find(p => p.type === 'second')!.value);
  return 86400 - (h * 3600 + m * 60 + s);
}

function formatCountdown(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

export function TemplePage() {
  const navigate    = useNavigate();
  const { t }       = useT();
  const inventaire  = useGameStore(s => s.inventaire);
  const ajouterKirha          = useGameStore(s => s.ajouterKirha);
  const retirerRessource      = useGameStore(s => s.retirerRessource);
  const templeCompleted       = useGameStore(s => s.templeCompleted);
  const templeCompletedDate   = useGameStore(s => s.templeCompletedDate);
  const templeResetUsed       = useGameStore(s => s.templeResetUsed);
  const templeResetDate       = useGameStore(s => s.templeResetDate);
  const templeSlotRerolls     = useGameStore(s => s.templeSlotRerolls);
  const completerQueteTemple  = useGameStore(s => s.completerQueteTemple);
  const resetTempleQuetes     = useGameStore(s => s.resetTempleQuetes);
  const resetQueteTempleManuel = useGameStore(s => s.resetQueteTempleManuel);

  const [countdown, setCountdown] = useState(getSecondsUntilMidnightParis());

  const today = getParisDate();

  // Auto-reset à minuit Paris : si la date stockée ≠ aujourd'hui, réinitialiser
  useEffect(() => {
    if (templeCompletedDate && templeCompletedDate !== today) {
      resetTempleQuetes();
    }
  }, [today, templeCompletedDate, resetTempleQuetes]);

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(getSecondsUntilMidnightParis());
      // Vérifier le changement de jour à chaque tick
      const newToday = getParisDate();
      if (templeCompletedDate && templeCompletedDate !== newToday) {
        resetTempleQuetes();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [templeCompletedDate, resetTempleQuetes]);

  // Quêtes du jour basées sur le jour de l'année Paris (rotation automatique + rerolls)
  const questDay = getDayOfYearParis();
  const todayIndices = [0, 1, 2].map(i => {
    const base = (questDay + i) % ALL_QUESTS.length;
    const rerolls = templeSlotRerolls?.[i] ?? 0;
    return (base + rerolls) % ALL_QUESTS.length;
  });
  const todayQuests = todayIndices.map(i => ALL_QUESTS[i]);

  // Quêtes complétées : seulement si la date correspond à aujourd'hui
  const completedIndices: number[] = (templeCompletedDate === today) ? (templeCompleted ?? []) : [];
  // Resets disponibles aujourd'hui
  const resetsLeft = 2 - (templeResetDate === today ? templeResetUsed : 0);

  function completer(questIndex: number) {
    const quest = todayQuests[questIndex];
    const stock = Math.floor(inventaire[quest.rid] ?? 0);
    if (stock < quest.qty) return;
    retirerRessource(quest.rid, quest.qty);
    ajouterKirha(quest.reward);
    completerQueteTemple(questIndex);
  }

  return (
    <div style={s.page}>
      {/* Header */}
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
              Prochain reset (minuit 🇫🇷) : <strong style={{ fontFamily:'monospace', color:'#c4306e' }}>{formatCountdown(countdown)}</strong>
            </p>
          </div>
        </div>

        {/* Resets disponibles */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background: resetsLeft > 0 ? 'rgba(249,168,37,0.08)' : 'rgba(212,100,138,0.04)', border:`1px solid ${resetsLeft > 0 ? 'rgba(249,168,37,0.3)' : 'rgba(212,100,138,0.12)'}`, borderRadius:12, marginBottom:12 }}>
          <span style={{ fontSize:20 }}>🔄</span>
          <div style={{ flex:1 }}>
            <span style={{ color:'#1e0a16', fontSize:12, fontWeight:700, display:'block' }}>
              Resets journaliers
            </span>
            <span style={{ color:'#7a4060', fontSize:10 }}>
              {resetsLeft > 0
                ? `${resetsLeft} reset${resetsLeft > 1 ? 's' : ''} disponible${resetsLeft > 1 ? 's' : ''} aujourd'hui`
                : 'Resets épuisés pour aujourd\'hui'}
            </span>
          </div>
          <span style={{ background: resetsLeft > 0 ? 'rgba(249,168,37,0.2)' : 'rgba(212,100,138,0.1)', color: resetsLeft > 0 ? '#b07010' : '#9a6080', fontSize:13, fontWeight:900, padding:'4px 10px', borderRadius:20 }}>
            {resetsLeft}/2
          </span>
        </div>

        {/* Quêtes */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {todayQuests.map((quest, i) => {
            const isCompleted = completedIndices.includes(i);
            const stock = Math.floor(inventaire[quest.rid] ?? 0);
            const canComplete = !isCompleted && stock >= quest.qty;
            const insufficient = !isCompleted && stock < quest.qty;

            return (
              <div key={i} style={{
                ...s.questCard,
                borderColor: isCompleted ? 'rgba(106,191,68,0.4)' : 'rgba(196,48,112,0.2)',
                background:  isCompleted ? 'rgba(106,191,68,0.06)' : '#ffffff',
              }}>
                <div style={s.questIcon}>
                  <span style={{ fontSize:'28px' }}>{emojiByResourceId(quest.rid)}</span>
                </div>
                <div style={{ flex:1 }}>
                  <span style={{ color:'#1e0a16', fontSize:'14px', fontWeight:800 }}>{quest.label}</span>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
                    <span style={{ color:'#f9a825', fontSize:'12px', fontWeight:700 }}>+{quest.reward} $KIRHA</span>
                    <span style={{ color:'#9a6080', fontSize:'10px' }}>· Stock: {stock}</span>
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end' }}>
                  {isCompleted ? (
                    <span style={{ color:'#6abf44', fontSize:'11px', fontWeight:800 }}>{t('temple.completed')}</span>
                  ) : (
                    <button
                      style={{
                        ...s.offrirBtn,
                        opacity:    canComplete ? 1 : 0.45,
                        cursor:     canComplete ? 'pointer' : 'not-allowed',
                        background: canComplete ? 'linear-gradient(135deg,#c4306e,#8a25d4)' : 'rgba(212,100,138,0.1)',
                        color:      canComplete ? '#fff' : '#7a4060',
                        border:     canComplete ? 'none' : '1px solid rgba(212,100,138,0.2)',
                      }}
                      disabled={!canComplete}
                      onClick={() => completer(i)}
                    >
                      {insufficient ? t('temple.insufficient') : t('temple.quest_label')}
                    </button>
                  )}
                  {!isCompleted && resetsLeft > 0 && (
                    <button
                      style={{ padding:'4px 8px', background:'rgba(249,168,37,0.12)', border:'1px solid rgba(249,168,37,0.35)', borderRadius:8, color:'#b07010', fontSize:9, fontWeight:700, cursor:'pointer' }}
                      onClick={() => resetQueteTempleManuel(i)}
                    >
                      🔄 Changer
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Info */}
        <div style={{ marginTop:16, padding:'12px 14px', background:'rgba(196,48,112,0.04)', border:'1px solid rgba(196,48,112,0.12)', borderRadius:12 }}>
          <p style={{ color:'#9a6080', fontSize:'11px', margin:0, lineHeight:1.6 }}>
            Les offrandes sont renouvelées chaque jour à minuit (heure française). Complétez les 3 quêtes quotidiennes pour gagner des $KIRHA. Le bouton "Changer" permet de remplacer une quête par une autre.
          </p>
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
    background:'#ffffff', border:'1px solid rgba(196,48,112,0.2)',
    borderRadius:16, padding:'14px 16px', marginBottom:14,
  },
  questCard: {
    display:'flex', alignItems:'center', gap:12,
    border:'1px solid', borderRadius:14, padding:'12px 14px',
    transition:'border-color 0.2s, background 0.2s',
  },
  questIcon: {
    width:52, height:52, borderRadius:12,
    background:'rgba(212,100,138,0.07)', border:'1px solid rgba(212,100,138,0.15)',
    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
  },
  offrirBtn: {
    padding:'7px 12px', borderRadius:10, fontSize:'11px', fontWeight:800,
    whiteSpace:'nowrap' as const,
  },
};
