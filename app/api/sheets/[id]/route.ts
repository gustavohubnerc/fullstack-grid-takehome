import { NextRequest, NextResponse } from 'next/server';
import { sheetStore } from '@/lib/state';
import { SheetPatchSchema, validateRequest } from '@/lib/validation';
import { toCellAddress } from '@/types';
import { parseFormula } from '@/lib/parser';

// GET /api/sheets/[id] - Get sheet snapshot
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sheet = sheetStore.get(id);
    
    if (!sheet) {
      return NextResponse.json(
        { error: 'Sheet not found' },
        { status: 404 }
      );
    }

    // TODO: Evaluate all formulas and include computed values
    // For now, just return the sheet as-is
    return NextResponse.json(sheet);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch sheet' },
      { status: 500 }
    );
  }
}

// PATCH /api/sheets/[id] - Apply cell edits
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sheet = sheetStore.get(id);
    
    if (!sheet) {
      return NextResponse.json(
        { error: 'Sheet not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = validateRequest(SheetPatchSchema, body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { edits } = validation.data;
    
    // Apply each edit to the sheet
    for (const edit of edits) {
      const addr = toCellAddress(edit.addr);
      
      if (edit.kind === 'clear') {
        delete sheet.cells[addr];
      } else if (edit.kind === 'literal') {
        sheet.cells[addr] = {
          kind: 'literal',
          value: edit.value!
        };
      } else if (edit.kind === 'formula') {
        // TODO: Parse formula and create AST
        try {
          const ast = parseFormula(edit.formula!);
          sheet.cells[addr] = {
            kind: 'formula',
            src: edit.formula!,
            ast
          };
        } catch (error) {
          // If parsing fails, store as error cell
          sheet.cells[addr] = {
            kind: 'error',
            code: 'PARSE',
            message: `Invalid formula: ${edit.formula}`
          };
        }
      }
    }

    sheet.updatedAt = new Date();
    sheetStore.update(id, sheet);

    // TODO: Recalculate affected cells
    
    return NextResponse.json(sheet);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update sheet' },
      { status: 500 }
    );
  }
}