"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Info,
  Loader2,
  Minus,
  PlusCircle,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  UserRoundCog,
  Vote,
  Wallet,
  X,
} from "lucide-react";
import { Identity } from "@semaphore-protocol/identity";
import { Group } from "@semaphore-protocol/group";
import { ethers } from "ethers";
import { generateSemaphoreProofForVote } from "@shieldlogin/crypto";
import { getDaoProposals, castDaoVote, getAnonymityGroup } from "@/lib/api";

type Proposal = {
  id: number;
  description: string;
  start_time: number;
  end_time: number;
  finalized: boolean;
  yes_votes: number;
  no_votes: number;
  abstain_votes: number;
  voting_open: boolean;
};

const VOTE_LABELS = ["Yes", "No", "Abstain"] as const;
const DAO_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_DAO_VOTING_CONTRACT_ADDRESS || "";
const EXPECTED_CHAIN_ID = process.env.NEXT_PUBLIC_DAO_CHAIN_ID || "11155111";
const DAO_CONTRACT_ABI = [
  "function owner() view returns (address)",
  "function createProposal(uint256 proposalId,string description,bytes32 snapshotRoot,uint64 startTime,uint64 endTime)",
  "function finalizeProposal(uint256 proposalId)",
] as const;

type ToastTone = "success" | "error" | "info";

type ToastMessage = {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
};

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

export default function DaoPage() {
  const router = useRouter();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [votingFor, setVotingFor] = useState<{ proposalId: number; choice: number } | null>(null);
  const [confirmVote, setConfirmVote] = useState<{ proposalId: number; choice: number } | null>(null);
  const [connectedAccount, setConnectedAccount] = useState<string>("");
  const [ownerAddress, setOwnerAddress] = useState<string>("");
  const [isOwner, setIsOwner] = useState(false);
  const [walletChainId, setWalletChainId] = useState<string>("");
  const [ownerLookupError, setOwnerLookupError] = useState<string>("");
  const [walletLoading, setWalletLoading] = useState(false);
  const [creatingProposal, setCreatingProposal] = useState(false);
  const [finalizingProposalId, setFinalizingProposalId] = useState<number | null>(null);
  const [newProposalId, setNewProposalId] = useState("");
  const [newProposalDescription, setNewProposalDescription] = useState("");
  const [newProposalStart, setNewProposalStart] = useState("");
  const [newProposalEnd, setNewProposalEnd] = useState("");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(
    (tone: ToastTone, title: string, description?: string) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((prev) => [...prev, { id, tone, title, description }]);
      window.setTimeout(() => removeToast(id), 4800);
    },
    [removeToast]
  );

  const getInjectedProvider = useCallback((): Eip1193Provider | null => {
    if (typeof window === "undefined") {
      return null;
    }
    const provider = (window as Window & { ethereum?: Eip1193Provider }).ethereum;
    return provider || null;
  }, []);

  const isOnExpectedNetwork = walletChainId === EXPECTED_CHAIN_ID;

  const hydrateOwnerStatus = useCallback(async (account: string) => {
    const provider = getInjectedProvider();
    if (!provider || !DAO_CONTRACT_ADDRESS) {
      setConnectedAccount(account);
      setOwnerAddress("");
      setIsOwner(false);
      setOwnerLookupError("DAO contract address is missing in frontend env.");
      return;
    }

    try {
      if (!ethers.isAddress(DAO_CONTRACT_ADDRESS)) {
        throw new Error("NEXT_PUBLIC_DAO_VOTING_CONTRACT_ADDRESS is not a valid EVM address.");
      }

      const browserProvider = new ethers.BrowserProvider(provider);
      const network = await browserProvider.getNetwork();
      setWalletChainId(network.chainId.toString());
      if (network.chainId.toString() !== EXPECTED_CHAIN_ID) {
        throw new Error(
          `Wrong network. Switch wallet to chain ${EXPECTED_CHAIN_ID} (Sepolia is 11155111).`
        );
      }
      const code = await browserProvider.getCode(DAO_CONTRACT_ADDRESS);
      if (!code || code === "0x") {
        throw new Error(
          "No contract found at NEXT_PUBLIC_DAO_VOTING_CONTRACT_ADDRESS on the current wallet network."
        );
      }

      const contract = new ethers.Contract(DAO_CONTRACT_ADDRESS, DAO_CONTRACT_ABI, browserProvider);
      const owner = (await contract.owner()) as string;
      setConnectedAccount(account);
      setOwnerAddress(owner);
      setIsOwner(owner.toLowerCase() === account.toLowerCase());
      setOwnerLookupError("");
    } catch (err) {
      setConnectedAccount(account);
      setOwnerAddress("");
      setIsOwner(false);
      setOwnerLookupError(err instanceof Error ? err.message : "Failed to read contract owner.");
      throw err;
    }
  }, [getInjectedProvider]);

  const loadProposals = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDaoProposals();
      setProposals(data);
    } catch (err) {
      addToast("error", "Could not load proposals", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    if (typeof window !== "undefined" && !sessionStorage.getItem("lantra_authenticated")) {
      router.replace("/login");
      return;
    }
    void loadProposals();
    void (async () => {
      const provider = getInjectedProvider();
      if (!provider || !DAO_CONTRACT_ADDRESS) {
        return;
      }
      try {
        const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
        if (accounts.length > 0) {
          await hydrateOwnerStatus(accounts[0]);
        }
      } catch {
        /* no-op */
      }
    })();
  }, [router, getInjectedProvider, hydrateOwnerStatus, loadProposals]);

  async function connectWallet() {
    const provider = getInjectedProvider();
    if (!provider) {
      addToast("error", "Wallet not found", "Install MetaMask or another EVM wallet.");
      return;
    }
    if (!DAO_CONTRACT_ADDRESS) {
      addToast(
        "error",
        "Missing DAO contract address",
        "Set NEXT_PUBLIC_DAO_VOTING_CONTRACT_ADDRESS in frontend env."
      );
      return;
    }
    setWalletLoading(true);
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      if (!accounts.length) {
        throw new Error("No wallet account was returned");
      }
      await hydrateOwnerStatus(accounts[0]);
      addToast("success", "Wallet connected", "You can now create proposals if you are the contract owner.");
    } catch (err) {
      addToast("error", "Failed to connect wallet", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setWalletLoading(false);
    }
  }

  async function switchToExpectedNetwork() {
    const provider = getInjectedProvider();
    if (!provider) {
      addToast("error", "Wallet not found", "Install MetaMask or another EVM wallet.");
      return;
    }
    const chainHex = `0x${Number.parseInt(EXPECTED_CHAIN_ID, 10).toString(16)}`;
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainHex }],
      });
      const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
      if (accounts.length > 0) {
        await hydrateOwnerStatus(accounts[0]);
      }
      addToast("success", "Network switched", `Connected to chain ${EXPECTED_CHAIN_ID}.`);
    } catch (err) {
      const errorCode = (err as { code?: number })?.code;
      if (errorCode === 4902) {
        try {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0xaa36a7",
                chainName: "Sepolia",
                nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
                rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              },
            ],
          });
          addToast("info", "Sepolia added", "Please click Switch to Sepolia once more.");
          return;
        } catch (addErr) {
          addToast(
            "error",
            "Could not add Sepolia",
            addErr instanceof Error ? addErr.message : "Unknown wallet error"
          );
          return;
        }
      }
      addToast("error", "Could not switch network", err instanceof Error ? err.message : "Unknown wallet error");
    }
  }

  async function handleCreateProposal() {
    const provider = getInjectedProvider();
    if (!provider) {
      addToast("error", "Wallet not found", "Install MetaMask or another EVM wallet.");
      return;
    }
    if (!DAO_CONTRACT_ADDRESS) {
      addToast(
        "error",
        "Missing DAO contract address",
        "Set NEXT_PUBLIC_DAO_VOTING_CONTRACT_ADDRESS in frontend env."
      );
      return;
    }
    if (!isOnExpectedNetwork) {
      addToast(
        "error",
        "Wrong network",
        `Switch wallet to chain ${EXPECTED_CHAIN_ID} before creating proposals.`
      );
      return;
    }
    if (!isOwner) {
      addToast("error", "Owner required", "Only the DAO contract owner can create proposals.");
      return;
    }
    if (!newProposalId || !newProposalDescription || !newProposalStart || !newProposalEnd) {
      addToast("info", "Missing fields", "Fill proposal id, description, start time, and end time.");
      return;
    }

    const proposalId = Number.parseInt(newProposalId, 10);
    if (!Number.isInteger(proposalId) || proposalId < 0) {
      addToast("error", "Invalid proposal id", "Proposal id must be a non-negative integer.");
      return;
    }

    const startUnix = Math.floor(new Date(newProposalStart).getTime() / 1000);
    const endUnix = Math.floor(new Date(newProposalEnd).getTime() / 1000);
    if (!Number.isFinite(startUnix) || !Number.isFinite(endUnix)) {
      addToast("error", "Invalid time", "Start and end times must be valid.");
      return;
    }
    if (endUnix <= startUnix) {
      addToast("error", "Invalid time window", "End time must be after start time.");
      return;
    }

    setCreatingProposal(true);
    try {
      const browserProvider = new ethers.BrowserProvider(provider);
      const signer = await browserProvider.getSigner();
      const contract = new ethers.Contract(DAO_CONTRACT_ADDRESS, DAO_CONTRACT_ABI, signer);

      const snapshotRoot = ethers.keccak256(ethers.toUtf8Bytes("proposal-1-snapshot"));
      const tx = await contract.createProposal(
        BigInt(proposalId),
        newProposalDescription.trim(),
        snapshotRoot,
        BigInt(startUnix),
        BigInt(endUnix)
      );
      await tx.wait();

      addToast("success", "Proposal created", `Proposal #${proposalId} was created successfully.`);
      setNewProposalId("");
      setNewProposalDescription("");
      setNewProposalStart("");
      setNewProposalEnd("");

      const now = Math.floor(Date.now() / 1000);
      const votingOpen = now >= startUnix && now <= endUnix;
      setProposals((prev) => {
        if (prev.some((p) => p.id === proposalId)) return prev;
        return [
          ...prev,
          {
            id: proposalId,
            description: newProposalDescription.trim(),
            start_time: startUnix,
            end_time: endUnix,
            finalized: false,
            yes_votes: 0,
            no_votes: 0,
            abstain_votes: 0,
            voting_open: votingOpen,
          },
        ].sort((a, b) => a.id - b.id);
      });

      await new Promise((r) => setTimeout(r, 1500));
      try {
        const data = await getDaoProposals();
        setProposals((prev) => {
          const fromBackend = new Set(data.map((p) => p.id));
          const pending = prev.filter((p) => !fromBackend.has(p.id));
          return [...data, ...pending].sort((a, b) => a.id - b.id);
        });
      } catch {
        /* keep optimistic data */
      }
    } catch (err) {
      addToast("error", "Create proposal failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setCreatingProposal(false);
    }
  }

  async function handleVote(proposalId: number, voteChoice: number) {
    if (!isOnExpectedNetwork) {
      addToast("error", "Wrong network", `Switch wallet to chain ${EXPECTED_CHAIN_ID} before voting.`);
      return;
    }
    setConfirmVote(null);
    setVotingFor({ proposalId, choice: voteChoice });
    addToast("info", "Preparing proof", "Generating your zero-knowledge vote proof.");
    try {
      const zkIdentity = localStorage.getItem("shieldlogin_zk_identity");
      if (!zkIdentity) {
        throw new Error("No identity found. Create one first on the Home page.");
      }

      const { commitments } = await getAnonymityGroup();
      if (!commitments || commitments.length < 2) {
        throw new Error("Anonymity set too small. Need at least 2 commitments.");
      }

      const identity = Identity.import(zkIdentity);
      const group = new Group(commitments.map((c: string) => BigInt(c)));
      const inGroup = commitments.some((c: string) => BigInt(c) === identity.commitment);
      if (!inGroup) {
        throw new Error(
          "Your identity is not in the registry. Create a new identity on the Home page."
        );
      }

      const { proof, nullifierHash, merkleTreeRoot } = await generateSemaphoreProofForVote(
        identity,
        group,
        proposalId,
        voteChoice
      );

      const result = await castDaoVote({
        proposal_id: proposalId,
        vote_choice: voteChoice,
        proof,
        nullifier_hash: nullifierHash,
        merkle_tree_root: merkleTreeRoot,
      });

      addToast(
        "success",
        "Vote submitted",
        result.tx_hash ? `On-chain tx: ${result.tx_hash.slice(0, 10)}...` : "Your vote has been recorded."
      );
      await loadProposals();
    } catch (err) {
      addToast("error", "Vote failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setVotingFor(null);
    }
  }

  async function handleFinalizeProposal(proposalId: number) {
    const provider = getInjectedProvider();
    if (!provider) {
      addToast("error", "Wallet not found", "Install MetaMask or another EVM wallet.");
      return;
    }
    if (!DAO_CONTRACT_ADDRESS) {
      addToast(
        "error",
        "Missing DAO contract address",
        "Set NEXT_PUBLIC_DAO_VOTING_CONTRACT_ADDRESS in frontend env."
      );
      return;
    }
    if (!isOnExpectedNetwork) {
      addToast(
        "error",
        "Wrong network",
        `Switch wallet to chain ${EXPECTED_CHAIN_ID} before finalizing proposals.`
      );
      return;
    }
    if (!isOwner) {
      addToast("error", "Owner required", "Only the DAO contract owner can finalize proposals.");
      return;
    }

    setFinalizingProposalId(proposalId);
    try {
      const browserProvider = new ethers.BrowserProvider(provider);
      const signer = await browserProvider.getSigner();
      const contract = new ethers.Contract(DAO_CONTRACT_ADDRESS, DAO_CONTRACT_ABI, signer);
      const tx = await contract.finalizeProposal(BigInt(proposalId));
      await tx.wait();

      addToast("success", "Proposal finalized", `Proposal #${proposalId} was finalized successfully.`);

      setProposals((prev) =>
        prev.map((p) => (p.id === proposalId ? { ...p, finalized: true, voting_open: false } : p))
      );

      await new Promise((r) => setTimeout(r, 1500));
      try {
        const data = await getDaoProposals();
        setProposals(data);
      } catch {
        /* keep optimistic data */
      }
    } catch (err) {
      addToast("error", "Finalize failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setFinalizingProposalId(null);
    }
  }

  function formatTime(ts: number) {
    const date = new Date(ts * 1000);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
  }

  function totalVotes(p: Proposal) {
    return p.yes_votes + p.no_votes + p.abstain_votes;
  }

  function shortAddress(address: string) {
    if (!address) {
      return "Not connected";
    }
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  function getToastStyle(tone: ToastTone) {
    if (tone === "success") {
      return {
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
        box: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
      };
    }
    if (tone === "error") {
      return {
        icon: <AlertCircle className="h-4 w-4 text-red-400" />,
        box: "border-red-500/30 bg-red-500/10 text-red-400",
      };
    }
    return {
      icon: <Info className="h-4 w-4 text-cyan-400" />,
      box: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
    };
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 lg:flex-row">
        <aside className="order-1 glass-card w-full shrink-0 rounded-2xl p-5 lg:order-2 lg:w-[320px]">
          <div className="mb-4 flex items-center gap-2">
            <UserRoundCog className="h-5 w-5 text-cyan-400" />
            <h2 className="text-lg font-semibold text-slate-100">Admin Panel</h2>
          </div>

          <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Connected</span>
              <span className="font-mono text-slate-300">{shortAddress(connectedAccount)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Owner</span>
              <span className="font-mono text-slate-300">{ownerAddress ? shortAddress(ownerAddress) : "Unknown"}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Chain ID</span>
              <span className="font-mono text-slate-300">{walletChainId || "Unknown"}</span>
            </div>
          </div>

          {connectedAccount && walletChainId && !isOnExpectedNetwork && (
            <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-400">
              <p className="mb-2">
                Connected to chain {walletChainId}. This app requires chain {EXPECTED_CHAIN_ID}.
              </p>
              <button
                onClick={switchToExpectedNetwork}
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-amber-400"
              >
                Switch to Sepolia
              </button>
            </div>
          )}

          {ownerLookupError && (
            <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
              {ownerLookupError}
            </p>
          )}

          {!connectedAccount && (
            <button
              onClick={connectWallet}
              disabled={walletLoading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-medium text-slate-900 shadow-lg shadow-cyan-500/25 transition-all hover:bg-cyan-400 disabled:opacity-60"
            >
              {walletLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              {walletLoading ? "Connecting..." : "Connect Wallet"}
            </button>
          )}

          {connectedAccount && !isOwner && (
            <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
              You are connected as a voter. Only owner can create proposals.
            </p>
          )}

          {connectedAccount && isOwner && (
            <div className="mt-4 space-y-3">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Create Proposal</p>
              <input
                type="number"
                min={0}
                value={newProposalId}
                onChange={(e) => setNewProposalId(e.target.value)}
                placeholder="Proposal ID"
                className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
              <textarea
                value={newProposalDescription}
                onChange={(e) => setNewProposalDescription(e.target.value)}
                placeholder="Proposal description"
                rows={3}
                className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
              <div>
                <label htmlFor="proposal-start" className="mb-1 block text-xs text-slate-500">Start Time</label>
                <input
                  id="proposal-start"
                  type="datetime-local"
                  value={newProposalStart}
                  onChange={(e) => setNewProposalStart(e.target.value)}
                  className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label htmlFor="proposal-end" className="mb-1 block text-xs text-slate-500">End Time</label>
                <input
                  id="proposal-end"
                  type="datetime-local"
                  value={newProposalEnd}
                  onChange={(e) => setNewProposalEnd(e.target.value)}
                  className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
              <button
                onClick={handleCreateProposal}
                disabled={creatingProposal}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-medium text-slate-900 shadow-lg shadow-emerald-500/25 transition-all hover:bg-emerald-400 disabled:opacity-60"
              >
                {creatingProposal ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                {creatingProposal ? "Creating..." : "Create Proposal"}
              </button>
            </div>
          )}
        </aside>

        <section className="order-2 min-w-0 flex-1 lg:order-1">
          <div className="glass-card mb-6 flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Image src="/lantra-logo.svg" alt="Lantra" width={44} height={44} className="rounded-xl" />
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-100">DAO Voting</h1>
                <p className="text-sm text-slate-400">Private voting with zero-knowledge membership proofs</p>
              </div>
            </div>
            <button
              onClick={() => loadProposals()}
              disabled={loading}
              className="flex items-center gap-2 self-start rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-100 disabled:opacity-60 sm:self-auto"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {loading && (
            <div className="space-y-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card animate-pulse rounded-2xl p-6">
                  <div className="mb-3 h-5 w-40 rounded bg-white/10" />
                  <div className="mb-3 h-4 w-full rounded bg-white/5" />
                  <div className="mb-4 h-4 w-3/4 rounded bg-white/5" />
                  <div className="h-2 w-full rounded bg-white/5" />
                </div>
              ))}
            </div>
          )}

          {!loading && proposals.length === 0 && (
            <div className="glass-card rounded-2xl border-2 border-dashed border-white/10 p-12 text-center">
              <Vote className="mx-auto mb-4 h-12 w-12 text-slate-500" />
              <h3 className="mb-2 text-lg font-semibold text-slate-300">No proposals yet</h3>
              <p className="text-sm text-slate-500">Create one from the admin panel to start DAO voting.</p>
            </div>
          )}

          {!loading &&
            proposals.map((proposal) => {
              const total = totalVotes(proposal);
              const yesPct = total > 0 ? (proposal.yes_votes / total) * 100 : 0;
              const noPct = total > 0 ? (proposal.no_votes / total) * 100 : 0;
              const abstainPct = total > 0 ? (proposal.abstain_votes / total) * 100 : 0;

              return (
                <article
                  key={proposal.id}
                  className="glass-card mb-6 overflow-hidden rounded-2xl transition-all hover:border-cyan-500/20"
                >
                  <div className="p-6">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Proposal #{proposal.id}
                        </p>
                        <h2 className="text-lg font-semibold text-slate-100">{proposal.description}</h2>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                          proposal.finalized
                            ? "bg-slate-500/30 text-slate-400"
                            : proposal.voting_open
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-amber-500/20 text-amber-400"
                        }`}
                      >
                        <Clock3 className="h-3.5 w-3.5" />
                        {proposal.finalized ? "Finalized" : proposal.voting_open ? "Voting Open" : "Closed"}
                      </span>
                    </div>

                    <p className="mb-4 text-xs text-slate-500">
                      {formatTime(proposal.start_time)} to {formatTime(proposal.end_time)}
                    </p>

                    <div className="mb-4">
                      <div className="mb-2 flex h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="bg-emerald-500 transition-all" style={{ width: `${yesPct}%` }} />
                        <div className="bg-rose-500 transition-all" style={{ width: `${noPct}%` }} />
                        <div className="bg-slate-400 transition-all" style={{ width: `${abstainPct}%` }} />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="rounded-lg bg-emerald-500/20 px-3 py-2 text-emerald-400">Yes: {proposal.yes_votes}</div>
                        <div className="rounded-lg bg-rose-500/20 px-3 py-2 text-rose-400">No: {proposal.no_votes}</div>
                        <div className="rounded-lg bg-white/10 px-3 py-2 text-slate-400">Abstain: {proposal.abstain_votes}</div>
                      </div>
                    </div>

                    {proposal.voting_open && (
                      <div className="flex flex-wrap gap-2">
                        {([0, 1, 2] as const).map((choice) => (
                          <button
                            key={choice}
                            onClick={() => setConfirmVote({ proposalId: proposal.id, choice })}
                            disabled={!!votingFor}
                            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 ${
                              choice === 0
                                ? "bg-emerald-500/80 text-slate-900 hover:bg-emerald-500"
                                : choice === 1
                                  ? "bg-rose-500/80 text-white hover:bg-rose-500"
                                  : "border border-white/20 text-slate-400 hover:bg-white/5 hover:text-slate-200"
                            }`}
                          >
                            {votingFor?.proposalId === proposal.id && votingFor?.choice === choice ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : choice === 0 ? (
                              <ThumbsUp className="h-4 w-4" />
                            ) : choice === 1 ? (
                              <ThumbsDown className="h-4 w-4" />
                            ) : (
                              <Minus className="h-4 w-4" />
                            )}
                            {VOTE_LABELS[choice]}
                          </button>
                        ))}
                      </div>
                    )}

                    {isOwner && (
                      <div className="mt-4 border-t border-white/10 pt-4">
                        <button
                          onClick={() => handleFinalizeProposal(proposal.id)}
                          disabled={
                            finalizingProposalId === proposal.id ||
                            proposal.voting_open ||
                            proposal.finalized
                          }
                          className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-medium text-slate-900 shadow-lg shadow-cyan-500/25 transition-all hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {finalizingProposalId === proposal.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          {finalizingProposalId === proposal.id ? "Finalizing..." : "Finalize Proposal"}
                        </button>
                        {proposal.finalized && (
                          <p className="mt-2 text-xs text-slate-500">Already finalized.</p>
                        )}
                        {proposal.voting_open && !proposal.finalized && (
                          <p className="mt-2 text-xs text-slate-500">
                            Finalization unlocks after voting period closes.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
        </section>
      </div>

      {toasts.length > 0 && (
        <div className="fixed right-4 top-20 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
          {toasts.map((toast) => {
            const style = getToastStyle(toast.tone);
            return (
              <div key={toast.id} className={`rounded-xl border p-3 shadow-xl backdrop-blur-md ${style.box}`}>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5">{style.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{toast.title}</p>
                    {toast.description && <p className="mt-0.5 text-xs opacity-90">{toast.description}</p>}
                  </div>
                  <button
                    onClick={() => removeToast(toast.id)}
                    className="rounded p-1 text-current/70 hover:bg-white/10"
                    aria-label="Dismiss toast"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmVote && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setConfirmVote(null)}
        >
          <div
            className="glass-card w-full max-w-sm rounded-2xl p-6 shadow-2xl shadow-cyan-500/5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-lg font-semibold text-slate-100">Confirm Vote</h3>
            <p className="mb-5 text-sm text-slate-400">
              Vote <strong className="text-cyan-400">{VOTE_LABELS[confirmVote.choice]}</strong> on proposal #{confirmVote.proposalId}. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmVote(null)}
                className="flex-1 rounded-xl border border-white/20 py-2.5 font-medium text-slate-300 transition-colors hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={() => handleVote(confirmVote.proposalId, confirmVote.choice)}
                className="flex-1 rounded-xl bg-cyan-500 py-2.5 font-medium text-slate-900 shadow-lg shadow-cyan-500/25 transition-all hover:bg-cyan-400"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
