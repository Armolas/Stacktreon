import { useCallback } from 'react';
import { openContractCall } from '@stacks/connect';
import {
  fetchCallReadOnlyFunction,
  type ClarityValue,
  Cl,
  cvToValue,
  principalCV,
  uintCV,
} from '@stacks/transactions';
import { STACKS_TESTNET, STACKS_MAINNET } from '@stacks/network';

const NETWORK = (import.meta.env.VITE_NETWORK as 'mainnet' | 'testnet') || 'testnet';
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || 'ST1A514GGX294KQC7ZKD7Q886DDWVBA6GQ5MRB07E';
const CONTRACT_NAME = import.meta.env.VITE_CONTRACT_NAME || 'stacktreonv1';

const network = NETWORK === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET;

interface Creator {
  fee: number;
  totalEarning: number;
  balance: number;
}

interface Subscriber {
  subscribed: boolean;
  dateStarted: number;
  dateEnded: number;
}

interface ContractCallResponse {
  txId: string;
}

export function useSubscriptionContract() {
  /**
   * Generic contract call function
   */
  const callContract = useCallback(
    async (
      functionName: string,
      functionArgs: ClarityValue[],
      postConditions: any[] = []
    ): Promise<ContractCallResponse> => {
      return new Promise((resolve, reject) => {
        openContractCall({
          network: NETWORK,
          contractAddress: CONTRACT_ADDRESS,
          contractName: CONTRACT_NAME,
          functionName,
          functionArgs,
          postConditions,
          onFinish: (data) => {
            resolve({ txId: data.txId });
          },
          onCancel: () => {
            reject(new Error('Transaction cancelled by user'));
          },
        });
      });
    },
    []
  );

  /**
   * Generic read-only contract function
   */
  const readContract = useCallback(
    async (
      functionName: string,
      functionArgs: ClarityValue[] = [],
      senderAddress?: string
    ): Promise<any> => {
      try {
        const options = {
          contractAddress: CONTRACT_ADDRESS,
          contractName: CONTRACT_NAME,
          functionName,
          functionArgs,
          network,
          senderAddress: senderAddress || CONTRACT_ADDRESS,
        };

        const result = await fetchCallReadOnlyFunction(options);
        return result;
      } catch (error) {
        console.error('Contract read failed:', error);
        throw error;
      }
    },
    []
  );

  /**
   * Register as a creator with a subscription fee
   * @param creatorAddress - The principal address of the creator
   * @param subscriptionFee - Monthly subscription fee in microSTX (1 STX = 1,000,000 microSTX)
   */
  const registerCreator = useCallback(
    async (creatorAddress: string, subscriptionFee: number): Promise<ContractCallResponse> => {
      const feeInMicroStx = Math.floor(subscriptionFee * 1_000_000);
      return callContract('register-creator', [
        principalCV(creatorAddress),
        uintCV(feeInMicroStx),
      ]);
    },
    [callContract]
  );

  /**
   * Subscribe to a creator for 30 days
   * @param creatorAddress - The principal address of the creator to subscribe to
   */
  const subscribe = useCallback(
    async (creatorAddress: string): Promise<ContractCallResponse> => {
      return callContract('subscribe', [principalCV(creatorAddress)]);
    },
    [callContract]
  );

  /**
   * Withdraw creator earnings
   * @param amount - Amount to withdraw in microSTX
   */
  const withdrawCreatorEarning = useCallback(
    async (amount: number): Promise<ContractCallResponse> => {
      const amountInMicroStx = Math.floor(amount * 1_000_000);
      return callContract('withdraw-creator-earning', [uintCV(amountInMicroStx)]);
    },
    [callContract]
  );

  /**
   * Update subscription fee for creator
   * @param newFee - New monthly subscription fee in STX
   */
  const updateSubscriptionFee = useCallback(
    async (newFee: number): Promise<ContractCallResponse> => {
      const feeInMicroStx = Math.floor(newFee * 1_000_000);
      return callContract('update-subscription-fee', [uintCV(feeInMicroStx)]);
    },
    [callContract]
  );

  /**
   * Check if a fan is an active subscriber to a creator
   * @param creatorAddress - The principal address of the creator
   * @param fanAddress - The principal address of the fan/subscriber
   */
  const isActiveSubscriber = useCallback(
    async (creatorAddress: string, fanAddress: string): Promise<boolean> => {
      const result = await readContract(
        'is-active-subscriber',
        [principalCV(creatorAddress), principalCV(fanAddress)],
        fanAddress
      );

      // Result is wrapped in ok/err response
      if (result.type === 'ok') {
        return cvToValue(result.value) === true;
      }
      return false;
    },
    [readContract]
  );

  /**
   * Get creator information
   * @param creatorAddress - The principal address of the creator
   */
  const getCreator = useCallback(
    async (creatorAddress: string): Promise<Creator> => {
      const result = await readContract('get-creator', [principalCV(creatorAddress)]);

      // Parse the tuple response
      const creatorData = cvToValue(result);

      return {
        fee: Number(creatorData.fee) / 1_000_000, // Convert from microSTX to STX
        totalEarning: Number(creatorData.totalEarning) / 1_000_000,
        balance: Number(creatorData.balance) / 1_000_000,
      };
    },
    [readContract]
  );

  /**
   * Get subscriber information
   * @param creatorAddress - The principal address of the creator
   * @param fanAddress - The principal address of the fan/subscriber
   */
  const getSubscriber = useCallback(
    async (creatorAddress: string, fanAddress: string): Promise<Subscriber | null> => {
      try {
        const result = await readContract(
          'get-subscriber',
          [principalCV(creatorAddress), principalCV(fanAddress)],
          fanAddress
        );

        const subscriberData = cvToValue(result);

        return {
          subscribed: subscriberData.subscribed,
          dateStarted: Number(subscriberData.dateStarted),
          dateEnded: Number(subscriberData.dateEnded),
        };
      } catch (error) {
        // Subscriber doesn't exist
        return null;
      }
    },
    [readContract]
  );

  /**
   * Helper: Convert STX to microSTX
   */
  const stxToMicroStx = (stx: number): number => {
    return Math.floor(stx * 1_000_000);
  };

  /**
   * Helper: Convert microSTX to STX
   */
  const microStxToStx = (microStx: number): number => {
    return microStx / 1_000_000;
  };

  return {
    // Write functions
    registerCreator,
    subscribe,
    withdrawCreatorEarning,
    updateSubscriptionFee,

    // Read functions
    isActiveSubscriber,
    getCreator,
    getSubscriber,

    // Helpers
    stxToMicroStx,
    microStxToStx,
  };
}
