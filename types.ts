// Branded type for cell addresses
export type CellAddress = string & { __brand: 'CellAddress' };

// Helper functions for CellAddress
export const toCellAddress = (addr: string): CellAddress => {
  // Validate format (e.g., A1, B12, AA99, $A$1, A$1, $A1)
  const cellPattern = /^\$?[A-Z]+\$?[1-9][0-9]*$/;
  if (!cellPattern.test(addr)) {
    throw new Error(`Invalid cell address format: ${addr}`);
  }
  return addr as CellAddress;
};

export const parseCellAddress = (addr: CellAddress): { col: number; row: number } => {
  // Parse "A1", "$A1", "A$1", "$A$1" -> { col: 0, row: 0 }
  const match = addr.match(/^\$?([A-Z]+)\$?([1-9][0-9]*)$/);
  if (!match) {
    throw new Error(`Invalid cell address: ${addr}`);
  }
  
  const [, colStr, rowStr] = match;
  
  // Convert column letters to number (A=0, B=1, ..., Z=25, AA=26, etc.)
  let col = 0;
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 65 + 1);
  }
  col -= 1; // Convert to 0-based
  
  const row = parseInt(rowStr, 10) - 1; // Convert to 0-based
  
  return { col, row };
};

export const formatCellAddress = (col: number, row: number): CellAddress => {
  // Format { col: 0, row: 0 } -> "A1"
  if (col < 0 || row < 0) {
    throw new Error(`Invalid cell coordinates: col=${col}, row=${row}`);
  }
  
  // Convert column number to letters (0=A, 1=B, ..., 25=Z, 26=AA, etc.)
  let colStr = '';
  let colNum = col + 1; // Convert to 1-based
  
  while (colNum > 0) {
    colNum -= 1; // Adjust for 0-based alphabet
    colStr = String.fromCharCode(65 + (colNum % 26)) + colStr;
    colNum = Math.floor(colNum / 26);
  }
  
  const rowStr = (row + 1).toString(); // Convert to 1-based
  
  return toCellAddress(colStr + rowStr);
};

// Cell types (discriminated union)
export type Cell = LiteralCell | FormulaCell | ErrorCell;

export interface LiteralCell {
  kind: 'literal';
  value: number | string | boolean;
}

export interface FormulaCell {
  kind: 'formula';
  src: string;
  ast: FormulaAst;
}

export interface ErrorCell {
  kind: 'error';
  message: string;
  code: 'CYCLE' | 'REF' | 'PARSE' | 'DIV0';
}

// Formula AST nodes
export type FormulaAst =
  | NumberLiteral
  | StringLiteral
  | BooleanLiteral
  | CellRef
  | RangeRef
  | FunctionCall
  | BinaryOp
  | UnaryOp;

export interface NumberLiteral {
  type: 'number';
  value: number;
}

export interface StringLiteral {
  type: 'string';
  value: string;
}

export interface BooleanLiteral {
  type: 'boolean';
  value: boolean;
}

export interface CellRef {
  type: 'ref';
  address: CellAddress;
  absolute: { col: boolean; row: boolean };
}

export interface RangeRef {
  type: 'range';
  start: CellAddress;
  end: CellAddress;
}

export interface FunctionCall {
  type: 'function';
  name: string;
  args: FormulaAst[];
}

export interface BinaryOp {
  type: 'binary';
  op: '+' | '-' | '*' | '/' | '^' | '<' | '<=' | '>' | '>=' | '=' | '<>';
  left: FormulaAst;
  right: FormulaAst;
}

export interface UnaryOp {
  type: 'unary';
  op: '-' | '+';
  operand: FormulaAst;
}

// Sheet type
export interface Sheet {
  id: string;
  name: string;
  rows: number;
  cols: number;
  cells: Record<CellAddress, Cell>;
  updatedAt: Date;
}

// Type guard
export const isFormula = (cell: Cell): cell is FormulaCell => {
  return cell.kind === 'formula';
};

// Evaluation result types
export type CellValue = number | string | boolean | null;

export interface EvalResult {
  value: CellValue;
  error?: { code: string; message: string };
}

export interface ExplainTrace {
  cell: CellAddress;
  formula?: string;
  dependencies: CellAddress[];
  ranges: Array<{ start: CellAddress; end: CellAddress }>;
  value: CellValue;
}

// API types
export interface CellEdit {
  addr: CellAddress;
  kind: 'literal' | 'formula' | 'clear';
  value?: string | number | boolean;
  formula?: string;
}

export interface SheetCreateRequest {
  name: string;
  rows: number;
  cols: number;
}

export interface EvalRequest {
  id: string;
  addr: CellAddress;
}

// Database indexing notes:
// For a multi-sheet, multi-user Postgres implementation, consider these indices:
// 1. Primary: (sheet_id, row, col) - for direct cell lookups
// 2. (sheet_id, updated_at DESC) - for recent changes/activity
// 3. (user_id, sheet_id) - for user's sheets
// 4. (sheet_id, cell_type) WHERE cell_type = 'formula' - for dependency rebuilding
// 5. Full-text index on formula src for searching formulas