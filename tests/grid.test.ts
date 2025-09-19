import { test, expect, describe } from "bun:test";
import { 
  colToLetter, 
  letterToCol,
  parseAddress,
  formatAddress,
  getCellsInRange,
  parseRange
} from '@/lib/grid';
import { toCellAddress } from '@/types';

describe('Column Conversions', () => {
  test('colToLetter converts column index to letters', () => {
    // These will fail until implemented
    expect(colToLetter(0)).toBe('A');
    expect(colToLetter(1)).toBe('B');
    expect(colToLetter(25)).toBe('Z');
    expect(colToLetter(26)).toBe('AA');
    expect(colToLetter(27)).toBe('AB');
    expect(colToLetter(51)).toBe('AZ');
    expect(colToLetter(52)).toBe('BA');
    expect(colToLetter(701)).toBe('ZZ');
    expect(colToLetter(702)).toBe('AAA');
  });

  test('letterToCol converts letters to column index', () => {
    // These will fail until implemented
    expect(letterToCol('A')).toBe(0);
    expect(letterToCol('B')).toBe(1);
    expect(letterToCol('Z')).toBe(25);
    expect(letterToCol('AA')).toBe(26);
    expect(letterToCol('AB')).toBe(27);
    expect(letterToCol('AZ')).toBe(51);
    expect(letterToCol('BA')).toBe(52);
    expect(letterToCol('ZZ')).toBe(701);
    expect(letterToCol('AAA')).toBe(702);
  });
});

describe('Address Parsing', () => {
  test('parseAddress handles relative references', () => {
    // These will fail until implemented
    const result = parseAddress('A1');
    expect(result).toEqual({
      col: 0,
      row: 0,
      absoluteCol: false,
      absoluteRow: false
    });
  });

  test('parseAddress handles absolute references', () => {
    // These will fail until implemented
    expect(parseAddress('$A$1')).toEqual({
      col: 0,
      row: 0,
      absoluteCol: true,
      absoluteRow: true
    });

    expect(parseAddress('A$1')).toEqual({
      col: 0,
      row: 0,
      absoluteCol: false,
      absoluteRow: true
    });

    expect(parseAddress('$A1')).toEqual({
      col: 0,
      row: 0,
      absoluteCol: true,
      absoluteRow: false
    });
  });

  test('formatAddress creates proper address strings', () => {
    // These will fail until implemented
    expect(formatAddress(0, 0)).toBe(toCellAddress('A1'));
    expect(formatAddress(0, 0, true, true)).toBe(toCellAddress('$A$1'));
    expect(formatAddress(1, 2, false, true)).toBe(toCellAddress('B$3'));
    expect(formatAddress(25, 99, true, false)).toBe(toCellAddress('$Z100'));
  });
});

describe('Range Operations', () => {
  test('parseRange extracts start and end addresses', () => {
    // These will fail until implemented
    const result = parseRange('A1:B3');
    expect(result).toEqual({
      start: toCellAddress('A1'),
      end: toCellAddress('B3')
    });
  });

  test('getCellsInRange returns all cells in range', () => {
    // These will fail until implemented
    const cells = getCellsInRange(toCellAddress('A1'), toCellAddress('B2'));
    expect(cells).toEqual([
      toCellAddress('A1'),
      toCellAddress('A2'),
      toCellAddress('B1'),
      toCellAddress('B2')
    ]);
  });

  test('getCellsInRange handles single cell range', () => {
    // These will fail until implemented
    const cells = getCellsInRange(toCellAddress('C3'), toCellAddress('C3'));
    expect(cells).toEqual([toCellAddress('C3')]);
  });
});