/**
 * Placeholder component - example reusable component.
 * 
 * This component demonstrates:
 * - How to create reusable components
 * - How to accept props (properties) from parent components
 * - TypeScript prop typing with interfaces
 * 
 * Components in the `components/` folder are meant to be reusable
 * across different pages and parts of the application.
 */

/**
 * Props interface for the Placeholder component.
 * 
 * In TypeScript, we define the shape of props using an interface.
 * This provides type safety - TypeScript will error if you pass
 * the wrong type of props to the component.
 */
interface PlaceholderProps {
  /** The message to display in the placeholder */
  message: string;
  /** Optional subtitle (the `?` makes it optional) */
  subtitle?: string;
}

/**
 * Placeholder component - a simple reusable component.
 * 
 * This component accepts props and displays them.
 * Props are how parent components pass data to child components.
 * 
 * @param props - The component props (destructured)
 * @param props.message - Required message to display
 * @param props.subtitle - Optional subtitle
 * @returns JSX describing the placeholder UI
 */
function Placeholder({ message, subtitle }: PlaceholderProps) {
  // The props are destructured in the function parameters
  // This is equivalent to: `function Placeholder(props: PlaceholderProps) { const message = props.message; ... }`
  // But destructuring is cleaner and more common in React
  
  return (
    <div>
      {/* Display the required message prop */}
      <p><strong>Placeholder:</strong> {message}</p>
      
      {/* Conditional rendering: only show subtitle if it exists */}
      {/* The `&&` operator means "if subtitle exists, render the paragraph" */}
      {subtitle && <p><em>{subtitle}</em></p>}
    </div>
  );
}

// Export the component
export default Placeholder;

// Export the props type so other files can use it if needed
export type { PlaceholderProps };

