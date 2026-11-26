import { Fragment, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  BookOpen,
  Bot,
  Boxes,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock3,
  Crosshair,
  Database,
  Download,
  ExternalLink,
  FileSearch,
  Gauge,
  GitBranch,
  Globe2,
  Home,
  KeyRound,
  LayoutDashboard,
  ListFilter,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Network,
  PanelLeftClose,
  Pause,
  Play,
  Plus,
  Radar,
  RefreshCw,
  Search,
  Settings2,
  Shield,
  Sparkles,
  Target,
  TerminalSquare,
  UserRound,
  Users,
  Workflow,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { MiniChart, PanelTitle, SectionHeader, Status } from "../components/ui";
import { nidsApi } from "../api/provider";
import {
  formatDetectionLabel,
  formatDetectionLabelText,
} from "../utils/detectionLabels";

function AlertsPage({
  alerts,
  summary,
  setActive,
  setSelectedIncidentId,
  refreshDashboard,
}) {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    const search = query.trim();
    if (!search) {
      setSearchResults(null);
      setSearchError("");
      setSearching(false);
      return undefined;
    }
    let cancelled = false;
    setSearching(false);
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError("");
      try {
        const results = await nidsApi.alerts({ search, limit: 50 });
        if (!cancelled) setSearchResults(results);
      } catch (error) {
        if (!cancelled) {
          setSearchResults([]);
          setSearchError(error.message);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [alerts, query]);
  const filtered = searchResults ?? alerts;
  const priorityCounts = summary?.priority_counts || {};
  const exportCsv = () => {
    const columns = ["time", "sev", "label", "src", "dst", "score", "conf", "incident", "status"];
    const csv = [
      columns.join(","),
      ...filtered.map((alert) => columns.map((column) =>
        `"${String(alert[column] ?? "").replace(/^[\t\r ]*[=+@-]/, "'$&").replaceAll('"', '""')}"`,
      ).join(",")),
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "nids-alerts.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  return (
    <div className="page">
      <SectionHeader
        eyebrow="OPERATIONS / ALERTS"
        title="Alert queue"
        action={
          <div className="header-actions">
            <button className="button secondary" onClick={exportCsv}>
              <Download size={14} /> Export CSV
            </button>
            <button
              className="button secondary"
              onClick={refreshDashboard}
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        }
      />
      <div className="alert-summary">
        <div>
          <strong>{(summary?.alert_groups ?? alerts.length).toLocaleString()}</strong>
          <span>Total alerts</span>
        </div>
        <div>
          <strong className="text-critical">{(priorityCounts.P1 || 0).toLocaleString()}</strong>
          <span>Critical</span>
        </div>
        <div>
          <strong className="text-high">{(priorityCounts.P2 || 0).toLocaleString()}</strong>
          <span>High</span>
        </div>
        <div>
          <strong className="text-medium">{(priorityCounts.P3 || 0).toLocaleString()}</strong>
          <span>Medium</span>
        </div>
        <div>
          <strong>{(summary?.open_incidents || 0).toLocaleString()}</strong>
          <span>Pending approval</span>
        </div>
      </div>
      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={16} />
            <input
              placeholder="Search alerts, IPs, labels…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <span className="muted">
            {searching ? "Searching saved alerts…" : "Auto-refreshes every 15 seconds"}
          </span>
        </div>
        {searchError && <p className="error-banner">{searchError}</p>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  <input type="checkbox" />
                </th>
                <th>TIME</th>
                <th>SEVERITY</th>
                <th>LABEL</th>
                <th>SOURCE → DESTINATION</th>
                <th title="Rule-based 0–100 incident risk, not the model's class probability.">
                  RISK SCORE
                </th>
                <th title="The model's confidence in its predicted attack class.">
                  CONFIDENCE
                </th>
                <th>INCIDENT</th>
                <th>STATUS</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((alert) => (
                <tr
                  key={alert.id}
                  className="clickable-row"
                  tabIndex={0}
                  onClick={() => {
                    if (alert.incident) setSelectedIncidentId(alert.incident);
                    setActive("Workflow");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      if (alert.incident) setSelectedIncidentId(alert.incident);
                      setActive("Workflow");
                    }
                  }}
                >
                  <td>
                    <input
                      type="checkbox"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="mono muted">{alert.time}</td>
                  <td>
                    <span className={`severity ${alert.sev}`}>{alert.sev}</span>
                  </td>
                  <td>
                    <strong title={alert.label}>{formatDetectionLabel(alert.label)}</strong>
                    <small className="row-id">{alert.id}</small>
                  </td>
                  <td className="route">
                    <span>{alert.src}</span>
                    <ArrowUpRight size={13} />
                    <span>{alert.dst}</span>
                  </td>
                  <td>
                    <div className="score">
                      <i style={{ width: `${alert.score}%` }} />
                      <b>{alert.score}</b>
                    </div>
                  </td>
                  <td className="confidence">{alert.conf}%</td>
                  <td className="linkish">{alert.incident}</td>
                  <td>
                    <Status status={alert.status} />
                  </td>
                  <td>
                    <MoreHorizontal size={17} />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="10" className="empty-cell">
                    {alerts.length ? "No alerts match this search." : "No alerts have been stored yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function WorkflowPage({ incidents, selectedIncidentId, setSelectedIncidentId }) {
  const [trace, setTrace] = useState([]);
  const [incidentId, setIncidentId] = useState(selectedIncidentId || "");
  const [selectedStep, setSelectedStep] = useState(1);
  const [replaying, setReplaying] = useState(false);
  const [traceError, setTraceError] = useState("");
  const [traceLoading, setTraceLoading] = useState(false);

  useEffect(() => {
    if (selectedIncidentId && selectedIncidentId !== incidentId) {
      setIncidentId(selectedIncidentId);
      setSelectedStep(1);
    } else if (!incidentId && incidents.length) {
      const nextId = incidents[0].no;
      setIncidentId(nextId);
      setSelectedIncidentId(nextId);
    }
  }, [incidentId, incidents, selectedIncidentId, setSelectedIncidentId]);

  useEffect(() => {
    if (!replaying) return undefined;
    const timer = setInterval(() => {
      setSelectedStep((current) => {
        if (current >= trace.length) {
          setReplaying(false);
          return trace.length;
        }
        return current + 1;
      });
    }, 700);
    return () => clearInterval(timer);
  }, [replaying, trace.length]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!incidentId) {
        setTrace([]);
        setTraceError("");
        setTraceLoading(false);
        return;
      }
      setTraceLoading(true);
      setTraceError("");
      try {
        const data = await nidsApi.workflow(incidentId);
        if (!cancelled && Array.isArray(data.trace)) {
          setTrace(data.trace.map((item) => ({
            ...item,
            step: String(item.step).padStart(2, "0"),
          })));
        } else if (!cancelled) {
          setTrace([]);
          setTraceError("The server returned no workflow trace for this incident.");
        }
      } catch (error) {
        if (!cancelled) {
          setTrace([]);
          setTraceError(error.message);
        }
      } finally {
        if (!cancelled) setTraceLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [incidentId]);

  return (
    <div className="page workflow-page">
      <SectionHeader
        eyebrow="OPERATIONS / WORKFLOW"
        title="Agent workflow"
        action={
          <div className="header-actions">
            <select
              className="select"
              value={incidentId}
              onChange={(event) => {
                setIncidentId(event.target.value);
                setSelectedIncidentId(event.target.value);
                setSelectedStep(1);
              }}
              disabled={!incidents.length}
            >
              {!incidents.length && <option value="">No incidents available</option>}
              {incidents.map((incident) => (
                <option key={incident.no} value={incident.no}>
                  {incident.no} · {formatDetectionLabel(incident.type)}
                </option>
              ))}
            </select>
            <button
              className="button primary"
              onClick={() => {
                if (replaying) {
                  setReplaying(false);
                } else {
                  setSelectedStep(1);
                  setReplaying(true);
                }
              }}
            >
              {replaying ? <Pause size={14} /> : <Play size={14} />}
              {replaying ? "Replay running" : "Replay trace"}
            </button>
          </div>
        }
      />
      <div className="workflow-layout">
        <section className="panel workflow-canvas">
          <div className="workflow-toolbar">
            <span>
              <span className={`pulse-dot ${traceLoading ? "" : "muted"}`} />
              {traceLoading ? "loading trace" : `stored trace · incident ${incidentId || "—"}`}
            </span>
          </div>
          <div className="flow-grid">
            {trace.map((item, i) => (
              <Fragment key={item.step}>
                <button
                  type="button"
                  className={`flow-node ${item.status} ${Number(item.step) === selectedStep ? "selected" : ""}`}
                  onClick={() => setSelectedStep(Number(item.step))}
                  aria-label={`Open step ${item.step}: ${item.name}`}
                >
                  <span className="node-step">{item.step}</span>
                  <div>
                    <b>{item.name}</b>
                    <small>
                      {item.status === "running"
                        ? "processing now"
                        : item.status === "waiting"
                          ? "awaiting signal"
                          : item.status === "success"
                            ? `${((item.latency_ms || 0) / 1000).toFixed(2)}s · complete`
                            : item.status}
                    </small>
                  </div>
                  <i />
                </button>
              </Fragment>
            ))}
            {!traceLoading && traceError && (
              <p className="workflow-empty">{traceError}</p>
            )}
            {!traceLoading && !traceError && !trace.length && (
              <p className="workflow-empty">This incident has no stored workflow trace.</p>
            )}
          </div>
          <div className="workflow-legend">
            <span>
              <i className="legend-dot success" /> complete
            </span>
            <span>
              <i className="legend-dot running" /> running
            </span>
            <span>
              <i className="legend-dot waiting" /> waiting human
            </span>
            <span>
              <i className="legend-dot pending" /> pending
            </span>
            <span>
              <i className="legend-line dashed" /> knowledge flow
            </span>
          </div>
        </section>
        <aside className="trace-panel">
          {(() => {
            const selected = trace.find((item) => Number(item.step) === selectedStep);
            if (!selected) {
              return <p className="workflow-empty">Select an available trace step to inspect its data.</p>;
            }
            return (
              <>
          <PanelTitle
            icon={TerminalSquare}
            title="Agent trace"
            meta={`step ${selected.step} / ${trace.length}`}
          />
          <div className="trace-agent">
            <div className="agent-icon blue">
              <Sparkles size={16} />
            </div>
            <div>
              <b>{selected.name}</b>
              <span>{selected.status} · persisted trace</span>
            </div>
            <span className="trace-time">
              {((selected.latency_ms || 0) / 1000).toFixed(2)}s
            </span>
          </div>
          <div className="trace-section">
            <label>STEP</label>
            <pre>{JSON.stringify({
              incident: incidentId,
              step: selected.step,
              name: selected.name,
            }, null, 2)}</pre>
          </div>
          <div className="trace-section">
            <label>OUTPUT</label>
            <pre>{JSON.stringify(selected.output || {}, null, 2)}</pre>
          </div>
          <div className="trace-footer">
            <span>
              trace step <b>{selected.step}</b>
            </span>
            <span>
              latency <b>{selected.latency_ms || "—"} ms</b>
            </span>
          </div>
              </>
            );
          })()}
        </aside>
      </div>
    </div>
  );
}

function ApprovalsPage({
  incidents,
  selectedIncidentId,
  notify,
  refreshDashboard,
}) {
  const pendingIncidents = incidents.filter(
    (item) => item.outcome === "pending" || item.status === "awaiting approval",
  );
  const [selectedId, setSelectedId] = useState(selectedIncidentId || "");
  const [incidentDetails, setIncidentDetails] = useState(null);
  const [selectedPlanIndexes, setSelectedPlanIndexes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [comment, setComment] = useState("");
  const [replanPrompt, setReplanPrompt] = useState("");
  const [showReplan, setShowReplan] = useState(false);
  const [isReplanning, setIsReplanning] = useState(false);
  const [replanError, setReplanError] = useState("");
  const selectedSummary = pendingIncidents.find((item) => item.no === selectedId);
  const plans = Array.isArray(incidentDetails?.plans) ? incidentDetails.plans : [];
  const canReview =
    Boolean(incidentDetails) &&
    (incidentDetails.outcome === "pending" ||
      incidentDetails.status === "awaiting approval");

  useEffect(() => {
    const preferred = pendingIncidents.find((item) => item.no === selectedIncidentId);
    if (preferred) {
      setSelectedId(preferred.no);
    } else if (!pendingIncidents.some((item) => item.no === selectedId)) {
      setSelectedId(pendingIncidents[0]?.no || "");
    }
  }, [incidents, selectedId, selectedIncidentId]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedId) {
      setIncidentDetails(null);
      setSelectedPlanIndexes([]);
      setLoadError("");
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    setLoadError("");
    nidsApi.incident(selectedId)
      .then((detail) => {
        if (cancelled) return;
        setIncidentDetails(detail);
        setSelectedPlanIndexes(
          (Array.isArray(detail.plans) ? detail.plans : []).map((_, index) => index),
        );
      })
      .catch((error) => {
        if (cancelled) return;
        setIncidentDetails(null);
        setLoadError(error.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const decide = async (verdict) => {
    if (!selectedId || !canReview) return;
    try {
      const updated = await nidsApi.decide(selectedId, {
        verdict,
        approved_actions: verdict === "reject"
          ? []
          : selectedPlanIndexes.map((index) => plans[index]),
        note: comment,
      });
      setIncidentDetails(updated);
      notify(
        verdict === "reject"
          ? "Approval rejected and returned to planning"
          : verdict === "modify"
            ? "Selected response plan approved"
            : "Response plan approved",
      );
      await refreshDashboard();
    } catch (error) {
      notify(error.message);
    }
  };
  const replan = async () => {
    if (isReplanning) return;
    if (!selectedId || !canReview || !replanPrompt.trim()) {
      notify("Enter a prompt describing how the plan should change");
      return;
    }
    setIsReplanning(true);
    setReplanError("");
    try {
      const updated = await nidsApi.replan(selectedId, replanPrompt);
      setIncidentDetails(updated);
      setSelectedPlanIndexes(
        (Array.isArray(updated.plans) ? updated.plans : []).map((_, index) => index),
      );
      notify("Plan revised · back in approval queue; execution waits for approval");
      setShowReplan(false);
      setReplanPrompt("");
      await refreshDashboard();
    } catch (error) {
      setReplanError(error.message);
      notify(error.message);
    } finally {
      setIsReplanning(false);
    }
  };

  return (
    <div className="page">
      <SectionHeader
        eyebrow="OPERATIONS / HUMAN-IN-THE-LOOP"
        title="Approval queue"
        action={
          <div className="live-indicator">
            <span className="pulse-dot" /> {pendingIncidents.length} pending decisions
          </div>
        }
      />
      <div className="approval-layout">
        <section className="panel approval-list">
          <PanelTitle
            icon={CheckCircle2}
            title="Pending approvals"
            meta="oldest first"
          />
          {pendingIncidents.map((item) => (
            <div
              className={`approval-item ${item.no === selectedId ? "selected" : ""}`}
              key={item.no}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedId(item.no)}
              onKeyDown={(event) => {
                if (event.key === "Enter") setSelectedId(item.no);
              }}
            >
              <div className={`priority ${item.priority.toLowerCase()}`}>
                {item.priority}
              </div>
              <div className="approval-copy">
                <b>
                  {item.no} · {formatDetectionLabelText(item.title, item.type)}
                </b>
                <span>
                  {formatDetectionLabel(item.type)} · recommended containment plan
                </span>
                <small>
                  {item.time || "time unavailable"} <span>·</span> waiting for analyst
                </small>
              </div>
              <ChevronDown size={15} />
            </div>
          ))}
          {!pendingIncidents.length && (
            <p className="empty-cell">No incidents are awaiting approval.</p>
          )}
        </section>
        <section className="panel review-panel">
          {loading && <p className="muted">Loading incident details…</p>}
          {loadError && <p className="error-banner">{loadError}</p>}
          {!loading && !loadError && !incidentDetails && (
            <p className="empty-cell">Select an incident to review its stored response plan.</p>
          )}
          {incidentDetails && (
          <>
          <div className="review-header">
            <div>
              <div className="eyebrow">REVIEW REQUEST · {selectedId}</div>
              <h2>
                {formatDetectionLabelText(
                  incidentDetails.diagnosis?.summary,
                  incidentDetails.alert?.detection_label,
                ) ||
                  selectedSummary?.title ||
                  formatDetectionLabel(incidentDetails.alert?.detection_label
                    || selectedSummary?.type
                    || "Incident details")}
              </h2>
            </div>
            <span className="status awaiting">
              {incidentDetails.status || selectedSummary?.status || "unknown"}
            </span>
          </div>
          <div className="approval-banner">
            <Shield size={17} />
            <span>
              <b>Simulation mode is enabled.</b> No live network changes will be
              executed.
            </span>
          </div>
          <div className="review-grid">
            <div>
              <label>RISK SCORE</label>
              <div className="risk-score">
                <strong>
                  {incidentDetails.triage?.risk_score ?? selectedSummary?.risk ?? "—"}
                </strong>
                <span>/ 100</span>
                <i>{incidentDetails.triage?.priority || selectedSummary?.priority || "Unknown"}</i>
              </div>
            </div>
            <div>
              <label>ATTACK TYPE</label>
              <b className="review-value">
                {formatDetectionLabel(
                  incidentDetails.alert?.detection_label || selectedSummary?.type,
                )}
              </b>
              <span className="review-sub">Source: {incidentDetails.alert?.src_ip || "unknown"}</span>
            </div>
            <div>
              <label>AFFECTED ASSET</label>
              <b className="review-value">
                {incidentDetails.diagnosis?.asset?.role || "Destination"}
              </b>
              <span className="review-sub mono">
                {incidentDetails.alert?.dst_ip || "unknown"}
              </span>
            </div>
          </div>
          <div className="review-block">
            <div className="block-label">
              <span>STORED RESPONSE PLAN</span>
              <span className="recommended">
                {plans.length} recommended action{plans.length === 1 ? "" : "s"}
              </span>
            </div>
            <h3>{plans.length ? "Select actions for analyst approval" : "No response plan is stored"}</h3>
            <div className="action-checks">
              {plans.map((plan, index) => (
                <label key={`${plan.action}-${plan.target}-${index}`}>
                  <input
                    type="checkbox"
                    checked={selectedPlanIndexes.includes(index)}
                    onChange={(event) => {
                      setSelectedPlanIndexes((current) => event.target.checked
                        ? [...current, index]
                        : current.filter((value) => value !== index));
                    }}
                  />
                  <b>{plan.action || "response action"}</b>
                  {plan.target ? ` · ${plan.target}` : ""}
                  {plan.rationale ? ` — ${plan.rationale}` : ""}
                </label>
              ))}
            </div>
            <div className="plan-meta">
              <span>
                <small>IMPACT</small>
                {plans.map((plan) => plan.impact).filter(Boolean).join(", ") || "Not recorded"}
              </span>
              <span>
                <small>EFFECTIVENESS</small>
                {plans.map((plan) => plan.effectiveness).filter((value) => value != null).join(", ") || "Not recorded"}
              </span>
              <span>
                <small>OUTCOME</small>{incidentDetails.outcome || "unknown"}
              </span>
            </div>
          </div>
          <textarea
            className="comment-box"
            placeholder="Add an analyst comment (optional)…"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
          {showReplan && (
            <div className="replan-box">
              <label>Ask the planning agent to revise this plan</label>
              {replanError && <p className="error-banner">{replanError}</p>}
              <textarea
                className="comment-box"
                placeholder="Example: Make it less disruptive and use rate limiting instead of blocking..."
                value={replanPrompt}
                onChange={(event) => setReplanPrompt(event.target.value)}
                disabled={isReplanning}
              />
              <div className="review-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setShowReplan(false)}
                  disabled={isReplanning}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="button warning"
                  onClick={replan}
                  disabled={isReplanning || !replanPrompt.trim()}
                >
                  <RefreshCw size={14} /> {isReplanning ? "Replanning..." : "Replan"}
                </button>
              </div>
            </div>
          )}
          <div className="review-actions">
            {!showReplan && (
              <button
                className="button secondary"
                onClick={() => setShowReplan(true)}
              >
                <RefreshCw size={14} /> Replan
              </button>
            )}
            <button
              className="button danger"
              onClick={() => decide("reject")}
              disabled={!canReview}
            >
              Reject
            </button>
            <button
              className="button warning"
              onClick={() => decide("modify")}
              disabled={!canReview}
            >
              Modify & approve
            </button>
            <button
              className="button success"
              onClick={() => decide("approve")}
              disabled={!canReview}
            >
              Approve plan <Check size={15} />
            </button>
          </div>
          </>
          )}
        </section>
      </div>
    </div>
  );
}

function DetectionPage({ notify }) {
  const [tab, setTab] = useState("OVERVIEW");
  return (
    <div className="page">
      <SectionHeader
        eyebrow="DETECTION CONTENT / SURICATA"
        title="Detections"
        action={
          <button className="button primary">
            <Plus size={15} /> New detection
          </button>
        }
      />
      <div className="detection-layout">
        <section className="panel detection-main">
          <div className="detection-title">
            <div>
              <span className="rule-type">
                <Radar size={13} /> SURICATA RULE
              </span>
              <h2>
                ET EXPLOIT_KIT ZPHP Domain in TLS SNI <span>(fjs95 .shop)</span>
              </h2>
              <p>
                Detection ID 2061171 <i /> ETOPEN ruleset <i /> Updated 27 Mar
                2025
              </p>
            </div>
            <div className="detection-actions">
              <button className="button secondary">
                <RefreshCw size={14} /> Duplicate
              </button>
              <button className="icon-button">
                <MoreHorizontal />
              </button>
            </div>
          </div>
          <div className="tabs">
            {[
              ["OVERVIEW", FileSearch],
              ["OPERATIONAL NOTES", MessageSquare],
              ["DETECTION SOURCE", TerminalSquare],
              ["TUNING (0)", Settings2],
              ["PLAYBOOKS (1)", BookOpen],
              ["HISTORY", Clock3],
            ].map(([label, Icon]) => (
              <button
                className={tab === label ? "active" : ""}
                onClick={() => setTab(label)}
                key={label}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
          {tab === "OVERVIEW" ? (
            <DetectionOverview />
          ) : (
            <div className="tab-placeholder">
              <TerminalSquare size={25} />
              <h3>{tab.replace(" (0)", "").replace(" (1)", "")}</h3>
              <p>
                This detection surface is ready for analyst review. Changes are
                persisted in the mock workspace.
              </p>
              <button
                className="button secondary"
                onClick={() => notify(`${tab} opened`)}
              >
                Open workspace
              </button>
            </div>
          )}
        </section>
        <aside className="detection-rail">
          <section className="panel rail-card">
            <PanelTitle
              icon={Settings2}
              title="Operations"
              meta="rule controls"
            />
            <div className="enabled-row">
              <div>
                <b>Status</b>
                <span>Enabled and active</span>
              </div>
              <span className="switch on">
                <i />
              </span>
            </div>
            <div className="rail-actions">
              <button
                className="button primary"
                onClick={() => notify("Detection duplicated")}
              >
                DUPLICATE
              </button>
              <button
                className="button delete"
                onClick={() => notify("Delete requires confirmation")}
              >
                DELETE
              </button>
            </div>
          </section>
          <section className="panel rail-card">
            <PanelTitle icon={FileSearch} title="Details" meta="metadata" />
            <div className="details-list">
              <Detail label="Public ID" value="2061171" />
              <Detail label="Type" value="Suricata" />
              <Detail label="Severity" value="Low" tone="low" />
              <Detail label="Ruleset" value="ETOPEN" />
              <Detail label="License" value="BSD" />
              <Detail label="Created" value="2025-03-27" />
              <Detail label="Updated" value="2025-03-27" />
              <Detail label="Author" value="ETOPEN" />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
function DetectionOverview() {
  return (
    <div className="detection-content">
      <div className="summary-block">
        <h3>
          <Sparkles size={17} /> Summary <span>AI GENERATED</span>
        </h3>
        <p>
          This rule detects attempts to establish a TLS connection from an
          internal network to the domain <b>fjs95.shop</b> found in the Server
          Name Indication (SNI) field of the TLS handshake. The activity is
          indicative of exploit kit behavior, which may involve compromised
          websites being used as part of a drive-by compromise attack.
        </p>
      </div>
      <div className="reference-block">
        <h3>References</h3>
        <a href="#">
          www.proofpoint.com/us/blog/threat-insight/are-you-sure-your-browser-date-current-landscape-fake-browser-updates{" "}
          <ArrowUpRight size={13} />
        </a>
      </div>
      <div className="logic-block">
        <div className="logic-head">
          <h3>Detection logic</h3>
          <span>
            <TerminalSquare size={14} /> SURICATA
          </span>
        </div>
        <pre>
          <code>
            <span>tls</span> <em>$HOME_NET</em> any <b>-&gt;</b>{" "}
            <em>$EXTERNAL_NET</em> any{`\n`}
            <span>flow</span>:established,to_server{`\n`}
            <span>tls.sni</span>
            {`\n`}
            <span>bsize</span>:10{`\n`}
            <span>content</span>:<strong>"fjs95.shop"</strong>
            {`\n`}
            <mark>fast_pattern</mark>
          </code>
        </pre>
      </div>
    </div>
  );
}
function Detail({ label, value, tone }) {
  return (
    <div>
      <label>{label}</label>
      <b className={tone ? `text-${tone}` : ""}>{value}</b>
    </div>
  );
}

const AGENT_SESSION_STORAGE_KEY = "agentic-nids-agent-sessions";
const AGENT_WELCOME_MESSAGE = {
  role: "agent",
  text: "Ask about saved scans, alert groups, incident priorities, or investigation playbooks.",
};

function renderInlineMarkdown(text, keyPrefix) {
  const markdownPattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  return text.split(markdownPattern).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={key}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function normalizeAssistantMarkdown(text) {
  return text
    .replace(/\$\$([\s\S]*?)\$\$/g, "$1")
    .replace(/\$([^$\n]+)\$/g, "$1")
    .replace(/\\text\{([^{}]*)\}/g, "$1")
    .replace(/\\operatorname\{([^{}]*)\}/g, "$1")
    .replace(/\\(?:mathrm|mathbf|mathit)\{([^{}]*)\}/g, "$1")
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1 / $2)")
    .replace(/\\sqrt\{([^{}]+)\}/g, "√($1)")
    .replace(/\\times\b/g, " × ")
    .replace(/\\cdot\b/g, " · ")
    .replace(/\\geq?\b/g, " ≥ ")
    .replace(/\\leq?\b/g, " ≤ ")
    .replace(/\\neq\b/g, " ≠ ")
    .replace(/\\approx\b/g, " ≈ ")
    .replace(/\\min\b/g, "min")
    .replace(/\\max\b/g, "max")
    .replace(/\\left|\\right/g, "")
    .replace(/\\(?:big|Big|bigg|Bigg)(?=[()[\]])/g, "")
    .replace(/\\%/g, "%")
    .replace(/\\_/g, "_")
    .replace(/\\\\/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([),])/g, "$1")
    .replace(/\(\s+/g, "(");
}

function renderAssistantMarkdown(text) {
  const lines = normalizeAssistantMarkdown(text).trim().split("\n");
  const blocks = [];
  let lineIndex = 0;
  while (lineIndex < lines.length) {
    const line = lines[lineIndex].trim();
    if (!line) {
      lineIndex += 1;
      continue;
    }

    const blockIndex = blocks.length;
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const Heading = `h${heading[1].length}`;
      blocks.push(
        <Heading key={`heading-${blockIndex}`}>
          {renderInlineMarkdown(heading[2], `heading-${blockIndex}`)}
        </Heading>,
      );
      lineIndex += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const codeLines = [];
      lineIndex += 1;
      while (lineIndex < lines.length && !lines[lineIndex].trim().startsWith("```")) {
        codeLines.push(lines[lineIndex]);
        lineIndex += 1;
      }
      if (lineIndex < lines.length) lineIndex += 1;
      blocks.push(
        <pre key={`code-${blockIndex}`}>
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    if (/^\s*[-*+]\s+/.test(lines[lineIndex])) {
      const items = [];
      while (
        lineIndex < lines.length
        && /^\s*[-*+]\s+/.test(lines[lineIndex])
      ) {
        items.push(lines[lineIndex].replace(/^\s*[-*+]\s+/, ""));
        lineIndex += 1;
      }
      blocks.push(
        <ul key={`list-${blockIndex}`}>
          {items.map((item, itemIndex) => (
            <li key={`item-${itemIndex}`}>
              {renderInlineMarkdown(item, `list-${blockIndex}-${itemIndex}`)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(lines[lineIndex])) {
      const items = [];
      while (
        lineIndex < lines.length
        && /^\s*\d+[.)]\s+/.test(lines[lineIndex])
      ) {
        items.push(lines[lineIndex].replace(/^\s*\d+[.)]\s+/, ""));
        lineIndex += 1;
      }
      blocks.push(
        <ol key={`list-${blockIndex}`}>
          {items.map((item, itemIndex) => (
            <li key={`item-${itemIndex}`}>
              {renderInlineMarkdown(item, `ordered-${blockIndex}-${itemIndex}`)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    const paragraphLines = [line];
    lineIndex += 1;
    while (
      lineIndex < lines.length
      && lines[lineIndex].trim()
      && !/^#{1,3}\s+/.test(lines[lineIndex].trim())
      && !/^\s*[-*+]\s+/.test(lines[lineIndex])
      && !/^\s*\d+[.)]\s+/.test(lines[lineIndex])
      && !lines[lineIndex].trim().startsWith("```")
    ) {
      paragraphLines.push(lines[lineIndex].trim());
      lineIndex += 1;
    }
    blocks.push(
      <p key={`paragraph-${blockIndex}`}>
        {paragraphLines.map((paragraphLine, paragraphIndex) => (
          <Fragment key={`line-${paragraphIndex}`}>
            {renderInlineMarkdown(
              paragraphLine,
              `paragraph-${blockIndex}-${paragraphIndex}`,
            )}
            {paragraphIndex < paragraphLines.length - 1 && <br />}
          </Fragment>
        ))}
      </p>,
    );
  }
  return blocks;
}

function AssistantAnswer({ text, streaming, error }) {
  return (
    <div className={`assistant-answer ${error ? "chat-error" : ""}`}>
      {renderAssistantMarkdown(text)}
      {streaming && !text && (
        <span className="typing-indicator" aria-label="Generating response">
          <i /><i /><i />
        </span>
      )}
      {streaming && text && <span className="streaming-cursor" aria-hidden="true" />}
    </div>
  );
}

function createAgentSession() {
  return {
    id: globalThis.crypto?.randomUUID?.()
      || `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: "New session",
    messages: [AGENT_WELCOME_MESSAGE],
    updatedAt: new Date().toISOString(),
  };
}

function loadAgentSessions() {
  try {
    const saved = window.localStorage.getItem(AGENT_SESSION_STORAGE_KEY);
    if (saved) {
      const sessions = JSON.parse(saved);
      if (
        Array.isArray(sessions)
        && sessions.length > 0
        && sessions.every((session) =>
          typeof session.id === "string"
          && typeof session.title === "string"
          && Array.isArray(session.messages)
          && session.messages.every((message) =>
            message
            && ["agent", "user"].includes(message.role)
            && typeof message.text === "string"
          )
        )
      ) {
        return sessions;
      }
      console.warn("Ignoring malformed saved Agent AI sessions.");
    }
  } catch (error) {
    console.warn("Could not load Agent AI sessions from local storage.", error);
  }
  return [createAgentSession()];
}

function AgentPage({ notify }) {
  const [sessions, setSessions] = useState(loadAgentSessions);
  const [activeSessionId, setActiveSessionId] = useState(() => sessions[0].id);
  const [sessionStorageError, setSessionStorageError] = useState("");
  const [input, setInput] = useState("");
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [assistantStatus, setAssistantStatus] = useState("thinking…");
  const activeSession = sessions.find(
    (session) => session.id === activeSessionId,
  ) || sessions[0];
  const messages = activeSession.messages;

  useEffect(() => {
    nidsApi.health().then(setHealth).catch(() => setHealth({ status: "unavailable" }));
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        AGENT_SESSION_STORAGE_KEY,
        JSON.stringify(sessions),
      );
      setSessionStorageError("");
    } catch (error) {
      console.error("Could not save Agent AI sessions to local storage.", error);
      setSessionStorageError("Chat sessions could not be saved in this browser.");
    }
  }, [sessions]);

  const send = async () => {
    const question = input.trim();
    if (!question || loading) return;
    const sessionId = activeSessionId;
    const messageId = globalThis.crypto?.randomUUID?.()
      || `message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setSessions((current) => current.map((session) => {
      if (session.id !== sessionId) return session;
      const hasPreviousQuestion = session.messages.some(
        (message) => message.role === "user",
      );
      return {
        ...session,
        title: hasPreviousQuestion ? session.title : question.slice(0, 40),
        messages: [
          ...session.messages,
          { role: "user", text: question },
          {
            id: messageId,
            role: "agent",
            text: "",
            sources: [],
            status: "Thinking…",
            streaming: true,
          },
        ],
        updatedAt: new Date().toISOString(),
      };
    }));
    setInput("");
    setLoading(true);
    setAssistantStatus("thinking…");
    const updateAgentMessage = (update) => {
      setSessions((current) => current.map((session) => (
        session.id === sessionId
          ? {
            ...session,
            messages: session.messages.map((message) => (
              message.id === messageId ? update(message) : message
            )),
            updatedAt: new Date().toISOString(),
          }
          : session
      )));
    };
    try {
      await nidsApi.assistantQuery(question, (event) => {
        if (event.type === "status") {
          const status = {
            thinking: "Thinking…",
            retrieving: "Searching relevant context…",
            generating: "Writing response…",
          }[event.status] || "Working…";
          setAssistantStatus(status.toLowerCase());
          updateAgentMessage((message) => ({ ...message, status }));
        } else if (event.type === "sources") {
          updateAgentMessage((message) => ({
            ...message,
            retrievalUsed: true,
            sources: event.sources || [],
          }));
        } else if (event.type === "token") {
          updateAgentMessage((message) => ({
            ...message,
            text: message.text + event.text,
            status: "Writing response…",
          }));
        } else if (event.type === "done") {
          updateAgentMessage((message) => ({
            ...message,
            streaming: false,
            status: "",
          }));
        }
      });
    } catch (error) {
      updateAgentMessage((message) => ({
        ...message,
        text: message.text || error.message || "The RAG assistant request failed.",
        error: true,
        failure: message.text ? error.message : "",
        streaming: false,
        status: "",
      }));
      notify?.("Agent AI could not answer. Check Supabase and Gemini configuration.");
    } finally {
      setLoading(false);
      setAssistantStatus("");
    }
  };
  const lastAgentMessage =
    [...messages].reverse().find((message) => message.role === "agent") || {};
  const lastSources = lastAgentMessage.sources || [];
  const llmReady = health?.llm_enabled === true;
  const ragReady = health?.rag_enabled === true;
  const ragStatus = health === null
    ? "Checking assistant"
    : llmReady
      ? ragReady ? "LLM · Supabase RAG" : "LLM ready · RAG unavailable"
      : "LLM configuration required";
  const startNewSession = () => {
    const session = createAgentSession();
    setSessions((current) => [session, ...current]);
    setActiveSessionId(session.id);
    setInput("");
  };
  return (
    <div className="page">
      <SectionHeader
        eyebrow="AGENTIC OPERATIONS / ASSISTANT"
        title="Agent AI"
        action={
          <span className="status-tag">
            <i className={`status-dot ${llmReady ? "green" : health === null ? "muted" : "amber"}`} />
            {ragStatus}
          </span>
        }
      />
      <div className="agent-layout">
        <aside className="panel session-list">
          <PanelTitle
            icon={MessageSquare}
            title="Sessions"
            meta={`${sessions.length} saved`}
          />
          <button className="new-session" onClick={startNewSession}>
            <Plus size={15} /> New session
          </button>
          {sessionStorageError && (
            <p className="session-storage-error">{sessionStorageError}</p>
          )}
          <div className="session-list-items">
            {sessions.map((session) => (
              <button
                type="button"
                className={`session ${session.id === activeSession.id ? "active" : ""}`}
                key={session.id}
                onClick={() => {
                  setActiveSessionId(session.id);
                  setInput("");
                }}
                aria-current={session.id === activeSession.id ? "page" : undefined}
                title={session.title}
              >
                <MessageSquare size={15} />
                <span>{session.title}</span>
                <small>
                  {session.messages.filter((message) => message.role === "user").length}
                </small>
              </button>
            ))}
          </div>
        </aside>
        <section className="panel chat-panel">
          <div className="chat-header">
            <div>
              <span className="eyebrow">ONION AI / SECURE CHAT</span>
              <b>Operations copilot</b>
            </div>
            <span className="status-tag">
              <i className={`status-dot ${loading ? "amber" : llmReady ? "green" : health === null ? "muted" : "amber"}`} />
              {loading
                ? assistantStatus
                : health === null
                  ? "connecting"
                  : llmReady
                    ? ragReady ? "ready · RAG on" : "ready · LLM only"
                    : "LLM setup required"}
            </span>
          </div>
          <div className="messages">
            {messages.map((m, i) => (
              <div className={`message ${m.role}`} key={m.id || i}>
                <div className="message-avatar">
                  {m.role === "agent" ? <Bot size={16} /> : "AR"}
                </div>
                <div>
                  <span className="message-role">
                    {m.role === "agent" ? "Agent AI" : "analyst"}
                  </span>
                  {m.role === "agent" ? (
                    <AssistantAnswer
                      text={m.text}
                      streaming={m.streaming}
                      error={m.error && !m.failure}
                    />
                  ) : <p>{m.text}</p>}
                  {m.failure && <p className="chat-error">{m.failure}</p>}
                  {m.streaming && <span className="message-status">{m.status}</span>}
                </div>
              </div>
            ))}
          </div>
          <div className="suggestions">
            <button
              onClick={() => setInput("What are the top source IPs in saved alerts?")}
            >
              Top attackers
            </button>
            <button onClick={() => setInput("Summarize incidents by priority.")}>
              Priority summary
            </button>
            <button onClick={() => setInput("Explain PortScan detections and safe next steps.")}>
              Explain PortScan
            </button>
          </div>
          <div className="chat-input">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="Ask Agent AI about your environment…"
              disabled={loading}
            />
            <button className="button primary" onClick={send} disabled={loading || !input.trim()}>
              <ArrowUpRight size={15} /> {loading ? "Working" : "Send"}
            </button>
          </div>
        </section>
        <aside className="panel context-panel">
          <PanelTitle icon={Target} title="Context" meta="live" />
          <div className="context-card">
            <span>DATA SOURCES</span>
            <p>Saved scan summaries, grouped alerts, incident records, and security playbooks.</p>
          </div>
          <div className="context-card">
            <span>EVIDENCE USED</span>
            {lastSources.length ? lastSources.map((source, index) => (
              <p className="source-link" key={`${source.type}-${source.id}-${index}`}>
                {source.type === "knowledge" ? <BookOpen size={13} /> : <Database size={13} />}
                {source.type === "incident"
                  ? formatDetectionLabel(source.label || source.id)
                  : source.label || source.id}
              </p>
            )) : (
              <p>
                {lastAgentMessage.retrievalUsed
                  ? "No matching evidence found."
                  : "No retrieval needed for the latest answer."}
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function DashboardPage() {
  return (
    <div className="page">
      <SectionHeader
        eyebrow="OPERATIONS / DASHBOARDS"
        title="Performance lab"
        action={
          <div className="header-actions">
            <button className="filter-button">
              Last 24 hours <ChevronDown size={14} />
            </button>
            <button className="button secondary">
              <Download size={14} /> Export
            </button>
          </div>
        }
      />
      <div className="metric-strip">
        <div>
          <span>Macro F1</span>
          <b>0.947</b>
          <small className="up">+2.8%</small>
        </div>
        <div>
          <span>Precision</span>
          <b>0.961</b>
          <small className="up">+1.4%</small>
        </div>
        <div>
          <span>Recall</span>
          <b>0.934</b>
          <small className="up">+3.1%</small>
        </div>
        <div>
          <span>False positive rate</span>
          <b>1.8%</b>
          <small>−0.4%</small>
        </div>
      </div>
      <div className="dashboard-grid analytics-grid">
        <section className="panel confusion">
          <PanelTitle
            icon={Gauge}
            title="Confusion matrix"
            meta="multiclass classifier v2.4"
          />
          <div className="matrix">
            {[
              98, 1, 0, 0, 1, 2, 94, 2, 0, 0, 1, 3, 96, 0, 0, 0, 2, 1, 95, 2, 1,
              0, 1, 0, 98,
            ].map((n, i) => (
              <span className={n > 90 ? "hot" : n > 2 ? "warm" : ""} key={i}>
                {n}
              </span>
            ))}
          </div>
          <div className="matrix-labels">
            <span>BENIGN</span>
            <span>DoS</span>
            <span>DDoS</span>
            <span>PortScan</span>
            <span>Patator</span>
          </div>
        </section>
        <section className="panel class-performance">
          <PanelTitle
            icon={Target}
            title="Per-class performance"
            meta="15 labels"
          />
          <div className="performance-list">
            {[
              ["PortScan", ".98", "98%", "#4aa3ff"],
              ["DDoS", ".96", "96%", "#f85149"],
              ["DoS Hulk", ".95", "95%", "#f0883e"],
              ["SSH-Patator", ".93", "93%", "#d29922"],
              ["Web Attack", ".89", "89%", "#b48cff"],
            ].map(([name, f1, pct, color]) => (
              <div className="perf-row" key={name}>
                <span>{name}</span>
                <div>
                  <i style={{ width: pct, background: color }} />
                </div>
                <b>{f1}</b>
              </div>
            ))}
          </div>
        </section>
        <section className="panel feature-panel">
          <PanelTitle
            icon={Sparkles}
            title="Top model features"
            meta="SHAP importance"
          />
          <div className="feature-bars">
            {[
              ["Flow Bytes/s", 91],
              ["Packet Length Mean", 73],
              ["SYN Flag Count", 64],
              ["Destination Port", 48],
              ["Fwd IAT Mean", 37],
            ].map(([name, val]) => (
              <div key={name}>
                <span>{name}</span>
                <div>
                  <i style={{ width: `${val}%` }} />
                </div>
                <b>{val}</b>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function SubpageToolbar({ placeholder, action, onAction }) {
  return (
    <div className="table-toolbar">
      <div className="search-box">
        <Search size={16} />
        <input placeholder={placeholder} />
      </div>
      <button className="filter-button">
        <ListFilter size={15} /> Filters <span>2</span>
      </button>
      <button className="filter-button">
        Last 24 hours <ChevronDown size={14} />
      </button>
      {action && (
        <button className="button primary" onClick={onAction}>
          <Plus size={15} /> {action}
        </button>
      )}
    </div>
  );
}
function HuntPage({ notify }) {
  const rows = [
    ["172.16.0.1", "PortScan", "192.168.10.50", "4,821", "98.4%"],
    ["205.174.165.68", "SSH-Patator", "192.168.10.8", "1,204", "91.2%"],
    ["172.16.0.1", "DoS Hulk", "192.168.10.19", "886", "87.9%"],
    ["192.168.10.14", "BENIGN", "192.168.10.3", "642", "99.1%"],
  ];
  return (
    <div className="page">
      <SectionHeader
        eyebrow="OPERATIONS / HUNT"
        title="Threat hunt"
        action={
          <button
            className="button primary"
            onClick={() => notify("Hunt saved to your workspace")}
          >
            <Plus size={15} /> Save hunt
          </button>
        }
      />
      <div className="hunt-layout">
        <section className="panel query-panel">
          <PanelTitle
            icon={Crosshair}
            title="Query builder"
            meta="structured DSL"
          />
          <div className="query-editor">
            <div className="query-row">
              <select>
                <option>Source IP</option>
                <option>Destination IP</option>
                <option>Label</option>
              </select>
              <select>
                <option>equals</option>
                <option>contains</option>
                <option>in range</option>
              </select>
              <input value="172.16.0.1" readOnly />
              <button className="icon-button small">
                <X size={14} />
              </button>
            </div>
            <div className="query-row">
              <select>
                <option>Label</option>
                <option>Severity</option>
                <option>Port</option>
              </select>
              <select>
                <option>equals</option>
                <option>contains</option>
              </select>
              <input value="PortScan" readOnly />
              <button className="icon-button small">
                <X size={14} />
              </button>
            </div>
            <button className="add-filter">
              <Plus size={13} /> Add condition
            </button>
            <div className="raw-query">
              <label>RAW QUERY</label>
              <code>src_ip = "172.16.0.1" AND label = "PortScan"</code>
            </div>
          </div>
        </section>
        <section className="panel hunt-results">
          <PanelTitle
            icon={Activity}
            title="Hunt results"
            meta="6,913 matching flows"
            action={
              <button
                className="text-button"
                onClick={() => notify("Hunt results exported")}
              >
                Export CSV <Download size={13} />
              </button>
            }
          />
          <div className="hunt-chart">
            <div className="histogram">
              {[
                35, 48, 31, 66, 54, 78, 43, 82, 61, 92, 68, 74, 57, 88, 49, 71,
                64, 96, 59, 80, 43, 68,
              ].map((height, i) => (
                <i style={{ height: `${height}%` }} key={i} />
              ))}
            </div>
            <div className="chart-footer">
              <span>10:00</span>
              <span>10:15</span>
              <span>10:30</span>
              <span>10:45</span>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SOURCE IP</th>
                  <th>LABEL</th>
                  <th>DESTINATION</th>
                  <th>EVENTS</th>
                  <th>CONFIDENCE</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row[0]}-${row[1]}`}>
                    <td className="mono">{row[0]}</td>
                    <td>
                      <span className="severity high">{row[1]}</span>
                    </td>
                    <td className="mono">{row[2]}</td>
                    <td>{row[3]}</td>
                    <td className="confidence">{row[4]}</td>
                    <td>
                      <MoreHorizontal size={16} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
function CasesPage({ notify }) {
  const cases = [
    [
      "CASE-028",
      "Public web edge reconnaissance",
      "P1",
      "In progress",
      "analyst",
    ],
    [
      "CASE-027",
      "Repeated SSH authentication failures",
      "P2",
      "Awaiting approval",
      "secops",
    ],
    ["CASE-026", "Suspicious TLS SNI connection", "P2", "New", "unassigned"],
    ["CASE-022", "Contained web shell indicators", "P3", "Closed", "analyst"],
  ];
  return (
    <div className="page">
      <SectionHeader
        eyebrow="OPERATIONS / CASE MANAGEMENT"
        title="Cases"
        action={
          <button
            className="button primary"
            onClick={() => notify("New case draft created")}
          >
            <Plus size={15} /> New case
          </button>
        }
      />
      <div className="case-summary">
        <div>
          <span>OPEN CASES</span>
          <b>12</b>
          <small>+2 this week</small>
        </div>
        <div>
          <span>AWAITING APPROVAL</span>
          <b className="text-high">3</b>
          <small>oldest 18m</small>
        </div>
        <div>
          <span>HIGH PRIORITY</span>
          <b className="text-critical">4</b>
          <small>1 escalated</small>
        </div>
        <div>
          <span>CLOSED · 30D</span>
          <b>38</b>
          <small className="up">92% contained</small>
        </div>
      </div>
      <div className="case-board">
        {["New", "In progress", "Awaiting approval", "Closed"].map((column) => (
          <section className="case-column" key={column}>
            <div className="column-title">
              <span>{column}</span>
              <b>{cases.filter((item) => item[3] === column).length}</b>
              <button className="icon-button small">
                <Plus size={13} />
              </button>
            </div>
            {cases
              .filter((item) => item[3] === column)
              .map((item) => (
                <div className="case-card" key={item[0]}>
                  <div>
                    <b>{item[0]}</b>
                    <span className={`priority ${item[2].toLowerCase()}`}>
                      {item[2]}
                    </span>
                  </div>
                  <h3>{item[1]}</h3>
                  <div className="case-card-foot">
                    <span>
                      <UserRound size={12} /> {item[4]}
                    </span>
                    <span>
                      <Clock3 size={12} /> 14m
                    </span>
                  </div>
                </div>
              ))}
          </section>
        ))}
      </div>
    </div>
  );
}
function FlowsPage() {
  const flows = [
    [
      "10:42:18.221",
      "172.16.0.1",
      "48920",
      "192.168.10.50",
      "443",
      "TCP",
      "PortScan",
    ],
    [
      "10:42:18.190",
      "172.16.0.1",
      "51208",
      "192.168.10.19",
      "80",
      "TCP",
      "DoS Hulk",
    ],
    [
      "10:42:17.884",
      "192.168.10.14",
      "51322",
      "192.168.10.3",
      "53",
      "UDP",
      "BENIGN",
    ],
    [
      "10:42:16.707",
      "205.174.165.68",
      "60211",
      "192.168.10.8",
      "22",
      "TCP",
      "SSH-Patator",
    ],
    [
      "10:42:15.340",
      "172.16.0.1",
      "39104",
      "192.168.10.50",
      "443",
      "TCP",
      "Web Attack - XSS",
    ],
  ];
  return (
    <div className="page">
      <SectionHeader
        eyebrow="TELEMETRY / FLOW EXPLORER"
        title="Flows"
        action={
          <button className="button secondary">
            <Download size={14} /> Download selection
          </button>
        }
      />
      <div className="flow-note">
        <Database size={15} />
        <span>Flow-level data from CIC-IDS-2017 · raw PCAP not loaded</span>
        <span className="status-tag">
          <i className="status-dot green" /> replay connected
        </span>
      </div>
      <section className="panel table-panel">
        <SubpageToolbar placeholder="Filter by IP, port, protocol, or label…" />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>TIME</th>
                <th>SOURCE IP</th>
                <th>SPORT</th>
                <th>DESTINATION</th>
                <th>DPORT</th>
                <th>PROTO</th>
                <th>LABEL</th>
                <th>FEATURES</th>
              </tr>
            </thead>
            <tbody>
              {flows.map((flow) => (
                <tr key={`${flow[0]}-${flow[1]}`}>
                  <td className="mono muted">{flow[0]}</td>
                  <td className="mono">{flow[1]}</td>
                  <td className="mono">{flow[2]}</td>
                  <td className="mono">{flow[3]}</td>
                  <td className="mono">{flow[4]}</td>
                  <td>{flow[5]}</td>
                  <td>
                    <span
                      className={`severity ${flow[6] === "BENIGN" ? "low" : "high"}`}
                    >
                      {flow[6]}
                    </span>
                  </td>
                  <td>
                    <button className="text-button">
                      78 features <ArrowUpRight size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="flow-feature-grid">
        <section className="panel">
          <PanelTitle
            icon={Activity}
            title="Packet volume"
            meta="last 5 minutes"
          />
          <div className="feature-stat">
            <strong>18.4 GB</strong>
            <span>total bytes</span>
            <MiniChart color="#43a9ff" />
          </div>
        </section>
        <section className="panel">
          <PanelTitle
            icon={Network}
            title="Protocol mix"
            meta="current window"
          />
          <div className="protocol-bars">
            <div>
              <span>TCP</span>
              <i style={{ width: "78%" }} />
              <b>78%</b>
            </div>
            <div>
              <span>UDP</span>
              <i style={{ width: "18%" }} />
              <b>18%</b>
            </div>
            <div>
              <span>ICMP</span>
              <i style={{ width: "4%" }} />
              <b>4%</b>
            </div>
          </div>
        </section>
        <section className="panel">
          <PanelTitle
            icon={Target}
            title="Top destination ports"
            meta="by flow count"
          />
          <div className="port-list">
            <span>
              <b>443</b>
              <i style={{ width: "86%" }} />
            </span>
            <span>
              <b>80</b>
              <i style={{ width: "61%" }} />
            </span>
            <span>
              <b>22</b>
              <i style={{ width: "34%" }} />
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
function GridPage() {
  const services = [
    ["Replay engine", "Healthy", "4,280 flows/s", "12 ms"],
    ["Monitoring agent", "Healthy", "3,912 flows/s", "18 ms"],
    ["Detection agent", "Healthy", "98 alerts/s", "42 ms"],
    ["Reasoning agent", "Degraded", "12 calls/min", "1.8 s"],
    ["Knowledge retrieval", "Healthy", "46 queries/min", "84 ms"],
    ["PostgreSQL / pgvector", "Healthy", "8 connections", "3 ms"],
  ];
  return (
    <div className="page">
      <SectionHeader
        eyebrow="PLATFORM / SYSTEM HEALTH"
        title="Grid"
        action={
          <span className="live-indicator">
            <span className="pulse-dot" /> all systems monitored
          </span>
        }
      />
      <div className="health-banner">
        <div>
          <span className="status-dot green" />
          <strong>Platform operational</strong>
          <span>Last heartbeat 2 seconds ago</span>
        </div>
        <b>99.98% uptime</b>
      </div>
      <div className="service-grid">
        {services.map(([name, status, throughput, latency]) => (
          <section className="panel service-card" key={name}>
            <div className="service-head">
              <div
                className={`service-icon ${status === "Degraded" ? "degraded" : ""}`}
              >
                <Activity size={17} />
              </div>
              <span
                className={`health-pill ${status === "Degraded" ? "degraded" : ""}`}
              >
                <i /> {status}
              </span>
            </div>
            <h2>{name}</h2>
            <div className="service-metrics">
              <div>
                <span>THROUGHPUT</span>
                <b>{throughput}</b>
              </div>
              <div>
                <span>LATENCY</span>
                <b>{latency}</b>
              </div>
            </div>
            <MiniChart color={status === "Degraded" ? "#d29922" : "#2bc7a7"} />
          </section>
        ))}
      </div>
      <section className="panel model-registry">
        <PanelTitle
          icon={Database}
          title="Model registry"
          meta="3 active artifacts"
        />
        <div className="registry-row header">
          <span>MODEL</span>
          <span>VERSION</span>
          <span>F1 SCORE</span>
          <span>STATUS</span>
        </div>
        {[
          ["Binary attack classifier", "v2.4.1", "0.961", "Active"],
          ["Multiclass classifier", "v2.4.1", "0.947", "Active"],
          ["Isolation Forest anomaly", "v1.8.0", "0.913", "Active"],
        ].map((row) => (
          <div className="registry-row" key={row[0]}>
            <span>
              <b>{row[0]}</b>
              <small>trained 03 Nov 2026</small>
            </span>
            <span className="mono">{row[1]}</span>
            <span className="confidence">{row[2]}</span>
            <span className="status resolved">
              <i />
              {row[3]}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
function DownloadsPage({ notify }) {
  const files = [
    ["incident-1042-report.pdf", "Incident report", "1.8 MB", "Just now"],
    ["alerts-2026-11-04.csv", "Alert export", "842 KB", "12m ago"],
    ["model-card-v2.4.1.pdf", "Model card", "622 KB", "Yesterday"],
    ["flows-portscan-window.csv", "Flow export", "14.2 MB", "Yesterday"],
  ];
  return (
    <div className="page">
      <SectionHeader
        eyebrow="PLATFORM / ARTIFACTS"
        title="Downloads"
        action={
          <button
            className="button primary"
            onClick={() => notify("Report generation queued")}
          >
            <Plus size={15} /> Generate report
          </button>
        }
      />
      <div className="download-summary">
        <div>
          <Download size={18} />
          <span>AVAILABLE ARTIFACTS</span>
          <b>18</b>
        </div>
        <div>
          <FileSearch size={18} />
          <span>REPORTS THIS MONTH</span>
          <b>42</b>
        </div>
        <div>
          <Database size={18} />
          <span>MODEL ARTIFACTS</span>
          <b>6</b>
        </div>
      </div>
      <section className="panel table-panel">
        <PanelTitle
          icon={Download}
          title="Generated files"
          meta="retained for 30 days"
        />
        <div className="download-list">
          <div className="download-row header">
            <span>FILE</span>
            <span>TYPE</span>
            <span>SIZE</span>
            <span>CREATED</span>
            <span />
          </div>
          {files.map((file) => (
            <div className="download-row" key={file[0]}>
              <div className="file-name">
                <div className="file-icon">
                  <FileSearch size={15} />
                </div>
                <div>
                  <b>{file[0]}</b>
                  <small>Agentic NIDS workspace</small>
                </div>
              </div>
              <span>{file[1]}</span>
              <span className="mono">{file[2]}</span>
              <span className="muted">{file[3]}</span>
              <button
                className="icon-button small"
                onClick={() => notify(`${file[0]} download started`)}
              >
                <Download size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AdministrationPage({ notify }) {
  const [simulation, setSimulation] = useState(true);

  return (
    <div className="page">
      <SectionHeader
        eyebrow="PLATFORM / CONTROL PLANE"
        title="Administration"
        action={
          <span className="status-tag">
            <i className="status-dot green" /> changes saved automatically
          </span>
        }
      />
      <div className="admin-layout">
        <aside className="panel admin-tabs">
          <button className="active">
            <Settings2 size={15} /> Detection settings
          </button>
          <button>
            <Gauge size={15} /> Triage settings
          </button>
          <button>
            <Shield size={15} /> Response settings
          </button>
          <button>
            <Bot size={15} /> LLM settings
          </button>
          <button>
            <Play size={15} /> Replay settings
          </button>
          <button>
            <Users size={15} /> Users &amp; roles
          </button>
          <button>
            <Database size={15} /> Knowledge base
          </button>
          <button>
            <Clock3 size={15} /> Audit log
          </button>
        </aside>
        <section className="panel settings-panel">
          <div className="settings-header">
            <div>
              <div className="eyebrow">DETECTION SETTINGS</div>
              <h2>Model and scoring controls</h2>
              <p>
                Configure how the detection and prioritization agents score
                replayed network activity.
              </p>
            </div>
            <button
              className="button primary"
              onClick={() => notify("Detection settings saved")}
            >
              <Check size={15} /> Save changes
            </button>
          </div>
          <div className="setting-section">
            <h3>Active model</h3>
            <div className="setting-grid">
              <label>
                Binary classifier
                <select>
                  <option>binary-classifier-v2.4.1</option>
                  <option>binary-classifier-v2.3.8</option>
                </select>
              </label>
              <label>
                Multiclass classifier
                <select>
                  <option>multiclass-v2.4.1</option>
                  <option>multiclass-v2.3.8</option>
                </select>
              </label>
            </div>
          </div>
          <div className="setting-section">
            <h3>Alert thresholds</h3>
            <div className="slider-setting">
              <div>
                <b>Attack score threshold</b>
                <span>
                  Alerts are created when the model score exceeds this value.
                </span>
              </div>
              <div className="slider-value">
                <input type="range" min="0" max="100" defaultValue="72" />
                <b>0.72</b>
              </div>
            </div>
            <div className="slider-setting">
              <div>
                <b>Anomaly score threshold</b>
                <span>
                  Controls the unsupervised anomaly signal for benign flows.
                </span>
              </div>
              <div className="slider-value">
                <input type="range" min="0" max="100" defaultValue="64" />
                <b>0.64</b>
              </div>
            </div>
          </div>
          <div className="setting-section">
            <h3>Response safeguards</h3>
            <div className="toggle-setting">
              <div>
                <b>Simulation mode</b>
                <span>
                  Real network commands are disabled while this is enabled.
                </span>
              </div>
              <button
                className={`switch ${simulation ? "on" : ""}`}
                onClick={() => setSimulation(!simulation)}
              >
                <i />
              </button>
            </div>
            <div className="toggle-setting">
              <div>
                <b>Require approval for P1 and P2</b>
                <span>
                  Human approval remains required before simulated execution.
                </span>
              </div>
              <span className="switch on">
                <i />
              </span>
            </div>
          </div>
          <div className="setting-warning">
            <AlertTriangle size={16} />
            <span>
              <b>Simulation mode is recommended for replay datasets.</b> Actions
              will be logged and verified against the mock stream only.
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}

export {
  AlertsPage,
  WorkflowPage,
  ApprovalsPage,
  DetectionPage,
  AgentPage,
  DashboardPage,
  HuntPage,
  CasesPage,
  FlowsPage,
  GridPage,
  DownloadsPage,
  AdministrationPage,
};
