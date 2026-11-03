import { describe, expect, it } from "vitest";
import { archiveAge, archiveFilePath, archiveFolderName, clientPagePath, fromClientPage, indexLetter, sortByName } from "./archive";

describe("EX1: архив в HTML", () => {
  it("EX1: one folder per backup, one page per client", () => {
    expect(archiveFolderName("2026-11-01")).toBe("LOA arkiv 2026-11-01");
    expect(clientPagePath("aaaa")).toBe("klienter/aaaa.html");
  });

  it("EX1: files keep their own path without the doctor id, per bucket", () => {
    expect(archiveFilePath("visit-photos", "doc-1/visit-9/p1.jpg")).toBe("filer/visit-photos/visit-9/p1.jpg");
    expect(archiveFilePath("client-documents", "doc-1/client-2/анализ крови.pdf")).toBe("filer/client-documents/client-2/анализ_крови.pdf");
    expect(fromClientPage("filer/visit-photos/v/p.jpg")).toBe("../filer/visit-photos/v/p.jpg");
  });

  it("EX1: a path can never leave the archive folder", () => {
    expect(archiveFilePath("visit-photos", "doc/../../etc/passwd")).toBe("filer/visit-photos/etc/passwd");
  });

  it("EX1: clients in Russian alphabetical order, with a letter for the jump list", () => {
    const sorted = sortByName([{ fullName: "Яна" }, { fullName: "анна" }, { fullName: "Вера" }, { fullName: "Ёлка" }]);
    expect(sorted.map((c) => c.fullName)).toEqual(["анна", "Вера", "Ёлка", "Яна"]);
    expect(indexLetter("анна")).toBe("А");
    expect(indexLetter(" 7 клиент")).toBe("#");
  });
});

describe("EX1: последний архив", () => {
  it("EX1: days since the last archive, red after 14 days, none = never made", () => {
    expect(archiveAge(null, "2026-11-03")).toBeNull();
    expect(archiveAge("2026-11-03", "2026-11-03")).toEqual({ date: "2026-11-03", days: 0, stale: false });
    expect(archiveAge("2026-10-20", "2026-11-03")).toEqual({ date: "2026-10-20", days: 14, stale: false });
    expect(archiveAge("2026-10-19", "2026-11-03")).toEqual({ date: "2026-10-19", days: 15, stale: true });
  });
});
