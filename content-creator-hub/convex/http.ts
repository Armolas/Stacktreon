import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

const ALLOWED_ORIGINS = [
  "https://stacktreon.vercel.app",
  "http://localhost:5173",
  "http://localhost:8080",
  "http://localhost:4173",
];

// CAIP-2 network identifiers used by the x402 v2 protocol
const CAIP2 = { mainnet: "stacks:1", testnet: "stacks:2147483648" } as const;

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, payment-signature",
    "Access-Control-Expose-Headers": "payment-required, payment-response",
    Vary: "Origin",
  };
}

function json(
  request: Request,
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(request),
      ...extraHeaders,
    },
  });
}

/**
 * Pay-per-view route implementing the x402 v2 protocol, wire-compatible with
 * the x402-stacks Express middleware this replaces: same 402 body shape, same
 * payment-signature request header, same facilitator /settle contract, same
 * payment-required / payment-response base64 headers.
 */
http.route({
  pathPrefix: "/content/x402/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const id = url.pathname.slice("/content/x402/".length);

    const result = await ctx.runQuery(internal.content.getForX402, { id });
    if (!result) {
      return json(request, 404, { error: "Content not found" });
    }

    // Free content needs no payment
    if (result.price === 0) {
      return json(request, 200, { data: result.data, message: "success" });
    }

    const network = process.env.NETWORK === "mainnet" ? "mainnet" : "testnet";
    const facilitatorUrl = process.env.FACILITATOR_URL ?? "https://facilitator.stacksx402.com";
    const paymentRequirements = {
      scheme: "exact",
      network: CAIP2[network],
      amount: String(Math.round(result.price * 1_000_000)), // microSTX as string
      asset: "STX",
      payTo: result.payTo,
      maxTimeoutSeconds: 300,
    };
    const paymentRequiredBody = {
      x402Version: 2,
      resource: { url: request.url },
      accepts: [paymentRequirements],
    };
    const paymentRequiredHeader = {
      "payment-required": btoa(JSON.stringify(paymentRequiredBody)),
    };

    const signatureHeader = request.headers.get("payment-signature");
    if (!signatureHeader) {
      return json(request, 402, paymentRequiredBody, paymentRequiredHeader);
    }

    let paymentPayload: { x402Version?: number };
    try {
      paymentPayload = JSON.parse(atob(signatureHeader));
    } catch {
      return json(request, 400, {
        error: "invalid_payload",
        message: "Could not decode the payment-signature header",
      });
    }
    if (paymentPayload?.x402Version !== 2) {
      return json(request, 400, {
        error: "invalid_x402_version",
        message: "Expected x402Version 2",
      });
    }

    let settlement: {
      success?: boolean;
      errorReason?: string;
      payer?: string;
      transaction?: string;
      network?: string;
    };
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30_000);
      const res = await fetch(`${facilitatorUrl}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x402Version: 2, paymentPayload, paymentRequirements }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      settlement = await res.json();
    } catch {
      return json(request, 502, {
        error: "facilitator_unreachable",
        message: "The payment verification service is unavailable. Please try again.",
      });
    }

    if (!settlement?.success) {
      return json(
        request,
        402,
        {
          error: settlement?.errorReason ?? "settlement_failed",
          payer: settlement?.payer,
          transaction: settlement?.transaction,
        },
        paymentRequiredHeader,
      );
    }

    if (settlement.payer && settlement.transaction) {
      await ctx.runMutation(internal.transactions.recordPaidView, {
        contentId: result.contentId,
        payerWallet: settlement.payer,
        txHash: settlement.transaction,
      });
    }

    const paymentResponse = {
      success: true,
      payer: settlement.payer,
      transaction: settlement.transaction,
      network: settlement.network,
    };
    return json(
      request,
      200,
      {
        data: result.data,
        payment: {
          transaction: settlement.transaction,
          payer: settlement.payer,
          network: settlement.network,
        },
        message: "success",
      },
      { "payment-response": btoa(JSON.stringify(paymentResponse)) },
    );
  }),
});

http.route({
  pathPrefix: "/content/x402/",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }),
});

export default http;
