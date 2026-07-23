"use client";

import { useState, useCallback } from "react";
import { executeAction, AIAction, ActionResult, ActionType } from "./actionRegistry";

/**
 * Hook for executing AI-initiated actions
 */
export function useAIActions() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<ActionResult | null>(null);

  const execute = useCallback(async (action: AIAction): Promise<ActionResult> => {
    setIsExecuting(true);
    setLastResult(null);

    try {
      const result = await executeAction(action);
      setLastResult(result);
      return result;
    } finally {
      setIsExecuting(false);
    }
  }, []);

  const executeActionType = useCallback(async (
    type: ActionType,
    params: Record<string, unknown> = {}
  ): Promise<ActionResult> => {
    return execute({ type, params, description: `Execute ${type}` });
  }, [execute]);

  return {
    execute,
    executeActionType,
    isExecuting,
    lastResult,
  };
}

/**
 * Execute actions from AI response
 */
export async function executeActionsFromAIResponse(response: string): Promise<ActionResult[]> {
  const { parseActionsFromResponse } = await import("./actionRegistry");
  const actions = parseActionsFromResponse(response);
  
  const results: ActionResult[] = [];
  
  for (const action of actions) {
    const result = await executeAction(action);
    results.push(result);
  }
  
  return results;
}
