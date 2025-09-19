import { test, expect, describe, beforeEach } from "bun:test";
import { FormulaEngine, DependencyGraph } from '@/lib/engine';
import { parseFormula } from '@/lib/parser';
import { Sheet, toCellAddress } from '@/types';
import { createSeedSheet } from '@/lib/seed';

describe('Formula Parser', () => {
  test('parses basic arithmetic', () => {
    const ast = parseFormula('1+2*3');
    expect(ast).toBeDefined();
    expect(ast.type).toBe('binary');
  });
  
  test('handles operator precedence correctly', () => {
    // Should parse as 1+(2*3) not (1+2)*3
    const ast = parseFormula('1+2*3');
    expect(ast.type).toBe('binary');
    if (ast.type === 'binary') {
      expect(ast.op).toBe('+');
      // Right side should be multiplication
      expect(ast.right.type).toBe('binary');
      if (ast.right.type === 'binary') {
        expect(ast.right.op).toBe('*');
      }
    }
  });
  
  test('parses cell references', () => {
    const ast = parseFormula('A1');
    expect(ast.type).toBe('ref');
    if (ast.type === 'ref') {
      expect(ast.address).toBe(toCellAddress('A1'));
    }
  });
  
  test('parses function calls', () => {
    const ast = parseFormula('SUM(A1,B2,C3)');
    expect(ast.type).toBe('function');
    if (ast.type === 'function') {
      expect(ast.name).toBe('SUM');
      expect(ast.args).toHaveLength(3);
    }
  });
});

describe('Dependency Graph', () => {
  test('detects direct cycles', () => {
    const graph = new DependencyGraph();
    graph.addDependency(toCellAddress('A1'), toCellAddress('B1'));
    graph.addDependency(toCellAddress('B1'), toCellAddress('C1'));
    
    // Adding C1 -> A1 would create a cycle
    expect(graph.hasCycle(toCellAddress('C1'), toCellAddress('A1'))).toBe(true);
  });

  test('detects self-reference cycles', () => {
    const graph = new DependencyGraph();
    expect(graph.hasCycle(toCellAddress('A1'), toCellAddress('A1'))).toBe(true);
  });
  
  test('correctly identifies no cycle', () => {
    const graph = new DependencyGraph();
    graph.addDependency(toCellAddress('A1'), toCellAddress('B1'));
    graph.addDependency(toCellAddress('A1'), toCellAddress('C1'));
    
    // A1 depends on B1 and C1, no cycle
    expect(graph.hasCycle(toCellAddress('D1'), toCellAddress('A1'))).toBe(false);
  });
});

describe('Formula Evaluation', () => {
  let engine: FormulaEngine;
  let sheet: Sheet;
  
  beforeEach(() => {
    engine = new FormulaEngine();
    sheet = createSeedSheet();
  });
  
  test('evaluates literal cells', () => {
    const result = engine.evaluateCell(sheet, toCellAddress('A3'));
    expect(result.value).toBe(1000);
    expect(result.error).toBeUndefined();
  });
  
  test('evaluates simple arithmetic formula', () => {
    // C3 contains "=A3-B3" where A3=1000, B3=300
    const result = engine.evaluateCell(sheet, toCellAddress('C3'));
    expect(result.value).toBe(700);
  });
  
  test('detects circular references in seed data', () => {
    // C6 and C7 have a circular reference
    const result = engine.evaluateCell(sheet, toCellAddress('C6'));
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe('CYCLE');
  });
});

describe('Built-in Functions', () => {
  test('SUM adds numbers correctly', () => {
    const sheet: Sheet = {
      id: 'test',
      name: 'Test',
      rows: 10,
      cols: 10,
      cells: {
        [toCellAddress('A1')]: { kind: 'literal', value: 10 },
        [toCellAddress('A2')]: { kind: 'literal', value: 20 },
        [toCellAddress('A3')]: { kind: 'literal', value: 30 },
        [toCellAddress('B1')]: { 
          kind: 'formula', 
          src: '=SUM(A1:A3)',
          ast: parseFormula('SUM(A1:A3)')
        }
      },
      updatedAt: new Date()
    };
    
    const engine = new FormulaEngine();
    const result = engine.evaluateCell(sheet, toCellAddress('B1'));
    expect(result.value).toBe(60);
  });

  test('IF evaluates conditions', () => {
    const sheet: Sheet = {
      id: 'test',
      name: 'Test',
      rows: 10,
      cols: 10,
      cells: {
        [toCellAddress('A1')]: { kind: 'literal', value: 10 },
        [toCellAddress('B1')]: { 
          kind: 'formula', 
          src: '=IF(A1>5,"big","small")',
          ast: parseFormula('IF(A1>5,"big","small")')
        }
      },
      updatedAt: new Date()
    };
    
    const engine = new FormulaEngine();
    const result = engine.evaluateCell(sheet, toCellAddress('B1'));
    expect(result.value).toBe('big');
  });
});