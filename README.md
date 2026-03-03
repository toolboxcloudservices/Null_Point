# 🛡️ NullPoint AI: Zero-Trust Security Gateway for LLMs

![Version](https://img.shields.io/badge/version-1.0.0-green) ![Security](https://img.shields.io/badge/security-Zero%20Trust-blue) ![Stack](https://img.shields.io/badge/stack-React%20%7C%20Electron%20%7C%20Python-orange)

**NullPoint AI** is a local-first security middleware that acts as a firewall between developers and Large Language Models (LLMs). 

Unlike standard web interfaces (ChatGPT/Claude) that blindly execute code and store data, **NullPoint intercepts traffic in real-time** to prevent Data Loss (DLP) and Supply Chain Attacks before they happen.

---

## 🎥 Demo

[INSERT YOUR 30-SECOND DEMO GIF HERE]

> *Above: NullPoint verifying packages in real-time and blocking an AWS Key leak instantly.*

---

## 🚨 The Problem

1.  **Data Exfiltration:** Employees accidentally paste API keys, customer PII, or internal source code into web-based AI tools, leaking trade secrets to third-party servers.
2.  **Supply Chain Attacks:** LLMs often hallucinate software packages (typosquatting). If a developer runs `pip install` on a hallucinated library, they can compromise their entire company network.
3.  **Shadow IT:** Companies have no visibility into what code is being generated or what data is leaving the laptop.

## 🛡️ The Solution: 3-Layer Defense

NullPoint implements a **"Shift Left" Security Architecture** that runs entirely on the local device (localhost):

### 1. 🔒 The Input Shield (Outbound DLP)
* **What it does:** Scans your prompt *before* it leaves your computer.
* **Tech:** Regex heuristics & Entropy analysis.
* **Capabilities:**
    * Blocks **AWS/Stripe/OpenAI Keys** instantly.
    * Prevents accidental pasting of **PII** (Emails, Phone Numbers).
    * **Result:** The request is killed locally; data never touches OpenAI servers.

### 2. 📦 The Supply Chain Verifier (Inbound Code Security)
* **What it does:** Parses AI-generated code to extract imports and verifies them against real registries.
* **Tech:** Python AST (Abstract Syntax Tree) Parsing + PyPI/NPM Real-time API.
* **Capabilities:**
    * **🟢 Green Badge:** Verified, safe library (e.g., `requests`, `pandas`).
    * **🔴 Red VOID Badge:** Hallucinated or malicious package (e.g., `req-uests-v2`).
    * **Visual Warning:** Pulses a warning directly in the chat UI next to the import statement.

### 3. 👁️ The Redaction Engine (Inbound PII Protection)
* **What it does:** Sanitizes the AI's response to ensure no sensitive data is displayed or logged.
* **Tech:** Pattern Matching & Context-Aware Replacement.
* **Capabilities:**
    * Detects **Generic API Keys** (e.g., `const KEY = "sbp_..."`).
    * Redacts emails and financial data from JSON/SQL outputs.
    * **UI:** Replaces sensitive text with `[REDACTED]` and flags it with a warning badge.

---

## 🏗️ Architecture

NullPoint is built as a **Desktop Electron App** to ensure it controls the local environment.

```mermaid
graph LR
    User[User Input] -->|Intercept| Firewall[Input Shield]
    Firewall -- BLOCKED (PII) --> User
    Firewall -- Safe --> LLM[OpenAI API]
    LLM -->|Raw Response| AST[AST Parser & Scanner]
    AST -->|Verify Pkg| PyPI[PyPI Registry]
    AST -->|Redact PII| PII_Engine[Redaction Layer]
    PII_Engine -->|Sanitized Stream| UI[React Frontend]
    UI -->|Visual Flags| Dev[Developer]

------------

### 🛠️ Tech Stack

    Frontend: React (TypeScript), Tailwind CSS, Framer Motion (Animations).

    Desktop Container: Electron (IPC Communication).

    Security Backend: Python (FastAPI), ast module, Custom Regex Engine.

    AI Integration: OpenAI API (GPT-4o).

### 🚀 Getting Started
Prerequisites

    Node.js & NPM

    Python 3.10+

    OpenAI API Key

### Installation

    Clone the Repository
    Bash

    git clone [https://github.com/yourusername/nullpoint-ai.git](https://github.com/yourusername/nullpoint-ai.git)
    cd nullpoint-ai

    Setup Backend
    Bash

    cd backend
    pip install -r requirements.txt
    python main.py

    Setup Frontend (New Terminal)
    Bash

    cd frontend
    npm install
    npm run electron:dev

### 🔮 Future Roadmap

    [ ] Local LLM Support: Add support for running Llama 3 locally (Air-Gapped Mode).

    [ ] Custom Ruleset: Allow organizations to define custom regex patterns for internal project codes.

    [ ] SOC2 Reporting: Export threat logs as a PDF audit trail.

Author: DeAnna Bolling

Building the future of Secure AI adoption.