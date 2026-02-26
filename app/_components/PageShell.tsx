export default function PageShell({
  children,
  variant = "card",
}: {
  children: React.ReactNode;
  variant?: "card" | "plain";
}) {
  // card = todo dentro de una tarjeta blanca (recomendado)
  // plain = sin tarjeta, por si alguna pantalla lo necesita
  if (variant === "plain") {
    return (
      <div className="px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-3xl mx-auto">{children}</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-[calc(100vh-72px)]">
      <div className="px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white border border-gray-300 rounded-3xl shadow-md p-5 sm:p-7">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}