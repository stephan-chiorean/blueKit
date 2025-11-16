/**
 * About page component.
 * 
 * This is another example page component showing the structure
 * for multiple pages in the application.
 * 
 * This demonstrates that you can have multiple page components
 * in the `pages/` folder, each handling different routes or views.
 */

/**
 * About component - example page component.
 * 
 * @returns JSX describing the about page content
 */
function About() {
  return (
    <div>
      <h3>About Page</h3>
      <p>This is another example page component.</p>
      <p>
        You can create as many page components as needed for your application.
        Each page can have its own state, effects, and logic.
      </p>
    </div>
  );
}

// Export the component
export default About;

