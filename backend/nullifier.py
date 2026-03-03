"""
The Nullifier - Input Scan Module
Scans prompts for Jailbreak patterns and security risks
"""

import re
from typing import Dict, Any, List

# Common jailbreak patterns
JAILBREAK_PATTERNS = [
    r'ignore\s+(previous|all|above)\s+instructions?',
    r'forget\s+(previous|all|above)\s+instructions?',
    r'you\s+are\s+now\s+(a|an)\s+',
    r'pretend\s+you\s+are',
    r'act\s+as\s+if',
    r'roleplay\s+as',
    r'bypass\s+(safety|security|filter)',
    r'jailbreak',
    r'override\s+(safety|security|filter)',
    r'disregard\s+(previous|all|above)',
    r'you\s+must\s+not',
    r'you\s+cannot',
    r'you\s+are\s+forced',
    r'you\s+have\s+no\s+choice',
    r'this\s+is\s+(a|an)\s+(test|experiment)',
    r'ignore\s+your\s+(programming|instructions|guidelines)',
    r'override\s+your\s+(programming|instructions|guidelines)',
]

# High-risk keywords
HIGH_RISK_KEYWORDS = [
    'exploit',
    'vulnerability',
    'bypass',
    'hack',
    'crack',
    'malware',
    'virus',
    'trojan',
    'ransomware',
    'phishing',
    'sql injection',
    'xss',
    'csrf',
    'ddos',
]


def scan_prompt(prompt: str) -> Dict[str, Any]:
    """
    Scan a prompt for jailbreak patterns and security risks.
    
    Returns:
        {
            "risk": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
            "action": "ALLOW" | "WARN" | "NULLIFY",
            "matches": List of matched patterns,
            "confidence": float (0.0 - 1.0)
        }
    """
    prompt_lower = prompt.lower()
    matches = []
    risk_score = 0
    
    # Check for jailbreak patterns
    for pattern in JAILBREAK_PATTERNS:
        regex = re.compile(pattern, re.IGNORECASE)
        if regex.search(prompt):
            matches.append({
                "type": "jailbreak_pattern",
                "pattern": pattern,
                "severity": "HIGH"
            })
            risk_score += 0.3
    
    # Check for high-risk keywords
    for keyword in HIGH_RISK_KEYWORDS:
        if keyword in prompt_lower:
            matches.append({
                "type": "high_risk_keyword",
                "keyword": keyword,
                "severity": "MEDIUM"
            })
            risk_score += 0.1
    
    # Determine risk level and action
    if risk_score >= 0.5:
        risk = "CRITICAL"
        action = "NULLIFY"
    elif risk_score >= 0.3:
        risk = "HIGH"
        action = "WARN"
    elif risk_score >= 0.1:
        risk = "MEDIUM"
        action = "WARN"
    else:
        risk = "LOW"
        action = "ALLOW"
    
    confidence = min(risk_score, 1.0)
    
    return {
        "risk": risk,
        "action": action,
        "matches": matches,
        "confidence": round(confidence, 2),
        "risk_score": round(risk_score, 2)
    }
