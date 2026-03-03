# /backend/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import re
import uvicorn
import os
from dotenv import load_dotenv
from openai import OpenAI
from registry_check import scan_code_dependencies
from database import init_db, log_threat, get_recent_threats, get_threat_stats

# Load environment variables
load_dotenv()

# Initialize OpenAI client (will be None if API key not set)
api_key = os.getenv("OPENAI_API_KEY")
openai_client = OpenAI(api_key=api_key) if api_key else None

app = FastAPI()

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    init_db()

# CORS middleware for Electron/Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------
# NULLPOINT THREAT DATABASE
# --------------------------
# In a real app, this would be a JSON file or SQLite DB
THREAT_SIGNATURES = [
    r"ignore previous instructions",
    r"system override",
    r"DAN mode",
    r"unfiltered",
]

# PII Detection Patterns
# Order matters: Specific patterns first, generic patterns last
PII_PATTERNS = {
    # AWS Access Key (Paranoid Mode) - More aggressive for demo (8+ chars, allows hyphens)
    # Catches "AKIA" (case-insensitive) followed by any mix of caps, numbers, OR hyphens
    # Uses negative lookbehind/lookahead to avoid false positives
    "AWS_ACCESS_KEY": r"(?i)(?<![A-Z0-9-])AKIA[-A-Z0-9]{8,}(?![A-Z0-9-])",
    
    # AWS Secret Key - Strict: Exactly 40 characters (standard AWS secret key length)
    # Matches strings with alphanumeric, /, +, = characters
    "AWS_SECRET_KEY": r"(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])",
    
    # OpenAI Keys (sk-...)
    "OPENAI_KEY": r"(?i)sk-[a-zA-Z0-9]{20,}",
    
    # Stripe Keys (sk_live_... or sk_test_...) - More aggressive for demo (10+ chars)
    "STRIPE_KEY": r"sk_(live|test)_[a-zA-Z0-9]{10,}",
    
    # Email
    "EMAIL": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
    
    # Generic Secret/API Key - Catches unknown API keys (Hubspot, Algolia, GitHub, etc.)
    # Matches variable names that contain keywords anywhere (e.g., SUPERBASE_API_KEY, MY_SECRET_TOKEN)
    # Looks for: (api|secret|token|key|password|auth)[-a-z0-9_]*\s*[:=]\s*['"](16-64 chars)['"]
    # Placed LAST to avoid false positives on specific key types
    "GENERIC_SECRET": r"(?i)(?:api|secret|token|key|password|auth|credential)[-a-z0-9_]*\s*[:=]\s*['\"]([a-zA-Z0-9_\-\.]{16,64})['\"]"
}

class PromptRequest(BaseModel):
    text: str

class ChatRequest(BaseModel):
    user_message: str

class ScanResult(BaseModel):
    is_safe: bool
    risk_score: int # 0-100
    flags: list[str]
    sanitized_text: str

def scan_for_injection(text: str) -> list[str]:
    flags = []
    for pattern in THREAT_SIGNATURES:
        if re.search(pattern, text, re.IGNORECASE):
            flags.append(f"INJECTION_MATCH: {pattern}")
    return flags

def mask_pii(text: str) -> str:
    # Simple regex for email masking (Placeholder for Presidio)
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    return re.sub(email_pattern, "[REDACTED_EMAIL]", text)

def scan_and_redact_pii(text: str) -> tuple[str, list[str]]:
    """
    Scan text for PII (Personally Identifiable Information) and redact it.
    Uses PII_PATTERNS dictionary for detection.
    Returns: (clean_text, pii_flags)
    """
    clean_text = text
    pii_flags = []
    
    # Iterate through PII_PATTERNS dictionary
    for key_name, pattern in PII_PATTERNS.items():
        matches = re.findall(pattern, clean_text, re.IGNORECASE)
        if matches:
            pii_flags.append(key_name)
            # Replace with appropriate redaction tag
            if key_name == "EMAIL":
                clean_text = re.sub(pattern, "[REDACTED_EMAIL]", clean_text, flags=re.IGNORECASE)
            elif key_name in ["AWS_ACCESS_KEY", "AWS_SECRET_KEY"]:
                clean_text = re.sub(pattern, "[REDACTED_AWS_KEY]", clean_text, flags=re.IGNORECASE)
            elif key_name in ["OPENAI_KEY", "STRIPE_KEY"]:
                clean_text = re.sub(pattern, "[REDACTED_KEY]", clean_text, flags=re.IGNORECASE)
            elif key_name == "GENERIC_SECRET":
                # Special handling: Only redact the captured group (the secret value), keep variable name
                def replace_generic_secret(match):
                    # The pattern has one capture group for the secret value
                    # Match structure: variable_name = "secret_value"
                    # We want: variable_name = "[REDACTED_GENERIC_SECRET]"
                    full_match = match.group(0)
                    secret_value = match.group(1)  # The captured secret value
                    # Find the quote character used
                    if '"' in full_match:
                        quote_char = '"'
                    elif "'" in full_match:
                        quote_char = "'"
                    else:
                        quote_char = '"'
                    # Replace only the secret value inside quotes
                    return full_match.replace(f'{quote_char}{secret_value}{quote_char}', f'{quote_char}[REDACTED_GENERIC_SECRET]{quote_char}')
                
                clean_text = re.sub(pattern, replace_generic_secret, clean_text, flags=re.IGNORECASE)
            else:
                # Default redaction
                clean_text = re.sub(pattern, f"[REDACTED_{key_name}]", clean_text, flags=re.IGNORECASE)
    
    # Additional pattern: API keys in JSON structures (e.g., "apiKey": "value")
    json_api_key_pattern = r'(["\'](?:api[_-]?key|apikey|secret|access[_-]?token)["\']\s*:\s*["\']?)([A-Za-z0-9\-_/+=]{16,})(["\']?)'
    json_api_matches = re.findall(json_api_key_pattern, clean_text, re.IGNORECASE)
    if json_api_matches:
        # Check if any match looks like a credential (not already redacted)
        for prefix, value, suffix in json_api_matches:
            if not value.startswith('[REDACTED'):
                # Check if it matches any of our PII patterns
                is_pii = False
                for key_name, pattern in PII_PATTERNS.items():
                    if re.search(pattern, value, re.IGNORECASE):
                        is_pii = True
                        if key_name not in pii_flags:
                            pii_flags.append(key_name)
                        break
                
                # Also check for long alphanumeric strings that could be secrets
                if not is_pii and len(value) >= 32 and re.match(r'^[A-Za-z0-9/+=_-]+$', value):
                    if "API_KEY_JSON" not in pii_flags:
                        pii_flags.append("API_KEY_JSON")
                    is_pii = True
                
                if is_pii:
                    clean_text = re.sub(
                        f'{re.escape(prefix)}{re.escape(value)}{re.escape(suffix)}',
                        f'{prefix}[REDACTED_KEY]{suffix}',
                        clean_text,
                        count=1
                    )
    
    return clean_text, pii_flags

@app.post("/scan", response_model=ScanResult)
async def scan_prompt(request: PromptRequest):
    flags = scan_for_injection(request.text)
    sanitized = mask_pii(request.text)
    
    # Calculate Risk
    risk_score = 0
    if flags:
        risk_score = 90  # Critical
        # Log injection attack threat
        for flag in flags:
            log_threat(
                threat_type="INJECTION_ATTACK",
                category="SECURITY",
                severity="CRITICAL",
                source="INPUT",
                details=flag,
                raw_data={"text": request.text, "flag": flag}
            )
    elif "[REDACTED_EMAIL]" in sanitized:
        risk_score = 40  # Moderate (Data Leak)
        # Log PII in input
        log_threat(
            threat_type="PII_INPUT",
            category="PII",
            severity="MEDIUM",
            source="INPUT",
            details="Email detected in user input",
            raw_data={"text": request.text}
        )
    
    return {
        "is_safe": risk_score < 50,
        "risk_score": risk_score,
        "flags": flags,
        "sanitized_text": sanitized
    }

@app.post("/scan-code")
async def scan_code(request: PromptRequest):
    results = scan_code_dependencies(request.text)
    
    # Check if any are critical
    critical_count = sum(1 for r in results if r['risk'] == "CRITICAL")
    
    # Log hallucinated packages (VOID dependencies)
    for result in results:
        if result['risk'] == "CRITICAL":
            # Hallucinated packages are MEDIUM severity (not critical security issue)
            log_threat(
                threat_type="HALLUCINATED_PACKAGE",
                category="CODE",
                severity="MEDIUM",
                source="CODE_SCAN",
                details=f"Hallucinated package detected: {result['library']}",
                raw_data=result
            )
    
    return {
        "safe_to_run": critical_count == 0,
        "dependencies": results
    }

@app.post("/chat")
async def chat(request: ChatRequest):
    """
    Proxy endpoint: Send user message to OpenAI, scan response for malicious packages.
    """
    try:
        # Step 0: Scan INPUT for PII (Outbound Shield) - Block if PII detected
        input_clean_text, input_pii_flags = scan_and_redact_pii(request.user_message)
        if input_pii_flags:
            # Log PII detection in input
            for pii_type in input_pii_flags:
                log_threat(
                    threat_type="OUTBOUND_PII",
                    category="PII",
                    severity="CRITICAL",
                    source="INPUT",
                    details=f"PII detected in user input: {pii_type}",
                    raw_data={"pii_types": input_pii_flags, "user_message": request.user_message}
                )
            
            # PII detected in input - BLOCK the request
            blocked_result = {
                "reply": "BLOCKED: PII Detected in Prompt",
                "scan_results": [{
                    "library": "OUTBOUND_PII",
                    "status": "BLOCKED",
                    "risk": "CRITICAL",
                    "type": "OUTBOUND_PII",
                    "severity": "CRITICAL",
                    "details": f"PII detected in user input: {', '.join(input_pii_flags)}"
                }]
            }
            return blocked_result
        
        # Step 1: Call OpenAI API
        if not openai_client or not api_key:
            raise HTTPException(status_code=500, detail="OpenAI API key not configured. Please set OPENAI_API_KEY in .env file")
        
        response = openai_client.chat.completions.create(
            model="gpt-4o",  # or "gpt-3.5-turbo" for cheaper option
            messages=[
                {"role": "user", "content": request.user_message}
            ],
            temperature=0.7,
        )
        
        # Step 2: Extract AI response
        ai_response = response.choices[0].message.content
        
        # Step 3: Scan and redact PII from the response
        clean_text, pii_flags = scan_and_redact_pii(ai_response)
        
        # Step 4: Scan the AI response for malicious packages
        scan_results = scan_code_dependencies(clean_text)
        
        # Log hallucinated packages from AI response
        for result in scan_results:
            if result.get('risk') == "CRITICAL":
                # Hallucinated packages are MEDIUM severity (not critical security issue)
                log_threat(
                    threat_type="HALLUCINATED_PACKAGE",
                    category="CODE",
                    severity="MEDIUM",
                    source="OUTPUT",
                    details=f"Hallucinated package in AI response: {result.get('library', 'unknown')}",
                    raw_data=result
                )
        
        # Step 5: Add PII detection to scan_results if PII was found
        if pii_flags:
            # Log PII detection in AI response
            for pii_type in pii_flags:
                log_threat(
                    threat_type="PII_LEAK",
                    category="PII",
                    severity="CRITICAL",
                    source="OUTPUT",
                    details=f"PII leaked in AI response: {pii_type}",
                    raw_data={"pii_types": pii_flags, "ai_response": ai_response}
                )
            
            pii_entry = {
                "library": "PII_LEAK",
                "status": "VOID (Potential Hallucination)",
                "risk": "CRITICAL",
                "type": "PII_LEAK",
                "severity": "CRITICAL",
                "details": f"Sensitive Data Leaked: {', '.join(pii_flags)}"
            }
            scan_results.append(pii_entry)
        
        # Step 6: Return cleaned response with scan results
        return {
            "reply": clean_text,  # Return redacted text, not original
            "scan_results": scan_results
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calling OpenAI: {str(e)}")

@app.get("/threats")
async def get_threats(limit: int = 100, category: str = None):
    """Get recent threats from the database"""
    from database import get_recent_threats
    threats = get_recent_threats(limit=limit, category=category)
    return {"threats": threats}

@app.get("/threats/stats")
async def get_threat_statistics():
    """Get threat statistics by category, severity, and type"""
    from database import get_threat_stats
    stats = get_threat_stats()
    return stats

# Run with: uvicorn main:app --reload
if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
