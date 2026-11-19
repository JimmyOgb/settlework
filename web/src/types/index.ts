import type { Vault, Milestone } from '../contracts/escrow/src/types';
import { MilestoneStatus } from '../contracts/escrow/src/types';

export type UserRole = 'client' | 'freelancer' | 'arbiter';

export type WalletType = 'freighter' | 'keypair';

export interface WalletState {
  type: WalletType;
  address: string;
  name?: string;
  secretKey?: string; // used for direct Testnet keypair signing
}

export interface OffRampQuote {
  fiatCurrency: 'NGN' | 'GHS';
  cryptoAsset: 'USDC' | 'XLM';
  cryptoAmount: number;
  exchangeRate: number;
  fiatAmount: number;
  networkFeeUsd: number;
  anchorFeeUsd: number;
  traditionalWireFeeUsd: number;
  estimatedDeliveryTime: string;
}

export interface BankRecipient {
  country: 'NG' | 'GH';
  bankOrProvider: string;
  accountNumber: string;
  accountName: string;
}

export { MilestoneStatus };
export type { Vault, Milestone };
