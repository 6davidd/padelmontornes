import { createClient } from "@supabase/supabase-js";
import CopyMessageButton from "./CopyMessageButton";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

type PageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function WhatsappSummaryPage({ params }: PageProps) {
  const { token } = await params;

  const { data, error } = await supabase
    .from("daily_whatsapp_summaries")
    .select("target_date,message_text,created_at")
    .eq("token", token)
    .single();

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="mx-auto max-w-2xl rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            Resumen no encontrado
          </h1>
          <p className="mt-3 text-sm text-gray-600">
            El enlace no es válido o el resumen ya no está disponible.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            Resumen para WhatsApp
          </h1>

          <p className="mt-3 text-sm text-gray-600">
            Pulsa el botón para copiar el mensaje y pegarlo en el grupo del club.
          </p>

          <div className="mt-6">
            <CopyMessageButton text={data.message_text} />
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-3 text-sm font-semibold text-gray-900">
            Mensaje listo para enviar
          </div>

          <pre className="whitespace-pre-wrap break-words rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
            {data.message_text}
          </pre>
        </div>
      </div>
    </div>
  );
}