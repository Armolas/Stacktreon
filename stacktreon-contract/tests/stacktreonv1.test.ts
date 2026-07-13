import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const creator = accounts.get("wallet_1")!;
const fan = accounts.get("wallet_2")!;
const stranger = accounts.get("wallet_3")!;

const CONTRACT = "stacktreonv1";
const FEE = 5_000_000; // 5 STX in microSTX
const THIRTY_DAYS_IN_BURN_BLOCKS = 4_320; // 2,592,000s at ~600s per burn block

const registerCreator = (who: string, fee: number, sender = who) =>
  simnet.callPublicFn(
    CONTRACT,
    "register-creator",
    [Cl.principal(who), Cl.uint(fee)],
    sender,
  );

const subscribe = (to: string, sender: string) =>
  simnet.callPublicFn(CONTRACT, "subscribe", [Cl.principal(to)], sender);

const getCreator = (who: string) =>
  simnet.callReadOnlyFn(CONTRACT, "get-creator", [Cl.principal(who)], who);

const isActiveSubscriber = (creatorAddr: string, fanAddr: string) =>
  simnet.callReadOnlyFn(
    CONTRACT,
    "is-active-subscriber",
    [Cl.principal(creatorAddr), Cl.principal(fanAddr)],
    fanAddr,
  );

describe("register-creator", () => {
  it("registers a creator with a subscription fee", () => {
    const { result } = registerCreator(creator, FEE);
    expect(result).toBeOk(Cl.bool(true));

    expect(getCreator(creator).result).toBeTuple({
      fee: Cl.uint(FEE),
      totalEarning: Cl.uint(0),
      balance: Cl.uint(0),
    });
  });

  it("rejects a zero subscription fee (err u3)", () => {
    const { result } = registerCreator(creator, 0);
    expect(result).toBeErr(Cl.uint(3));
  });

  it("rejects registering an already-registered creator (err u4)", () => {
    registerCreator(creator, FEE);
    const { result } = registerCreator(creator, FEE);
    expect(result).toBeErr(Cl.uint(4));
  });
});

describe("subscribe", () => {
  it("rejects subscribing to an unregistered creator (err u1)", () => {
    const { result } = subscribe(creator, fan);
    expect(result).toBeErr(Cl.uint(1));
  });

  it("transfers the fee and records a 30-day subscription", () => {
    registerCreator(creator, FEE);

    const { result, events } = subscribe(creator, fan);
    expect(result).toBeOk(Cl.bool(true));

    // The fee is held by the contract and credited to the creator's balance
    expect(getCreator(creator).result).toBeTuple({
      fee: Cl.uint(FEE),
      totalEarning: Cl.uint(FEE),
      balance: Cl.uint(FEE),
    });

    expect(isActiveSubscriber(creator, fan).result).toBeOk(Cl.bool(true));

    const transfer = events.find((e) => e.event === "stx_transfer_event");
    expect(transfer).toBeDefined();
    expect(transfer!.data.amount).toBe(String(FEE));
  });

  it("rejects a second subscription while one is active (err u2)", () => {
    registerCreator(creator, FEE);
    subscribe(creator, fan);

    const { result } = subscribe(creator, fan);
    expect(result).toBeErr(Cl.uint(2));
  });

  it("allows re-subscribing after the 30-day window expires", () => {
    registerCreator(creator, FEE);
    subscribe(creator, fan);

    simnet.mineEmptyBurnBlocks(THIRTY_DAYS_IN_BURN_BLOCKS + 10);
    expect(isActiveSubscriber(creator, fan).result).toBeOk(Cl.bool(false));

    const { result } = subscribe(creator, fan);
    expect(result).toBeOk(Cl.bool(true));
    expect(isActiveSubscriber(creator, fan).result).toBeOk(Cl.bool(true));

    expect(getCreator(creator).result).toBeTuple({
      fee: Cl.uint(FEE),
      totalEarning: Cl.uint(FEE * 2),
      balance: Cl.uint(FEE * 2),
    });
  });
});

describe("withdraw-creator-earning", () => {
  it("rejects withdrawal from a non-creator (err u1)", () => {
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "withdraw-creator-earning",
      [Cl.uint(1_000_000)],
      stranger,
    );
    expect(result).toBeErr(Cl.uint(1));
  });

  it("rejects withdrawing more than the balance (err u4)", () => {
    registerCreator(creator, FEE);
    subscribe(creator, fan);

    const { result } = simnet.callPublicFn(
      CONTRACT,
      "withdraw-creator-earning",
      [Cl.uint(FEE + 1)],
      creator,
    );
    expect(result).toBeErr(Cl.uint(4));
  });

  it("pays out earnings and decrements the balance", () => {
    registerCreator(creator, FEE);
    subscribe(creator, fan);

    const withdrawal = 2_000_000;
    const { result, events } = simnet.callPublicFn(
      CONTRACT,
      "withdraw-creator-earning",
      [Cl.uint(withdrawal)],
      creator,
    );
    expect(result).toBeOk(Cl.bool(true));

    const transfer = events.find((e) => e.event === "stx_transfer_event");
    expect(transfer).toBeDefined();
    expect(transfer!.data.amount).toBe(String(withdrawal));
    expect(transfer!.data.recipient).toBe(creator);

    // Balance drops, lifetime earnings stay
    expect(getCreator(creator).result).toBeTuple({
      fee: Cl.uint(FEE),
      totalEarning: Cl.uint(FEE),
      balance: Cl.uint(FEE - withdrawal),
    });
  });
});

describe("update-subscription-fee", () => {
  it("rejects an update from a non-creator (err u1)", () => {
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "update-subscription-fee",
      [Cl.uint(FEE)],
      stranger,
    );
    expect(result).toBeErr(Cl.uint(1));
  });

  it("rejects a zero fee (err u4)", () => {
    registerCreator(creator, FEE);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "update-subscription-fee",
      [Cl.uint(0)],
      creator,
    );
    expect(result).toBeErr(Cl.uint(4));
  });

  it("updates the fee without touching earnings or balance", () => {
    registerCreator(creator, FEE);
    subscribe(creator, fan);

    const newFee = 8_000_000;
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "update-subscription-fee",
      [Cl.uint(newFee)],
      creator,
    );
    expect(result).toBeOk(Cl.bool(true));

    expect(getCreator(creator).result).toBeTuple({
      fee: Cl.uint(newFee),
      totalEarning: Cl.uint(FEE),
      balance: Cl.uint(FEE),
    });
  });
});

describe("read-only helpers", () => {
  it("is-active-subscriber returns false for a wallet that never subscribed", () => {
    registerCreator(creator, FEE);
    expect(isActiveSubscriber(creator, fan).result).toBeOk(Cl.bool(false));
  });

  it("get-creator returns zeroed defaults for an unknown principal", () => {
    expect(getCreator(stranger).result).toBeTuple({
      fee: Cl.uint(0),
      totalEarning: Cl.uint(0),
      balance: Cl.uint(0),
    });
  });
});
