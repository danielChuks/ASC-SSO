"use client";

import { useState } from "react";
import { Shield, LogIn } from "lucide-react";
import { deriveNullifier, createProof } from "@shieldlogin/crypto";
import { getNonce, verifyCredential } from "@/lib/api";

export default function LoginPage() {
  const [spId, setSpId] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleLogin() {
    setStatus("loading");
    setMessage("");
    try {
      const msk = localStorage.getItem("shieldlogin_msk");
      const commitment = localStorage.getItem("shieldlogin_commitment");
      if (!msk || !commitment) {
        throw new Error("No identity found. Create one first.");
      }

      const { nonce } = await getNonce(spId);
      const nullifier = await deriveNullifier(msk, spId);
      const proof = await createProof(msk, spId, nonce);

      await verifyCredential({ sp_id: spId, nonce, proof, nullifier, commitment });
      setStatus("success");
      setMessage("Successfully authenticated!");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-8">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <Shield className="h-10 w-10 text-indigo-600" />
          <h1 className="text-2xl font-bold text-slate-900">Login to Site</h1>
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
            className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-black"
          />
        </div>

        {status === "idle" && (
          <button
            onClick={handleLogin}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white transition-colors hover:bg-indigo-700"
          >
            <LogIn className="h-5 w-5" />
            Login
          </button>
        )}

        {status === "loading" && (
          <div className="flex items-center justify-center gap-2 py-4 text-slate-600">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            Authenticating...
          </div>
        )}

        {status === "success" && (
          <div className="rounded-lg bg-green-50 p-4 text-green-800">{message}</div>
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

        <a
          href="/"
          className="mt-6 block text-center text-sm text-indigo-600 hover:underline"
        >
          ← Back to Dashboard
        </a>
      </div>
    </div>
  );
}
