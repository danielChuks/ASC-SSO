"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Key, CheckCircle, LogIn } from "lucide-react";
import { Identity } from "@semaphore-protocol/identity";
import { bytesToHex } from "@shieldlogin/crypto";
import { registerCommitment } from "@/lib/api";

export default function Home() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (localStorage.getItem("shieldlogin_zk_identity")) {
      setStatus("success");
      setMessage("You already have an identity. Login to Lantra to access DAO voting.");
    }
  }, []);

  async function handleCreate() {
    setStatus("loading");
    setMessage("");
    try {
      const identity = new Identity();
      //const seedIdentity = new Identity("shieldlogin-bootstrap-seed-v1");
      const seedBuffer=crypto.getRandomValues(new Uint8Array(32));
      const seedHex = bytesToHex(seedBuffer);
      const seedIdentity = new Identity(seedHex);
      await registerCommitment(identity.commitment.toString());
      await registerCommitment(seedIdentity.commitment.toString());

      const r = crypto.getRandomValues(new Uint8Array(32));
      const rHex = bytesToHex(r);

      
      localStorage.setItem("shieldlogin_zk_identity", identity.export());
      localStorage.setItem("shieldlogin_zk_commitment", identity.commitment.toString());
      localStorage.setItem("shieldlogin_r", rHex);
      localStorage.setItem("shieldlogin_seed", seedHex);

      setStatus("success");
      setMessage("Identity created and registered successfully!");
      window.dispatchEvent(new Event("lantra:identity-changed"));
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Failed");
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
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">Lantra</h1>
            <p className="text-sm text-slate-400">Anonymous identity & DAO voting</p>
          </div>
        </div>
        <p className="mb-6 text-slate-400">
          Create your anonymous identity with zero-knowledge proofs. Your master secret stays on your device.
        </p>

        {status === "idle" && (
          <button
            onClick={handleCreate}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 font-medium text-slate-900 shadow-lg shadow-cyan-500/25 transition-all hover:bg-cyan-400 hover:shadow-cyan-400/30"
          >
            <Key className="h-5 w-5" />
            Create Identity
          </button>
        )}

        {status === "loading" && (
          <div className="flex items-center justify-center gap-2 py-4 text-slate-400">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
            Creating...
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-400">
              <CheckCircle className="h-5 w-5 flex-shrink-0" />
              <span>{message}</span>
            </div>
            <a
              href="/login"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 font-medium text-slate-900 shadow-lg shadow-cyan-500/25 transition-all hover:bg-cyan-400 hover:shadow-cyan-400/30"
            >
              <LogIn className="h-5 w-5" />
              Login to Lantra
            </a>
            <button
              onClick={() => {
                setStatus("idle");
                setMessage("");
              }}
              className="text-sm text-slate-500 hover:text-slate-300"
            >
              Create new identity (replaces current)
            </button>
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
      </div>
    </div>
  );
}