import { NextRequest, NextResponse } from 'next/server';
import { sheetStore } from '@/lib/state';
import { Sheet } from '@/types';
import { SheetCreateSchema, validateRequest } from '@/lib/validation';

// GET /api/sheets - List all sheets
export async function GET() {
  try {
    const sheets = sheetStore.getAll();
    return NextResponse.json(sheets);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch sheets' },
      { status: 500 }
    );
  }
}

// POST /api/sheets - Create a new sheet
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = validateRequest(SheetCreateSchema, body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { name, rows, cols } = validation.data;
    
    // Create new sheet
    const sheet: Sheet = {
      id: `sheet-${Date.now()}`,
      name,
      rows,
      cols,
      cells: {},
      updatedAt: new Date()
    };

    sheetStore.create(sheet);
    
    return NextResponse.json(sheet, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create sheet' },
      { status: 500 }
    );
  }
}