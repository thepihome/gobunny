import { useCallback, useMemo, useState } from 'react';

/**
 * Track multi-select state for list tables.
 */
export function useBulkSelection(items = [], getId = (item) => item.id) {
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const toggleOne = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    const ids = items.map(getId);
    setSelectedIds((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(ids);
    });
  }, [items, getId]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(getId(item))),
    [items, selectedIds, getId]
  );

  const allSelected = useMemo(() => {
    if (items.length === 0) return false;
    return items.every((item) => selectedIds.has(getId(item)));
  }, [items, selectedIds, getId]);

  const someSelected = selectedIds.size > 0;

  return {
    selectedIds,
    selectedItems,
    selectedCount: selectedIds.size,
    allSelected,
    someSelected,
    toggleOne,
    toggleAll,
    clearSelection,
    isSelected: (id) => selectedIds.has(id),
  };
}
