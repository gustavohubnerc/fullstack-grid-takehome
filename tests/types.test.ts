import { test, expect, describe } from "bun:test";
import { 
  Cell, 
  FormulaCell, 
  isFormula,
  toCellAddress,
  parseCellAddress,
  formatCellAddress
} from '@/types';

describe('Type Guards', () => {
  test('isFormula correctly identifies formula cells', () => {
    const formulaCell: FormulaCell = {
      kind: 'formula',
      src: '=A1+B1',
      ast: null as any
    };
    
    const literalCell: Cell = {
      kind: 'literal',
      value: 42
    };
    
    const errorCell: Cell = {
      kind: 'error',
      code: 'DIV0',
      message: 'Division by zero'
    };
    
    expect(isFormula(formulaCell)).toBe(true);
    expect(isFormula(literalCell)).toBe(false);
    expect(isFormula(errorCell)).toBe(false);
  });
});

describe('Cell Address Helpers', () => {
  test('toCellAddress creates branded type', () => {
    const addr = toCellAddress('A1');
    expect(addr as string).toBe('A1');
  });
  
  test('parseCellAddress extracts column and row', () => {
    // This will fail until implemented
    expect(parseCellAddress(toCellAddress('A1'))).toEqual({ col: 0, row: 0 });
    expect(parseCellAddress(toCellAddress('B2'))).toEqual({ col: 1, row: 1 });
    expect(parseCellAddress(toCellAddress('AA99'))).toEqual({ col: 26, row: 98 });
  });
  
  test('formatCellAddress creates address from coordinates', () => {
    // This will fail until implemented
    expect(formatCellAddress(0, 0)).toBe(toCellAddress('A1'));
    expect(formatCellAddress(1, 1)).toBe(toCellAddress('B2'));
    expect(formatCellAddress(26, 98)).toBe(toCellAddress('AA99'));
  });
});