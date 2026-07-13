import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  creators: defineTable({
    walletAddress: v.string(),
    bns: v.string(),
    displayName: v.string(),
    username: v.string(),
    bio: v.string(),
    about: v.string(),
    // Monthly fee in STX (6 decimals max, mirroring the on-chain fee / 1e6)
    subscriptionFee: v.number(),
    categories: v.optional(v.array(v.string())),
  })
    .index("by_wallet", ["walletAddress"])
    .index("by_username", ["username"]),

  contents: defineTable({
    creatorId: v.id("creators"),
    title: v.string(),
    description: v.string(),
    contentType: v.union(v.literal("video"), v.literal("audio"), v.literal("article")),
    // Pay-per-view price in STX; 0 means free / subscriber-only
    price: v.number(),
    storageId: v.id("_storage"),
    // Counts successful pay-per-view unlocks only, never plain reads
    viewCount: v.number(),
  }).index("by_creator", ["creatorId"]),

  subscriptions: defineTable({
    creatorId: v.id("creators"),
    subscriberWallet: v.string(),
    startedAt: v.number(),
    expiresAt: v.number(),
    status: v.union(v.literal("active"), v.literal("expired")),
    transactionId: v.id("transactions"),
  })
    .index("by_creator", ["creatorId"])
    .index("by_subscriber", ["subscriberWallet"])
    .index("by_creator_subscriber", ["creatorId", "subscriberWallet"])
    .index("by_transaction", ["transactionId"])
    .index("by_status_expiry", ["status", "expiresAt"]),

  transactions: defineTable({
    payerWallet: v.string(),
    creatorWallet: v.string(),
    contentId: v.optional(v.string()),
    type: v.union(v.literal("subscription"), v.literal("pay-per-view")),
    // Amount in STX
    amount: v.number(),
    txHash: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("confirmed"), v.literal("failed")),
  })
    .index("by_payer", ["payerWallet"])
    .index("by_creator_wallet", ["creatorWallet"]),
});
