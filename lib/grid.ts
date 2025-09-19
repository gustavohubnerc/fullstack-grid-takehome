import { CellAddress, toCellAddress } from '@/types';

// Convert column index to letter(s) (0 -> A, 25 -> Z, 26 -> AA)
export function colToLetter(col: number): string {
  let result = '';
  let colNum = col + 1; // Convert to 1-based
  
  while (colNum > 0) {
    colNum -= 1; // Adjust for 0-based alphabet
    result = String.fromCharCode(65 + (colNum % 26)) + result;
    colNum = Math.floor(colNum / 26);
  }
  
  return result;
}

// Convert letter(s) to column index (A -> 0, Z -> 25, AA -> 26)
export function letterToCol(letters: string): number {
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 65 + 1);
  }
  return col - 1; // Convert to 0-based
}

// Parse a cell address with absolute/relative refs ($A$1, A$1, $A1, A1)
export function parseAddress(addr: string): {
  col: number;
  row: number;
  absoluteCol: boolean;
  absoluteRow: boolean;
} {
  const match = addr.match(/^(\$?)([A-Z]+)(\$?)([1-9][0-9]*)$/);
  if (!match) {
    throw new Error(`Invalid cell address: ${addr}`);
  }
  
  const [, colAbsolute, colStr, rowAbsolute, rowStr] = match;
  
  const col = letterToCol(colStr);
  const row = parseInt(rowStr, 10) - 1; // Convert to 0-based
  
  return {
    col,
    row,
    absoluteCol: colAbsolute === '$',
    absoluteRow: rowAbsolute === '$'
  };
}

// Format a cell address with absolute/relative refs
export function formatAddress(
  col: number,
  row: number,
  absoluteCol: boolean = false,
  absoluteRow: boolean = false
): CellAddress {
  const colStr = (absoluteCol ? '$' : '') + colToLetter(col);
  const rowStr = (absoluteRow ? '$' : '') + (row + 1); // Convert to 1-based
  return toCellAddress(colStr + rowStr);
}

// Parse a range (A1:B3)
export function parseRange(range: string): {
  start: CellAddress;
  end: CellAddress;
} {
  const parts = range.split(':');
  if (parts.length !== 2) {
    throw new Error(`Invalid range format: ${range}`);
  }
  
  return {
    start: toCellAddress(parts[0]),
    end: toCellAddress(parts[1])
  };
}

// Get all cells in a range
export function getCellsInRange(
  startAddr: CellAddress,
  endAddr: CellAddress
): CellAddress[] {
  const startParsed = parseAddress(startAddr);
  const endParsed = parseAddress(endAddr);
  
  const minCol = Math.min(startParsed.col, endParsed.col);
  const maxCol = Math.max(startParsed.col, endParsed.col);
  const minRow = Math.min(startParsed.row, endParsed.row);
  const maxRow = Math.max(startParsed.row, endParsed.row);
  
  const cells: CellAddress[] = [];
  
  for (let col = minCol; col <= maxCol; col++) {
    for (let row = minRow; row <= maxRow; row++) {
      cells.push(formatAddress(col, row));
    }
  }
  
  return cells;
}

// Adjust a cell reference when rows/columns are inserted or deleted
export function adjustReference(
  addr: CellAddress,
  insertedAt: { row?: number; col?: number },
  deletedAt: { row?: number; col?: number },
  isAbsolute: { col: boolean; row: boolean }
): CellAddress {
  const parsed = parseAddress(addr);
  let { col, row } = parsed;
  
  // Adjust for row insertions/deletions
  if (insertedAt.row !== undefined && !isAbsolute.row && row >= insertedAt.row) {
    row++;
  }
  if (deletedAt.row !== undefined && !isAbsolute.row && row > deletedAt.row) {
    row--;
  }
  
  // Adjust for column insertions/deletions
  if (insertedAt.col !== undefined && !isAbsolute.col && col >= insertedAt.col) {
    col++;
  }
  if (deletedAt.col !== undefined && !isAbsolute.col && col > deletedAt.col) {
    col--;
  }
  
  return formatAddress(col, row, parsed.absoluteCol, parsed.absoluteRow);
}

// Transform a formula when copying/pasting (relative refs change, absolute don't)
export function transformFormula(
  formula: string,
  fromCell: CellAddress,
  toCell: CellAddress
): string {
  const fromParsed = parseAddress(fromCell);
  const toParsed = parseAddress(toCell);
  const colOffset = toParsed.col - fromParsed.col;
  const rowOffset = toParsed.row - fromParsed.row;
  
  // Simple regex to find cell references in formula
  return formula.replace(/\b(\$?)([A-Z]+)(\$?)([1-9][0-9]*)\b/g, (match, colAbs, colStr, rowAbs, rowStr) => {
    const col = letterToCol(colStr);
    const row = parseInt(rowStr, 10) - 1;
    
    const newCol = colAbs === '$' ? col : col + colOffset;
    const newRow = rowAbs === '$' ? row : row + rowOffset;
    
    // Ensure we don't go negative
    if (newCol < 0 || newRow < 0) {
      return match; // Return original if would be invalid
    }
    
    return formatAddress(newCol, newRow, colAbs === '$', rowAbs === '$');
  });
}

// Check if a cell address is valid for given sheet dimensions
export function isValidAddress(
  addr: CellAddress,
  maxRows: number,
  maxCols: number
): boolean {
  try {
    const parsed = parseAddress(addr);
    return parsed.col >= 0 && parsed.col < maxCols && 
           parsed.row >= 0 && parsed.row < maxRows;
  } catch {
    return false;
  }
}

// Get neighboring cell address (for arrow key navigation)
export function getNeighbor(
  addr: CellAddress,
  direction: 'up' | 'down' | 'left' | 'right',
  maxRows: number,
  maxCols: number
): CellAddress | null {
  const parsed = parseAddress(addr);
  let { col, row } = parsed;
  
  switch (direction) {
    case 'up':
      row--;
      break;
    case 'down':
      row++;
      break;
    case 'left':
      col--;
      break;
    case 'right':
      col++;
      break;
  }
  
  // Check bounds
  if (col < 0 || col >= maxCols || row < 0 || row >= maxRows) {
    return null;
  }
  
  return formatAddress(col, row);
}