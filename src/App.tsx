/**
 * Root application component.
 * 
 * This is the main React component that serves as the entry point for the UI.
 * It demonstrates:
 * - How to use React hooks (useState, useEffect)
 * - How to call Tauri IPC commands
 * - How to handle async operations in React
 * - How to display data from the backend
 * 
 * In React, components are functions that return JSX (JavaScript XML),
 * which describes what the UI should look like.
 */

import { useState, useEffect } from 'react';
import { invokePing, invokeGetAppInfo, type AppInfo } from './ipc';
import Home from './pages/Home';
import Placeholder from './components/Placeholder';

/**
 * App component - the root of the React application.
 * 
 * This is a functional component (the modern React way).
 * It uses hooks to manage state and side effects.
 * 
 * @returns JSX that describes the UI
 */
function App() {
  // `useState` is a React hook that lets you add state to functional components
  // It returns an array with two elements:
  // [0] - the current state value
  // [1] - a function to update the state
  // 
  // TypeScript: `<string | null>` means the state can be a string or null
  // Initially, it's `null` because we haven't fetched the data yet
  const [pingResult, setPingResult] = useState<string | null>(null);
  
  // Another state variable for app info
  // This will hold the structured data from the backend
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  
  // State for loading indicators
  const [isLoading, setIsLoading] = useState(false);
  
  // State for error messages
  const [error, setError] = useState<string | null>(null);

  // `useEffect` is a React hook that runs side effects (like API calls)
  // The empty array `[]` as the second argument means this effect runs once
  // when the component first mounts (loads)
  useEffect(() => {
    // This function will be called when the component mounts
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Call the IPC command to get app info
        // `await` pauses execution until the promise resolves
        // This is how we handle async operations in JavaScript/TypeScript
        const info = await invokeGetAppInfo();
        
        // Update the state with the received data
        // This will trigger a re-render of the component
        setAppInfo(info);
      } catch (err) {
        // If the IPC call fails, catch the error
        // In TypeScript, we need to check if err is an Error object
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
      } finally {
        // `finally` runs regardless of success or failure
        setIsLoading(false);
      }
    };
    
    // Call the async function
    fetchData();
  }, []); // Empty dependency array = run once on mount

  // Handler function for the ping button
  // In React, event handlers are regular functions
  // The `async` keyword allows us to use `await` inside
  const handlePing = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Call the IPC command
      const result = await invokePing();
      
      // Update state with the result
      setPingResult(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // The component returns JSX, which looks like HTML but is actually JavaScript
  // JSX allows us to write HTML-like syntax that gets transformed into React elements
  return (
    <div>
      {/* JSX comments use curly braces and comment syntax */}
      
      <h1>Tauri + React + TypeScript App</h1>
      
      {/* Conditional rendering: only show if there's an error */}
      {error && (
        <div>
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {/* Loading indicator */}
      {isLoading && <div>Loading...</div>}
      
      {/* App Info Section */}
      <section>
        <h2>App Information</h2>
        {appInfo ? (
          // If appInfo exists, display it
          <div>
            <p><strong>Name:</strong> {appInfo.name}</p>
            <p><strong>Version:</strong> {appInfo.version}</p>
            <p><strong>Platform:</strong> {appInfo.platform}</p>
          </div>
        ) : (
          // Otherwise, show a loading message
          <p>Loading app info...</p>
        )}
      </section>
      
      {/* Ping Test Section */}
      <section>
        <h2>IPC Communication Test</h2>
        <button onClick={handlePing} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Ping Backend'}
        </button>
        {pingResult && (
          <div>
            <strong>Result:</strong> {pingResult}
          </div>
        )}
      </section>
      
      {/* Example Pages */}
      <section>
        <h2>Pages</h2>
        <Home />
      </section>
      
      {/* Example Components */}
      <section>
        <h2>Components</h2>
        <Placeholder message="This is a placeholder component" />
      </section>
    </div>
  );
}

// Export the component so it can be imported in other files
// `export default` means this is the main export from this file
export default App;

