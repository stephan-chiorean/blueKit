import { ReactNode } from 'react';

interface MasonryLayoutProps {
  children: ReactNode;
  columnCount?: number;
  columnGap?: string;
}

/**
 * MasonryLayout - Shared masonry CSS layout wrapper for card views.
 * 
 * Uses CSS columns to create a masonry/pinterest-style layout.
 * Each child should have breakInside: 'avoid' to prevent breaking across columns.
 */
export function MasonryLayout({
  children,
  columnCount = 3,
  columnGap = '16px',
}: MasonryLayoutProps) {
  return (
    <div
      style={{
        columnCount,
        columnGap,
      }}
    >
      {children}
    </div>
  );
}

/**
 * MasonryItem - Wrapper for items in masonry layout.
 * 
 * Prevents items from breaking across columns.
 */
export function MasonryItem({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        breakInside: 'avoid',
        pageBreakInside: 'avoid',
        marginBottom: '16px',
        display: 'inline-block',
        width: '100%',
        WebkitColumnBreakInside: 'avoid',
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
