import { describe, expect, it } from "vitest";
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_MAX_BYTES,
  documentFileProblem,
  documentMimeType,
  fileExtension,
} from "./document-files";

const file = (name: string, size = 1024, type = "") => ({ name, size, type });

describe("document file checks", () => {
  it("accepts the same extensions as the API's allowlist", () => {
    expect(DOCUMENT_ACCEPT).toBe(
      ".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.pptx,.csv,.txt",
    );
    for (const name of [
      "a.pdf",
      "B.PDF",
      "c.docx",
      "d.xlsx",
      "e.jpeg",
      "f.csv",
    ]) {
      expect(documentFileProblem(file(name)), name).toBeNull();
    }
  });

  it("refuses types the API refuses, such as macro or legacy Office files", () => {
    for (const name of [
      "macro.docm",
      "old.doc",
      "run.exe",
      "page.html",
      "logo.svg",
      "noextension",
    ]) {
      expect(documentFileProblem(file(name)), name).toMatch(
        /can't be uploaded/,
      );
    }
  });

  it("refuses empty files and files over 25 MB", () => {
    expect(documentFileProblem(file("a.pdf", 0))).toBe("This file is empty.");
    expect(documentFileProblem(file("a.pdf", DOCUMENT_MAX_BYTES))).toBeNull();
    expect(documentFileProblem(file("a.pdf", DOCUMENT_MAX_BYTES + 1))).toBe(
      "This file is larger than 25 MB.",
    );
  });

  it("declares the browser's type, or the allowlisted one when the browser has none", () => {
    expect(documentMimeType(file("a.pdf", 1, "application/pdf"))).toBe(
      "application/pdf",
    );
    expect(documentMimeType(file("rows.csv"))).toBe("text/csv");
    expect(documentMimeType(file("odd.bin"))).toBe("application/octet-stream");
    expect(fileExtension("Report v2.final.PDF ")).toBe("pdf");
    expect(fileExtension("README")).toBeNull();
  });
});
