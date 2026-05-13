import ForgotPasswordForm from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-md px-4 py-8 sm:px-6 sm:py-12">
        <div className="rounded-3xl border border-gray-300 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Recuperar contraseña
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Introduce tu email y te enviaremos un enlace para cambiar tu
            contraseña.
          </p>

          <ForgotPasswordForm />
        </div>
      </div>
    </div>
  );
}
