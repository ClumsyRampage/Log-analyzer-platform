import { useState, useEffect, useRef } from "react";

const COLORS = {
  critical: "#E24B4A", high: "#EF9F27", medium: "#378ADD",
  low: "#1D9E75", info: "#534AB7", success: "#639922",
};

const SERVICES = [
  { name: "payment-service", port: 8081, health: 42, status: "critical", errors: 247, rps: 1420, latency: 892 },
  { name: "auth-service", port: 8082, health: 91, status: "healthy", errors: 12, rps: 3210, latency: 45 },
  { name: "order-service", port: 8083, health: 78, status: "warning", errors: 89, rps: 876, latency: 210 },
  { name: "inventory-service", port: 8084, health: 95, status: "healthy", errors: 3, rps: 540, latency: 28 },
  { name: "notification-service", port: 8085, health: 67, status: "warning", errors: 56, rps: 1100, latency: 145 },
  { name: "user-profile-service", port: 8086, health: 99, status: "healthy", errors: 1, rps: 2100, latency: 18 },
  { name: "api-gateway", port: 8080, health: 88, status: "healthy", errors: 34, rps: 8900, latency: 67 },
  { name: "kafka-broker", port: 9092, health: 82, status: "healthy", errors: 8, rps: 12000, latency: 5 },
];

const LOG_POOL = [
  { level: "ERROR", service: "payment-service", msg: "HikariPool-1 - Connection is not available, request timed out after 30000ms", traceId: "7f3a9b2e", endpoint: "/api/v1/payments/process", latency: 30012 },
  { level: "ERROR", service: "payment-service", msg: "Database connection pool exhausted: max pool size 10 reached", traceId: "7f3a9b2e", endpoint: "/api/v1/payments/charge", latency: 29845 },
  { level: "WARN", service: "order-service", msg: "Circuit breaker HALF_OPEN for payment-service after 5 failures", traceId: "8c1d4f6a", endpoint: "/api/v1/orders/create", latency: 1240 },
  { level: "ERROR", service: "order-service", msg: "Downstream call to payment-service failed: Connection refused", traceId: "8c1d4f6a", endpoint: "/api/v1/orders/checkout", latency: 5021 },
  { level: "INFO", service: "auth-service", msg: "JWT token validated successfully for user uid-48291", traceId: "2e7b5c3d", endpoint: "/api/v1/auth/verify", latency: 12 },
  { level: "WARN", service: "notification-service", msg: "Kafka consumer lag exceeding threshold: lag=48291 topic=order-events", traceId: "9a3e8b1f", endpoint: "kafka://order-events", latency: 0 },
  { level: "ERROR", service: "notification-service", msg: "Failed to send email notification: SMTP connection timeout", traceId: "9a3e8b1f", endpoint: "/api/v1/notifications/send", latency: 15000 },
  { level: "INFO", service: "inventory-service", msg: "Stock reservation successful for product SKU-8821, qty=3", traceId: "3f1c7e9a", endpoint: "/api/v1/inventory/reserve", latency: 22 },
  { level: "DEBUG", service: "api-gateway", msg: "Rate limit check passed for client 192.168.1.100, quota remaining: 847/1000", traceId: "5d2a9f4b", endpoint: "/", latency: 2 },
  { level: "FATAL", service: "payment-service", msg: "OOM: Java heap space - unable to allocate 512MB block", traceId: "7f3a9b2e", endpoint: "JVM", latency: 0 },
  { level: "WARN", service: "user-profile-service", msg: "Redis cache miss rate elevated: 34% (threshold: 20%)", traceId: "4b8e2c7d", endpoint: "/api/v1/users/profile", latency: 89 },
  { level: "ERROR", service: "auth-service", msg: "Invalid PKCE challenge for OAuth2 flow, client_id=web-app", traceId: "6c9d1e5f", endpoint: "/api/v1/auth/token", latency: 5 },
];

const LOG_INSIGHTS = [
  {
    match: (msg) => msg.includes("Database connection pool exhausted"),
    title: "Connection pool exhaustion",
    rootCause: "The service is unable to obtain a database connection because the HikariCP pool has reached its max size.",
    fixes: [
      "Increase the HikariCP maximum-pool-size",
      "Optimize slow DB queries to reduce hold time",
      "Enable connection leak detection and close resources promptly",
      "Add retry/backoff logic and bulkhead isolation"
    ]
  },
  {
    match: (msg) => msg.includes("Connection is not available"),
    title: "DB connection timeout",
    rootCause: "Requests are timing out waiting for a database connection, often because the pool is saturated or queries are slow.",
    fixes: [
      "Verify current active connections and pool usage",
      "Increase pool size or use connection pooling proxy",
      "Reduce transaction duration and close connections quickly"
    ]
  },
  {
    match: (msg) => msg.includes("Connection refused"),
    title: "Downstream service unavailable",
    rootCause: "A downstream dependency rejected the connection, likely because it is down, overloaded, or misrouted.",
    fixes: [
      "Check the downstream service health and network routing",
      "Inspect circuit breaker state and backend capacity",
      "Validate service discovery and endpoint configuration"
    ]
  },
  {
    match: (msg) => msg.includes("SMTP connection timeout"),
    title: "Email delivery timeout",
    rootCause: "The SMTP gateway is timing out, causing notification delivery failures and backlog growth.",
    fixes: [
      "Check SMTP gateway availability and timeout settings",
      "Add retry with exponential backoff for outbound email send",
      "Isolate email sending from the main processing thread pool"
    ]
  },
  {
    match: (msg) => msg.includes("OOM: Java heap space"),
    title: "Java OOM detected",
    rootCause: "The JVM has run out of heap memory while allocating a large object, often from leaked resources or too-low heap sizing.",
    fixes: [
      "Increase JVM heap size with -Xmx and -Xms",
      "Enable heap dumps on OOM and analyze memory growth",
      "Fix resource leaks and use try-with-resources for DB/io operations"
    ]
  },
  {
    match: (msg) => msg.includes("Invalid PKCE challenge"),
    title: "OAuth PKCE failure",
    rootCause: "The auth flow failed validation for the PKCE challenge, usually due to a bad client or mismatch in challenge values.",
    fixes: [
      "Verify the PKCE challenge and verifier values in the client",
      "Check OAuth client configuration for redirect URIs",
      "Inspect request flow for altered or missing code challenge parameters"
    ]
  }
];

function getLogInsight(log) {
  const insight = LOG_INSIGHTS.find(item => item.match(log.msg));
  if (insight) return insight;
  return {
    title: log.level === "ERROR" || log.level === "FATAL" ? "Investigate this error" : "Log details",
    rootCause: "Click the log entry to inspect the error message and trace. Correlate with service health or incident context to resolve it.",
    fixes: [
      "Review the service logs around this traceId",
      "Check downstream dependency health",
      "Validate error thresholds and retry behavior"
    ]
  };
}

const AI_RCAS = [
  {
    id: "INC-001",
    title: "Database Connection Pool Exhaustion in payment-service",
    severity: "critical",
    services: ["payment-service", "order-service"],
    traceId: "7f3a9b2e",
    summary: "Critical cascading failure detected. payment-service is experiencing database connection pool exhaustion (HikariCP pool size=10) under spike load of ~1420 RPS. This is causing downstream circuit breaker trips in order-service.",
    rootCause: "Database connection pool size (max=10) is insufficient for current traffic load. Slow queries (avg 892ms) are holding connections, leading to pool exhaustion. Concurrent requests are queuing and timing out at 30s.",
    remediation: [
      "Increase HikariCP pool size: spring.datasource.hikari.maximum-pool-size=50",
      "Identify and optimize slow queries using EXPLAIN ANALYZE",
      "Implement read replicas for SELECT operations",
      "Enable connection timeout aggressive recycling",
      "Add Resilience4j circuit breaker with bulkhead pattern",
      "Consider pgBouncer as connection pooler layer"
    ],
    confidence: 94,
    affectedEndpoints: ["/api/v1/payments/process", "/api/v1/payments/charge"],
    timestamp: "2024-01-15T14:32:11Z"
  },
  {
    id: "INC-002",
    title: "Kafka Consumer Lag Spike in notification-service",
    severity: "high",
    services: ["notification-service", "kafka-broker"],
    traceId: "9a3e8b1f",
    summary: "notification-service consumer lag has reached 48,291 messages on order-events topic. SMTP timeout errors compounding the backlog as retry storms overwhelm the processing pipeline.",
    rootCause: "SMTP gateway experiencing timeouts (avg 15s) blocking consumer thread pool. Consumer group has insufficient partitions (3) vs. consumer instances (1). Dead letter queue not configured causing infinite retries.",
    remediation: [
      "Scale notification-service horizontal replicas to 3",
      "Increase Kafka topic partitions: order-events → 9 partitions",
      "Configure DLQ: notification-service.dlq.max-retries=3",
      "Add async SMTP processing with thread pool isolation",
      "Implement exponential backoff: 1s, 2s, 4s, 8s"
    ],
    confidence: 87,
    affectedEndpoints: ["kafka://order-events"],
    timestamp: "2024-01-15T14:28:44Z"
  },
  {
    id: "INC-003",
    title: "Memory Pressure & OOM in payment-service JVM",
    severity: "critical",
    services: ["payment-service"],
    traceId: "7f3a9b2e",
    summary: "payment-service JVM is experiencing OutOfMemoryError attempting 512MB heap allocation. Memory pressure likely caused by connection object leaks and large result sets held in memory during DB pool exhaustion.",
    rootCause: "Connection timeouts causing unclosed ResultSet and Connection objects accumulated in memory. With pool exhaustion, GC cannot reclaim connection wrappers held in retry queues. Heap configured at -Xmx512m is inadequate.",
    remediation: [
      "Increase JVM heap: -Xmx2g -Xms1g in pod spec",
      "Enable GC logging: -Xlog:gc*:file=/logs/gc.log",
      "Add try-with-resources for all DB operations",
      "Configure connection leak detection: spring.datasource.hikari.leak-detection-threshold=2000",
      "Enable heap dump on OOM: -XX:+HeapDumpOnOutOfMemoryError",
      "Implement Liveness probe with restart policy"
    ],
    confidence: 91,
    affectedEndpoints: ["JVM", "/api/v1/payments/process"],
    timestamp: "2024-01-15T14:35:02Z"
  }
];

const INCIDENTS = [
  { id: "INC-001", time: "14:35", status: "open", severity: "critical", title: "Payment DB pool exhausted", services: 2 },
  { id: "INC-002", time: "14:28", status: "investigating", severity: "high", title: "Kafka consumer lag spike", services: 2 },
  { id: "INC-003", time: "14:22", status: "open", severity: "critical", title: "JVM OOM in payment-service", services: 1 },
  { id: "INC-004", time: "13:54", status: "resolved", severity: "medium", title: "Order service latency spike", services: 1 },
  { id: "INC-005", time: "12:11", status: "resolved", severity: "low", title: "Redis cache miss rate elevated", services: 1 },
];

const TREND_DATA = {
  labels: ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "14:30"],
  errors: [12, 18, 9, 14, 67, 241, 312],
  warnings: [34, 41, 28, 39, 88, 145, 187],
  throughput: [8200, 8450, 8100, 8600, 7900, 6200, 4800],
};

const DEPS = [
  { from: "api-gateway", to: "auth-service", healthy: true },
  { from: "api-gateway", to: "order-service", healthy: true },
  { from: "api-gateway", to: "payment-service", healthy: false },
  { from: "api-gateway", to: "user-profile-service", healthy: true },
  { from: "order-service", to: "payment-service", healthy: false },
  { from: "order-service", to: "inventory-service", healthy: true },
  { from: "order-service", to: "notification-service", healthy: true },
  { from: "notification-service", to: "kafka-broker", healthy: false },
  { from: "payment-service", to: "kafka-broker", healthy: false },
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
  const statusColor = { critical: COLORS.critical, warning: COLORS.high, healthy: COLORS.success }[svc.status];
  return (
    <div onClick={onClick} style={{
      background: selected ? "#E6F1FB" : "white",
      border: `1px solid ${selected ? "#378ADD" : "#e0ded7"}`,
      borderRadius: 10, padding: "12px 14px", cursor: "pointer",
      transition: "all 0.15s", borderLeft: `4px solid ${statusColor}`
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#2c2c2a", fontFamily: "monospace" }}>{svc.name}</span>
        <Badge status={svc.status} />
      </div>
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#73726c", marginBottom: 3 }}>
          <span>Health</span><span style={{ color: statusColor, fontWeight: 600 }}>{svc.health}%</span>
        </div>
        <MiniBar value={svc.health} color={statusColor} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginTop: 8 }}>
        {[["RPS", svc.rps.toLocaleString()], ["Errors", svc.errors], ["P99ms", svc.latency]].map(([l, v]) => (
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
  const [logs, setLogs] = useState(() => Array.from({ length: 20 }, (_, i) => ({
    id: i, ...LOG_POOL[i % LOG_POOL.length],
    ts: new Date(Date.now() - (20 - i) * 3000).toISOString(),
    correlationId: `corr-${Math.random().toString(36).slice(2, 8)}`
  })));
  const bottomRef = useRef();

  useEffect(() => {
    const timer = setInterval(() => {
      setLogs(prev => {
        const entry = LOG_POOL[Math.floor(Math.random() * LOG_POOL.length)];
        const next = [...prev.slice(-99), { id: Date.now(), ...entry, ts: new Date().toISOString(), correlationId: `corr-${Math.random().toString(36).slice(2, 8)}` }];
        return next;
      });
    }, 1400);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  const levelColor = { ERROR: COLORS.critical, FATAL: "#791F1F", WARN: COLORS.high, INFO: COLORS.info, DEBUG: "#888780" };
  const filtered = filter === "ALL" ? logs : logs.filter(l => l.level === filter || l.service === filter);
  const insight = selectedLog ? getLogInsight(selectedLog) : null;

  return (
    <div style={{ fontFamily: "monospace", fontSize: 11 }}>
      <div style={{ height: 360, overflowY: "auto", background: "#1a1918", borderRadius: 8, padding: "10px 0" }}>
      {filtered.map(log => {
        const isSelected = selectedLog?.id === log.id;
        return (
          <div key={log.id}
            onClick={() => onSelectLog(log)}
            style={{
              padding: "3px 14px", display: "flex", gap: 8, alignItems: "flex-start", borderBottom: "1px solid #2c2c2a",
              cursor: "pointer",
              background: isSelected ? "rgba(83, 74, 183, 0.18)" : "transparent"
            }}>
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
              <div style={{ fontSize: 13, fontWeight: 700, color: "#2c2c2a" }}>Fix guidance for selected log</div>
              <div style={{ fontSize: 11, color: "#73726c" }}>Click an error to inspect root cause and remediation steps.</div>
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
  const sev = { critical: { border: COLORS.critical, bg: "#FCEBEB", tc: "#A32D2D" }, high: { border: COLORS.high, bg: "#FAEEDA", tc: "#854F0B" } }[rca.severity];
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
            {rca.services.map(s => <span key={s} style={{ background: "#EEEDFE", color: "#3C3489", fontSize: 10, padding: "1px 6px", borderRadius: 4, fontFamily: "monospace" }}>{s}</span>)}
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
            {rca.affectedEndpoints.map(ep => (
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
    "auth-service": [80, 160],
    "order-service": [230, 160],
    "payment-service": [390, 160],
    "user-profile-service": [540, 160],
    "inventory-service": [160, 290],
    "notification-service": [390, 290],
    "kafka-broker": [300, 410],
  };
  const statusColor = (name) => {
    const svc = SERVICES.find(s => s.name === name);
    return { critical: COLORS.critical, warning: COLORS.high, healthy: COLORS.success }[svc?.status] || "#888";
  };

  return (
    <svg viewBox="0 0 640 470" width="100%" style={{ display: "block" }}>
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
          <line key={i} x1={x1} y1={y1 + 18} x2={x2} y2={y2 - 18}
            stroke={stroke} strokeWidth={dep.healthy ? 1 : 2}
            strokeDasharray={dep.healthy ? "none" : "4 3"}
            markerEnd="url(#dep-arrow)" opacity={0.7}
          />
        );
      })}
      {Object.entries(positions).map(([name, [cx, cy]]) => {
        const color = statusColor(name);
        const svc = SERVICES.find(s => s.name === name);
        const isGateway = name === "api-gateway";
        return (
          <g key={name}>
            <rect x={cx - (isGateway ? 72 : 62)} y={cy - 18} width={isGateway ? 144 : 124}
              height={36} rx={6} fill={color + "18"} stroke={color} strokeWidth={isGateway ? 2 : 1} />
            <text x={cx} y={cy - 3} textAnchor="middle" fontSize={10} fontWeight={600} fill={color} fontFamily="monospace">
              {name.replace("-service", "").replace("-", " ")}
            </text>
            <text x={cx} y={cy + 10} textAnchor="middle" fontSize={9} fill="#888780" fontFamily="monospace">
              P99: {svc?.latency}ms | {svc?.errors} err
            </text>
          </g>
        );
      })}
      <text x={16} y={470} fontSize={10} fill="#888780" fontFamily="monospace">● Healthy  </text>
      <text x={80} y={470} fontSize={10} fill={COLORS.critical} fontFamily="monospace">✕ Degraded path</text>
    </svg>
  );
}

function TrendChart() {
  const canvasRef = useRef();
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const w = canvasRef.current.width = canvasRef.current.offsetWidth * 2;
    const h = canvasRef.current.height = 180;
    ctx.scale(2, 1);
    const W = w / 2, H = h;
    const pad = { t: 20, r: 20, b: 30, l: 40 };
    const data = TREND_DATA;
    const maxErr = Math.max(...data.errors, ...data.warnings) * 1.2;

    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = "#e0ded7"; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (H - pad.t - pad.b) * (i / 4);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      ctx.fillStyle = "#888780"; ctx.font = "9px monospace"; ctx.textAlign = "right";
      ctx.fillText(Math.round(maxErr * (1 - i / 4)), pad.l - 4, y + 3);
    }
    data.labels.forEach((label, i) => {
      const x = pad.l + (W - pad.l - pad.r) * (i / (data.labels.length - 1));
      ctx.fillStyle = "#888780"; ctx.font = "9px monospace"; ctx.textAlign = "center";
      ctx.fillText(label, x, H - 5);
    });

    const plotLine = (values, color, fill) => {
      const pts = values.map((v, i) => [pad.l + (W - pad.l - pad.r) * i / (values.length - 1), pad.t + (H - pad.t - pad.b) * (1 - v / maxErr)]);
      if (fill) {
        ctx.beginPath(); ctx.moveTo(pts[0][0], H - pad.b);
        pts.forEach(([x, y]) => ctx.lineTo(x, y));
        ctx.lineTo(pts[pts.length - 1][0], H - pad.b); ctx.closePath();
        ctx.fillStyle = color + "28"; ctx.fill();
      }
      ctx.beginPath(); pts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
      pts.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); });
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
    { id: 1, time: "14:35:22", svc: "payment-service", rule: "ErrorRate > 10%", val: "17.3%", sev: "critical", ack: false },
    { id: 2, time: "14:28:11", svc: "notification-service", rule: "KafkaLag > 10000", val: "48,291", sev: "high", ack: false },
    { id: 3, time: "14:22:47", svc: "payment-service", rule: "JVM HeapUsed > 85%", val: "94.2%", sev: "critical", ack: false },
    { id: 4, time: "13:54:01", svc: "order-service", rule: "P99Latency > 500ms", val: "1240ms", sev: "high", ack: true },
    { id: 5, time: "12:11:33", svc: "user-profile-service", rule: "CacheMissRate > 20%", val: "34%", sev: "medium", ack: true },
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {alerts.map(a => (
        <div key={a.id} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
          background: a.ack ? "#f8f7f2" : "white",
          border: `1px solid ${a.ack ? "#e0ded7" : { critical: COLORS.critical, high: COLORS.high, medium: COLORS.medium }[a.sev]}`,
          borderLeft: `4px solid ${a.ack ? "#B4B2A9" : { critical: COLORS.critical, high: COLORS.high, medium: COLORS.medium }[a.sev]}`,
          borderRadius: 8, opacity: a.ack ? 0.6 : 1
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
              <Badge status={a.sev} />
              <span style={{ fontFamily: "monospace", fontSize: 11, color: "#534AB7" }}>{a.svc}</span>
              <span style={{ fontSize: 10, color: "#73726c", marginLeft: "auto" }}>{a.time}</span>
            </div>
            <div style={{ fontSize: 12, color: "#2c2c2a" }}>{a.rule} <span style={{ fontFamily: "monospace", color: { critical: COLORS.critical, high: COLORS.high, medium: COLORS.medium }[a.sev] }}>({a.val})</span></div>
          </div>
          {!a.ack && (
            <button onClick={() => setAlerts(prev => prev.map(x => x.id === a.id ? { ...x, ack: true } : x))}
              style={{ fontSize: 10, padding: "4px 10px", borderRadius: 5, border: "1px solid #e0ded7", background: "transparent", cursor: "pointer", color: "#73726c" }}>
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
  const criticalCount = SERVICES.filter(s => s.status === "critical").length;
  const totalRPS = SERVICES.slice(0, 4).reduce((a, s) => a + s.rps, 0);

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#f4f2ec", minHeight: "100vh", color: "#2c2c2a" }}>
      {/* Header */}
      <div style={{ background: "#1a1918", padding: "0 20px", display: "flex", alignItems: "center", gap: 0, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 0", marginRight: 24, borderRight: "1px solid #2c2c2a", paddingRight: 24 }}>
          <div style={{ width: 28, height: 28, background: "linear-gradient(135deg, #534AB7, #9F96E8)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>⚡</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "white", letterSpacing: "0.02em" }}>LogIntel</div>
            <div style={{ fontSize: 9, color: "#5f5e5a", letterSpacing: "0.1em", textTransform: "uppercase" }}>AI Observability Platform</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 0, flex: 1, overflowX: "auto" }}>
          {SCREENS.map(s => (
            <button key={s} onClick={() => setScreen(s)} style={{
              padding: "16px 14px", background: "transparent", border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: screen === s ? 600 : 400,
              color: screen === s ? "white" : "#5f5e5a",
              borderBottom: screen === s ? "2px solid #9F96E8" : "2px solid transparent",
              whiteSpace: "nowrap", transition: "all 0.15s"
            }}>{s}</button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", paddingLeft: 16 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: live ? "#1D9E75" : "#888", animation: live ? "pulse 1.5s infinite" : "none" }} />
          <span style={{ fontSize: 11, color: live ? "#5DCAA5" : "#888" }}>{live ? "LIVE" : "PAUSED"}</span>
          <button onClick={() => setLive(l => !l)} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 5, border: "1px solid #2c2c2a", background: "transparent", cursor: "pointer", color: "#73726c", marginLeft: 4 }}>
            {live ? "⏸ Pause" : "▶ Resume"}
          </button>
        </div>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>

      <div style={{ padding: "20px" }}>
        {/* OVERVIEW */}
        {screen === "Overview" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
              <MetricCard label="Total Errors (1h)" value={totalErrors} sub="↑ 156% vs prev hour" color={COLORS.critical} icon="🔴" />
              <MetricCard label="Critical Services" value={criticalCount} sub={`of ${SERVICES.length} services`} color={COLORS.high} icon="⚠️" />
              <MetricCard label="Request/s" value={totalRPS.toLocaleString()} sub="Across gateway" color={COLORS.info} icon="📶" />
              <MetricCard label="Open Incidents" value={INCIDENTS.filter(i => i.status !== "resolved").length} sub="3 need attention" color={COLORS.critical} icon="🚨" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div style={{ background: "white", border: "1px solid #e0ded7", borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Service Health</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {SERVICES.map(svc => <ServiceCard key={svc.name} svc={svc} selected={selectedSvc === svc.name} onClick={() => setSelectedSvc(selectedSvc === svc.name ? null : svc.name)} />)}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ background: "white", border: "1px solid #e0ded7", borderRadius: 10, padding: 16, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Recent Incidents</div>
                  {INCIDENTS.slice(0, 4).map(inc => (
                    <div key={inc.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f1efe8" }}>
                      <Badge status={inc.severity} />
                      <Badge status={inc.status} />
                      <span style={{ fontSize: 12, flex: 1, color: "#2c2c2a" }}>{inc.title}</span>
                      <span style={{ fontSize: 10, color: "#73726c", fontFamily: "monospace" }}>{inc.time}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: "white", border: "1px solid #e0ded7", borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Error Trend (Today)</div>
                  <TrendChart />
                </div>
              </div>
            </div>
            <div style={{ background: "#1a1918", border: "1px solid #2c2c2a", borderRadius: 10, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "white" }}>Live Log Stream</span>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#1D9E75", animation: "pulse 1.5s infinite" }} />
                <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                  {["ALL", "ERROR", "FATAL", "WARN"].map(f => (
                    <button key={f} onClick={() => setLogFilter(f)} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid #2c2c2a", background: logFilter === f ? "#534AB7" : "transparent", color: logFilter === f ? "white" : "#73726c", cursor: "pointer", fontFamily: "monospace" }}>{f}</button>
                  ))}
                </div>
              </div>
              <LogStream filter={logFilter} selectedLog={selectedLog} onSelectLog={setSelectedLog} />
            </div>
          </div>
        )}

        {/* RCA ANALYSIS */}
        {screen === "RCA Analysis" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <div style={{ background: "white", border: "1px solid #e0ded7", borderRadius: 10, padding: 16, borderTop: `3px solid ${COLORS.info}` }}>
                <div style={{ fontSize: 11, color: "#73726c", marginBottom: 4 }}>🤖 AI Engine</div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace" }}>Active</div>
                <div style={{ fontSize: 11, color: "#73726c" }}>claude-3-5-sonnet · 94% avg confidence</div>
              </div>
              <div style={{ background: "white", border: "1px solid #e0ded7", borderRadius: 10, padding: 16, borderTop: `3px solid ${COLORS.critical}` }}>
                <div style={{ fontSize: 11, color: "#73726c", marginBottom: 4 }}>Incidents Analyzed</div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace" }}>3</div>
                <div style={{ fontSize: 11, color: COLORS.critical }}>2 critical, 1 high</div>
              </div>
              <div style={{ background: "white", border: "1px solid #e0ded7", borderRadius: 10, padding: 16, borderTop: `3px solid ${COLORS.success}` }}>
                <div style={{ fontSize: 11, color: "#73726c", marginBottom: 4 }}>Remediations Suggested</div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace" }}>16</div>
                <div style={{ fontSize: 11, color: "#73726c" }}>Avg 5.3 per incident</div>
              </div>
            </div>
            <div style={{ background: "white", border: "1px solid #e0ded7", borderRadius: 10, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>AI Root Cause Analysis</span>
                <span style={{ fontSize: 11, color: "#73726c" }}>Powered by LLM correlation engine</span>
                <div style={{ marginLeft: "auto", fontSize: 11, color: "#534AB7", background: "#EEEDFE", padding: "4px 10px", borderRadius: 6 }}>🤖 GPT-4 / Claude Sonnet</div>
              </div>
              {AI_RCAS.map(rca => (
                <RCACard key={rca.id} rca={rca} expanded={expandedRCA === rca.id} onToggle={() => setExpandedRCA(expandedRCA === rca.id ? null : rca.id)} />
              ))}
            </div>
          </div>
        )}

        {/* SERVICE MAP */}
        {screen === "Service Map" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>
            <div style={{ background: "white", border: "1px solid #e0ded7", borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Service Dependency Graph</div>
              <div style={{ fontSize: 11, color: "#73726c", marginBottom: 16 }}>Real-time topology with health overlay · Click a service for details</div>
              <DependencyGraph />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: "white", border: "1px solid #e0ded7", borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Service Status</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {SERVICES.map(svc => (
                    <div key={svc.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6, background: "#f8f7f2" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: { critical: COLORS.critical, warning: COLORS.high, healthy: COLORS.success }[svc.status] }} />
                      <span style={{ fontSize: 11, fontFamily: "monospace", flex: 1, color: "#2c2c2a" }}>{svc.name}</span>
                      <span style={{ fontSize: 10, color: "#73726c", fontFamily: "monospace" }}>{svc.latency}ms</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: "white", border: "1px solid #e0ded7", borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Dependency Failures</div>
                {DEPS.filter(d => !d.healthy).map((d, i) => (
                  <div key={i} style={{ padding: "7px 0", borderBottom: "1px solid #f1efe8", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, color: COLORS.critical }}>✕</span>
                    <span style={{ fontFamily: "monospace", fontSize: 10, color: "#73726c" }}>{d.from}</span>
                    <span style={{ fontSize: 10, color: "#73726c" }}>→</span>
                    <span style={{ fontFamily: "monospace", fontSize: 10, color: COLORS.critical }}>{d.to}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* INCIDENT LOG */}
        {screen === "Incident Log" && (
          <div style={{ background: "white", border: "1px solid #e0ded7", borderRadius: 10, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Incident Timeline</div>
            <div style={{ position: "relative", paddingLeft: 24 }}>
              <div style={{ position: "absolute", left: 8, top: 0, bottom: 0, width: 2, background: "#f1efe8" }} />
              {INCIDENTS.map(inc => {
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

        {/* LOG STREAM */}
        {screen === "Log Stream" && (
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
              {["ALL", "ERROR", "FATAL", "WARN", "INFO", "DEBUG", ...SERVICES.map(s => s.name)].slice(0, 12).map(f => (
                <button key={f} onClick={() => setLogFilter(f)} style={{ fontSize: 10, padding: "5px 10px", borderRadius: 5, border: "1px solid #e0ded7", background: logFilter === f ? "#534AB7" : "white", color: logFilter === f ? "white" : "#73726c", cursor: "pointer", fontFamily: "monospace" }}>{f}</button>
              ))}
            </div>
            <div style={{ background: "#1a1918", border: "1px solid #2c2c2a", borderRadius: 10, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "white", fontFamily: "monospace" }}>LIVE LOG STREAM</span>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#1D9E75", animation: "pulse 1.5s infinite" }} />
                <span style={{ fontSize: 10, color: "#5f5e5a", fontFamily: "monospace", marginLeft: "auto" }}>go-log-collector · kafka://log-events</span>
              </div>
              <LogStream filter={logFilter} selectedLog={selectedLog} onSelectLog={setSelectedLog} />
            </div>
          </div>
        )}

        {/* ALERTS */}
        {screen === "Alerts" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }}>
            <div style={{ background: "white", border: "1px solid #e0ded7", borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Alert Management</div>
              <AlertsPanel />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[["CRITICAL", 2, COLORS.critical], ["HIGH", 1, COLORS.high], ["MEDIUM", 1, COLORS.medium], ["LOW", 0, COLORS.success]].map(([sev, cnt, color]) => (
                <div key={sev} style={{ background: "white", border: "1px solid #e0ded7", borderRadius: 10, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderLeft: `4px solid ${color}` }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#2c2c2a", fontFamily: "monospace" }}>{sev}</span>
                  <span style={{ fontSize: 22, fontWeight: 700, fontFamily: "monospace", color }}>{cnt}</span>
                </div>
              ))}
              <div style={{ background: "white", border: "1px solid #e0ded7", borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Alert Channels</div>
                {[["📧", "Email", "Active"], ["💬", "Slack", "Active"], ["📱", "PagerDuty", "Active"], ["🎫", "Jira", "Enabled"]].map(([icon, ch, st]) => (
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

        {/* TRENDS */}
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
                {SERVICES.sort((a, b) => b.errors - a.errors).map(svc => {
                  const max = Math.max(...SERVICES.map(s => s.errors));
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
            <div style={{ background: "white", border: "1px solid #e0ded7", borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Latency Distribution (P99)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {SERVICES.sort((a, b) => b.latency - a.latency).map(svc => {
                  const max = Math.max(...SERVICES.map(s => s.latency));
                  const color = svc.latency > 500 ? COLORS.critical : svc.latency > 100 ? COLORS.high : COLORS.success;
                  return (
                    <div key={svc.name}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                        <span style={{ fontFamily: "monospace", color: "#2c2c2a" }}>{svc.name}</span>
                        <span style={{ fontFamily: "monospace", fontWeight: 600, color }}>{svc.latency}ms</span>
                      </div>
                      <MiniBar value={svc.latency} max={max} color={color} />
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ background: "white", border: "1px solid #e0ded7", borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Historical Incident Summary</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[["Total (24h)", "23", COLORS.info], ["MTTR", "18m", COLORS.success], ["Repeat Errors", "7", COLORS.high], ["Auto-resolved", "11", COLORS.success]].map(([l, v, c]) => (
                  <div key={l} style={{ background: "#f8f7f2", borderRadius: 8, padding: "12px 14px", borderLeft: `3px solid ${c}` }}>
                    <div style={{ fontSize: 10, color: "#73726c", marginBottom: 4 }}>{l}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace", color: c }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
