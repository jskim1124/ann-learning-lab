import { createCustomDraft, type CustomDatasetDraft } from "./customDataset";

/** Validate before replacing anything. Strings/formulas never become executable markup. */
export function spreadsheetRowsToDraft(rows: unknown[][]): CustomDatasetDraft {
  const meaningful = rows.map((cells, i) => ({ cells, line: i + 1 })).filter(row => row.cells.some(v => v !== null && v !== undefined && String(v).trim() !== ""));
  if (meaningful.length < 2) throw new Error("첫 행에 열 이름, 다음 행부터 자료를 넣어 주세요.");
  if (meaningful.length > 1001) throw new Error("한 번에 자료 1,000행까지 가져올 수 있습니다.");
  const headers = meaningful[0]!.cells.map(v => String(v ?? "").trim());
  if (headers.some(v => !v) || new Set(headers).size !== headers.length) throw new Error("첫 행의 열 이름은 비어 있거나 서로 같으면 안 됩니다.");
  const classColumn = headers.findIndex(v => /^(클래스|정답|class|label)$/i.test(v));
  if (classColumn < 0) throw new Error("첫 행에 ‘클래스’ 열을 만들어 정답 이름을 적어 주세요.");
  const nameColumn = headers.findIndex(v => /^(이름|사례 이름|name)$/i.test(v));
  const featureColumns = headers.map((_, i) => i).filter(i => i !== classColumn && i !== nameColumn);
  if (featureColumns.length < 2 || featureColumns.length > 5) throw new Error("숫자 특징 열을 2~5개 넣어 주세요.");
  const draft = createCustomDraft(); draft.classes = []; draft.features = featureColumns.map(i => headers[i]!);
  for (const { cells, line } of meaningful.slice(1)) {
    if (cells.slice(headers.length).some(v => v !== null && v !== undefined && v !== "")) throw new Error(`${line}행에 열 이름 없는 값이 있습니다.`);
    const name = String(cells[classColumn] ?? "").trim();
    if (!name) throw new Error(`${line}행의 클래스가 비어 있습니다.`);
    if (name.length > 40) throw new Error(`${line}행의 클래스 이름을 40자 이내로 줄여 주세요.`);
    let label = draft.classes.indexOf(name);
    if (label < 0) { draft.classes.push(name); label = draft.classes.length - 1; }
    if (draft.classes.length > 6) throw new Error("클래스는 최대 6개까지 가져올 수 있습니다.");
    const values = featureColumns.map(i => {
      const cell = cells[i];
      if ((typeof cell !== "number" && typeof cell !== "string") || String(cell).trim() === "" || !Number.isFinite(Number(cell))) throw new Error(`${line}행 ‘${headers[i]}’에 숫자를 넣어 주세요. 빈칸·날짜·오류는 가져올 수 없습니다.`);
      return Number(cell);
    });
    draft.rows.push({ id: draft.nextId++, label, name: nameColumn < 0 ? `자료 ${draft.nextId - 1}` : String(cells[nameColumn] ?? "").trim() || `자료 ${draft.nextId - 1}`, values });
  }
  if (draft.classes.length < 2) throw new Error("두 종류 이상의 클래스를 넣어 주세요.");
  return draft;
}

export async function importSpreadsheet(file: File): Promise<CustomDatasetDraft> {
  if (!/\.xlsx$/i.test(file.name)) throw new Error("엑셀에서 .xlsx 형식으로 저장한 파일을 골라 주세요. .xls는 지원하지 않습니다.");
  if (file.size > 2 * 1024 * 1024) throw new Error("2MB 이하의 엑셀 파일을 사용해 주세요.");
  const { readSheet } = await import("read-excel-file/browser");
  let rows: unknown[][];
  try { rows = await readSheet(file, 1); } catch { throw new Error("엑셀 파일을 읽지 못했습니다. 암호 없이 .xlsx로 다시 저장해 주세요."); }
  return spreadsheetRowsToDraft(rows);
}
