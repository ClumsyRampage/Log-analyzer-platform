import { useState, useEffect, useRef } from "react";
import { SERVICE_CONFIG } from "./serviceConfig";

const COLORS = {
  critical: "#E24B4A",
  high: "#EF9F27",
  medium: "#378ADD",
  low: "#1D9E75",
  info: "#534AB7",
  success: "#639922",
};

const SERVICES = [SERVICE_CONFIG];

const LOG_POOL = [
  {
    level: "ERROR",
    service: SERVICE_CONFIG.name,
    msg: `Failed to connect to ${SERVICE_CONFIG.baseUrl}${SERVICE_CONFIG.healthPath}`,
    traceId: "trace-01",
    endpoint: SERVICE_CONFIG.endpoints[0] || "/",
    latency: 1203,
  },
  {
    level: "WARN",
    service: SERVICE_CONFIG.name,
    msg: `Slow response detected for ${SERVICE_CONFIG.endpoints[1] || "/"}`,
    traceId: "trace-02",
    endpoint: SERVICE_CONFIG.endpoints[1] || "/",
    latency: 590,
  },
  {
    level: "INFO",
    service: SERVICE_CONFIG.name,
    msg: "Health check returned 200 OK",
    traceId: "trace-03",
    endpoint: SERVICE_CONFIG.healthPath,
    latency: 42,
  },
];

const LOG_INSIGHTS = [
  {
    match: (msg) => msg.includes("Failed to connect"),
    title: "Service connectivity issue",
    rootCause: "The service health endpoint is not reachable, indicating a possible network, firewall, or service startup problem.",
    fixes: [
      "Verify the service host and port are correct",
      "Confirm the health endpoint is reachable from the dashboard host",
      "Check service logs for startup or network errors",
    ],
  },
  {
    match: (msg) => msg.includes("Slow response"),
    title: "Endpoint latency spike",
    rootCause: "A request path is returning slowly, which can cause increased error rates and poor user experience.",
    fixes: [
      "Inspect the service for expensive database or external calls",
      "Add request timeouts and retry logic where appropriate",
      "Monitor the endpoint to identify the slowest operations",
    ],
  },
];

function getLogInsight(log) {
  const insight = LOG_INSIGHTS.find((item) => item.match(log.msg));
  if (insight) return insight;
  return {
    title: "Review the selected log",
    rootCause: "Use the log details and trace identifier to investigate service behavior.",
    fixes: [
      "Check the service logs for the selected trace id",
      "Compare current traffic with health metrics",
      "Validate endpoint and configuration settings",
    ],
  };
}

const INCIDENTS = [
  {
    id: "INC-001",
    time: "14:35",
    status: "open",
    severity: SERVICE_CONFIG.status === "healthy" ? "medium" : SERVICE_CONFIG.status,
    title: `${SERVICE_CONFIG.displayName} health check failed`,
    services: 1,
  },
];

const TREND_DATA = {
  labels: ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "14:30"],
  errors: [2, 4, 1, 3, 8, 7, 5],
  warnings: [1, 2, 2, 2, 3, 2, 4],
  throughput: [450, 520, 480, 500, 470, 430, 410],
};

const DEPS = [
  { from: "api-gateway", to: SERVICE_CONFIG.name, healthy: SERVICE_CONFIG.status === "healthy" },
];

function Badge({ status }) {
  const cfg = {
    critical: { bg: "#FCEBEB", color: "#A32D2D", label: "CRITICAL" },
    high: { bg: "#FAEEDA", color: "#854F0B", label: "HIGH" },
    warning: { bg: "#FAEEDA", color: "#854F0B", label: "WARN" },
    medium: { bg: "#E6F1FB", color: "#185FA5", label: "MEDIUM" },
    low: { bg: "#EAF3DE", color: "#3B6D11", label: "LOW" },
    healthy: { bg: "#EAF3DE", color: "#3B6D11", label: "HEALTHY" },
    investigating: { bg: "#FAEEDA", color: "#854F0B", label: "INVEST." },
    open: { bg: "#FCEBEB", color: "#A32D2D", label: "OPEN" },
    resolved: { bg: "#EAF3DE", color: "#3B6D11", label: "RESOLVED" },
    info: { bg: "#EEEDFE", color: "#3C3489", label: "INFO" },
  };
  const c = cfg[status] || cfg.info;
  return (
    <span style={{ background: c.bg, color: c.color, padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", fontFamily: "monospace" }}>
      {c.label}
    </span>
  );
}

function MiniBar({ value, max = 100, color }) {
  return (
    <div style={{ background: "#f1efe8", borderRadius: 3, height: 6, width: "100%", overflow: "hidden" }}>
      <div style={{ width: `${(value / max) * 100}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.5s" }} />
    </div>
  );
}

function ServiceCard({ svc, selected, onClick }) {
  const statusColor = { critical: COLORS.critical, warning: COLORS.high, healthy: COLORS.success }[svc.status] || COLORS.info;
  return (
    <div onClick={onClick} style={{ background: selected ? "#E6F1FB" : "white", border: `1px solid ${selected ? "#378ADD" : "#e0ded7"}`, borderRadius: 10, padding: "12px 14px", cursor: "pointer", transition: "all 0.15s", borderLeft: `4px solid ${statusColor}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#2c2c2a", fontFamily: "monospace" }}>{svc.displayName}</span>
        <Badge status={svc.status} />
      </div>
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#73726c", marginBottom: 3 }}>
          <span>Health</span><span style={{ color: statusColor, fontWeight: 600 }}>{svc.health}%</span>
        </div>
        <MiniBar value={svc.health} color={statusColor} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginTop: 8 }}>
        {[ ["RPS", svc.rps.toLocaleString()], ["Errors", svc.errors], ["P99ms", svc.latency] ].map(([l, v]) => (
          <div key={l} style={{ background: "#f8f7f2", borderRadius: 5, padding: "4px 6px", textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#888780", textTransform: "uppercase", letterSpacing: "0.05em" }}>{l}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#2c2c2a", fontFamily: "monospace" }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LogStream({ filter, selectedLog, onSelectLog }) {
  const [logs, setLogs] = useState(() => Array.from({ length: 12 }, (_, i) => ({
    id: i,
    ...LOG_POOL[i % LOG_POOL.length],
    ts: new Date(Date.now() - (12 - i) * 4500).toISOString(),
  })));
  const bottomRef = useRef();

  useEffect(() => {
    const timer = setInterval(() => {
      setLogs((prev) => {
        const entry = LOG_POOL[Math.floor(Math.random() * LOG_POOL.length)];
        const next = [...prev.slice(-49), { id: Date.now(), ...entry, ts: new Date().toISOString() }];
        return next;
      });
    }, 1800);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const levelColor = { ERROR: COLORS.critical, FATAL: "#791F1F", WARN: COLORS.high, INFO: COLORS.info, DEBUG: "#888780" };
  const filtered = filter === "ALL" ? logs : logs.filter((l) => l.level === filter || l.service === filter);
  const insight = selectedLog ? getLogInsight(selectedLog) : null;

  return (
    <div style={{ fontFamily: "monospace", fontSize: 11 }}>
      <div style={{ height: 360, overflowY: "auto", background: "#1a1918", borderRadius: 8, padding: "10px 0" }}>
        {filtered.map((log) => {
          const isSelected = selectedLog?.id === log.id;
          return (
            <div key={log.id} onClick={() => onSelectLog(log)} style={{ padding: "3px 14px", display: "flex", gap: 8, alignItems: "flex-start", borderBottom: "1px solid #2c2c2a", cursor: "pointer", background: isSelected ? "rgba(83, 74, 183, 0.18)" : "transparent" }}>
              <span style={{ color: "#5f5e5a", minWidth: 86, flexShrink: 0 }}>{log.ts.slice(11, 23)}</span>
              <span style={{ color: levelColor[log.level] || "#aaa", minWidth: 46, fontWeight: 700, flexShrink: 0 }}>{log.level}</span>
              <span style={{ color: "#9F96E8", minWidth: 120, flexShrink: 0 }}>{log.service}</span>
              <span style={{ color: "#5DCAA5", minWidth: 80, flexShrink: 0 }}>#{log.traceId}</span>
              <span style={{ color: "#D3D1C7", flex: 1 }}>{log.msg}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {insight && (
        <div style={{ marginTop: 12, border: "1px solid #e0ded7", borderRadius: 10, background: "white", padding: 16 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: levelColor[selectedLog.level] || "#888" }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#2c2c2a" }}>Selected log guidance</div>
              <div style={{ fontSize: 11, color: "#73726c" }}>Click any log to see root cause and fix advice.</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div style={{ background: "#f8f7f2", borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 10, color: "#73726c", marginBottom: 4 }}>Service</div>
              <div style={{ fontFamily: "monospace", fontSize: 12, color: "#2c2c2a" }}>{selectedLog.service}</div>
            </div>
            <div style={{ background: "#f8f7f2", borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 10, color: "#73726c", marginBottom: 4 }}>Endpoint</div>
              <div style={{ fontFamily: "monospace", fontSize: 12, color: "#2c2c2a" }}>{selectedLog.endpoint}</div>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#534AB7", marginBottom: 6 }}>Root Cause</div>
            <p style={{ margin: 0, color: "#3d3d3a", fontSize: 12, lineHeight: 1.6 }}>{insight.rootCause}</p>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#0F6E56", marginBottom: 6 }}>Suggested Fixes</div>
            <div style={{ display: "grid", gap: 8 }}>
              {insight.fixes.map((fix, index) => (
                <div key={index} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ minWidth: 18, height: 18, borderRadius: 18, background: COLORS.success, color: "white", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>{index + 1}</span>
                  <span style={{ fontSize: 12, color: "#2c2c2a", lineHeight: 1.5 }}>{fix}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RCACard({ rca, expanded, onToggle }) {
  const sev = { critical: { border: COLORS.critical, bg: "#FCEBEB", tc: "#A32D2D" }, high: { border: COLORS.high, bg: "#FAEEDA", tc: "#854F0B" } }[rca.severity] || { border: COLORS.info, bg: "#EEEDFE", tc: "#3C3489" };
  return (
    <div style={{ border: `1px solid ${sev.border}`, borderLeft: `4px solid ${sev.border}`, borderRadius: 10, marginBottom: 12, background: "white", overflow: "hidden" }}>
      <div onClick={onToggle} style={{ padding: "14px 16px", cursor: "pointer", display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <span style={{ background: sev.bg, color: sev.tc, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, fontFamily: "monospace" }}>{rca.id}</span>
            <Badge status={rca.severity} />
            <span style={{ fontSize: 11, color: "#73726c", marginLeft: "auto" }}>{rca.timestamp.slice(11, 19)} UTC</span>
          </div>
          <div style={{ fontWeight: 600, fontSize: 13, color: "#2c2c2a", marginBottom: 4 }}>{rca.title}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {rca.services.map((s) => (
              <span key={s} style={{ background: "#EEEDFE", color: "#3C3489", fontSize: 10, padding: "1px 6px", borderRadius: 4, fontFamily: "monospace" }}>{s}</span>
            ))}
          </div>
        </div>
        <div style={{ textAlign: "center", background: "#f8f7f2", borderRadius: 8, padding: "8px 12px", minWidth: 56 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: rca.confidence > 90 ? COLORS.critical : COLORS.high }}>{rca.confidence}%</div>
          <div style={{ fontSize: 9, color: "#73726c", letterSpacing: "0.05em" }}>CONF</div>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: "0 16px 16px", borderTop: "1px solid #f1efe8" }}>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#534AB7", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>🤖 AI Summary</div>
            <p style={{ fontSize: 12, color: "#3d3d3a", lineHeight: 1.65, margin: 0, background: "#f8f7f2", padding: "10px 12px", borderRadius: 8 }}>{rca.summary}</p>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#185FA5", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>🔍 Root Cause</div>
            <p style={{ fontSize: 12, color: "#3d3d3a", lineHeight: 1.65, margin: 0 }}>{rca.rootCause}</p>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#0F6E56", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>🔧 Remediation Steps</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {rca.remediation.map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: "#2c2c2a" }}>
                  <span style={{ background: "#1D9E75", color: "white", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ fontFamily: "monospace", background: "#f0faf5", padding: "2px 8px", borderRadius: 4, flex: 1 }}>{r}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <div style={{ flex: 1, background: "#f8f7f2", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 10, color: "#73726c", marginBottom: 3 }}>Trace ID</div>
              <div style={{ fontFamily: "monospace", fontSize: 11, color: "#534AB7" }}>{rca.traceId}</div>
            </div>
            {rca.affectedEndpoints.map((ep) => (
              <div key={ep} style={{ flex: 2, background: "#f8f7f2", borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ fontSize: 10, color: "#73726c", marginBottom: 3 }}>Affected Endpoint</div>
                <div style={{ fontFamily: "monospace", fontSize: 11, color: "#185FA5" }}>{ep}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DependencyGraph() {
  const positions = {
    "api-gateway": [300, 40],
    [SERVICE_CONFIG.name]: [300, 180],
  };
  const statusColor = (name) => {
    const svc = SERVICES.find((s) => s.name === name);
    return { critical: COLORS.critical, warning: COLORS.high, healthy: COLORS.success }[svc?.status] || "#888";
  };

  return (
    <svg viewBox="0 0 640 260" width="100%" style={{ display: "block" }}>
      <defs>
        <marker id="dep-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
      </defs>
      {DEPS.map((dep, i) => {
        const [x1, y1] = positions[dep.from];
        const [x2, y2] = positions[dep.to];
        const stroke = dep.healthy ? "#B4B2A9" : COLORS.critical;
        return (
          <line key={i} x1={x1} y1={y1 + 18} x2={x2} y2={y2 - 18} stroke={stroke} strokeWidth={dep.healthy ? 1 : 2} strokeDasharray={dep.healthy ? "none" : "4 3"} markerEnd="url(#dep-arrow)" opacity={0.7} />
        );
      })}
      {Object.entries(positions).map(([name, [cx, cy]]) => {
        const color = statusColor(name);
        const svc = SERVICES.find((s) => s.name === name);
        return (
          <g key={name}>
            <rect x={cx - 62} y={cy - 18} width={124} height={36} rx={6} fill={color + "18"} stroke={color} strokeWidth={1} />
            <text x={cx} y={cy - 3} textAnchor="middle" fontSize={10} fontWeight={600} fill={color} fontFamily="monospace">
              {name.replace("-service", "").replace("-", " ")}
            </text>
            <text x={cx} y={cy + 10} textAnchor="middle" fontSize={9} fill="#888780" fontFamily="monospace">
              {svc ? `P99: ${svc.latency}ms | ${svc.errors} err` : ""}
            </text>
          </g>
        );
      })}
      <text x={16} y={260} fontSize={10} fill="#888780" fontFamily="monospace">● Healthy  </text>
      <text x={80} y={260} fontSize={10} fill={COLORS.critical} fontFamily="monospace">✕ Degraded path</text>
    </svg>
  );
}

function TrendChart() {
  const canvasRef = useRef();
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const w = (canvasRef.current.width = canvasRef.current.offsetWidth * 2);
    const h = (canvasRef.current.height = 180);
    ctx.scale(2, 1);
    const W = w / 2;
    const H = h;
    const pad = { t: 20, r: 20, b: 30, l: 40 };
    const data = TREND_DATA;
    const maxErr = Math.max(...data.errors, ...data.warnings) * 1.2;

    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = "#e0ded7";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (H - pad.t - pad.b) * (i / 4);
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(W - pad.r, y);
      ctx.stroke();
      ctx.fillStyle = "#888780";
      ctx.font = "9px monospace";
      ctx.textAlign = "right";
      ctx.fillText(Math.round(maxErr * (1 - i / 4)), pad.l - 4, y + 3);
    }
    data.labels.forEach((label, i) => {
      const x = pad.l + ((W - pad.l - pad.r) * i) / (data.labels.length - 1);
      ctx.fillStyle = "#888780";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(label, x, H - 5);
    });

    const plotLine = (values, color, fill) => {
      const pts = values.map((v, i) => [pad.l + ((W - pad.l - pad.r) * i) / (values.length - 1), pad.t + (H - pad.t - pad.b) * (1 - v / maxErr)]);
      if (fill) {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], H - pad.b);
        pts.forEach(([x, y]) => ctx.lineTo(x, y));
        ctx.lineTo(pts[pts.length - 1][0], H - pad.b);
        ctx.closePath();
        ctx.fillStyle = color + "28";
        ctx.fill();
      }
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      pts.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      });
    };
    plotLine(data.errors, COLORS.critical, true);
    plotLine(data.warnings, COLORS.high, true);
  }, []);

  return (
    <div>
      <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
        {[["Errors", COLORS.critical], ["Warnings", COLORS.high]].map(([l, c]) => (
          <span key={l} style={{ fontSize: 11, color: "#73726c", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: c, display: "inline-block" }} />{l}
          </span>
        ))}
      </div>
      <canvas ref={canvasRef} style={{ width: "100%", height: 90 }} />
    </div>
  );
}

function AlertsPanel() {
  const [alerts, setAlerts] = useState([
    { id: 1, time: "14:35:22", svc: SERVICE_CONFIG.name, rule: "ErrorRate > 5%", val: "7.2%", sev: SERVICE_CONFIG.status === "critical" ? "critical" : "high", ack: false },
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {alerts.map((a) => (
        <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: a.ack ? "#f8f7f2" : "white", border: `1px solid ${a.ack ? "#e0ded7" : { critical: COLORS.critical, high: COLORS.high, medium: COLORS.medium }[a.sev]}`, borderLeft: `4px solid ${a.ack ? "#B4B2A9" : { critical: COLORS.critical, high: COLORS.high, medium: COLORS.medium }[a.sev]}`, borderRadius: 8, opacity: a.ack ? 0.6 : 1 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
              <Badge status={a.sev} />
              <span style={{ fontFamily: "monospace", fontSize: 11, color: "#534AB7" }}>{a.svc}</span>
              <span style={{ fontSize: 10, color: "#73726c", marginLeft: "auto" }}>{a.time}</span>
            </div>
            <div style={{ fontSize: 12, color: "#2c2c2a" }}>{a.rule} <span style={{ fontFamily: "monospace", color: { critical: COLORS.critical, high: COLORS.high, medium: COLORS.medium }[a.sev] }}>({a.val})</span></div>
          </div>
          {!a.ack && (
            <button onClick={() => setAlerts((prev) => prev.map((x) => (x.id === a.id ? { ...x, ack: true } : x)))} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 5, border: "1px solid #e0ded7", background: "transparent", cursor: "pointer", color: "#73726c" }}>
              ACK
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function MetricCard({ label, value, sub, color, icon }) {
  return (
    <div style={{ background: "white", border: "1px solid #e0ded7", borderRadius: 10, padding: "14px 16px", borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, color: "#73726c", marginBottom: 4 }}>{icon} {label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "#2c2c2a", fontFamily: "monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#888780", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

const SCREENS = ["Overview", "RCA Analysis", "Service Map", "Incident Log", "Log Stream", "Alerts", "Trends"];

export default function App() {
  const [screen, setScreen] = useState("Overview");
  const [expandedRCA, setExpandedRCA] = useState("INC-001");
  const [selectedSvc, setSelectedSvc] = useState(null);
  const [logFilter, setLogFilter] = useState("ALL");
  const [selectedLog, setSelectedLog] = useState(null);
  const [live, setLive] = useState(true);

  const totalErrors = SERVICES.reduce((a, s) => a + s.errors, 0);
  const criticalCount = SERVICES.filter((s) => s.status === "critical").length;
  const totalRPS = SERVICES.reduce((a, s) => a + s.rps, 0);

  const AI_RCAS = [
    {
      id: "INC-001",
      title: `Service availability issue detected for ${SERVICE_CONFIG.displayName}`,
      severity: SERVICE_CONFIG.status === "critical" ? "critical" : "high",
      services: [SERVICE_CONFIG.name],
      traceId: "trace-01",
      summary: `The monitored service is having connectivity issues and increased latency on ${SERVICE_CONFIG.endpoints[0]}.`,
      rootCause: "The service is failing its health check or slow endpoint, which may indicate network or resource issues.",
      remediation: [
        "Verify service URL and health endpoint configuration.",
        "Check service logs for startup or runtime failures.",
        "Confirm the service can reach downstream dependencies.",
      ],
      confidence: 91,
      affectedEndpoints: SERVICE_CONFIG.endpoints,
      timestamp: new Date().toISOString(),
    },
  ];

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#f4f2ec", minHeight: "100vh", color: "#2c2c2a" }}>
      <div style={{ background: "#1a1918", padding: "0 20px", display: "flex", alignItems: "center", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 0", marginRight: 24, borderRight: "1px solid #2c2c2a", paddingRight: 24 }}>
          <div style={{ width: 28, height: 28, background: "linear-gradient(135deg, #534AB7, #9F96E8)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>⚡</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "white", letterSpacing: "0.02em" }}>LogIntel</div>
            <div style={{ fontSize: 9, color: "#5f5e5a", letterSpacing: "0.1em", textTransform: "uppercase" }}>AI Observability Platform</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 0, flex: 1, overflowX: "auto" }}>
          {SCREENS.map((s) => (
            <button key={s} onClick={() => setScreen(s)} style={{ padding: "16px 14px", background: "transparent", border: "none", cursor: "pointer", fontSize: 12, fontWeight: screen === s ? 600 : 400, color: screen === s ? "white" : "#5f5e5a", borderBottom: screen === s ? "2px solid #9F96E8" : "2px solid transparent", whiteSpace: "nowrap", transition: "all 0.15s" }}>
              {s}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", paddingLeft: 16 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: live ? "#1D9E75" : "#888", animation: live ? "pulse 1.5s infinite" : "none" }} />
          <span style={{ fontSize: 11, color: live ? "#5DCAA5" : "#888" }}>{live ? "LIVE" : "PAUSED"}</span>
          <button onClick={() => setLive((l) => !l)} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 5, border: "1px solid #2c2c2a", background: "transparent", cursor: "pointer", color: "#73726c", marginLeft: 4 }}>
            {live ? "⏸ Pause" : "▶ Resume"}
          </button>
        </div>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>

      <div style={{ padding: "20px" }}>
        {screen === "Overview" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
              <MetricCard label="Total Errors (1h)" value={totalErrors} sub="Live count" color={COLORS.critical} icon="🔴" />
              <MetricCard label="Critical Services" value={criticalCount} sub={`of ${SERVICES.length}`} color={COLORS.high} icon="⚠️" />
              <MetricCard label="Request/s" value={totalRPS.toLocaleString()} sub="Service traffic" color={COLORS.info} icon="📶" />
              <MetricCard label="Open Incidents" value={INCIDENTS.filter((i) => i.status !== "resolved").length} sub="Need attention" color={COLORS.critical} icon="🚨" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div style={{ background: "white", border: "1px solid #e0ded7", borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Service Health</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                  {SERVICES.map((svc) => (
                    <ServiceCard key={svc.name} svc={svc} selected={selectedSvc === svc.name} onClick={() => setSelectedSvc(selectedSvc === svc.name ? null : svc.name)} />
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ background: "white", border: "1px solid #e0ded7", borderRadius: 10, padding: 16, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Recent Incident</div>
                  {INCIDENTS.slice(0, 1).map((inc) => (
                    <div key={inc.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f1efe8" }}>
                      <Badge status={inc.severity} />
                      <Badge status={inc.status} />
                      <span style={{ fontSize: 12, flex: 1, color: "#2c2c2a" }}>{inc.title}</span>
                      <span style={{ fontSize: 10, color: "#73726c", fontFamily: "monospace" }}>{inc.time}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: "white", border: "1px solid #e0ded7", borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Error Trend</div>
                  <TrendChart />
                </div>
              </div>
            </div>
            <div style={{ background: "#1a1918", border: "1px solid #2c2c2a", borderRadius: 10, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "white" }}>Live Log Stream</span>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#1D9E75", animation: "pulse 1.5s infinite" }} />
                <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                  {["ALL", "ERROR", "WARN", "INFO"].map((f) => (
                    <button key={f} onClick={() => setLogFilter(f)} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid #2c2c2a", background: logFilter === f ? "#534AB7" : "transparent", color: logFilter === f ? "white" : "#73726c", cursor: "pointer", fontFamily: "monospace" }}>{f}</button>
                  ))}
                </div>
              </div>
              <LogStream filter={logFilter} selectedLog={selectedLog} onSelectLog={setSelectedLog} />
            </div>
          </div>
        )}

        {screen === "RCA Analysis" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <MetricCard label="AI Analysis" value="Active" sub="Configured" color={COLORS.info} icon="🤖" />
              <MetricCard label="Incidents" value={INCIDENTS.length} sub="Monitored service" color={COLORS.critical} icon="📌" />
              <MetricCard label="Remediations" value={AI_RCAS[0].remediation.length} sub="Suggested" color={COLORS.success} icon="✅" />
            </div>
            <div style={{ background: "white", border: "1px solid #e0ded7", borderRadius: 10, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>AI Root Cause Analysis</span>
                <span style={{ fontSize: 11, color: "#73726c" }}>Single-service view</span>
              </div>
              {AI_RCAS.map((rca) => (
                <RCACard key={rca.id} rca={rca} expanded={expandedRCA === rca.id} onToggle={() => setExpandedRCA(expandedRCA === rca.id ? null : rca.id)} />
              ))}
            </div>
          </div>
        )}

        {screen === "Service Map" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>
            <div style={{ background: "white", border: "1px solid #e0ded7", borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Service Dependency Graph</div>
              <div style={{ fontSize: 11, color: "#73726c", marginBottom: 16 }}>Single service topology</div>
              <DependencyGraph />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: "white", border: "1px solid #e0ded7", borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Service Status</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {SERVICES.map((svc) => (
                    <div key={svc.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6, background: "#f8f7f2" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: { critical: COLORS.critical, warning: COLORS.high, healthy: COLORS.success }[svc.status] }} />
                      <span style={{ fontSize: 11, fontFamily: "monospace", flex: 1, color: "#2c2c2a" }}>{svc.name}</span>
                      <span style={{ fontSize: 10, color: "#73726c", fontFamily: "monospace" }}>{svc.latency}ms</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: "white", border: "1px solid #e0ded7", borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Dependency Status</div>
                {DEPS.map((d, i) => (
                  <div key={i} style={{ padding: "7px 0", borderBottom: "1px solid #f1efe8", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, color: d.healthy ? COLORS.success : COLORS.critical }}>{d.healthy ? "✔" : "✕"}</span>
                    <span style={{ fontFamily: "monospace", fontSize: 10, color: "#73726c" }}>{d.from}</span>
                    <span style={{ fontSize: 10, color: "#73726c" }}>→</span>
                    <span style={{ fontFamily: "monospace", fontSize: 10, color: d.healthy ? COLORS.success : COLORS.critical }}>{d.to}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {screen === "Incident Log" && (
          <div style={{ background: "white", border: "1px solid #e0ded7", borderRadius: 10, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Incident Timeline</div>
            <div style={{ position: "relative", paddingLeft: 24 }}>
              <div style={{ position: "absolute", left: 8, top: 0, bottom: 0, width: 2, background: "#f1efe8" }} />
              {INCIDENTS.map((inc) => {
                const sevColor = { critical: COLORS.critical, high: COLORS.high, medium: COLORS.medium, low: COLORS.success }[inc.severity];
                return (
                  <div key={inc.id} style={{ position: "relative", marginBottom: 20 }}>
                    <div style={{ position: "absolute", left: -20, top: 14, width: 12, height: 12, borderRadius: "50%", background: sevColor, border: "2px solid white" }} />
                    <div style={{ border: `1px solid ${sevColor}40`, borderLeft: `4px solid ${sevColor}`, borderRadius: 8, padding: "12px 16px", background: "#f8f7f2" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "#534AB7" }}>{inc.id}</span>
                        <Badge status={inc.severity} />
                        <Badge status={inc.status} />
                        <span style={{ fontSize: 11, color: "#73726c", marginLeft: "auto" }}>Today {inc.time}</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{inc.title}</div>
                      <div style={{ fontSize: 11, color: "#73726c" }}>{inc.services} service{inc.services > 1 ? "s" : ""} affected</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {screen === "Log Stream" && (
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
              {["ALL", "ERROR", "WARN", "INFO", SERVICE_CONFIG.name].map((f) => (
                <button key={f} onClick={() => setLogFilter(f)} style={{ fontSize: 10, padding: "5px 10px", borderRadius: 5, border: "1px solid #e0ded7", background: logFilter === f ? "#534AB7" : "white", color: logFilter === f ? "white" : "#73726c", cursor: "pointer", fontFamily: "monospace" }}>{f}</button>
              ))}
            </div>
            <div style={{ background: "#1a1918", border: "1px solid #2c2c2a", borderRadius: 10, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "white", fontFamily: "monospace" }}>LIVE LOG STREAM</span>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#1D9E75", animation: "pulse 1.5s infinite" }} />
                <span style={{ fontSize: 10, color: "#5f5e5a", fontFamily: "monospace", marginLeft: "auto" }}>{SERVICE_CONFIG.name} · {SERVICE_CONFIG.baseUrl}</span>
              </div>
              <LogStream filter={logFilter} selectedLog={selectedLog} onSelectLog={setSelectedLog} />
            </div>
          </div>
        )}

        {screen === "Alerts" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }}>
            <div style={{ background: "white", border: "1px solid #e0ded7", borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Alert Management</div>
              <AlertsPanel />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[["CRITICAL", criticalCount, COLORS.critical], ["HIGH", 1, COLORS.high], ["MEDIUM", 0, COLORS.medium], ["LOW", 0, COLORS.success]].map(([sev, cnt, color]) => (
                <div key={sev} style={{ background: "white", border: "1px solid #e0ded7", borderRadius: 10, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderLeft: `4px solid ${color}` }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#2c2c2a", fontFamily: "monospace" }}>{sev}</span>
                  <span style={{ fontSize: 22, fontWeight: 700, fontFamily: "monospace", color }}>{cnt}</span>
                </div>
              ))}
              <div style={{ background: "white", border: "1px solid #e0ded7", borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Alert Channels</div>
                {[ ["📧", "Email", "Active"], ["💬", "Slack", "Active"], ["📱", "PagerDuty", "Active"], ["🎫", "Jira", "Enabled"] ].map(([icon, ch, st]) => (
                  <div key={ch} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #f1efe8" }}>
                    <span>{icon}</span>
                    <span style={{ fontSize: 12, flex: 1 }}>{ch}</span>
                    <span style={{ fontSize: 10, color: COLORS.success, background: "#EAF3DE", padding: "2px 6px", borderRadius: 4 }}>{st}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {screen === "Trends" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ background: "white", border: "1px solid #e0ded7", borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Error Rate Trend</div>
              <TrendChart />
              <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {TREND_DATA.labels.slice(-3).map((t, i) => (
                  <div key={t} style={{ background: "#f8f7f2", borderRadius: 7, padding: "8px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "#73726c", marginBottom: 2 }}>{t}</div>
                    <div style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: COLORS.critical }}>{TREND_DATA.errors[TREND_DATA.errors.length - 3 + i]}</div>
                    <div style={{ fontSize: 9, color: "#73726c" }}>errors</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: "white", border: "1px solid #e0ded7", borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Service Error Distribution</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {SERVICES.map((svc) => {
                  const max = Math.max(...SERVICES.map((s) => s.errors));
                  const color = svc.status === "critical" ? COLORS.critical : svc.status === "warning" ? COLORS.high : COLORS.success;
                  return (
                    <div key={svc.name}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                        <span style={{ fontFamily: "monospace", color: "#2c2c2a" }}>{svc.name}</span>
                        <span style={{ fontFamily: "monospace", fontWeight: 600, color }}>{svc.errors}</span>
                      </div>
                      <MiniBar value={svc.errors} max={max} color={color} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
