// @vitest-environment node
import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readSheet } from "read-excel-file/node";
import { zipStored } from "../export/scratchProject";
import { spreadsheetRowsToDraft } from "./spreadsheetImport";

describe("실제 XLSX 파일",()=>{
  it("OOXML 파일을 파싱하여 클래스와 숫자 행을 읽는다",async()=>{
    const files:Record<string,string>={
      "[Content_Types].xml":'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
      "_rels/.rels":'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      "xl/workbook.xml":'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="자료" sheetId="1" r:id="rId1"/></sheets></workbook>',
      "xl/_rels/workbook.xml.rels":'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
      "xl/worksheets/sheet1.xml":'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+[["클래스","길이","무게"],["작은 것",2,3],["큰 것",8,9],["작은 것",3,2],["큰 것",9,8]].map((row,r)=>`<row r="${r+1}">${row.map((v,c)=>`<c r="${String.fromCharCode(65+c)}${r+1}"${typeof v==="string"?' t="inlineStr"':""}>${typeof v==="string"?`<is><t>${v}</t></is>`:`<v>${v}</v>`}</c>`).join("")}</row>`).join("")+'</sheetData></worksheet>'
    };
    const bytes=zipStored(Object.fromEntries(Object.entries(files).map(([name,content])=>[name,new TextEncoder().encode(content)])));
    const rows=await readSheet(Buffer.from(bytes),1);
    const draft=spreadsheetRowsToDraft(rows);
    expect(draft.classes).toEqual(["작은 것","큰 것"]);expect(draft.rows).toHaveLength(4);
    expect(draft.rows[1]!.values).toEqual([8,9]);
    // Opt-in synthetic fixture for the browser's real upload/worker smoke test.
    if (process.env.NEURAL_LAB_WRITE_XLSX_FIXTURE==="1") writeFileSync(join(tmpdir(),"neural-lab-upload-smoke.xlsx"),bytes);
  });
});
