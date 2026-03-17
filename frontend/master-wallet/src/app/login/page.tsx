"use client";

import { useState } from "react";
import Image from "next/image";
import { LogIn, UserPlus, Vote } from "lucide-react";
import { Identity } from "@semaphore-protocol/identity";
import { Group } from "@semaphore-protocol/group";
import {
  getPseudonymWithSeed,
  signWithSeed,
  generateSemaphoreProof,
} from "@shieldlogin/crypto";
import { registerWithSp, getAnonymityGroup, getAuthChallenge, authenticate } from "@/lib/api";

export default function LoginPage() {
  const [spId, setSpId] = useState("https://demo.example.com");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleRegister() {
    setStatus("loading");
    setMessage("");
    try {
      const zkIdentity = localStorage.getItem("shieldlogin_zk_identity");
      const r = localStorage.getItem("shieldlogin_r");
      if (!zkIdentity || !r) {
        throw new Error("No identity found. Create one first.");
      }

      
      const identity = Identity.import(zkIdentity);
      const { commitments } = await getAnonymityGroup();
      if (!commitments || commitments.length < 2) {
        throw new Error("Anonymity set too small. Need at least 2 commitments. Create another identity first.");
      }

      const group = new Group(commitments.map((c: string) => BigInt(c)));
      const inGroup = commitments.some((c: string) => BigInt(c) === identity.commitment);
      if (!inGroup) {
        throw new Error(
          "Your identity is not in the registry. Clear localStorage and create a new identity (Home → Create Identity)."
        );
      }

      const { proof, nullifierHash, merkleTreeRoot } = await generateSemaphoreProof(identity, group, spId);
      const { pseudonym } = await getPseudonymWithSeed(r, spId);

      await registerWithSp({
        sp_id: spId,
        pseudonym,
        nullifier_hash: nullifierHash,
        proof,
        merkle_tree_root: merkleTreeRoot,
      });
      setStatus("success");
      setMessage("Registered with SP successfully! You can now use Login for future visits.");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Registration failed");
    }
  }

  async function handleLogin() {
    setStatus("loading");
    setMessage("");
    try {
      const r = localStorage.getItem("shieldlogin_r");
      if (!r) {
        throw new Error("No identity found. Create one first.");
      }

      const { pseudonym, cskl } = await getPseudonymWithSeed(r, spId);
      const auth = await getAuthChallenge(spId, pseudonym);
      const signature = await signWithSeed(cskl, auth.challenge);

      await authenticate({
        sp_id: spId,
        pseudonym,
        challenge: auth.challenge,
        signature,
      });
      setStatus("success");
      setMessage("Successfully authenticated!");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center bg-slate-50/50 px-4 py-12 sm:p-8">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <Image
            src="/lantra-logo.png"
            alt="Lantra"
            width={48}
            height={48}
            className="rounded-xl"
          />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Login to Site</h1>
            <p className="text-sm text-slate-500">Anonymous authentication with Lantra</p>
          </div>
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Service Provider URL
          </label>
          <input
            type="text"
            value={spId}
            onChange={(e) => setSpId(e.target.value)}
            placeholder="https://demo.example.com"
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-black focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {status === "idle" && (
          <div className="space-y-3">
            <button
              onClick={handleRegister}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-indigo-600 px-4 py-3 font-medium text-indigo-600 transition-colors hover:bg-indigo-50"
            >
              <UserPlus className="h-5 w-5" />
              Register with SP (first time)
            </button>
            <button
              onClick={handleLogin}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
            >
              <LogIn className="h-5 w-5" />
              Login (subsequent visits)
            </button>
          </div>
        )}

        {status === "loading" && (
          <div className="flex items-center justify-center gap-2 py-4 text-slate-600">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            Processing...
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 p-4 text-green-800">{message}</div>
            <button
              onClick={() => setStatus("idle")}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 font-medium text-slate-700 hover:bg-slate-50"
            >
              Try Again
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="rounded-lg bg-red-50 p-4 text-red-800">{message}</div>
            <button
              onClick={() => setStatus("idle")}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 font-medium text-slate-700 hover:bg-slate-50"
            >
              Try Again
            </button>
          </div>
        )}

        <div className="mt-6 flex justify-center gap-4 text-sm text-slate-500">
          <a href="/dao" className="flex items-center gap-1 text-indigo-600 transition-colors hover:text-indigo-700">
            <Vote className="h-4 w-4" />
            DAO Voting
          </a>
          <a href="/" className="text-indigo-600 transition-colors hover:text-indigo-700">
            ← Home
          </a>
        </div>
      </div>
    </div>
  );
}