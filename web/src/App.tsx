import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { ClientView } from './components/ClientView';
import { FreelancerView } from './components/FreelancerView';
import { ArbiterView } from './components/ArbiterView';
import { WalletModal } from './components/WalletModal';
import { CreateVaultModal } from './components/CreateVaultModal';
import { DeliverableModal } from './components/DeliverableModal';
import { OffRampModal } from './components/OffRampModal';
import {
  fetchBalances,
  fetchClientVaults,
  fetchFreelancerVaults,
  fetchVaultById,
  CONFIG,
} from './services/stellar';
import type { UserRole, WalletState, Vault } from './types';
import { ShieldCheck, ExternalLink, Sparkles } from 'lucide-react';

export function App() {
  const [currentRole, setCurrentRole] = useState<UserRole>('client');
  const [wallet, setWallet] = useState<WalletState | null>(() => {
    const saved = localStorage.getItem('settlework_active_wallet');
    return saved ? JSON.parse(saved) : null;
  });
  const [balances, setBalances] = useState<{ xlm: string; usdc: string }>({ xlm: '0.00', usdc: '0.00' });
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [loadingVaults, setLoadingVaults] = useState(false);

  // Modals state
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isCreateVaultModalOpen, setIsCreateVaultModalOpen] = useState(false);
  const [isOffRampModalOpen, setIsOffRampModalOpen] = useState(false);
  const [deliverableModal, setDeliverableModal] = useState<{
    isOpen: boolean;
    vaultId: bigint;
    milestoneId: number;
    milestoneTitle: string;
  }>({
    isOpen: false,
    vaultId: BigInt(0),
    milestoneId: 0,
    milestoneTitle: '',
  });

  // Track known vault IDs across roles
  const recordKnownVaultId = (id: bigint) => {
    const existing: string[] = JSON.parse(localStorage.getItem('settlework_known_vault_ids') || '[]');
    const idStr = id.toString();
    if (!existing.includes(idStr)) {
      existing.push(idStr);
      localStorage.setItem('settlework_known_vault_ids', JSON.stringify(existing));
    }
  };

  const getKnownVaultIds = (): bigint[] => {
    const existing: string[] = JSON.parse(localStorage.getItem('settlework_known_vault_ids') || '[]');
    return existing.map((id) => BigInt(id));
  };

  // Balance refresh
  const refreshBalances = useCallback(async () => {
    if (!wallet) {
      setBalances({ xlm: '0.00', usdc: '0.00' });
      return;
    }
    const b = await fetchBalances(wallet.address);
    setBalances(b);
  }, [wallet]);

  // Load vaults based on role and active wallet
  const loadVaults = useCallback(async () => {
    if (!wallet) {
      setVaults([]);
      return;
    }

    setLoadingVaults(true);
    try {
      if (currentRole === 'client') {
        const list = await fetchClientVaults(wallet.address);
        list.forEach((v) => recordKnownVaultId(v.id));
        setVaults(list);
      } else if (currentRole === 'freelancer') {
        const list = await fetchFreelancerVaults(wallet.address);
        list.forEach((v) => recordKnownVaultId(v.id));
        setVaults(list);
      } else {
        // Arbiter view: check all known vaults created in this session or test suite
        const knownIds = getKnownVaultIds();
        const loaded: Vault[] = [];
        for (const id of knownIds) {
          const v = await fetchVaultById(id);
          if (v) loaded.push(v);
        }
        setVaults(loaded);
      }
    } catch (err) {
      console.error('Failed to load vaults for role:', currentRole, err);
    } finally {
      setLoadingVaults(false);
    }
  }, [wallet, currentRole]);

  // Effects
  useEffect(() => {
    if (wallet) {
      localStorage.setItem('settlework_active_wallet', JSON.stringify(wallet));
      refreshBalances();
    } else {
      localStorage.removeItem('settlework_active_wallet');
      setBalances({ xlm: '0.00', usdc: '0.00' });
    }
  }, [wallet, refreshBalances]);

  useEffect(() => {
    loadVaults();
  }, [loadVaults]);

  // Handlers
  const handleConnectWallet = (newWallet: WalletState) => {
    setWallet(newWallet);
  };

  const handleDisconnect = () => {
    setWallet(null);
  };

  const handleOpenDeliverable = (vaultId: bigint, milestoneId: number, milestoneTitle: string) => {
    setDeliverableModal({
      isOpen: true,
      vaultId,
      milestoneId,
      milestoneTitle,
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Top Navigation */}
      <Header
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        wallet={wallet}
        onOpenWalletModal={() => setIsWalletModalOpen(true)}
        onDisconnect={handleDisconnect}
        balances={balances}
        onRefreshBalances={refreshBalances}
      />

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentRole === 'client' && (
          <ClientView
            vaults={vaults}
            wallet={wallet}
            loading={loadingVaults}
            onRefresh={() => {
              loadVaults();
              refreshBalances();
            }}
            onOpenCreateVault={() => setIsCreateVaultModalOpen(true)}
            onOpenWalletModal={() => setIsWalletModalOpen(true)}
          />
        )}

        {currentRole === 'freelancer' && (
          <FreelancerView
            vaults={vaults}
            wallet={wallet}
            loading={loadingVaults}
            onRefresh={() => {
              loadVaults();
              refreshBalances();
            }}
            onOpenDeliverableModal={handleOpenDeliverable}
            onOpenOffRampModal={() => setIsOffRampModalOpen(true)}
            onOpenWalletModal={() => setIsWalletModalOpen(true)}
            usdcBalance={balances.usdc}
          />
        )}

        {currentRole === 'arbiter' && (
          <ArbiterView
            vaults={vaults}
            wallet={wallet}
            loading={loadingVaults}
            onRefresh={() => {
              loadVaults();
              refreshBalances();
            }}
            onOpenWalletModal={() => setIsWalletModalOpen(true)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-8 px-4 sm:px-6 lg:px-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-slate-300">SettleWork</span>
            <span>— Trustless Milestone Escrow & Local Currency Off-Ramp</span>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Stellar Testnet
            </span>
            <a
              href={`${CONFIG.stellarExpertBase}/contract/${CONFIG.escrowContractId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-indigo-400 flex items-center gap-1 transition"
            >
              Contract Explorer <ExternalLink className="w-3 h-3" />
            </a>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" /> SEP-24 / SEP-38 Ready
            </span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        onConnected={handleConnectWallet}
      />

      <CreateVaultModal
        isOpen={isCreateVaultModalOpen}
        onClose={() => setIsCreateVaultModalOpen(false)}
        wallet={wallet}
        onVaultCreated={() => {
          loadVaults();
          refreshBalances();
        }}
      />

      <DeliverableModal
        isOpen={deliverableModal.isOpen}
        onClose={() => setDeliverableModal((prev) => ({ ...prev, isOpen: false }))}
        vaultId={deliverableModal.vaultId}
        milestoneId={deliverableModal.milestoneId}
        milestoneTitle={deliverableModal.milestoneTitle}
        wallet={wallet}
        onSubmitted={() => {
          loadVaults();
          refreshBalances();
        }}
      />

      <OffRampModal
        isOpen={isOffRampModalOpen}
        onClose={() => setIsOffRampModalOpen(false)}
        availableUsdc={parseFloat(balances.usdc) || 0.0}
        wallet={wallet}
      />
    </div>
  );
}

export default App;
