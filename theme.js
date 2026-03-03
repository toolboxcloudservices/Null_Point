/**
 * NullPoint Theme Configuration
 * Tactical Terminal Aesthetic
 * High contrast, Monospace fonts, Professional Cybersecurity Tool
 */

module.exports = {
  colors: {
    // Primary Colors
    background: '#050505',
    primary: '#00FF41',      // Matrix Green
    alert: '#FF3333',        // Alert Red
    
    // Extended Palette
    'nullpoint': {
      bg: '#050505',
      'bg-secondary': '#0A0A0A',
      'bg-tertiary': '#0F0F0F',
      primary: '#00FF41',
      'primary-dark': '#00CC33',
      'primary-light': '#33FF66',
      alert: '#FF3333',
      'alert-dark': '#CC0000',
      'alert-light': '#FF6666',
      text: '#FFFFFF',
      'text-muted': '#888888',
      'text-dim': '#555555',
      border: '#1A1A1A',
      'border-bright': '#00FF41',
    },
    
    // Semantic Colors
    secure: '#00FF41',
    insecure: '#FF3333',
    warning: '#FFAA00',
    info: '#00AAFF',
  },
  
  fontFamily: {
    mono: [
      'ui-monospace',
      'SFMono-Regular',
      'Menlo',
      'Monaco',
      'Consolas',
      'Liberation Mono',
      'Courier New',
      'monospace',
    ],
    'terminal': [
      'ui-monospace',
      'SFMono-Regular',
      'Menlo',
      'Monaco',
      'Consolas',
      'Liberation Mono',
      'Courier New',
      'monospace',
    ],
  },
  
  backgroundImage: {
    'terminal-grid': 'linear-gradient(rgba(0, 255, 65, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 65, 0.03) 1px, transparent 1px)',
    'scan-line': 'linear-gradient(to bottom, transparent, rgba(0, 255, 65, 0.1), transparent)',
  },
};
