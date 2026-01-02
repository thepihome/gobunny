import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hook for managing resizable table columns
 * @param {Array} initialWidths - Initial widths for each column (in pixels or percentages)
 * @param {string} storageKey - Optional localStorage key to persist column widths
 * @returns {Object} - Column widths, resize handlers, and column props
 */
export function useResizableColumns(initialWidths = [], storageKey = null) {
  // Load saved widths from localStorage if available
  const getInitialWidths = () => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length === initialWidths.length) {
            return parsed;
          }
        }
      } catch (e) {
        console.error('Error loading saved column widths:', e);
      }
    }
    return initialWidths;
  };

  const [columnWidths, setColumnWidths] = useState(getInitialWidths);
  const [isResizing, setIsResizing] = useState(false);
  const [resizingColumn, setResizingColumn] = useState(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const tableRef = useRef(null);

  // Save widths to localStorage when they change
  useEffect(() => {
    if (storageKey && columnWidths.length > 0) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(columnWidths));
      } catch (e) {
        console.error('Error saving column widths:', e);
      }
    }
  }, [columnWidths, storageKey]);

  const handleMouseDown = useCallback((index, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(true);
    setResizingColumn(index);
    startXRef.current = e.clientX;
    
    if (tableRef.current) {
      const th = tableRef.current.querySelectorAll('thead th')[index];
      if (th) {
        startWidthRef.current = th.offsetWidth;
      }
    }
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isResizing || resizingColumn === null) return;

    const diff = e.clientX - startXRef.current;
    const newWidth = Math.max(50, startWidthRef.current + diff); // Minimum width of 50px

    setColumnWidths(prev => {
      const newWidths = [...prev];
      newWidths[resizingColumn] = newWidth;
      return newWidths;
    });
  }, [isResizing, resizingColumn]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    setResizingColumn(null);
  }, []);

  // Add global event listeners for mouse move and up
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Get column style props
  const getColumnProps = useCallback((index) => {
    return {
      style: {
        width: columnWidths[index] || 'auto',
        minWidth: '50px',
        position: 'relative',
        userSelect: 'none'
      }
    };
  }, [columnWidths]);

  // Get resize handle component
  const ResizeHandle = useCallback(({ index }) => {
    return (
      <div
        onMouseDown={(e) => handleMouseDown(index, e)}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: '5px',
          cursor: 'col-resize',
          backgroundColor: isResizing && resizingColumn === index ? '#007bff' : 'transparent',
          zIndex: 10,
          userSelect: 'none'
        }}
        onMouseEnter={(e) => {
          if (!isResizing) {
            e.currentTarget.style.backgroundColor = '#007bff';
          }
        }}
        onMouseLeave={(e) => {
          if (!isResizing || resizingColumn !== index) {
            e.currentTarget.style.backgroundColor = 'transparent';
          }
        }}
      />
    );
  }, [isResizing, resizingColumn, handleMouseDown]);

  return {
    columnWidths,
    setColumnWidths,
    isResizing,
    tableRef,
    getColumnProps,
    ResizeHandle,
    resetWidths: () => setColumnWidths(initialWidths)
  };
}

