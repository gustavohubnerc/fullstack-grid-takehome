'use client';

import { useState, useEffect } from 'react';

interface FormulaBarProps {
  selectedCell: string;
  cellValue: string;
  onValueChange: (value: string) => void;
  onCommit: () => void;
  onStartEdit: () => void;
  isEditing: boolean;
}

export default function FormulaBar({
  selectedCell,
  cellValue,
  onValueChange,
  onCommit,
  onStartEdit,
  isEditing
}: FormulaBarProps) {
  const [localValue, setLocalValue] = useState(cellValue);

  useEffect(() => {
    setLocalValue(cellValue);
  }, [cellValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalValue(value);
    if (!isEditing) {
      onStartEdit();
    }
    onValueChange(value);
  };

  const handleFocus = () => {
    if (!isEditing) {
      onStartEdit();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onCommit();
    } else if (e.key === 'Escape') {
      setLocalValue(cellValue);
      onValueChange(cellValue);
    }
  };

  return (
    <div className="formula-bar">
      <div className="formula-bar-address">
        {selectedCell || 'A1'}
      </div>
      
      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={onCommit}
        className={`formula-bar-input ${isEditing ? 'editing' : ''}`}
        placeholder="Enter formula or value..."
      />
    </div>
  );
}
