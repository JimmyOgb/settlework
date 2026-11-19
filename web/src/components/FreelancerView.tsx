import React, { useState } from 'react';
import {
  Briefcase,
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  FileText,
  UploadCloud,
  Loader2,
  Sparkles,
} from 'lucide-react';
import type { Vault, Milestone } from '../types';
import { MilestoneStatus } from '../types';
import type { WalletState } from '../types';
import { raiseDispute, CONFIG } from '../services/stellar';

interface FreelancerViewProps {
  vaults: Vault[];
  wallet: WalletState | null;
  loading: boolean;
  onRefresh: () => void;
  onOpenDeliverableModal: (vaultId: bigint, milestoneId: number, milestoneTitle: string) => void;
  onOpenOffRampModal: () => void;
  onOpenWalletModal: () => void;
  usdcBalance: string;
}

export const FreelancerView: React.FC<FreelancerViewProps> = ({
  vaults,
  wallet,
  loading,
  onRefresh,
  onOpenDeliverableModal,
  onOpenOffRampModal,
  onOpenWalletModal,
  usdcBalance,
}) => {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string; hash?: string } | null>(null);

  const formatAmount = (stroops: bigint) => {
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
            In Progress
          </span>
        );
      case MilestoneStatus.Submitted:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <FileText className="w-3 h-3" />
            Submitted — Awaiting Client Approval
          </span>
        );
      case MilestoneStatus.Approved:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="w-3 h-3" />
            Paid & Released
          </span>
        );
      case MilestoneStatus.Disputed:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3 h-3" />
            Under Arbiter Review
          </span>
        );
      case MilestoneStatus.Refunded:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
            Refunded to Client
          </span>
        );
    }
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
        message: `Dispute raised on Milestone #${milestoneId}. Frozen for Arbiter decision.`,
        hash: res.hash,
      });
      onRefresh();
    } else {
      setFeedback({ type: 'error', message: res.error || 'Failed to raise dispute' });
    }
    setActionLoading(null);
  };

  // Metrics
  const lockedSecured = vaults.reduce((acc, v) => {
    const lockedInVault = v.milestones.reduce((mAcc, m) => {
      if (m.status === MilestoneStatus.Pending || m.status === MilestoneStatus.Submitted) {
        return mAcc + Number(m.amount) / 10_000_000;
      }
      return mAcc;
    }, 0);
    return acc + lockedInVault;
  }, 0);

  const pendingSubmissionCount = vaults.reduce((acc, v) => {
    return acc + v.milestones.filter((m) => m.status === MilestoneStatus.Pending).length;
  }, 0);

  const totalEarnedReleased = vaults.reduce((acc, v) => {
    return (
      acc +
      v.milestones.reduce((mAcc, m) => {
        if (m.status === MilestoneStatus.Approved) {
          return mAcc + Number(m.amount) / 10_000_000;
        }
        return mAcc;
      }, 0)
    );
  }, 0);

  return (
    <div className="space-y-6">
      {/* Overview & Action Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-emerald-400" />
            Freelancer Workspace
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Work with confidence. Every milestone is pre-funded in escrow before you write a single line of code.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition border border-slate-700/60"
            title="Refresh Assigned Vaults"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onOpenOffRampModal}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium px-4 py-2.5 rounded-xl transition shadow-lg shadow-emerald-600/25"
          >
            <DollarSign className="w-4 h-4" />
            Withdraw to NGN / GHS
          </button>
        </div>
      </div>

      {/* Featured Off-Ramp Callout Card */}
      <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900 to-emerald-950/40 border border-emerald-500/30 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            Stellar SEP-24 / SEP-38 Local Off-Ramp
          </div>
          <h3 className="text-lg font-bold text-white">
            Convert Released USDC to Nigerian Naira or Ghanaian Cedis
          </h3>
          <p className="text-sm text-slate-300 max-w-2xl">
            Skip expensive 5–7% wire fees and 5-day bank delays. Receive direct local bank deposits or mobile money payouts in seconds at fair market FX rates.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <span className="text-xs text-slate-400 block">Available Balance</span>
            <span className="text-lg font-bold text-emerald-400 font-mono">${usdcBalance} USDC</span>
          </div>
          <button
            onClick={onOpenOffRampModal}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl transition shadow-lg shadow-emerald-500/20"
          >
            Cash Out Now <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Secured in Escrow</span>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            ${lockedSecured.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-slate-500 mt-1 block">Locked funds awaiting completion</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Released Earnings</span>
          <div className="text-2xl font-bold text-white mt-1">
            ${totalEarnedReleased.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-slate-500 mt-1 block">Lifetime earnings approved</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Milestones In Progress</span>
          <div className="text-2xl font-bold text-indigo-400 mt-1">{pendingSubmissionCount}</div>
          <span className="text-xs text-slate-500 mt-1 block">Deliverables ready to be submitted</span>
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
        </div>
      )}

      {/* Contracts List */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-white">Your Assigned Escrows</h3>

        {!wallet ? (
          <div className="text-center py-14 bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
            <Briefcase className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h4 className="text-base font-medium text-white mb-1">Connect Wallet as Freelancer</h4>
            <p className="text-sm text-slate-400 max-w-md mx-auto mb-5">
              Sign in to inspect contracts where your Stellar address is set as the freelancer beneficiary.
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
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-2" />
            <p className="text-sm text-slate-400">Loading your assigned contracts from Stellar Testnet...</p>
          </div>
        ) : vaults.length === 0 ? (
          <div className="text-center py-14 bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
            <Briefcase className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h4 className="text-base font-medium text-white mb-1">No Assigned Escrows Found</h4>
            <p className="text-sm text-slate-400 max-w-md mx-auto mb-4">
              Ask your client to create an escrow vault using your address:
            </p>
            <div className="inline-block bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 font-mono text-xs text-indigo-300 max-w-md break-all mb-4">
              {wallet.address}
            </div>
            <p className="text-xs text-slate-500">
              Once created on Stellar Testnet, the escrow agreement will show up here automatically.
            </p>
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
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center font-mono font-bold text-emerald-400">
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
                            Client:{' '}
                            <a
                              href={`${CONFIG.stellarExpertBase}/account/${vault.client}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-indigo-400 hover:underline"
                            >
                              {truncate(vault.client)}
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
                      <span className="text-xs text-slate-400 block">Total Contract Value</span>
                      <span className="text-lg font-bold text-white">
                        {formatAmount(vault.total_amount)} {tokenLabel}
                      </span>
                    </div>
                  </div>

                  {/* Milestones */}
                  <div className="divide-y divide-slate-800/80">
                    {vault.milestones.map((m: Milestone) => {
                      const isPending = m.status === MilestoneStatus.Pending;
                      const isSubmitted = m.status === MilestoneStatus.Submitted;
                      const isApproved = m.status === MilestoneStatus.Approved;
                      const isDisputed = m.status === MilestoneStatus.Disputed;
                      const isDisputing = actionLoading === `dispute-${vault.id}-${m.id}`;

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
                                Compensation: <strong className="text-slate-200">{formatAmount(m.amount)} {tokenLabel}</strong>
                              </span>
                              <span>•</span>
                              <span>
                                Target Deadline:{' '}
                                <strong className="text-slate-300">
                                  {new Date(Number(m.deadline) * 1000).toLocaleDateString()}
                                </strong>
                              </span>
                            </div>

                            {/* Deliverable preview */}
                            {m.deliverable && (
                              <div className="mt-2 text-xs bg-slate-950/60 border border-slate-800 p-2.5 rounded-lg flex items-center justify-between gap-2 max-w-xl">
                                <span className="text-slate-400 truncate">
                                  Submitted Proof: <span className="text-slate-200 font-mono">{m.deliverable}</span>
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

                          {/* Action Buttons for Freelancer */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {isPending && (
                              <button
                                onClick={() => onOpenDeliverableModal(vault.id, m.id, m.title)}
                                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3.5 py-2 rounded-lg transition shadow-md shadow-indigo-600/20"
                              >
                                <UploadCloud className="w-3.5 h-3.5" />
                                Submit Deliverable
                              </button>
                            )}

                            {(isPending || isSubmitted) && (
                              <button
                                onClick={() => handleDispute(vault.id, m.id)}
                                disabled={actionLoading !== null}
                                className="flex items-center gap-1.5 bg-slate-800 hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 border border-rose-500/20 disabled:opacity-50 text-xs font-medium px-3 py-2 rounded-lg transition"
                                title="Dispute with client if scope or approval is stalled"
                              >
                                {isDisputing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                                Raise Dispute
                              </button>
                            )}

                            {isSubmitted && (
                              <span className="text-xs text-sky-400/80 font-medium px-3 py-1.5 bg-sky-500/5 rounded-lg border border-sky-500/10">
                                Waiting for Client Sign-off
                              </span>
                            )}

                            {isApproved && (
                              <button
                                onClick={onOpenOffRampModal}
                                className="flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-medium px-3 py-2 rounded-lg transition"
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                                Cash Out Earnings
                              </button>
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
