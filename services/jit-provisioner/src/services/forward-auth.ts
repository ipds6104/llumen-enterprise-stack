import type { IAuthMediator, IUserProvisioner, AuthVerificationResult, AppConfig } from "../types/index.ts";
import { Logger } from "../utils/logger.ts";

/**
 * Enterprise Forward-Auth Mediator.
 * Implements EIP Message Translator and Channel Adapter pattern.
 */
export class ForwardAuthMediator implements IAuthMediator {
  private provisioner: IUserProvisioner;
  private config: AppConfig;
  private logger: Logger;

  constructor(provisioner: IUserProvisioner, config: AppConfig, logger: Logger) {
    this.provisioner = provisioner;
    this.config = config;
    this.logger = logger;
  }

  /**
   * Resolves the primary enterprise user identity from incoming request headers.
   */
  private extractIdentity(headers: Headers): { username: string | null; email: string | null } {
    // 1. Prioritize OAuth2-Proxy injected user header
    const authUser = headers.get("x-auth-request-user");
    const preferredUser = headers.get("x-auth-request-preferred-username");
    const forwardedUser = headers.get("x-forwarded-user");
    const remoteUser = headers.get("remote-user");
    const email = headers.get("x-auth-request-email") || headers.get("x-forwarded-email");

    const resolvedUser = authUser || preferredUser || forwardedUser || remoteUser || (email ? email.split("@")[0] : null);

    return {
      username: resolvedUser,
      email: email || null,
    };
  }

  /**
   * Verifies identity with upstream OAuth2-Proxy if session cookie is present.
   */
  private async queryAuthGateway(headers: Headers): Promise<{ authenticated: boolean; gatewayHeaders: Headers }> {
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
    // Step 1: Check if request already carries authenticated headers (e.g. Traefik forward-auth pipeline)
    let { username, email } = this.extractIdentity(requestHeaders);

    // Step 2: If missing, attempt direct validation against auth-gateway
    if (!username) {
      const { authenticated, gatewayHeaders } = await this.queryAuthGateway(requestHeaders);
      if (authenticated) {
        const extracted = this.extractIdentity(gatewayHeaders);
        username = extracted.username;
        email = extracted.email;
      }
    }

    // Step 3: Unauthenticated handling
    if (!username) {
      this.logger.debug("Request missing valid enterprise authentication claims");
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

    // Step 4: Ensure User exists in Llumen SQLite (JIT Provisioning)
    try {
      const provisionResult = await this.provisioner.ensureUser(username);

      const responseHeaders: Record<string, string> = {
        [this.config.trustedHeader]: provisionResult.user.name,
        "X-User-Provisioned": provisionResult.isNew ? "true" : "false",
        "X-Llumen-User-Id": String(provisionResult.user.id),
      };

      if (email) {
        responseHeaders["X-Forwarded-Email"] = email;
      }

      return {
        authenticated: true,
        status: 200,
        claims: {
          username: provisionResult.user.name,
          email: email || undefined,
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
