import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bell,
  Bot,
  CheckCircle2,
  ChevronDown,
  GitBranch,
  Home,
  Menu,
  PanelLeftClose,
  Shield,
} from "lucide-react";
import "./styles/index.css";
import { nidsApi } from "./api/provider";
import Overview from "./pages/Overview";
import {
  AdministrationPage,
  AgentPage,
  AlertsPage,
  ApprovalsPage,
  CasesPage,
  DashboardPage,
  DetectionPage,
  DownloadsPage,
  FlowsPage,
  GridPage,
  HuntPage,
  WorkflowPage,
} from "./pages/Operations";

const navGroups = [
  {
    label: "Operations",
    items: [
      ["Overview", Home],
      ["Agent AI", Bot],
      ["Alerts", Bell],
      ["Workflow", GitBranch],
      ["Approvals", CheckCircle2],
    ],
  },
];

function App() {
  const [active, setActive] = useState("Overview");
  const [collapsed, setCollapsed] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [health, setHealth] = useState(null);
  const [dataError, setDataError] = useState("");
  const [scan, setScan] = useState(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState("");
  const [toast, setToast] = useState(null);
  const scanIsActive = ["uploading", "queued", "processing"].includes(scan?.status);

  const refreshDashboard = useCallback(async () => {
    const [healthResult, summaryResult, alertsResult, incidentsResult] =
      await Promise.allSettled([
        nidsApi.health(),
        nidsApi.summary(),
        nidsApi.alerts(),
        nidsApi.incidents(),
      ]);
    const failed = [];
    if (healthResult.status === "fulfilled") setHealth(healthResult.value);
    else failed.push(healthResult.reason);
    if (summaryResult.status === "fulfilled") setSummary(summaryResult.value);
    else failed.push(summaryResult.reason);
    if (alertsResult.status === "fulfilled") setAlerts(alertsResult.value);
    else failed.push(alertsResult.reason);
    if (incidentsResult.status === "fulfilled") setIncidents(incidentsResult.value);
    else failed.push(incidentsResult.reason);
    setDataError(failed[0]?.message || "");
  }, []);

  useEffect(() => {
    refreshDashboard();
    const timer = setInterval(refreshDashboard, 15000);
    return () => clearInterval(timer);
  }, [refreshDashboard]);

  const notify = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2800);
  };
  const apiConnected = health?.status === "healthy";
  const storageStatus = health === null
    ? "CONNECTING..."
    : health.storage_backend === "supabase"
      ? "SUPABASE CONNECTED"
      : apiConnected ? "LOCAL STORAGE" : "API OFFLINE";
  const pendingCount = summary?.open_incidents || 0;

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          className="icon-button menu-button"
          aria-label="Toggle navigation"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <Menu /> : <PanelLeftClose />}
        </button>
        <div className="brand">
          <div className="brand-mark">
            <Shield size={17} />
          </div>
          <div>
            <strong>AGENTIC NIDS</strong>
            <span>autonomous security operations</span>
          </div>
        </div>
        <div className="top-divider" />
        <div className="page-context">
          <span>SECURITY CONSOLE</span>
          <strong>{active.toUpperCase()}</strong>
        </div>
        <div className="top-actions">
          {scanIsActive && (
            <button
              className="scan-status-button"
              onClick={() => setActive("Overview")}
              title="View active traffic scan"
            >
              <span className="pulse-dot" />
              <span>
                {scan.stage === "agents"
                  ? `TRIAGE ${scan.agent_processed || 0}/${scan.agent_total || 0}`
                  : `SCAN ${scan.progress || 0}%`}
              </span>
            </button>
          )}
          <div className="sample-badge">
            <span className={`pulse-dot ${apiConnected ? "" : "muted"}`} />
            {storageStatus}
          </div>
          <button
            className="notification-button"
            aria-label={`${pendingCount} pending approvals`}
            onClick={() => setActive("Approvals")}
          >
            <Bell size={17} />
            {pendingCount > 0 && <i>{pendingCount > 99 ? "99+" : pendingCount}</i>}
          </button>
          <div className="user-chip">
            <div className="avatar">AR</div>
            <span>analyst</span>
            <ChevronDown size={14} />
          </div>
        </div>
      </header>
      <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
        <div className="sidebar-scroll">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <span className="nav-label">{group.label}</span>
              {group.items.map(([label, Icon]) => (
                <button
                  key={label}
                  className={`nav-item ${active === label ? "active" : ""}`}
                  onClick={() => setActive(label)}
                  title={label}
                >
                  <Icon size={17} />
                  <span>{label}</span>
                  {label === "Approvals" && pendingCount > 0 && (
                    <em>{pendingCount > 99 ? "99+" : pendingCount}</em>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="sidebar-foot">
          <div className="system-status">
            <span className={`status-dot ${apiConnected ? "green" : "muted"}`} />
            <span>
              {health === null ? "Checking API..." : apiConnected ? "API connected" : "API unavailable"}
            </span>
          </div>
          <div className="version">v1.0.0 · simulation mode</div>
        </div>
      </aside>
      <main className="main-content">
        <Page
          active={active}
          alerts={alerts}
          notify={notify}
          summary={summary}
          incidents={incidents}
          health={health}
          dataError={dataError}
          refreshDashboard={refreshDashboard}
          setActive={setActive}
          setAlerts={setAlerts}
          scan={scan}
          setScan={setScan}
          selectedIncidentId={selectedIncidentId}
          setSelectedIncidentId={setSelectedIncidentId}
        />
      </main>
      <footer className="footer">
        <span>
          AGENTIC NIDS <b>·</b> v1.0.0
        </span>
        <span>
          © 2026 <a href="#">Agentic NIDS</a>
        </span>
        <span>
          SIMULATION MODE <b className="footer-dot" />{" "}
          <a href="#">MIT LICENSE</a>
        </span>
      </footer>
      {toast && (
        <div className="toast">
          <CheckCircle2 size={16} /> {toast}
        </div>
      )}
    </div>
  );
}

function Page({
  active,
  alerts,
  notify,
  summary,
  incidents,
  health,
  dataError,
  refreshDashboard,
  setActive,
  setAlerts,
  scan,
  setScan,
  selectedIncidentId,
  setSelectedIncidentId,
}) {
  if (active === "Hunt") return <HuntPage notify={notify} />;
  if (active === "Cases") return <CasesPage notify={notify} />;
  if (active === "Flows") return <FlowsPage />;
  if (active === "Grid") return <GridPage />;
  if (active === "Downloads") return <DownloadsPage notify={notify} />;
  if (active === "Administration")
    return <AdministrationPage notify={notify} />;
  if (active === "Alerts")
    return (
      <AlertsPage
        alerts={alerts}
        summary={summary}
        setActive={setActive}
        setSelectedIncidentId={setSelectedIncidentId}
        refreshDashboard={refreshDashboard}
      />
    );
  if (active === "Workflow") {
    return (
      <WorkflowPage
        incidents={incidents}
        selectedIncidentId={selectedIncidentId}
        setSelectedIncidentId={setSelectedIncidentId}
      />
    );
  }
  if (active === "Approvals") {
    return (
      <ApprovalsPage
        incidents={incidents}
        selectedIncidentId={selectedIncidentId}
        notify={notify}
        refreshDashboard={refreshDashboard}
      />
    );
  }
  if (active === "Detections") return <DetectionPage notify={notify} />;
  if (active === "Agent AI") return <AgentPage notify={notify} health={health} />;
  if (active === "Dashboards") return <DashboardPage />;
  return (
    <Overview
      alerts={alerts}
      summary={summary}
      dataError={dataError}
      refreshDashboard={refreshDashboard}
      setActive={setActive}
      setAlerts={setAlerts}
      notify={notify}
      scan={scan}
      setScan={setScan}
    />
  );
}

createRoot(document.getElementById("root")).render(<App />);
