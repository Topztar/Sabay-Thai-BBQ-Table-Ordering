import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import { GlobalProvider } from './contexts/GlobalContext.tsx';
import { SimplifiedModeProvider } from './contexts/SimplifiedModeContext.tsx';
import './index.css';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <GlobalProvider>
        <SimplifiedModeProvider>
          <App />
        </SimplifiedModeProvider>
      </GlobalProvider>
    </QueryClientProvider>
  </StrictMode>,
);
