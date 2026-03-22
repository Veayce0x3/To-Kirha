import React from 'react';
import ReactDOM from 'react-dom/client';
import { WagmiProvider } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { wagmiConfig } from './config/wagmi';
import App from './App';

import '@rainbow-me/rainbowkit/styles.css';
import './index.css';

const queryClient = new QueryClient();

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    const { error } = this.state;
    if (error) return (
      <div style={{ position:'fixed', inset:0, background:'#1a0a1e', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px', zIndex:9999 }}>
        <span style={{ fontSize:'32px', marginBottom:'16px' }}>⚠️</span>
        <p style={{ color:'#ff6b9d', fontSize:'16px', fontWeight:700, marginBottom:'8px' }}>Erreur critique</p>
        <p style={{ color:'#c9a0b4', fontSize:'11px', textAlign:'center', marginBottom:'8px', fontFamily:'monospace', maxWidth:'90%', wordBreak:'break-all' }}>
          {(error as Error).message}
        </p>
        <p style={{ color:'#7a4060', fontSize:'10px', textAlign:'center', marginBottom:'24px', fontFamily:'monospace', maxWidth:'90%', wordBreak:'break-all' }}>
          {(error as Error).stack?.split('\n').slice(0, 4).join('\n')}
        </p>
        <button onClick={() => { localStorage.clear(); window.location.reload(); }}
          style={{ padding:'10px 20px', background:'#ff6b9d', color:'#1a0a1e', border:'none', borderRadius:'10px', cursor:'pointer', fontSize:'14px', fontWeight:700 }}>
          Réinitialiser
        </button>
      </div>
    );
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider
            initialChain={baseSepolia}
            modalSize="compact"
            theme={darkTheme({
              accentColor:           '#ff6b9d',
              accentColorForeground: '#1a0a1e',
              borderRadius:          'medium',
            })}
          >
            <App />
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </RootErrorBoundary>
  </React.StrictMode>
);
