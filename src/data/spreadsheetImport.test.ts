import { describe, expect, it } from "vitest";
import { spreadsheetRowsToDraft, importSpreadsheet } from "./spreadsheetImport";

describe("엑셀 숫자 자료 가져오기",()=>{
  it("이름 없이 클래스와 숫자 특징을 읽고 행 이름을 자동 생성한다",()=>{
    const draft=spreadsheetRowsToDraft([["클래스","길이","무게"],["A",2,7],["B",9,4],["A",3,6],["B",8,5]]);
    expect(draft.features).toEqual(["길이","무게"]);expect(draft.classes).toEqual(["A","B"]);
    expect(draft.rows[0]).toEqual({id:1,name:"자료 1",label:0,values:[2,7]});expect(draft.nextId).toBe(5);
  });
  it("선택적인 이름 열과 숫자 문자열도 읽는다",()=>{
    const draft=spreadsheetRowsToDraft([["이름","무게","클래스","길이"],["첫째","2.5","A",-2],["둘째",7,"B",3]]);
    expect(draft.rows[0]!.values).toEqual([2.5,-2]);expect(draft.rows[0]!.name).toBe("첫째");
  });
  it("잘못된 셀을 0으로 덮지 않고 행·열을 안내한다",()=>{
    expect(()=>spreadsheetRowsToDraft([["클래스","길이","무게"],["A",null,7],["B",8,2]])).toThrow("2행 ‘길이’");
    expect(()=>spreadsheetRowsToDraft([["클래스","길이","길이"],["A",1,7],["B",8,2]])).toThrow("열 이름");
    expect(()=>spreadsheetRowsToDraft([["클래스","길이","무게"],["A",new Date(),7],["B",8,2]])).toThrow("숫자");
  });
  it("지원하지 않는 확장자·과도한 파일 크기를 파싱 전에 거부한다",async()=>{
    await expect(importSpreadsheet(new File(["bad"],"data.xls"))).rejects.toThrow(".xlsx");
    await expect(importSpreadsheet(new File([new Uint8Array(2*1024*1024+1)],"big.xlsx"))).rejects.toThrow("2MB");
  });
});
