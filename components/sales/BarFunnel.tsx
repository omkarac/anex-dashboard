interface BarItem {
  label: string;
  value: number;
  color?: 'navy' | 'gold' | 'teal' | 'red' | 'green';
}

const COLOR_CLASS: Record<string, string> = {
  navy:  'bar-fill-navy',
  gold:  'bar-fill-gold',
  teal:  'bar-fill-teal',
  red:   'bar-fill-red',
  green: 'bar-fill-green',
};

interface Props {
  items: BarItem[];
  showValues?: boolean;
  className?: string;
}

export function BarFunnel({ items, showValues = true, className }: Props) {
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} className={className}>
      {items.map(item => {
        const pct = Math.round((item.value / max) * 100);
        const fillClass = COLOR_CLASS[item.color ?? 'navy'];
        return (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 120, fontSize: 11, fontWeight: 600, color: 'var(--sales-txt2)', flexShrink: 0, textAlign: 'right' }}>
              {item.label}
            </div>
            <div className="bar-track">
              <div
                className={`funnel-bar ${fillClass}`}
                style={{ width: `${pct}%` }}
              >
                {showValues && pct > 20 && (
                  <span style={{ fontSize: 10, fontWeight: 700 }}>{item.value}</span>
                )}
              </div>
            </div>
            {showValues && (
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--sales-txt)', minWidth: 32, fontVariantNumeric: 'tabular-nums' }}>
                {item.value}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
