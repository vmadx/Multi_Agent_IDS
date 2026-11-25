export function SectionHeader({ eyebrow, title, action }) {
  return (
    <div className="section-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function KPI({ label, value, delta, tone, icon: Icon, children }) {
  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <span>{label}</span>
        <div className={`kpi-icon ${tone}`}>
          <Icon size={16} />
        </div>
      </div>
      <strong>{value}</strong>
      <div className="kpi-meta">
        <span className={delta?.startsWith("+") ? "up" : ""}>{delta}</span>
        <small>vs previous 24h</small>
      </div>
      {children}
    </div>
  );
}

export function MiniChart({ color = "#2bc7a7", fill = true }) {
  return (
    <svg className="mini-chart" viewBox="0 0 160 42" preserveAspectRatio="none">
      <path d="M0 34 C14 29 18 31 30 25 S48 30 61 19 S80 25 94 13 S112 18 126 8 S145 13 160 3" fill="none" stroke={color} strokeWidth="2" />
      <path d="M0 34 C14 29 18 31 30 25 S48 30 61 19 S80 25 94 13 S112 18 126 8 S145 13 160 3 V42 H0" fill={fill ? color : "none"} opacity=".1" />
    </svg>
  );
}

export function PanelTitle({ icon: Icon, title, meta, action }) {
  return (
    <div className="panel-title">
      <div className="panel-heading">
        <Icon size={16} />
        <h2>{title}</h2>
        <span>{meta}</span>
      </div>
      {action}
    </div>
  );
}

export function Status({ status }) {
  return (
    <span className={`status ${status}`}>
      <i />
      {status.replace("-", " ")}
    </span>
  );
}
