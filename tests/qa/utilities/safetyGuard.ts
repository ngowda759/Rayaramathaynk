// utilities/safetyGuard.ts
/**
 * SafetyGuard ensures that destructive actions are blocked in production environments.
 */
export class SafetyGuard {
  private isProduction: boolean;
  private allowDestructive: boolean;

  constructor() {
    this.isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';
    this.allowDestructive = process.env.ALLOW_DESTRUCTIVE_QA === 'true';
  }

  /**
   * Throws if a destructive operation is attempted in a protected environment.
   * @param operationName descriptive name of the operation (e.g., "DELETE user")
   */
  enforce(operationName: string) {
    if (this.isProduction && !this.allowDestructive) {
      throw new Error(`Destructive operation "${operationName}" blocked in production. Set ALLOW_DESTRUCTIVE_QA=true and use a non‑production QA_BASE_URL to override.`);
    }
  }
}
