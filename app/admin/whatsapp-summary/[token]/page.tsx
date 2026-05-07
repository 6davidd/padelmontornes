import { supabaseAdmin } from "@/lib/supabase-admin";
import CopyMessageButton from "./CopyMessageButton";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    token: string;
  }>;
};

type WhatsappMessagePageData = {
  title: string;
  description: string;
  messageText: string;
};

async function loadAllCourtsFullAlert(
  token: string
): Promise<WhatsappMessagePageData | null> {
  const { data, error } = await supabaseAdmin
    .from("all_courts_full_alerts")
    .select("message_text")
    .eq("token", token)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    title: "Horario completo para WhatsApp",
    description:
      "Pulsa el boton para copiar el aviso y abrir WhatsApp directamente.",
    messageText: String(data.message_text ?? ""),
  };
}

async function loadDailySummary(
  token: string
): Promise<WhatsappMessagePageData | null> {
  const { data, error } = await supabaseAdmin
    .from("daily_whatsapp_summaries")
    .select("message_text")
    .eq("token", token)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    title: "Resumen para WhatsApp",
    description:
      "Pulsa el boton para copiar el resumen y abrir WhatsApp directamente.",
    messageText: String(data.message_text ?? ""),
  };
}

async function loadWhatsappMessage(token: string) {
  return (
    (await loadAllCourtsFullAlert(token)) ?? (await loadDailySummary(token))
  );
}

export default async function WhatsappSummaryPage({ params }: PageProps) {
  const { token } = await params;
  const message = await loadWhatsappMessage(token);

  if (!message) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="mx-auto max-w-2xl rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            Mensaje no encontrado
          </h1>
          <p className="mt-3 text-sm text-gray-600">
            El enlace no es valido o el mensaje ya no esta disponible.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">{message.title}</h1>

          <p className="mt-3 text-sm text-gray-600">{message.description}</p>

          <div className="mt-6">
            <CopyMessageButton text={message.messageText} />
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-3 text-sm font-semibold text-gray-900">
            Mensaje listo para enviar
          </div>

          <pre className="whitespace-pre-wrap break-words rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
            {message.messageText}
          </pre>
        </div>
      </div>
    </div>
  );
}
