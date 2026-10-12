/**
 * Core type definitions for Llumen JIT Provisioner & Identity Mediator
 * Enterprise Integration Pattern (EIP): Content Enricher & Message Translator
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
}

export interface AuthVerificationResult {
  authenticated: boolean;
  claims?: AuthClaims;
  status: number;
  headers: Record<string, string>;
  error?: string;
}

export interface IUserProvisioner {
  ensureUser(username: string): Promise<ProvisionResult>;
  getUser(username: string): Promise<LlumenUser | null>;
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
}
