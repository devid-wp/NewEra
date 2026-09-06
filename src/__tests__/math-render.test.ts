import { describe, it, expect } from "vitest";
import { hasMathDelimiters } from "@/components/Chat/MessageBubble";
import katex from "katex";

function renderLatex(expr: string, display: boolean): string {
  return katex.renderToString(expr, { displayMode: display, throwOnError: false });
}

describe("hasMathDelimiters", () => {
  it("detects inline math \\(...\\)", () => {
    expect(hasMathDelimiters("The energy is \\( E = mc^2 \\).")).toBe(true);
  });

  it("detects display math \\[...\\]", () => {
    expect(hasMathDelimiters("\\[ E = mc^2 \\]")).toBe(true);
  });

  it("returns false for plain text", () => {
    expect(hasMathDelimiters("Just some plain text")).toBe(false);
  });

  it("detects math mixed with text", () => {
    expect(hasMathDelimiters("Here \\( x \\) and \\[ y \\]")).toBe(true);
  });
});

describe("KaTeX rendering", () => {
  it("handles text that does not contain math - no crash", () => {
    expect(hasMathDelimiters("No math here")).toBe(false);
  });

  it("renders inline formula", () => {
    const html = renderLatex("E = mc^2", false);
    expect(html).toContain("E");
    expect(html).toContain("katex");
  });

  it("renders display formula", () => {
    const html = renderLatex("E = mc^2", true);
    expect(html).toContain("E");
    expect(html).toContain("katex-display");
  });

  it("renders fractions", () => {
    const html = renderLatex("\\frac{a}{b}", false);
    expect(html).toContain("katex");
    expect(html).toContain("frac");
  });

  it("renders Greek letters", () => {
    const html = renderLatex("\\psi(x)", false);
    expect(html).toContain("katex");
  });

  it("renders \\hat{} expressions", () => {
    const html = renderLatex("\\hat{x}", false);
    expect(html).toContain("katex");
    expect(html).toContain("hat");
  });

  it("renders superscripts", () => {
    const html = renderLatex("x^2", false);
    expect(html).toContain("katex");
  });

  it("renders subscripts", () => {
    const html = renderLatex("x_1", false);
    expect(html).toContain("katex");
  });

  it("renders absolute-value expressions", () => {
    const html = renderLatex("|\\psi(x)|^2", false);
    expect(html).toContain("katex");
    expect(html).toContain("|");
  });

  it("renders integrals", () => {
    const html = renderLatex("\\int_0^\\infty e^{-x} dx", false);
    expect(html).toContain("katex");
    expect(html).toContain("int");
  });

  it("renders Heisenberg inequality", () => {
    const html = renderLatex("\\Delta x \\Delta p \\geq \\frac{\\hbar}{2}", false);
    expect(html).toContain("katex");
    expect(html).toContain("geq");
  });
});
