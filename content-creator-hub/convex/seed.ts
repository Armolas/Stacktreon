import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

/**
 * Dev helper: `npx convex run seed:demo` populates a demo creator with one
 * free and one pay-per-view article so the app has something to show.
 */
export const demo = internalAction({
  args: {},
  handler: async (ctx) => {
    const freeBlob = new Blob(
      ["Welcome to Stacktreon! This is a free demo article anyone can read."],
      { type: "text/plain" },
    );
    const paidBlob = new Blob(
      ["This is premium demo content, unlocked by subscription or x402 pay-per-view."],
      { type: "text/plain" },
    );
    const freeStorageId = await ctx.storage.store(freeBlob);
    const paidStorageId = await ctx.storage.store(paidBlob);
    await ctx.runMutation(internal.seed.insertDemoData, { freeStorageId, paidStorageId });
  },
});

export const insertDemoData = internalMutation({
  args: { freeStorageId: v.id("_storage"), paidStorageId: v.id("_storage") },
  handler: async (ctx, { freeStorageId, paidStorageId }) => {
    const existing = await ctx.db
      .query("creators")
      .withIndex("by_username", (q) => q.eq("username", "demo"))
      .unique();
    if (existing) return;

    const creatorId = await ctx.db.insert("creators", {
      walletAddress: "ST1A514GGX294KQC7ZKD7Q886DDWVBA6GQ5MRB07E",
      bns: "demo.btc",
      displayName: "Demo Creator",
      username: "demo",
      bio: "Sample profile for trying out Stacktreon on testnet.",
      about: "Uploads demo drops so you can try subscriptions and pay-per-view unlocks.",
      subscriptionFee: 5,
      categories: ["Education"],
    });
    await ctx.db.insert("contents", {
      creatorId,
      title: "Welcome to Stacktreon",
      description: "A free article to show the reading experience.",
      contentType: "article",
      price: 0,
      storageId: freeStorageId,
      viewCount: 0,
    });
    await ctx.db.insert("contents", {
      creatorId,
      title: "Premium demo drop",
      description: "Unlock this with a 0.5 STX x402 payment or a subscription.",
      contentType: "article",
      price: 0.5,
      storageId: paidStorageId,
      viewCount: 0,
    });
  },
});
