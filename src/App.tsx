import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { ConnectPage } from './pages/ConnectPage';
import { VillePage } from './pages/VillePage';
import { BucheronPage } from './pages/BucheronPage';

// Hash Router = fonctionne sur GitHub Pages sans config serveur
// URLs : /#/ /#/ville /#/bucheron

function Guard({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount();
  return isConnected ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/"          element={<ConnectPage />} />
        <Route path="/ville"     element={<Guard><VillePage /></Guard>} />
        <Route path="/bucheron"  element={<Guard><BucheronPage /></Guard>} />
      </Routes>
    </HashRouter>
  );
}
