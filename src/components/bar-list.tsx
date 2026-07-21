export function BarList({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No data for this selection.</p>;
  }

  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3 text-sm">
          <div className="w-40 shrink-0 truncate text-muted-foreground" title={d.label}>
            {d.label}
          </div>
          <div className="h-4 flex-1 overflow-hidden rounded bg-surface-muted">
            <div className="h-full rounded bg-primary" style={{ width: `${Math.max(4, (d.count / max) * 100)}%` }} />
          </div>
          <div className="w-8 shrink-0 text-right font-medium tabular-nums">{d.count}</div>
        </div>
      ))}
    </div>
  );
}
