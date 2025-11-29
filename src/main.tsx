import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChakraProvider } from '@chakra-ui/react';
import { system } from './theme';
import App from './App';
import { Toaster } from './components/ui/toaster';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ChakraProvider value={system}>
      <App />
      <Toaster />
    </ChakraProvider>
  </React.StrictMode>
);
