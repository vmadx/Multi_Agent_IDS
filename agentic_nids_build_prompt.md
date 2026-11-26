# MASTER BUILD PROMPT — Agentic AI Multi-Agent NIDS (Security Onion–style UI)

> Paste this whole file into your coding AI. Build **everything** listed. Do not skip, stub, or summarise any section. If something is ambiguous, pick the most reasonable option, state it in a `ASSUMPTIONS.md`, and keep going.

---

## 0. ROLE & GOAL

- You are a senior full-stack engineer + ML engineer + security engineer.
- Build a complete, runnable web app: **"Agentic NIDS"** — a multi-agent system for network intrusion **detection, triage, reasoning, response planning, human approval, execution (simulated), verification and learning**.
- UI must look like **Security Onion 3.x** (dark SOC console): left sidebar nav, black top bar, dark navy content cards, tabbed detail pages.
- **No live traffic.** Data source = **CIC-IDS-2017** CSVs, *replayed* as a simulated live stream.
- Whole system must run with one command: `docker compose up`.

---

## 0.1 SAMPLE-DATA MODE (IMPORTANT — frontend must work with NO backend/agents connected)

- Every page must **show realistic fake/sample data immediately on first open**, so the UI looks complete before the agents are connected.
- Implement a data layer `src/api/` with two interchangeable providers:
  - `mockProvider` — returns data from `src/mock/*.js` (alerts, incidents, detections, flows, cases, approvals, agent traces, KPIs, time series, model metrics, knowledge chunks, chat replies).
  - `apiProvider` — real calls to the FastAPI backend.
- Switch with one env flag: `VITE_USE_MOCK=true` (default **true**). A small **"Sample data" badge** in the top bar shows when mock mode is on. Pages must not change when switching; only the provider does.
- Mock data must be rich and consistent (use CIC-IDS-2017 labels, IPs from §2.5, MITRE IDs from §2.4):
  - 200+ alerts across all 15 labels and all severities/statuses, 12+ incidents covering every workflow step (incl. one awaiting approval, one failed-verification/escalated, one resolved), 30+ detections (include the exact Suricata one from §7.5), 10 cases, 5 pending approvals, 20+ flows, 24h time series, ML metrics + confusion matrix, SHAP values, KB chunks with similarity scores.
  - Simulate liveness: a timer adds a new fake alert every few seconds, ticks KPI counters, and advances the Workflow page animation, so charts and tables look live.
  - Fake actions work in-memory: approve/reject, toggle detection, add note, change alert status, send chat message (canned streaming reply).
  - Loading skeletons with a short artificial delay (300–600 ms) to feel real.
- All mock data lives only in `src/mock/`, so it can be deleted once real agents are connected. Keep response shapes **identical** to the backend schemas in §6 so switching is a one-line change.

---

## 1. TECH STACK (fixed)

| Layer | Choice |
|---|---|
| Frontend | React 18 + JavaScript (JSX, no TypeScript) + Vite, **plain CSS only (no Tailwind, no shadcn/ui, no CSS-in-JS)** — global `styles/tokens.css` with CSS variables + one `.css` file per component/page (or CSS Modules); small hand-written reusable components (Button, Card, Tabs, Toggle, Table, Modal, Chip, Drawer) in `components/ui/`, Recharts (charts), React Flow (workflow graph), TanStack Query, Zustand, React Router v6, Lucide icons, Monaco/`react-syntax-highlighter` for rule view |
| Backend | Python 3.11, FastAPI, Uvicorn, Pydantic v2, SQLAlchemy 2 + Alembic, Celery or asyncio background tasks, WebSocket + SSE |
| Agent orchestration | **LangGraph** (state machine mirroring the 15-step workflow) |
| LLM | Provider-agnostic wrapper (`LLM_PROVIDER` = `anthropic` / `openai` / `ollama`), env-configured; deterministic **mock LLM** fallback when no key is set |
| ML | scikit-learn, XGBoost/LightGBM, PyTorch (optional autoencoder), SHAP for explainability, joblib |
| DB | PostgreSQL 16 + **pgvector** (relational + embeddings); Redis (queue, pub/sub, cache) |
| Embeddings | `sentence-transformers/all-MiniLM-L6-v2` (384-dim) |
| Infra | Docker Compose: `frontend`, `backend`, `worker`, `postgres`, `redis` |

---

## 2. DATASET — CIC-IDS-2017

### 2.1 Files (use the **TrafficLabelling / GeneratedLabelledFlows** version — it contains IPs, ports, timestamps; the "MachineLearningCVE" version does NOT)
- `Monday-WorkingHours.pcap_ISCX.csv` (benign only)
- `Tuesday-WorkingHours.pcap_ISCX.csv` (FTP-Patator, SSH-Patator)
- `Wednesday-workingHours.pcap_ISCX.csv` (DoS slowloris, Slowhttptest, Hulk, GoldenEye, Heartbleed)
- `Thursday-WorkingHours-Morning-WebAttacks.pcap_ISCX.csv` (Web Brute Force, XSS, SQL Injection)
- `Thursday-WorkingHours-Afternoon-Infilteration.pcap_ISCX.csv` (Infiltration)
- `Friday-WorkingHours-Morning.pcap_ISCX.csv` (Bot)
- `Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv` (PortScan)
- `Friday-WorkingHours-Afternoon-DDos.pcap_ISCX.csv` (DDoS)

### 2.2 Columns (~85): must be handled
`Flow ID, Source IP, Source Port, Destination IP, Destination Port, Protocol, Timestamp, Flow Duration, Total Fwd Packets, Total Backward Packets, Total Length of Fwd/Bwd Packets, Fwd/Bwd Packet Length Max/Min/Mean/Std, Flow Bytes/s, Flow Packets/s, Flow IAT Mean/Std/Max/Min, Fwd/Bwd IAT Total/Mean/Std/Max/Min, Fwd/Bwd PSH Flags, Fwd/Bwd URG Flags, Fwd/Bwd Header Length, Fwd/Bwd Packets/s, Min/Max Packet Length, Packet Length Mean/Std/Variance, FIN/SYN/RST/PSH/ACK/URG/CWE/ECE Flag Count, Down/Up Ratio, Average Packet Size, Avg Fwd/Bwd Segment Size, Fwd Avg Bytes/Bulk, Fwd Avg Packets/Bulk, Fwd Avg Bulk Rate, Bwd Avg Bytes/Bulk, Bwd Avg Packets/Bulk, Bwd Avg Bulk Rate, Subflow Fwd/Bwd Packets/Bytes, Init_Win_bytes_forward/backward, act_data_pkt_fwd, min_seg_size_forward, Active Mean/Std/Max/Min, Idle Mean/Std/Max/Min, Label`

### 2.3 Known data issues — handle ALL
- Column names have **leading/trailing spaces** (e.g. `" Label"`) → strip.
- `Fwd Header Length` appears **twice** → drop the duplicate.
- `Flow Bytes/s` and `Flow Packets/s` contain `inf`, `-inf`, `NaN` → replace with NaN, impute median (fit on train only).
- Negative values in `Init_Win_bytes_*`, `Flow Duration`, etc. → clip/flag.
- Duplicated rows → drop.
- Encoding: read with `encoding="latin1"`.
- Labels include non-ASCII dash (`Web Attack � Brute Force`) → normalise to `Web Attack - Brute Force`.
- Severe class imbalance → class weights / SMOTE on train only; **time-based split** (e.g. Mon–Wed train, Thu–Fri test) AND a stratified split variant. Never leak.
- Normalise IPs; parse `Timestamp` (format `d/M/yyyy H:mm`, ambiguous AM/PM — assume 24h-ish heuristic: hours 1–7 are PM → add 12; document this).

### 2.4 Labels (15) → canonical attack taxonomy + MITRE mapping (store in DB table `attack_taxonomy`)
| Label | Category | MITRE ATT&CK |
|---|---|---|
| BENIGN | benign | — |
| DoS Hulk / GoldenEye / slowloris / Slowhttptest | dos | T1499 / T1498 |
| DDoS | ddos | T1498 |
| PortScan | recon | T1046 |
| FTP-Patator / SSH-Patator | brute_force | T1110 |
| Bot | botnet | T1071 / T1583 |
| Web Attack - Brute Force | web | T1110, T1190 |
| Web Attack - XSS | web | T1189 / T1190 |
| Web Attack - Sql Injection | web | T1190 |
| Infiltration | infiltration | T1105, T1046 |
| Heartbleed | exploit | T1190 |

### 2.5 Environment facts (use in seed/asset DB)
- Attacker: `172.16.0.1` (Kali, NAT'd), Win8.1/Vista/Win7/Mac attackers external.
- Victim network `192.168.10.0/24`: Web server `192.168.10.50` (public `205.174.165.68`), Ubuntu 16 `192.168.10.50/51`, Ubuntu 14.4 `192.168.10.19`, Win clients `192.168.10.5/8/9/14/15`, DNS/DC `192.168.10.3`, Firewall `205.174.165.80`.
- Build an `assets` table from these with criticality (Web server=high, DC=critical, clients=medium).

### 2.6 Replay engine (replaces real-time capture)
- Service `ReplayService`: loads CSVs → sorted by Timestamp → emits flow records into Redis stream `flows.raw` at configurable speed (1x, 10x, 100x, "burst").
- API controls: start / pause / resume / stop / set speed / jump to day / seek to attack window / "inject attack: <label>" (picks N random rows of that label).
- Each flow = one "network event". Also create synthetic enrichment events so every source in the diagram has data: firewall logs (derive allow/deny from flow), IDS alerts (derive Suricata-style alerts from label), host logs (synthetic auth/system lines for Patator/Infiltration), threat intel (static IOC list incl. 172.16.0.1 and the public IPs).
- Emit progress via WebSocket (`/ws/replay`).
- Cache preprocessed parquet files in `/data/processed/`.

---

## 3. ML DETECTION LAYER

- Models trained by script `ml/train.py` (+ notebook):
  1. Binary classifier (benign vs attack) — LightGBM/XGBoost.
  2. Multiclass classifier (15 labels).
  3. Unsupervised anomaly model (Isolation Forest + autoencoder) trained on BENIGN only → anomaly score.
- Save: `model.joblib`, `scaler.joblib`, `feature_list.json`, `metrics.json` (accuracy, precision, recall, F1 per class, macro-F1, ROC-AUC, confusion matrix, FPR).
- Inference API returns: `{label, attack_score, anomaly_score, confidence, top_features (SHAP top-10 with signed values), model_version}`.
- Threshold configurable in Administration → Detection settings.
- SHAP explanations stored per alert (JSON) for the XAI panel.
- Expose `/api/models` (versions, metrics, confusion matrix, feature importance) for the UI.

---

## 4. AGENTS (LangGraph) — implement ALL 15 workflow steps

Shared state `IncidentState` (Pydantic): `flow_id, alert_id, raw_features, detection, is_suspicious, diagnosis, reasoning, retrieved_context[], triage{risk_score, priority}, plans[], selected_plan, approval{status, reviewer, comment}, execution{actions[], mode}, verification{result, metrics_before, metrics_after}, success, attempts, escalation, lessons, trace[]`.

| # | Agent | Input → Output | Implementation notes |
|---|---|---|---|
| 1 | Network Data Sources | replay streams | Flow, firewall, IDS, host, TI feeds |
| 2 | **Monitoring Agent** | `flows.raw` → normalised + feature vector → `flows.norm` | Continuous consumer; maintains sliding window stats (flows/sec, bytes/sec, top talkers); updates live dashboard |
| 3 | **Detection Agent** | feature vector → score/label/confidence | Calls ML models + SHAP; creates `alert` row when above threshold |
| 4 | Decision: suspicious? | conditional edge | No → `No Action / Continue Monitoring` (log counter only); Yes → Diagnosis |
| 5 | **Diagnosis Agent** | alert → initial summary | Gather affected asset (from `assets`), src/dst, ports, protocol, related flows in ±5 min window, repeated-source count, TI hits, firewall/IDS correlation. Output structured summary + timeline |
| 6 | **Reasoning Agent (LLM)** | diagnosis summary + retrieved context → hypotheses | Prompt template (store in `/prompts`), JSON output: `{attack_type, intent, hypotheses[{text, confidence}], kill_chain_stage, reasoning}`. Runs **in parallel** with step 7 |
| 7 | **Knowledge Retrieval Agent (RAG)** | query embedding → top-k chunks | pgvector search over: KB docs, TI feeds, MITRE ATT&CK/CVE/advisories, past incidents. Returns chunks with source + similarity. Feeds 6, 8, 9, 12 (dashed knowledge flow) |
| 8 | **Triage / Prioritization Agent** | diag + reasoning + RAG → risk score, P1/P2/P3 | Formula (configurable): `risk = 0.30*severity + 0.25*asset_criticality + 0.20*impact + 0.15*TI_match + 0.10*model_confidence` (all 0–1) → ×100. P1 ≥ 75, P2 ≥ 45, else P3. Store each component for UI breakdown |
| 9 | **Response Planning Agent** | all above → 2–4 plans | Each plan: `{name, type(containment/mitigation/eradication), actions[], est_impact, est_effort, expected_effectiveness, risks, rollback}`; recommends best |
| 10 | **Human Approval Agent (HITL)** | plan → pause graph (LangGraph `interrupt`) | Writes `approvals` row (pending). Resumes on analyst Approve / Modify / Reject via API. Reject → back to step 9 with feedback |
| 11 | **Response Execution Agent** | approved plan → actions | **Simulation mode default** (simulated block IP, isolate host, firewall rule update, rate-limit, reset creds). Each action logged with command preview, status, timestamps. Flag `SIMULATION_MODE=true` hard default |
| 12 | **Verification Agent** | post-action monitoring | Replay next N seconds/rows of dataset after action; compare pre/post metrics (flows from offending IP, alert rate, anomaly score). Result: `eliminated / contained / persists` |
| 13 | Decision: success? | conditional | Yes → 15; No → 14 |
| 14 | **Adapt & Escalate** | failed verification | Try alternative plan (loop to 9, max 3 attempts), then escalate to SOC (creates Case, notification, priority bump) |
| 15 | **Learning & Knowledge Storage Agent** | incident summary → DB + vector store | Store timeline, actions, outcome, lessons; embed & upsert to `incident_embeddings`; update analyst feedback stats; optional threshold-tuning suggestion |

Requirements:
- Every agent step writes a row in `agent_runs` / `agent_trace_events` (input, output, duration, tokens, model, status) → powers the UI **Agent Trace / Workflow** view.
- All agents must work **without an LLM key** via mock outputs (templated from label + MITRE table).
- Deduplicate/aggregate: do **not** run the full graph per flow. Group alerts by `(src_ip, dst_ip, label, 60s window)` into one **incident**; run the graph per incident. Benign flows only update counters.
- Add concurrency limit + rate limit on LLM calls.

---

## 5. DATABASE (PostgreSQL 16 + pgvector) — full schema

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ===== AUTH / ADMIN =====
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','analyst','viewer')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_login TIMESTAMPTZ
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT, entity_id TEXT,
  details JSONB,
  ip INET,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ===== REFERENCE =====
CREATE TABLE attack_taxonomy (
  label TEXT PRIMARY KEY,                 -- e.g. 'DoS Hulk'
  category TEXT NOT NULL,
  default_severity TEXT NOT NULL CHECK (default_severity IN ('low','medium','high','critical')),
  mitre_tactic TEXT, mitre_technique_ids TEXT[],
  description TEXT
);

CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip INET UNIQUE NOT NULL,
  hostname TEXT, os TEXT, role TEXT,      -- web_server, dc, client, firewall
  criticality SMALLINT CHECK (criticality BETWEEN 1 AND 5),
  owner TEXT, tags TEXT[],
  is_internal BOOLEAN DEFAULT TRUE
);

-- ===== DATASET / REPLAY =====
CREATE TABLE datasets (
  id SERIAL PRIMARY KEY, name TEXT, source_file TEXT, day TEXT,
  row_count BIGINT, attack_count BIGINT, loaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE replay_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id INT REFERENCES datasets(id),
  status TEXT CHECK (status IN ('idle','running','paused','stopped','finished')),
  speed NUMERIC DEFAULT 1,
  cursor_row BIGINT DEFAULT 0,
  started_by UUID REFERENCES users(id),
  started_at TIMESTAMPTZ DEFAULT now(), ended_at TIMESTAMPTZ
);

-- ===== FLOWS (partition by day; keep only recent/interesting rows in DB) =====
CREATE TABLE flows (
  id BIGSERIAL,
  session_id UUID REFERENCES replay_sessions(id),
  flow_key TEXT,                          -- CIC 'Flow ID'
  ts TIMESTAMPTZ NOT NULL,
  src_ip INET, src_port INT, dst_ip INET, dst_port INT, protocol SMALLINT,
  duration_us BIGINT,
  fwd_pkts INT, bwd_pkts INT, fwd_bytes BIGINT, bwd_bytes BIGINT,
  features JSONB NOT NULL,                -- full ~78 numeric features
  true_label TEXT,                        -- ground truth (hidden from agents; used for evaluation only)
  pred_label TEXT, attack_score REAL, anomaly_score REAL, confidence REAL,
  alert_id UUID,
  PRIMARY KEY (id, ts)
) PARTITION BY RANGE (ts);
CREATE INDEX ON flows (src_ip); CREATE INDEX ON flows (dst_ip); CREATE INDEX ON flows (pred_label);
CREATE INDEX ON flows (ts DESC);

CREATE TABLE traffic_aggregates (         -- 1-minute rollups for dashboards
  bucket TIMESTAMPTZ, session_id UUID,
  flows INT, bytes BIGINT, packets BIGINT, alerts INT, benign INT, attacks INT,
  PRIMARY KEY (bucket, session_id)
);

-- ===== ENRICHMENT SOURCES =====
CREATE TABLE firewall_logs (
  id BIGSERIAL PRIMARY KEY, ts TIMESTAMPTZ, action TEXT, src_ip INET, dst_ip INET,
  dst_port INT, protocol TEXT, rule TEXT, raw TEXT
);
CREATE TABLE host_logs (
  id BIGSERIAL PRIMARY KEY, ts TIMESTAMPTZ, host_ip INET, source TEXT, severity TEXT, message TEXT, raw JSONB
);
CREATE TABLE threat_intel_iocs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ioc_type TEXT CHECK (ioc_type IN ('ip','domain','hash','url')),
  value TEXT NOT NULL, reputation SMALLINT, tags TEXT[], source TEXT,
  first_seen TIMESTAMPTZ, last_seen TIMESTAMPTZ,
  UNIQUE (ioc_type, value)
);

-- ===== DETECTION CONTENT (powers the "Detections" page like Security Onion) =====
CREATE TABLE detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id BIGINT UNIQUE NOT NULL,                 -- e.g. 2061171
  title TEXT NOT NULL,                              -- 'ET EXPLOIT_KIT ZPHP Domain in TLS SNI (fjs95 .shop)'
  summary TEXT,                                     -- AI-generated summary (flask icon in UI)
  detection_type TEXT CHECK (detection_type IN ('suricata','sigma','yara','ml_model','custom')),
  severity TEXT CHECK (severity IN ('informational','low','medium','high','critical')),
  ruleset TEXT,                                     -- 'ETOPEN'
  license TEXT, author TEXT,
  is_enabled BOOLEAN DEFAULT TRUE,
  logic TEXT NOT NULL,                              -- rule body, shown in Detection Logic block
  logic_source TEXT,                                -- raw rule text for 'Detection Source' tab
  references_urls TEXT[],
  mitre_technique_ids TEXT[],
  attack_labels TEXT[],                             -- CIC labels this rule maps to
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE detection_notes   (id BIGSERIAL PRIMARY KEY, detection_id UUID REFERENCES detections ON DELETE CASCADE, user_id UUID REFERENCES users, body TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE detection_tunings (id BIGSERIAL PRIMARY KEY, detection_id UUID REFERENCES detections ON DELETE CASCADE, tuning_type TEXT CHECK (tuning_type IN ('suppress','threshold','modify','disable')), config JSONB, created_by UUID REFERENCES users, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE detection_history (id BIGSERIAL PRIMARY KEY, detection_id UUID REFERENCES detections ON DELETE CASCADE, user_id UUID REFERENCES users, change_type TEXT, diff JSONB, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE playbooks (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT, description TEXT, steps JSONB, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE detection_playbooks (detection_id UUID REFERENCES detections ON DELETE CASCADE, playbook_id UUID REFERENCES playbooks ON DELETE CASCADE, PRIMARY KEY (detection_id, playbook_id));

CREATE TABLE ml_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT, kind TEXT CHECK (kind IN ('binary','multiclass','anomaly')),
  version TEXT, artifact_path TEXT, trained_at TIMESTAMPTZ,
  metrics JSONB, feature_importance JSONB, confusion_matrix JSONB,
  is_active BOOLEAN DEFAULT FALSE
);

-- ===== ALERTS / INCIDENTS =====
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts TIMESTAMPTZ NOT NULL,
  detection_id UUID REFERENCES detections(id),
  model_id UUID REFERENCES ml_models(id),
  flow_id BIGINT, flow_ts TIMESTAMPTZ,
  src_ip INET, src_port INT, dst_ip INET, dst_port INT, protocol TEXT,
  predicted_label TEXT, category TEXT,
  severity TEXT, score REAL, confidence REAL,
  shap JSONB,                                       -- top features with signed contributions
  status TEXT DEFAULT 'new' CHECK (status IN ('new','acknowledged','investigating','escalated','resolved','false_positive')),
  assignee UUID REFERENCES users(id),
  incident_id UUID,
  is_true_positive BOOLEAN,                         -- derived by comparing with ground-truth label (for evaluation)
  raw JSONB
);
CREATE INDEX ON alerts (ts DESC); CREATE INDEX ON alerts (status); CREATE INDEX ON alerts (severity); CREATE INDEX ON alerts (src_ip);

CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_no SERIAL UNIQUE,
  title TEXT, attack_type TEXT, mitre_technique_ids TEXT[],
  src_ips INET[], dst_ips INET[],
  first_seen TIMESTAMPTZ, last_seen TIMESTAMPTZ, alert_count INT DEFAULT 0,
  risk_score NUMERIC(5,2), priority TEXT CHECK (priority IN ('P1','P2','P3')),
  risk_breakdown JSONB,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','awaiting_approval','executing','verifying','contained','resolved','escalated','closed')),
  workflow_step SMALLINT,                           -- 1..15, drives pipeline visual
  case_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE alerts ADD CONSTRAINT fk_alert_incident FOREIGN KEY (incident_id) REFERENCES incidents(id);

-- ===== AGENT TRACE =====
CREATE TABLE agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
  graph_thread_id TEXT, status TEXT, attempts SMALLINT DEFAULT 1,
  started_at TIMESTAMPTZ DEFAULT now(), ended_at TIMESTAMPTZ
);
CREATE TABLE agent_trace_events (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID REFERENCES agent_runs(id) ON DELETE CASCADE,
  step_no SMALLINT, agent_name TEXT,
  input JSONB, output JSONB,
  status TEXT CHECK (status IN ('pending','running','success','failed','skipped','waiting_human')),
  model TEXT, prompt_tokens INT, completion_tokens INT, latency_ms INT,
  error TEXT, created_at TIMESTAMPTZ DEFAULT now()
);

-- ===== DIAGNOSIS / REASONING / TRIAGE / PLANS =====
CREATE TABLE diagnoses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), incident_id UUID REFERENCES incidents ON DELETE CASCADE,
  summary TEXT, affected_assets JSONB, timeline JSONB, related_flow_ids BIGINT[], correlations JSONB, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE reasonings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), incident_id UUID REFERENCES incidents ON DELETE CASCADE,
  attack_type TEXT, intent TEXT, kill_chain_stage TEXT,
  hypotheses JSONB, explanation TEXT, llm_model TEXT, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE response_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), incident_id UUID REFERENCES incidents ON DELETE CASCADE,
  attempt SMALLINT DEFAULT 1, name TEXT,
  plan_type TEXT CHECK (plan_type IN ('containment','mitigation','eradication')),
  actions JSONB, est_impact TEXT, est_effort TEXT, expected_effectiveness NUMERIC(4,2),
  risks TEXT, rollback TEXT, is_recommended BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'proposed' CHECK (status IN ('proposed','approved','rejected','modified','executed','failed')),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID REFERENCES incidents ON DELETE CASCADE, plan_id UUID REFERENCES response_plans,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','modified','rejected','expired')),
  reviewer UUID REFERENCES users, comment TEXT, modified_actions JSONB,
  requested_at TIMESTAMPTZ DEFAULT now(), decided_at TIMESTAMPTZ
);
CREATE TABLE executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), incident_id UUID REFERENCES incidents ON DELETE CASCADE, plan_id UUID REFERENCES response_plans,
  mode TEXT CHECK (mode IN ('simulation','live')) DEFAULT 'simulation',
  action_type TEXT,                                 -- block_ip, isolate_host, update_fw_rule, rate_limit, reset_creds
  target TEXT, command_preview TEXT,
  status TEXT CHECK (status IN ('queued','running','success','failed','rolled_back')),
  result JSONB, started_at TIMESTAMPTZ, ended_at TIMESTAMPTZ
);
CREATE TABLE verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), incident_id UUID REFERENCES incidents ON DELETE CASCADE, execution_id UUID REFERENCES executions,
  result TEXT CHECK (result IN ('eliminated','contained','persists')),
  metrics_before JSONB, metrics_after JSONB, notes TEXT, created_at TIMESTAMPTZ DEFAULT now()
);

-- ===== CASES (analyst workspace) =====
CREATE TABLE cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), case_no SERIAL UNIQUE,
  title TEXT, description TEXT, severity TEXT, status TEXT DEFAULT 'open',
  assignee UUID REFERENCES users, created_by UUID REFERENCES users,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), closed_at TIMESTAMPTZ
);
ALTER TABLE incidents ADD CONSTRAINT fk_incident_case FOREIGN KEY (case_id) REFERENCES cases(id);
CREATE TABLE case_events (id BIGSERIAL PRIMARY KEY, case_id UUID REFERENCES cases ON DELETE CASCADE, event_type TEXT, body TEXT, user_id UUID REFERENCES users, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE case_observables (id BIGSERIAL PRIMARY KEY, case_id UUID REFERENCES cases ON DELETE CASCADE, type TEXT, value TEXT, tags TEXT[]);
CREATE TABLE case_attachments (id BIGSERIAL PRIMARY KEY, case_id UUID REFERENCES cases ON DELETE CASCADE, filename TEXT, path TEXT, uploaded_by UUID REFERENCES users, created_at TIMESTAMPTZ DEFAULT now());

-- ===== HUNT =====
CREATE TABLE saved_hunts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT, query JSONB, created_by UUID REFERENCES users, created_at TIMESTAMPTZ DEFAULT now());

-- ===== KNOWLEDGE / RAG =====
CREATE TABLE knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT CHECK (kind IN ('policy','guideline','best_practice','mitre','cve','advisory','threat_intel','incident','playbook')),
  title TEXT, source TEXT, url TEXT, body TEXT, metadata JSONB, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE knowledge_chunks (
  id BIGSERIAL PRIMARY KEY, document_id UUID REFERENCES knowledge_documents ON DELETE CASCADE,
  chunk_index INT, content TEXT, embedding vector(384), metadata JSONB
);
CREATE INDEX ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE incident_embeddings (
  incident_id UUID PRIMARY KEY REFERENCES incidents ON DELETE CASCADE,
  summary TEXT, lessons TEXT, outcome TEXT, embedding vector(384), created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON incident_embeddings USING hnsw (embedding vector_cosine_ops);

CREATE TABLE analyst_feedback (
  id BIGSERIAL PRIMARY KEY, alert_id UUID REFERENCES alerts, incident_id UUID REFERENCES incidents,
  user_id UUID REFERENCES users, verdict TEXT CHECK (verdict IN ('true_positive','false_positive','needs_tuning')), comment TEXT, created_at TIMESTAMPTZ DEFAULT now()
);

-- ===== NOTIFICATIONS =====
CREATE TABLE notifications (id BIGSERIAL PRIMARY KEY, user_id UUID REFERENCES users, type TEXT, title TEXT, body TEXT, link TEXT, is_read BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT now());
```

- Provide **Alembic migrations** + `seed.py` that inserts: 3 users (admin/analyst/viewer), taxonomy, assets (§2.5), 30+ realistic detections (incl. the exact Suricata one in §7.5), 20+ playbooks/KB docs (MITRE techniques for all mapped IDs, CIS-style hardening guidelines, firewall policy docs, 15 sample "resolved incidents" with embeddings), TI IOCs.
- Evaluation view/materialised view: `v_detection_quality` comparing `alerts.predicted_label` vs `flows.true_label` → TP/FP/FN/precision/recall per class (never expose true_label to agents).

---

## 6. BACKEND API (FastAPI) — all routes under `/api/v1`, JWT auth (access + refresh), RBAC, OpenAPI docs at `/docs`

**Auth:** `POST /auth/login`, `/auth/refresh`, `GET /auth/me`

**Replay:** `POST /replay/start|pause|resume|stop`, `PUT /replay/speed`, `POST /replay/seek`, `POST /replay/inject`, `GET /replay/status`, `GET /datasets`, WS `/ws/replay`

**Live feed:** WS `/ws/events` (new alerts, incident updates, agent step updates, approval requests, notifications), SSE `/stream/alerts`

**Overview/Dashboards:** `GET /overview/summary` (counters: flows, alerts by severity, open incidents, pending approvals, MTTD, MTTR, FPR), `GET /overview/timeseries?range=&bucket=`, `GET /dashboards/{name}` (`traffic`, `attacks`, `top-talkers`, `protocols`, `ml-performance`, `agents`)

**Alerts:** `GET /alerts` (filters: severity, status, label, src/dst ip, time range, text q, sort, page), `GET /alerts/{id}`, `PATCH /alerts/{id}` (status/assignee), `POST /alerts/{id}/feedback`, `POST /alerts/bulk`, `POST /alerts/{id}/escalate-to-case`, `GET /alerts/{id}/explain` (SHAP)

**Incidents / agents:** `GET /incidents`, `GET /incidents/{id}` (full bundle: diagnosis, reasoning, rag, triage, plans, approval, executions, verification), `GET /incidents/{id}/trace`, `POST /incidents/{id}/rerun`, `POST /incidents/{id}/rerun/{step}`

**Approvals:** `GET /approvals?status=pending`, `POST /approvals/{id}/approve|reject|modify`

**Detections:** `GET /detections` (filters: type, ruleset, severity, enabled, q), `POST /detections`, `GET/PUT/DELETE /detections/{id}`, `POST /detections/{id}/duplicate`, `PATCH /detections/{id}/status` (enable toggle), `GET/POST /detections/{id}/notes`, `GET/POST /detections/{id}/tunings`, `GET /detections/{id}/playbooks`, `GET /detections/{id}/history`, `POST /detections/{id}/generate-summary` (LLM)

**Cases:** CRUD + events + observables + attachments

**Hunt:** `POST /hunt/query` (structured filter DSL + free text on flows/alerts; group-by, aggregation), saved hunts CRUD

**PCAP/Flow explorer:** `GET /flows`, `GET /flows/{id}` (all ~78 features), `GET /flows/{id}/related`, `GET /flows/export.csv`

**Onion AI (chat):** `POST /chat` (SSE streaming; tools: search_alerts, get_incident, query_flows, search_kb, explain_alert, propose_response), `GET /chat/sessions`

**Grid (system health):** `GET /grid` (agents status, queue lengths, Redis/Postgres health, model versions, replay throughput, LLM latency/token usage)

**Models:** `GET /models`, `POST /models/{id}/activate`, `POST /models/retrain` (async)

**Knowledge:** `GET/POST /knowledge/documents`, `POST /knowledge/search`, `POST /knowledge/reindex`

**Admin:** users CRUD, settings (thresholds, risk weights, simulation mode, LLM provider, replay defaults), audit log, API keys

**Downloads:** `GET /downloads` list (report PDFs, CSV exports, model cards), `POST /reports/incident/{id}` (PDF/HTML report generator)

Standards: Pydantic schemas for every request/response, pagination `{items,total,page,page_size}`, consistent error format, CORS, structured logging, rate limiting, unit tests (pytest) for preprocessing, scoring formula, API, graph transitions.

---

## 7. FRONTEND — SECURITY ONION STYLE (REPLICATE THE REFERENCE SCREENSHOT PRECISELY)

### 7.1 Design tokens (dark theme; define as CSS variables in `styles/tokens.css` under `:root`; all components consume `var(--token)`; no Tailwind)
- `--bg-app: #0d1117` (page), `--bg-topbar: #000000`, `--bg-sidebar: #0f1722`, `--bg-card: #172033` (navy cards, ~`#1a2234`), `--bg-card-header: #2a3447` (grey-blue panel headers like "Operations"/"Details"), `--border: #26334a`
- Text: primary `#e6edf3`, secondary `#9aa7b8`, link `#4aa3ff` (underlined), muted `#6b7a90`
- Accent primary (buttons, toggles): `#0a84d6` / hover `#2196f3`; danger/Delete button: grey `#6b7280` (disabled-looking) with red on hover; success `#3fb950`; warning `#d29922`; critical `#f85149`
- Severity chips: informational `#58a6ff`, low `#8b949e`→ show "Low" plain, medium `#d29922`, high `#f0883e`, critical `#f85149`
- Code/rule colors (Detection Logic): keywords/protocol (`tls`, `flow`, `bsize`) in lilac `#c9a0ff`; arrow `->` cyan/teal `#4ec9b0`; variables (`$HOME_NET`, `$EXTERNAL_NET`, `any`) lilac; string values in green `#7ee787`; `fast_pattern` in salmon/red `#ff7b72`
- Font: **Inter** (UI), **JetBrains Mono** (rule/code). Base 14px; page title 22px/600; card heading 18px/700; labels 13px/700; values 13px/400.
- Radius 6–8px on cards; no heavy shadows; 1px borders.
- Fully responsive (sidebar collapses to icons < 1024px, hamburger at top-left toggles).

### 7.2 Global layout
- **Top bar** (height 54px, pure black): left = hamburger icon (toggle sidebar) + logo block ("Agentic NIDS" wordmark with a small onion/shield glyph, thin white text) + vertical divider + **current page title in bold** (e.g. "Detection"). Right = notification bell (badge w/ pending approvals), replay mini-controls (▶/⏸ + speed select + status dot), user avatar dropdown (profile, theme, logout).
- **Left sidebar** (width 172px, collapsible to 56px), background `--bg-sidebar`, items with icon + label, 14px, active item = lighter bg + left accent bar. Order and icons EXACTLY:
  1. Overview (home) 2. **Onion AI** → rename "Agent AI" (cpu icon) 3. Alerts (bell) 4. Dashboards (pie) 5. Hunt (crosshair) 6. Cases (briefcase) 7. Detections (search) 8. PCAP → rename "Flows" (list icon) 9. Grid (network/nodes icon) 10. Downloads (download) 11. Administration (wrench/tools)
  - **Add two extra items** (keep style): **Workflow** (git-branch icon, the 15-step live pipeline) and **Approvals** (check-circle icon with pending count badge), placed after Alerts.
  - Divider, then small grey section label **"Tools"** with external-link-icon items: Kibana → "Grafana/Metrics", Elastic Fleet → "Agent Fleet", Osquery Manager → "Asset Inventory", InfluxDB → "Replay Stats", CyberChef → "CyberChef" (link out to public instance), Navigator → "ATT&CK Navigator" (link out). Each opens in new tab.
- **Footer bar** (fixed bottom, black, 12px): left `Version: 1.0.0`; center `© 2026 Agentic NIDS` with the project name in link blue; right `License: MIT` in link blue.
- **Content area**: padding 24px; max width fluid; cards separated by 16px.
- Global features: toast notifications, loading skeletons, empty states, error boundaries, keyboard shortcuts (`g a` → alerts, `/` → search), live-updating badges via WebSocket, dark theme default (+ optional light toggle).

### 7.3 Page: Overview
- Row of 6 KPI cards: Flows processed, Alerts (24h) w/ severity mini-bar, Open incidents, Pending approvals, MTTD, MTTR; each with sparkline + delta.
- Live area chart: flows/sec & alerts/sec (rolling 5 min), attack-vs-benign stacked.
- Donut: attack category distribution. Bar: top 10 source IPs. Table: latest 10 alerts (click → alert detail). Card: replay status (day, progress bar, speed, current dataset timestamp).
- Card "Agent pipeline health": the 15 steps as small status pills (green/amber/red) with counts.

### 7.4 Page: Alerts
- Toolbar: search box (supports `src:172.16.0.1 label:"DoS Hulk" sev:high`), time-range picker, severity multi-select, status multi-select, label multi-select, group-by dropdown (label / src_ip / dst_ip / incident), auto-refresh toggle, export CSV.
- Table (virtualised): checkbox, Time, Severity chip, Label, Src IP:port → Dst IP:port, Proto, Score bar, Confidence %, Incident #, Status, Assignee. Row expand → quick view. Bulk actions: acknowledge, assign, escalate to case, mark false positive.
- **Alert detail drawer/page** with tabs: Overview, **Explainability** (SHAP waterfall + top-10 feature bar chart + plain-English explanation), Raw flow features (searchable key/value table of all ~78 features), Related flows, Incident link, History.

### 7.5 Page: Detections — LIST + DETAIL (**copy the screenshot exactly**)
**List view:** filter bar (type, ruleset, severity, enabled), searchable table: Public Id, Title, Type, Severity, Ruleset, Enabled toggle, Updated. "New detection" button.

**Detail view layout** (two-column: main ≈ 75%, right rail ≈ 25%):
- Title (22px bold white): `ET EXPLOIT_KIT ZPHP Domain in TLS SNI (fjs95 .shop)`
- **Tab bar** directly under title with icons: `OVERVIEW` (paper-plane icon, active = lighter bg + white 2px bottom border) · `OPERATIONAL NOTES` (paperclip) · `DETECTION SOURCE` (`</>`) · `TUNING (0)` (wrench, count badge) · `PLAYBOOKS (1)` (book/list icon, count) · `HISTORY` (clock-rewind). Uppercase 12px, letter-spaced.
- **Main card** (navy `--bg-card`, 8px radius, padding 16px):
  - **Summary** heading with small flask/beaker icon (indicates AI-generated) → paragraph: "This rule detects attempts to establish a TLS connection from an internal network to the domain "fjs95.shop" found in the Server Name Indication (SNI) field of the TLS handshake. The activity is indicative of exploit kit behavior, which may involve compromised websites being used as part of a drive-by compromise attack. This type of threat typically seeks to exploit vulnerabilities in client endpoints, potentially leading to unauthorized access or download of malicious content."
  - **References** heading → blue underlined link: `www.proofpoint.com/us/blog/threat-insight/are-you-sure-your-browser-date-current-landscape-fake-browser-updates`
  - **Detection Logic** heading → monospace block, one option per line with generous line spacing (~36px), colored per §7.1:
    ```
    tls $HOME_NET any -> $EXTERNAL_NET any
    flow:established,to_server
    tls.sni
    bsize:10
    content:"fjs95.shop"
    fast_pattern
    ```
    (Render by parsing the rule into tokens — don't show raw `alert tls ... (msg:...; sid:...)` here; the full raw rule goes in the DETECTION SOURCE tab.)
- **Right rail card 1 "Operations"** (header bar `--bg-card-header`, bold): label `Status: Enabled` (bold) + blue **toggle switch** (on); below two buttons side by side: **DUPLICATE** (solid blue `#0a84d6`, white uppercase) and **DELETE** (grey `#6b7280`, white uppercase).
- **Right rail card 2 "Details"**: vertical list, each = bold label (13px) over value (regular):
  `Public Id:` 2061171 · `Type:` Suricata · `Severity:` Low · `Ruleset:` ETOPEN · `License:` BSD · `Created:` 2025-03-27 · `Updated:` 2025-03-27 · `Author:` ETOPEN
- Other tabs: **Operational Notes** (markdown notes list + add note editor), **Detection Source** (Monaco read-only/editable raw rule with syntax highlight + Save/Validate), **Tuning** (list/add suppress / threshold / modify; count badge), **Playbooks** (linked playbooks with steps), **History** (timeline of changes with diff viewer).
- For `ml_model` type detections, Details shows model name/version/F1 and Detection Logic shows the feature-threshold/SHAP summary instead of a Suricata rule.

### 7.6 Page: Workflow (**live visual of the architecture diagram**)
- React Flow canvas reproducing all 15 steps as colour-coded nodes (same colours as the architecture image: green=monitoring/response planning, purple=detection/verification, yellow=diagnosis, blue=reasoning/execution, pink=RAG, teal=triage, orange=human approval, red=adapt/escalate) with 2 decision diamonds (Is activity suspicious? / Was response successful?).
- Edge styles: green = normal flow, red = suspicious/issue, blue = agent flow, **purple dashed = knowledge flow** (RAG ↔ reasoning/triage/planning/verification, and Knowledge & Data Stores box), black dashed = data flow.
- Include "Knowledge & Data Stores" group box (KB, TI Feeds, MITRE/CVE, Vector DB, Incident DB) and "Outputs / Benefits" strip with live metrics.
- Selecting an **incident** (dropdown / click from alerts) animates its path; each node shows status (pending/running/success/failed/waiting-human), duration, and on click opens a side panel with the agent's input, output (JSON pretty), prompt used, tokens, latency.
- Legend panel bottom-left (same as diagram). Mini-map, zoom, "replay trace" button.

### 7.7 Page: Incident detail (opened from Alerts/Workflow/Cases)
- Header: incident #, title, priority chip (P1 red / P2 orange / P3 blue), risk score gauge, status stepper (the 15 steps compressed to 8 phases).
- Sections (cards): **Diagnosis** (summary, affected assets, timeline), **Reasoning** (hypotheses with confidence bars, kill-chain stage, intent), **Retrieved Knowledge** (chunks with source badge + similarity %), **Triage** (risk score breakdown stacked bar for 5 factors), **Response Plans** (2–4 plan cards, recommended badge, impact/effort/effectiveness, actions list, rollback), **Approval** (see 7.8), **Execution log** (table with command preview + status), **Verification** (before/after charts, result chip), **Learning** (lessons stored), **Agent Trace** (accordion).

### 7.8 Page: Approvals (Human-in-the-loop)
- Queue list (pending first) with priority, incident, recommended plan, age timer.
- Review panel: investigation summary, evidence, hypotheses, recommended actions (editable checklist/inputs for **Modify**), comment box, buttons **Approve** (green), **Modify & Approve** (amber), **Reject** (red, requires reason). Confirmation modal showing simulation-mode banner. Real-time update when new approval arrives (toast + bell badge).

### 7.9 Page: Onion AI / "Agent AI" (chat)
- Left: sessions list. Center: chat with streaming markdown, tool-call chips ("searched alerts…", "retrieved MITRE T1046"), citations to alerts/incidents/KB chunks (clickable), suggested prompts ("Summarise today's P1 incidents", "Why was alert X flagged?", "Show top attackers", "Draft response for incident #12"). Right: context panel (selected incident/alert).
- Uses `/chat` SSE; mock mode works offline.

### 7.10 Page: Dashboards
- Tabs: Traffic, Attacks, Top Talkers, Protocols/Ports, **ML Performance** (confusion matrix heatmap, per-class precision/recall/F1 table, ROC curve, feature importance, live TP/FP using ground truth), **Agents** (per-agent latency, success rate, token usage, queue depth), **Response** (actions by type, approval rate, verification outcomes, MTTD/MTTR).
- Global time range + auto-refresh; each chart has export PNG/CSV.

### 7.11 Page: Hunt
- Query builder (field / operator / value rows, AND/OR groups) + raw query input; target = flows or alerts; results table with column picker; group-by aggregations (count by src_ip, dst_port, label); histogram above results; save hunt; "Send to Case"; pivot actions on any IP/port (right-click menu: filter for / filter out / open in TI / add to case).

### 7.12 Page: Cases
- Kanban (New / In progress / Awaiting approval / Closed) + table toggle. Case detail: description, severity, assignee, linked incidents/alerts, timeline of events, observables (IPs, ports) with TI enrichment badge, attachments, comments, "Generate report".

### 7.13 Page: Flows (PCAP replacement)
- Flow table (virtualised), filters, detail drawer with all features grouped (Basic, Packet length stats, IAT, Flags, Bulk, Subflow, Active/Idle), mini charts, "Download CSV of selection". Show note: "Flow-level data from CIC-IDS-2017 — raw PCAP not loaded".

### 7.14 Page: Grid
- Cards for each service/agent: status dot, uptime, last heartbeat, queue depth, throughput, errors; model registry table; LLM usage; replay engine stats; resource gauges.

### 7.15 Page: Downloads
- Table of generated reports, exports, model artefacts, trained-model cards; download buttons; "Generate incident report" action.

### 7.16 Page: Administration
- Tabs: Users & Roles, **Detection Settings** (thresholds, model selection, binary vs multiclass), **Triage Settings** (risk weights sliders that must sum to 1 + P1/P2 cutoffs), **Response Settings** (SIMULATION MODE toggle — locked on by default with warning, allowed action types, auto-approve rules for P3 optional), **LLM Settings** (provider, model, temperature, key status), **Replay Settings**, **Knowledge Base** (upload docs, reindex), **Audit Log**, **API Keys**, **About**.

### 7.17 Frontend engineering requirements
- Plain JavaScript (JSX) only, no TypeScript; API client built with axios and one function per endpoint, documented with JSDoc; React Query caching; WebSocket hook with auto-reconnect; Zustand for UI/session state; route guards by role; code-split per page; skeleton loaders; a11y (focus rings, aria labels, keyboard nav); Storybook-style `/ui-kit` page showing tokens, buttons, chips, toggles, cards (to verify design fidelity); Vitest + Playwright smoke tests.

---

## 8. END-TO-END DEMO SCENARIO (must work out of the box)
1. `docker compose up` → seed runs → open UI → login `analyst / analyst123`.
2. Click ▶ on replay (Friday PortScan window or "inject DDoS").
3. Monitoring → Detection → alerts appear live; incident auto-created (grouped).
4. Workflow page animates steps 1→15 for that incident; RAG shows MITRE T1046 / T1498 chunks.
5. Approval request pops up (bell + toast) → analyst approves "Block attacker IP 172.16.0.1 + rate-limit" (simulated).
6. Execution log + verification (replay next window shows attacker flows dropped) → success → Learning stores incident + embedding.
7. Failure path demo: reject once → agent re-plans; and a forced verification failure → Adapt & Escalate creates a Case.
8. Detections page opens the Suricata rule exactly as in the reference screenshot.

---

## 9. REPO STRUCTURE & DELIVERABLES
```
agentic-nids/
├─ docker-compose.yml  .env.example  README.md  ASSUMPTIONS.md
├─ data/ (raw/, processed/)  # user places CIC-IDS-2017 CSVs here
├─ ml/ (train.py, preprocess.py, evaluate.py, notebooks/, artifacts/)
├─ backend/
│  ├─ app/ (main.py, api/, core/, db/, models/, schemas/, services/, agents/, graph/, prompts/, replay/, rag/, tests/)
│  └─ alembic/
├─ worker/
├─ frontend/ (src/{pages,components,features,hooks,api,store,styles,lib}, tests/)
└─ scripts/ (seed.py, download_instructions.md, load_dataset.py, build_kb.py)
```
- Provide: runnable code (no TODO stubs), README with setup + screenshots checklist, `.env.example`, sample trained model fallback (train quickly on a 5% sample if full data absent), unit/integration tests, and a short architecture doc mapping each of the 15 workflow steps → file/class.

## 10. NON-FUNCTIONAL RULES
- Simulation mode ON by default; never execute real network commands.
- Ground-truth `true_label` is used **only** for evaluation dashboards, never fed to detection/agents.
- No secrets in repo; env-based config.
- Handle the full dataset (~2.8M rows) via chunked loading/parquet; UI must stay responsive (pagination, virtualisation, server-side filtering).
- Every agent output is validated with Pydantic; LLM JSON parse failures retry once then fall back to templated output.
- Log all decisions for explainability and audit.

**Final check:** before finishing, verify every page in §7, every table in §5, every route in §6, and every agent in §4 exists and works; list anything not done in `ASSUMPTIONS.md`.
