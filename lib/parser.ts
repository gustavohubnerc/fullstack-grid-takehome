import { FormulaAst, toCellAddress } from '@/types';

// Token types for lexer
export type TokenType = 
  | 'NUMBER'
  | 'STRING'
  | 'CELL_REF'
  | 'RANGE'
  | 'FUNCTION'
  | 'OPERATOR'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'COLON'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

// Tokenizer/Lexer
export class Lexer {
  private input: string;
  private pos: number = 0;

  constructor(input: string) {
    this.input = input;
  }

  nextToken(): Token {
    this.skipWhitespace();
    
    if (this.pos >= this.input.length) {
      return { type: 'EOF', value: '', pos: this.pos };
    }

    const char = this.input[this.pos];
    const startPos = this.pos;

    // Numbers (including decimals)
    if (this.isDigit(char) || (char === '.' && this.isDigit(this.peek(1)))) {
      return this.readNumber();
    }

    // Strings (quoted)
    if (char === '"') {
      return this.readString();
    }

    // Cell references and functions
    if (this.isLetter(char)) {
      return this.readIdentifier();
    }

    // Single character tokens
    switch (char) {
      case '(':
        this.pos++;
        return { type: 'LPAREN', value: '(', pos: startPos };
      case ')':
        this.pos++;
        return { type: 'RPAREN', value: ')', pos: startPos };
      case ',':
        this.pos++;
        return { type: 'COMMA', value: ',', pos: startPos };
      case ':':
        this.pos++;
        return { type: 'COLON', value: ':', pos: startPos };
      case '+':
      case '-':
      case '*':
      case '/':
      case '^':
        this.pos++;
        return { type: 'OPERATOR', value: char, pos: startPos };
      case '=':
        this.pos++;
        return { type: 'OPERATOR', value: '=', pos: startPos };
      case '<':
        if (this.peek(1) === '=') {
          this.pos += 2;
          return { type: 'OPERATOR', value: '<=', pos: startPos };
        } else if (this.peek(1) === '>') {
          this.pos += 2;
          return { type: 'OPERATOR', value: '<>', pos: startPos };
        } else {
          this.pos++;
          return { type: 'OPERATOR', value: '<', pos: startPos };
        }
      case '>':
        if (this.peek(1) === '=') {
          this.pos += 2;
          return { type: 'OPERATOR', value: '>=', pos: startPos };
        } else {
          this.pos++;
          return { type: 'OPERATOR', value: '>', pos: startPos };
        }
      default:
        throw new Error(`Unexpected character: ${char} at position ${this.pos}`);
    }
  }

  peek(offset: number = 1): string {
    const pos = this.pos + offset;
    return pos < this.input.length ? this.input[pos] : '';
  }

  private skipWhitespace(): void {
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
      this.pos++;
    }
  }

  private isDigit(char: string): boolean {
    return /\d/.test(char);
  }

  private isLetter(char: string): boolean {
    return /[a-zA-Z]/.test(char);
  }

  private isAlphaNumeric(char: string): boolean {
    return /[a-zA-Z0-9]/.test(char);
  }

  private readNumber(): Token {
    const start = this.pos;
    let hasDecimal = false;

    while (this.pos < this.input.length) {
      const char = this.input[this.pos];
      if (this.isDigit(char)) {
        this.pos++;
      } else if (char === '.' && !hasDecimal) {
        hasDecimal = true;
        this.pos++;
      } else {
        break;
      }
    }

    const value = this.input.slice(start, this.pos);
    return { type: 'NUMBER', value, pos: start };
  }

  private readString(): Token {
    const start = this.pos;
    this.pos++; // Skip opening quote

    while (this.pos < this.input.length && this.input[this.pos] !== '"') {
      if (this.input[this.pos] === '\\') {
        this.pos += 2; // Skip escaped character
      } else {
        this.pos++;
      }
    }

    if (this.pos >= this.input.length) {
      throw new Error('Unterminated string literal');
    }

    this.pos++; // Skip closing quote
    const value = this.input.slice(start + 1, this.pos - 1);
    return { type: 'STRING', value, pos: start };
  }

  private readIdentifier(): Token {
    const start = this.pos;

    // Read first character (letter)
    this.pos++;

    // Read remaining characters (letters, digits, $)
    while (this.pos < this.input.length) {
      const char = this.input[this.pos];
      if (this.isAlphaNumeric(char) || char === '$') {
        this.pos++;
      } else {
        break;
      }
    }

    const value = this.input.slice(start, this.pos);

    // Check if it's a cell reference (A1, $A$1, etc.)
    if (this.isCellReference(value)) {
      return { type: 'CELL_REF', value, pos: start };
    }

    // Otherwise it's a function name
    return { type: 'FUNCTION', value, pos: start };
  }

  private isCellReference(value: string): boolean {
    // Match patterns like A1, $A$1, AB123, etc.
    return /^\$?[A-Z]+\$?\d+$/.test(value);
  }
}

// Parser (Pratt parser or Shunting-yard recommended)
export class Parser {
  private lexer: Lexer;
  private current: Token;

  constructor(input: string) {
    this.lexer = new Lexer(input);
    this.current = this.lexer.nextToken();
  }

  parse(): FormulaAst {
    const result = this.parseExpression();
    if (this.current.type !== 'EOF') {
      throw new Error(`Unexpected token: ${this.current.value}`);
    }
    return result;
  }

  private parseExpression(minPrecedence: number = 0): FormulaAst {
    let left = this.parsePrimary();

    while (this.current.type === 'OPERATOR') {
      const op = this.current.value;
      const precedence = PRECEDENCE[op];
      
      if (!precedence || precedence < minPrecedence) {
        break;
      }

      this.advance();
      const right = this.parseExpression(precedence + 1);
      
      left = {
        type: 'binary',
        op: op as '+' | '-' | '*' | '/' | '^' | '=' | '<' | '>' | '<=' | '<>' | '>=',
        left,
        right
      };
    }

    return left;
  }

  private parsePrimary(): FormulaAst {
    switch (this.current.type) {
      case 'NUMBER':
        const numValue = parseFloat(this.current.value);
        this.advance();
        return { type: 'number', value: numValue };

      case 'STRING':
        const strValue = this.current.value;
        this.advance();
        return { type: 'string', value: strValue };

      case 'CELL_REF':
        const cellRef = this.current.value;
        this.advance();
        
        // Check if this is part of a range (A1:B2)
        if (this.current.type === ('COLON' as TokenType)) {
          this.advance();
          if (this.current.type !== 'CELL_REF') {
            throw new Error('Expected cell reference after colon');
          }
          const endRef = this.current.value;
          this.advance();
          return {
            type: 'range',
            start: toCellAddress(cellRef),
            end: toCellAddress(endRef)
          };
        }
        
        return { 
          type: 'ref', 
          address: toCellAddress(cellRef),
          absolute: { col: cellRef.includes('$'), row: cellRef.includes('$') }
        };

      case 'FUNCTION':
        const funcName = this.current.value;
        this.advance();
        return this.parseFunction(funcName);

      case 'LPAREN':
        this.advance();
        const expr = this.parseExpression();
        this.expect('RPAREN');
        return expr;

      case 'OPERATOR':
        // Handle unary operators
        if (this.current.value === '-' || this.current.value === '+') {
          const op = this.current.value;
          this.advance();
          const operand = this.parsePrimary();
          return {
            type: 'unary',
            op: op as '+' | '-',
            operand
          };
        }
        throw new Error(`Unexpected operator: ${this.current.value}`);

      default:
        throw new Error(`Unexpected token: ${this.current.value}`);
    }
  }

  private parseFunction(name: string): FormulaAst {
    this.expect('LPAREN');
    
    const args: FormulaAst[] = [];
    
    if (this.current.type !== 'RPAREN') {
      args.push(this.parseExpression());
      
      while (this.current.type === 'COMMA') {
        this.advance();
        args.push(this.parseExpression());
      }
    }
    
    this.expect('RPAREN');
    
    return {
      type: 'function',
      name,
      args
    };
  }

  private advance(): void {
    this.current = this.lexer.nextToken();
  }

  private expect(type: TokenType): void {
    if (this.current.type !== type) {
      throw new Error(`Expected ${type} but got ${this.current.type}`);
    }
    this.advance();
  }
}

// Operator precedence table
export const PRECEDENCE: Record<string, number> = {
  '=': 1,
  '<>': 1,
  '<': 2,
  '<=': 2,
  '>': 2,
  '>=': 2,
  '+': 3,
  '-': 3,
  '*': 4,
  '/': 4,
  '^': 5,
};

// Helper to parse a formula string
export function parseFormula(input: string): FormulaAst {
  // Remove leading = if present
  const formula = input.startsWith('=') ? input.slice(1) : input;
  const parser = new Parser(formula);
  return parser.parse();
}