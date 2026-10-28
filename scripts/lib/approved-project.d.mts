// Types for `approved-project.mjs`, so TypeScript importers of the shared guard
// library type-check instead of falling back to an implicit `any`.
export declare const APPROVED_PROJECT_REF: string;
export declare const APPROVED_PROJECT_URL: string;
export declare function fingerprint(value: unknown): string;
export declare function refFromSupabaseUrl(url: unknown): string;
export declare function refFromDbUrl(dbUrl: unknown): string;
export declare function analyzeDbUrlRef(dbUrl: unknown): {
  ref: string;
  userRef: string;
  hostRef: string;
  ambiguous: boolean;
  malformed: boolean;
};
export declare function isApprovedRef(value: unknown): boolean;
