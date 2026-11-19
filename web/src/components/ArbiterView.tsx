import React, { useState } from 'react';
import {
  Scale,
  CheckCircle,
  RotateCcw,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  FileText,
  UserCheck,
  Shield,
  Loader2,
  ArrowUpRight,
} from 'lucide-react';
import type { Vault, Milestone } from '../types';
import { MilestoneStatus } from '../types';
import type { WalletState } from '../types';
import { resolveDispute, CONFIG } from '../services/stellar';

interface ArbiterViewProps {
  vaults: Vault[];
  wallet: WalletState | null;
  loading: boolean;
  onRefresh: () => void;
  onOpenWalletModal: () => void;
}

interface DisputedItem {
  vault: Vault;
  milestone: Milestone;
}

export const ArbiterView: React.FC<ArbiterViewProps> = ({
  vaults,
  wallet,
  loading,
  onRefresh,
  onOpenWalletModal,
}) => {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string; hash?: string } | null>(null);

  const formatAmount = (stroops: bigint) => {
    const num = Number(stroops) / 10_000_000;
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const truncate = (addr: string) => `${addr.slice(0, 5)}...${addr.slice(-4)}`;

  const isTokenUsdc = (tokenAddr: string) => tokenAddr === CONFIG.usdcSacId;

  // Filter for disputed milestones across all loaded vaults
  const disputedItems: DisputedItem[] = [];
  for (const v of vaults) {
    for (const m of v.milestones) {
      if (m.status === MilestoneStatus.Disputed) {
        disputedItems.push({ vault: v, milestone: m });
      }
    }
  }

  const handleResolve = async (vaultId: bigint, milestoneId: number, releaseToFreelancer: boolean) => {
    if (!wallet) return;
    const actionKey = `resolve-${vaultId}-${milestoneId}-${releaseToFreelancer ? 'freelancer' : 'client'}`;
    setActionLoading(actionKey);
    setFeedback(null);

    const res = await resolveDispute(wallet, {
      vaultId,
      milestoneId,
      releaseToFreelancer,
    });

    if (res.success) {
      setFeedback({
        type: 'success',
        message: releaseToFreelancer
          ? `Dispute resolved! Funds released to Freelancer.`
          : `Dispute resolved! Funds refunded to Client.`,
        hash: res.hash,
      });
      onRefresh();
    } else {
      setFeedback({ type: 'error', message: res.error || 'Failed to resolve dispute' });
    }
    setActionLoading(null);
  };

  return (
    <div className="space-y-6">
      {/* Overview & Action Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Scale className="w-5 h-5 text-purple-400" />
            Arbiter Adjudication Console
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            As a designated neutral arbiter, evaluate contested milestone deliverables and authorize releases or refunds on-chain.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition border border-slate-700/60"
            title="Refresh Disputed Milestones"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Role explanation */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0 text-purple-400">
          <Shield className="w-5 h-5" />
        </div>
        <div className="space-y-1 text-sm">
          <h4 className="font-semibold text-white">How Soroban Escrow Arbitration Works</h4>
          <p className="text-slate-400 leading-relaxed text-xs">
            When either client or freelancer raises a dispute, the milestone amount remains locked in the Soroban contract. Only the authorized Arbiter's signature (<code className="text-purple-300">arbiter.require_auth()</code>) can invoke <code className="text-purple-300">resolve_dispute</code> to release funds to the freelancer or issue a refund back to the client.
          </p>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-400" />
            <span>{feedback.message}</span>
          </div>
          {feedback.hash && (
            <a
              href={`${CONFIG.stellarExpertBase}/tx/${feedback.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs flex items-center gap-1 underline hover:text-white"
            >
              Explorer <ArrowUpRight className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {/* Disputed Items List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <span>Pending Disputes Requiring Ruling</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
              {disputedItems.length} Active
            </span>
          </h3>
        </div>

        {!wallet ? (
          <div className="text-center py-14 bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
            <Scale className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h4 className="text-base font-medium text-white mb-1">Connect Arbiter Wallet</h4>
            <p className="text-sm text-slate-400 max-w-md mx-auto mb-5">
              Sign in with the Arbiter address designated during vault creation to review and sign dispute resolutions.
            </p>
            <button
              onClick={onOpenWalletModal}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-5 py-2.5 rounded-xl transition inline-flex items-center gap-2"
            >
              Connect Wallet
            </button>
          </div>
        ) : loading && disputedItems.length === 0 ? (
          <div className="text-center py-14 bg-slate-900/40 border border-slate-800 rounded-2xl">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-2" />
            <p className="text-sm text-slate-400">Scanning contracts for disputed milestones...</p>
          </div>
        ) : disputedItems.length === 0 ? (
          <div className="text-center py-14 bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
            <CheckCircle className="w-12 h-12 text-emerald-500/50 mx-auto mb-3" />
            <h4 className="text-base font-medium text-white mb-1">No Active Disputes</h4>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              All milestones are operating smoothly. When a client or freelancer raises a dispute on a contract naming this address as Arbiter, it will appear here immediately.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {disputedItems.map(({ vault, milestone }) => {
              const tokenLabel = isTokenUsdc(vault.token) ? 'USDC' : 'XLM';
              const isArbiter = wallet.address.toUpperCase() === vault.arbiter.toUpperCase();
              const isResolvingToFreelancer =
                actionLoading === `resolve-${vault.id}-${milestone.id}-freelancer`;
              const isResolvingToClient =
                actionLoading === `resolve-${vault.id}-${milestone.id}-client`;

              return (
                <div
                  key={`${vault.id}-${milestone.id}`}
                  className="bg-slate-900 border border-rose-500/30 rounded-2xl p-6 space-y-4 shadow-lg shadow-rose-950/20"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center font-bold text-sm">
                        !
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-white">Vault #{vault.id.toString()} — Milestone #{milestone.id}</h4>
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                            {milestone.title}
                          </span>
                        </div>
                        <span className="text-xs text-rose-400 font-medium mt-0.5 block">
                          Status: Disputed & Frozen
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-slate-400 block">Disputed Escrow Value</span>
                      <span className="text-lg font-bold text-white font-mono">
                        {formatAmount(milestone.amount)} {tokenLabel}
                      </span>
                    </div>
                  </div>

                  {/* Parties & Evidence */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl space-y-1">
                      <span className="text-slate-400 block font-medium">Client (Deposit Source)</span>
                      <a
                        href={`${CONFIG.stellarExpertBase}/account/${vault.client}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        {truncate(vault.client)} <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl space-y-1">
                      <span className="text-slate-400 block font-medium">Freelancer (Beneficiary)</span>
                      <a
                        href={`${CONFIG.stellarExpertBase}/account/${vault.freelancer}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        {truncate(vault.freelancer)} <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  {/* Deliverable Evidence */}
                  {milestone.deliverable ? (
                    <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl text-xs space-y-1">
                      <span className="text-slate-400 font-medium block flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" />
                        Submitted Deliverable Evidence:
                      </span>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-slate-200 truncate">{milestone.deliverable}</span>
                        {milestone.deliverable.startsWith('http') && (
                          <a
                            href={milestone.deliverable}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:underline inline-flex items-center gap-1 flex-shrink-0 font-medium"
                          >
                            Inspect Submission <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-amber-400/80 bg-amber-500/5 border border-amber-500/20 p-2.5 rounded-xl">
                      No deliverable URL was submitted by the freelancer before the dispute was initiated.
                    </div>
                  )}

                  {/* Warning if current wallet is not the authorized arbiter */}
                  {!isArbiter && (
                    <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>
                        Your connected wallet (<code className="font-mono">{truncate(wallet.address)}</code>) is not the designated arbiter for this vault (<code className="font-mono">{truncate(vault.arbiter)}</code>).
                      </span>
                    </div>
                  )}

                  {/* Arbiter Actions */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3">
                    <button
                      onClick={() => handleResolve(vault.id, milestone.id, false)}
                      disabled={actionLoading !== null}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 px-4 py-2.5 rounded-xl text-xs font-semibold transition disabled:opacity-50"
                      title="Issue full refund of this milestone back to the client"
                    >
                      {isResolvingToClient ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                      Refund to Client
                    </button>

                    <button
                      onClick={() => handleResolve(vault.id, milestone.id, true)}
                      disabled={actionLoading !== null}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-xs font-semibold transition disabled:opacity-50 shadow-md shadow-emerald-600/20"
                      title="Release milestone funds to the freelancer"
                    >
                      {isResolvingToFreelancer ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                      Release to Freelancer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
