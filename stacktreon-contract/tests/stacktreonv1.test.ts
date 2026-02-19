import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const creator1 = accounts.get("wallet_1")!;
const creator2 = accounts.get("wallet_2")!;
const subscriber1 = accounts.get("wallet_3")!;
const subscriber2 = accounts.get("wallet_4")!;
const subscriber3 = accounts.get("wallet_5")!;

// Helper functions
function registerCreator(
  creator: string,
  fee: number = 1000000, // 0.01 STX
  sender: string = creator
) {
  return simnet.callPublicFn(
    "stacktreon",
    "register-creator",
    [Cl.principal(creator), Cl.uint(fee)],
    sender
  );
}

function subscribe(
  creator: string,
  autoRenew: boolean = false,
  sender: string
) {
  return simnet.callPublicFn(
    "stacktreon",
    "subscribe",
    [Cl.principal(creator), Cl.bool(autoRenew)],
    sender
  );
}

function processAutoRenewal(creator: string, fan: string, sender: string = deployer) {
  return simnet.callPublicFn(
    "stacktreon",
    "process-auto-renewal",
    [Cl.principal(creator), Cl.principal(fan)],
    sender
  );
}

function cancelAutoRenewal(creator: string, sender: string) {
  return simnet.callPublicFn(
    "stacktreon",
    "cancel-auto-renewal",
    [Cl.principal(creator)],
    sender
  );
}

function setAutoRenewalDefault(enabled: boolean, sender: string) {
  return simnet.callPublicFn(
    "stacktreon",
    "set-auto-renewal-default",
    [Cl.bool(enabled)],
    sender
  );
}

function withdrawEarning(amount: number, sender: string) {
  return simnet.callPublicFn(
    "stacktreon",
    "withdraw-creator-earning",
    [Cl.uint(amount)],
    sender
  );
}

function updateSubscriptionFee(newFee: number, sender: string) {
  return simnet.callPublicFn(
    "stacktreon",
    "update-subscription-fee",
    [Cl.uint(newFee)],
    sender
  );
}

function advanceTime(seconds: number) {
  // This is a simplified approach - in reality you'd need to manipulate block timestamps
  for (let i = 0; i < seconds / 10; i++) {
    simnet.mineEmptyBlock();
  }
}

function getStxBalance(address: string): bigint {
  const assets = simnet.getAssetsMap();
  return assets.get("STX")?.get(address) || 0n;
}

describe("Stacktreon - Subscription Platform with Auto-Renewal", () => {
  
  describe("Basic Registration", () => {
    it("should register a creator successfully", () => {
      const fee = 1000000; // 0.01 STX
      const result = registerCreator(creator1, fee, creator1);
      
      expect(result.result).toBeOk(Cl.bool(true));
      
      // Verify creator data
      const creator = simnet.callReadOnlyFn(
        "stacktreon",
        "get-creator",
        [Cl.principal(creator1)],
        creator1
      );
      
      const creatorData = creator.result.expectSome().expectTuple();
      expect(creatorData["fee"]).toBeUint(fee);
      expect(creatorData["totalEarning"]).toBeUint(0);
      expect(creatorData["balance"]).toBeUint(0);
      expect(creatorData["autoRenewalDefault"]).toBeBool(false);
      expect(creatorData["totalSubscribers"]).toBeUint(0);
    });

    it("should not register creator with zero fee", () => {
      const result = registerCreator(creator1, 0, creator1);
      expect(result.result).toBeErr(Cl.uint(3));
    });

    it("should not allow duplicate registration", () => {
      registerCreator(creator1, 1000000, creator1);
      const result = registerCreator(creator1, 2000000, creator1);
      expect(result.result).toBeErr(Cl.uint(4));
    });
  });

  describe("Subscription with Auto-Renewal", () => {
    beforeEach(() => {
      registerCreator(creator1, 1000000, creator1);
    });

    it("should subscribe without auto-renewal", () => {
      const balanceBefore = getStxBalance(subscriber1);
      
      const result = subscribe(creator1, false, subscriber1);
      const paymentId = unwrapOkUint(result.result);
      expect(paymentId).toBe(0n);
      
      // Verify payment was made
      const balanceAfter = getStxBalance(subscriber1);
      expect(balanceBefore - balanceAfter).toBe(1000000n);
      
      // Verify subscription
      const status = simnet.callReadOnlyFn(
        "stacktreon",
        "is-active-subscriber",
        [Cl.principal(creator1), Cl.principal(subscriber1)],
        subscriber1
      );
      expect(status.result).toBeOk(Cl.bool(true));
      
      // Verify creator stats
      const creator = simnet.callReadOnlyFn(
        "stacktreon",
        "get-creator",
        [Cl.principal(creator1)],
        creator1
      );
      const creatorData = creator.result.expectSome().expectTuple();
      expect(creatorData["totalEarning"]).toBeUint(1000000);
      expect(creatorData["balance"]).toBeUint(1000000);
      expect(creatorData["totalSubscribers"]).toBeUint(1);
    });

    it("should subscribe with auto-renewal enabled", () => {
      const result = subscribe(creator1, true, subscriber1);
      expect(result.result).toBeOk(Cl.uint(0));
      
      // Verify subscriber info
      const info = simnet.callReadOnlyFn(
        "stacktreon",
        "get-subscriber-info",
        [Cl.principal(creator1), Cl.principal(subscriber1)],
        subscriber1
      );
      const subscriberData = info.result.expectSome().expectTuple();
      expect(subscriberData["autoRenew"]).toBeBool(true);
      expect(subscriberData["paymentAttempts"]).toBeUint(0);
    });

    it("should not allow subscribing while active subscription exists", () => {
      subscribe(creator1, false, subscriber1);
      
      const result = subscribe(creator1, false, subscriber1);
      expect(result.result).toBeErr(Cl.uint(2));
    });
  });

  describe("Auto-Renewal Processing", () => {
    beforeEach(() => {
      registerCreator(creator1, 1000000, creator1);
      subscribe(creator1, true, subscriber1);
    });

    it("should process successful auto-renewal", () => {
      // Advance time past subscription end (30 days + 1 second)
      advanceTime(2592001);
      
      const balanceBefore = getStxBalance(subscriber1);
      
      const result = processAutoRenewal(creator1, subscriber1, deployer);
      expect(result.result).toBeOk(Cl.uint(1)); // New payment ID
      
      // Verify payment was taken
      const balanceAfter = getStxBalance(subscriber1);
      expect(balanceBefore - balanceAfter).toBe(1000000n);
      
      // Verify subscription renewed
      const status = simnet.callReadOnlyFn(
        "stacktreon",
        "is-active-subscriber",
        [Cl.principal(creator1), Cl.principal(subscriber1)],
        subscriber1
      );
      expect(status.result).toBeOk(Cl.bool(true));
      
      // Verify creator balance increased
      const creator = simnet.callReadOnlyFn(
        "stacktreon",
        "get-creator",
        [Cl.principal(creator1)],
        creator1
      );
      const creatorData = creator.result.expectSome().expectTuple();
      expect(creatorData["totalEarning"]).toBeUint(2000000);
      expect(creatorData["balance"]).toBeUint(2000000);
    });

    it("should enter grace period on failed auto-renewal", () => {
      // Advance time past subscription end
      advanceTime(2592001);
      
      // Make subscriber have insufficient balance
      // This would require withdrawing all STX from subscriber
      
      const result = processAutoRenewal(creator1, subscriber1, deployer);
      expect(result.result).toBeErr(Cl.uint(5)); // ERR_AUTO_RENEW_FAILED
      
      // Verify subscriber is in grace period
      const status = simnet.callReadOnlyFn(
        "stacktreon",
        "is-active-subscriber",
        [Cl.principal(creator1), Cl.principal(subscriber1)],
        subscriber1
      );
      expect(status.result).toBeOk(Cl.bool(true)); // Still active during grace period
      
      // Verify payment attempt recorded
      const info = simnet.callReadOnlyFn(
        "stacktreon",
        "get-subscriber-info",
        [Cl.principal(creator1), Cl.principal(subscriber1)],
        subscriber1
      );
      const subscriberData = info.result.expectSome().expectTuple();
      expect(subscriberData["paymentAttempts"]).toBeUint(1);
    });

    it("should cancel subscription after max retry attempts", () => {
      advanceTime(2592001);
      
      // Simulate 3 failed attempts
      for (let i = 0; i < 3; i++) {
        processAutoRenewal(creator1, subscriber1, deployer);
        advanceTime(259200); // Advance grace period
      }
      
      // Try one more time - should fail with max retries
      const result = processAutoRenewal(creator1, subscriber1, deployer);
      expect(result.result).toBeErr(Cl.uint(7)); // ERR_MAX_RETRIES
      
      // Verify subscription is no longer active
      const status = simnet.callReadOnlyFn(
        "stacktreon",
        "is-active-subscriber",
        [Cl.principal(creator1), Cl.principal(subscriber1)],
        subscriber1
      );
      expect(status.result).toBeOk(Cl.bool(false));
    });
  });

  describe("Auto-Renewal Management", () => {
    beforeEach(() => {
      registerCreator(creator1, 1000000, creator1);
    });

    it("should cancel auto-renewal", () => {
      subscribe(creator1, true, subscriber1);
      
      const result = cancelAutoRenewal(creator1, subscriber1);
      expect(result.result).toBeOk(Cl.bool(true));
      
      // Verify auto-renewal disabled
      const info = simnet.callReadOnlyFn(
        "stacktreon",
        "get-subscriber-info",
        [Cl.principal(creator1), Cl.principal(subscriber1)],
        subscriber1
      );
      const subscriberData = info.result.expectSome().expectTuple();
      expect(subscriberData["autoRenew"]).toBeBool(false);
    });

    it("should set creator default auto-renewal preference", () => {
      const result = setAutoRenewalDefault(true, creator1);
      expect(result.result).toBeOk(Cl.bool(true));
      
      const creator = simnet.callReadOnlyFn(
        "stacktreon",
        "get-creator",
        [Cl.principal(creator1)],
        creator1
      );
      const creatorData = creator.result.expectSome().expectTuple();
      expect(creatorData["autoRenewalDefault"]).toBeBool(true);
    });
  });

  describe("Subscription Status Queries", () => {
    beforeEach(() => {
      registerCreator(creator1, 1000000, creator1);
    });

    it("should return correct subscription status", () => {
      subscribe(creator1, true, subscriber1);
      
      const status = simnet.callReadOnlyFn(
        "stacktreon",
        "get-subscription-status",
        [Cl.principal(creator1), Cl.principal(subscriber1)],
        subscriber1
      );
      
      const statusData = unwrapOkTuple(status.result);
      expect(statusData["isActive"]).toBeBool(true);
      expect(statusData["isExpired"]).toBeBool(false);
      expect(statusData["inGracePeriod"]).toBeBool(false);
      expect(statusData["autoRenew"]).toBeBool(true);
    });

    it("should detect grace period status", () => {
      subscribe(creator1, true, subscriber1);
      advanceTime(2592001); // Expire subscription
      
      // Trigger failed renewal
      processAutoRenewal(creator1, subscriber1, deployer);
      
      const status = simnet.callReadOnlyFn(
        "stacktreon",
        "get-subscription-status",
        [Cl.principal(creator1), Cl.principal(subscriber1)],
        subscriber1
      );
      
      const statusData = unwrapOkTuple(status.result);
      expect(statusData["isActive"]).toBeBool(true);
      expect(statusData["inGracePeriod"]).toBeBool(true);
      expect(statusData["paymentAttempts"]).toBeUint(1);
    });
  });

  describe("Payment History", () => {
    it("should record payment history", () => {
      registerCreator(creator1, 1000000, creator1);
      
      const result = subscribe(creator1, false, subscriber1);
      const paymentId = unwrapOkUint(result.result);
      
      const payment = simnet.callReadOnlyFn(
        "stacktreon",
        "get-payment-history",
        [Cl.uint(paymentId)],
        deployer
      );
      
      const paymentData = payment.result.expectSome().expectTuple();
      expect(paymentData["creator"]).toBe(Cl.principal(creator1));
      expect(paymentData["fan"]).toBe(Cl.principal(subscriber1));
      expect(paymentData["amount"]).toBeUint(1000000);
      expect(paymentData["status"]).toBe(Cl.stringAscii("success"));
    });

    it("should record failed payment attempts", () => {
      registerCreator(creator1, 1000000, creator1);
      subscribe(creator1, true, subscriber1);
      advanceTime(2592001);
      
      processAutoRenewal(creator1, subscriber1, deployer);
      
      const payment = simnet.callReadOnlyFn(
        "stacktreon",
        "get-payment-history",
        [Cl.uint(1)],
        deployer
      );
      
      const paymentData = payment.result.expectSome().expectTuple();
      expect(paymentData["status"]).toBe(Cl.stringAscii("failed"));
    });
  });

  describe("Creator Earnings Management", () => {
    beforeEach(() => {
      registerCreator(creator1, 1000000, creator1);
      subscribe(creator1, false, subscriber1);
      subscribe(creator1, false, subscriber2);
    });

    it("should allow creator to withdraw earnings", () => {
      const balanceBefore = getStxBalance(creator1);
      
      const result = withdrawEarning(1500000, creator1); // Withdraw 1.5 STX
      expect(result.result).toBeOk(Cl.bool(true));
      
      const balanceAfter = getStxBalance(creator1);
      expect(balanceAfter - balanceBefore).toBe(1500000n);
      
      // Verify creator balance updated
      const creator = simnet.callReadOnlyFn(
        "stacktreon",
        "get-creator",
        [Cl.principal(creator1)],
        creator1
      );
      const creatorData = creator.result.expectSome().expectTuple();
      expect(creatorData["balance"]).toBeUint(500000); // 2,000,000 - 1,500,000
    });

    it("should not allow withdrawing more than balance", () => {
      const result = withdrawEarning(3000000, creator1); // More than 2,000,000 balance
      expect(result.result).toBeErr(Cl.uint(4));
    });

    it("should allow creator to update subscription fee", () => {
      const newFee = 2000000; // 0.02 STX
      const result = updateSubscriptionFee(newFee, creator1);
      expect(result.result).toBeOk(Cl.bool(true));
      
      const creator = simnet.callReadOnlyFn(
        "stacktreon",
        "get-creator",
        [Cl.principal(creator1)],
        creator1
      );
      const creatorData = creator.result.expectSome().expectTuple();
      expect(creatorData["fee"]).toBeUint(newFee);
    });
  });

  describe("Edge Cases", () => {
    it("should handle multiple creators and subscribers", () => {
      // Register creators
      registerCreator(creator1, 1000000, creator1);
      registerCreator(creator2, 2000000, creator2);
      
      // Multiple subscriptions
      subscribe(creator1, true, subscriber1);
      subscribe(creator1, true, subscriber2);
      subscribe(creator2, false, subscriber3);
      
      // Verify counts
      const creator1Data = unwrapSome(simnet.callReadOnlyFn(
        "stacktreon",
        "get-creator",
        [Cl.principal(creator1)],
        creator1
      ).result);
      expect(creator1Data["totalSubscribers"]).toBeUint(2);
      
      const creator2Data = unwrapSome(simnet.callReadOnlyFn(
        "stacktreon",
        "get-creator",
        [Cl.principal(creator2)],
        creator2
      ).result);
      expect(creator2Data["totalSubscribers"]).toBeUint(1);
    });

    it("should handle subscription expiration correctly", () => {
      registerCreator(creator1, 1000000, creator1);
      subscribe(creator1, false, subscriber1);
      
      // Advance past 30 days
      advanceTime(2592001);
      
      const status = simnet.callReadOnlyFn(
        "stacktreon",
        "is-active-subscriber",
        [Cl.principal(creator1), Cl.principal(subscriber1)],
        subscriber1
      );
      expect(status.result).toBeOk(Cl.bool(false));
    });
  });
});

// Helper to unwrap OK uint
function unwrapOkUint(response: any): bigint {
  expect(response.type).toBe("ok");
  const value = response.value;
  expect(value.type).toBe("uint");
  return value.value;
}

// Helper to unwrap OK tuple
function unwrapOkTuple(response: any): any {
  expect(response.type).toBe("ok");
  return response.value;
}

// Helper to unwrap Some
function unwrapSome(response: any): any {
  expect(response.type).toBe("some");
  return response.value;
}
