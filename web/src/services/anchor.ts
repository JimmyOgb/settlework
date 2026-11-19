import * as StellarSdk from '@stellar/stellar-sdk';
import { signTransaction as freighterSignTransaction } from '@stellar/freighter-api';
import type { WalletState } from '../types';

export const ANCHOR_CONFIG = {
  homeDomain: 'testanchor.stellar.org',
  tomlUrl: 'https://testanchor.stellar.org/.well-known/stellar.toml',
  authUrl: 'https://testanchor.stellar.org/auth',
  sep24Url: 'https://testanchor.stellar.org/sep24',
  sep38Url: 'https://testanchor.stellar.org/sep38',
  signingKey: 'GCHLHDBOKG2JWMJQBTLSL5XG6NO7ESXI2TAQKZXCXWXB5WI2X6W233PR',
  fxApiUrl: 'https://open.er-api.com/v6/latest/USD',
  networkPassphrase: 'Test SDF Network ; September 2015',
};

export interface LiveFxData {
  ngnRate: number;
  ghsRate: number;
  lastUpdated: string;
  provider: string;
}

export interface Sep24InteractiveResponse {
  type: string;
  url: string;
  id: string;
}

export interface Sep24TransactionStatus {
  id: string;
  kind: string;
  status: string;
  amount_in?: string;
  amount_out?: string;
  amount_fee?: string;
  started_at?: string;
  completed_at?: string;
  more_info_url?: string;
  withdraw_anchor_account?: string;
  withdraw_memo?: string;
  withdraw_memo_type?: string;
}

/**
 * 1. Live Exchange Rate Fetcher
 * Strictly fetches from live FX provider. Throws an error on failure (no fallback).
 */
export async function fetchLiveFxRates(): Promise<LiveFxData> {
  const res = await fetch(ANCHOR_CONFIG.fxApiUrl);
  if (!res.ok) {
    throw new Error(`Live FX API returned HTTP ${res.status}: ${res.statusText}`);
  }
  const data = await res.json();
  if (data.result !== 'success' || !data.rates?.NGN || !data.rates?.GHS) {
    throw new Error('Invalid rate payload received from live FX provider');
  }

  return {
    ngnRate: Number(data.rates.NGN),
    ghsRate: Number(data.rates.GHS),
    lastUpdated: data.time_last_update_utc || new Date().toUTCString(),
    provider: data.provider || 'open.er-api.com',
  };
}

/**
 * 2. Fetch Anchor Capabilities (/info)
 */
export async function fetchAnchorSep24Info() {
  const res = await fetch(`${ANCHOR_CONFIG.sep24Url}/info`);
  if (!res.ok) {
    throw new Error(`Failed to query anchor SEP-24 /info: HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * 3. SEP-10 Web Authentication Flow
 * Performs three-leg challenge authentication against testanchor.stellar.org:
 *  - Leg 1: GET challenge transaction
 *  - Leg 2: Wallet verifies and signs challenge (Freighter or Keypair)
 *  - Leg 3: POST signed challenge to get real Bearer JWT
 */
export async function runSep10Auth(wallet: WalletState): Promise<string> {
  const challengeUrl = `${ANCHOR_CONFIG.authUrl}?account=${encodeURIComponent(
    wallet.address
  )}&home_domain=${encodeURIComponent(ANCHOR_CONFIG.homeDomain)}`;

  const getRes = await fetch(challengeUrl);
  if (!getRes.ok) {
    const errText = await getRes.text();
    throw new Error(`SEP-10 challenge request failed (HTTP ${getRes.status}): ${errText}`);
  }

  const { transaction: challengeXdr, network_passphrase } = await getRes.json();
  if (!challengeXdr) {
    throw new Error('SEP-10 challenge transaction missing from anchor response');
  }

  const passphrase = network_passphrase || ANCHOR_CONFIG.networkPassphrase;
  let signedXdr: string;

  if (wallet.type === 'freighter') {
    const signedRes = await freighterSignTransaction(challengeXdr, {
      networkPassphrase: passphrase,
    });
    if (!signedRes) {
      throw new Error('User cancelled SEP-10 signing in Freighter');
    }
    if (typeof signedRes === 'object' && (signedRes as any).error) {
      throw new Error((signedRes as any).error);
    }
    signedXdr = typeof signedRes === 'string' ? signedRes : (signedRes as any).signedTxXdr;
  } else if (wallet.secretKey) {
    const keypair = StellarSdk.Keypair.fromSecret(wallet.secretKey);
    const tx = StellarSdk.TransactionBuilder.fromXDR(challengeXdr, passphrase);
    tx.sign(keypair);
    signedXdr = tx.toXDR();
  } else {
    throw new Error('Connected wallet cannot sign SEP-10 challenge');
  }

  // POST signed challenge back to anchor auth endpoint
  const postRes = await fetch(ANCHOR_CONFIG.authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction: signedXdr }),
  });

  if (!postRes.ok) {
    const errText = await postRes.text();
    throw new Error(`SEP-10 token exchange failed (HTTP ${postRes.status}): ${errText}`);
  }

  const authData = await postRes.json();
  if (!authData.token) {
    throw new Error('No JWT token returned from SEP-10 auth endpoint');
  }

  return authData.token;
}

/**
 * 4. SEP-24 Interactive Withdrawal Request
 * Initiates hosted withdrawal session with Bearer JWT
 */
export async function startSep24Withdrawal(
  jwt: string,
  walletAddress: string,
  amount: string
): Promise<Sep24InteractiveResponse> {
  const withdrawEndpoint = `${ANCHOR_CONFIG.sep24Url}/transactions/withdraw/interactive`;

  const res = await fetch(withdrawEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      asset_code: 'USDC',
      account: walletAddress,
      amount: amount,
    }),
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.error || `SEP-24 withdraw initiation failed (HTTP ${res.status})`);
  }

  const data = await res.json();
  if (!data.url || !data.id) {
    throw new Error('Invalid SEP-24 response: missing interactive URL or transaction id');
  }

  return {
    type: data.type || 'interactive_customer_info_needed',
    url: data.url,
    id: data.id,
  };
}

/**
 * 5. Poll SEP-24 Transaction Status
 */
export async function pollSep24Transaction(
  jwt: string,
  txId: string
): Promise<Sep24TransactionStatus | null> {
  const res = await fetch(`${ANCHOR_CONFIG.sep24Url}/transaction?id=${encodeURIComponent(txId)}`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.transaction || null;
}
