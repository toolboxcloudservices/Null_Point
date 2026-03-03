'use client';

import { useState } from 'react';
import StatusHeader from '@/components/StatusHeader';
import TerminalLog from '@/components/TerminalLog';
import ChatWindow from '@/components/ChatWindow';

interface Dependency {
  library: string;
  status: string;
  risk: string;
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant' | 'system';
  timestamp: string;
  blocked?: boolean;
  codeBlocks?: Array<{
    code: string;
    language: string;
    dependencies?: Dependency[];
  }>;
}

interface ThreatLog {
  id: string;
  timestamp: string;
  type: string;
  pattern?: string;
  severity?: string;
  message: string;
}

type SystemStatus = 'SAFE' | 'WARNING' | 'CRITICAL';

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [threatLogs, setThreatLogs] = useState<ThreatLog[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>('SAFE');

  const formatTimestamp = () => {
    return new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const determineSystemStatus = (riskScore: number): SystemStatus => {
    if (riskScore >= 50) return 'CRITICAL';
    if (riskScore > 0) return 'WARNING';
    return 'SAFE';
  };

  const handleSendMessage = async (text: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: formatTimestamp(),
    };

    setMessages((prev) => [...prev, userMessage]);

    try {
      // Step 1: Scan user input for injection attacks
      const scanResponse = await fetch('http://localhost:8000/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!scanResponse.ok) {
        throw new Error(`HTTP error! status: ${scanResponse.status}`);
      }

      const scanResult = await scanResponse.json();

      // Step 2: Check the response and handle accordingly
      const status = determineSystemStatus(scanResult.risk_score || 0);
      setSystemStatus(status);

      // If risk is HIGH (risk_score >= 50), block the message
      if (scanResult.risk_score >= 50) {
        // Add threat logs
        const newThreatLogs: ThreatLog[] = (scanResult.flags || []).map(
          (flag: string, index: number) => ({
            id: `${Date.now()}-${index}`,
            timestamp: formatTimestamp(),
            type: 'jailbreak_pattern',
            pattern: flag,
            severity: 'HIGH',
            message: `Threat detected: ${flag}`,
          })
        );

        setThreatLogs((prev) => [...prev, ...newThreatLogs]);

        // Add blocked message to chat
        const blockedMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: 'This message was blocked by NullPoint security system. Potential injection attack detected.',
          sender: 'system',
          timestamp: formatTimestamp(),
          blocked: true,
        };

        setMessages((prev) => [...prev, blockedMessage]);
        return;
      }

      // Step 3: If risk is LOW, send to OpenAI via /chat endpoint
      if (scanResult.risk_score < 50) {
        // Step 3a: Add AI placeholder message with loading state
        const aiMsgId = (Date.now() + 1).toString();
        const placeholderMessage: Message = {
          id: aiMsgId,
          text: '',
          sender: 'assistant',
          timestamp: formatTimestamp(),
        };
        setMessages((prev) => [...prev, placeholderMessage]);

        // Step 3b: Fetch from Backend
        const chatResponse = await fetch('http://localhost:8000/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_message: text }),
        });

        if (!chatResponse.ok) {
          throw new Error(`HTTP error! status: ${chatResponse.status}`);
        }

        const chatResult = await chatResponse.json();
        const aiReply = chatResult.reply;
        const scanResults = chatResult.scan_results || [];
        
        // Check if request was blocked due to PII in input
        if (aiReply === "BLOCKED: PII Detected in Prompt" && scanResults.length > 0) {
          const blockedThreat = scanResults[0];
          const blockedLog: ThreatLog = {
            id: `${Date.now()}-blocked`,
            timestamp: formatTimestamp(),
            type: 'OUTBOUND_PII',
            severity: blockedThreat.severity || 'CRITICAL',
            message: blockedThreat.details || 'PII detected in user input',
          };
          setThreatLogs((prev) => [...prev, blockedLog]);
          
          // Update message with blocked response
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMsgId
                ? {
                    ...msg,
                    text: aiReply,
                  }
                : msg
            )
          );
          return;
        }

        // Step 4: Extract code blocks from AI response
        const codeBlocks = extractCodeBlocks(aiReply);
        
        // Helper function to extract library names from a code block
        const extractLibrariesFromCode = (code: string): string[] => {
          const libraries: string[] = [];
          const lines = code.split('\n');
          
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('import ')) {
              // Extract library name from "import library" or "import library as alias"
              const lib = trimmed.replace('import ', '').split(' ')[0].split('.')[0];
              if (lib) libraries.push(lib.toLowerCase());
            } else if (trimmed.startsWith('from ')) {
              // Extract library name from "from library import ..."
              const lib = trimmed.replace('from ', '').split(' ')[0].split('.')[0];
              if (lib) libraries.push(lib.toLowerCase());
            }
          }
          
          return libraries;
        };
        
        // Step 5: Map scan_results to codeBlocks
        const codeBlocksWithDeps = codeBlocks.map((block) => {
          // Extract library names from this specific code block
          const blockLibraries = extractLibrariesFromCode(block.code);
          
          // Find matching dependencies from scan_results using fuzzy matching
          const blockDeps = scanResults.filter((dep: Dependency) => {
            const depLibLower = dep.library.toLowerCase();
            // Check if library name appears in code block (fuzzy match)
            return blockLibraries.includes(depLibLower) || 
                   block.code.toLowerCase().includes(depLibLower);
          });

          return {
            ...block,
            dependencies: blockDeps.length > 0 ? blockDeps : [],
          };
        });

        // Process scan results - check for PII leaks and hallucinated packages
        if (scanResults.length > 0) {
          // Check for PII leaks
          const piiThreats = scanResults.filter((result: any) => 
            result.type === 'PII_LEAK' || result.library === 'PII_LEAK' || result.library === 'OUTBOUND_PII'
          );
          
          if (piiThreats.length > 0) {
            const piiLogs: ThreatLog[] = piiThreats.map((threat: any, index: number) => ({
              id: `${Date.now()}-pii-${index}`,
              timestamp: formatTimestamp(),
              type: threat.library === 'OUTBOUND_PII' ? 'OUTBOUND_PII' : 'PII_LEAK',
              severity: threat.severity || 'CRITICAL',
              message: threat.details || `PII detected: ${threat.type || 'Unknown'}`,
            }));
            
            setThreatLogs((prev) => [...prev, ...piiLogs]);
          }
          
          // Process VOID dependencies (hallucinated packages)
          processVoidDependencies(scanResults);
        }

        // Step 6: Update the specific message by ID with scan results
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMsgId
              ? {
                  ...msg,
                  text: aiReply,
                  codeBlocks: codeBlocksWithDeps.length > 0 ? codeBlocksWithDeps : undefined,
                }
              : msg
          )
        );
      }
    } catch (error) {
      console.error('Error processing message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        sender: 'system',
        timestamp: formatTimestamp(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  // Extract code blocks from text
  const extractCodeBlocks = (text: string) => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const blocks: Array<{ code: string; language: string }> = [];
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      blocks.push({
        language: match[1] || 'text',
        code: match[2].trim(),
      });
    }

    return blocks;
  };

  // Process VOID dependencies and add threat logs
  const processVoidDependencies = (dependencies: Dependency[]) => {
    const voidDeps = dependencies.filter((dep) => dep.risk === 'CRITICAL');
    
    if (voidDeps.length > 0) {
      // Add threat logs for each VOID dependency
      const newThreatLogs: ThreatLog[] = voidDeps.map((dep, index) => ({
        id: `${Date.now()}-void-${index}`,
        timestamp: formatTimestamp(),
        type: 'Hallucination',
        severity: 'MEDIUM',
        message: `Hallucinated package detected: ${dep.library}`,
      }));

      setThreatLogs((prev) => {
        // Double safety: Check if the new log message is identical to the most recent log
        const lastLog = prev[prev.length - 1];
        const filteredLogs = newThreatLogs.filter((newLog) => {
          // If there's a last log and it has the same message, skip this one
          if (lastLog && lastLog.message === newLog.message) {
            return false;
          }
          return true;
        });
        
        // Only add logs that aren't duplicates of the last entry
        return [...prev, ...filteredLogs];
      });
      
      // Update system status to WARNING if not already CRITICAL
      setSystemStatus((prevStatus) => {
        if (prevStatus !== 'CRITICAL') {
          return 'WARNING';
        }
        return prevStatus;
      });
    }
  };

  // Scan code blocks for dependencies
  const scanCodeBlocks = async (codeBlocks: Array<{ code: string; language: string }>) => {
    const scannedBlocks = await Promise.all(
      codeBlocks.map(async (block) => {
        if (block.language === 'python' || block.language === 'javascript') {
          try {
            const response = await fetch('http://localhost:8000/scan-code', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ text: block.code }),
            });

            if (response.ok) {
              const result = await response.json();
              const dependencies = result.dependencies || [];
              
              // Process VOID dependencies
              processVoidDependencies(dependencies);
              
              return {
                ...block,
                dependencies,
              };
            }
          } catch (error) {
            console.error('Error scanning code block:', error);
          }
        }
        return block;
      })
    );

    return scannedBlocks;
  };


  return (
    <div className="h-screen flex flex-col bg-nullpoint-bg text-nullpoint-text">
      <StatusHeader status={systemStatus} />
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1">
          <ChatWindow 
            onSendMessage={handleSendMessage} 
            messages={messages}
            onVoidDetected={processVoidDependencies}
          />
        </div>
        <div className="w-96">
          <TerminalLog logs={threatLogs} />
        </div>
      </div>
    </div>
  );
}
