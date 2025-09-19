'use client';

import { useReducer, useCallback, useEffect } from 'react';
import { Sheet, CellAddress, toCellAddress } from '@/types';
import Cell from './Cell';
import FormulaBar from './FormulaBar';

interface GridState {
  selectedCell: CellAddress | null;
  isEditing: boolean;
  editingValue: string;
}

type GridAction = 
  | { type: 'SELECT_CELL'; address: CellAddress }
  | { type: 'START_EDIT'; address: CellAddress; value?: string }
  | { type: 'UPDATE_EDIT_VALUE'; value: string }
  | { type: 'COMMIT_EDIT' }
  | { type: 'CANCEL_EDIT' }
  | { type: 'NAVIGATE'; direction: 'up' | 'down' | 'left' | 'right' | 'home' | 'end' };

function gridReducer(state: GridState, action: GridAction): GridState {
  switch (action.type) {
    case 'SELECT_CELL':
      return {
        ...state,
        selectedCell: action.address,
        isEditing: false,
        editingValue: ''
      };
    
    case 'START_EDIT':
      return {
        ...state,
        selectedCell: action.address,
        isEditing: true,
        editingValue: action.value || ''
      };
    
    case 'UPDATE_EDIT_VALUE':
      return {
        ...state,
        editingValue: action.value
      };
    
    case 'COMMIT_EDIT':
      return {
        ...state,
        isEditing: false,
        editingValue: ''
      };
    
    case 'CANCEL_EDIT':
      return {
        ...state,
        isEditing: false,
        editingValue: ''
      };
    
    default:
      return state;
  }
}

interface GridProps {
  sheet: Sheet;
  onUpdateCell: (address: CellAddress, value: string) => void;
}

export default function Grid({ sheet, onUpdateCell }: GridProps) {
  const [state, dispatch] = useReducer(gridReducer, {
    selectedCell: toCellAddress('A1'),
    isEditing: false,
    editingValue: ''
  });

  const parseAddress = (addr: CellAddress): { col: number; row: number } => {
    const match = addr.match(/^([A-Z]+)(\d+)$/);
    if (!match) return { col: 0, row: 0 };
    
    const colStr = match[1];
    const rowNum = parseInt(match[2]) - 1;
    
    let col = 0;
    for (let i = 0; i < colStr.length; i++) {
      col = col * 26 + (colStr.charCodeAt(i) - 65 + 1);
    }
    col -= 1;
    
    return { col, row: rowNum };
  };

  const formatAddress = (col: number, row: number): CellAddress => {
    let colStr = '';
    let c = col;
    while (c >= 0) {
      colStr = String.fromCharCode(65 + (c % 26)) + colStr;
      c = Math.floor(c / 26) - 1;
    }
    return toCellAddress(`${colStr}${row + 1}`);
  };

  const handleCellSelect = useCallback((address: CellAddress) => {
    dispatch({ type: 'SELECT_CELL', address });
  }, []);

  const handleStartEdit = useCallback((address: CellAddress) => {
    const cell = sheet.cells[address];
    const value = cell?.kind === 'formula' ? cell.src : 
                  cell?.kind === 'literal' ? String(cell.value) : '';
    dispatch({ type: 'START_EDIT', address, value });
  }, [sheet.cells]);

  const handleValueChange = useCallback((value: string) => {
    dispatch({ type: 'UPDATE_EDIT_VALUE', value });
  }, []);

  const handleCommitEdit = useCallback(() => {
    if (state.selectedCell && state.isEditing) {
      onUpdateCell(state.selectedCell, state.editingValue);
      dispatch({ type: 'COMMIT_EDIT' });
    }
  }, [state.selectedCell, state.isEditing, state.editingValue, onUpdateCell]);

  const handleCancelEdit = useCallback(() => {
    dispatch({ type: 'CANCEL_EDIT' });
    handleCellSelect(state.selectedCell!);
  }, [state.selectedCell, handleCellSelect]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!state.selectedCell) return;

    const { col, row } = parseAddress(state.selectedCell);

    if (state.isEditing) {
      // Let cell handle editing keys
      return;
    }

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (row > 0) {
          const newAddr = formatAddress(col, row - 1);
          dispatch({ type: 'SELECT_CELL', address: newAddr });
        }
        break;
      
      case 'ArrowDown':
        e.preventDefault();
        if (row < sheet.rows - 1) {
          const newAddr = formatAddress(col, row + 1);
          dispatch({ type: 'SELECT_CELL', address: newAddr });
        }
        break;
      
      case 'ArrowLeft':
        e.preventDefault();
        if (col > 0) {
          const newAddr = formatAddress(col - 1, row);
          dispatch({ type: 'SELECT_CELL', address: newAddr });
        }
        break;
      
      case 'ArrowRight':
        e.preventDefault();
        if (col < sheet.cols - 1) {
          const newAddr = formatAddress(col + 1, row);
          dispatch({ type: 'SELECT_CELL', address: newAddr });
        }
        break;
      
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) {
          if (col > 0) {
            const newAddr = formatAddress(col - 1, row);
            dispatch({ type: 'SELECT_CELL', address: newAddr });
          }
        } else {
          if (col < sheet.cols - 1) {
            const newAddr = formatAddress(col + 1, row);
            dispatch({ type: 'SELECT_CELL', address: newAddr });
          }
        }
        break;
      
      case 'Enter':
        e.preventDefault();
        if (row < sheet.rows - 1) {
          const newAddr = formatAddress(col, row + 1);
          dispatch({ type: 'SELECT_CELL', address: newAddr });
        }
        break;
      
      case 'Home':
        e.preventDefault();
        const homeAddr = formatAddress(0, row);
        dispatch({ type: 'SELECT_CELL', address: homeAddr });
        break;
      
      case 'End':
        e.preventDefault();
        const endAddr = formatAddress(sheet.cols - 1, row);
        dispatch({ type: 'SELECT_CELL', address: endAddr });
        break;
      
      case 'F2':
        e.preventDefault();
        handleStartEdit(state.selectedCell);
        break;
      
      case 'Escape':
        e.preventDefault();
        dispatch({ type: 'SELECT_CELL', address: state.selectedCell });
        break;
    }
  }, [state.selectedCell, state.isEditing, sheet.rows, sheet.cols, handleStartEdit]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const getCurrentCellValue = () => {
    if (!state.selectedCell) return '';
    const cell = sheet.cells[state.selectedCell];
    if (state.isEditing) return state.editingValue;
    return cell?.kind === 'formula' ? cell.src : 
           cell?.kind === 'literal' ? String(cell.value) : '';
  };

  const colHeaders = Array.from({ length: Math.min(sheet.cols, 10) }, (_, i) => 
    String.fromCharCode(65 + i)
  );

  return (
    <div className="flex flex-col h-full">
      <FormulaBar
        selectedCell={state.selectedCell || 'A1'}
        cellValue={getCurrentCellValue()}
        onValueChange={(value) => dispatch({ type: 'UPDATE_EDIT_VALUE', value })}
        onCommit={handleCommitEdit}
        onStartEdit={() => state.selectedCell && handleStartEdit(state.selectedCell)}
        isEditing={state.isEditing}
      />
      
      <div className="flex-1 overflow-auto">
        <div className="grid-container inline-block min-w-full">
          {/* Column headers */}
          <div className="flex sticky top-0 z-20">
            <div className="w-12 h-8 grid-header flex items-center justify-center">
              
            </div>
            {colHeaders.map((col) => (
              <div
                key={col}
                className="w-20 h-8 grid-header flex items-center justify-center"
              >
                {col}
              </div>
            ))}
          </div>
          
          {/* Grid rows */}
          {Array.from({ length: Math.min(sheet.rows, 20) }, (_, row) => (
            <div key={row} className="flex">
              {/* Row header */}
              <div className="w-12 h-8 grid-header flex items-center justify-center">
                {row + 1}
              </div>
              
              {/* Cells */}
              {colHeaders.map((col) => {
                const address = toCellAddress(`${col}${row + 1}`);
                const cell = sheet.cells[address];
                
                return (
                  <Cell
                    key={address}
                    address={address}
                    cell={cell}
                    sheet={sheet}
                    isSelected={state.selectedCell === address}
                    isEditing={state.isEditing && state.selectedCell === address}
                    onSelect={handleCellSelect}
                    onStartEdit={handleStartEdit}
                    onValueChange={handleValueChange}
                    onCommitEdit={handleCommitEdit}
                    onCancelEdit={handleCancelEdit}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
