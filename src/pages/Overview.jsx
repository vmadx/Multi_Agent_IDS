import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  Clock3,
  Globe2,
  Pause,
  Play,
  Radar,
  RefreshCw,
  Target,
  Workflow,
  Zap,
} from "lucide-react";
import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { workflow } from "../data/mockData";
import { nidsApi } from "../api/provider";
import {
  KPI,
  MiniChart,
  PanelTitle,
  SectionHeader,
  Status,
} from "../components/ui";

export default function Overview({
  alerts,
  replay,
  setReplay,
  time,
  setActive,
  setAlerts,
  notify,
  scan,
  setScan,
}) {
  const metrics = scan?.metrics;
  const priorityCounts = metrics?.priority_counts || {};

  return (
    <div className="page">
      <SectionHeader
        eyebrow="OPERATIONS / OVERVIEW"
        title="Command center"
        action={
          <div className="header-actions">
            <span className="live-indicator">
              <span className="pulse-dot" /> LIVE REPLAY
            </span>
            <button className="button secondary">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        }
      />
      <UploadPanel
        setAlerts={setAlerts}
        notify={notify}
        scan={scan}
        setScan={setScan}
      />
      <ScanMetrics metrics={metrics} />
      <div className="kpi-grid">
        <KPI
          label="Flows analyzed"
          value={metrics ? metrics.rows_analyzed.toLocaleString() : "—"}
          delta={scan?.filename || "upload a dataset"}
          tone="blue"
          icon={Activity}
        >
          <MiniChart color="#4aa3ff" />
        </KPI>
        <KPI
          label="Threat alerts"
          value={metrics ? metrics.threats.toLocaleString() : "—"}
          delta="model predictions"
          tone="red"
          icon={AlertTriangle}
        >
          <div className="severity-bar">
            <i />
            <i />
            <i />
            <i />
          </div>
        </KPI>
        <KPI
          label="Critical incidents"
          value={metrics ? (priorityCounts.P1 || 0).toLocaleString() : "—"}
          delta="P1"
          tone="orange"
          icon={Radar}
        >
          <MiniChart color="#f0883e" />
        </KPI>
        <KPI
          label="Pending review"
          value={metrics ? metrics.alerts_created.toLocaleString() : "—"}
          delta="human approval"
          tone="yellow"
          icon={CheckCircle2}
        >
          <MiniChart color="#d29922" />
        </KPI>
      </div>
      <div className="dashboard-grid top-grid">
        <LiveTraffic />
        <Distribution alerts={alerts} metrics={metrics} />
        <RankedThreats alerts={alerts} setActive={setActive} />
      </div>
      <div className="dashboard-grid bottom-grid">
        <RecentAlerts alerts={alerts} setActive={setActive} />
        <AgentStatus scan={scan} />
        <UploadSummaryCard scan={scan} />
      </div>
    </div>
  );
}

function UploadPanel({ setAlerts, notify, scan, setScan }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const busy = scan?.status === "uploading"
    || scan?.status === "queued"
    || scan?.status === "processing";

  const upload = async (file) => {
    if (!file || busy) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      notify("Please choose a CSV file.");
      return;
    }
    setScan({
      filename: file.name,
      status: "uploading",
      stage: "upload",
      progress: 0,
      rows_scanned: 0,
      total_rows: 0,
    });
    setAlerts([]);
    try {
      const accepted = await nidsApi.upload(file, (progress) => {
        setScan((current) => ({ ...current, progress }));
      });
      let status = {
        ...accepted,
        filename: file.name,
        status: "queued",
        stage: "queued",
        progress: 0,
      };
      setScan(status);

      while (status.status === "queued" || status.status === "processing") {
        status = await nidsApi.uploadStatus(accepted.job_id);
        setScan(status);
        if (status.status === "queued" || status.status === "processing") {
          await new Promise((resolve) => setTimeout(resolve, 700));
        }
      }

      if (status.status === "failed") {
        throw new Error(status.error || "The scan failed.");
      }
      setAlerts(status.alerts || []);
      notify(
        `Scanned ${status.metrics.rows_analyzed.toLocaleString()} flows · `
        + `${status.metrics.threats.toLocaleString()} threats`,
      );
    } catch (error) {
      setScan((current) => ({ ...current, status: "failed", error: error.message }));
      notify(error.message);
    }
  };

  return (
    <section
      className={`upload-panel ${dragging ? "dragging" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        upload(event.dataTransfer.files?.[0]);
      }}
    >
      <button
        type="button"
        className="upload-dropzone"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        <div className="upload-icon">
          <Upload size={22} />
        </div>
        <div>
          <strong>{busy ? "Processing uploaded traffic..." : "Upload network traffic"}</strong>
          <span>CSV · LITNET-2020 1% class-balanced datasets · full-file inference</span>
        </div>
        <b>{busy ? "Running" : "Choose file"}</b>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        disabled={busy}
        onChange={(event) => {
          upload(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      {scan && (
        <div className={`scan-progress ${scan.stage === "detection" ? "scanning" : ""}`}>
          <div className="scan-progress-heading">
            <b>{scan.message || scan.error || "Preparing scan"}</b>
            <span>{scan.progress || 0}%</span>
          </div>
          <div className="scan-track">
            <i style={{ width: `${scan.progress || 0}%` }} />
            {scan.stage === "detection" && <span className="scan-beam" />}
          </div>
          {scan.stage === "upload" && (
            <small>Uploading {scan.filename} to the local detection service.</small>
          )}
          {scan.stage === "detection" && (
            <small>
              Model scanning {scan.rows_scanned?.toLocaleString() || 0}
              {" / "}{scan.total_rows?.toLocaleString() || "—"} flows
            </small>
          )}
          {scan.stage === "agents" && (
            <small>
              Agent workflow: {scan.agent_processed?.toLocaleString() || 0}
              {" / "}{scan.agent_total?.toLocaleString() || 0} alert groups triaged
            </small>
          )}
          {scan.status === "failed" && (
            <small className="scan-error">{scan.error}</small>
          )}
        </div>
      )}
    </section>
  );
}

function ScanMetrics({ metrics }) {
  if (!metrics) return null;

  const percentage = (value) => (
    value == null ? "N/A" : `${(value * 100).toFixed(2)}%`
  );
  const matrix = metrics.confusion_matrix;

  return (
    <section className="panel model-metrics">
      <PanelTitle
        icon={Activity}
        title="Detection model results"
        meta={`${metrics.rows_analyzed.toLocaleString()} flows · ${metrics.scored_rows.toLocaleString()} labeled`}
      />
      <div className="model-metric-grid">
        {[
          ["Accuracy", percentage(metrics.accuracy)],
          ["Macro precision", percentage(metrics.macro_precision)],
          ["Macro recall", percentage(metrics.macro_recall)],
          ["Macro F1", percentage(metrics.macro_f1)],
          ["Weighted F1", percentage(metrics.weighted_f1)],
          ["Threat predictions", metrics.threats.toLocaleString()],
          ["Incident groups", metrics.incident_groups.toLocaleString()],
          ["Benign predictions", metrics.benign.toLocaleString()],
          ["Unknown labels", metrics.unknown_target_rows.toLocaleString()],
        ].map(([label, value]) => (
          <div className="model-metric" key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      {metrics.per_class.length > 0 && (
        <details className="model-details">
          <summary>Per-class report and confusion matrix</summary>
          <div className="class-report-wrap">
            <table className="class-report">
              <thead>
                <tr><th>Class</th><th>Support</th><th>Precision</th><th>Recall</th><th>F1</th></tr>
              </thead>
              <tbody>
                {metrics.per_class.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>{row.support.toLocaleString()}</td>
                    <td>{percentage(row.precision)}</td>
                    <td>{percentage(row.recall)}</td>
                    <td>{percentage(row.f1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {matrix?.values?.length > 0 && (
            <div className="confusion-wrap">
              <table className="confusion-matrix">
                <thead>
                  <tr>
                    <th>Actual ↓ / Predicted →</th>
                    {matrix.labels.map((label) => <th key={label}>{label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {matrix.values.map((row, index) => (
                    <tr key={matrix.labels[index]}>
                      <th>{matrix.labels[index]}</th>
                      {row.map((count, column) => (
                        <td key={`${index}-${column}`}>{count.toLocaleString()}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </details>
      )}
      {!metrics.scored_rows && (
        <p className="muted model-no-labels">
          No recognized ground-truth label column was found; classification metrics are unavailable.
        </p>
      )}
    </section>
  );
}

function LiveTraffic() {
  return (
    <section className="panel traffic-panel">
      <PanelTitle
        icon={Activity}
        title="Live telemetry"
        meta="rolling 5 minutes"
        action={
          <div className="chart-legend">
            <span>
              <i className="legend-line cyan" /> flows/sec
            </span>
            <span>
              <i className="legend-line orange" /> alerts/sec
            </span>
          </div>
        }
      />
      <div className="hero-chart">
        <div className="y-labels">
          <span>120</span>
          <span>80</span>
          <span>40</span>
          <span>0</span>
        </div>
        <svg viewBox="0 0 640 190" preserveAspectRatio="none">
          <defs>
            <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#2bc7a7" stopOpacity=".3" />
              <stop offset="1" stopColor="#2bc7a7" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            className="gridline"
            d="M0 20H640 M0 70H640 M0 120H640 M0 170H640"
          />
          <path
            d="M0 153 C35 140 42 150 72 120 S112 141 140 98 S180 110 214 77 S250 102 282 85 S320 94 352 49 S390 92 422 62 S462 68 498 38 S548 71 580 32 S610 55 640 20 V190 H0Z"
            fill="url(#area)"
          />
          <path
            className="flow-line"
            d="M0 153 C35 140 42 150 72 120 S112 141 140 98 S180 110 214 77 S250 102 282 85 S320 94 352 49 S390 92 422 62 S462 68 498 38 S548 71 580 32 S610 55 640 20"
          />
          <path
            className="alert-line"
            d="M0 174 C38 168 58 176 91 160 S120 170 150 153 S185 168 218 144 S250 164 287 148 S326 156 357 132 S390 159 420 125 S465 150 500 112 S544 145 576 106 S610 118 640 94"
          />
        </svg>
      </div>
      <div className="chart-footer">
        <span>10:37</span>
        <span>10:42</span>
        <b>
          <span className="pulse-dot" /> ingesting from
          Friday-Afternoon-PortScan
        </b>
      </div>
    </section>
  );
}

function Distribution({ alerts = [], metrics }) {
  const counts = metrics
    ? Object.fromEntries(
      metrics.prediction_distribution
        .filter((entry) => !isBenignLabel(entry.label))
        .map((entry) => [entry.label, entry.count]),
    )
    : alerts.filter((alert) => !isBenignLabel(alert.label)).reduce((all, alert) => {
      all[alert.label] = (all[alert.label] || 0) + 1;
      return all;
    }, {});
  const rows = Object.entries(counts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5);
  const threatTotal = metrics
    ? metrics.threats
    : Object.values(counts).reduce((sum, count) => sum + count, 0);
  const total = Math.max(threatTotal, 1);
  const colors = ["#4aa3ff", "#f85149", "#f0883e", "#d29922", "#708097"];
  let cursor = 0;
  const stops = rows.map(([, count], index) => {
    const start = cursor;
    cursor += (count / total) * 100;
    return `${colors[index]} ${start}% ${cursor}%`;
  });

  return (
    <section className="panel">
      <PanelTitle
        icon={Target}
        title="Attack distribution"
        meta={`${threatTotal.toLocaleString()} threats`}
      />
      <div className="donut-wrap">
        <div
          className="donut"
          style={{
            background: stops.length
              ? `conic-gradient(${stops.join(", ")})`
              : "#24394a",
          }}
        >
          <div>
            <strong>{threatTotal.toLocaleString()}</strong>
            <span>threats</span>
          </div>
        </div>
        <div className="donut-legend">
          {rows.length ? rows.map(([label, count], index) => (
            <LegendRow
              key={label}
              label={label}
              value={`${Math.round((count / total) * 100)}%`}
              color={colors[index]}
            />
          )) : (
            <span className="muted">Upload a CSV to populate this graph</span>
          )}
        </div>
      </div>
    </section>
  );
}
function isBenignLabel(label) {
  return ["benign", "normal", "none", "0"].includes(
    String(label).trim().toLowerCase(),
  );
}
function LegendRow({ label, value, color }) {
  return (
    <div className="legend-row">
      <i style={{ background: color }} /> <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
function RankedThreats({ alerts = [], setActive }) {
  const ranked = alerts
    .filter((alert) => !isBenignLabel(alert.label))
    .slice()
    .sort((left, right) => (right.score || 0) - (left.score || 0))
    .slice(0, 5);

  return (
    <section className="panel">
      <PanelTitle
        icon={Radar}
        title="Ranked threats"
        meta="highest risk"
        action={
          <button className="text-button" onClick={() => setActive("Approvals")}>
            Review <ArrowUpRight size={14} />
          </button>
        }
      />
      <div className="ranked-threats">
        {ranked.length ? ranked.map((alert, index) => (
          <button
            type="button"
            className="ranked-threat"
            key={alert.id}
            onClick={() => setActive("Workflow")}
          >
            <span className="rank">0{index + 1}</span>
            <div>
              <b>{alert.label}</b>
              <small className="mono">
                {alert.src} · {alert.flows?.toLocaleString() || 1} flows
              </small>
            </div>
            <strong>{alert.score}</strong>
          </button>
        )) : (
          <div className="ranked-empty">
            Upload traffic to rank detected threats.
          </div>
        )}
      </div>
    </section>
  );
}
function RecentAlerts({ alerts, setActive }) {
  return (
    <section className="panel recent-panel">
      <PanelTitle
        icon={Bell}
        title="Highest-risk alerts"
        meta="top 250 incident groups"
        action={
          <button className="text-button" onClick={() => setActive("Alerts")}>
            View all <ArrowUpRight size={14} />
          </button>
        }
      />
      <div className="mini-table">
        {alerts.slice(0, 5).map((alert) => (
          <div className="mini-row" key={alert.id}>
            <span className={`severity ${alert.sev}`}>{alert.sev}</span>
            <b>{alert.label}</b>
            <span className="mono">{alert.src.split(":")[0]}</span>
            <span className="muted">{alert.time}</span>
            <Status status={alert.status} />
          </div>
        ))}
      </div>
    </section>
  );
}
function AgentStatus({ scan }) {
  const detectionRunning = scan?.stage === "detection";
  const agentsRunning = scan?.stage === "agents";
  const complete = scan?.status === "complete";
  const agentState = agentsRunning
    ? `running ${scan.agent_processed || 0}/${scan.agent_total || 0}`
    : complete ? "complete" : "waiting";

  return (
    <section className="panel compact-status-panel">
      <PanelTitle
        icon={Workflow}
        title="Agent status"
        meta="upload pipeline"
        action={
          <span className="status-tag">
            <i className={`status-dot ${detectionRunning || agentsRunning ? "green" : "muted"}`} />
            {detectionRunning ? "detecting" : agentsRunning ? "triaging" : complete ? "complete" : "idle"}
          </span>
        }
      />
      <div className="agent-status-list">
        {[
          ["Detection", detectionRunning ? "running" : metricsState(scan), "HALCCon checkpoint"],
          ["Diagnosis", agentsRunning ? "running" : complete ? "complete" : "waiting", agentState],
          ["Triage", agentsRunning ? "running" : complete ? "complete" : "waiting", agentState],
          ["Planning", agentsRunning ? "running" : complete ? "complete" : "waiting", "human approval"],
        ].map(([name, status, detail]) => (
          <div className="agent-status-row" key={name}>
            <span className={`status-dot ${status === "running" ? "green" : status === "complete" ? "green" : "muted"}`} />
            <b>{name}</b>
            <small>{detail}</small>
            <em>{status}</em>
          </div>
        ))}
      </div>
    </section>
  );
}

function metricsState(scan) {
  return scan?.metrics ? "complete" : "waiting";
}

function UploadSummaryCard({ scan }) {
  const complete = scan?.status === "complete";
  return (
    <section className="panel compact-status-panel">
      <PanelTitle icon={Activity} title="Active scan" meta={scan?.stage || "idle"} />
      <div className="session-summary">
        <div>
          <small>Source</small>
          <b>{scan?.filename || "No upload"}</b>
        </div>
        <div>
          <small>Mode</small>
          <b>HALCCon model</b>
        </div>
        <div>
          <small>Response</small>
          <b>{complete ? `${scan.metrics.threats.toLocaleString()} awaiting review` : "Not started"}</b>
        </div>
      </div>
    </section>
  );
}

function ReplayCard({ replay, setReplay, time }) {
  return (
    <section className="panel replay-panel">
      <PanelTitle
        icon={Play}
        title="Replay engine"
        meta="CIC-IDS-2017"
        action={
          <span className="status-tag">
            <i className="status-dot green" /> running
          </span>
        }
      />
      <div className="replay-day">
        <div>
          <span>ACTIVE DATASET</span>
          <strong>Friday-Afternoon-PortScan</strong>
        </div>
        <button
          className="icon-button small"
          onClick={() => setReplay(!replay)}
        >
          {replay ? <Pause size={14} /> : <Play size={14} />}
        </button>
      </div>
      <div className="progress-track">
        <i style={{ width: "68%" }} />
      </div>
      <div className="replay-meta">
        <span>68.4% complete</span>
        <span>10:42:18 UTC</span>
      </div>
      <div className="replay-stats">
        <div>
          <span>Throughput</span>
          <b>
            4,280 <small>flows/s</small>
          </b>
        </div>
        <div>
          <span>Speed</span>
          <b>100×</b>
        </div>
        <div>
          <span>Cursor</span>
          <b>{time.toLocaleTimeString()}</b>
        </div>
      </div>
    </section>
  );
}
function PipelineHealth() {
  return (
    <section className="panel pipeline-panel">
      <PanelTitle
        icon={Workflow}
        title="Agent pipeline health"
        meta="15 steps"
        action={
          <span className="status-tag">
            <i className="status-dot green" /> 13 healthy
          </span>
        }
      />
      <div className="pipeline-pills">
        {workflow.map(([name, status, step]) => (
          <div className={`pipeline-pill ${status}`} key={step}>
            <span>{step}</span>
            <b>{name}</b>
            <i />
          </div>
        ))}
      </div>
    </section>
  );
}
