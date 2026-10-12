import type {
  EnterpriseRole,
  ModelTier,
  UserRoleClaim,
  IHierarchicalRbacEngine,
} from "../types/index.ts";

/**
 * Universal Hierarchical Enterprise RBAC Engine.
 * Implements EIP Message Translator and Decoupled Authorization Policy.
 * Provides hierarchical role ranking, alias normalization, and model clearance tiers.
 */
export class HierarchicalRbacEngine implements IHierarchicalRbacEngine {
  private defaultRole: EnterpriseRole;

  // Numerical hierarchy: higher number represents higher privilege
  private static readonly ROLE_LEVELS: Record<EnterpriseRole, number> = {
    super_admin: 5,
    tenant_admin: 4,
    power_user: 3,
    member: 2,
    guest: 1,
  };

  // Canonical alias mapping for backward compatibility and institutional federation
  private static readonly ALIAS_MAP: Record<string, EnterpriseRole> = {
    // Super Admin (Level 5)
    super_admin: "super_admin",
    admin: "super_admin",
    ciso: "super_admin",
    root: "super_admin",
    security_officer: "super_admin",
    system_admin: "super_admin",
    administrator: "super_admin",

    // Tenant / Division Admin (Level 4)
    tenant_admin: "tenant_admin",
    dept_admin: "tenant_admin",
    division_head: "tenant_admin",
    satker_admin: "tenant_admin",
    kepala_satker: "tenant_admin",
    manager: "tenant_admin",
    org_admin: "tenant_admin",
    unit_admin: "tenant_admin",
    pimpinan: "tenant_admin",

    // Power User / Operator / Specialist (Level 3)
    power_user: "power_user",
    operator: "power_user",
    lead: "power_user",
    developer: "power_user",
    engineer: "power_user",
    analyst: "power_user",
    specialist: "power_user",
    ppk: "power_user",
    ppspm: "power_user",
    senior_staff: "power_user",

    // Member / Regular Staff (Level 2)
    member: "member",
    pegawai: "member",
    staff: "member",
    employee: "member",
    user: "member",
    internal: "member",
    standard: "member",
    asn: "member",

    // Guest / External Viewer (Level 1)
    guest: "guest",
    viewer: "guest",
    external: "guest",
    contractor: "guest",
    auditor: "guest",
    intern: "guest",
    tamu: "guest",
  };

  // Minimum role level required for each model clearance tier
  private static readonly TIER_LEVEL_REQUIREMENTS: Record<ModelTier, number> = {
    tier_basic: 1, // guest+
    tier_standard: 2, // member+
    tier_advanced: 3, // power_user+
    tier_reasoning: 3, // power_user+
  };

  // Known model categorization dictionary
  private static readonly MODEL_TIER_REGISTRY: Record<string, ModelTier> = {
    // Basic Models
    "gpt-4o-mini": "tier_basic",
    "gemini-1.5-flash": "tier_basic",
    "kimi-k3": "tier_basic",
    "claude-3-haiku": "tier_basic",
    "llama-3.1-8b": "tier_basic",

    // Standard Models
    "gpt-4o": "tier_standard",
    "gemini-1.5-pro": "tier_standard",
    "claude-3-5-haiku": "tier_standard",
    "llama-3.3-70b": "tier_standard",
    "deepseek-chat": "tier_standard",

    // Advanced Models
    "claude-3-5-sonnet": "tier_advanced",
    "deepseek-coder": "tier_advanced",
    "qwen-2.5-coder": "tier_advanced",
    "codellama-70b": "tier_advanced",

    // Frontier Reasoning Models
    o1: "tier_reasoning",
    "o1-mini": "tier_reasoning",
    "o3-mini": "tier_reasoning",
    "deepseek-r1": "tier_reasoning",
    "qwq-32b": "tier_reasoning",
  };

  constructor(defaultRole: EnterpriseRole = "member") {
    this.defaultRole = defaultRole;
  }

  /**
   * Resolves effective role from input claims or list of role names.
   * Resolves to the HIGHEST privilege role in the hierarchy.
   */
  resolveEffectiveRole(claimsOrRoles: UserRoleClaim | string[]): EnterpriseRole {
    const rawRoles = Array.isArray(claimsOrRoles) ? claimsOrRoles : claimsOrRoles.roles;

    if (!rawRoles || rawRoles.length === 0) {
      return this.defaultRole;
    }

    let highestRole = this.defaultRole;
    let highestLevel = 0;

    for (const raw of rawRoles) {
      const normalized = raw.trim().toLowerCase();
      const mappedRole = HierarchicalRbacEngine.ALIAS_MAP[normalized];
      if (mappedRole) {
        const level = this.getRoleLevel(mappedRole);
        if (level > highestLevel) {
          highestLevel = level;
          highestRole = mappedRole;
        }
      }
    }

    return highestLevel > 0 ? highestRole : this.defaultRole;
  }

  /**
   * Returns numeric hierarchy level (1 to 5).
   */
  getRoleLevel(role: EnterpriseRole): number {
    return HierarchicalRbacEngine.ROLE_LEVELS[role] ?? 1;
  }

  /**
   * Determines if userRole meets or exceeds the requiredRole.
   */
  isAtLeast(userRole: EnterpriseRole, requiredRole: EnterpriseRole): boolean {
    return this.getRoleLevel(userRole) >= this.getRoleLevel(requiredRole);
  }

  /**
   * Evaluates action and resource permission according to hierarchical authority.
   */
  isPermitted(role: EnterpriseRole, action: string, _resource?: string): boolean {
    const level = this.getRoleLevel(role);

    if (action.startsWith("admin:") || action.startsWith("ciso:") || action.startsWith("system:")) {
      return level >= HierarchicalRbacEngine.ROLE_LEVELS.super_admin;
    }

    if (action.startsWith("tenant:")) {
      return level >= HierarchicalRbacEngine.ROLE_LEVELS.tenant_admin;
    }

    if (
      action.startsWith("model:reasoning") ||
      action.startsWith("model:advanced") ||
      action.startsWith("quota:extended")
    ) {
      return level >= HierarchicalRbacEngine.ROLE_LEVELS.power_user;
    }

    if (action.startsWith("chat:create") || action.startsWith("prompt:custom")) {
      return level >= HierarchicalRbacEngine.ROLE_LEVELS.member;
    }

    if (action.startsWith("chat:read") || action.startsWith("model:basic")) {
      return level >= HierarchicalRbacEngine.ROLE_LEVELS.guest;
    }

    // Default permissive for member and above
    return level >= HierarchicalRbacEngine.ROLE_LEVELS.member;
  }

  /**
   * Detects the Model Clearance Tier for a given model identifier.
   */
  getModelTier(modelName: string): ModelTier {
    const normalized = modelName.trim().toLowerCase();

    // Direct registry match
    if (HierarchicalRbacEngine.MODEL_TIER_REGISTRY[normalized]) {
      return HierarchicalRbacEngine.MODEL_TIER_REGISTRY[normalized];
    }

    // Pattern-based heuristics
    if (
      normalized.includes("r1") ||
      normalized.includes("o1") ||
      normalized.includes("o3") ||
      normalized.includes("reason") ||
      normalized.includes("thinking")
    ) {
      return "tier_reasoning";
    }

    if (
      normalized.includes("sonnet") ||
      normalized.includes("coder") ||
      normalized.includes("advanced") ||
      normalized.includes("opus")
    ) {
      return "tier_advanced";
    }

    if (
      normalized.includes("mini") ||
      normalized.includes("flash") ||
      normalized.includes("basic") ||
      normalized.includes("small")
    ) {
      return "tier_basic";
    }

    return "tier_standard";
  }

  /**
   * Validates if the given role has clearance to execute the requested model.
   */
  filterModelClearance(role: EnterpriseRole, requestedModel: string): boolean {
    const tier = this.getModelTier(requestedModel);
    const requiredLevel = HierarchicalRbacEngine.TIER_LEVEL_REQUIREMENTS[tier];
    const userLevel = this.getRoleLevel(role);

    return userLevel >= requiredLevel;
  }

  /**
   * Lists all permitted model tiers for a given role.
   */
  listAllowedModelTiers(role: EnterpriseRole): ModelTier[] {
    const userLevel = this.getRoleLevel(role);
    const tiers: ModelTier[] = [];

    for (const [tier, reqLevel] of Object.entries(
      HierarchicalRbacEngine.TIER_LEVEL_REQUIREMENTS
    ) as [ModelTier, number][]) {
      if (userLevel >= reqLevel) {
        tiers.push(tier);
      }
    }

    return tiers;
  }
}
