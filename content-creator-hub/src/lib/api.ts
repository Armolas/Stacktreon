const API_URL = import.meta.env.VITE_API_URL || 'https://stacktreon.onrender.com';

export interface CreatorResponse {
  id: string;
  walletAddress: string;
  bns: string;
  displayName: string;
  username: string;
  bio: string;
  about: string;
  subscriptionFee: number | string;
  categories?: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentResponse {
  id: string;
  title: string;
  description: string;
  contentType: string;
  price: number;
  fileUrl: string | null;
  locked?: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  creator: CreatorResponse;
}

export interface TransactionResponse {
  id: string;
  payerWallet: string;
  creatorWallet: string;
  contentId?: string | null;
  type: 'subscription' | 'pay-per-view';
  amount: number;
  txHash?: string | null;
  status: 'pending' | 'confirmed' | 'failed';
  createdAt: string;
}

export interface SubscriptionStatusResponse {
  subscribed: boolean;
  expiresAt?: string;
}

export interface SubscriptionResponse {
  id: string;
  subscriberWallet: string;
  startedAt: string;
  expiresAt: string;
  status: string;
  creator: CreatorResponse;
  transaction?: TransactionResponse;
}

export const getAllCreators = async (): Promise<CreatorResponse[]> => {
  const response = await fetch(`${API_URL}/creators`);

  if (!response.ok) {
    let errorMessage = 'Failed to fetch creators';
    try {
      const error = await response.json();
      errorMessage = error.message || errorMessage;
    } catch (err) {
      // Swallow JSON parse errors and fall back to default error message
    }
    throw new Error(errorMessage);
  }

  return response.json();
};

export const getCreatorByWallet = async (walletAddress: string) => {
  const response = await fetch(`${API_URL}/creators/wallet/${walletAddress}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Creator not found. Please register as a creator first.');
    }
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch creator');
  }

  return response.json();
};

export const getCreatorByUsername = async (username: string): Promise<CreatorResponse> => {
  const response = await fetch(`${API_URL}/creators/username/${username}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch creator');
  }

  return response.json();
};

export const registerCreator = async (data: {
  username: string;
  displayName: string;
  walletAddress: string;
  bns: string;
  subscriptionFee: number;
  bio: string;
  about: string;
}) => {
  const response = await fetch(`${API_URL}/creators/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to register creator');
  }

  return response.json();
};

export const uploadContent = async (
  creatorId: string,
  file: File,
  title: string,
  description: string,
  price: number
) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', title);
  formData.append('description', description);
  formData.append('price', price.toString());

  const response = await fetch(`${API_URL}/content/${creatorId}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to upload content');
  }

  return response.json();
};

export const getContentById = async (contentId: string, userWallet?: string) => {
  const url = userWallet
    ? `${API_URL}/content/${contentId}?userWallet=${userWallet}`
    : `${API_URL}/content/${contentId}`;

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch content');
  }

  return response.json();
};

export const getContentByCreator = async (
  creatorId: string,
  userWallet?: string
): Promise<ContentResponse[]> => {
  const url = userWallet
    ? `${API_URL}/content/creator/${creatorId}?userWallet=${userWallet}`
    : `${API_URL}/content/creator/${creatorId}`;

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch creator content');
  }

  return response.json();
};

export const checkSubscriptionStatus = async (
  creatorId: string,
  userWallet: string
): Promise<SubscriptionStatusResponse> => {
  const response = await fetch(
    `${API_URL}/subscriptions/status?creatorId=${creatorId}&userWallet=${userWallet}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to check subscription');
  }

  return response.json();
};

type TransactionType = 'subscription' | 'pay-per-view';
type TransactionStatus = 'pending' | 'confirmed' | 'failed';

interface CreateTransactionPayload {
  payerWallet: string;
  creatorWallet: string;
  type: TransactionType;
  amountCents: number;
  contentId?: string;
  txHash?: string;
  status?: TransactionStatus;
}

export const createTransaction = async (
  payload: CreateTransactionPayload
): Promise<TransactionResponse> => {
  const response = await fetch(`${API_URL}/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...payload,
      status: payload.status ?? 'pending',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create transaction');
  }

  return response.json();
};

export const updateTransactionStatus = async (
  transactionId: string,
  status: TransactionStatus,
  txHash?: string
): Promise<TransactionResponse> => {
  const response = await fetch(`${API_URL}/transactions/${transactionId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status, txHash }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update transaction');
  }

  return response.json();
};

export const getCreatorSubscribers = async (
  creatorId: string
): Promise<SubscriptionResponse[]> => {
  const response = await fetch(`${API_URL}/subscriptions/creator/${creatorId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch subscribers');
  }

  return response.json();
};

export const getTransactionsByCreator = async (
  creatorWallet: string
): Promise<TransactionResponse[]> => {
  const response = await fetch(`${API_URL}/transactions/creator/${creatorWallet}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch transactions');
  }

  return response.json();
};

export const getUserSubscriptions = async (
  walletAddress: string
): Promise<SubscriptionResponse[]> => {
  const response = await fetch(`${API_URL}/subscriptions/user/${walletAddress}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch subscriptions');
  }

  return response.json();
};

export const getTransactionsByWallet = async (
  walletAddress: string
): Promise<TransactionResponse[]> => {
  const response = await fetch(`${API_URL}/transactions/wallet/${walletAddress}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch transactions');
  }

  return response.json();
};
