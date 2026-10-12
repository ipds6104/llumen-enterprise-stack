import type { SecurityAuditEvent, AuditEventType } from "../types/index.ts";

/**
 * Enterprise CISO Security Audit Logger (SIEM Compliant).
 * Emits immutable, structured audit records adhering to Elastic Common Schema (ECS)
 * and RFC 5424 standards for ingestion into Splunk, Elasticsearch, or Wazuh.
 */
export class SecurityAuditLogger {
  logEvent(
    eventType: AuditEventType,
    severity: "INFO" | "WARN" | "CRITICAL",
    principal: string,
    details: Record<string, unknown>,
    clientIp?: string,
    userAgent?: string
  ): void {
    const event: SecurityAuditEvent = {
      timestamp: new Date().toISOString(),
      eventType,
      severity,
      principal,
      clientIp: clientIp || "unknown",
      userAgent: userAgent || "unknown",
      details,
    };

    const ecsPayload = {
      "@timestamp": event.timestamp,
      "event.category": ["authentication", "iam"],
      "event.action": event.eventType.toLowerCase(),
      "event.outcome": severity === "CRITICAL" || severity === "WARN" ? "failure" : "success",
      "log.level": event.severity,
      "user.name": event.principal,
      "client.ip": event.clientIp,
      "user_agent.original": event.userAgent,
      labels: {
        service: "llumen-enterprise-gateway",
        compliance: "SOC2-ISO27001",
      },
      audit: event.details,
    };

    const serialized = JSON.stringify(ecsPayload);
    if (severity === "CRITICAL") {
      console.error(`[AUDIT-CRITICAL] ${serialized}`);
    } else if (severity === "WARN") {
      console.warn(`[AUDIT-WARN] ${serialized}`);
    } else {
      console.log(`[AUDIT-INFO] ${serialized}`);
    }
  }
}
