"use client";

import { useState, useEffect } from "react";
import { Shield, Key, CheckCircle } from "lucide-react";
import { commitmentFromSecret } from "@shieldlogin/crypto";
import { registerCommitment } from "@/lib/api";

export default function Home() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (localStorage.getItem("shieldlogin_msk")) {
      setStatus("success");
      setMessage("You already have an identity. Login to a site below.");
    }
  }, []);

  async function handleRegister() {
    setStatus("loading");
    setMessage("");
    try {
      const msk = crypto.getRandomValues(new Uint8Array(32));
      const mskHex = Array.from(msk)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const commitment = await commitmentFromSecret(mskHex);
      await registerCommitment(commitment);
      localStorage.setItem("shieldlogin_msk", mskHex);
      localStorage.setItem("shieldlogin_commitment", commitment);
      setStatus("success");
      setMessage("Identity created and registered successfully!");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Registration failed");
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
          Create your anonymous identity. Your master secret stays on your device.
        </p>

        {status === "idle" && (
          <button
            onClick={handleRegister}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white transition-colors hover:bg-indigo-700"
          >
            <Key className="h-5 w-5" />
            Create Identity
          </button>
        )}

        {status === "loading" && (
          <div className="flex items-center justify-center gap-2 py-4 text-slate-600">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            Registering...
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
              className="flex w-full items-center justify-center rounded-lg border border-indigo-600 px-4 py-3 font-medium text-indigo-600 transition-colors hover:bg-indigo-50"
            >
              Login to a Site
            </a>
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
