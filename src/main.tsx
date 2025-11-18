import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import App from './App';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ChakraProvider value={defaultSystem}>
      <App />
    </ChakraProvider>
  </React.StrictMode>
);
