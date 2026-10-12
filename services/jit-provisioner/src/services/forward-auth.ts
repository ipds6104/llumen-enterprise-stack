import type {
  IAuthMediator,
  IUserProvisioner,
  IBlocklistService,
  IHierarchicalRbacEngine,
  AuthVerificationResult,
  AppConfig,
} from "../types/index.ts";
import { Logger } from "../utils/logger.ts";
import { SecurityAuditLogger } from "./audit-logger.ts";

/**
 * Enterprise Forward-Auth Mediator.
 * Implements EIP Message Translator, Channel Adapter, and CISO Security Guardrails.
 */
export class ForwardAuthMediator implements IAuthMediator {
  private provisioner: IUserProvisioner;
  private blocklist: IBlocklistService;
  private auditLogger: SecurityAuditLogger;
  private rbacEngine: IHierarchicalRbacEngine;
  private config: AppConfig;
  private logger: Logger;

  constructor(
    provisioner: IUserProvisioner,
    blocklist: IBlocklistService,
    auditLogger: SecurityAuditLogger,
    rbacEngine: IHierarchicalRbacEngine,
    config: AppConfig,
    logger: Logger
  ) {
    this.provisioner = provisioner;
    this.blocklist = blocklist;
    this.auditLogger = auditLogger;
    this.rbacEngine = rbacEngine;
    this.config = config;
    this.logger = logger;
  }

  /**
   * Resolves the primary enterprise user identity and claims from headers.
   */
  private extractIdentity(headers: Headers): {
    username: string | null;
    email: string | null;
    groups: string[];
    tenant: string | null;
  } {
    const authUser = headers.get("x-auth-request-user");
    const preferredUser = headers.get("x-auth-request-preferred-username");
    const forwardedUser = headers.get("x-forwarded-user");
    const remoteUser = headers.get("remote-user");
    const email = headers.get("x-auth-request-email") || headers.get("x-forwarded-email");

    const rawGroups =
      headers.get("x-auth-request-groups") ||
      headers.get("x-forwarded-groups") ||
      "";
    const groups = rawGroups
      ? rawGroups.split(",").map((g) => g.trim()).filter(Boolean)
      : [];

    const tenant = headers.get("x-auth-request-tenant") || null;

    const resolvedUser =
      authUser ||
      preferredUser ||
      forwardedUser ||
      remoteUser ||
      (email ? email.split("@")[0] : null);

    return {
      username: resolvedUser,
      email: email || null,
      groups,
      tenant,
    };
  }

  /**
   * Verifies identity with upstream OAuth2-Proxy if session cookie is present.
   */
  private async queryAuthGateway(
    headers: Headers
  ): Promise<{ authenticated: boolean; gatewayHeaders: Headers }> {
    try {
      const cookie = headers.get("cookie");
      const authorization = headers.get("authorization");

      if (!cookie && !authorization) {
        return { authenticated: false, gatewayHeaders: new Headers() };
      }

      const forwardHeaders = new Headers();
      if (cookie) forwardHeaders.set("cookie", cookie);
      if (authorization) forwardHeaders.set("authorization", authorization);

      const resp = await fetch(`${this.config.authGatewayUrl}/oauth2/auth`, {
        method: "GET",
        headers: forwardHeaders,
      });

      return {
        authenticated: resp.status >= 200 && resp.status < 300,
        gatewayHeaders: resp.headers,
      };
    } catch (err) {
      this.logger.error("Failed to query upstream Auth Gateway", { error: String(err) });
      return { authenticated: false, gatewayHeaders: new Headers() };
    }
  }

  async verifyAndEnrich(requestHeaders: Headers): Promise<AuthVerificationResult> {
    const clientIp = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const userAgent = requestHeaders.get("user-agent") || "unknown";

    // CISO Control 1: Emergency Killswitch
    if (this.config.killswitchEnabled) {
      this.auditLogger.logEvent(
        "KILLSWITCH_TRIGGERED",
        "CRITICAL",
        "SYSTEM",
        { action: "block_all_access", reason: "killswitch_enabled" },
        clientIp,
        userAgent
      );
      return {
        authenticated: false,
        status: 503,
        headers: { "Content-Type": "application/json" },
        error: "Access Suspended: Emergency AI Gateway Killswitch Active",
      };
    }

    // Step 1: Check incoming claims or query gateway
    let { username, email, groups, tenant } = this.extractIdentity(requestHeaders);

    if (!username) {
      const { authenticated, gatewayHeaders } = await this.queryAuthGateway(requestHeaders);
      if (authenticated) {
        const extracted = this.extractIdentity(gatewayHeaders);
        username = extracted.username;
        email = extracted.email;
        groups = extracted.groups;
        tenant = extracted.tenant;
      }
    }

    // Unauthenticated handling
    if (!username) {
      this.auditLogger.logEvent(
        "AUTH_FAILED",
        "WARN",
        "anonymous",
        { reason: "missing_sso_session" },
        clientIp,
        userAgent
      );
      return {
        authenticated: false,
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": "Bearer realm=\"Llumen Enterprise SSO\"",
        },
        error: "Unauthenticated: Missing enterprise SSO session",
      };
    }

    // CISO Control 2: Security Blocklist / Revocation Check
    if (this.blocklist.isBlocked(username)) {
      this.auditLogger.logEvent(
        "USER_BLOCKED",
        "CRITICAL",
        username,
        { action: "access_denied", reason: "user_in_blocklist" },
        clientIp,
        userAgent
      );
      return {
        authenticated: false,
        status: 403,
        headers: { "Content-Type": "application/json" },
        error: "Forbidden: Account access has been revoked by Enterprise Security",
      };
    }

    // CISO Control 3: RBAC Group Enforcement (e.g. Satker 6104 or allowed department)
    if (this.config.allowedGroups.length > 0) {
      const isMember = this.config.allowedGroups.some((ag) => groups.includes(ag));
      if (!isMember) {
        this.auditLogger.logEvent(
          "AUTH_FORBIDDEN_GROUP",
          "WARN",
          username,
          { required: this.config.allowedGroups, provided: groups },
          clientIp,
          userAgent
        );
        return {
          authenticated: false,
          status: 403,
          headers: { "Content-Type": "application/json" },
          error: "Forbidden: User not authorized in required enterprise RBAC group",
        };
      }
    }

    // CISO Control 4: Multi-Tenant Scoping
    if (this.config.allowedTenants.length > 0 && tenant) {
      if (!this.config.allowedTenants.includes(tenant)) {
        return {
          authenticated: false,
          status: 403,
          headers: { "Content-Type": "application/json" },
          error: `Forbidden: Tenant '${tenant}' is not permitted`,
        };
      }
    }

    // CISO Control 5: Hierarchical RBAC Resolution & Model Clearance
    const effectiveRole = this.rbacEngine.resolveEffectiveRole(groups);
    const requestedModel =
      requestHeaders.get("x-requested-model") ||
      requestHeaders.get("x-target-model");

    if (requestedModel) {
      const isCleared = this.rbacEngine.filterModelClearance(effectiveRole, requestedModel);
      if (!isCleared) {
        const requiredTier = this.rbacEngine.getModelTier(requestedModel);
        this.auditLogger.logEvent(
          "AUTH_FORBIDDEN_MODEL",
          "WARN",
          username,
          { role: effectiveRole, requestedModel, requiredTier },
          clientIp,
          userAgent
        );
        return {
          authenticated: false,
          status: 403,
          headers: { "Content-Type": "application/json" },
          error: `Forbidden: Role '${effectiveRole}' lacks clearance for model '${requestedModel}' (${requiredTier})`,
        };
      }
    }

    // Step 4: Ensure User exists in Llumen SQLite (JIT Provisioning)
    try {
      const provisionResult = await this.provisioner.ensureUser(username);

      if (provisionResult.isNew) {
        this.auditLogger.logEvent(
          "USER_PROVISIONED",
          "INFO",
          username,
          { userId: provisionResult.user.id },
          clientIp,
          userAgent
        );
      }

      this.auditLogger.logEvent(
        "AUTH_SUCCESS",
        "INFO",
        username,
        { userId: provisionResult.user.id, email, groups, role: effectiveRole },
        clientIp,
        userAgent
      );

      const responseHeaders: Record<string, string> = {
        [this.config.trustedHeader]: provisionResult.user.name,
        "X-User-Provisioned": provisionResult.isNew ? "true" : "false",
        "X-Llumen-User-Id": String(provisionResult.user.id),
        "X-Forwarded-Role": effectiveRole,
        "X-Forwarded-Tier": this.rbacEngine.listAllowedModelTiers(effectiveRole).join(","),
        "X-User-Role-Level": String(this.rbacEngine.getRoleLevel(effectiveRole)),
      };

      if (email) responseHeaders["X-Forwarded-Email"] = email;
      if (groups.length > 0) responseHeaders["X-Forwarded-Groups"] = groups.join(",");

      return {
        authenticated: true,
        status: 200,
        claims: {
          username: provisionResult.user.name,
          email: email || undefined,
          groups,
          tenant: tenant || undefined,
          role: effectiveRole,
          tier: requestedModel ? this.rbacEngine.getModelTier(requestedModel) : undefined,
        },
        headers: responseHeaders,
      };
    } catch (err) {
      this.logger.error("JIT Provisioning failed for authenticated user", {
        username,
        error: String(err),
      });
      return {
        authenticated: false,
        status: 403,
        headers: { "Content-Type": "application/json" },
        error: `Authorization failed: ${String(err)}`,
      };
    }
  }
}
