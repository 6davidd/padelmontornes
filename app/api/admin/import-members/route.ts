import { NextResponse } from "next/server";
import {
  createMemberWithoutDuplicateCheck,
  getExistingSystemDuplicateMessage,
  loadExistingSystemEmailLookup,
  type CreateMemberResult,
  type ExistingSystemEmailLookup,
} from "@/lib/create-member";
import {
  buildMemberImportPreview,
  normalizeImportedEmail,
} from "@/lib/normalize-member-import";
import {
  type MemberImportResultRow,
  type MemberImportResultSummary,
} from "@/lib/member-import-types";
import { parseMembersCsv } from "@/lib/parse-members-csv";
import { isOwnerRole } from "@/lib/auth-shared";
import { getAuthenticatedMemberFromRequest } from "@/lib/server-route-auth";

export const runtime = "nodejs";

const MAX_CSV_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_IMPORT_ROWS = 1000;

class RequestValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function describeCreateMemberFailure(result: Extract<CreateMemberResult, { ok: false }>) {
  if (result.code === "invite_email" && result.rolledBack) {
    return `${result.error} El alta se ha revertido para mantener consistencia.`;
  }

  if (result.code === "invite_email" && !result.rolledBack) {
    return `${result.error} El usuario se ha creado, pero la invitación no se ha podido enviar.`;
  }

  return result.error;
}

function buildImportSummary(rows: MemberImportResultRow[]): MemberImportResultSummary {
  return {
    total: rows.length,
    created: rows.filter((row) => row.status === "created").length,
    duplicates: rows.filter((row) => row.status === "duplicate").length,
    errors: rows.filter((row) => row.status === "error").length,
    inviteEmailsSent: rows.filter((row) => row.inviteEmailSent).length,
  };
}

async function getRequestFile(req: Request) {
  const formData = await req.formData();
  const modeValue = String(formData.get("mode") ?? "preview")
    .trim()
    .toLowerCase();
  const mode = modeValue === "import" ? "import" : "preview";
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new RequestValidationError("Debes adjuntar un archivo CSV.");
  }

  if (file.size === 0) {
    throw new RequestValidationError("El archivo CSV está vacío.");
  }

  if (file.size > MAX_CSV_FILE_SIZE_BYTES) {
    throw new RequestValidationError(
      "El archivo CSV supera el tamaño máximo permitido de 2 MB."
    );
  }

  const text = await file.text();

  if (!text.trim()) {
    throw new RequestValidationError("El archivo CSV está vacío.");
  }

  return {
    mode,
    text,
  };
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthenticatedMemberFromRequest(req);

    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, error: auth.error },
        { status: auth.status }
      );
    }

    if (!isOwnerRole(auth.member.role)) {
      return NextResponse.json(
        { ok: false, error: "No autorizado." },
        { status: 403 }
      );
    }

    const { mode, text } = await getRequestFile(req);
    let parsed: ReturnType<typeof parseMembersCsv>;

    try {
      parsed = parseMembersCsv(text);
    } catch (error) {
      throw new RequestValidationError(
        error instanceof Error ? error.message : "No se ha podido leer el CSV."
      );
    }

    if (parsed.rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "El CSV no contiene filas de datos." },
        { status: 400 }
      );
    }

    if (parsed.rows.length > MAX_IMPORT_ROWS) {
      return NextResponse.json(
        {
          ok: false,
          error: `El CSV supera el máximo permitido de ${MAX_IMPORT_ROWS} filas.`,
        },
        { status: 400 }
      );
    }

    const existingLookup = await loadExistingSystemEmailLookup(
      parsed.rows.map((row) => normalizeImportedEmail(row.originalEmail))
    );
    const preview = buildMemberImportPreview({
      rows: parsed.rows,
      existingEmails: existingLookup,
    });

    if (mode === "preview") {
      return NextResponse.json({
        ok: true,
        mode,
        rows: preview.rows,
        summary: preview.summary,
      });
    }

    const liveLookup: ExistingSystemEmailLookup = {
      memberEmails: new Set(existingLookup.memberEmails),
      authEmails: new Set(existingLookup.authEmails),
    };

    const results: MemberImportResultRow[] = [];

    for (const row of preview.rows) {
      const safeFullName = row.normalizedFullName || row.originalFullName.trim();
      const safeEmail =
        row.normalizedEmail || row.originalEmail.trim().toLowerCase();

      try {
        if (!row.canImport) {
          results.push({
            rowNumber: row.rowNumber,
            fullName: safeFullName,
            email: safeEmail,
            status:
              row.status === "duplicate_csv" || row.status === "duplicate_system"
                ? "duplicate"
                : "error",
            detail: row.detail,
            inviteEmailSent: false,
          });
          continue;
        }

        const duplicateMessage = getExistingSystemDuplicateMessage(
          row.normalizedEmail,
          liveLookup
        );

        if (duplicateMessage) {
          results.push({
            rowNumber: row.rowNumber,
            fullName: row.normalizedFullName,
            email: row.normalizedEmail,
            status: "duplicate",
            detail: duplicateMessage,
            inviteEmailSent: false,
          });
          continue;
        }

        const result = await createMemberWithoutDuplicateCheck({
          fullName: row.normalizedFullName,
          email: row.normalizedEmail,
          alias: null,
          role: "member",
        });

        if (!result.ok) {
          results.push({
            rowNumber: row.rowNumber,
            fullName: row.normalizedFullName,
            email: row.normalizedEmail,
            status: result.code === "duplicate" ? "duplicate" : "error",
            detail: describeCreateMemberFailure(result),
            inviteEmailSent: false,
            userId: result.userId,
          });
          continue;
        }

        liveLookup.memberEmails.add(row.normalizedEmail);
        liveLookup.authEmails.add(row.normalizedEmail);

        results.push({
          rowNumber: row.rowNumber,
          fullName: row.normalizedFullName,
          email: row.normalizedEmail,
          status: "created",
          detail: "Socio creado correctamente.",
          inviteEmailSent: true,
          userId: result.userId,
        });
      } catch (error) {
        results.push({
          rowNumber: row.rowNumber,
          fullName: safeFullName,
          email: safeEmail,
          status: "error",
          detail:
            error instanceof Error ? error.message : "Error inesperado al importar la fila.",
          inviteEmailSent: false,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      mode,
      results,
      summary: buildImportSummary(results),
    });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error inesperado",
      },
      { status: 500 }
    );
  }
}
