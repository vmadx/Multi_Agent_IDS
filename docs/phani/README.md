# Individual Contribution Report: Sri Sai Phani Penugonda (245523753040)

**Project Title:** An Agentic AI-Based Multi-Agent System for Network Intrusion Detection, Triage, and Adaptive Response  
**Department:** Computer Science & Engineering (AI & ML), Keshav Memorial Engineering College, Hyderabad  
**Supervisor:** Mrs. Gayithri Tippani, Assistant Professor, CSE (AI&ML)  
**Role:** Ingestion, Triage, Control Plane Execution, Closed-Loop Verification & Adaptive Escalation Lead  

---

## 1. Executive Summary of Contributions

As part of the Multi-Agent NIDS project, I have designed, engineered, tested, and delivered the complete **Frontline Telemetry & Closed-Loop Response Engine** (5 autonomous agents + simulation driver + shared state schemas):

```
Raw Traffic / Flow CSVs
        │
        ▼
┌─────────────────────────┐
│ 1. MONITORING AGENT     │  ← Telemetry Ingestion, Validation & Sanitization
└───────────┬─────────────┘
            │  Validated NetworkEvent
            ▼
┌─────────────────────────┐
│ 2. TRIAGE AGENT         │  ← Deduplication, Whitelist/Blacklist, Urgency Scoring
└───────────┬─────────────┘
            │  Tagged TriagedAlert (Priority & Category)
            ▼
  [Madhuri: ML Detection, Diagnosis & XAI]
  [Hima: LangGraph Controller, RAG & HITL]
            │
            │  Approved ResponsePlan
            ▼
┌─────────────────────────┐
│ 3. RESPONSE EXECUTION   │  ← Countermeasure Execution (IP Block, Throttling, Isolation)
│    AGENT & FIREWALL     │
└───────────┬─────────────┘
            │  ExecutionResult
            ▼
┌─────────────────────────┐
│ 4. VERIFICATION AGENT   │  ← Closed-Loop Traffic Check & Confidence Scoring
└───────────┬─────────────┘
            │
      ┌─────┴──────────────────┐
      ▼                        ▼
[THREAT CLEARED]        [THREAT PERSISTS]
Incident Resolved       ┌─────────────────────────┐
→ Logged to Memory      │ 5. ADAPT & ESCALATE     │  ← /24 Subnet Ban, Port Throttling,
                        │    AGENT                │     or Tier-2 Analyst Handover
                        └───────────┬─────────────┘
                                    │ (Adapted Plan Loops Back to Execution)
                                    ▼
```

---

## 2. Component Deep-Dive

### Agent 1: Monitoring Agent (`src/agents/monitoring_agent.py`)
- **Purpose:** Ingests live packet feeds or batch CSV flow datasets (CICIDS2017 / NSL-KDD formats).
- **Key Technical Capabilities:**
  - **Generator-Based Stream Adapter:** Streams large telemetry datasets row-by-row with minimal memory overhead ($O(1)$ memory).
  - **Data Sanitizer & Validator:** Automatically filters corrupted records (missing IP addresses, invalid port numbers) and normalizes negative/abnormal durations to maintain dataset integrity.
  - **Unified Event Modeling:** Transforms disparate raw telemetry into standardized `NetworkEvent` Pydantic models with unique UUIDs.

### Agent 2: Triage Agent (`src/agents/triage_agent.py`)
- **Purpose:** Serves as the high-throughput first filter to mitigate **analyst alert fatigue** and protect downstream LLMs from being overwhelmed.
- **Key Technical Capabilities:**
  - **Sliding-Window Deduplication:** Maintains a fast in-memory cache of `(src_ip, dst_ip, dst_port)` connection tuples within a 5-minute window to eliminate repetitive alert bursts.
  - **Threat Intel Feeds & Whitelisting:** Bypasses trusted internal infrastructure (Default Gateways, DNS) and immediately elevates known malicious C2 IP blacklists.
  - **Port Scan Tracking:** Tracks distinct destination ports targeted by a single source IP; automatically flags a port scan when probed ports $\ge 4$.
  - **Weighted Urgency Scoring (0.0 to 1.0):**
    - $0.0 \le \text{Score} < 0.4 \implies \text{LOW / BENIGN}$ (noise filtered out early)
    - $0.4 \le \text{Score} < 0.6 \implies \text{MEDIUM}$ (routed to ML classification)
    - $0.6 \le \text{Score} < 0.8 \implies \text{HIGH}$ (sensitive service brute-force / port scans)
    - $\text{Score} \ge 0.8 \implies \text{CRITICAL}$ (SYN floods, DDoS, known C2 actors)

### Agent 3: Response Execution Agent (`src/agents/execution_agent.py`)
- **Purpose:** Dispatches approved remediation plans received from the Human-in-the-Loop (HITL) gateway.
- **Key Technical Capabilities:**
  - **Action Dispatcher:** Translates abstract response actions (`BLOCK_IP`, `RATE_LIMIT`, `ISOLATE_HOST`, `DROP_SESSION`, `ALERT_ANALYST`) into actionable control commands.
  - **Firewall Simulation Sandbox (`src/simulation/firewall_driver.py`):** Implements an active in-memory network control plane tracking active IP blocks, `/24` subnet bans, bandwidth throttling, and host quarantines.
  - **Priority-Ordered Execution:** Automatically executes containment rules based on priority weighting with automatic retry handling.

### Agent 4: Verification Agent (`src/agents/verification_agent.py`)
- **Purpose:** Implements **closed-loop feedback** by re-observing network telemetry post-mitigation.
- **Key Technical Capabilities:**
  - **Residual Traffic Analysis:** Compares pre-attack and post-attack packet rates to calculate percentage drop:
    $$\text{Observed Drop} = \max\left(0, \frac{\text{PreRate} - \text{PostRate}}{\text{PreRate}} \times 100\right)$$
  - **Threat Clearance & Confidence:** Verifies whether active firewall blocks are holding and residual packets are zeroed, emitting a high-confidence clearance flag or triggering the escalation loop.

### Agent 5: Adapt & Escalate Agent (`src/agents/adapt_escalate.py`)
- **Purpose:** Dynamically adapts defensive posture when adversaries rotate IPs, evade blocks, or persist.
- **Key Technical Capabilities:**
  - **Multi-Level Escalation Ladder:**
    - **Attempt #1:** Threat persists after single IP block $\rightarrow$ Upgrades to a `/24` Subnet Ban (`SUBNET_BAN`).
    - **Attempt #2:** Subnet ban evaded $\rightarrow$ Triggers targeted Host Quarantine (`EMERGENCY_QUARANTINE`) and port throttling.
    - **Attempt #3:** Exceeded autonomous threshold (`MAX_AUTONOMOUS_ESCALATIONS = 2`) $\rightarrow$ Safely halts autonomous loop and dispatches a priority incident report to a human **Tier-2 SOC Analyst** (`TIER2_NOTIFY`).
  - **Loop Prevention Guardrail:** Enforces hard iteration limits to avoid infinite remediation loops.

---

## 3. Shared State Schemas (`src/schemas/state.py`)

I established the foundation data contracts used across all three team members (compatible with LangGraph StateGraph, Pydantic v2, and MongoDB):
- `NetworkEvent` (Raw & normalized telemetry)
- `TriagedAlert` (Scored alert metadata)
- `ResponseAction` & `ResponsePlan` (HITL remediation playbooks)
- `ExecutionResult` (Audit trail of deployed countermeasures)
- `VerificationResult` (Closed-loop metrics and confidence)
- `EscalationDecision` (Adapted policy rules)
- `AgentState` (Central LangGraph TypedDict)

---

## 4. Verification & Testing Evidence

All modules are backed by three automated test suites:

| Test File | Scope | Status |
| :--- | :--- | :--- |
| `tests/test_phase1_schemas.py` | Validates all Pydantic models, enums, and LangGraph dictionary serializability | **PASSED (100%)** |
| `tests/test_phase2_phase3.py` | Integrates Monitoring + Triage on realistic flow CSV data (SYN Flood, Port Scan, Brute Force, Corrupt records) | **PASSED (100%)** |
| `tests/test_phani_pipeline.py` | End-to-end multi-agent test covering Happy Path, Closed-Loop Escalation, and Tier-2 Handover Guardrails | **PASSED (100%)** |

---

## 5. Summary Table for Review-1 Presentation

| Metric / Parameter | Contribution Value |
| :--- | :--- |
| **Modules Engineered** | 5 Autonomous Agents + 1 Firewall Driver + 1 Schema Engine |
| **Languages & Frameworks** | Python 3.12, Pydantic v2, LangGraph StateGraph design, CSV/Flow Streamers |
| **Alert Reduction** | Deduplicates redundant flows + filters benign low-risk events early |
| **Safety Mechanisms** | 3-tier escalation ladder + loop guardrails + Tier-2 human escalation |
| **Status in Repository** | Fully committed, tested, and pushed to `main` |
