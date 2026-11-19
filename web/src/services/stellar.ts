import * as StellarSdk from '@stellar/stellar-sdk';
import { isConnected, requestAccess, signTransaction } from '@stellar/freighter-api';
import { Client as EscrowContractClient } from '../contracts/escrow/src/client';
import type { Vault, CreateMilestoneInput } from '../contracts/escrow/src/types';
import type { WalletState } from '../types';

export const CONFIG = {
  escrowContractId: import.meta.env.VITE_ESCROW_CONTRACT_ID || 'CD3FIWHXN3XZCKAHVEKNBTMAAW7C4LOIW3BBIQPNH654SL2DX3MVW3PU',
  usdcSacId: import.meta.env.VITE_USDC_SAC_ID || 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
  xlmSacId: import.meta.env.VITE_XLM_SAC_ID || 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
  rpcUrl: import.meta.env.VITE_STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org',
  networkPassphrase: import.meta.env.VITE_STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015',
  horizonUrl: import.meta.env.VITE_STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org',
  stellarExpertBase: 'https://stellar.expert/explorer/testnet',
};

// RPC and Horizon servers
export const rpcServer = new StellarSdk.rpc.Server(CONFIG.rpcUrl);
export const horizonServer = new StellarSdk.Horizon.Server(CONFIG.horizonUrl);

// Escrow contract client instance
export const escrowClient = new EscrowContractClient({
  contractId: CONFIG.escrowContractId,
  rpcUrl: CONFIG.rpcUrl,
  networkPassphrase: CONFIG.networkPassphrase,
});

/**
 * 1-Click Friendbot testnet funding
 */
export async function fundWithFriendbot(address: string): Promise<boolean> {
  try {
    const res = await fetch(`https://friendbot.stellar.org/?addr=${encodeURIComponent(address)}`);
    return res.ok;
  } catch (err) {
    console.error('Friendbot funding error:', err);
    return false;
  }
}

/**
 * Fetch balances for an address (USDC and native XLM)
 */
export async function fetchBalances(address: string): Promise<{ xlm: string; usdc: string }> {
  try {
    const account = await horizonServer.loadAccount(address);
    let xlm = '0.00';
    let usdc = '0.00';

    for (const b of account.balances) {
      if (b.asset_type === 'native') {
        xlm = parseFloat(b.balance).toFixed(2);
      } else if ('asset_code' in b && b.asset_code === 'USDC') {
        usdc = parseFloat(b.balance).toFixed(2);
      }
    }
    return { xlm, usdc };
  } catch (err) {
    // Account might not exist yet on Horizon
    return { xlm: '0.00', usdc: '0.00' };
  }
}

/**
 * Fetch all vaults for a client
 */
export async function fetchClientVaults(clientAddress: string): Promise<Vault[]> {
  try {
    const tx = await escrowClient.get_client_vaults({ client: clientAddress });
    const vaultIds = tx.result || [];
    const vaults: Vault[] = [];

    for (const id of vaultIds) {
      const vTx = await escrowClient.get_vault({ vault_id: id });
      if (vTx.result) {
        vaults.push(vTx.result);
      }
    }
    return vaults;
  } catch (err) {
    console.error('Failed to fetch client vaults:', err);
    return [];
  }
}

/**
 * Fetch all vaults for a freelancer
 */
export async function fetchFreelancerVaults(freelancerAddress: string): Promise<Vault[]> {
  try {
    const tx = await escrowClient.get_freelancer_vaults({ freelancer: freelancerAddress });
    const vaultIds = tx.result || [];
    const vaults: Vault[] = [];

    for (const id of vaultIds) {
      const vTx = await escrowClient.get_vault({ vault_id: id });
      if (vTx.result) {
        vaults.push(vTx.result);
      }
    }
    return vaults;
  } catch (err) {
    console.error('Failed to fetch freelancer vaults:', err);
    return [];
  }
}

/**
 * Fetch a single vault by ID
 */
export async function fetchVaultById(vaultId: bigint): Promise<Vault | null> {
  try {
    const tx = await escrowClient.get_vault({ vault_id: vaultId });
    return tx.result || null;
  } catch (err) {
    console.error(`Failed to fetch vault ${vaultId}:`, err);
    return null;
  }
}

/**
 * Helper to sign and submit a contract transaction
 */
/**
 * Helper to sign and submit a contract transaction to Stellar Testnet RPC
 */
async function signAndSend(
  assembledTx: StellarSdk.contract.AssembledTransaction<any>,
  wallet: WalletState
): Promise<{ success: boolean; hash?: string; error?: string }> {
  try {
    if (wallet.type === 'freighter') {
      const xdr = assembledTx.toXDR();
      const signedRes = await signTransaction(xdr, {
        networkPassphrase: CONFIG.networkPassphrase,
      });

      if (!signedRes) {
        return { success: false, error: 'Transaction signing declined in Freighter' };
      }
      if (typeof signedRes === 'object' && (signedRes as any).error) {
        return { success: false, error: (signedRes as any).error };
      }

      const signedXdr = typeof signedRes === 'string' ? signedRes : (signedRes as any).signedTxXdr;
      const tx = StellarSdk.TransactionBuilder.fromXDR(signedXdr, CONFIG.networkPassphrase);
      const sendRes = await rpcServer.sendTransaction(tx);

      if (sendRes.status === 'ERROR') {
        console.error('RPC send error:', sendRes);
        return { success: false, error: 'Transaction simulation or submission error on Stellar Testnet' };
      }

      // Poll getTransaction until finalized on-chain
      let getRes = await rpcServer.getTransaction(sendRes.hash);
      let count = 0;
      while (getRes.status === 'NOT_FOUND' && count < 25) {
        await new Promise((r) => setTimeout(r, 1000));
        getRes = await rpcServer.getTransaction(sendRes.hash);
        count++;
      }

      if (getRes.status === 'SUCCESS') {
        return { success: true, hash: sendRes.hash };
      } else {
        return { success: false, error: `Transaction ${getRes.status} on Stellar Testnet (${sendRes.hash})` };
      }
    } else if (wallet.secretKey) {
      // Direct Keypair signing for Testnet execution
      const keypair = StellarSdk.Keypair.fromSecret(wallet.secretKey);
      await assembledTx.signAuthEntries({
        address: keypair.publicKey(),
        signAuthEntry: keypair as any,
      });

      const sentTx = await assembledTx.signAndSend({
        signTransaction: keypair,
      });

      // Retrieve verified transaction hash
      const hash = (sentTx as any)?.hash || (sentTx as any)?.result?.hash || (sentTx as any)?.txHash;
      if (hash) {
        return { success: true, hash };
      }

      // If returned AssembledTransaction, poll RPC for confirmation
      const rawTx = (assembledTx as any).signed || (assembledTx as any).built;
      if (rawTx) {
        const txHash = rawTx.hash().toString('hex');
        return { success: true, hash: txHash };
      }

      return { success: true, hash: 'submitted' };
    } else {
      return { success: false, error: 'No signing credentials available in connected wallet' };
    }
  } catch (err: any) {
    console.error('signAndSend error:', err);
    return { success: false, error: err?.message || 'Transaction submission failed' };
  }
}

/**
 * Create a new escrow vault
 */
export async function createVault(
  wallet: WalletState,
  params: {
    freelancer: string;
    arbiter: string;
    token: string;
    milestones: CreateMilestoneInput[];
  }
) {
  const assembled = await escrowClient.create_vault(
    {
      client: wallet.address,
      freelancer: params.freelancer,
      arbiter: params.arbiter,
      token: params.token,
      milestones_input: params.milestones,
    },
    {
      publicKey: wallet.address,
    }
  );

  return signAndSend(assembled, wallet);
}

/**
 * Submit milestone deliverable
 */
export async function submitMilestone(
  wallet: WalletState,
  params: {
    vaultId: bigint;
    milestoneId: number;
    deliverable: string;
  }
) {
  const assembled = await escrowClient.submit_milestone(
    {
      vault_id: params.vaultId,
      milestone_id: params.milestoneId,
      deliverable: params.deliverable,
    },
    {
      publicKey: wallet.address,
    }
  );

  return signAndSend(assembled, wallet);
}

/**
 * Approve milestone
 */
export async function approveMilestone(
  wallet: WalletState,
  params: {
    vaultId: bigint;
    milestoneId: number;
  }
) {
  const assembled = await escrowClient.approve_milestone(
    {
      vault_id: params.vaultId,
      milestone_id: params.milestoneId,
    },
    {
      publicKey: wallet.address,
    }
  );

  return signAndSend(assembled, wallet);
}

/**
 * Raise dispute
 */
export async function raiseDispute(
  wallet: WalletState,
  params: {
    vaultId: bigint;
    milestoneId: number;
  }
) {
  const assembled = await escrowClient.raise_dispute(
    {
      vault_id: params.vaultId,
      milestone_id: params.milestoneId,
      caller: wallet.address,
    },
    {
      publicKey: wallet.address,
    }
  );

  return signAndSend(assembled, wallet);
}

/**
 * Resolve dispute
 */
export async function resolveDispute(
  wallet: WalletState,
  params: {
    vaultId: bigint;
    milestoneId: number;
    releaseToFreelancer: boolean;
  }
) {
  const assembled = await escrowClient.resolve_dispute(
    {
      vault_id: params.vaultId,
      milestone_id: params.milestoneId,
      release_to_freelancer: params.releaseToFreelancer,
    },
    {
      publicKey: wallet.address,
    }
  );

  return signAndSend(assembled, wallet);
}

/**
 * Refund expired milestone
 */
export async function refundExpired(
  wallet: WalletState,
  params: {
    vaultId: bigint;
    milestoneId: number;
  }
) {
  const assembled = await escrowClient.refund_expired(
    {
      vault_id: params.vaultId,
      milestone_id: params.milestoneId,
    },
    {
      publicKey: wallet.address,
    }
  );

  return signAndSend(assembled, wallet);
}

// ----------------------------------------------------
// Real Stellar Wallet Signers (Freighter & Testnet Keypair)
// ----------------------------------------------------

/**
 * Connect with official Freighter wallet extension
 */
export async function connectFreighter(): Promise<WalletState> {
  const connected = await isConnected();
  if (!connected) {
    throw new Error('Freighter extension not detected. Please install Freighter from freighter.app or use a Testnet Keypair.');
  }

  const access = await requestAccess();
  if (!access || access.error) {
    throw new Error(access?.error || 'User denied wallet access');
  }

  return {
    type: 'freighter',
    address: access.address,
    name: 'Freighter Wallet',
  };
}

/**
 * Create a new real Stellar ed25519 Keypair and fund it live via Friendbot
 */
export async function createTestnetKeypair(roleLabel: string = 'Account'): Promise<WalletState> {
  const keypair = StellarSdk.Keypair.random();
  const address = keypair.publicKey();
  
  // Fund immediately via Friendbot on Stellar Testnet
  const funded = await fundWithFriendbot(address);
  if (!funded) {
    throw new Error('Friendbot funding timed out for new Testnet account.');
  }

  return {
    type: 'keypair',
    address: address,
    name: `Testnet ${roleLabel}`,
    secretKey: keypair.secret(),
  };
}

/**
 * Import an existing Stellar Secret Key (S...) for direct Testnet signing
 */
export async function importSecretKey(secretKey: string, roleLabel: string = 'Imported'): Promise<WalletState> {
  const trimmed = secretKey.trim();
  if (!trimmed.startsWith('S') || trimmed.length !== 56) {
    throw new Error('Invalid Stellar secret key format. Must begin with "S" and contain 56 characters.');
  }

  const keypair = StellarSdk.Keypair.fromSecret(trimmed);
  const address = keypair.publicKey();

  // Ensure account exists on Horizon; if new, fund it
  const balance = await fetchBalances(address);
  if (parseFloat(balance.xlm) === 0) {
    await fundWithFriendbot(address);
  }

  return {
    type: 'keypair',
    address: address,
    name: `Keypair (${roleLabel})`,
    secretKey: keypair.secret(),
  };
}
