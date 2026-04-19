interface CrowdBarProps {
  density: number;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export function CrowdBar({ density, showLabel = true, size = 'md' }: CrowdBarProps) {
  const level = density >= 80 ? 'high' : density >= 50 ? 'medium' : '';
  const color = density >= 80 ? 'var(--danger)' : density >= 50 ? 'var(--warning)' : 'var(--cyan)';

  return (
    <div>
      {showLabel && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Live Crowd Density</span>
          <span style={{ fontSize: 13, fontWeight: 700, color }}>{density}%</span>
        </div>
      )}
      <div className="crowd-bar-track" style={{ height: size === 'sm' ? 3 : 4 }}>
        <div
          className={`crowd-bar-fill ${level}`}
          style={{ width: `${density}%` }}
        />
      </div>
    </div>
  );
}
