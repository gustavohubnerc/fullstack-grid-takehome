import { 
  Sheet, 
  Cell, 
  CellAddress, 
  FormulaAst, 
  CellValue, 
  EvalResult,
  ExplainTrace,
  ErrorCell,
  parseCellAddress,
  formatCellAddress
} from '@/types';
// import { parseFormula } from './parser';

// Dependency graph for cycle detection
export class DependencyGraph {
  private dependencies: Map<CellAddress, Set<CellAddress>> = new Map();
  private dependents: Map<CellAddress, Set<CellAddress>> = new Map();

  addDependency(from: CellAddress, to: CellAddress): void {
    // Add edge from -> to
    if (!this.dependencies.has(from)) {
      this.dependencies.set(from, new Set());
    }
    if (!this.dependents.has(to)) {
      this.dependents.set(to, new Set());
    }
    
    this.dependencies.get(from)!.add(to);
    this.dependents.get(to)!.add(from);
  }

  removeDependencies(cell: CellAddress): void {
    // Remove all dependencies from this cell
    const deps = this.dependencies.get(cell);
    if (deps) {
      // Remove this cell from dependents of its dependencies
      for (const dep of deps) {
        const dependents = this.dependents.get(dep);
        if (dependents) {
          dependents.delete(cell);
        }
      }
      this.dependencies.delete(cell);
    }
    
    // Remove this cell from dependencies of its dependents
    const dependents = this.dependents.get(cell);
    if (dependents) {
      for (const dependent of dependents) {
        const deps = this.dependencies.get(dependent);
        if (deps) {
          deps.delete(cell);
        }
      }
      this.dependents.delete(cell);
    }
  }

  getDependencies(cell: CellAddress): Set<CellAddress> {
    return this.dependencies.get(cell) || new Set();
  }

  getDependents(cell: CellAddress): Set<CellAddress> {
    return this.dependents.get(cell) || new Set();
  }

  hasCycle(from: CellAddress, to: CellAddress): boolean {
    // Detect if adding from -> to would create a cycle
    // Use DFS to check if 'to' can reach 'from'
    const visited = new Set<CellAddress>();
    const stack = [to];
    
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === from) {
        return true; // Cycle detected
      }
      
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);
      
      const deps = this.dependencies.get(current);
      if (deps) {
        for (const dep of deps) {
          if (!visited.has(dep)) {
            stack.push(dep);
          }
        }
      }
    }
    
    return false;
  }

  getEvaluationOrder(cells: CellAddress[]): CellAddress[] {
    // Topological sort for evaluation order (Kahn's algorithm)
    const inDegree = new Map<CellAddress, number>();
    const result: CellAddress[] = [];
    const queue: CellAddress[] = [];
    
    // Initialize in-degree count
    for (const cell of cells) {
      inDegree.set(cell, 0);
    }
    
    // Calculate in-degrees
    for (const cell of cells) {
      const deps = this.dependencies.get(cell);
      if (deps) {
        for (const dep of deps) {
          if (inDegree.has(dep)) {
            inDegree.set(dep, inDegree.get(dep)! + 1);
          }
        }
      }
    }
    
    // Find cells with no dependencies
    for (const [cell, degree] of inDegree) {
      if (degree === 0) {
        queue.push(cell);
      }
    }
    
    // Process queue
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);
      
      const deps = this.dependencies.get(current);
      if (deps) {
        for (const dep of deps) {
          if (inDegree.has(dep)) {
            const newDegree = inDegree.get(dep)! - 1;
            inDegree.set(dep, newDegree);
            if (newDegree === 0) {
              queue.push(dep);
            }
          }
        }
      }
    }
    
    return result;
  }
}

// Formula evaluation context
export interface EvalContext {
  sheet: Sheet;
  currentCell: CellAddress;
  visited: Set<CellAddress>;
  trace: ExplainTrace[];
}

// Main evaluation engine
export class FormulaEngine {
  private depGraph: DependencyGraph = new DependencyGraph();

  evaluateSheet(sheet: Sheet): Map<CellAddress, EvalResult> {
    // Evaluate all formulas in dependency order
    const results = new Map<CellAddress, EvalResult>();
    
    // 1. Build dependency graph
    this.depGraph = new DependencyGraph();
    const formulaCells: CellAddress[] = [];
    
    for (const [address, cell] of Object.entries(sheet.cells)) {
      if (cell.kind === 'formula') {
        formulaCells.push(address as CellAddress);
        // Extract dependencies from AST
        this.extractDependencies(cell.ast, address as CellAddress);
      }
    }
    
    // 2. Get topological order
    const evaluationOrder = this.depGraph.getEvaluationOrder(formulaCells);
    
    // 3. Evaluate in order
    for (const address of evaluationOrder) {
      const result = this.evaluateCell(sheet, address);
      results.set(address, result);
    }
    
    return results;
  }

  evaluateCell(
    sheet: Sheet, 
    address: CellAddress,
    trace: boolean = false
  ): EvalResult & { explain?: ExplainTrace[] } {
    const cell = sheet.cells[address];
    
    if (!cell) {
      return { value: '' };
    }

    if (cell.kind === 'literal') {
      return { value: cell.value };
    }

    if (cell.kind === 'error') {
      return { 
        value: null, 
        error: { code: cell.code, message: cell.message } 
      };
    }

    if (cell.kind === 'formula') {
      try {
        const ctx: EvalContext = {
          sheet,
          currentCell: address,
          visited: new Set([address]),
          trace: []
        };

        const value = this.evaluateAst(cell.ast, ctx);
        
        return {
          value,
          ...(trace && { explain: ctx.trace })
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Check if it's a circular reference error
        if (errorMessage.startsWith('CIRC:')) {
          const errorCell = this.createError('CYCLE', errorMessage.substring(5));
          return { 
            value: null, 
            error: { code: errorCell.code, message: errorCell.message }
          };
        }
        
        const errorCell = this.createError('PARSE', errorMessage);
        return { 
          value: null, 
          error: { code: errorCell.code, message: errorCell.message }
        };
      }
    }

    const errorCell = this.createError('PARSE', 'Unknown cell type');
    return { 
      value: null, 
      error: { code: errorCell.code, message: errorCell.message }
    };
  }

  private evaluateAst(ast: FormulaAst, ctx: EvalContext): CellValue {
    switch (ast.type) {
      case 'number':
        return ast.value;
      
      case 'string':
        return ast.value;
      
      case 'boolean':
        return ast.value;
      
      case 'ref':
        return this.evaluateCellRef(ast.address, ctx);
      
      case 'range':
        // For ranges, we return the array - functions will handle this
        return this.evaluateRange(ast.start, ast.end, ctx) as any;
      
      case 'function':
        return this.evaluateFunction(ast.name, ast.args, ctx);
      
      case 'binary':
        return this.evaluateBinaryOp(ast.op, ast.left, ast.right, ctx);
      
      case 'unary':
        const operand = this.evaluateAst(ast.operand, ctx);
        if (ast.op === '-') {
          return typeof operand === 'number' ? -operand : 0;
        } else if (ast.op === '+') {
          return typeof operand === 'number' ? operand : 0;
        }
        throw new Error(`Unknown unary operator: ${ast.op}`);
      
      default:
        throw new Error('Unknown AST node type');
    }
  }

  private evaluateCellRef(address: CellAddress, ctx: EvalContext): CellValue {
    // Check for cycles
    if (ctx.visited.has(address)) {
      throw new Error(`CIRC:Circular reference detected: ${address}`);
    }

    const cell = ctx.sheet.cells[address];
    if (!cell) {
      return '';
    }

    if (cell.kind === 'literal') {
      return cell.value;
    }

    if (cell.kind === 'error') {
      throw new Error(cell.message);
    }

    if (cell.kind === 'formula') {
      // Add to visited set to detect cycles
      ctx.visited.add(address);
      
      try {
        const result = this.evaluateAst(cell.ast, ctx);
        ctx.visited.delete(address);
        return result;
      } catch (error) {
        ctx.visited.delete(address);
        throw error;
      }
    }

    return '';
  }

  private evaluateRange(start: CellAddress, end: CellAddress, ctx: EvalContext): CellValue[] {
    const values: CellValue[] = [];
    
    // Parse start and end addresses
    const startParsed = parseCellAddress(start);
    const endParsed = parseCellAddress(end);
    
    // Iterate through all cells in the range
    for (let row = startParsed.row; row <= endParsed.row; row++) {
      for (let col = startParsed.col; col <= endParsed.col; col++) {
        const cellAddr = formatCellAddress(col, row);
        const cellValue = this.evaluateCellRef(cellAddr, ctx);
        values.push(cellValue);
      }
    }
    
    return values;
  }

  private evaluateFunction(name: string, args: FormulaAst[], ctx: EvalContext): CellValue {
    const upperName = name.toUpperCase();
    
    switch (upperName) {
      case 'SUM':
        return this.evaluateSum(args, ctx);
      case 'AVERAGE':
      case 'AVG':
        return this.evaluateAverage(args, ctx);
      case 'MIN':
        return this.evaluateMin(args, ctx);
      case 'MAX':
        return this.evaluateMax(args, ctx);
      case 'COUNT':
        return this.evaluateCount(args, ctx);
      case 'IF':
        return this.evaluateIf(args, ctx);
      default:
        throw new Error(`Unknown function: ${name}`);
    }
  }

  private evaluateSum(args: FormulaAst[], ctx: EvalContext): number {
    let sum = 0;
    for (const arg of args) {
      const values = this.getNumericValues(arg, ctx);
      sum += values.reduce((acc, val) => acc + val, 0);
    }
    return sum;
  }

  private evaluateAverage(args: FormulaAst[], ctx: EvalContext): number {
    let sum = 0;
    let count = 0;
    for (const arg of args) {
      const values = this.getNumericValues(arg, ctx);
      sum += values.reduce((acc, val) => acc + val, 0);
      count += values.length;
    }
    return count > 0 ? sum / count : 0;
  }

  private evaluateMin(args: FormulaAst[], ctx: EvalContext): number {
    let min = Infinity;
    for (const arg of args) {
      const values = this.getNumericValues(arg, ctx);
      for (const val of values) {
        if (val < min) min = val;
      }
    }
    return min === Infinity ? 0 : min;
  }

  private evaluateMax(args: FormulaAst[], ctx: EvalContext): number {
    let max = -Infinity;
    for (const arg of args) {
      const values = this.getNumericValues(arg, ctx);
      for (const val of values) {
        if (val > max) max = val;
      }
    }
    return max === -Infinity ? 0 : max;
  }

  private evaluateCount(args: FormulaAst[], ctx: EvalContext): number {
    let count = 0;
    for (const arg of args) {
      const values = this.getAllValues(arg, ctx);
      count += values.filter(val => val !== null && val !== '').length;
    }
    return count;
  }

  private evaluateIf(args: FormulaAst[], ctx: EvalContext): CellValue {
    if (args.length < 2 || args.length > 3) {
      throw new Error('IF function requires 2 or 3 arguments');
    }
    
    const condition = this.evaluateAst(args[0], ctx);
    const isTruthy = Boolean(condition) && condition !== 0 && condition !== '';
    
    if (isTruthy) {
      return this.evaluateAst(args[1], ctx);
    } else if (args.length === 3) {
      return this.evaluateAst(args[2], ctx);
    } else {
      return false;
    }
  }

  private getNumericValues(ast: FormulaAst, ctx: EvalContext): number[] {
    const value = this.evaluateAst(ast, ctx);
    
    if (Array.isArray(value)) {
      return value.filter(v => typeof v === 'number');
    } else if (typeof value === 'number') {
      return [value];
    } else if (typeof value === 'string' && !isNaN(Number(value))) {
      return [Number(value)];
    }
    
    return [];
  }

  private getAllValues(ast: FormulaAst, ctx: EvalContext): CellValue[] {
    const value = this.evaluateAst(ast, ctx);
    
    if (Array.isArray(value)) {
      return value;
    } else {
      return [value];
    }
  }

  private evaluateBinaryOp(
    op: string,
    left: FormulaAst,
    right: FormulaAst,
    ctx: EvalContext
  ): CellValue {
    const leftVal = this.evaluateAst(left, ctx);
    const rightVal = this.evaluateAst(right, ctx);

    // Arithmetic operations
    if (op === '+') {
      const leftNum = this.toNumber(leftVal);
      const rightNum = this.toNumber(rightVal);
      return leftNum + rightNum;
    }
    if (op === '-') {
      const leftNum = this.toNumber(leftVal);
      const rightNum = this.toNumber(rightVal);
      return leftNum - rightNum;
    }
    if (op === '*') {
      const leftNum = this.toNumber(leftVal);
      const rightNum = this.toNumber(rightVal);
      return leftNum * rightNum;
    }
    if (op === '/') {
      const leftNum = this.toNumber(leftVal);
      const rightNum = this.toNumber(rightVal);
      if (rightNum === 0) {
        throw new Error('Division by zero');
      }
      return leftNum / rightNum;
    }
    if (op === '^') {
      const leftNum = this.toNumber(leftVal);
      const rightNum = this.toNumber(rightVal);
      return Math.pow(leftNum, rightNum);
    }

    // Comparison operations
    if (op === '=') {
      return leftVal === rightVal;
    }
    if (op === '<>') {
      return leftVal !== rightVal;
    }
    if (op === '<') {
      return this.toNumber(leftVal) < this.toNumber(rightVal);
    }
    if (op === '<=') {
      return this.toNumber(leftVal) <= this.toNumber(rightVal);
    }
    if (op === '>') {
      return this.toNumber(leftVal) > this.toNumber(rightVal);
    }
    if (op === '>=') {
      return this.toNumber(leftVal) >= this.toNumber(rightVal);
    }

    throw new Error(`Unknown binary operator: ${op}`);
  }

  private toNumber(value: CellValue): number {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string') {
      const num = Number(value);
      return isNaN(num) ? 0 : num;
    }
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    return 0;
  }

  updateCell(sheet: Sheet, address: CellAddress, cell: Cell): Sheet {
    // Update a cell and recalculate affected cells
    const newSheet = { ...sheet };
    
    // 1. Update cell in sheet
    newSheet.cells = { ...sheet.cells };
    newSheet.cells[address] = cell;
    newSheet.updatedAt = new Date();
    
    // 2. Update dependency graph
    this.depGraph.removeDependencies(address);
    if (cell.kind === 'formula') {
      this.extractDependencies(cell.ast, address);
    }
    
    // 3. Find affected cells (dependents)
    const dependents = this.depGraph.getDependents(address);
    const toRecalculate = Array.from(dependents);
    
    // 4. Recalculate in dependency order
    if (toRecalculate.length > 0) {
      const evaluationOrder = this.depGraph.getEvaluationOrder(toRecalculate);
      for (const dependentAddress of evaluationOrder) {
        // Re-evaluate dependent cells
        this.evaluateCell(newSheet, dependentAddress);
      }
    }
    
    return newSheet;
  }

  // Extract dependencies from AST and add to dependency graph
  private extractDependencies(ast: FormulaAst, fromCell: CellAddress): void {
    switch (ast.type) {
      case 'ref':
        this.depGraph.addDependency(fromCell, ast.address);
        break;
      
      case 'range':
        // Add dependencies for all cells in range
        const { start, end } = ast;
        const startCol = start.charCodeAt(0) - 65;
        const startRow = parseInt(start.slice(1)) - 1;
        const endCol = end.charCodeAt(0) - 65;
        const endRow = parseInt(end.slice(1)) - 1;
        
        for (let col = startCol; col <= endCol; col++) {
          for (let row = startRow; row <= endRow; row++) {
            const cellAddr = `${String.fromCharCode(65 + col)}${row + 1}` as CellAddress;
            this.depGraph.addDependency(fromCell, cellAddr);
          }
        }
        break;
      
      case 'binary':
        this.extractDependencies(ast.left, fromCell);
        this.extractDependencies(ast.right, fromCell);
        break;
      
      case 'unary':
        this.extractDependencies(ast.operand, fromCell);
        break;
      
      case 'function':
        for (const arg of ast.args) {
          this.extractDependencies(arg, fromCell);
        }
        break;
      
      case 'number':
      case 'string':
        // No dependencies
        break;
    }
  }

  // Helper to create error cells
  private createError(code: ErrorCell['code'], message: string): ErrorCell {
    return {
      kind: 'error',
      code,
      message
    };
  }
}

// Singleton instance
export const engine = new FormulaEngine();