import React from 'react';
import { FiDownload, FiTrash2, FiZap, FiX } from 'react-icons/fi';
import IconButton from './IconButton';

const BulkActionBar = ({
  count,
  onClear,
  onExport,
  onDelete,
  onMatch,
  showDelete = true,
  showMatch = true,
  busy = false,
  busyAction = null,
}) => {
  if (count < 1) return null;

  return (
    <div className="bulk-action-bar" role="toolbar" aria-label="Bulk actions">
      <span className="bulk-action-bar__count">
        {count} selected
      </span>
      <div className="bulk-action-bar__actions page-toolbar">
        <IconButton
          icon={FiDownload}
          label="Export selected"
          onClick={onExport}
          disabled={busy}
        />
        {showMatch && onMatch && (
          <IconButton
            icon={FiZap}
            label="Run AI match"
            onClick={onMatch}
            disabled={busy}
            loading={busy && busyAction === 'match'}
          />
        )}
        {showDelete && onDelete && (
          <IconButton
            icon={FiTrash2}
            label="Deactivate selected"
            variant="danger"
            onClick={onDelete}
            disabled={busy}
          />
        )}
      </div>
      <IconButton
        icon={FiX}
        label="Clear selection"
        variant="ghost"
        size="sm"
        onClick={onClear}
        disabled={busy}
        className="bulk-action-bar__clear"
      />
    </div>
  );
};

export default BulkActionBar;
