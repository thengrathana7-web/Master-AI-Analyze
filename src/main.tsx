import { createRoot } from 'react-dom/client';
import App from './App';
import { StrategyProvider } from './context/StrategyContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrategyProvider>
    <App />
  </StrategyProvider>
);
