import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useT } from '../utils/i18n';

const ARTEFACT_INFO: Record<number, { nom: string; nomEn: string; emoji: string; description: string; descEn: string; type: 'meuble' | 'vetement' }> = {
  200: { nom: 'Trône Impérial du Samouraï', nomEn: "Samurai's Imperial Throne", emoji: '🏯', description: '+5% quantité tous métiers', descEn: '+5% yield all professions', type: 'meuble' },
  201: { nom: 'Fontaine Sacrée',            nomEn: 'Sacred Fountain',            emoji: '⛲', description: '+2 Eau/jour',                descEn: '+2 Water/day',           type: 'meuble' },
  202: { nom: 'Sanctuaire des Récoltes',    nomEn: 'Harvest Sanctuary',          emoji: '🌸', description: '+8% quantité en saison active', descEn: '+8% yield active season', type: 'meuble' },
  203: { nom: 'Kimono du Grand Maître',     nomEn: "Grand Master's Kimono",      emoji: '👘', description: '+5% quantité tous métiers',  descEn: '+5% yield all professions', type: 'vetement' },
  204: { nom: 'Masque du Forgeron',         nomEn: "Blacksmith's Mask",          emoji: '🎭', description: '-10% temps de récolte',       descEn: '-10% harvest time',     type: 'vetement' },
};

export function EncherePage() {
  const navigate   = useNavigate();
  const { lang }   = useT();
  const artefacts  = useGameStore(s => s.artefacts);
  const now        = Math.floor(Date.now() / 1000);

  const ownedIds = Object.keys(artefacts).map(Number);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate('/home')}>
          {lang === 'en' ? '← Home' : '← Accueil'}
        </button>
        <span style={s.headerTitle}>🏆 {lang === 'en' ? 'Auctions' : 'Enchères'}</span>
        <div style={{ width:80 }} />
      </div>

      <div style={{ padding:'16px', paddingBottom:90 }}>

        {/* Bannière coming soon */}
        <div style={{ background:'linear-gradient(135deg, rgba(138,37,212,0.08), rgba(196,48,112,0.06))', border:'1.5px solid rgba(138,37,212,0.25)', borderRadius:16, padding:'18px 16px', marginBottom:16, textAlign:'center' }}>
          <span style={{ fontSize:48, display:'block', marginBottom:8 }}>🏆</span>
          <p style={{ color:'#1e0a16', fontSize:15, fontWeight:900, margin:'0 0 6px' }}>
            {lang === 'en' ? 'Artefact Auctions' : 'Enchères d\'Artefacts'}
          </p>
          <p style={{ color:'#7a4060', fontSize:11, lineHeight:1.6, margin:'0 0 12px' }}>
            {lang === 'en'
              ? 'Win exclusive artefacts (furniture & wearables) that give powerful bonuses. Blind auctions in $KIRHA — top bidders win the lots.'
              : 'Remportez des artefacts exclusifs (meubles et vêtements) offrant des bonus puissants. Enchères secrètes en $KIRHA — les meilleures offres remportent les lots.'}
          </p>
          <div style={{ display:'inline-block', padding:'6px 16px', background:'rgba(138,37,212,0.12)', border:'1px solid rgba(138,37,212,0.3)', borderRadius:20 }}>
            <span style={{ color:'#8a25d4', fontSize:11, fontWeight:800 }}>
              🔧 {lang === 'en' ? 'Coming Soon' : 'Bientôt disponible'}
            </span>
          </div>
        </div>

        {/* Règles */}
        <div style={{ background:'#fff', border:'1px solid rgba(212,100,138,0.15)', borderRadius:14, padding:'14px', marginBottom:16 }}>
          <p style={{ color:'#1e0a16', fontSize:12, fontWeight:800, margin:'0 0 10px' }}>
            📜 {lang === 'en' ? 'How it works' : 'Comment ça marche'}
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[
              { icon:'🔒', text: lang === 'en' ? '90-day lock after winning — artefacts become tradeable on HDV after 90 days' : '90 jours de verrouillage après l\'obtention — échangeables sur le HDV ensuite' },
              { icon:'🏙️', text: lang === 'en' ? 'Linked to your City NFT — transfers with your city' : 'Lié à votre NFT Ville — se transfère avec la ville' },
              { icon:'💎', text: lang === 'en' ? 'Limited supply — each artefact has a fixed max quantity' : 'Offre limitée — chaque artefact a une quantité maximale fixe' },
              { icon:'$K', text: lang === 'en' ? 'Bid in $KIRHA — blind auction system' : 'Mises en $KIRHA — système d\'enchère secrète' },
            ].map((rule, i) => (
              <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                <span style={{ fontSize:16, flexShrink:0 }}>{rule.icon}</span>
                <span style={{ color:'#7a4060', fontSize:11, lineHeight:1.5 }}>{rule.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Artefacts à venir */}
        <p style={{ color:'#9a6080', fontSize:10, fontWeight:700, margin:'0 0 10px', letterSpacing:'0.05em' }}>
          {lang === 'en' ? 'UPCOMING ARTEFACTS' : 'ARTEFACTS À VENIR'}
        </p>
        <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
          {Object.entries(ARTEFACT_INFO).map(([idStr, info]) => (
            <div key={idStr} style={{ background:'linear-gradient(135deg,#fff9e6,#fff)', border:'1.5px solid rgba(212,170,50,0.3)', borderRadius:14, padding:'12px 14px', display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:32, flexShrink:0 }}>{info.emoji}</span>
              <div style={{ flex:1 }}>
                <span style={{ color:'#1e0a16', fontSize:13, fontWeight:800, display:'block' }}>
                  {lang === 'en' ? info.nomEn : info.nom}
                </span>
                <span style={{ color:'#5a9a30', fontSize:11, fontWeight:600, display:'block', marginTop:2 }}>
                  {lang === 'en' ? info.descEn : info.description}
                </span>
                <div style={{ display:'flex', gap:6, marginTop:4 }}>
                  <span style={{ background:'rgba(212,170,50,0.15)', color:'#b07010', fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:6 }}>🏆 Artefact</span>
                  <span style={{ background: info.type === 'meuble' ? 'rgba(106,191,68,0.1)' : 'rgba(196,48,112,0.1)', color: info.type === 'meuble' ? '#2a7a10' : '#c43070', fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:6 }}>
                    {info.type === 'meuble' ? (lang === 'en' ? '🏠 Furniture' : '🏠 Meuble') : (lang === 'en' ? '👕 Wearable' : '👕 Vêtement')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Mes artefacts */}
        {ownedIds.length > 0 && (
          <>
            <p style={{ color:'#9a6080', fontSize:10, fontWeight:700, margin:'6px 0 10px', letterSpacing:'0.05em' }}>
              {lang === 'en' ? `MY ARTEFACTS (${ownedIds.length})` : `MES ARTEFACTS (${ownedIds.length})`}
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {ownedIds.map(id => {
                const data = artefacts[id];
                const info = ARTEFACT_INFO[id];
                if (!info || !data) return null;
                const echangeableLe = data.acquis_le + 90 * 24 * 3600;
                const tradeable     = now >= echangeableLe;
                const daysLeft      = tradeable ? 0 : Math.ceil((echangeableLe - now) / 86400);
                return (
                  <div key={id} style={{ background:'linear-gradient(135deg,#fff9e6,#fff)', border:`1.5px solid ${tradeable ? 'rgba(106,191,68,0.4)' : 'rgba(212,170,50,0.4)'}`, borderRadius:14, padding:'12px 14px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ fontSize:30 }}>{info.emoji}</span>
                      <div style={{ flex:1 }}>
                        <span style={{ color:'#1e0a16', fontSize:13, fontWeight:800, display:'block' }}>
                          {lang === 'en' ? info.nomEn : info.nom}
                        </span>
                        <span style={{ color: tradeable ? '#2a7a10' : '#9a6080', fontSize:10, display:'block', marginTop:2 }}>
                          {tradeable
                            ? (lang === 'en' ? '✅ Tradeable on HDV' : '✅ Échangeable sur le HDV')
                            : (lang === 'en' ? `🔒 Tradeable in ${daysLeft}d` : `🔒 Échangeable dans ${daysLeft}j`)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:    { position:'absolute', inset:0, background:'#fdf0f5', overflowY:'auto' },
  header:  { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background:'rgba(253,240,245,0.96)', backdropFilter:'blur(8px)', borderBottom:'1px solid rgba(212,100,138,0.15)', position:'sticky', top:0, zIndex:10 },
  backBtn: { color:'#7a4060', fontSize:'13px', fontWeight:600, background:'none', border:'none', cursor:'pointer' },
  headerTitle: { color:'#1e0a16', fontSize:'16px', fontWeight:800 },
};
