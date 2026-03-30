"use client";

import { useState } from "react";

export default function CopyMessageButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("No se ha podido copiar automáticamente.");
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-full bg-[#0f5e2e] px-5 py-3 font-semibold text-white shadow-sm transition hover:brightness-95 active:scale-[0.99]"
    >
      {copied ? "Copiado" : "Copiar mensaje"}
    </button>
  );
}