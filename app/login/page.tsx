import { Suspense } from "react";
import LoginPageClient from "./LoginPageClient";

function LoginPageFallback() {
  return (
    <div className="min-h-[calc(100vh-var(--app-header-height))] bg-gray-50">
      <div className="mx-auto max-w-md px-4 py-8 sm:px-6 sm:py-12">
        <div className="rounded-3xl border border-gray-300 bg-white p-6 shadow-sm sm:p-8">
          <div className="h-8 w-40 rounded-xl bg-gray-100" />
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

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageClient />
    </Suspense>
  );
}
