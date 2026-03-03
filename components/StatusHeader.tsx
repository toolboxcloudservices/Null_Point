'use client';

interface StatusHeaderProps {
  status: 'SAFE' | 'WARNING' | 'CRITICAL';
}

export default function StatusHeader({ status }: StatusHeaderProps) {
  const statusColors = {
    SAFE: 'text-nullpoint-primary',
    WARNING: 'text-warning',
    CRITICAL: 'text-nullpoint-alert',
  };

  const statusBgColors = {
    SAFE: 'bg-nullpoint-primary/10 border-nullpoint-primary/30',
    WARNING: 'bg-warning/10 border-warning/30',
    CRITICAL: 'bg-nullpoint-alert/10 border-nullpoint-alert/30',
  };

  const pulseColors = {
    SAFE: 'bg-nullpoint-primary',
    WARNING: 'bg-warning',
    CRITICAL: 'bg-nullpoint-alert',
  };

  return (
    <div className={`w-full border-b ${statusBgColors[status]} border-2`}>
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${pulseColors[status]} animate-pulse`} />
            <span className="font-mono text-sm uppercase tracking-wider">
              SYSTEM STATUS:
            </span>
            <span className={`font-mono text-lg font-bold uppercase ${statusColors[status]}`}>
              {status}
            </span>
          </div>
        </div>
        <div className="font-mono text-xs text-nullpoint-text-muted">
          NULLPOINT AI v1.0.0
        </div>
      </div>
    </div>
  );
}
