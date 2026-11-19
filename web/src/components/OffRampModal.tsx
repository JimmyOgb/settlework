import React, { useState, useEffect } from 'react';
import {
  X,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  Globe,
  Building,
  Smartphone,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import {
  fetchLiveFxRates,
  runSep10Auth,
  startSep24Withdrawal,
  pollSep24Transaction,
  type LiveFxData,
  type Sep24TransactionStatus,
  ANCHOR_CONFIG,
} from '../services/anchor';
import type { WalletState } from '../types';

interface OffRampModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableUsdc: number;
  wallet: WalletState | null;
}

type Corridor = 'NGN' | 'GHS';

export const OffRampModal: React.FC<OffRampModalProps> = ({
  isOpen,
  onClose,
  availableUsdc,
  wallet,
}) => {
  const [corridor, setCorridor] = useState<Corridor>('NGN');
  const [usdcAmount, setUsdcAmount] = useState<string>(
    availableUsdc > 0 ? availableUsdc.toString() : '5'
  );

  // Live FX State
  const [fxData, setFxData] = useState<LiveFxData | null>(null);
  const [fxLoading, setFxLoading] = useState(false);
  const [fxError, setFxError] = useState<string | null>(null);

  // Anchor Session State
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionStage, setSessionStage] = useState<string | null>(null);
  const [anchorError, setAnchorError] = useState<string | null>(null);
  const [sep24Tx, setSep24Tx] = useState<Sep24TransactionStatus | null>(null);
  const [interactiveUrl, setInteractiveUrl] = useState<string | null>(null);

  // Fetch live FX rates on open or corridor change
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setFxLoading(true);
    setFxError(null);

    fetchLiveFxRates()
      .then((data) => {
        if (mounted) {
          setFxData(data);
          setFxLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          console.error('Live FX Fetch Error:', err);
          setFxError(err.message || 'Failed to fetch live FX rate from public provider');
          setFxLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const currentRate = fxData ? (corridor === 'NGN' ? fxData.ngnRate : fxData.ghsRate) : 0;
  const parsedAmount = parseFloat(usdcAmount) || 0;

  // Real fee math with live rate
  const anchorFeeUsd = parsedAmount * 0.005; // 0.5% anchor fee
  const stellarNetworkFeeUsd = 0.00001; // < 0.0001 XLM
  const netUsdc = Math.max(0, parsedAmount - anchorFeeUsd);
  const localPayout = netUsdc * currentRate;

  // Traditional international wire cost comparison
  const wireFixedFeeUsd = 45;
  const wireFxSpreadPercent = 0.055;
  const wireTotalFeeUsd = wireFixedFeeUsd + parsedAmount * wireFxSpreadPercent;
  const wireNetUsd = Math.max(0, parsedAmount - wireTotalFeeUsd);
  const wireLocalPayout = wireNetUsd * currentRate;
  const totalSavingsUsd = Math.max(0, wireTotalFeeUsd - anchorFeeUsd);

  // Start real SEP-10 & SEP-24 Anchor Withdrawal Flow
  const handleStartWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) {
      setAnchorError('Please connect a Stellar wallet to authorize anchor withdrawal.');
      return;
    }
    if (parsedAmount <= 0) {
      setAnchorError('Please enter a valid withdrawal amount.');
      return;
    }

    setSessionLoading(true);
    setAnchorError(null);
    setSep24Tx(null);
    setInteractiveUrl(null);

    try {
      // Step 1: SEP-10 Authentication Handshake
      setSessionStage('Authenticating with Anchor via SEP-10 challenge...');
      const jwt = await runSep10Auth(wallet);

      // Step 2: Request SEP-24 Interactive Session
      setSessionStage('Requesting SEP-24 hosted withdrawal session from testanchor.stellar.org...');
      const sep24Res = await startSep24Withdrawal(jwt, wallet.address, parsedAmount.toString());

      setInteractiveUrl(sep24Res.url);
      setSessionStage('Hosted anchor session ready. Opening interactive popup...');

      // Step 3: Open interactive URL in a secure popup window
      const popup = window.open(
        sep24Res.url,
        'stellar_anchor_interactive',
        'width=540,height=720,menubar=no,toolbar=no,location=no,status=no'
      );

      // Step 4: Poll initial transaction status
      const initialTx = await pollSep24Transaction(jwt, sep24Res.id);
      if (initialTx) {
        setSep24Tx(initialTx);
      } else {
        setSep24Tx({
          id: sep24Res.id,
          kind: 'withdrawal',
          status: 'interactive_customer_info_needed',
          more_info_url: sep24Res.url,
        });
      }

      setSessionStage(null);
    } catch (err: any) {
      console.error('Anchor session error:', err);
      setAnchorError(err?.message || 'Anchor SEP-10/SEP-24 initiation failed.');
      setSessionStage(null);
    } finally {
      setSessionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl my-8 p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Cash Out to Local Bank / Mobile Money</h3>
            <p className="text-xs text-slate-400">
              Live Stellar Anchor Bridge (SEP-10 &bull; SEP-24 &bull; SEP-38)
            </p>
          </div>
        </div>

        {/* Live FX Rate Notice & Source Badge */}
        <div className="mb-5 p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl">
          {fxLoading ? (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              <span>Fetching live real-time FX rates from <code className="text-slate-300">open.er-api.com</code>...</span>
            </div>
          ) : fxError ? (
            <div className="flex items-start gap-2 text-xs text-rose-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Live FX Feed Error</p>
                <p className="text-rose-300 text-[11px]">{fxError}</p>
                <p className="text-slate-400 text-[10px] mt-1">
                  Zero-mock policy in effect: off-ramp quoting requires verified live FX data.
                </p>
              </div>
            </div>
          ) : fxData ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-medium text-slate-300">
                  Live Rate: <strong className="text-emerald-400 font-mono">1 USD = {currentRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {corridor}</strong>
                </span>
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-2">
                <span>Feed: <span className="text-slate-400 font-mono">{fxData.provider}</span></span>
                <span>&bull;</span>
                <span>{new Date(fxData.lastUpdated).toLocaleTimeString()}</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Anchor Session Error */}
        {anchorError && (
          <div className="mb-5 p-3.5 bg-rose-950/40 border border-rose-800/60 rounded-xl flex items-start gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
            <div className="space-y-1">
              <p className="font-semibold">Stellar Anchor Error</p>
              <p className="text-[11px]">{anchorError}</p>
            </div>
          </div>
        )}

        {/* Live Active SEP-24 Session Card */}
        {sep24Tx && (
          <div className="mb-6 p-4 bg-emerald-950/30 border border-emerald-500/40 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                Live SEP-24 Session Active
              </span>
              <span className="px-2 py-0.5 text-[10px] uppercase font-mono font-bold rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                {sep24Tx.status}
              </span>
            </div>

            <div className="text-xs text-slate-300 space-y-1">
              <div>Anchor ID: <code className="font-mono text-emerald-300 text-[11px]">{sep24Tx.id}</code></div>
              <div>Endpoint: <code className="font-mono text-slate-400 text-[11px]">{ANCHOR_CONFIG.homeDomain}</code></div>
            </div>

            {interactiveUrl && (
              <div className="pt-2 flex items-center gap-3">
                <a
                  href={interactiveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 px-3 rounded-lg text-xs transition"
                >
                  Reopen Anchor Interactive Window <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        )}

        {/* Withdrawal Form */}
        <form onSubmit={handleStartWithdrawal} className="space-y-5">
          {/* Corridor Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Select Payout Corridor
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCorridor('NGN')}
                className={`p-3 rounded-xl border text-left transition flex items-center gap-3 ${
                  corridor === 'NGN'
                    ? 'bg-emerald-500/10 border-emerald-500/50 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center font-bold text-xs text-emerald-400">
                  NG
                </div>
                <div>
                  <div className="font-bold text-sm text-white">Nigeria (NGN)</div>
                  <div className="text-[11px] text-slate-400">NIP Direct Bank Transfer</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setCorridor('GHS')}
                className={`p-3 rounded-xl border text-left transition flex items-center gap-3 ${
                  corridor === 'GHS'
                    ? 'bg-emerald-500/10 border-emerald-500/50 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center font-bold text-xs text-amber-400">
                  GH
                </div>
                <div>
                  <div className="font-bold text-sm text-white">Ghana (GHS)</div>
                  <div className="text-[11px] text-slate-400">MTN MoMo / Bank Deposit</div>
                </div>
              </button>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Withdrawal Amount (USDC)
              </label>
              <span className="text-xs text-slate-400">
                Available: <strong className="text-emerald-400 font-mono">{availableUsdc.toFixed(2)} USDC</strong>
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                min="1"
                step="any"
                value={usdcAmount}
                onChange={(e) => setUsdcAmount(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
              />
              <span className="absolute right-3.5 top-2.5 text-xs font-semibold text-slate-400">
                USDC
              </span>
            </div>
          </div>

          {/* Real Cost & Payout Calculation */}
          {fxData && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>Stellar Anchor Fee (0.5%)</span>
                <span className="font-mono text-slate-200">${anchorFeeUsd.toFixed(2)} USDC</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Stellar Network Fee</span>
                <span className="font-mono text-emerald-400">&lt; $0.001 (0.00001 XLM)</span>
              </div>
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <span className="font-semibold text-white">Estimated Local Payout</span>
                <span className="text-base font-bold text-emerald-400 font-mono">
                  {localPayout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {corridor}
                </span>
              </div>
            </div>
          )}

          {/* Side-by-Side Savings Comparison */}
          {fxData && (
            <div className="p-3.5 bg-indigo-950/20 border border-indigo-500/20 rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-1.5 text-indigo-300 font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Savings vs. Traditional International Wire</span>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1 text-[11px]">
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Stellar Anchor Settlement</span>
                  <div className="font-bold text-emerald-400 font-mono">
                    {localPayout.toLocaleString(undefined, { maximumFractionDigits: 0 })} {corridor}
                  </div>
                  <span className="text-slate-500 text-[10px]">Fee: ~0.5% &bull; Instant</span>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Bank Wire (SWIFT)</span>
                  <div className="font-bold text-slate-400 font-mono line-through">
                    {wireLocalPayout.toLocaleString(undefined, { maximumFractionDigits: 0 })} {corridor}
                  </div>
                  <span className="text-slate-500 text-[10px]">Fee: ~$45 + 5.5% FX &bull; 3–5 days</span>
                </div>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={sessionLoading || fxLoading || !!fxError || parsedAmount <= 0}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-xl transition shadow-lg shadow-emerald-600/25 text-xs"
            >
              {sessionLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{sessionStage || 'Executing Anchor Protocol...'}</span>
                </>
              ) : (
                <>
                  <span>Initiate Anchor Withdrawal on Testnet (SEP-24)</span>
                  <ArrowUpRight className="w-4 h-4" />
                </>
              )}
            </button>
            <p className="text-[11px] text-center text-slate-500 mt-2">
              Connects directly to <code className="text-slate-400">testanchor.stellar.org</code> via SEP-10 signed WebAuth.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
