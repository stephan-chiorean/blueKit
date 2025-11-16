/**
 * React application entry point.
 * 
 * This file is the first JavaScript/TypeScript code that runs when the app loads.
 * It:
 * 1. Imports React and ReactDOM
 * 2. Renders the root App component into the DOM
 * 3. Sets up the React application
 * 
 * In a Vite + React project, this file is referenced in `index.html`
 * and loaded as an ES module.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// `ReactDOM.createRoot()` creates a React root for concurrent rendering
// This is the React 18 way of rendering applications
// The root is attached to the element with id "root" in index.html
const rootElement = document.getElementById('root');

// TypeScript type guard: ensure the root element exists
// This prevents runtime errors if the element is missing
if (!rootElement) {
  throw new Error('Root element not found');
}

// Create the root and render the App component
// `render()` is called with JSX (JavaScript XML), which is React's syntax
// for describing UI components
ReactDOM.createRoot(rootElement).render(
  // `React.StrictMode` is a development tool that helps identify problems
  // It doesn't render any visible UI, but enables additional checks
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

