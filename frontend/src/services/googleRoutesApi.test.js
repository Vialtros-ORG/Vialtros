import { parseDurationMilliseconds } from "./googleRoutesApi";

describe("Google Routes duration parsing", () => {
  test("parses the REST Duration string format", () => {
    expect(parseDurationMilliseconds("420s")).toBe(420000);
    expect(parseDurationMilliseconds("3.5s")).toBe(3500);
  });

  test("supports protobuf duration objects and missing values", () => {
    expect(parseDurationMilliseconds({ seconds: "90", nanos: 500000000 })).toBe(90500);
    expect(parseDurationMilliseconds(null)).toBe(0);
    expect(parseDurationMilliseconds("invalid")).toBe(0);
  });
});
