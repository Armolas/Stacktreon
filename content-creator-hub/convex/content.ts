import { internalQuery, mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { contentResponse, detectContentType, isSubscriptionActive } from "./model";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    creatorId: v.id("creators"),
    storageId: v.id("_storage"),
    title: v.string(),
    description: v.string(),
    price: v.number(),
    mimeType: v.string(),
  },
  handler: async (ctx, args) => {
    const creator = await ctx.db.get(args.creatorId);
    if (!creator) {
      throw new ConvexError("Creator not found");
    }
    if (args.title.trim().length === 0 || args.description.trim().length === 0) {
      throw new ConvexError("Title and description are required");
    }
    if (args.price < 0) {
      throw new ConvexError("Price must be 0 or greater");
    }

    const id = await ctx.db.insert("contents", {
      creatorId: args.creatorId,
      title: args.title,
      description: args.description,
      contentType: detectContentType(args.mimeType),
      price: args.price,
      storageId: args.storageId,
      viewCount: 0,
    });
    const doc = (await ctx.db.get(id))!;
    return contentResponse(doc, creator, null, doc.price > 0);
  },
});

export const getById = query({
  // id is a raw URL param, so accept any string and normalize it
  args: { id: v.string(), userWallet: v.optional(v.string()) },
  handler: async (ctx, { id, userWallet }) => {
    const contentId = ctx.db.normalizeId("contents", id);
    if (!contentId) return null;
    const doc = await ctx.db.get(contentId);
    if (!doc) return null;
    const creator = (await ctx.db.get(doc.creatorId))!;

    const hasAccess =
      doc.price === 0 ||
      (userWallet ? await isSubscriptionActive(ctx, doc.creatorId, userWallet) : false);
    const fileUrl = hasAccess ? await ctx.storage.getUrl(doc.storageId) : null;
    return contentResponse(doc, creator, fileUrl, !hasAccess);
  },
});

export const listByCreator = query({
  args: { creatorId: v.id("creators"), userWallet: v.optional(v.string()) },
  handler: async (ctx, { creatorId, userWallet }) => {
    const creator = await ctx.db.get(creatorId);
    if (!creator) return [];

    const docs = await ctx.db
      .query("contents")
      .withIndex("by_creator", (q) => q.eq("creatorId", creatorId))
      .order("desc")
      .collect();

    const hasSubscription = userWallet
      ? await isSubscriptionActive(ctx, creatorId, userWallet)
      : false;

    return Promise.all(
      docs.map(async (doc) => {
        const hasAccess = doc.price === 0 || hasSubscription;
        const fileUrl = hasAccess ? await ctx.storage.getUrl(doc.storageId) : null;
        return contentResponse(doc, creator, fileUrl, !hasAccess);
      }),
    );
  },
});

/** Latest content from every creator the wallet actively subscribes to. */
export const feed = query({
  args: { userWallet: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { userWallet, limit }) => {
    const now = Date.now();
    const subs = await ctx.db
      .query("subscriptions")
      .withIndex("by_subscriber", (q) => q.eq("subscriberWallet", userWallet))
      .collect();
    const creatorIds = [
      ...new Set(
        subs
          .filter((s) => s.status === "active" && s.expiresAt > now)
          .map((s) => s.creatorId),
      ),
    ];

    const items = [];
    for (const creatorId of creatorIds) {
      const creator = await ctx.db.get(creatorId);
      if (!creator) continue;
      const docs = await ctx.db
        .query("contents")
        .withIndex("by_creator", (q) => q.eq("creatorId", creatorId))
        .order("desc")
        .collect();
      for (const doc of docs) {
        const fileUrl = await ctx.storage.getUrl(doc.storageId);
        items.push(contentResponse(doc, creator, fileUrl, false));
      }
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items.slice(0, limit ?? 15);
  },
});

export const update = mutation({
  args: {
    id: v.id("contents"),
    creatorId: v.id("creators"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    price: v.optional(v.number()),
  },
  handler: async (ctx, { id, creatorId, ...updates }) => {
    const doc = await ctx.db.get(id);
    if (!doc) throw new ConvexError("Content not found");
    if (doc.creatorId !== creatorId) {
      throw new ConvexError("You can only update your own content");
    }
    if (updates.price !== undefined && updates.price < 0) {
      throw new ConvexError("Price must be 0 or greater");
    }
    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("contents"), creatorId: v.id("creators") },
  handler: async (ctx, { id, creatorId }) => {
    const doc = await ctx.db.get(id);
    if (!doc) throw new ConvexError("Content not found");
    if (doc.creatorId !== creatorId) {
      throw new ConvexError("You can only delete your own content");
    }
    await ctx.storage.delete(doc.storageId);
    await ctx.db.delete(id);
  },
});

/** Used by the x402 HTTP action: full content with an unlocked file URL. */
export const getForX402 = internalQuery({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const contentId = ctx.db.normalizeId("contents", id);
    if (!contentId) return null;
    const doc = await ctx.db.get(contentId);
    if (!doc) return null;
    const creator = (await ctx.db.get(doc.creatorId))!;
    const fileUrl = await ctx.storage.getUrl(doc.storageId);
    return {
      contentId: doc._id,
      price: doc.price,
      payTo: creator.walletAddress,
      data: contentResponse(doc, creator, fileUrl, false),
    };
  },
});
