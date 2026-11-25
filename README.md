# Agentic NIDS

A frontend prototype for an Agentic AI multi-agent network intrusion detection console. It uses a Security Onion-inspired dark SOC layout and ships with realistic in-memory sample data so the main workflows are usable without a backend.

## Run

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal. The production bundle is checked with `npm run build`.

## Included frontend surfaces

- Overview command center with live replay counters, telemetry chart, attack distribution, top talkers, latest alerts, replay status, and 15-step pipeline health.
- Alert queue with search, severity/status indicators, scoring bars, incident links, and live sample alerts.
- 15-step workflow trace with agent states, trace input/output, latency, and replay controls.
- Human approval queue with editable response actions and simulation-mode confirmation.
- Detections detail view with the requested ETOPEN Suricata rule, tabs, AI summary, operations rail, and metadata.
- Agent AI chat with canned tool-call context and suggested investigations.
- ML performance dashboard with confusion matrix, per-class performance, and SHAP feature importance.

The mock replay adds a new alert every few seconds while the replay control is active. Navigation is intentionally client-side so each surface can later be connected to the `/api/v1` provider described in `agentic_nids_build_prompt.md`.