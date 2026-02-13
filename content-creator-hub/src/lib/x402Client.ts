import { openSTXTransfer } from '@stacks/connect';
import {
  AnchorMode,
  PostConditionMode,
} from '@stacks/transactions';
import { decodePaymentResponse } from 'x402-stacks';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const NETWORK = (import.meta.env.VITE_NETWORK as 'mainnet' | 'testnet') || 'testnet';

interface PaymentRequirement {
  amount: number; // in microSTX
  recipient: string;
  facilitator?: string;
}

export interface X402Response {
  paymentRequired: boolean;
  paymentDetails?: PaymentRequirement;
  data?: any;
}

/**
 * Make a request to an x402-protected endpoint
 * If 402 is returned, extract payment requirements
 */
export async function fetchWithX402(
  endpoint: string,
  paymentProof?: string
): Promise<X402Response> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (paymentProof) {
      headers['payment-signature'] = paymentProof;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      headers,
    });

    if (response.ok) {
      const data = await response.json();
      return {
        paymentRequired: false,
        data,
      };
    }

    if (response.status === 402) {
      const body = await response.text();
      let paymentDetails;

      try {
        const json = JSON.parse(body);

        // Handle x402 v2 format
        if (json.x402Version === 2 && json.accepts && json.accepts.length > 0) {
          const acceptOption = json.accepts[0]; // Use first payment option
          paymentDetails = {
            amount: parseInt(acceptOption.amount), // Convert string to number
            recipient: acceptOption.payTo,
            facilitator: json.facilitator,
          };
        } else {
          // Handle x402 v1 format or other formats
          paymentDetails = {
            amount: json.microSTX || json.amount,
            recipient: json.payTo || json.recipient,
            facilitator: json.facilitatorUrl || json.facilitator,
          };
        }
      } catch (e) {
        console.log('Failed to parse JSON, checking headers');
        // Check response headers for payment details
        const wwwAuth = response.headers.get('www-authenticate');
        if (wwwAuth) {
          console.log('WWW-Authenticate header:', wwwAuth);
          // Parse WWW-Authenticate header for payment details
          const amountMatch = wwwAuth.match(/amount=(\d+)/);
          const recipientMatch = wwwAuth.match(/recipient=([^\s,]+)/);

          paymentDetails = {
            amount: amountMatch ? parseInt(amountMatch[1]) : 0,
            recipient: recipientMatch ? recipientMatch[1] : '',
          };
        }
      }

      console.log('Final payment details:', paymentDetails);

      return {
        paymentRequired: true,
        paymentDetails,
      };
    }

    // Other errors
    const errorText = await response.text();

    try {
      const errorJson = JSON.parse(errorText);
      throw new Error(`Payment error: ${errorJson.error || errorJson.message || errorText}`);
    } catch (e) {
      throw new Error(`Request failed: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Create a transaction and get it signed by the wallet via Stacks Connect
 * The wallet will sign and broadcast the transaction automatically
 */
export async function createSignedTransaction(
  paymentDetails: PaymentRequirement,
  userAddress: string
): Promise<{ txHex: string; txId: string }> {
  if (!paymentDetails.amount || typeof paymentDetails.amount !== 'number') {
    throw new Error(`Invalid payment amount: ${JSON.stringify(paymentDetails.amount)}`);
  }

  if (!paymentDetails.recipient) {
    throw new Error('Payment recipient address is missing');
  }

  return new Promise((resolve, reject) => {
    try {
      openSTXTransfer({
        network: NETWORK,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
        recipient: paymentDetails.recipient,
        amount: paymentDetails.amount.toString(),
        memo: 'x402 payment',
        onFinish: (data) => {
          resolve({
            txId: data.txId,
            txHex: '',
          });
        },
        onCancel: () => {
          reject(new Error('Payment cancelled by user'));
        },
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Fetch transaction hex from Stacks API with retries
 * Waits for transaction to be confirmed since pending transactions don't have raw_tx
 */
async function fetchTransactionHex(txId: string, network: string, maxRetries = 20): Promise<string | null> {
  const apiUrl = network === 'mainnet'
    ? 'https://api.mainnet.hiro.so'
    : 'https://api.testnet.hiro.so';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${apiUrl}/extended/v1/tx/${txId}`);

      if (response.status === 404) {
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
        return null;
      }

      if (!response.ok) {
        return null;
      }

      const txData = await response.json();

      // Check if transaction is still pending
      if (txData.tx_status === 'pending') {
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
        return null;
      }

      // Check if transaction failed
      if (txData.tx_status === 'abort_by_response' || txData.tx_status === 'abort_by_post_condition') {
        return null;
      }

      // The raw_tx field contains the signed transaction hex
      if (txData.raw_tx) {
        return txData.raw_tx;
      }

      // If no raw_tx in main response, try the dedicated /raw endpoint
      if (txData.tx_status === 'success') {
        const rawResponse = await fetch(`${apiUrl}/extended/v1/tx/${txId}/raw`);

        if (rawResponse.ok) {
          const rawData = await rawResponse.json();
          if (rawData.raw_tx) {
            return rawData.raw_tx;
          }
        }
      }

      // If confirmed but no raw_tx, wait a bit and retry
      if (txData.tx_status === 'success' && attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }

      return null;
    } catch (error) {
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  return null;
}

/**
 * Create x402 v2 payment signature payload for browser clients
 * This matches the PaymentPayloadV2 interface from x402-stacks
 */
async function createPaymentSignature(
  txId: string,
  payerAddress: string,
  acceptOption: any,
  network: string
): Promise<string> {
  const transactionHex = await fetchTransactionHex(txId, network);

  if (!transactionHex) {
    throw new Error('Transaction confirmation timed out. Please check your wallet and refresh the page in a minute.');
  }

  const payload = {
    x402Version: 2,
    accepted: acceptOption,
    payload: {
      transaction: transactionHex,
    },
  };

  if (!payload.payload.transaction || payload.payload.transaction.length < 100) {
    throw new Error('Invalid transaction hex - too short or missing');
  }

  return btoa(JSON.stringify(payload));
}

/**
 * Complete payment flow: fetch content, handle 402, make payment, retry
 */
export async function fetchPaidContent(
  contentId: string,
  userAddress: string,
  onPaymentStarting?: (amount: number) => void,
  onPaymentSubmitted?: (txId: string) => void
): Promise<any> {
  const response = await fetchWithX402(`/content/x402/${contentId}`);

  if (!response.paymentRequired) {
    return response.data;
  }

  if (!response.paymentDetails) {
    throw new Error('Payment details missing from server');
  }

  if (onPaymentStarting) {
    const amountSTX = response.paymentDetails.amount / 1_000_000;
    onPaymentStarting(amountSTX);
  }

  const response402 = await fetch(`${API_URL}/content/x402/${contentId}`);
  const body402 = await response402.json();
  const acceptOption = body402.accepts[0];

  const { txId } = await createSignedTransaction(response.paymentDetails, userAddress);

  if (onPaymentSubmitted) {
    onPaymentSubmitted(txId);
  }

  const paymentSignature = await createPaymentSignature(txId, userAddress, acceptOption, NETWORK);

  const retryResponse = await fetchWithX402(`/content/x402/${contentId}`, paymentSignature);

  if (retryResponse.paymentRequired) {
    throw new Error('Payment verification pending. The transaction may still be processing. Please wait a few moments and refresh the page.');
  }
  return retryResponse.data;
}
