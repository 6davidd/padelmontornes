"use client";

import Link from "next/link";
import { useState } from "react";
import { getClientSession } from "@/lib/client-session";
import {
  getMemberImportPreviewStatusLabel,
  getMemberImportResultStatusLabel,
  type MemberImportPreviewRow,
  type MemberImportPreviewSummary,
  type MemberImportResultRow,
  type MemberImportResultSummary,
} from "@/lib/member-import-types";
import { PageHeaderCard } from "@/app/_components/PageHeaderCard";

const CLUB_GREEN = "#0f5e2e";

type PreviewResponse = {
  ok?: boolean;
  mode?: "preview";
  error?: string;
  rows?: MemberImportPreviewRow[];
  summary?: MemberImportPreviewSummary;
};

type ImportResponse = {
  ok?: boolean;
  mode?: "import";
  error?: string;
  results?: MemberImportResultRow[];
  summary?: MemberImportResultSummary;
};

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function StatusPill({
  tone,
  children,
}: {
  tone: "green" | "yellow" | "red";
  children: React.ReactNode;
}) {
  const toneClassName =
    tone === "green"
      ? "border-green-200 bg-green-50 text-green-800"
      : tone === "yellow"
      ? "border-yellow-200 bg-yellow-50 text-yellow-800"
      : "border-red-200 bg-red-50 text-red-800";

  return (
    <span
      className={classNames(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
        toneClassName
      )}
    >
      {children}
    </span>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-gray-500">{label}</div>
      <div className="mt-2 text-3xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function getPreviewTone(status: MemberImportPreviewRow["status"]) {
  if (status === "ready") return "green";
  if (status === "error") return "red";
  return "yellow";
}

function getResultTone(status: MemberImportResultRow["status"]) {
  if (status === "created") return "green";
  if (status === "error") return "red";
  return "yellow";
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const rawText = await res.text();

  try {
    return rawText ? (JSON.parse(rawText) as T) : ({} as T);
  } catch {
    throw new Error(rawText || "La respuesta del servidor no es válida.");
  }
}

export default function AdminImportarSociosPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<MemberImportPreviewRow[]>([]);
  const [previewSummary, setPreviewSummary] =
    useState<MemberImportPreviewSummary | null>(null);
  const [resultRows, setResultRows] = useState<MemberImportResultRow[]>([]);
  const [resultSummary, setResultSummary] =
    useState<MemberImportResultSummary | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);

  async function sendFile(mode: "preview" | "import") {
    if (!file) {
      throw new Error("Selecciona un archivo CSV antes de continuar.");
    }

    const session = await getClientSession();
    const accessToken = session?.access_token;

    if (!accessToken) {
      throw new Error("No hay sesión válida. Vuelve a iniciar sesión.");
    }

    const formData = new FormData();
    formData.set("mode", mode);
    formData.set("file", file);

    const res = await fetch("/api/admin/import-members", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });

    return {
      res,
      data:
        mode === "preview"
          ? await parseJsonResponse<PreviewResponse>(res)
          : await parseJsonResponse<ImportResponse>(res),
    };
  }

  function handleFileChange(nextFile: File | null) {
    setFile(nextFile);
    setPreviewRows([]);
    setPreviewSummary(null);
    setResultRows([]);
    setResultSummary(null);
    setMsg(null);
    setOk(null);
  }

  async function handlePreview() {
    setMsg(null);
    setOk(null);
    setLoadingPreview(true);

    try {
      const { res, data } = await sendFile("preview");

      if (!res.ok || !data?.ok || data.mode !== "preview") {
        throw new Error(data?.error || "No se ha podido generar la previsualización.");
      }

      setPreviewRows(data.rows ?? []);
      setPreviewSummary(data.summary ?? null);
      setResultRows([]);
      setResultSummary(null);
      setOk("Previsualización generada correctamente.");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Error inesperado.");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleImport() {
    setMsg(null);
    setOk(null);
    setImporting(true);

    try {
      const { res, data } = await sendFile("import");

      if (!res.ok || !data?.ok || data.mode !== "import") {
        throw new Error(data?.error || "No se ha podido completar la importación.");
      }

      setResultRows(data.results ?? []);
      setResultSummary(data.summary ?? null);
      setOk("Importación completada.");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Error inesperado.");
    } finally {
      setImporting(false);
    }
  }

  const readyRows = previewSummary?.ready ?? 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <PageHeaderCard
          title="Importar socios"
          contentClassName="space-y-5"
          actions={
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/admin/socios"
                className="rounded-2xl border border-gray-300 bg-white px-5 py-3 text-center font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50"
              >
                Volver a socios
              </Link>
              <a
                href="/examples/importar-socios-ejemplo.csv"
                download
                className="rounded-2xl px-5 py-3 text-center font-semibold text-white shadow-sm transition hover:brightness-[0.97]"
                style={{ backgroundColor: CLUB_GREEN }}
              >
                Descargar CSV de ejemplo
              </a>
            </div>
          }
        >
          <div className="grid gap-4 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-lg font-bold text-gray-900">
                Archivo CSV
              </div>
              <p className="mt-2 text-sm text-gray-600">
                Encabezados obligatorios: <strong>Nombre completo</strong> y{" "}
                <strong>Correo electrónico</strong>. Si hay columnas extra, se
                ignorarán.
              </p>

              <label className="mt-4 block rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5">
                <div className="text-sm font-semibold text-gray-900">
                  Seleccionar archivo
                </div>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) =>
                    handleFileChange(event.target.files?.[0] ?? null)
                  }
                  className="mt-3 block w-full text-sm text-gray-700 file:mr-4 file:rounded-2xl file:border-0 file:bg-white file:px-4 file:py-2 file:font-semibold file:text-gray-900 file:shadow-sm"
                />
              </label>

              <div className="mt-4 text-sm text-gray-600">
                {file ? (
                  <span>
                    Archivo seleccionado:{" "}
                    <strong className="text-gray-900">{file.name}</strong>
                  </span>
                ) : (
                  "Todavía no has seleccionado ningún CSV."
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={!file || loadingPreview || importing}
                  className="rounded-2xl px-5 py-3 font-semibold text-white shadow-sm transition disabled:opacity-60"
                  style={{ backgroundColor: CLUB_GREEN }}
                >
                  {loadingPreview ? "Generando preview..." : "Previsualizar CSV"}
                </button>

                <button
                  type="button"
                  onClick={handleImport}
                  disabled={!file || readyRows === 0 || loadingPreview || importing}
                  className="rounded-2xl border border-gray-300 bg-white px-5 py-3 font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50 disabled:opacity-60"
                >
                  {importing ? "Importando..." : "Confirmar importación"}
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
              <div className="text-lg font-bold text-gray-900">
                Flujo de trabajo
              </div>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-gray-700">
                <li>Sube el CSV y genera la previsualización.</li>
                <li>Revisa nombres normalizados, duplicados y errores.</li>
                <li>Confirma la importación.</li>
                <li>
                  El sistema procesará fila por fila reutilizando el mismo flujo
                  de alta manual e invitación por correo.
                </li>
              </ol>
              <p className="mt-4 text-sm text-gray-600">
                Esta pantalla está pensada para trabajo interno desde escritorio,
                con tablas amplias y resumen detallado por fila.
              </p>
            </div>
          </div>

          {msg && (
            <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
              <p className="text-sm text-yellow-900">{msg}</p>
            </div>
          )}

          {ok && (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
              <p className="text-sm text-green-900">{ok}</p>
            </div>
          )}
        </PageHeaderCard>

        {previewSummary && (
          <section className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <SummaryCard label="Filas totales" value={previewSummary.total} />
              <SummaryCard label="Listas para importar" value={previewSummary.ready} />
              <SummaryCard label="Duplicados" value={previewSummary.duplicates} />
              <SummaryCard label="Errores" value={previewSummary.errors} />
            </div>

            <div className="overflow-hidden rounded-3xl border border-gray-300 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-6 py-4">
                <div className="text-xl font-bold text-gray-900">
                  Previsualización
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[1120px] table-auto border-collapse">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-sm font-semibold text-gray-700">
                      <th className="px-4 py-3">Fila</th>
                      <th className="px-4 py-3">Nombre original</th>
                      <th className="px-4 py-3">Email original</th>
                      <th className="px-4 py-3">Nombre normalizado</th>
                      <th className="px-4 py-3">Email normalizado</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row) => (
                      <tr
                        key={row.rowNumber}
                        className="border-t border-gray-200 align-top text-sm text-gray-800"
                      >
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          {row.rowNumber}
                        </td>
                        <td className="px-4 py-3">{row.originalFullName || "—"}</td>
                        <td className="px-4 py-3">{row.originalEmail || "—"}</td>
                        <td className="px-4 py-3">
                          {row.normalizedFullName || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {row.normalizedEmail || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill tone={getPreviewTone(row.status)}>
                            {getMemberImportPreviewStatusLabel(row.status)}
                          </StatusPill>
                        </td>
                        <td className="px-4 py-3">{row.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {resultSummary && (
          <section className="space-y-4">
            <div className="grid gap-4 md:grid-cols-5">
              <SummaryCard label="Filas procesadas" value={resultSummary.total} />
              <SummaryCard label="Creados" value={resultSummary.created} />
              <SummaryCard label="Duplicados" value={resultSummary.duplicates} />
              <SummaryCard label="Errores" value={resultSummary.errors} />
              <SummaryCard
                label="Invitaciones enviadas"
                value={resultSummary.inviteEmailsSent}
              />
            </div>

            <div className="overflow-hidden rounded-3xl border border-gray-300 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-6 py-4">
                <div className="text-xl font-bold text-gray-900">
                  Resultado final
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[900px] table-auto border-collapse">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-sm font-semibold text-gray-700">
                      <th className="px-4 py-3">Fila</th>
                      <th className="px-4 py-3">Nombre</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultRows.map((row) => (
                      <tr
                        key={`result-${row.rowNumber}-${row.email}`}
                        className="border-t border-gray-200 align-top text-sm text-gray-800"
                      >
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          {row.rowNumber}
                        </td>
                        <td className="px-4 py-3">{row.fullName || "—"}</td>
                        <td className="px-4 py-3">{row.email || "—"}</td>
                        <td className="px-4 py-3">
                          <StatusPill tone={getResultTone(row.status)}>
                            {getMemberImportResultStatusLabel(row.status)}
                          </StatusPill>
                        </td>
                        <td className="px-4 py-3">{row.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
