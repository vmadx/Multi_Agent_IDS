# Multi-Agent Intrusion Detection System (Multi_Agent_IDS)

An Agentic AI-Based Multi-Agent System for Network Intrusion Detection, Triage, and Adaptive Response.

---

## 📌 Project Overview
Modern Security Operations Centers (SOCs) face overwhelming alert fatigue, delayed incident response times, and limited contextual reasoning from conventional rule-based NIDS. 

This project implements an autonomous, multi-agent AI incident response ecosystem that pairs high-throughput classical Machine Learning with cognitive multi-agent reasoning (orchestrated via **LangGraph**), grounded threat intelligence via **Retrieval-Augmented Generation (RAG)**, and **closed-loop adaptive response**.

---

## 👥 Team Work Division & Architecture

The system is engineered as three collaborative pillars:

```
[Raw Network Traffic / Flow Stream]
                 │
                 ▼
 ┌──────────────────────────────────────────────┐
 │  PHANI (Telemetry & Ingestion Engine)         │
 │  • Monitoring Agent (Sanitization & Stream)  │
 │  • Triage Agent (Dedup & Urgency Scoring)     │
 └──────────────────────┬───────────────────────┘
                        │ Normalized Alert
                        ▼
 ┌──────────────────────────────────────────────┐
 │  MADHURI (Detection, XAI & Full-Stack Core)  │
 │  • Detection Agent (Random Forest / XGBoost) │
 │  • Diagnosis Agent (Root-Cause Hypotheses)   │
 │  • Explainable AI (SHAP / LIME + LLM)        │
 │  • REST API Backend & MongoDB Alert Store    │
 └──────────────────────┬───────────────────────┘
                        │ Feature Explanations & Evidence
                        ▼
 ┌──────────────────────────────────────────────┐
 │  HIMA (Orchestration & Cognitive Brain)      │
 │  • LangGraph StateGraph & Agentic Loops      │
 │  • Threat Intel & RAG Agent (MITRE ATT&CK)   │
 │  • Response Planning Agent (Playbooks)       │
 │  • Human-in-the-Loop (HITL) Gateway          │
 │  • Learning & Knowledge Storage Agent        │
 └──────────────────────┬───────────────────────┘
                        │ Approved Response Plan
                        ▼
 ┌──────────────────────────────────────────────┐
 │  PHANI (Execution, Verification & Feedback)  │
 │  • Response Execution Agent (Firewall Driver)│
 │  • Verification Agent (Closed-Loop Drop %)   │
 │  • Adapt & Escalate Agent (/24 Ban / Tier-2) │
 └──────────────────────────────────────────────┘
```

---

## 🚀 Phani's Modules (Completed & Verified)

Detailed documentation is available in [`docs/phani/README.md`](docs/phani/README.md).

### 1. Monitoring Agent (`src/agents/monitoring_agent.py`)
- Ingests raw network telemetry (CICIDS2017 / NSL-KDD CSV streams or live flow packets).
- Sanitizes corrupted rows (missing IPs/ports, negative durations).
- Normalizes flows into standardized `NetworkEvent` Pydantic models.

### 2. Triage Agent (`src/agents/triage_agent.py`)
- Employs a **5-minute sliding-window cache** to eliminate duplicate alert storms.
- Applies automated Whitelist / Blacklist threat intel lookups.
- Performs multi-factor **Urgency Scoring (0.0 to 1.0)** and categorizes attack heuristics (SYN Flood, Port Scan, Brute-Force).

### 3. Response Execution Agent (`src/agents/execution_agent.py`)
- Dispatches approved countermeasures to the simulated firewall control plane:
  - `BLOCK_IP` (Single IP or `/24` subnet ban)
  - `RATE_LIMIT` (Bandwidth throttling)
  - `ISOLATE_HOST` (VLAN quarantine)
  - `DROP_SESSION` (TCP RST injection)
  - `ALERT_ANALYST` (Dispatches Tier-2 notification)

### 4. Verification Agent (`src/agents/verification_agent.py`)
- Evaluates post-mitigation telemetry to verify whether malicious packet rates dropped to zero.
- Calculates observed drop percentage and clearance confidence score.

### 5. Adapt & Escalate Agent (`src/agents/adapt_escalate.py`)
- Closed-loop feedback controller when attacks persist:
  - **Attempt 1:** Escalates single IP block to a `/24` Subnet Ban.
  - **Attempt 2:** Triggers targeted Host Quarantine and port throttling.
  - **Attempt 3:** Enforces a loop guardrail and hands incident over to a human **Tier-2 SOC Analyst**.

---

## 🛠️ Quickstart & Execution

### 1. Installation
Clone the repository and install requirements:
```bash
git clone https://github.com/vmadx/Multi_Agent_IDS.git
cd Multi_Agent_IDS
pip install -r requirements.txt
```

### 2. Run the Interactive Pipeline Demo
```bash
python main.py
```

### 3. Run Automated Test Suites
```bash
# 1. Shared Schemas Validation Test
python tests/test_phase1_schemas.py

# 2. Monitoring & Triage Integration Test
python tests/test_phase2_phase3.py

# 3. Complete 5-Agent Closed-Loop Pipeline Test
python tests/test_phani_pipeline.py
```

---

## 📂 Project Structure
```
├── docs/
│   ├── hima/
│   ├── madhuri/
│   └── phani/
│       └── README.md                # Detailed technical report for Phani's modules
├── data/
│   └── samples/
│       └── sample_flows.csv         # Realistic test telemetry dataset
├── src/
│   ├── schemas/
│   │   └── state.py                 # LangGraph AgentState & Pydantic models
│   ├── agents/
│   │   ├── monitoring_agent.py      # Telemetry ingest & normalization
│   │   ├── triage_agent.py          # Alert deduplication & urgency scoring
│   │   ├── execution_agent.py       # Countermeasure execution engine
│   │   ├── verification_agent.py    # Closed-loop traffic check
│   │   └── adapt_escalate.py        # Escalation ladder & Tier-2 handover
│   ├── simulation/
│   │   └── firewall_driver.py       # Active firewall sandbox
│   └── utils/
│       └── logger.py                # ANSI badge logger
├── tests/
│   ├── test_phase1_schemas.py
│   ├── test_phase2_phase3.py
│   └── test_phani_pipeline.py
├── main.py                          # Interactive demo runner
├── requirements.txt
└── .gitignore
```
