import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { ALLOWED_CATEGORIES, creatorResponse } from "./model";

export const register = mutation({
  args: {
    username: v.string(),
    displayName: v.string(),
    walletAddress: v.string(),
    bns: v.string(),
    subscriptionFee: v.number(),
    bio: v.string(),
    about: v.string(),
    categories: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    if (args.username.trim().length < 3) {
      throw new ConvexError("Username must be at least 3 characters");
    }
    if (args.subscriptionFee < 0) {
      throw new ConvexError("Subscription fee must be 0 or greater");
    }
    for (const category of args.categories ?? []) {
      if (!ALLOWED_CATEGORIES.includes(category)) {
        throw new ConvexError(`Invalid category: ${category}`);
      }
    }

    const byWallet = await ctx.db
      .query("creators")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .unique();
    if (byWallet) {
      throw new ConvexError("A creator with this wallet address already exists");
    }
    const byUsername = await ctx.db
      .query("creators")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .unique();
    if (byUsername) {
      throw new ConvexError("This username is already taken");
    }

    const id = await ctx.db.insert("creators", args);
    return creatorResponse((await ctx.db.get(id))!);
  },
});

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const creators = await ctx.db.query("creators").collect();
    return creators.map(creatorResponse);
  },
});

export const getByWallet = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) => {
    const creator = await ctx.db
      .query("creators")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", walletAddress))
      .unique();
    return creator ? creatorResponse(creator) : null;
  },
});

export const getByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const creator = await ctx.db
      .query("creators")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();
    return creator ? creatorResponse(creator) : null;
  },
});

export const getById = query({
  args: { id: v.id("creators") },
  handler: async (ctx, { id }) => {
    const creator = await ctx.db.get(id);
    return creator ? creatorResponse(creator) : null;
  },
});
