import React, { useState } from 'react';
import { Plus, Trash2, X, AlertCircle, CheckCircle2, ArrowUpRight, Loader2 } from 'lucide-react';
import { createVault, CONFIG } from '../services/stellar';
import type { WalletState } from '../types';

interface CreateVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: WalletState | null;
  onVaultCreated: () => void;
}

interface MilestoneDraft {
  title: string;
  amount: string;
  days: number;
}

export const CreateVaultModal: React.FC<CreateVaultModalProps> = ({
  isOpen,
  onClose,
  wallet,
  onVaultCreated,
}) => {
  const [freelancer, setFreelancer] = useState('');
  const [arbiter, setArbiter] = useState('');
  const [selectedToken, setSelectedToken] = useState<'USDC' | 'XLM'>('USDC');
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([
    { title: 'Milestone 1: Architecture & Core Implementation', amount: '50', days: 7 },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successHash, setSuccessHash] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddMilestone = () => {
    setMilestones([
      ...milestones,
      { title: `Milestone ${milestones.length + 1}`, amount: '50', days: 14 },
    ]);
  };

  const handleRemoveMilestone = (index: number) => {
    if (milestones.length <= 1) return;
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const handleMilestoneChange = (index: number, field: keyof MilestoneDraft, value: string | number) => {
    const updated = [...milestones];
    updated[index] = { ...updated[index], [field]: value };
    setMilestones(updated);
  };

  const totalAmount = milestones.reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) {
      setError('Please connect your wallet first.');
      return;
    }
    if (!freelancer.trim() || !arbiter.trim()) {
      setError('Freelancer and Arbiter Stellar addresses are required.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessHash(null);

    try {
      const now = Math.floor(Date.now() / 1000);
      const tokenAddress = selectedToken === 'USDC' ? CONFIG.usdcSacId : CONFIG.xlmSacId;

      const formattedMilestones = milestones.map((m) => ({
        title: m.title.trim(),
        // 7 decimals for Stellar SAC tokens (1 token = 10,000,000 stroops)
        amount: BigInt(Math.floor((parseFloat(m.amount) || 0) * 10_000_000)),
        deadline: BigInt(now + m.days * 86400),
      }));

      const res = await createVault(wallet, {
        freelancer: freelancer.trim(),
        arbiter: arbiter.trim(),
        token: tokenAddress,
        milestones: formattedMilestones,
      });

      if (res.success && res.hash) {
        setSuccessHash(res.hash);
        onVaultCreated();
      } else {
        setError(res.error || 'Failed to create vault on Stellar Testnet.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error executing Soroban contract call.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl my-8 p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-xl font-bold text-white mb-1">Create Escrow Vault</h3>
        <p className="text-xs text-slate-400 mb-6">
          Funds are locked in the Soroban smart contract and released only upon your milestone approval.
        </p>

        {error && (
          <div className="flex items-start gap-2.5 p-3.5 mb-5 text-xs text-rose-300 bg-rose-950/40 border border-rose-800/60 rounded-xl">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {successHash && (
          <div className="p-4 mb-6 bg-emerald-950/40 border border-emerald-800/60 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span>Vault successfully created and funded on Stellar Testnet!</span>
            </div>
            <div className="text-xs text-slate-300 flex items-center justify-between">
              <span>Tx Hash: <span className="font-mono text-emerald-300">{successHash}</span></span>
              <a
                href={`${CONFIG.stellarExpertBase}/tx/${successHash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-emerald-400 underline hover:text-emerald-300 ml-2"
              >
                View on StellarExpert <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded-lg text-xs transition"
              >
                Close & View Active Vaults
              </button>
            </div>
          </div>
        )}

        {!successHash && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Asset Selection */}
            <div>
              <label className="block mb-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Escrow Settlement Asset
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedToken('USDC')}
                  className={`p-3 rounded-xl border text-left transition ${
                    selectedToken === 'USDC'
                      ? 'bg-emerald-500/10 border-emerald-500/50 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-emerald-400">USDC (Stellar SAC)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium">
                      Recommended
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Compatible with SEP-24/38 NGN/GHS off-ramp payouts</p>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedToken('XLM')}
                  className={`p-3 rounded-xl border text-left transition ${
                    selectedToken === 'XLM'
                      ? 'bg-emerald-500/10 border-emerald-500/50 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-white">Native XLM (SAC)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-medium">
                      Testnet Native
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Directly funded from Friendbot faucet</p>
                </button>
              </div>
            </div>

            {/* Participant Addresses */}
            <div className="space-y-3">
              <div>
                <label className="block mb-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Freelancer Stellar Address
                </label>
                <input
                  type="text"
                  placeholder="G... (56-character Stellar Public Key)"
                  value={freelancer}
                  onChange={(e) => setFreelancer(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div>
                <label className="block mb-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Arbiter Stellar Address (Neutral Dispute Mediator)
                </label>
                <input
                  type="text"
                  placeholder="G... (56-character Stellar Public Key)"
                  value={arbiter}
                  onChange={(e) => setArbiter(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            {/* Dynamic Milestones */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Milestone Schedule
                </label>
                <button
                  type="button"
                  onClick={handleAddMilestone}
                  className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Milestone
                </button>
              </div>

              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {milestones.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl flex items-center gap-3"
                  >
                    <span className="text-xs font-mono text-slate-500 w-6 text-center">#{idx + 1}</span>
                    <input
                      type="text"
                      placeholder="Milestone title or scope..."
                      value={m.title}
                      onChange={(e) => handleMilestoneChange(idx, 'title', e.target.value)}
                      required
                      className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                    <div className="w-24">
                      <input
                        type="number"
                        placeholder="Amount"
                        value={m.amount}
                        onChange={(e) => handleMilestoneChange(idx, 'amount', e.target.value)}
                        required
                        min="1"
                        step="any"
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-emerald-500 text-right"
                      />
                    </div>
                    <div className="w-20">
                      <input
                        type="number"
                        placeholder="Days"
                        value={m.days}
                        onChange={(e) => handleMilestoneChange(idx, 'days', parseInt(e.target.value) || 1)}
                        required
                        min="1"
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 text-center"
                        title="Days until deadline"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveMilestone(idx)}
                      disabled={milestones.length <= 1}
                      className="p-1.5 text-slate-500 hover:text-rose-400 disabled:opacity-30 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Total and Submit */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 block">Total Escrow Deposit</span>
                <span className="text-lg font-bold text-white font-mono">
                  {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {selectedToken}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-medium text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || totalAmount <= 0}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded-xl transition shadow-lg shadow-emerald-600/25 text-xs"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Signing & Locking Funds...
                    </>
                  ) : (
                    `Confirm & Lock ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${selectedToken}`
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
