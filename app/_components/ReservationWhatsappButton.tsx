"use client";

import type { SVGProps } from "react";
import { WhatsAppShareButton } from "@/app/_components/WhatsAppShareButton";

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function WhatsAppIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path
        d="M13.6 2.3A7.85 7.85 0 0 0 8 0C3.6 0 .1 3.6.1 7.9c0 1.4.4 2.8 1.1 4L0 16l4.2-1.1A7.9 7.9 0 0 0 8 15.9h.004c4.4 0 7.9-3.6 7.9-7.9a7.9 7.9 0 0 0-2.3-5.7ZM8 14.5a6.6 6.6 0 0 1-3.4-.9l-.2-.1-2.5.7.7-2.4-.2-.3a6.6 6.6 0 0 1-1-3.5c0-3.6 3-6.6 6.6-6.6a6.6 6.6 0 0 1 6.6 6.6c0 3.6-3 6.5-6.6 6.5Zm3.6-4.9c-.2-.1-1.2-.6-1.4-.6-.2-.1-.3-.1-.4.1-.1.2-.5.6-.6.8-.1.1-.2.1-.4.05-.2-.1-.8-.3-1.6-1-.6-.5-1-1.2-1.1-1.4-.1-.2 0-.3.1-.4l.3-.3c.1-.1.1-.2.2-.3.1-.1.05-.2 0-.3L6.1 4.8c-.2-.4-.3-.3-.4-.3h-.4c-.1 0-.4.05-.5.2-.2.2-.7.7-.7 1.7s.7 1.9.8 2c.1.1 1.4 2.1 3.4 3 .5.2.8.3 1.1.4.5.2.9.1 1.2.1.4-.1 1.2-.5 1.3-.9.2-.5.2-.9.1-.9 0-.2-.2-.3-.4-.4Z"
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
  return (
    <WhatsAppShareButton
      message={message}
      onCopyStart={onCopyStart}
      onCopyError={onCopyError}
      className={classNames(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border text-[#0f5e2e] shadow-sm transition active:scale-[0.99]",
        "border-green-200 bg-green-50 hover:bg-green-100",
        className
      )}
      copiedClassName="border-green-300 bg-green-100"
    >
      <WhatsAppIcon
        className="h-[18px] w-[18px]"
        style={{ transform: "translate(0.5px, -0.5px)" }}
      />
    </WhatsAppShareButton>
  );
}
