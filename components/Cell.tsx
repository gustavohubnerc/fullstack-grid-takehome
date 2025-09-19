'use client';

import { useState, useRef, useEffect } from 'react';
import { Cell as CellType, CellAddress } from '@/types';
import { engine } from '@/lib/engine';

interface CellProps {
  address: CellAddress;
  cell?: CellType;
  sheet: any; // Sheet object for formula evaluation
  isSelected: boolean;
  isEditing: boolean;
  onSelect: (address: CellAddress) => void;
  onStartEdit: (address: CellAddress) => void;
  onValueChange: (value: string) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
}

export default function Cell({
  address,
  cell,
  sheet,
  isSelected,
  isEditing,
  onSelect,
  onStartEdit,
  onValueChange,
  onCommitEdit,
  onCancelEdit
}: CellProps) {
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (cell) {
      if (cell.kind === 'formula') {
        setEditValue(cell.src);
      } else if (cell.kind === 'literal') {
        setEditValue(String(cell.value));
      } else if (cell.kind === 'error') {
        setEditValue(`#${cell.code}!`);
      }
    } else {
      setEditValue('');
    }
  }, [cell]);

  const displayValue = () => {
    if (!cell) return '';
    
    if (cell.kind === 'literal') {
      return String(cell.value);
    } else if (cell.kind === 'formula') {
      try {
        const result = engine.evaluateCell(sheet, address);
        if (result.error) {
          return `#${result.error.code}`;
        }
        return String(result.value);
      } catch (error) {
        return '#ERROR';
      }
    } else if (cell.kind === 'error') {
      return `#${cell.code}`;
    }
    
    return '';
  };

  const handleClick = () => {
    onSelect(address);
  };

  const handleDoubleClick = () => {
    onStartEdit(address);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isEditing) {
      if (e.key === 'Enter') {
        e.preventDefault();
        onCommitEdit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancelEdit();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        onCommitEdit();
      }
    } else {
      // Handle navigation and editing shortcuts
      if (e.key === 'F2') {
        e.preventDefault();
        onStartEdit(address);
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        // Direct typing starts edit mode
        onStartEdit(address);
        setEditValue(e.key);
        onValueChange(e.key);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEditValue(value);
    onValueChange(value);
  };

  const handleInputBlur = () => {
    if (isEditing) {
      onCommitEdit();
    }
  };

  const cellClasses = `
    grid-cell w-20 h-8
    ${isSelected ? 'selected' : ''}
    ${isEditing ? 'editing' : ''}
    flex items-center
    focus:outline-none
  `;

  return (
    <div
      className={cellClasses}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      tabIndex={isSelected ? 0 : -1}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          className="grid-cell-input"
        />
      ) : (
        <div className="grid-cell-content">
          <span 
            className={`
              ${cell?.kind === 'formula' ? 'cell-text-formula' : ''}
              ${cell?.kind === 'error' ? 'cell-text-error' : ''}
              ${cell?.kind === 'literal' && typeof cell.value === 'number' ? 'cell-text-number' : 'cell-text-string'}
            `}
          >
            {displayValue()}
          </span>
        </div>
      )}
    </div>
  );
}
