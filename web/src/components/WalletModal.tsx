import React, { useState } from 'react';
import { Wallet, Key, Plus, X, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { connectFreighter, createTestnetKeypair, importSecretKey } from '../services/stellar';
import type { WalletState } from '../types';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected: (wallet: WalletState) => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose, onConnected }) => {
  const [activeTab, setActiveTab] = useState<'freighter' | 'keypair'>('freighter');
  const [secretKeyInput, setSecretKeyInput] = useState('');
  const [roleLabel, setRoleLabel] = useState('Client');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFreighterConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const wallet = await connectFreighter();
      if (wallet) {
        onConnected(wallet);
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Freighter connection failed. Ensure Freighter is installed from freighter.app.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateKeypair = async () => {
    setLoading(true);
    setError(null);
    try {
      const wallet = await createTestnetKeypair(roleLabel);
      onConnected(wallet);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to fund and generate Testnet account via Friendbot.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportSecretKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretKeyInput.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const wallet = await importSecretKey(secretKeyInput.trim(), roleLabel);
      onConnected(wallet);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Invalid secret key format.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="relative w-full max-w-md p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Connect Wallet</h3>
            <p className="text-xs text-slate-400">Live Stellar Testnet Signers</p>
          </div>
        </div>

        {/* Tab selection */}
        <div className="grid grid-cols-2 gap-1 p-1 mb-6 bg-slate-950 rounded-xl border border-slate-800/80">
          <button
            onClick={() => { setActiveTab('freighter'); setError(null); }}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-lg transition ${
              activeTab === 'freighter'
                ? 'bg-slate-800 text-indigo-400 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            Freighter (Primary)
          </button>

          <button
            onClick={() => { setActiveTab('keypair'); setError(null); }}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-lg transition ${
              activeTab === 'keypair'
                ? 'bg-slate-800 text-emerald-400 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            Direct Testnet Keypair
          </button>
        </div>

        {/* Error notice */}
        {error && (
          <div className="mb-5 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2.5 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed">{error}</div>
          </div>
        )}

        {/* Freighter Tab */}
        {activeTab === 'freighter' && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl text-xs space-y-2">
              <span className="font-semibold text-white block">Official Stellar Browser Extension</span>
              <p className="text-slate-400 leading-relaxed">
                Connect your Freighter wallet to sign Soroban smart contract transactions directly on Stellar Testnet with your own keys.
              </p>
            </div>

            <button
              onClick={handleFreighterConnect}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-xl transition shadow-lg shadow-indigo-600/25"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connecting to Freighter...
                </>
              ) : (
                <>
                  <Wallet className="w-4 h-4" />
                  Connect Freighter Wallet
                </>
              )}
            </button>

            <p className="text-[11px] text-center text-slate-500">
              Don't have Freighter installed? Visit{' '}
              <a
                href="https://www.freighter.app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:underline"
              >
                freighter.app
              </a>
            </p>
          </div>
        )}

        {/* Direct Testnet Keypair Tab */}
        {activeTab === 'keypair' && (
          <div className="space-y-5">
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl text-xs space-y-2">
              <span className="font-semibold text-white block">Multi-Role Testing on Testnet</span>
              <p className="text-slate-400 leading-relaxed">
                Generate or import real funded Stellar Keypairs (<code className="text-emerald-400 font-mono">G...</code> / <code className="text-emerald-400 font-mono">S...</code>) to test different roles (Client, Freelancer, Arbiter) without needing multiple browser extension profiles.
              </p>
            </div>

            {/* Role picker */}
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">Select Role Label</label>
              <div className="grid grid-cols-3 gap-2">
                {(['Client', 'Freelancer', 'Arbiter'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRoleLabel(r)}
                    className={`py-1.5 text-xs font-medium rounded-lg border transition ${
                      roleLabel === r
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* 1-Click Generate & Fund */}
            <button
              onClick={handleGenerateKeypair}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl transition text-xs shadow-md shadow-emerald-600/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating & Funding via Friendbot...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Generate New Funded Account (+10,000 XLM)
                </>
              )}
            </button>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-slate-800 w-full"></div>
              <span className="bg-slate-900 px-3 text-[11px] text-slate-500 uppercase tracking-wider">or import secret key</span>
            </div>

            {/* Import form */}
            <form onSubmit={handleImportSecretKey} className="space-y-3">
              <input
                type="password"
                placeholder="S... (56-character Stellar Secret Key)"
                value={secretKeyInput}
                onChange={(e) => setSecretKeyInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
              />
              <button
                type="submit"
                disabled={loading || !secretKeyInput.trim()}
                className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-medium py-2.5 px-4 rounded-xl transition text-xs border border-slate-700/60"
              >
                <Key className="w-3.5 h-3.5" />
                Import & Connect Keypair
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
