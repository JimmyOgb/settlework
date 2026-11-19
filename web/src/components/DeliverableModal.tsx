import React, { useState } from 'react';
import { Send, X, AlertCircle, CheckCircle2, ArrowUpRight, Loader2, Link2 } from 'lucide-react';
import { submitMilestone, CONFIG } from '../services/stellar';
import type { WalletState } from '../types';

interface DeliverableModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultId: bigint;
  milestoneId: number;
  milestoneTitle: string;
  wallet: WalletState | null;
  onSubmitted: () => void;
}

export const DeliverableModal: React.FC<DeliverableModalProps> = ({
  isOpen,
  onClose,
  vaultId,
  milestoneId,
  milestoneTitle,
  wallet,
  onSubmitted,
}) => {
  const [deliverable, setDeliverable] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successHash, setSuccessHash] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) return;
    if (!deliverable.trim()) {
      setError('Please provide a deliverable link or reference hash.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessHash(null);

    try {
      const res = await submitMilestone(wallet, {
        vaultId,
        milestoneId,
        deliverable: deliverable.trim(),
      });

      if (res.success && res.hash) {
        setSuccessHash(res.hash);
        onSubmitted();
      } else {
        setError(res.error || 'Failed to submit milestone deliverable to contract.');
      }
    } catch (err: any) {
      setError(err?.message || 'Transaction submission error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="relative w-full max-w-lg p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-bold text-white mb-1">Submit Milestone Deliverable</h3>
        <p className="text-xs text-slate-400 mb-4">
          Vault #{vaultId.toString()} &bull; Milestone {milestoneId}: <span className="text-slate-200 font-medium">{milestoneTitle}</span>
        </p>

        {error && (
          <div className="flex items-start gap-2.5 p-3.5 mb-5 text-xs text-rose-300 bg-rose-950/40 border border-rose-800/60 rounded-xl">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {successHash ? (
          <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span>Deliverable submitted successfully on Testnet!</span>
            </div>
            <p className="text-xs text-slate-300">
              Your client can now review the deliverable proof and release escrow funds.
            </p>
            <div className="text-xs text-slate-300 flex items-center justify-between">
              <span>Tx Hash: <span className="font-mono text-emerald-300">{successHash}</span></span>
              <a
                href={`${CONFIG.stellarExpertBase}/tx/${successHash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-emerald-400 underline hover:text-emerald-300 ml-2"
              >
                Explorer <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
            <button
              onClick={onClose}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded-lg text-xs transition mt-2"
            >
              Done & Return to Workspace
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Deliverable URL or Content Hash
              </label>
              <div className="relative">
                <Link2 className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="https://github.com/org/repo/commit/... or ipfs://..."
                  value={deliverable}
                  onChange={(e) => setDeliverable(e.target.value)}
                  required
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                The deliverable reference is recorded immutably on-chain for client review and arbiter audit trails.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !deliverable.trim()}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium px-4 py-2.5 rounded-xl transition shadow-lg shadow-indigo-600/25"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Signing on Testnet...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Submit to Contract
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
