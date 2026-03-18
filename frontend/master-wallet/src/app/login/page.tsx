"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [spId, setSpId] = useState(
    () =>
      (typeof window !== "undefined" ? window.location.origin : null) ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000"
  );

  useEffect(() => {
    if (typeof window !== "undefined") setSpId(window.location.origin);
  }, []);
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
      sessionStorage.setItem("lantra_authenticated", "true");
      window.dispatchEvent(new Event("lantra:authenticated"));
      setStatus("success");
      setMessage("Registered with Lantra! Redirecting to DAO...");
      router.push("/dao");
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
      sessionStorage.setItem("lantra_authenticated", "true");
      window.dispatchEvent(new Event("lantra:authenticated"));
      setStatus("success");
      setMessage("Successfully authenticated! Redirecting to DAO...");
      router.push("/dao");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-12 sm:p-8">
      <div className="glass-card w-full max-w-md rounded-2xl p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <Image
            src="/lantra-logo.svg"
            alt="Lantra"
            width={48}
            height={48}
            className="rounded-xl"
          />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">Login to Lantra</h1>
            <p className="text-sm text-slate-400">Authenticate to access DAO voting</p>
          </div>
        </div>

        <div className="mb-6 glow-accent rounded-lg">
          <label htmlFor="sp-id" className="mb-2 block text-sm font-medium text-slate-400">
            Lantra URL (SP)
          </label>
          <input
            id="sp-id"
            type="text"
            value={spId}
            onChange={(e) => setSpId(e.target.value)}
            placeholder="https://demo.example.com"
            className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        {status === "idle" && (
          <div className="space-y-3">
            <button
              onClick={handleRegister}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-cyan-500/60 px-4 py-3 font-medium text-cyan-400 transition-all hover:border-cyan-400 hover:bg-cyan-500/10"
            >
              <UserPlus className="h-5 w-5" />
              Register with SP (first time)
            </button>
            <button
              onClick={handleLogin}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 font-medium text-slate-900 shadow-lg shadow-cyan-500/25 transition-all hover:bg-cyan-400 hover:shadow-cyan-400/30"
            >
              <LogIn className="h-5 w-5" />
              Login (subsequent visits)
            </button>
          </div>
        )}

        {status === "loading" && (
          <div className="flex items-center justify-center gap-2 py-4 text-slate-400">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
            Processing...
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-400">{message}</div>
            <a
              href="/dao"
              className="block w-full rounded-lg bg-cyan-500 px-4 py-3 text-center font-medium text-slate-900 shadow-lg shadow-cyan-500/25 transition-all hover:bg-cyan-400"
            >
              Go to DAO →
            </a>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">{message}</div>
            <button
              onClick={() => setStatus("idle")}
              className="w-full rounded-lg border border-white/20 px-4 py-3 font-medium text-slate-300 transition-colors hover:bg-white/5"
            >
              Try Again
            </button>
          </div>
        )}

        <div className="mt-6 flex justify-center gap-4 text-sm text-slate-500">
          <a href="/dao" className="flex items-center gap-1 text-cyan-400 transition-colors hover:text-cyan-300">
            <Vote className="h-4 w-4" />
            DAO Voting
          </a>
          <a href="/" className="text-cyan-400 transition-colors hover:text-cyan-300">
            ← Home
          </a>
        </div>
      </div>
    </div>
  );
}