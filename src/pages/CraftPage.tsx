import { useNavigate } from 'react-router-dom';
import { useT } from '../utils/i18n';

export function CraftPage() {
  const navigate = useNavigate();
  const { t } = useT();
  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate('/home')}>{t('craft.back_home')}</button>
        <span style={s.headerTitle}>{t('craft.title')}</span>
        <div style={{ width:80 }} />
      </div>
      <div style={s.body}>
        <span style={{ fontSize:'56px' }}>⚗️</span>
        <p style={{ color:'#1e0a16', fontSize:'18px', fontWeight:800, marginTop:16 }}>{t('craft.heading')}</p>
        <p style={{ color:'#7a4060', fontSize:'13px', marginTop:8, textAlign:'center', maxWidth:260, lineHeight:1.6 }}>
          {t('craft.desc')}<br />
          {t('craft.desc2')}
        </p>
        <div style={s.comingSoon}>{t('craft.wip')}</div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:   { position:'absolute', inset:0, background:'#fdf0f5', display:'flex', flexDirection:'column' },
  header: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background:'rgba(253,240,245,0.96)', backdropFilter:'blur(8px)', borderBottom:'1px solid rgba(212,100,138,0.15)' },
  backBtn: { color:'#7a4060', fontSize:'13px', fontWeight:600, background:'none', border:'none', cursor:'pointer' },
  headerTitle: { color:'#1e0a16', fontSize:'16px', fontWeight:800 },
  body: { flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px' },
  comingSoon: { marginTop:24, padding:'8px 20px', background:'rgba(141,110,99,0.15)', border:'1px solid rgba(141,110,99,0.3)', borderRadius:10, color:'#8d6e63', fontSize:'12px', fontWeight:700 },
};
