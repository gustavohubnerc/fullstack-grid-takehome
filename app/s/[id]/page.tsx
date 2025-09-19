'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Sheet, CellAddress } from '@/types';
import Grid from '@/components/Grid';

export default function SheetPage() {
  const params = useParams();
  const sheetId = params.id as string;
  
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSheet = useCallback(async () => {
    try {
      const response = await fetch(`/api/sheets/${sheetId}`);
      if (response.ok) {
        const data = await response.json();
        setSheet(data);
      }
    } catch (error) {
      console.error('Failed to fetch sheet:', error);
    } finally {
      setLoading(false);
    }
  }, [sheetId]);

  useEffect(() => {
    fetchSheet();
  }, [fetchSheet]);

  const handleUpdateCell = async (address: CellAddress, value: string) => {
    if (!sheet) return;

    try {
      // Handle empty values as clear operations
      const edit = value.trim() === '' ? {
        addr: address,
        kind: 'clear' as const
      } : {
        addr: address,
        kind: value.startsWith('=') ? 'formula' as const : 'literal' as const,
        value: value.startsWith('=') ? undefined : value,
        formula: value.startsWith('=') ? value : undefined
      };

      const response = await fetch(`/api/sheets/${sheetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          edits: [edit]
        })
      });

      if (response.ok) {
        const updatedSheet = await response.json();
        setSheet(updatedSheet);
      } else {
        const errorData = await response.json();
        console.error('Failed to update cell:', errorData);
      }
    } catch (error) {
      console.error('Failed to update cell:', error);
    }
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-text">Loading sheet...</div>
      </div>
    );
  }
  
  if (!sheet) {
    return (
      <div className="loading-state">
        <div className="loading-text">Sheet not found</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Toolbar */}
      <div className="toolbar">
        <h1 className="toolbar-title">{sheet.name}</h1>
        <div className="toolbar-actions">
          <button className="toolbar-button">
            Sort
          </button>
          <button className="toolbar-button">
            Export CSV
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-hidden">
        <Grid sheet={sheet} onUpdateCell={handleUpdateCell} />
      </div>
    </div>
  );
}