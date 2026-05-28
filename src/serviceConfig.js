/**
 * Service configuration for the Log Analyzer dashboard.
 *
 * Update this file with your own service values.
 * The dashboard will use this service as the primary monitored target.
 */
export const SERVICE_CONFIG = {
  // Replace this with your service name.
  name: "your-service",
  displayName: "Your Service",
  baseUrl: "http://localhost:8081",s
  healthPath: "/health",
  logPath: "/logs",

  // Dashboard metrics.
  port: 8081,
  health: 88,
  status: "healthy", // healthy | warning | critical
  errors: 12,
  rps: 210,
  latency: 120,

  // Endpoints for guided log context.
  endpoints: ["/api/v1/status", "/api/v1/process"],
};
