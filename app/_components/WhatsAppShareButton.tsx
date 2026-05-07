"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { copyTextToClipboard } from "@/lib/client-clipboard";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type WhatsAppShareButtonProps = {
  message: string;
  children: React.ReactNode;
  copiedChildren?: React.ReactNode;
  className?: string;
  copiedClassName?: string;
  ariaLabel?: string;
  copiedAriaLabel?: string;
  title?: string;
  copiedTitle?: string;
  onCopyStart?: () => void;
  onCopyError?: (message: string) => void;
};

export function WhatsAppShareButton({
  message,
  children,
  copiedChildren,
  className,
  copiedClassName,
  ariaLabel = "Copiar mensaje y abrir WhatsApp",
  copiedAriaLabel = "Mensaje copiado. Abrir WhatsApp",
  title = "WhatsApp",
  copiedTitle = "Mensaje copiado",
  onCopyStart,
  onCopyError,
}: WhatsAppShareButtonProps) {
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

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    onCopyStart?.();

    void copyTextToClipboard(message)
      .then((ok) => {
        if (!ok) {
          onCopyError?.(
            "No se ha podido copiar automaticamente, pero WhatsApp se abrira con el mensaje."
          );
          return;
        }

        showCopied();
      })
      .catch(() => {
        onCopyError?.(
          "No se ha podido copiar automaticamente, pero WhatsApp se abrira con el mensaje."
        );
      })
      .finally(() => {
        window.location.href = buildWhatsAppUrl(message);
      });
  }

  return (
    <a
      href={buildWhatsAppUrl(message)}
      onClick={handleClick}
      className={classNames(className, copied && copiedClassName)}
      aria-label={copied ? copiedAriaLabel : ariaLabel}
      title={copied ? copiedTitle : title}
    >
      {copied && copiedChildren ? copiedChildren : children}
    </a>
  );
}
