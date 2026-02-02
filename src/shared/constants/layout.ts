/**
 * Shared layout constants for consistent sizing across components
 */

/**
 * Height of the top header/navigation section (outer container)
 * Provides spacing from the top of the screen.
 * Used by:
 * - BrowserTabs (outer container height)
 * - ProjectSidebar (header section height)
 *
 * IMPORTANT: These components must remain aligned in height for visual consistency.
 */
export const HEADER_SECTION_HEIGHT = '48px';

/**
 * Height of the actual tab bar / interactive header content
 * The content is vertically centered within HEADER_SECTION_HEIGHT.
 */
export const HEADER_HEIGHT = '40px';
