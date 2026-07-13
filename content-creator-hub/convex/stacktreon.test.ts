/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/!(*.*.*)*.*s");

const CREATOR_WALLET = "ST1CREATORWALLETXXXXXXXXXXXXXXXXXXXXXXXX";
const FAN_WALLET = "ST2FANWALLETXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

const baseCreator = {
  username: "devdao",
  displayName: "DevDAO",
  walletAddress: CREATOR_WALLET,
  bns: "devdao.btc",
  subscriptionFee: 5,
  bio: "Building things",
  about: "All about building",
  categories: ["Development"],
};

function setup() {
  return convexTest(schema, modules);
}

async function registerCreator(t: ReturnType<typeof convexTest>) {
  return await t.mutation(api.creators.register, baseCreator);
}

async function insertContent(
  t: ReturnType<typeof convexTest>,
  creatorId: Id<"creators">,
  price: number,
) {
  return await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(new Blob(["hello stacktreon"]));
    return await ctx.db.insert("contents", {
      creatorId,
      title: "Drop",
      description: "A premium drop",
      contentType: "article",
      price,
      storageId,
      viewCount: 0,
    });
  });
}

async function insertActiveSubscription(
  t: ReturnType<typeof convexTest>,
  creatorId: Id<"creators">,
  subscriberWallet: string,
  expiresAt: number,
) {
  return await t.run(async (ctx) => {
    const transactionId = await ctx.db.insert("transactions", {
      payerWallet: subscriberWallet,
      creatorWallet: CREATOR_WALLET,
      type: "subscription",
      amount: 5,
      txHash: "0xseed",
      status: "confirmed",
    });
    return await ctx.db.insert("subscriptions", {
      creatorId,
      subscriberWallet,
      startedAt: Date.now(),
      expiresAt,
      status: "active",
      transactionId,
    });
  });
}

describe("creators.register", () => {
  it("registers and returns the response shape", async () => {
    const t = setup();
    const creator = await registerCreator(t);
    expect(creator.username).toBe("devdao");
    expect(creator.subscriptionFee).toBe(5);
    expect(creator.id).toBeDefined();
    expect(creator.createdAt).toBeDefined();
  });

  it("rejects a duplicate wallet address", async () => {
    const t = setup();
    await registerCreator(t);
    await expect(
      t.mutation(api.creators.register, { ...baseCreator, username: "other" }),
    ).rejects.toThrow(/wallet address already exists/);
  });

  it("rejects a duplicate username", async () => {
    const t = setup();
    await registerCreator(t);
    await expect(
      t.mutation(api.creators.register, {
        ...baseCreator,
        walletAddress: "ST3OTHERWALLET",
      }),
    ).rejects.toThrow(/username is already taken/i);
  });

  it("rejects usernames shorter than 3 characters", async () => {
    const t = setup();
    await expect(
      t.mutation(api.creators.register, { ...baseCreator, username: "ab" }),
    ).rejects.toThrow(/at least 3 characters/);
  });

  it("rejects unknown categories", async () => {
    const t = setup();
    await expect(
      t.mutation(api.creators.register, { ...baseCreator, categories: ["Nonsense"] }),
    ).rejects.toThrow(/Invalid category/);
  });
});

describe("content access", () => {
  it("locks priced content for anonymous viewers", async () => {
    const t = setup();
    const creator = await registerCreator(t);
    const contentId = await insertContent(t, creator.id, 2);

    const result = await t.query(api.content.getById, { id: contentId });
    expect(result?.locked).toBe(true);
    expect(result?.fileUrl).toBeNull();
  });

  it("unlocks priced content for an active subscriber", async () => {
    const t = setup();
    const creator = await registerCreator(t);
    const contentId = await insertContent(t, creator.id, 2);
    await insertActiveSubscription(t, creator.id, FAN_WALLET, Date.now() + 1000_000);

    const result = await t.query(api.content.getById, {
      id: contentId,
      userWallet: FAN_WALLET,
    });
    expect(result?.locked).toBe(false);
    expect(result?.fileUrl).toBeTruthy();
  });

  it("keeps content locked when the subscription is expired", async () => {
    const t = setup();
    const creator = await registerCreator(t);
    const contentId = await insertContent(t, creator.id, 2);
    await insertActiveSubscription(t, creator.id, FAN_WALLET, Date.now() - 1000);

    const result = await t.query(api.content.getById, {
      id: contentId,
      userWallet: FAN_WALLET,
    });
    expect(result?.locked).toBe(true);
    expect(result?.fileUrl).toBeNull();
  });

  it("serves free content to everyone", async () => {
    const t = setup();
    const creator = await registerCreator(t);
    const contentId = await insertContent(t, creator.id, 0);

    const result = await t.query(api.content.getById, { id: contentId });
    expect(result?.locked).toBe(false);
    expect(result?.fileUrl).toBeTruthy();
  });

  it("returns null for a malformed id", async () => {
    const t = setup();
    const result = await t.query(api.content.getById, { id: "not-an-id" });
    expect(result).toBeNull();
  });
});

describe("subscriptions.status", () => {
  it("reports subscribed with expiry for an active subscription", async () => {
    const t = setup();
    const creator = await registerCreator(t);
    const expiresAt = Date.now() + 1000_000;
    await insertActiveSubscription(t, creator.id, FAN_WALLET, expiresAt);

    const status = await t.query(api.subscriptions.status, {
      creatorId: creator.id,
      userWallet: FAN_WALLET,
    });
    expect(status.subscribed).toBe(true);
    expect(status.expiresAt).toBe(new Date(expiresAt).toISOString());
  });

  it("reports not subscribed once past expiry, even before the cron runs", async () => {
    const t = setup();
    const creator = await registerCreator(t);
    await insertActiveSubscription(t, creator.id, FAN_WALLET, Date.now() - 1000);

    const status = await t.query(api.subscriptions.status, {
      creatorId: creator.id,
      userWallet: FAN_WALLET,
    });
    expect(status.subscribed).toBe(false);
  });

  it("expireStale flips overdue active subscriptions to expired", async () => {
    const t = setup();
    const creator = await registerCreator(t);
    const subId = await insertActiveSubscription(t, creator.id, FAN_WALLET, Date.now() - 1000);

    await t.mutation(internal.subscriptions.expireStale, {});
    const sub = await t.run(async (ctx) => ctx.db.get(subId));
    expect(sub?.status).toBe("expired");
  });
});

describe("transactions", () => {
  it("submitSubscription stores a pending transaction", async () => {
    const t = setup();
    await registerCreator(t);
    const tx = await t.mutation(api.transactions.submitSubscription, {
      payerWallet: FAN_WALLET,
      creatorWallet: CREATOR_WALLET,
      amount: 5,
      txHash: "0xabc",
    });
    expect(tx.status).toBe("pending");
    expect(tx.type).toBe("subscription");
  });

  it("submitSubscription rejects unknown creators", async () => {
    const t = setup();
    await expect(
      t.mutation(api.transactions.submitSubscription, {
        payerWallet: FAN_WALLET,
        creatorWallet: "ST9NOBODY",
        amount: 5,
        txHash: "0xabc",
      }),
    ).rejects.toThrow(/Creator not found/);
  });

  it("confirmSubscription is idempotent: one subscription per transaction", async () => {
    const t = setup();
    await registerCreator(t);
    const txId = await t.run(async (ctx) =>
      ctx.db.insert("transactions", {
        payerWallet: FAN_WALLET,
        creatorWallet: CREATOR_WALLET,
        type: "subscription",
        amount: 5,
        txHash: "0xabc",
        status: "pending",
      }),
    );

    await t.mutation(internal.transactions.confirmSubscription, { transactionId: txId });
    await t.mutation(internal.transactions.confirmSubscription, { transactionId: txId });

    const subs = await t.run(async (ctx) => ctx.db.query("subscriptions").collect());
    expect(subs).toHaveLength(1);
    expect(subs[0].subscriberWallet).toBe(FAN_WALLET);
    // 30-day window
    expect(subs[0].expiresAt - subs[0].startedAt).toBe(30 * 24 * 60 * 60 * 1000);

    const tx = await t.run(async (ctx) => ctx.db.get(txId));
    expect(tx?.status).toBe("confirmed");
  });

  it("recordPaidView stores a confirmed pay-per-view tx and bumps viewCount", async () => {
    const t = setup();
    const creator = await registerCreator(t);
    const contentId = await insertContent(t, creator.id, 2);

    await t.mutation(internal.transactions.recordPaidView, {
      contentId,
      payerWallet: FAN_WALLET,
      txHash: "0xpaid",
    });

    const doc = await t.run(async (ctx) => ctx.db.get(contentId));
    expect(doc?.viewCount).toBe(1);

    const txs = await t.query(api.transactions.listByPayerWallet, { payerWallet: FAN_WALLET });
    expect(txs).toHaveLength(1);
    expect(txs[0].type).toBe("pay-per-view");
    expect(txs[0].status).toBe("confirmed");
    expect(txs[0].amount).toBe(2);
  });

  it("computes earnings with numeric addition", async () => {
    const t = setup();
    await registerCreator(t);
    await t.run(async (ctx) => {
      for (const [type, amount, status] of [
        ["subscription", 5, "confirmed"],
        ["pay-per-view", 2.5, "confirmed"],
        ["subscription", 5, "pending"],
      ] as const) {
        await ctx.db.insert("transactions", {
          payerWallet: FAN_WALLET,
          creatorWallet: CREATOR_WALLET,
          type,
          amount,
          status,
          txHash: "0x1",
        });
      }
    });

    const earnings = await t.query(api.transactions.earningsByCreatorWallet, {
      creatorWallet: CREATOR_WALLET,
    });
    expect(earnings.totalEarnings).toBe(7.5);
    expect(earnings.subscriptionEarnings).toBe(5);
    expect(earnings.payPerViewEarnings).toBe(2.5);
    expect(earnings.transactionCount).toBe(2);
  });
});
