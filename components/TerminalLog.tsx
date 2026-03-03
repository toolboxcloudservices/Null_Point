'use client';

interface ThreatLog {
  id: string;
  timestamp: string;
  type: string;
  pattern?: string;
  severity?: string;
  message: string;
}

interface TerminalLogProps {
  logs: ThreatLog[];
}

export default function TerminalLog({ logs }: TerminalLogProps) {
  // Determine threat label and color based on threat type
  const getThreatLabel = (log: ThreatLog) => {
    const type = log.type?.toUpperCase() || '';
    const message = log.message?.toUpperCase() || '';
    
    // Check for PII-related threats
    if (type.includes('PII') || message.includes('PII') || message.includes('DATA LEAK')) {
      return {
        label: 'DATA LEAK DETECTED',
        color: 'text-yellow-500', // Amber color
        borderColor: 'border-yellow-500',
        bgColor: 'bg-yellow-500/5'
      };
    }
    
    // Check for OUTBOUND threats
    if (type.includes('OUTBOUND') || message.includes('OUTBOUND') || message.includes('BLOCKED')) {
      return {
        label: 'OUTBOUND DATA BLOCK',
        color: 'text-nullpoint-alert', // Red color
        borderColor: 'border-nullpoint-alert',
        bgColor: 'bg-nullpoint-alert/5'
      };
    }
    
    // Check for hallucinated packages
    if (type.includes('HALLUCINATION') || message.includes('HALLUCINATED') || message.includes('VOID')) {
      return {
        label: 'Suspicious Dependency Detected',
        color: 'text-nullpoint-alert', // Red color
        borderColor: 'border-nullpoint-alert',
        bgColor: 'bg-nullpoint-alert/5'
      };
    }
    
    // Default for other threats
    return {
      label: log.message || 'Threat Detected',
      color: 'text-nullpoint-alert',
      borderColor: 'border-nullpoint-alert',
      bgColor: 'bg-nullpoint-alert/5'
    };
  };

  return (
    <div className="h-full bg-nullpoint-bg-secondary border-l border-nullpoint-border flex flex-col">
      <div className="px-4 py-3 border-b border-nullpoint-border bg-nullpoint-bg-tertiary">
        <h2 className="font-mono text-sm uppercase text-nullpoint-primary tracking-wider">
          THREAT LOG
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs">
        {logs.length === 0 ? (
          <div className="text-nullpoint-text-dim italic">
            &gt; No threats detected. System secure.
          </div>
        ) : (
          logs.map((log) => {
            const threatStyle = getThreatLabel(log);
            return (
              <div
                key={log.id}
                className={`border-l-2 ${threatStyle.borderColor} pl-3 py-1 ${threatStyle.bgColor}`}
              >
                <div className="flex items-start gap-2">
                  <span className={threatStyle.color}>[!]</span>
                  <div className="flex-1">
                    <div className="text-nullpoint-text-muted text-[10px]">
                      {log.timestamp}
                    </div>
                    <div className={`${threatStyle.color} mt-1 font-bold`}>
                      {threatStyle.label}
                    </div>
                    {log.message && log.message !== threatStyle.label && (
                      <div className="text-nullpoint-text-muted mt-1 text-[10px]">
                        {log.message}
                      </div>
                    )}
                    {log.pattern && (
                      <div className="text-nullpoint-text-dim mt-1">
                        Pattern: <code className="text-nullpoint-text-muted">{log.pattern}</code>
                      </div>
                    )}
                    {log.severity && (
                      <div className="text-nullpoint-text-dim mt-1">
                        Severity: <span className={threatStyle.color}>{log.severity}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
