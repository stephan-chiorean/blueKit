import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChakraProvider } from '@chakra-ui/react';
import { system } from './theme';
import App from './app/App';
import { Toaster } from '@/shared/components/ui/toaster';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <ChakraProvider value={system}>
    <App />
    <Toaster />
  </ChakraProvider>
);
