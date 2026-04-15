"use client";

import { useId, useState } from "react";

type PasswordFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
};

function EyeIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 3l18 18" />
        <path d="M10.6 10.7a2 2 0 0 0 2.8 2.8" />
        <path d="M9.4 5.5A10.7 10.7 0 0 1 12 5c5 0 9 4.5 10 7-0.4 1-1.3 2.3-2.6 3.5" />
        <path d="M6.2 6.2C4.5 7.4 3.4 9 3 10c1 2.5 5 7 9 7 1.2 0 2.4-0.3 3.5-0.7" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  required,
  disabled,
}: PasswordFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-semibold text-gray-900">
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          className="w-full appearance-none rounded-2xl border border-gray-300 bg-white px-4 py-3.5 pr-14 text-gray-900 placeholder:text-gray-500 shadow-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-green-200 disabled:bg-gray-100 disabled:text-gray-500"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
        />

        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex w-14 items-center justify-center rounded-r-2xl text-gray-500 transition hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-200 disabled:cursor-default disabled:text-gray-400"
          aria-label={visible ? "Ocultar contrasena" : "Mostrar contrasena"}
          aria-pressed={visible}
          disabled={disabled}
        >
          <EyeIcon visible={visible} />
        </button>
      </div>
    </div>
  );
}
