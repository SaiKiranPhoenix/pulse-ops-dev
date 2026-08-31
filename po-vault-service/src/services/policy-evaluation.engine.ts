import type {
  PolicySimulationInput,
  PolicySimulationResult,
  VaultCapability,
  VaultPolicy,
  VaultPolicyRule,
} from "@pulseops/shared/types";

export class PolicyEvaluationEngine {
  /**
   * Tests if a policy path pattern matches a requested path.
   * Supports:
   * - Exact: "secret/data/production/db" matches "secret/data/production/db"
   * - Trailing wildcard: "secret/data/production/*" matches "secret/data/production/db" and subpaths
   * - Segment wildcard: "secret/+/production" matches "secret/data/production"
   * - Universal: "*" matches any path
   */
  public matchesPath(pattern: string, requestedPath: string): boolean {
    const cleanPattern = pattern.trim();
    const cleanPath = requestedPath.trim();

    if (cleanPattern === "*" || cleanPattern === cleanPath) {
      return true;
    }

    if (cleanPattern.endsWith("/*")) {
      const prefix = cleanPattern.slice(0, -2);
      if (cleanPath === prefix || cleanPath.startsWith(prefix + "/")) {
        return true;
      }
    }

    if (cleanPattern.endsWith("*")) {
      const prefix = cleanPattern.slice(0, -1);
      if (cleanPath.startsWith(prefix)) {
        return true;
      }
    }

    // Segment matching with '+'
    if (cleanPattern.includes("+")) {
      const patternParts = cleanPattern.split("/");
      const pathParts = cleanPath.split("/");
      if (patternParts.length !== pathParts.length) return false;
      return patternParts.every((part, idx) => part === "+" || part === pathParts[idx]);
    }

    return false;
  }

  /**
   * Evaluates a requested capability against a collection of Vault Policies.
   * Implements strict deny-by-default and explicit deny precedence.
   */
  public evaluate(
    requestedPath: string,
    capability: VaultCapability,
    policies: VaultPolicy[],
    context?: { environment?: string; userRole?: string },
  ): PolicySimulationResult {
    let matchedGrantRule: { policy: VaultPolicy; rule: VaultPolicyRule } | null = null;

    for (const policy of policies) {
      for (const rule of policy.rules) {
        if (this.matchesPath(rule.path, requestedPath)) {
          // Explicit deny takes immediate precedence across all policies
          if (rule.capabilities.includes("deny")) {
            return {
              allowed: false,
              matchedPolicyName: policy.name,
              matchedRule: rule,
              reason: "Explicit deny rule matched",
              safeExplanation: `Action '${capability}' on path '${requestedPath}' is blocked because policy '${policy.name}' defines an explicit DENY on pattern '${rule.path}'.`,
              requiresProductionConfirmation: false,
            };
          }

          // Check if capability is granted or sudo capability exists
          if (rule.capabilities.includes(capability) || rule.capabilities.includes("sudo")) {
            if (!matchedGrantRule) {
              matchedGrantRule = { policy, rule };
            }
          }
        }
      }
    }

    if (matchedGrantRule) {
      const isProduction =
        context?.environment === "production" ||
        requestedPath.toLowerCase().includes("/prod") ||
        requestedPath.toLowerCase().includes("production");
      const isDestructive = capability === "delete" || capability === "deny";

      return {
        allowed: true,
        matchedPolicyName: matchedGrantRule.policy.name,
        matchedRule: matchedGrantRule.rule,
        reason: `Granted by policy '${matchedGrantRule.policy.name}'`,
        safeExplanation: `Action '${capability}' on path '${requestedPath}' is permitted by rule '${matchedGrantRule.rule.path}' in policy '${matchedGrantRule.policy.name}'.`,
        requiresProductionConfirmation: isProduction && isDestructive,
      };
    }

    return {
      allowed: false,
      reason: "Deny by default (no matching grant rule found)",
      safeExplanation: `Access to '${requestedPath}' for capability '${capability}' is denied because no active Vault policy explicitly authorizes this operation.`,
      requiresProductionConfirmation: false,
    };
  }

  /**
   * Simulates policy check given input parameters.
   */
  public simulate(
    input: PolicySimulationInput,
    availablePolicies: VaultPolicy[],
  ): PolicySimulationResult {
    const activePolicies =
      input.policyIds && input.policyIds.length > 0
        ? availablePolicies.filter(
            (p) => input.policyIds?.includes(p.id) || input.policyIds?.includes(p.name),
          )
        : availablePolicies;

    const context: { environment?: string; userRole?: string } = {};
    if (input.environment) context.environment = input.environment;
    if (input.userRole) context.userRole = input.userRole;

    return this.evaluate(input.path, input.capability, activePolicies, context);
  }
}
