export type ParsedMemberCsvRow = {
  rowNumber: number;
  originalFullName: string;
  originalEmail: string;
};

const HEADER_FULL_NAME_ALIASES = new Set(["nombre completo"]);
const HEADER_EMAIL_ALIASES = new Set([
  "correo electrónico",
  "correo electronico",
]);

function stripBom(value: string) {
  return value.replace(/^\uFEFF/, "");
}

function normalizeHeaderName(value: string) {
  return stripBom(value)
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-ES");
}

function countDelimiterOccurrences(line: string, delimiter: string) {
  let count = 0;
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && char === delimiter) {
      count += 1;
    }
  }

  return count;
}

function detectDelimiter(csvText: string) {
  const sampleLines = stripBom(csvText)
    .split(/\r\n|\n|\r/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5);

  const candidates = [",", ";", "\t"] as const;
  let bestDelimiter: "," | ";" | "\t" = ",";
  let bestScore = -1;

  for (const delimiter of candidates) {
    const score = sampleLines.reduce(
      (total, line) => total + countDelimiterOccurrences(line, delimiter),
      0
    );

    if (score > bestScore) {
      bestScore = score;
      bestDelimiter = delimiter;
    }
  }

  return bestDelimiter;
}

function parseCsvRecords(csvText: string, delimiter: string) {
  const records: string[][] = [];
  let currentField = "";
  let currentRecord: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];

    if (inQuotes) {
      if (char === '"') {
        if (csvText[index + 1] === '"') {
          currentField += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }

      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === delimiter) {
      currentRecord.push(currentField);
      currentField = "";
      continue;
    }

    if (char === "\n" || char === "\r") {
      if (char === "\r" && csvText[index + 1] === "\n") {
        index += 1;
      }

      currentRecord.push(currentField);
      records.push(currentRecord);
      currentField = "";
      currentRecord = [];
      continue;
    }

    currentField += char;
  }

  if (inQuotes) {
    throw new Error("El CSV tiene comillas sin cerrar.");
  }

  if (currentField.length > 0 || currentRecord.length > 0) {
    currentRecord.push(currentField);
    records.push(currentRecord);
  }

  return records;
}

export function parseMembersCsv(csvText: string) {
  const cleanText = stripBom(csvText);

  if (!cleanText.trim()) {
    throw new Error("El CSV está vacío.");
  }

  const delimiter = detectDelimiter(cleanText);
  const rawRecords = parseCsvRecords(cleanText, delimiter);
  const records = rawRecords
    .map((record, index) => ({ rowNumber: index + 1, record }))
    .filter(({ record }) => record.some((cell) => cell.trim() !== ""));

  if (records.length === 0) {
    throw new Error("El CSV no contiene filas válidas.");
  }

  const [headerRow, ...dataRows] = records;
  const normalizedHeaders = headerRow.record.map(normalizeHeaderName);

  const fullNameIndex = normalizedHeaders.findIndex((header) =>
    HEADER_FULL_NAME_ALIASES.has(header)
  );
  const emailIndex = normalizedHeaders.findIndex((header) =>
    HEADER_EMAIL_ALIASES.has(header)
  );

  if (fullNameIndex === -1 || emailIndex === -1) {
    throw new Error(
      'El CSV debe incluir las columnas "Nombre completo" y "Correo electrónico".'
    );
  }

  const rows: ParsedMemberCsvRow[] = dataRows
    .map(({ rowNumber, record }) => ({
      rowNumber,
      originalFullName: record[fullNameIndex] ?? "",
      originalEmail: record[emailIndex] ?? "",
    }))
    .filter(
      (row) =>
        row.originalFullName.trim() !== "" || row.originalEmail.trim() !== ""
    );

  return {
    rows,
  };
}
