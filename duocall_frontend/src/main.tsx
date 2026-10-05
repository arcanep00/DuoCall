import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found');

// StrictMode removed — it double-invokes effects in dev which breaks
// persistent WebSocket connections (causes code 1006 disconnects).
createRoot(rootElement).render(<App />);
