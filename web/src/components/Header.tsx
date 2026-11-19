import React, { useState } from 'react';
import { ShieldCheck, Droplets, LogOut, Wallet, ExternalLink, RefreshCw } from 'lucide-react';
import { fundWithFriendbot, CONFIG } from '../services/stellar';
import type { UserRole, WalletState } from '../types';

interface HeaderProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  wallet: WalletState | null;
  onOpenWalletModal: () => void;
  onDisconnect: () => void;
  balances: { xlm: string; usdc: string };
  onRefreshBalances: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onRoleChange,
  wallet,
  onOpenWalletModal,
  onDisconnect,
  balances,
  onRefreshBalances,
}) => {
  const [funding, setFunding] = useState(false);
  const [faucetMessage, setFaucetMessage] = useState<string | null>(null);

  const handleFund = async () => {
    if (!wallet) return;
    setFunding(true);
    setFaucetMessage(null);
    const ok = await fundWithFriendbot(wallet.address);
    if (ok) {
      setFaucetMessage('Funded +10,000 XLM!');
      onRefreshBalances();
      setTimeout(() => setFaucetMessage(null), 4000);
    } else {
      setFaucetMessage('Faucet failed');
      setTimeout(() => setFaucetMessage(null), 3000);
    }
    setFunding(false);
  };

  const truncate = (addr: string) => `${addr.slice(0, 4)}...${addr.slice(-4)}`;

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-slate-950 shadow-md shadow-emerald-950/40 font-bold">
              <ShieldCheck className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-white">SettleWork</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Soroban Escrow
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  NGN/GHS Off-Ramp
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Milestone-locked contracts on Stellar</p>
            </div>
          </div>

          {/* Role Navigation Switcher */}
          <div className="hidden md:flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => onRoleChange('client')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                currentRole === 'client'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>💼</span> Client View
            </button>
            <button
              onClick={() => onRoleChange('freelancer')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                currentRole === 'freelancer'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🛠️</span> Freelancer View
            </button>
            <button
              onClick={() => onRoleChange('arbiter')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                currentRole === 'arbiter'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>⚖️</span> Arbiter Console
            </button>
          </div>

          {/* Right Action Cluster */}
          <div className="flex items-center gap-2 sm:gap-3">
            {wallet ? (
              <div className="flex items-center gap-2">
                {/* 1-Click Friendbot Faucet */}
                <button
                  onClick={handleFund}
                  disabled={funding}
                  title="Fund 10,000 Testnet XLM via Friendbot"
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 rounded-lg transition"
                >
                  <Droplets className={`w-3.5 h-3.5 text-cyan-400 ${funding ? 'animate-bounce' : ''}`} />
                  <span>{funding ? 'Funding...' : faucetMessage || 'Faucet'}</span>
                </button>

                {/* Balances Pill */}
                <div
                  onClick={onRefreshBalances}
                  title="Click to refresh balances"
                  className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs cursor-pointer hover:border-slate-700 transition"
                >
                  <span className="text-slate-400">USDC:</span>
                  <span className="font-semibold text-emerald-400">{balances.usdc}</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-400">XLM:</span>
                  <span className="font-semibold text-white">{balances.xlm}</span>
                  <RefreshCw className="w-3 h-3 text-slate-500 hover:text-slate-300" />
                </div>

                {/* Account & Disconnect */}
                <div className="flex items-center gap-1.5 pl-2 pr-1.5 py-1 bg-slate-900 border border-slate-800 rounded-xl">
                  <a
                    href={`${CONFIG.stellarExpertBase}/account/${wallet.address}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs font-mono font-medium text-slate-300 hover:text-emerald-400 transition"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{truncate(wallet.address)}</span>
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                  </a>
                  <button
                    onClick={onDisconnect}
                    title="Disconnect Wallet"
                    className="p-1 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={onOpenWalletModal}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition shadow-md shadow-emerald-950/40"
              >
                <Wallet className="w-4 h-4" />
                <span>Connect Wallet</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Role Switcher */}
        <div className="flex md:hidden items-center justify-around py-2 border-t border-slate-800/60">
          <button
            onClick={() => onRoleChange('client')}
            className={`px-3 py-1 text-xs font-medium rounded-lg ${
              currentRole === 'client' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400'
            }`}
          >
            💼 Client
          </button>
          <button
            onClick={() => onRoleChange('freelancer')}
            className={`px-3 py-1 text-xs font-medium rounded-lg ${
              currentRole === 'freelancer' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400'
            }`}
          >
            🛠️ Freelancer
          </button>
          <button
            onClick={() => onRoleChange('arbiter')}
            className={`px-3 py-1 text-xs font-medium rounded-lg ${
              currentRole === 'arbiter' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400'
            }`}
          >
            ⚖️ Arbiter
          </button>
        </div>
      </div>
    </header>
  );
};
