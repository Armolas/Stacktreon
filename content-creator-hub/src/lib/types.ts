import { ConvexError } from "convex/values";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";

// Response types are derived from the Convex functions so they can never
// drift from what the server actually returns.
export type CreatorResponse = NonNullable<FunctionReturnType<typeof api.creators.getByWallet>>;
export type ContentResponse = FunctionReturnType<typeof api.content.listByCreator>[number];
export type SubscriptionResponse = FunctionReturnType<typeof api.subscriptions.listByUser>[number];
export type SubscriptionStatusResponse = FunctionReturnType<typeof api.subscriptions.status>;
export type TransactionResponse = FunctionReturnType<
  typeof api.transactions.listByPayerWallet
>[number];

/** Human-readable message from a Convex or plain error. */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ConvexError) {
    return typeof err.data === "string" ? err.data : fallback;
  }
  return err instanceof Error ? err.message : fallback;
}
