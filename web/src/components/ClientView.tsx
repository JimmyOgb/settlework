import React, { useState } from 'react';
import {
  Plus,
  Shield,
  Clock,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  RefreshCw,
  FileText,
  Lock,
  ArrowUpRight,
  Loader2,
} from 'lucide-react';
import type { Vault, Milestone } from '../types';
import { MilestoneStatus } from '../types';
import type { WalletState } from '../types';
import { approveMilestone, raiseDispute, refundExpired, CONFIG } from '../services/stellar';

interface ClientViewProps {
  vaults: Vault[];
  wallet: WalletState | null;
  loading: boolean;
  onRefresh: () => void;
  onOpenCreateVault: () => void;
  onOpenWalletModal: () => void;
}

export const ClientView: React.FC<ClientViewProps> = ({
  vaults,
  wallet,
  loading,
  onRefresh,
  onOpenCreateVault,
  onOpenWalletModal,
}) => {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string; hash?: string } | null>(null);

  const formatAmount = (stroops: bigint) => {
    // 7 decimals for Stellar USDC / XLM
    const num = Number(stroops) / 10_000_000;
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const truncate = (addr: string) => `${addr.slice(0, 5)}...${addr.slice(-4)}`;

  const isTokenUsdc = (tokenAddr: string) => tokenAddr === CONFIG.usdcSacId;

  const getStatusBadge = (status: MilestoneStatus) => {
    switch (status) {
      case MilestoneStatus.Pending:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            Pending Work
          </span>
        );
      case MilestoneStatus.Submitted:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <FileText className="w-3 h-3" />
            Ready for Review
          </span>
        );
      case MilestoneStatus.Approved:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="w-3 h-3" />
            Released
          </span>
        );
      case MilestoneStatus.Disputed:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3 h-3" />
            In Dispute
          </span>
        );
      case MilestoneStatus.Refunded:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <RotateCcw className="w-3 h-3" />
            Refunded
          </span>
        );
    }
  };

  const handleApprove = async (vaultId: bigint, milestoneId: number) => {
    if (!wallet) return;
    const actionKey = `approve-${vaultId}-${milestoneId}`;
    setActionLoading(actionKey);
    setFeedback(null);

    const res = await approveMilestone(wallet, { vaultId, milestoneId });
    if (res.success) {
      setFeedback({
        type: 'success',
        message: `Milestone #${milestoneId} approved! Funds released to freelancer.`,
        hash: res.hash,
      });
      onRefresh();
    } else {
      setFeedback({ type: 'error', message: res.error || 'Approval failed' });
    }
    setActionLoading(null);
  };

  const handleDispute = async (vaultId: bigint, milestoneId: number) => {
    if (!wallet) return;
    const actionKey = `dispute-${vaultId}-${milestoneId}`;
    setActionLoading(actionKey);
    setFeedback(null);

    const res = await raiseDispute(wallet, { vaultId, milestoneId });
    if (res.success) {
      setFeedback({
        type: 'success',
        message: `Dispute raised on Milestone #${milestoneId}. Sent to Arbiter for review.`,
        hash: res.hash,
      });
      onRefresh();
    } else {
      setFeedback({ type: 'error', message: res.error || 'Failed to raise dispute' });
    }
    setActionLoading(null);
  };

  const handleRefund = async (vaultId: bigint, milestoneId: number) => {
    if (!wallet) return;
    const actionKey = `refund-${vaultId}-${milestoneId}`;
    setActionLoading(actionKey);
    setFeedback(null);

    const res = await refundExpired(wallet, { vaultId, milestoneId });
    if (res.success) {
      setFeedback({
        type: 'success',
        message: `Milestone #${milestoneId} refunded to your account.`,
        hash: res.hash,
      });
      onRefresh();
    } else {
      setFeedback({ type: 'error', message: res.error || 'Refund expired failed' });
    }
    setActionLoading(null);
  };

  // Metrics
  const totalLocked = vaults.reduce((acc, v) => {
    const lockedInVault = v.milestones.reduce((mAcc, m) => {
      if (m.status === MilestoneStatus.Pending || m.status === MilestoneStatus.Submitted || m.status === MilestoneStatus.Disputed) {
        return mAcc + Number(m.amount) / 10_000_000;
      }
      return mAcc;
    }, 0);
    return acc + lockedInVault;
  }, 0);

  const pendingReviewCount = vaults.reduce((acc, v) => {
    return acc + v.milestones.filter((m) => m.status === MilestoneStatus.Submitted).length;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Overview & Action Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-indigo-400" />
            Client Escrow Dashboard
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Fund milestones securely into Soroban smart contracts. Funds are only released upon your deliverable approval.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition border border-slate-700/60"
            title="Refresh Vaults"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {wallet ? (
            <button
              onClick={onOpenCreateVault}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2.5 rounded-xl transition shadow-lg shadow-indigo-600/25"
            >
              <Plus className="w-4 h-4" />
              Create Escrow Vault
            </button>
          ) : (
            <button
              onClick={onOpenWalletModal}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2.5 rounded-xl transition shadow-lg shadow-indigo-600/25"
            >
              Connect to Create Vault
            </button>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Value Locked (TVL)</span>
          <div className="text-2xl font-bold text-white mt-1">
            ${totalLocked.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-slate-500 mt-1 block">In your created contracts</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Vaults</span>
          <div className="text-2xl font-bold text-indigo-400 mt-1">{vaults.length}</div>
          <span className="text-xs text-slate-500 mt-1 block">On-chain Soroban escrows</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Pending Review</span>
          <div className="text-2xl font-bold text-sky-400 mt-1">{pendingReviewCount}</div>
          <span className="text-xs text-slate-500 mt-1 block">Deliverables ready for sign-off</span>
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
            {feedback.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400" />
            )}
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

      {/* Vaults List */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-white flex items-center justify-between">
          <span>Active Escrow Agreements</span>
          <span className="text-xs text-slate-400 font-normal">
            Contract: <span className="font-mono">{truncate(CONFIG.escrowContractId)}</span>
          </span>
        </h3>

        {!wallet ? (
          <div className="text-center py-14 bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
            <Lock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h4 className="text-base font-medium text-white mb-1">Connect Wallet to View Vaults</h4>
            <p className="text-sm text-slate-400 max-asin mb-5">
              Sign in with your biometric Passkey or Freighter wallet to access your on-chain contracts.
            </p>
            <button
              onClick={onOpenWalletModal}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-5 py-2.5 rounded-xl transition inline-flex items-center gap-2"
            >
              Connect Wallet
            </button>
          </div>
        ) : loading && vaults.length === 0 ? (
          <div className="text-center py-14 bg-slate-900/40 border border-slate-800 rounded-2xl">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-2" />
            <p className="text-sm text-slate-400">Loading your Soroban escrow vaults from Stellar Testnet...</p>
          </div>
        ) : vaults.length === 0 ? (
          <div className="text-center py-14 bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
            <Shield className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h4 className="text-base font-medium text-white mb-1">No Escrow Vaults Yet</h4>
            <p className="text-sm text-slate-400 max-w-md mx-auto mb-5">
              Lock USDC or XLM into a trustless milestone contract for your freelancer. Release funds as deliverables are completed.
            </p>
            <button
              onClick={onOpenCreateVault}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-5 py-2.5 rounded-xl transition inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create First Vault
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {vaults.map((vault) => {
              const tokenLabel = isTokenUsdc(vault.token) ? 'USDC' : 'XLM';
              return (
                <div
                  key={vault.id.toString()}
                  className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition"
                >
                  {/* Vault Header */}
                  <div className="p-5 border-b border-slate-800 bg-slate-900/70 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-mono font-bold text-indigo-400">
                        #{vault.id.toString()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">Vault #{vault.id.toString()}</span>
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                            {tokenLabel}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                          <span>
                            Freelancer:{' '}
                            <a
                              href={`${CONFIG.stellarExpertBase}/account/${vault.freelancer}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-indigo-400 hover:underline"
                            >
                              {truncate(vault.freelancer)}
                            </a>
                          </span>
                          <span>•</span>
                          <span>
                            Arbiter:{' '}
                            <a
                              href={`${CONFIG.stellarExpertBase}/account/${vault.arbiter}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-slate-400 hover:underline"
                            >
                              {truncate(vault.arbiter)}
                            </a>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-slate-400 block">Total Escrow Value</span>
                      <span className="text-lg font-bold text-white">
                        {formatAmount(vault.total_amount)} {tokenLabel}
                      </span>
                    </div>
                  </div>

                  {/* Milestones Table */}
                  <div className="divide-y divide-slate-800/80">
                    {vault.milestones.map((m: Milestone) => {
                      const isExpired = Date.now() / 1000 > Number(m.deadline);
                      const isPending = m.status === MilestoneStatus.Pending;
                      const isSubmitted = m.status === MilestoneStatus.Submitted;
                      const isDisputed = m.status === MilestoneStatus.Disputed;
                      const isApproved = m.status === MilestoneStatus.Approved;

                      const isApproving = actionLoading === `approve-${vault.id}-${m.id}`;
                      const isDisputing = actionLoading === `dispute-${vault.id}-${m.id}`;
                      const isRefunding = actionLoading === `refund-${vault.id}-${m.id}`;

                      return (
                        <div
                          key={m.id}
                          className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/30 transition"
                        >
                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2.5">
                              <span className="text-xs font-mono text-slate-500">M{m.id}</span>
                              <h4 className="text-sm font-medium text-white">{m.title}</h4>
                              {getStatusBadge(m.status)}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                              <span>
                                Amount: <strong className="text-slate-200">{formatAmount(m.amount)} {tokenLabel}</strong>
                              </span>
                              <span>•</span>
                              <span>
                                Deadline:{' '}
                                <strong className={isExpired && isPending ? 'text-rose-400' : 'text-slate-300'}>
                                  {new Date(Number(m.deadline) * 1000).toLocaleDateString()}
                                </strong>
                              </span>
                            </div>

                            {/* Deliverable Proof if Submitted/Approved */}
                            {m.deliverable && (
                              <div className="mt-2 text-xs bg-slate-950/60 border border-slate-800 p-2.5 rounded-lg flex items-center justify-between gap-2 max-w-xl">
                                <span className="text-slate-400 truncate">
                                  Deliverable: <span className="text-slate-200 font-mono">{m.deliverable}</span>
                                </span>
                                {m.deliverable.startsWith('http') && (
                                  <a
                                    href={m.deliverable}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 font-medium flex-shrink-0"
                                  >
                                    View <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Action Buttons for Client */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {(isSubmitted || isPending) && (
                              <button
                                onClick={() => handleApprove(vault.id, m.id)}
                                disabled={actionLoading !== null}
                                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium px-3.5 py-2 rounded-lg transition shadow-md shadow-emerald-600/20"
                                title="Approve deliverable and release USDC directly to freelancer"
                              >
                                {isApproving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                                Approve & Release
                              </button>
                            )}

                            {(isSubmitted || isPending) && (
                              <button
                                onClick={() => handleDispute(vault.id, m.id)}
                                disabled={actionLoading !== null}
                                className="flex items-center gap-1.5 bg-slate-800 hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 border border-rose-500/20 disabled:opacity-50 text-xs font-medium px-3 py-2 rounded-lg transition"
                                title="Freeze funds and request Arbiter adjudication"
                              >
                                {isDisputing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                                Raise Dispute
                              </button>
                            )}

                            {isPending && isExpired && (
                              <button
                                onClick={() => handleRefund(vault.id, m.id)}
                                disabled={actionLoading !== null}
                                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 disabled:opacity-50 text-xs font-medium px-3 py-2 rounded-lg transition"
                                title="Claim refund after expired milestone deadline"
                              >
                                {isRefunding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                                Claim Refund
                              </button>
                            )}

                            {isApproved && (
                              <span className="text-xs text-emerald-400/80 font-medium px-3 py-1.5 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                                Completed & Paid
                              </span>
                            )}

                            {isDisputed && (
                              <span className="text-xs text-rose-400/80 font-medium px-3 py-1.5 bg-rose-500/5 rounded-lg border border-rose-500/10">
                                Arbiter In Review
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
