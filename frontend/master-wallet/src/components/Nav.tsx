"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { LogIn, Vote, Home, LogOut } from "lucide-react";

export default function Nav() {
  const [hasIdentity, setHasIdentity] = useState(false);

  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const check = () => {
      setHasIdentity(!!localStorage.getItem("shieldlogin_zk_identity"));
      setIsAuthenticated(!!sessionStorage.getItem("lantra_authenticated"));
    };
    check();
    window.addEventListener("lantra:identity-changed", check);
    window.addEventListener("lantra:authenticated", check);
    return () => {
      window.removeEventListener("lantra:identity-changed", check);
      window.removeEventListener("lantra:authenticated", check);
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm">
      <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-slate-900 transition-colors hover:text-indigo-600"
        >
          <Image
            src="/lantra-logo.svg"
            alt="Lantra"
            width={32}
            height={32}
            className="rounded-lg"
          />
          <span className="hidden sm:inline">Lantra</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">Home</span>
          </Link>
          {hasIdentity && !isAuthenticated && (
            <Link
              href="/login"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">Login</span>
            </Link>
          )}
          {isAuthenticated && (
            <>
              <Link
                href="/dao"
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <Vote className="h-4 w-4" />
                <span className="hidden sm:inline">DAO</span>
              </Link>
              <button
                onClick={() => {
                  sessionStorage.removeItem("lantra_authenticated");
                  window.dispatchEvent(new Event("lantra:authenticated"));
                  window.location.href = "/";
                }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
