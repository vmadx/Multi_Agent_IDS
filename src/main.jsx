import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
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
import "./styles/index.css";
import { baseAlerts, incidents, workflow } from "./data/mockData";
import {
  KPI,
  MiniChart,
  PanelTitle,
  SectionHeader,
  Status,
} from "./components/ui";
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
function BriefcaseIcon(props) {
  return <Boxes {...props} />;
}

function App() {
  const [active, setActive] = useState("Overview");
  const [collapsed, setCollapsed] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [replay, setReplay] = useState(false);
  const [time, setTime] = useState(new Date());
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
      if (replay)
        setAlerts((current) =>
          [
            {
              ...baseAlerts[(current.length + 1) % baseAlerts.length],
              id: `AL-${Date.now()}`,
              time: new Date().toLocaleTimeString("en-GB"),
              status: "new",
            },
            ...current,
          ].slice(0, 8),
        );
    }, 5000);
    return () => clearInterval(timer);
  }, [replay]);
  const notify = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2800);
  };
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
          <div className="sample-badge">
            <span className="pulse-dot" /> CHECKPOINT MODE
          </div>
          <button className="replay-control" onClick={() => setReplay(!replay)}>
            {replay ? <Pause size={13} /> : <Play size={13} />}{" "}
            <span>REPLAY</span>
            <b>100×</b>
          </button>
          <button
            className="notification-button"
            aria-label="Notifications"
            onClick={() => setActive("Approvals")}
          >
            <Bell size={17} />
            <i>5</i>
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
                  {label === "Approvals" && <em>5</em>}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="sidebar-foot">
          <div className="system-status">
            <span className="status-dot green" />
            <span>All systems nominal</span>
          </div>
          <div className="version">v1.0.0 · simulation mode</div>
        </div>
      </aside>
      <main className="main-content">
        <Page
          active={active}
          alerts={alerts}
          replay={replay}
          setReplay={setReplay}
          notify={notify}
          time={time}
          setActive={setActive}
          setAlerts={setAlerts}
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

function Page({ active, alerts, replay, setReplay, notify, time, setActive, setAlerts }) {
  if (active === "Hunt") return <HuntPage notify={notify} />;
  if (active === "Cases") return <CasesPage notify={notify} />;
  if (active === "Flows") return <FlowsPage />;
  if (active === "Grid") return <GridPage />;
  if (active === "Downloads") return <DownloadsPage notify={notify} />;
  if (active === "Administration")
    return <AdministrationPage notify={notify} />;
  if (active === "Alerts")
    return <AlertsPage alerts={alerts} notify={notify} setActive={setActive} />;
  if (active === "Workflow") return <WorkflowPage />;
  if (active === "Approvals") return <ApprovalsPage notify={notify} />;
  if (active === "Detections") return <DetectionPage notify={notify} />;
  if (active === "Agent AI") return <AgentPage notify={notify} />;
  if (active === "Dashboards") return <DashboardPage />;
  return (
    <Overview
      alerts={alerts}
      replay={replay}
      setReplay={setReplay}
      time={time}
      setActive={setActive}
      setAlerts={setAlerts}
      notify={notify}
    />
  );
}

createRoot(document.getElementById("root")).render(<App />);
