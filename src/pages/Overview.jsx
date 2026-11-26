import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  Radar,
  RefreshCw,
  Target,
  Workflow,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { nidsApi } from "../api/provider";
import {
  KPI,
  PanelTitle,
  SectionHeader,
  Status,
} from "../components/ui";
import { formatDetectionLabel } from "../utils/detectionLabels";

export default function Overview({
  alerts,
  summary,
  dataError,
  refreshDashboard,
  setActive,
  setAlerts,
  notify,
  scan,
  setScan,
}) {
  const recentScans = summary?.recent_scans || [];
  const latestScan = recentScans[0];
  const metrics = scan?.metrics || latestScan?.metrics;
  const priorityCounts = metrics?.priority_counts
    || summary?.priority_counts
    || {};

  return (
    <div className="page">
      <SectionHeader
        eyebrow="OPERATIONS / OVERVIEW"
        title="Command center"
        action={
          <div className="header-actions">
            <span className="live-indicator">
              <span className="pulse-dot" /> LIVE DATA · 15S REFRESH
            </span>
            <button
              className="button secondary"
              onClick={refreshDashboard}
              disabled={!refreshDashboard}
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        }
      />
      {dataError && <p className="error-banner">{dataError}</p>}
      <UploadPanel
        setAlerts={setAlerts}
        notify={notify}
        scan={scan}
        setScan={setScan}
        refreshDashboard={refreshDashboard}
      />
      <ScanMetrics metrics={metrics} />
      <div className="kpi-grid">
        <KPI
          label="Flows analyzed"
          value={(metrics?.rows_analyzed ?? latestScan?.rows_scanned)?.toLocaleString() || "—"}
          delta={scan?.filename || latestScan?.filename || "no scans stored"}
          tone="blue"
          icon={Activity}
        />
        <KPI
          label="Threat alerts"
          value={(metrics?.threats ?? summary?.alert_groups)?.toLocaleString() || "—"}
          delta={metrics ? "current scan" : "saved alert groups"}
          tone="red"
          icon={AlertTriangle}
        />
        <KPI
          label="Critical incidents"
          value={priorityCounts.P1?.toLocaleString() || "0"}
          delta="P1"
          tone="orange"
          icon={Radar}
        />
        <KPI
          label="Pending review"
          value={summary?.open_incidents?.toLocaleString() || "0"}
          delta="human approval"
          tone="yellow"
          icon={CheckCircle2}
        />
      </div>
      <div className="dashboard-grid top-grid">
        <RecentScans scans={recentScans} />
        <Distribution alerts={alerts} metrics={metrics} summary={summary} />
        <RankedThreats alerts={alerts} setActive={setActive} />
      </div>
      <div className="dashboard-grid bottom-grid">
        <RecentAlerts alerts={alerts} setActive={setActive} />
        <AgentStatus scan={scan || latestScan} />
        <UploadSummaryCard scan={scan || latestScan} />
      </div>
    </div>
  );
}

function UploadPanel({ setAlerts, notify, scan, setScan, refreshDashboard }) {
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
      await refreshDashboard();
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
          <span>CSV · model scores every row before incident triage</span>
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
            <small>Uploading {scan.filename} to the detection service.</small>
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
          {scan.storage_warning && (
            <small className="scan-warning">{scan.storage_warning}</small>
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
                    <td title={row.label}>{formatDetectionLabel(row.label)}</td>
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
                    {matrix.labels.map((label) => (
                      <th key={label} title={label}>{formatDetectionLabel(label)}</th>
                    ))}
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

function RecentScans({ scans }) {
  return (
    <section className="panel traffic-panel">
      <PanelTitle
        icon={Activity}
        title="Recent scans"
        meta={`${scans.length} saved`}
      />
      {scans.length ? (
        <div className="mini-table">
          {scans.map((item) => (
            <div className="mini-row" key={item.job_id}>
              <span className={`severity ${item.status === "complete" ? "low" : "medium"}`}>
                {item.status}
              </span>
              <b>{item.filename}</b>
              <span className="mono">{Number(item.rows_scanned || 0).toLocaleString()} flows</span>
              <span className="muted">{item.progress || 0}%</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="ranked-empty">No scans have been saved yet.</div>
      )}
    </section>
  );
}

function Distribution({ alerts = [], metrics, summary }) {
  const counts = metrics
    ? Object.fromEntries(
      metrics.prediction_distribution
        .filter((entry) => !isBenignLabel(entry.label))
        .map((entry) => [entry.label, entry.count]),
    )
    : summary?.detection_counts?.length
      ? Object.fromEntries(
        summary.detection_counts
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
      <i style={{ background: color }} />
      <span title={label}>{formatDetectionLabel(label)}</span>
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
              <b title={alert.label}>{formatDetectionLabel(alert.label)}</b>
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
        meta={`${alerts.length} loaded`}
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
            <b title={alert.label}>{formatDetectionLabel(alert.label)}</b>
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
  const threats = scan?.metrics?.threats;
  const response = complete
    ? threats == null ? "Completed" : `${threats.toLocaleString()} threats`
    : scan?.status === "failed"
      ? scan.error || "Scan failed"
      : scan?.status ? "Scan in progress" : "Not started";
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
          <b>{response}</b>
        </div>
      </div>
    </section>
  );
}
