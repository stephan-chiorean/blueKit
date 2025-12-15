import { ReactNode, useRef, useEffect, useState, useMemo, useCallback, Children } from 'react';

interface MasonryLayoutProps {
  children: ReactNode;
  columnCount?: number;
  columnGap?: string;
}

interface ItemData {
  id: string;
  element: HTMLElement;
  height: number;
  columnIndex: number;
  top: number;
}

/**
 * MasonryLayout - JavaScript-based masonry layout that maintains item positions.
 * 
 * Uses ResizeObserver to track item heights and manually distributes items
 * across columns, maintaining stable positions when items expand/collapse.
 */
export function MasonryLayout({
  children,
  columnCount = 3,
  columnGap = '16px',
}: MasonryLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemsDataRef = useRef<Map<string, ItemData>>(new Map());
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const [itemKeys, setItemKeys] = useState<string[]>([]);

  // Extract keys from children
  useEffect(() => {
    const keys: string[] = [];
    Children.forEach(children, (child: any) => {
      if (child && child.key) {
        keys.push(String(child.key));
      }
    });
    setItemKeys(keys);
  }, [children]);

  // Calculate column width
  const getColumnWidth = useCallback(() => {
    if (!containerRef.current) return 0;
    const gapValue = parseFloat(columnGap) || 16;
    const totalGaps = (columnCount - 1) * gapValue;
    const availableWidth = containerRef.current.offsetWidth - totalGaps;
    return availableWidth / columnCount;
  }, [columnCount, columnGap]);

  // Recalculate positions for a specific column
  const recalculateColumn = useCallback((columnIndex: number) => {
    if (!containerRef.current) return;

    // Get all items in this column, maintain their original order (by DOM position)
    const containerChildren = Array.from(containerRef.current.children);
    const columnItems: ItemData[] = [];
    
    // Collect items in this column in DOM order
    containerChildren.forEach((containerChild) => {
      const itemId = (containerChild as HTMLElement).dataset.masonryItemId;
      if (!itemId) return;
      
      const itemData = itemsDataRef.current.get(itemId);
      if (itemData && itemData.columnIndex === columnIndex) {
        columnItems.push(itemData);
      }
    });

    // Recalculate top positions for this column (maintain order, just update positions)
    let currentTop = 0;
    const gapValue = parseFloat(columnGap) || 16;
    const colWidth = getColumnWidth();
    
    columnItems.forEach((item) => {
      item.top = currentTop;
      currentTop += item.height + gapValue;
      
      // Update DOM position with smooth transition
      const left = columnIndex * (colWidth + gapValue);
      item.element.style.transition = 'top 0.3s ease-out, left 0.3s ease-out, width 0.3s ease-out';
      item.element.style.left = `${left}px`;
      item.element.style.top = `${item.top}px`;
      item.element.style.width = `${colWidth}px`;
    });

    // Update container height based on all columns
    const allColumns = Array.from({ length: columnCount }, (_, i) => {
      const colItems = Array.from(itemsDataRef.current.values())
        .filter(item => item.columnIndex === i);
      if (colItems.length === 0) return 0;
      const lastItem = colItems.reduce((prev, curr) => 
        (curr.top + curr.height) > (prev.top + prev.height) ? curr : prev
      );
      return lastItem.top + lastItem.height;
    });
    const maxHeight = Math.max(...allColumns, 0);
    containerRef.current.style.transition = 'height 0.3s ease-out';
    containerRef.current.style.height = `${maxHeight}px`;
  }, [columnCount, columnGap, getColumnWidth]);

  // Initial layout calculation - distribute items to columns
  const calculateLayout = useCallback(() => {
    if (!containerRef.current) return;

    const items = Array.from(itemsDataRef.current.values());
    if (items.length === 0) return;

    // Initialize column heights
    const columnHeights = new Array(columnCount).fill(0);
    const gapValue = parseFloat(columnGap) || 16;
    const colWidth = getColumnWidth();

    // Get items in DOM order
    const containerChildren = Array.from(containerRef.current.children);
    const orderedItems: ItemData[] = [];
    
    containerChildren.forEach((containerChild) => {
      const itemId = (containerChild as HTMLElement).dataset.masonryItemId;
      if (!itemId) return;
      
      const itemData = itemsDataRef.current.get(itemId);
      if (itemData) {
        orderedItems.push(itemData);
      }
    });

    // Distribute items to columns
    orderedItems.forEach((item) => {
      // Find shortest column
      let shortestColumn = 0;
      for (let i = 1; i < columnCount; i++) {
        if (columnHeights[i] < columnHeights[shortestColumn]) {
          shortestColumn = i;
        }
      }

      // Assign item to shortest column
      item.columnIndex = shortestColumn;
      item.top = columnHeights[shortestColumn];
      
      // Update column height
      columnHeights[shortestColumn] += item.height + gapValue;

      // Apply position with smooth transition
      const left = shortestColumn * (colWidth + gapValue);
      item.element.style.position = 'absolute';
      item.element.style.transition = 'top 0.3s ease-out, left 0.3s ease-out, width 0.3s ease-out';
      item.element.style.left = `${left}px`;
      item.element.style.top = `${item.top}px`;
      item.element.style.width = `${colWidth}px`;
    });

    // Update container height with smooth transition
    const maxHeight = Math.max(...columnHeights);
    containerRef.current.style.transition = 'height 0.3s ease-out';
    containerRef.current.style.height = `${maxHeight}px`;
  }, [columnCount, columnGap, getColumnWidth]);

  // Initialize ResizeObserver
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') {
      console.warn('ResizeObserver not supported');
      return;
    }

    resizeObserverRef.current = new ResizeObserver((entries) => {
      // Cancel any pending layout update
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }

      // Schedule layout update
      rafIdRef.current = requestAnimationFrame(() => {
        let needsRecalc = false;
        const affectedColumns = new Set<number>();

        entries.forEach((entry) => {
          const element = entry.target as HTMLElement;
          const itemId = element.dataset.masonryItemId;
          if (!itemId) return;

          const itemData = itemsDataRef.current.get(itemId);
          if (!itemData) return;

          // Use getBoundingClientRect for more accurate height measurement
          const rect = element.getBoundingClientRect();
          const newHeight = rect.height || element.offsetHeight;
          
          if (Math.abs(itemData.height - newHeight) > 0.5) { // Use threshold to avoid tiny fluctuations
            itemData.height = newHeight;
            itemsDataRef.current.set(itemId, itemData);
            affectedColumns.add(itemData.columnIndex);
            needsRecalc = true;
          }
        });

        if (needsRecalc) {
          // Recalculate affected columns - CSS transitions will handle smooth animation
          affectedColumns.forEach(colIndex => {
            recalculateColumn(colIndex);
          });
        }
        rafIdRef.current = null;
      });
    });

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [recalculateColumn]);

  // Register items and set up observers
  useEffect(() => {
    if (!containerRef.current) return;

    // Wait for ResizeObserver to be initialized
    if (!resizeObserverRef.current) {
      // Retry after a short delay
      const timer = setTimeout(() => {
        if (containerRef.current && resizeObserverRef.current) {
          // Re-run this effect
          setItemKeys(prev => [...prev]);
        }
      }, 100);
      return () => clearTimeout(timer);
    }

    // Clear existing observers
    resizeObserverRef.current.disconnect();
    itemsDataRef.current.clear();

    // Register all items
    const containerChildren = Array.from(containerRef.current.children);
    containerChildren.forEach((containerChild, index) => {
      const element = containerChild as HTMLElement;
      const itemId = element.dataset.masonryItemId || `item-${index}`;
      
      // Measure initial height - use getBoundingClientRect for more accurate measurement
      const rect = element.getBoundingClientRect();
      const height = rect.height || element.offsetHeight || element.scrollHeight;
      
      const itemData: ItemData = {
        id: itemId,
        element,
        height: Math.max(height, 1), // Ensure at least 1px to avoid division issues
        columnIndex: 0, // Will be calculated
        top: 0,
      };

      itemsDataRef.current.set(itemId, itemData);
      element.dataset.masonryItemId = itemId;

      // Observe this element
      resizeObserverRef.current!.observe(element);
    });

    // Calculate initial layout after ensuring DOM is ready
    const timer = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        calculateLayout();
      });
    });

    return () => {
      cancelAnimationFrame(timer);
    };
  }, [itemKeys, calculateLayout]);

  // Recalculate on column count or gap change
  useEffect(() => {
    const timer = setTimeout(() => {
      calculateLayout();
    }, 0);
    return () => clearTimeout(timer);
  }, [columnCount, columnGap, calculateLayout]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      rafIdRef.current = requestAnimationFrame(() => {
        calculateLayout();
        rafIdRef.current = null;
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculateLayout]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
      }}
    >
      {children}
    </div>
  );
}

/**
 * MasonryItem - Wrapper for items in masonry layout.
 * 
 * Items are automatically positioned by MasonryLayout.
 * Each item is wrapped in a div that can be measured and positioned.
 */
export function MasonryItem({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        marginBottom: '16px',
        width: '100%',
        willChange: 'transform', // Optimize for animations
      }}
    >
      {children}
    </div>
  );
}
