# Agentic NIDS

A frontend prototype for an Agentic AI network intrusion detection console. It uses a Security Onion-inspired dark SOC layout and combines sample data with a local FastAPI backend for CSV detection and incident operations.

## Run the application

For full setup, HALCCon model-file requirements, and optional Supabase/Gemini
configuration, see the [project README](../../README.md).

Start the backend from the main project root in one PowerShell terminal:

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Start the frontend from this directory in a second PowerShell terminal:

```powershell
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173/`. Keep the API running at `http://127.0.0.1:8000`;
the frontend uses that API by default. The production bundle is checked with
`npm.cmd run build`.

## Persistence and agent behavior

- Without Supabase configuration, incident records, approvals, and audit entries are stored in the repository-root `incidents.db` SQLite database; upload job status and progress are held in memory.
- With Supabase configured in the backend `.env`, scan jobs, grouped alerts/incidents, decisions, and decision/replanning audit events are persisted in Supabase. Raw CSVs go to a private Storage bucket and are scheduled for deletion after 30 days; cleanup runs at API startup and hourly while it is running, and catches up on the next startup if the API was offline at expiry. Large CSVs use resumable TUS uploads. The local working copy is removed after scanning.
- The upload API runs the local HALCCon detector and deterministic triage/reasoning functions. Knowledge lookup currently uses a small hardcoded local MITRE mapping.
- Google ADK agents are defined in the repository but are not called by the upload API. The workflow does not automatically learn from decisions or retrain the detector.
- Agent AI uses Gemini for responses when configured and conditionally retrieves project context from Supabase. Evidence is shown in the Context sidebar; the raw CSV itself is not sent to Gemini.

## Included frontend surfaces

- Overview command center with live replay counters, telemetry chart, attack distribution, top talkers, latest alerts, replay status, and 15-step pipeline health.
- Alert queue with search, severity/status indicators, scoring bars, incident links, and live sample alerts.
- 15-step workflow trace with agent states, trace input/output, latency, and replay controls.
- Human approval queue with editable response actions and simulation-mode confirmation.
- Detections detail view with the requested ETOPEN Suricata rule, tabs, AI summary, operations rail, and metadata.
- Agent AI chat with conditional Supabase RAG and an evidence Context sidebar.
- ML performance dashboard with confusion matrix, per-class performance, and SHAP feature importance.

The mock replay adds a new alert every few seconds while the replay control is active. Some dashboard surfaces still use sample data; CSV uploads and incident operations use the `/api/v1` backend.