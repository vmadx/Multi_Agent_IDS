# Agentic NIDS

A frontend prototype for an Agentic AI network intrusion detection console. It uses a Security Onion-inspired dark SOC layout and combines sample data with a local FastAPI backend for CSV detection and incident operations.

## Run the application

Start the backend from the repository root in one terminal:

```bash
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Start the frontend from this directory in a second terminal:

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal. The production bundle is checked with `npm run build`.

## Persistence and agent behavior

- Incident records, approvals, and audit entries are stored in the repository-root `incidents.db` SQLite database.
- Uploaded CSVs are temporary and deleted after scanning. Upload job status and progress are held in memory and are lost if the backend restarts.
- The upload API runs the local HALCCon detector and deterministic triage/reasoning functions. Knowledge lookup currently uses a small hardcoded local MITRE mapping.
- Google ADK agents are defined in the repository but are not called by the upload API. The workflow does not automatically learn from decisions or retrain the detector.

## Included frontend surfaces

- Overview command center with live replay counters, telemetry chart, attack distribution, top talkers, latest alerts, replay status, and 15-step pipeline health.
- Alert queue with search, severity/status indicators, scoring bars, incident links, and live sample alerts.
- 15-step workflow trace with agent states, trace input/output, latency, and replay controls.
- Human approval queue with editable response actions and simulation-mode confirmation.
- Detections detail view with the requested ETOPEN Suricata rule, tabs, AI summary, operations rail, and metadata.
- Agent AI chat with canned tool-call context and suggested investigations.
- ML performance dashboard with confusion matrix, per-class performance, and SHAP feature importance.

The mock replay adds a new alert every few seconds while the replay control is active. Some dashboard surfaces still use sample data; CSV uploads and incident operations use the `/api/v1` backend.