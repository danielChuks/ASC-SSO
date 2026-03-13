"use client";

import { useState, useEffect } from "react";
import { Shield, Key, CheckCircle, LogIn } from "lucide-react";
import { Identity } from "@semaphore-protocol/identity";
import { bytesToHex } from "@shieldlogin/crypto";
import { registerCommitment } from "@/lib/api";

export default function Home() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (localStorage.getItem("shieldlogin_zk_identity")) {
      setStatus("success");
      setMessage("You already have an identity. Login to a site below.");
    }
  }, []);

  async function handleCreate() {
    setStatus("loading");
    setMessage("");
    try {
      const identity = new Identity();
      const seedIdentity = new Identity("shieldlogin-bootstrap-seed-v1");
      await registerCommitment(identity.commitment.toString());
      await registerCommitment(seedIdentity.commitment.toString());

      const r = crypto.getRandomValues(new Uint8Array(32));
      const rHex = bytesToHex(r);

      localStorage.setItem("shieldlogin_zk_identity", identity.export());
      localStorage.setItem("shieldlogin_zk_commitment", identity.commitment.toString());
      localStorage.setItem("shieldlogin_r", rHex);

      setStatus("success");
      setMessage("Identity created and registered successfully!");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-8">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <Shield className="h-10 w-10 text-indigo-600" />
          <h1 className="text-2xl font-bold text-slate-900">ShieldLogin</h1>
        </div>
        <p className="mb-6 text-slate-600">
          Create your anonymous identity with zero-knowledge proofs. Your master secret stays on your device.
        </p>

        {status === "idle" && (
          <button
            onClick={handleCreate}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white transition-colors hover:bg-indigo-700"
          >
            <Key className="h-5 w-5" />
            Create Identity
          </button>
        )}

        {status === "loading" && (
          <div className="flex items-center justify-center gap-2 py-4 text-slate-600">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            Creating...
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 rounded-lg bg-green-50 p-4 text-green-800">
              <CheckCircle className="h-5 w-5 flex-shrink-0" />
              <span>{message}</span>
            </div>
            <a
              href="/login"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700"
            >
              <LogIn className="h-5 w-5" />
              Login to a Site
            </a>
            <button
              onClick={() => {
                setStatus("idle");
                setMessage("");
              }}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Create new identity (replaces current)
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
      </div>
    </div>
  );
}
