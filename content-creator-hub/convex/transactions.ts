import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { THIRTY_DAYS_MS, transactionResponse } from "./model";

/**
 * A fan reports an on-chain subscribe() call. The transaction is stored as
 * pending and only becomes a subscription after the verifier confirms it on
 * the Stacks chain.
 */
export const submitSubscription = mutation({
  args: {
    payerWallet: v.string(),
    creatorWallet: v.string(),
    amount: v.number(),
    txHash: v.string(),
  },
  handler: async (ctx, args) => {
    const creator = await ctx.db
      .query("creators")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.creatorWallet))
      .unique();
    if (!creator) {
      throw new ConvexError("Creator not found");
    }
    if (args.amount < 0) {
      throw new ConvexError("Amount must be 0 or greater");
    }

    const id = await ctx.db.insert("transactions", {
      payerWallet: args.payerWallet,
      creatorWallet: args.creatorWallet,
      type: "subscription",
      amount: args.amount,
      txHash: args.txHash,
      status: "pending",
    });
    await ctx.scheduler.runAfter(0, internal.verify.verifySubscriptionTx, {
      transactionId: id,
      attempt: 0,
    });
    return transactionResponse((await ctx.db.get(id))!);
  },
});

export const listByCreatorWallet = query({
  args: { creatorWallet: v.string() },
  handler: async (ctx, { creatorWallet }) => {
    const docs = await ctx.db
      .query("transactions")
      .withIndex("by_creator_wallet", (q) => q.eq("creatorWallet", creatorWallet))
      .order("desc")
      .collect();
    return docs.map(transactionResponse);
  },
});

export const listByPayerWallet = query({
  args: { payerWallet: v.string() },
  handler: async (ctx, { payerWallet }) => {
    const docs = await ctx.db
      .query("transactions")
      .withIndex("by_payer", (q) => q.eq("payerWallet", payerWallet))
      .order("desc")
      .collect();
    return docs.map(transactionResponse);
  },
});

export const earningsByCreatorWallet = query({
  args: { creatorWallet: v.string() },
  handler: async (ctx, { creatorWallet }) => {
    const confirmed = (
      await ctx.db
        .query("transactions")
        .withIndex("by_creator_wallet", (q) => q.eq("creatorWallet", creatorWallet))
        .collect()
    ).filter((tx) => tx.status === "confirmed");

    const sum = (docs: typeof confirmed) => docs.reduce((total, tx) => total + tx.amount, 0);
    return {
      totalEarnings: sum(confirmed),
      subscriptionEarnings: sum(confirmed.filter((tx) => tx.type === "subscription")),
      payPerViewEarnings: sum(confirmed.filter((tx) => tx.type === "pay-per-view")),
      transactionCount: confirmed.length,
    };
  },
});

/** Used by the verifier action. */
export const getInternal = internalQuery({
  args: { transactionId: v.id("transactions") },
  handler: async (ctx, { transactionId }) => {
    return await ctx.db.get(transactionId);
  },
});

/**
 * Mark a verified subscription transaction confirmed and create the 30-day
 * subscription. Idempotent: at most one subscription per transaction.
 */
export const confirmSubscription = internalMutation({
  args: { transactionId: v.id("transactions") },
  handler: async (ctx, { transactionId }) => {
    const tx = await ctx.db.get(transactionId);
    if (!tx || tx.type !== "subscription") return;

    if (tx.status !== "confirmed") {
      await ctx.db.patch(transactionId, { status: "confirmed" });
    }

    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_transaction", (q) => q.eq("transactionId", transactionId))
      .unique();
    if (existing) return;

    const creator = await ctx.db
      .query("creators")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", tx.creatorWallet))
      .unique();
    if (!creator) return;

    const startedAt = Date.now();
    await ctx.db.insert("subscriptions", {
      creatorId: creator._id,
      subscriberWallet: tx.payerWallet,
      startedAt,
      expiresAt: startedAt + THIRTY_DAYS_MS,
      status: "active",
      transactionId,
    });
  },
});

export const markFailed = internalMutation({
  args: { transactionId: v.id("transactions") },
  handler: async (ctx, { transactionId }) => {
    const tx = await ctx.db.get(transactionId);
    if (tx && tx.status === "pending") {
      await ctx.db.patch(transactionId, { status: "failed" });
    }
  },
});

/** Record a settled x402 pay-per-view unlock and bump the view counter. */
export const recordPaidView = internalMutation({
  args: {
    contentId: v.id("contents"),
    payerWallet: v.string(),
    txHash: v.string(),
  },
  handler: async (ctx, { contentId, payerWallet, txHash }) => {
    const doc = await ctx.db.get(contentId);
    if (!doc) return;
    const creator = await ctx.db.get(doc.creatorId);
    if (!creator) return;

    await ctx.db.insert("transactions", {
      payerWallet,
      creatorWallet: creator.walletAddress,
      contentId: String(contentId),
      type: "pay-per-view",
      amount: doc.price,
      txHash,
      status: "confirmed",
    });
    await ctx.db.patch(contentId, { viewCount: doc.viewCount + 1 });
  },
});
