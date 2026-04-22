export type MemberImportPreviewStatus =
  | "ready"
  | "duplicate_csv"
  | "duplicate_system"
  | "error";

export type MemberImportPreviewRow = {
  rowNumber: number;
  originalFullName: string;
  originalEmail: string;
  normalizedFullName: string;
  normalizedEmail: string;
  status: MemberImportPreviewStatus;
  detail: string;
  canImport: boolean;
};

export type MemberImportPreviewSummary = {
  total: number;
  ready: number;
  duplicates: number;
  errors: number;
};

export type MemberImportResultStatus = "created" | "duplicate" | "error";

export type MemberImportResultRow = {
  rowNumber: number;
  fullName: string;
  email: string;
  status: MemberImportResultStatus;
  detail: string;
  inviteEmailSent: boolean;
  userId?: string;
};

export type MemberImportResultSummary = {
  total: number;
  created: number;
  duplicates: number;
  errors: number;
  inviteEmailsSent: number;
};

export function getMemberImportPreviewStatusLabel(
  status: MemberImportPreviewStatus
) {
  switch (status) {
    case "ready":
      return "Lista";
    case "duplicate_csv":
      return "Duplicado CSV";
    case "duplicate_system":
      return "Ya existe";
    case "error":
      return "Error";
  }
}

export function getMemberImportResultStatusLabel(
  status: MemberImportResultStatus
) {
  switch (status) {
    case "created":
      return "Creado";
    case "duplicate":
      return "Omitido";
    case "error":
      return "Error";
  }
}
