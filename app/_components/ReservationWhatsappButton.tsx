"use client";

import { useEffect, useRef, useState } from "react";
import { copyTextToClipboard } from "@/lib/client-clipboard";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function WhatsAppIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M19.1 4.9A9.8 9.8 0 0 0 3.7 16.7L3 21l4.4-1.1A9.8 9.8 0 0 0 21.8 12a9.7 9.7 0 0 0-2.7-7.1Z"
        fill="currentColor"
        opacity="0.18"
      />
      <path
        d="M12 4.2a7.8 7.8 0 0 1 6.6 12L18.3 17l.1.9-.9-.1-.8.3A7.8 7.8 0 0 1 5.9 7.4 7.8 7.8 0 0 1 12 4.2Zm0-1.8a9.6 9.6 0 0 0-8.4 14.2L2.8 21.2l4.7-1.2A9.6 9.6 0 1 0 12 2.4Z"
        fill="currentColor"
      />
      <path
        d="M9.2 7.8c-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.4-.2.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.8 2.9 4.5 3.9 2.2.9 2.7.7 3.2.6.5-.1 1.6-.7 1.8-1.3.2-.6.2-1.2.2-1.3-.1-.1-.2-.2-.5-.4l-1.6-.8c-.2-.1-.4-.1-.6.1-.2.3-.7.8-.8 1-.2.2-.3.2-.6.1-.3-.1-1.1-.4-2.1-1.3-.8-.7-1.3-1.5-1.5-1.8-.2-.3 0-.4.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2.1-.4 0-.5l-.7-1.6Z"
        fill="currentColor"
      />
    </svg>
  );
}

type ReservationWhatsappButtonProps = {
  message: string;
  onCopyStart?: () => void;
  onCopyError?: (message: string) => void;
  className?: string;
};

export function ReservationWhatsappButton({
  message,
  onCopyStart,
  onCopyError,
  className,
}: ReservationWhatsappButtonProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  function showCopied() {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }

    setCopied(true);
    timeoutRef.current = window.setTimeout(() => {
      setCopied(false);
      timeoutRef.current = null;
    }, 2000);
  }

  function handleClick() {
    onCopyStart?.();

    void copyTextToClipboard(message)
      .then((ok) => {
        if (!ok) {
          onCopyError?.("No se ha podido copiar el mensaje.");
          return;
        }

        showCopied();
      })
      .catch(() => {
        onCopyError?.("No se ha podido copiar el mensaje.");
      });
  }

  return (
    <a
      href={buildWhatsAppUrl(message)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={classNames(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border text-[#0f5e2e] shadow-sm transition active:scale-[0.99]",
        copied
          ? "border-green-300 bg-green-100"
          : "border-green-200 bg-green-50 hover:bg-green-100",
        className
      )}
      aria-label={
        copied
          ? "Mensaje copiado. Abrir WhatsApp"
          : "Copiar mensaje y abrir WhatsApp"
      }
      title={copied ? "Mensaje copiado" : "WhatsApp"}
    >
      <WhatsAppIcon className="h-5 w-5" />
    </a>
  );
}
