"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Vote, ThumbsUp, ThumbsDown, Minus, Loader2, RefreshCw, X } from "lucide-react";
import { Identity } from "@semaphore-protocol/identity";
import { Group } from "@semaphore-protocol/group";
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

export default function DaoPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [votingFor, setVotingFor] = useState<{ proposalId: number; choice: number } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmVote, setConfirmVote] = useState<{ proposalId: number; choice: number } | null>(null);

  useEffect(() => {
    loadProposals();
  }, []);

  async function loadProposals() {
    setLoading(true);
    setError("");
    try {
      const data = await getDaoProposals();
      setProposals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load proposals");
    } finally {
      setLoading(false);
    }
  }

  async function handleVote(proposalId: number, voteChoice: number) {
    setConfirmVote(null);
    setVotingFor({ proposalId, choice: voteChoice });
    setError("");
    setSuccess(null);
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

      setSuccess(result.tx_hash ? `Vote cast! Tx: ${result.tx_hash.slice(0, 10)}...` : "Vote cast!");
      await loadProposals();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vote failed");
    } finally {
      setVotingFor(null);
    }
  }

  function formatTime(ts: number) {
    const date = new Date(ts * 1000);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
  }

  function totalVotes(p: Proposal) {
    return p.yes_votes + p.no_votes + p.abstain_votes;
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center bg-slate-50/50 px-4 py-8 sm:px-6">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/lantra-logo.png"
              alt="Lantra"
              width={48}
              height={48}
              className="rounded-xl"
            />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">DAO Voting</h1>
              <p className="text-sm text-slate-500">Vote anonymously with zero-knowledge proofs</p>
            </div>
          </div>
          {!loading && (
            <button
              onClick={() => loadProposals()}
              className="flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 sm:self-auto"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          )}
        </div>

        {loading && (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border border-slate-200 bg-white p-6"
              >
                <div className="mb-3 h-5 w-32 rounded bg-slate-200" />
                <div className="mb-4 h-4 w-full rounded bg-slate-100" />
                <div className="mb-4 h-4 w-3/4 rounded bg-slate-100" />
                <div className="flex gap-4">
                  <div className="h-4 w-16 rounded bg-slate-100" />
                  <div className="h-4 w-16 rounded bg-slate-100" />
                  <div className="h-4 w-16 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-red-800">{error}</p>
            <button
              onClick={() => setError("")}
              className="shrink-0 rounded p-1 text-red-600 hover:bg-red-100"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="text-green-800">{success}</p>
            <button
              onClick={() => setSuccess(null)}
              className="shrink-0 rounded p-1 text-green-600 hover:bg-green-100"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {!loading && proposals.length === 0 && !error && (
          <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
            <Vote className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <h3 className="mb-2 font-semibold text-slate-700">No proposals yet</h3>
            <p className="text-sm text-slate-500">
              Deploy the DAO contract and create a proposal to get started.
            </p>
          </div>
        )}

        {!loading &&
          proposals.map((p) => {
            const total = totalVotes(p);
            const yesPct = total > 0 ? (p.yes_votes / total) * 100 : 0;
            const noPct = total > 0 ? (p.no_votes / total) * 100 : 0;
            const abstainPct = total > 0 ? (p.abstain_votes / total) * 100 : 0;

            return (
              <div
                key={p.id}
                className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="p-6">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold text-slate-900">Proposal #{p.id}</h2>
                      <p className="mt-1 text-slate-600">{p.description}</p>
                    </div>
                    <span
                      className={`shrink-0 self-start rounded-full px-3 py-1 text-xs font-medium sm:self-center ${
                        p.finalized
                          ? "bg-slate-200 text-slate-600"
                          : p.voting_open
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {p.finalized ? "Finalized" : p.voting_open ? "Open" : "Closed"}
                    </span>
                  </div>

                  <div className="mb-4 text-xs text-slate-500">
                    {formatTime(p.start_time)} – {formatTime(p.end_time)}
                  </div>

                  <div className="mb-4">
                    <div className="mb-2 flex h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="bg-emerald-500 transition-all"
                        style={{ width: `${yesPct}%` }}
                      />
                      <div
                        className="bg-red-500 transition-all"
                        style={{ width: `${noPct}%` }}
                      />
                      <div
                        className="bg-slate-400 transition-all"
                        style={{ width: `${abstainPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-emerald-600">Yes: {p.yes_votes}</span>
                      <span className="text-red-600">No: {p.no_votes}</span>
                      <span className="text-slate-500">Abstain: {p.abstain_votes}</span>
                    </div>
                  </div>

                  {p.voting_open && (
                    <div className="flex flex-wrap gap-2">
                      {([0, 1, 2] as const).map((choice) => (
                        <button
                          key={choice}
                          onClick={() => setConfirmVote({ proposalId: p.id, choice })}
                          disabled={!!votingFor}
                          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50 ${
                            choice === 0
                              ? "bg-emerald-600 text-white hover:bg-emerald-700"
                              : choice === 1
                                ? "bg-red-600 text-white hover:bg-red-700"
                                : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {votingFor?.proposalId === p.id && votingFor?.choice === choice ? (
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
                </div>
              </div>
            );
          })}

        {confirmVote && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setConfirmVote(null)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-2 font-semibold text-slate-900">Confirm your vote</h3>
              <p className="mb-6 text-sm text-slate-600">
                Vote <strong>{VOTE_LABELS[confirmVote.choice]}</strong> on Proposal #
                {confirmVote.proposalId}? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmVote(null)}
                  className="flex-1 rounded-lg border border-slate-300 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleVote(confirmVote.proposalId, confirmVote.choice)}
                  className="flex-1 rounded-lg bg-indigo-600 py-2.5 font-medium text-white hover:bg-indigo-700"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
