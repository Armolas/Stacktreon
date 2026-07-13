import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const ALLOWED_CATEGORIES = [
  "Digital Art",
  "Music",
  "Writing",
  "Education",
  "Gaming",
  "Photography",
  "Development",
  "Video Production",
  "Podcasting",
  "Comics",
  "Animation",
  "Crafts",
  "Technology",
  "Fitness",
  "Cooking",
  "Other",
];

export function detectContentType(mimeType: string): "video" | "audio" | "article" {
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "article";
}

/** True when the wallet holds an unexpired active subscription to the creator. */
export async function isSubscriptionActive(
  ctx: QueryCtx,
  creatorId: Id<"creators">,
  subscriberWallet: string,
): Promise<boolean> {
  const now = Date.now();
  const subs = await ctx.db
    .query("subscriptions")
    .withIndex("by_creator_subscriber", (q) =>
      q.eq("creatorId", creatorId).eq("subscriberWallet", subscriberWallet),
    )
    .collect();
  return subs.some((s) => s.status === "active" && s.expiresAt > now);
}

// Response mappers keep the field names the frontend has always consumed
// (id/createdAt instead of _id/_creationTime).

export function creatorResponse(doc: Doc<"creators">) {
  const created = new Date(doc._creationTime).toISOString();
  return {
    id: doc._id,
    walletAddress: doc.walletAddress,
    bns: doc.bns,
    displayName: doc.displayName,
    username: doc.username,
    bio: doc.bio,
    about: doc.about,
    subscriptionFee: doc.subscriptionFee,
    categories: doc.categories ?? null,
    createdAt: created,
    updatedAt: created,
  };
}

export function contentResponse(
  doc: Doc<"contents">,
  creator: Doc<"creators">,
  fileUrl: string | null,
  locked: boolean,
) {
  const created = new Date(doc._creationTime).toISOString();
  return {
    id: doc._id,
    title: doc.title,
    description: doc.description,
    contentType: doc.contentType,
    price: doc.price,
    fileUrl,
    locked,
    viewCount: doc.viewCount,
    createdAt: created,
    updatedAt: created,
    creator: creatorResponse(creator),
  };
}

export function transactionResponse(doc: Doc<"transactions">) {
  return {
    id: doc._id,
    payerWallet: doc.payerWallet,
    creatorWallet: doc.creatorWallet,
    contentId: doc.contentId ?? null,
    type: doc.type,
    amount: doc.amount,
    txHash: doc.txHash ?? null,
    status: doc.status,
    createdAt: new Date(doc._creationTime).toISOString(),
  };
}

export function subscriptionResponse(doc: Doc<"subscriptions">, creator: Doc<"creators">) {
  return {
    id: doc._id,
    subscriberWallet: doc.subscriberWallet,
    startedAt: new Date(doc.startedAt).toISOString(),
    expiresAt: new Date(doc.expiresAt).toISOString(),
    status: doc.status,
    creator: creatorResponse(creator),
  };
}
