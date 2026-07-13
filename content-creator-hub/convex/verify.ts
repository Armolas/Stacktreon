import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const MAX_ATTEMPTS = 40; // x 30s = give the chain ~20 minutes
const RETRY_DELAY_MS = 30_000;

const DEFAULT_CONTRACT_ID = "ST1A514GGX294KQC7ZKD7Q886DDWVBA6GQ5MRB07E.stacktreonv1";

/**
 * Verify a reported subscribe() transaction against the Stacks chain via the
 * Hiro API. Only a successful contract call to our subscribe function, sent
 * by the payer for the right creator, mints a subscription.
 */
export const verifySubscriptionTx = internalAction({
  args: { transactionId: v.id("transactions"), attempt: v.number() },
  handler: async (ctx, { transactionId, attempt }) => {
    const tx = await ctx.runQuery(internal.transactions.getInternal, { transactionId });
    if (!tx || tx.status !== "pending" || !tx.txHash) return;

    const host =
      process.env.NETWORK === "mainnet"
        ? "https://api.mainnet.hiro.so"
        : "https://api.testnet.hiro.so";
    const contractId = process.env.CONTRACT_ID ?? DEFAULT_CONTRACT_ID;

    // undefined = transient failure (retry), null = tx not indexed yet (retry)
    let txData: Record<string, unknown> | null | undefined;
    try {
      const res = await fetch(`${host}/extended/v1/tx/${tx.txHash}`);
      if (res.status === 404) {
        txData = null;
      } else if (res.ok) {
        txData = (await res.json()) as Record<string, unknown>;
      } else {
        txData = undefined;
      }
    } catch {
      txData = undefined;
    }

    const retryOrFail = async () => {
      if (attempt + 1 >= MAX_ATTEMPTS) {
        await ctx.runMutation(internal.transactions.markFailed, { transactionId });
      } else {
        await ctx.scheduler.runAfter(RETRY_DELAY_MS, internal.verify.verifySubscriptionTx, {
          transactionId,
          attempt: attempt + 1,
        });
      }
    };

    if (txData === undefined || txData === null || txData.tx_status === "pending") {
      await retryOrFail();
      return;
    }

    const call = txData.contract_call as
      | { contract_id?: string; function_name?: string; function_args?: { repr?: string }[] }
      | undefined;
    const creatorArg = call?.function_args?.[0]?.repr ?? "";
    const valid =
      txData.tx_status === "success" &&
      txData.tx_type === "contract_call" &&
      call?.contract_id === contractId &&
      call?.function_name === "subscribe" &&
      txData.sender_address === tx.payerWallet &&
      creatorArg === `'${tx.creatorWallet}`;

    if (valid) {
      await ctx.runMutation(internal.transactions.confirmSubscription, { transactionId });
    } else {
      await ctx.runMutation(internal.transactions.markFailed, { transactionId });
    }
  },
});
