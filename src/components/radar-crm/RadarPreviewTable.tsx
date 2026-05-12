import React from 'react';

interface Props {
  headers: string[];
  rows: Array<Record<string, unknown>>;
  limit?: number;
}

const RadarPreviewTable: React.FC<Props> = ({ headers, rows, limit = 5 }) => {
  const preview = rows.slice(0, limit);
  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead className="bg-muted/50">
          <tr>
            {headers.map((h) => (
              <th key={h} className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.map((r, i) => (
            <tr key={i} className="border-t">
              {headers.map((h) => (
                <td key={h} className="px-3 py-2 whitespace-nowrap text-foreground">
                  {String(r[h] ?? '').slice(0, 80)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RadarPreviewTable;
