'use client';

import { useEffect, useRef, useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface Dependency {
  library: string;
  status: string;
  risk: string;
}

interface CodeGuardProps {
  code: string;
  language: string;
  dependencies?: Dependency[];
  onVoidDetected?: (dependencies: Dependency[]) => void;
}

export default function CodeGuard({ code, language, dependencies = [], onVoidDetected }: CodeGuardProps) {
  // Debug logging
  useEffect(() => {
    console.log('CodeGuard received:', { 
      codeLength: code.length, 
      dependenciesCount: dependencies?.length || 0,
      dependencies: dependencies 
    });
  }, [code, dependencies]);

  // Track which packages have already been alerted to prevent duplicate logs
  const alertedPackages = useRef<Set<string>>(new Set());

  // Effect: Logging logic (only fires once per package)
  useEffect(() => {
    if (!onVoidDetected || !dependencies || dependencies.length === 0) return;

    // Find VOID dependencies that haven't been alerted yet
    const newVoidDeps = dependencies.filter((dep) => {
      if (dep.risk !== 'CRITICAL') return false;
      
      const packageKey = dep.library.toLowerCase();
      if (!alertedPackages.current.has(packageKey)) {
        alertedPackages.current.add(packageKey);
        return true;
      }
      return false;
    });

    // Only call callback for newly detected VOID packages
    if (newVoidDeps.length > 0) {
      onVoidDetected(newVoidDeps);
    }
  }, [dependencies, onVoidDetected]);

  // Memoize library status map to prevent recreation on every render
  const libraryStatusMap = useMemo(() => {
    const map = new Map<string, Dependency>();
    if (dependencies && dependencies.length > 0) {
      dependencies.forEach((dep) => {
        map.set(dep.library.toLowerCase(), dep);
      });
    }
    return map;
  }, [dependencies]);

  // Memoize code lines to prevent recreation on every render
  const codeLines = useMemo(() => {
    return code.split('\n');
  }, [code]);

  // Fuzzy matching: Check if a line contains a library name
  const getLineStatus = (line: string) => {
    const trimmedLine = line.trim();
    if (!trimmedLine.startsWith('import ') && !trimmedLine.startsWith('from ')) {
      return null;
    }

    // Extract library name from import statement
    let libraryName = '';
    if (trimmedLine.startsWith('import ')) {
      libraryName = trimmedLine.replace('import ', '').split(' ')[0].split('.')[0];
    } else if (trimmedLine.startsWith('from ')) {
      libraryName = trimmedLine.replace('from ', '').split(' ')[0].split('.')[0];
    }

    if (!libraryName) return null;
    
    // Fuzzy match: check if any dependency library name is included in the line or vice versa
    const libLower = libraryName.toLowerCase();
    
    // First try exact match
    let dep = libraryStatusMap.get(libLower);
    if (dep) return dep;
    
    // Then try fuzzy match - check if library name appears in any dependency
    for (const [depLib, dep] of libraryStatusMap.entries()) {
      if (trimmedLine.toLowerCase().includes(depLib) || depLib.includes(libLower)) {
        return dep;
      }
    }
    
    return null;
  };

  // Check if a line contains redacted PII content
  const isLineRedacted = (line: string): boolean => {
    return line.includes('[REDACTED_');
  };

  // Memoize badge items to prevent re-rendering
  const badgeItems = useMemo(() => {
    return codeLines.map((line, index) => {
      const dep = getLineStatus(line);
      const isRedacted = isLineRedacted(line);
      
      // If line has redacted content, always include it
      if (isRedacted) {
        return {
          index,
          line,
          isVoid: false,
          isVerified: false,
          isRedacted: true,
          dep: null,
        };
      }
      
      // Otherwise, only include if it has a dependency status
      if (!dep) return null;

      const isVoid = dep.risk === 'CRITICAL';
      const isVerified = dep.status === 'VERIFIED';

      return {
        index,
        line,
        isVoid,
        isVerified,
        isRedacted: false,
        dep,
      };
    }).filter(Boolean) as Array<{
      index: number;
      line: string;
      isVoid: boolean;
      isVerified: boolean;
      isRedacted: boolean;
      dep: Dependency | null;
    }>;
  }, [codeLines, libraryStatusMap]);

  // Only show badges if we have dependencies provided (not auto-scanning)
  const hasDependencies = dependencies && dependencies.length > 0;

  return (
    <div className="my-4 border border-nullpoint-border rounded-lg overflow-hidden bg-nullpoint-bg-secondary">
      <div className="px-4 py-2 bg-nullpoint-bg-tertiary border-b border-nullpoint-border flex items-center justify-between">
        <span className="font-mono text-xs text-nullpoint-text-muted uppercase">
          {language || 'code'}
        </span>
      </div>
      <div className="p-4 overflow-x-auto relative">
        {/* Render code with syntax highlighting */}
        <SyntaxHighlighter
          language={language || 'python'}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: 0,
            background: 'transparent',
          }}
          codeTagProps={{
            style: {
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            },
          }}
        >
          {code}
        </SyntaxHighlighter>
        
        {/* Render badges for import lines and redacted content */}
        {badgeItems.length > 0 && (
          <div className="mt-3 pt-3 border-t border-nullpoint-border space-y-1">
            {badgeItems.map((item) => (
              <div
                key={item.index}
                className={`flex items-center gap-2 font-mono text-xs ${
                  item.isRedacted || item.isVoid 
                    ? 'text-nullpoint-alert' 
                    : item.isVerified 
                    ? 'text-nullpoint-primary' 
                    : 'text-nullpoint-text-dim'
                }`}
              >
                <span className="text-nullpoint-text-dim flex-1">{item.line}</span>
                {/* Render PII REMOVED badge if line contains redacted content */}
                {item.isRedacted && (
                  <span className="px-2 py-0.5 bg-red-900/30 text-red-500 border border-red-500/50 rounded text-xs font-bold whitespace-nowrap animate-pulse">
                    🚫 PII REMOVED
                  </span>
                )}
                {/* Render VERIFIED badge if status is VERIFIED (only if not redacted) */}
                {!item.isRedacted && item.isVerified && (
                  <span className="px-2 py-0.5 bg-nullpoint-primary/20 text-nullpoint-primary border border-nullpoint-primary/50 rounded text-xs font-bold whitespace-nowrap">
                    ✓ VERIFIED
                  </span>
                )}
                {/* Render VOID badge if risk is CRITICAL (only if not redacted) */}
                {!item.isRedacted && item.isVoid && (
                  <span className="px-2 py-0.5 bg-nullpoint-alert/20 text-nullpoint-alert border border-nullpoint-alert/50 rounded text-xs font-bold whitespace-nowrap">
                    ⚠ VOID
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
