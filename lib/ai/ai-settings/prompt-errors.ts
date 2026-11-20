/**
 * Typed failures for prompt-version deletion.
 *
 * Prompt versions live inside the single `ai_settings` row (`id = 'main'`,
 * `prompt` jsonb -> `{ currentPromptId, defaultPrompt, versions[] }`), so
 * "deleting a prompt" removes one element from that JSONB array and never
 * deletes the row or the `prompt` column itself.
 *
 * The reason travels from the repository to the route handler so the API can
 * answer with an accurate status instead of a blanket 500.
 */
export type PromptVersionDeleteFailure = "settings_missing" | "not_found" | "in_use";

export class PromptVersionDeleteError extends Error {
  readonly reason: PromptVersionDeleteFailure;

  constructor(reason: PromptVersionDeleteFailure, message: string) {
    super(message);
    this.name = "PromptVersionDeleteError";
    this.reason = reason;
  }
}
