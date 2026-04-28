import { Suspense } from "react";
import ResetPasswordPageClient from "./ResetPasswordPageClient";

function ResetPasswordPageFallback() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-md px-4 py-8 sm:px-6 sm:py-12">
        <div className="rounded-3xl border border-gray-300 bg-white p-6 shadow-sm sm:p-8">
          <div className="h-8 w-48 rounded-xl bg-gray-100" />
          <div className="mt-5 space-y-4">
            <div className="h-12 rounded-2xl bg-gray-100" />
            <div className="h-12 rounded-2xl bg-gray-100" />
            <div className="h-12 rounded-2xl bg-gray-100" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordPageFallback />}>
      <ResetPasswordPageClient />
    </Suspense>
  );
}
