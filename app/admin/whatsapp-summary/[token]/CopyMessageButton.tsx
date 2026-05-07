"use client";

import { useState } from "react";
import { WhatsAppShareButton } from "@/app/_components/WhatsAppShareButton";

export default function CopyMessageButton({ text }: { text: string }) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <WhatsAppShareButton
        message={text}
        onCopyStart={() => setCopyMessage(null)}
        onCopyError={setCopyMessage}
        className="inline-flex rounded-full bg-[#0f5e2e] px-5 py-3 font-semibold text-white shadow-sm transition hover:brightness-95 active:scale-[0.99]"
        copiedClassName="bg-green-700"
        copiedChildren="Copiado. Abriendo WhatsApp"
      >
        Copiar y abrir WhatsApp
      </WhatsAppShareButton>

      {copyMessage ? (
        <p className="text-sm font-medium text-yellow-800">{copyMessage}</p>
      ) : null}
    </div>
  );
}
