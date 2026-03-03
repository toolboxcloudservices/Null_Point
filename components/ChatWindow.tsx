'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import CodeGuard from './CodeGuard';

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

interface ChatWindowProps {
  onSendMessage: (text: string) => Promise<void>;
  messages: Message[];
  onVoidDetected?: (dependencies: Dependency[]) => void;
}

export default function ChatWindow({ onSendMessage, messages, onVoidDetected }: ChatWindowProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const text = input.trim();
    setInput('');
    setIsLoading(true);

    try {
      await onSendMessage(text);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Extract code blocks from markdown
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

  // Render message with markdown and code blocks
  const renderMessage = (message: Message) => {
    const codeBlocks = extractCodeBlocks(message.text);
    
    // If message has pre-scanned code blocks with dependencies, use them
    if (message.codeBlocks && message.codeBlocks.length > 0) {
      let processedText = message.text;
      let blockIndex = 0;

      return (
        <div>
          <ReactMarkdown
            components={{
              code({ node, inline, className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || '');
                const language = match ? match[1] : '';
                const codeString = String(children).replace(/\n$/, '');

                if (!inline && language) {
                  // Check if this code block has dependencies
                  // Normalize both codes for comparison (trim whitespace)
                  const normalizedCodeString = codeString.trim();
                  const codeBlock = message.codeBlocks?.find(
                    (cb) => {
                      const normalizedBlockCode = cb.code.trim();
                      const matches = normalizedBlockCode === normalizedCodeString && cb.language === language;
                      if (matches) {
                        console.log('ChatWindow: Matched code block with dependencies:', {
                          language,
                          dependenciesCount: cb.dependencies?.length || 0,
                          dependencies: cb.dependencies
                        });
                      }
                      return matches;
                    }
                  );

                  const deps = codeBlock?.dependencies || [];
                  console.log('ChatWindow: Passing to CodeGuard:', {
                    hasCodeBlock: !!codeBlock,
                    dependenciesCount: deps.length,
                    dependencies: deps
                  });

                  return (
                    <CodeGuard
                      code={codeString}
                      language={language}
                      dependencies={deps}
                      onVoidDetected={onVoidDetected}
                    />
                  );
                }

                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {message.text}
          </ReactMarkdown>
        </div>
      );
    }

    // Regular markdown rendering
    return (
      <ReactMarkdown
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const codeString = String(children).replace(/\n$/, '');

            if (!inline && language) {
              return <CodeGuard code={codeString} language={language} onVoidDetected={onVoidDetected} />;
            }

            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {message.text}
      </ReactMarkdown>
    );
  };

  return (
    <div className="h-full flex flex-col bg-nullpoint-bg">
      {/* Header */}
      <div className="border-b border-nullpoint-border px-4 py-2 bg-nullpoint-bg-tertiary">
        <h2 className="font-mono text-sm uppercase text-nullpoint-primary tracking-wider">
          Chat Interface
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-nullpoint-text-muted mt-12">
            <div className="font-mono text-sm">
              &gt; NullPoint AI Ready
            </div>
            <div className="font-mono text-xs mt-2 text-nullpoint-text-dim">
              Type a message to begin scanning...
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[80%] rounded px-4 py-2 font-mono text-sm ${
                  message.sender === 'user'
                    ? 'bg-nullpoint-primary/20 text-nullpoint-primary border border-nullpoint-primary/30'
                    : message.sender === 'system'
                    ? 'bg-nullpoint-alert/20 text-nullpoint-alert border border-nullpoint-alert/30'
                    : 'bg-nullpoint-bg-secondary text-nullpoint-text border border-nullpoint-border'
                }`}
              >
                {message.blocked && (
                  <div className="text-nullpoint-alert font-bold mb-2">
                    🚫 BLOCKED BY NULLPOINT
                  </div>
                )}
                <div className="prose prose-invert max-w-none">
                  {renderMessage(message)}
                </div>
                <div className="text-[10px] text-nullpoint-text-dim mt-1">
                  {message.timestamp}
                </div>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-nullpoint-bg-secondary border border-nullpoint-border rounded px-4 py-2 font-mono text-sm text-nullpoint-text-muted">
              Scanning response...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="border-t border-nullpoint-border p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 bg-nullpoint-bg-secondary border border-nullpoint-border rounded px-4 py-2 font-mono text-sm text-nullpoint-text focus:outline-none focus:border-nullpoint-primary focus:ring-1 focus:ring-nullpoint-primary"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-2 bg-nullpoint-primary text-nullpoint-bg font-mono text-sm font-bold uppercase tracking-wider rounded hover:bg-nullpoint-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            SEND
          </button>
        </div>
      </form>
    </div>
  );
}
