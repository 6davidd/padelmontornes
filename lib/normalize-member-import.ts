import {
  getExistingSystemDuplicateMessage,
  isValidEmail,
  normalizeEmail,
  type ExistingSystemEmailLookup,
} from "./create-member";
import type { ParsedMemberCsvRow } from "./parse-members-csv";
import type {
  MemberImportPreviewRow,
  MemberImportPreviewSummary,
} from "./member-import-types";

function collapseInternalWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function capitalizeCompoundWord(value: string) {
  return value.replace(
    /(^|[-'’])(\p{L})/gu,
    (_match, prefix: string, letter: string) =>
      `${prefix}${letter.toLocaleUpperCase("es-ES")}`
  );
}

export function normalizeImportedFullName(value: string) {
  const collapsed = collapseInternalWhitespace(value);

  if (!collapsed) {
    return "";
  }

  return collapsed
    .toLocaleLowerCase("es-ES")
    .split(" ")
    .map((word) => capitalizeCompoundWord(word))
    .join(" ");
}

export function normalizeImportedEmail(value: string) {
  return normalizeEmail(value);
}

function getRowValidationDetail(params: {
  fullName: string;
  email: string;
}) {
  if (!params.fullName && !params.email) {
    return "Faltan el nombre completo y el correo electrónico.";
  }

  if (!params.fullName) {
    return "Falta el nombre completo.";
  }

  if (!params.email) {
    return "Falta el correo electrónico.";
  }

  if (!isValidEmail(params.email)) {
    return "El email no es válido.";
  }

  return null;
}

export function buildMemberImportPreview(rows: {
  rows: ParsedMemberCsvRow[];
  existingEmails: ExistingSystemEmailLookup;
}): {
  rows: MemberImportPreviewRow[];
  summary: MemberImportPreviewSummary;
} {
  const emailCounts = new Map<string, number>();

  for (const row of rows.rows) {
    const normalizedEmail = normalizeImportedEmail(row.originalEmail);

    if (!normalizedEmail) {
      continue;
    }

    emailCounts.set(
      normalizedEmail,
      (emailCounts.get(normalizedEmail) ?? 0) + 1
    );
  }

  const previewRows = rows.rows.map<MemberImportPreviewRow>((row) => {
    const normalizedFullName = normalizeImportedFullName(row.originalFullName);
    const normalizedEmail = normalizeImportedEmail(row.originalEmail);

    const validationDetail = getRowValidationDetail({
      fullName: normalizedFullName,
      email: normalizedEmail,
    });

    if (validationDetail) {
      return {
        rowNumber: row.rowNumber,
        originalFullName: row.originalFullName,
        originalEmail: row.originalEmail,
        normalizedFullName,
        normalizedEmail,
        status: "error",
        detail: validationDetail,
        canImport: false,
      };
    }

    if ((emailCounts.get(normalizedEmail) ?? 0) > 1) {
      return {
        rowNumber: row.rowNumber,
        originalFullName: row.originalFullName,
        originalEmail: row.originalEmail,
        normalizedFullName,
        normalizedEmail,
        status: "duplicate_csv",
        detail: "Duplicado dentro del CSV.",
        canImport: false,
      };
    }

    const systemDuplicateMessage = getExistingSystemDuplicateMessage(
      normalizedEmail,
      rows.existingEmails
    );

    if (systemDuplicateMessage) {
      return {
        rowNumber: row.rowNumber,
        originalFullName: row.originalFullName,
        originalEmail: row.originalEmail,
        normalizedFullName,
        normalizedEmail,
        status: "duplicate_system",
        detail: systemDuplicateMessage,
        canImport: false,
      };
    }

    return {
      rowNumber: row.rowNumber,
      originalFullName: row.originalFullName,
      originalEmail: row.originalEmail,
      normalizedFullName,
      normalizedEmail,
      status: "ready",
      detail: "Lista para importar.",
      canImport: true,
    };
  });

  return {
    rows: previewRows,
    summary: {
      total: previewRows.length,
      ready: previewRows.filter((row) => row.status === "ready").length,
      duplicates: previewRows.filter(
        (row) =>
          row.status === "duplicate_csv" || row.status === "duplicate_system"
      ).length,
      errors: previewRows.filter((row) => row.status === "error").length,
    },
  };
}
