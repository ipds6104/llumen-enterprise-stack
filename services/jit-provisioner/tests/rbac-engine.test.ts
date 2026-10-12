import { describe, it, expect } from "bun:test";
import { HierarchicalRbacEngine } from "../src/services/rbac-engine.ts";
import type { EnterpriseRole } from "../src/types/index.ts";

describe("HierarchicalRbacEngine (Universal Enterprise RBAC & Model Clearance)", () => {
  const engine = new HierarchicalRbacEngine("member");

  describe("Role Hierarchy & Level Ranking", () => {
    it("assigns strict monotonically increasing levels to universal roles", () => {
      expect(engine.getRoleLevel("super_admin")).toBe(5);
      expect(engine.getRoleLevel("tenant_admin")).toBe(4);
      expect(engine.getRoleLevel("power_user")).toBe(3);
      expect(engine.getRoleLevel("member")).toBe(2);
      expect(engine.getRoleLevel("guest")).toBe(1);
    });

    it("evaluates hierarchical relationship with isAtLeast correctly", () => {
      // super_admin satisfies all lower tiers
      expect(engine.isAtLeast("super_admin", "super_admin")).toBe(true);
      expect(engine.isAtLeast("super_admin", "tenant_admin")).toBe(true);
      expect(engine.isAtLeast("super_admin", "power_user")).toBe(true);
      expect(engine.isAtLeast("super_admin", "member")).toBe(true);
      expect(engine.isAtLeast("super_admin", "guest")).toBe(true);

      // tenant_admin satisfies power_user, member, guest, but not super_admin
      expect(engine.isAtLeast("tenant_admin", "super_admin")).toBe(false);
      expect(engine.isAtLeast("tenant_admin", "tenant_admin")).toBe(true);
      expect(engine.isAtLeast("tenant_admin", "power_user")).toBe(true);
      expect(engine.isAtLeast("tenant_admin", "member")).toBe(true);

      // member cannot satisfy power_user or admin roles
      expect(engine.isAtLeast("member", "power_user")).toBe(false);
      expect(engine.isAtLeast("member", "tenant_admin")).toBe(false);
      expect(engine.isAtLeast("member", "guest")).toBe(true);

      // guest is lowest tier
      expect(engine.isAtLeast("guest", "member")).toBe(false);
      expect(engine.isAtLeast("guest", "guest")).toBe(true);
    });
  });

  describe("Canonical Alias Mapping & Normalization", () => {
    it("maps universal and institutional aliases to super_admin (Level 5)", () => {
      const aliases = ["super_admin", "admin", "ciso", "root", "system_admin", "administrator"];
      for (const alias of aliases) {
        expect(engine.resolveEffectiveRole([alias])).toBe("super_admin");
      }
    });

    it("maps tenant/department administrative aliases to tenant_admin (Level 4)", () => {
      const aliases = [
        "tenant_admin",
        "dept_admin",
        "division_head",
        "satker_admin",
        "kepala_satker",
        "manager",
        "org_admin",
      ];
      for (const alias of aliases) {
        expect(engine.resolveEffectiveRole([alias])).toBe("tenant_admin");
      }
    });

    it("maps specialist/developer/operator aliases to power_user (Level 3)", () => {
      const aliases = [
        "power_user",
        "operator",
        "lead",
        "developer",
        "engineer",
        "analyst",
        "specialist",
        "ppk",
      ];
      for (const alias of aliases) {
        expect(engine.resolveEffectiveRole([alias])).toBe("power_user");
      }
    });

    it("maps standard employee/staff aliases to member (Level 2)", () => {
      const aliases = ["member", "pegawai", "staff", "employee", "user", "internal", "asn"];
      for (const alias of aliases) {
        expect(engine.resolveEffectiveRole([alias])).toBe("member");
      }
    });

    it("maps external and guest aliases to guest (Level 1)", () => {
      const aliases = ["guest", "viewer", "external", "contractor", "auditor", "intern", "tamu"];
      for (const alias of aliases) {
        expect(engine.resolveEffectiveRole([alias])).toBe("guest");
      }
    });

    it("handles whitespace and case-insensitivity seamlessly", () => {
      expect(engine.resolveEffectiveRole(["  CISO  "])).toBe("super_admin");
      expect(engine.resolveEffectiveRole(["Satker_Admin"])).toBe("tenant_admin");
      expect(engine.resolveEffectiveRole(["DEVELOPER"])).toBe("power_user");
      expect(engine.resolveEffectiveRole([" Pegawai "])).toBe("member");
    });
  });

  describe("Multi-Role Precedence & Conflict Resolution", () => {
    it("resolves to the highest privileged role when multiple roles are present", () => {
      // member + tenant_admin -> tenant_admin
      expect(engine.resolveEffectiveRole(["pegawai", "satker_admin"])).toBe("tenant_admin");

      // guest + super_admin -> super_admin
      expect(engine.resolveEffectiveRole(["guest", "admin"])).toBe("super_admin");

      // member + power_user -> power_user
      expect(engine.resolveEffectiveRole(["staff", "developer"])).toBe("power_user");

      // contractor + lead + division_head -> tenant_admin
      expect(engine.resolveEffectiveRole(["contractor", "lead", "division_head"])).toBe(
        "tenant_admin"
      );
    });

    it("accepts UserRoleClaim objects as input", () => {
      const claim = {
        userId: "199503112022031001",
        tenantId: "bps-6104",
        department: "IPDS",
        roles: ["pegawai", "developer"],
      };
      expect(engine.resolveEffectiveRole(claim)).toBe("power_user");
    });

    it("falls back to defaultRole when no roles match", () => {
      expect(engine.resolveEffectiveRole([])).toBe("member");
      expect(engine.resolveEffectiveRole(["unknown_custom_role"])).toBe("member");

      const guestEngine = new HierarchicalRbacEngine("guest");
      expect(guestEngine.resolveEffectiveRole([])).toBe("guest");
    });
  });

  describe("Model Clearance Tiers & Access Filtering", () => {
    it("accurately categorizes models into tiers", () => {
      // Basic
      expect(engine.getModelTier("gpt-4o-mini")).toBe("tier_basic");
      expect(engine.getModelTier("gemini-1.5-flash")).toBe("tier_basic");
      expect(engine.getModelTier("kimi-k3")).toBe("tier_basic");

      // Standard
      expect(engine.getModelTier("gpt-4o")).toBe("tier_standard");
      expect(engine.getModelTier("gemini-1.5-pro")).toBe("tier_standard");

      // Advanced
      expect(engine.getModelTier("claude-3-5-sonnet")).toBe("tier_advanced");
      expect(engine.getModelTier("deepseek-coder")).toBe("tier_advanced");

      // Frontier Reasoning
      expect(engine.getModelTier("deepseek-r1")).toBe("tier_reasoning");
      expect(engine.getModelTier("o1-mini")).toBe("tier_reasoning");
      expect(engine.getModelTier("o3-mini")).toBe("tier_reasoning");
    });

    it("enforces tier access boundaries based on user role level", () => {
      // Guest: only basic models
      expect(engine.filterModelClearance("guest", "gpt-4o-mini")).toBe(true);
      expect(engine.filterModelClearance("guest", "gpt-4o")).toBe(false);
      expect(engine.filterModelClearance("guest", "claude-3-5-sonnet")).toBe(false);
      expect(engine.filterModelClearance("guest", "deepseek-r1")).toBe(false);

      // Member: basic + standard models
      expect(engine.filterModelClearance("member", "gpt-4o-mini")).toBe(true);
      expect(engine.filterModelClearance("member", "gpt-4o")).toBe(true);
      expect(engine.filterModelClearance("member", "claude-3-5-sonnet")).toBe(false);
      expect(engine.filterModelClearance("member", "deepseek-r1")).toBe(false);

      // Power User: basic + standard + advanced + reasoning models
      expect(engine.filterModelClearance("power_user", "gpt-4o-mini")).toBe(true);
      expect(engine.filterModelClearance("power_user", "gpt-4o")).toBe(true);
      expect(engine.filterModelClearance("power_user", "claude-3-5-sonnet")).toBe(true);
      expect(engine.filterModelClearance("power_user", "deepseek-r1")).toBe(true);

      // Super Admin: clearance for all models
      expect(engine.filterModelClearance("super_admin", "gpt-4o-mini")).toBe(true);
      expect(engine.filterModelClearance("super_admin", "gpt-4o")).toBe(true);
      expect(engine.filterModelClearance("super_admin", "claude-3-5-sonnet")).toBe(true);
      expect(engine.filterModelClearance("super_admin", "deepseek-r1")).toBe(true);
    });

    it("lists permitted model tiers per role", () => {
      expect(engine.listAllowedModelTiers("guest")).toEqual(["tier_basic"]);
      expect(engine.listAllowedModelTiers("member")).toEqual(["tier_basic", "tier_standard"]);
      expect(engine.listAllowedModelTiers("power_user")).toEqual([
        "tier_basic",
        "tier_standard",
        "tier_advanced",
        "tier_reasoning",
      ]);
      expect(engine.listAllowedModelTiers("super_admin")).toEqual([
        "tier_basic",
        "tier_standard",
        "tier_advanced",
        "tier_reasoning",
      ]);
    });
  });

  describe("Hierarchical Action & Resource Permissions", () => {
    it("permits actions strictly according to role authority level", () => {
      // Super admin actions
      expect(engine.isPermitted("super_admin", "admin:purge_cache")).toBe(true);
      expect(engine.isPermitted("super_admin", "ciso:toggle_killswitch")).toBe(true);
      expect(engine.isPermitted("tenant_admin", "admin:purge_cache")).toBe(false);
      expect(engine.isPermitted("member", "admin:purge_cache")).toBe(false);

      // Tenant admin actions
      expect(engine.isPermitted("super_admin", "tenant:manage_users")).toBe(true);
      expect(engine.isPermitted("tenant_admin", "tenant:manage_users")).toBe(true);
      expect(engine.isPermitted("power_user", "tenant:manage_users")).toBe(false);

      // Power user actions
      expect(engine.isPermitted("power_user", "model:reasoning:access")).toBe(true);
      expect(engine.isPermitted("member", "model:reasoning:access")).toBe(false);

      // Member actions
      expect(engine.isPermitted("member", "chat:create")).toBe(true);
      expect(engine.isPermitted("guest", "chat:create")).toBe(false);
      expect(engine.isPermitted("guest", "chat:read")).toBe(true);
    });
  });
});
