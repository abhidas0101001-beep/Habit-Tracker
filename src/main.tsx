import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { captureInstallPrompt, requestPersistentStorage } from './hooks/install';
import { startSync } from './sync/controller';
import './index.css';

captureInstallPrompt();
void requestPersistentStorage();
startSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
