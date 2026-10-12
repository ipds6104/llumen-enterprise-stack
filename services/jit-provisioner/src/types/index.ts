/**
 * Core type definitions for Llumen JIT Provisioner & Identity Mediator
 * Enterprise Integration Pattern (EIP): Content Enricher & Message Translator
 * Enterprise CISO Controls: RBAC, SIEM Auditing, Killswitch, SCIM Lifecycle
 */

export interface LlumenUser {
  id: number;
  name: string;
  password: string;
  preference: string;
}

export interface ProvisionResult {
  user: LlumenUser;
  isNew: boolean;
}

export interface AuthClaims {
  username: string;
  email?: string;
  displayName?: string;
  groups?: string[];
  tenant?: string;
}

export interface AuthVerificationResult {
  authenticated: boolean;
  claims?: AuthClaims;
  status: number;
  headers: Record<string, string>;
  error?: string;
}

export interface BlockedUserEntry {
  username: string;
  reason: string;
  blockedBy: string;
  blockedAt: string;
}

export interface IBlocklistService {
  isBlocked(username: string): boolean;
  blockUser(username: string, reason: string, admin: string): void;
  unblockUser(username: string): boolean;
  listBlocked(): BlockedUserEntry[];
}

export type AuditEventType =
  | "AUTH_SUCCESS"
  | "AUTH_FAILED"
  | "AUTH_FORBIDDEN_GROUP"
  | "USER_PROVISIONED"
  | "USER_DEACTIVATED"
  | "USER_BLOCKED"
  | "USER_UNBLOCKED"
  | "KILLSWITCH_TRIGGERED";

export interface SecurityAuditEvent {
  timestamp: string;
  eventType: AuditEventType;
  severity: "INFO" | "WARN" | "CRITICAL";
  principal: string;
  clientIp?: string;
  userAgent?: string;
  details: Record<string, unknown>;
}

export interface IUserProvisioner {
  ensureUser(username: string): Promise<ProvisionResult>;
  getUser(username: string): Promise<LlumenUser | null>;
  deactivateUser(username: string): Promise<boolean>;
  listUsers(): Promise<LlumenUser[]>;
  close(): void;
}

export interface IAuthMediator {
  verifyAndEnrich(requestHeaders: Headers): Promise<AuthVerificationResult>;
}

export interface AppConfig {
  port: number;
  sqlitePath: string;
  authGatewayUrl: string;
  trustedHeader: string;
  autoProvision: boolean;
  defaultPreference: string;
  logLevel: string;
  allowedGroups: string[];
  allowedTenants: string[];
  killswitchEnabled: boolean;
}
