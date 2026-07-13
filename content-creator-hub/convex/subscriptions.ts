import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { subscriptionResponse } from "./model";

export const status = query({
  args: { creatorId: v.id("creators"), userWallet: v.string() },
  handler: async (ctx, { creatorId, userWallet }) => {
    const now = Date.now();
    const subs = await ctx.db
      .query("subscriptions")
      .withIndex("by_creator_subscriber", (q) =>
        q.eq("creatorId", creatorId).eq("subscriberWallet", userWallet),
      )
      .collect();

    const active = subs.find((s) => s.status === "active" && s.expiresAt > now);
    if (active) {
      return { subscribed: true, expiresAt: new Date(active.expiresAt).toISOString() };
    }
    const hadOne = subs.length > 0;
    return hadOne ? { subscribed: false, expired: true } : { subscribed: false };
  },
});

export const listByCreator = query({
  args: { creatorId: v.id("creators") },
  handler: async (ctx, { creatorId }) => {
    const creator = await ctx.db.get(creatorId);
    if (!creator) return [];
    const subs = await ctx.db
      .query("subscriptions")
      .withIndex("by_creator", (q) => q.eq("creatorId", creatorId))
      .order("desc")
      .collect();
    return subs.map((sub) => subscriptionResponse(sub, creator));
  },
});

export const listByUser = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) => {
    const subs = await ctx.db
      .query("subscriptions")
      .withIndex("by_subscriber", (q) => q.eq("subscriberWallet", walletAddress))
      .order("desc")
      .collect();
    const results = [];
    for (const sub of subs) {
      const creator = await ctx.db.get(sub.creatorId);
      if (creator) results.push(subscriptionResponse(sub, creator));
    }
    return results;
  },
});

/** Cron target: flip active subscriptions past their expiry to expired. */
export const expireStale = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const stale = await ctx.db
      .query("subscriptions")
      .withIndex("by_status_expiry", (q) => q.eq("status", "active").lt("expiresAt", now))
      .collect();
    for (const sub of stale) {
      await ctx.db.patch(sub._id, { status: "expired" });
    }
  },
});
