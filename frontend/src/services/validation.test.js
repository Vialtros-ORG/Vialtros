import {
  isValidPersonName,
  isValidPhone,
  isValidUsername,
  normalizePersonName,
  normalizePhone,
} from "./validation";

describe("input validation", () => {
  test("normalizes Spanish names and accepts letters with separators", () => {
    expect(normalizePersonName("  maría   del mar  ")).toBe("María Del Mar");
    expect(isValidPersonName("María-José O’Connor")).toBe(true);
  });

  test("rejects empty name segments and excessively long names", () => {
    expect(isValidPersonName("María--José")).toBe(false);
    expect(isValidPersonName("a".repeat(81))).toBe(false);
  });

  test("normalizes Colombian mobile numbers and validates E.164", () => {
    expect(normalizePhone("300 123 4567")).toBe("+573001234567");
    expect(isValidPhone("+573001234567", { required: true })).toBe(true);
    expect(isValidPhone("123", { required: true })).toBe(false);
  });

  test("accepts only usernames within the documented format", () => {
    expect(isValidUsername("conductor.01")).toBe(true);
    expect(isValidUsername("ab")).toBe(false);
    expect(isValidUsername("Conductor")).toBe(true);
  });
});
