import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  toLatLng,
  toLatLngArray,
  safeLatLngPath,
  getArrowSvg,
  buildVoiceInstruction,
  buildInstructionText,
  projectPointOnSegment,
  getSegmentRotation,
  getAheadDirectionLine,
  getVehicleRotation,
  distanceBetweenPoints,
  interpolatePoint,
  buildAnimationPath,
  totalPathDistance,
  getPointAtDistance,
  lineDistanceKm,
  getPoiIcon,
} from "./mapUtils";

const route = [
  [3, -77],
  [3, -76.99],
  [3.01, -76.98],
  [3.02, -76.97],
  [3.03, -76.96],
  [3.04, -76.95],
  [3.05, -76.94],
];

describe("map coordinate helpers", () => {
  it("converts valid coordinates and rejects malformed values", () => {
    expect(toLatLng([3.2, -77.1])).toEqual({ lat: 3.2, lng: -77.1 });
    expect(toLatLng([3.2])).toBeNull();
    expect(toLatLng("3.2,-77.1")).toBeNull();
    expect(toLatLng([Number.NaN, -77])).toBeNull();
    expect(toLatLngArray([[3, -77], [null, -77], [3.1, -76.9]])).toEqual([
      { lat: 3, lng: -77 },
      { lat: 3.1, lng: -76.9 },
    ]);
    expect(toLatLngArray(null)).toEqual([]);
    expect(safeLatLngPath([[3, -77]])).toBeNull();
    expect(safeLatLngPath([[3, -77], [3.1, -76.9]])).toHaveLength(2);
  });

  it("projects points onto regular and zero-length segments", () => {
    expect(projectPointOnSegment([0, 0.5], [0, 0], [0, 1])).toEqual({
      t: 0.5,
      distanceSquared: 0,
    });
    expect(projectPointOnSegment([1, 0], [0, 0], [0, 1]).t).toBe(0);
    expect(projectPointOnSegment([0, 2], [0, 0], [0, 1]).t).toBe(1);
    expect(projectPointOnSegment([1, 1], [0, 0], [0, 0])).toEqual({
      t: 0,
      distanceSquared: 2,
    });
  });

  it("calculates route bearings and handles missing geometry", () => {
    expect(getSegmentRotation([0, 0], [0, 1])).toBe(-0);
    expect(getSegmentRotation([1, 1], [1, 1])).toBe(0);
    expect(getSegmentRotation([0, 0], [Number.NaN, 1])).toBe(0);
    expect(getAheadDirectionLine(route, [3.01, -76.98])).toEqual(route.slice(1));
    expect(getAheadDirectionLine([[3, -77]], [3, -77])).toEqual([[3, -77]]);
    expect(getAheadDirectionLine(route, null)).toBe(route);
    expect(getVehicleRotation([], [3, -77])).toBe(0);
    expect(getVehicleRotation(route, null)).toBe(getSegmentRotation(route[5], route[6]));
    expect(getVehicleRotation(route, [3.015, -76.975])).toBe(
      getSegmentRotation(route[2], route[3]),
    );
    expect(getVehicleRotation([[3, -77], null], [3, -77])).toBe(0);
    expect(getAheadDirectionLine(route, [3.05, -76.94])).toHaveLength(2);
  });

  it("builds animation paths for updated, fallback, and empty tracking", () => {
    expect(buildAnimationPath([3.2, -76.8], route, [2.99, -77.01], 3)).toEqual([
      [2.99, -77.01],
      ...route.slice(2),
    ]);
    expect(buildAnimationPath([3.2, -76.8], route, route[2], 3)).toEqual(route.slice(2));
    expect(buildAnimationPath([3.2, -76.8], route, null, 0)).toEqual(route);
    expect(buildAnimationPath([3.2, -76.8], route.slice(0, 2), route[0], 99)).toEqual([]);
    expect(buildAnimationPath([3.2, -76.8], [route[0]], route[0], 0)).toEqual([
      route[0],
      [3.2, -76.8],
    ]);
    expect(buildAnimationPath([3.2, -76.8], [], route[0], 0)).toEqual([
      route[0],
      [3.2, -76.8],
    ]);
    expect(buildAnimationPath(null, [], null, 0)).toEqual([]);
    expect(distanceBetweenPoints(route[0], route[1])).toBeCloseTo(0.01);
    expect(distanceBetweenPoints(null, route[1])).toBe(0);
    expect(interpolatePoint([0, 0], [2, 4], 0.25)).toEqual([0.5, 1]);
    expect(totalPathDistance([[0, 0], [0, 2], [0, 5]])).toBe(5);
  });

  it("finds a point at a distance across regular, repeated, and empty paths", () => {
    expect(getPointAtDistance([], 1)).toBeNull();
    expect(getPointAtDistance([[1, 2]], 4)).toEqual([1, 2]);
    expect(getPointAtDistance(route, 0)).toBe(route[0]);
    expect(getPointAtDistance([[0, 0], [0, 2], [0, 4]], 3)).toEqual([0, 3]);
    expect(getPointAtDistance([[0, 0], [0, 0], [0, 2]], 0.5)).toEqual([0, 0.5]);
    expect(getPointAtDistance([[0, 0], [0, 1], [0, 1], [0, 2]], 1)).toEqual([0, 1]);
    expect(getPointAtDistance([[0, 0], [0, 1]], 3)).toEqual([0, 1]);
  });

  it("measures geographic lines and skips invalid segments", () => {
    expect(lineDistanceKm([])).toBe(0);
    expect(lineDistanceKm([[3, -77]])).toBe(0);
    expect(lineDistanceKm([[3, -77], [3, -76.99]])).toBeGreaterThan(1);
    expect(lineDistanceKm([[3, -77], [Number.NaN, -76.99], [3, -76.98]])).toBe(0);
  });
});

describe("navigation presentation helpers", () => {
  it.each([
    ["left", "Gira a la izquierda", "gire a la izquierda"],
    ["sharp left", "Gira a la izquierda", "gire fuertemente a la izquierda"],
    ["slight left", "Mantente a la izquierda", "manténgase a la izquierda"],
    ["right", "Gira a la derecha", "gire a la derecha"],
    ["sharp right", "Gira a la derecha", "gire fuertemente a la derecha"],
    ["slight right", "Mantente a la derecha", "manténgase a la derecha"],
    ["straight", "Continúa recto", "continúe recto"],
    ["uturn", "Da un giro en U", "dé un giro en U"],
    ["unknown", "Continúa recto", "continúe"],
  ])("formats %s instructions", (modifier, text, voice) => {
    const step = { modifier, name: "la avenida" };
    expect(buildInstructionText(step)).toBe(text);
    expect(buildVoiceInstruction(step)).toBe(`${voice} en la avenida`);
  });

  it("formats arrival and unnamed navigation steps", () => {
    expect(buildInstructionText({ type: "arrive" })).toBe("Llegaste al destino");
    expect(buildVoiceInstruction({ type: "arrive", name: "Terminal" })).toBe(
      "llegando al destino en Terminal",
    );
    expect(buildVoiceInstruction({ type: "arrive" })).toBe("ha llegado al destino");
    expect(buildVoiceInstruction({ modifier: "left" })).toBe("gire a la izquierda");
    expect(buildInstructionText(null)).toBe("Continúa recto");
  });

  it.each([
    ["left", "M20 18C20 12 10 12 10 18"],
    ["sharp left", "M20 18C20 12 10 12 10 18"],
    ["right", "M20 18C20 12 30 12 30 18"],
    ["sharp right", "M20 18C20 12 30 12 30 18"],
    ["slight left", "M20 18C20 14 14 11 10 13"],
    ["slight right", "M20 18C20 14 26 11 30 13"],
    ["uturn", "M26 34V18a6 6 0 0 0-12 0v2"],
    ["straight", "M20 4L9 17h22z"],
  ])("renders the %s turn marker", (modifier, path) => {
    const markup = renderToStaticMarkup(getArrowSvg(modifier, "turn", "#123456"));
    expect(markup).toContain(path);
    expect(markup).toContain("#123456");
  });

  it("renders arrival markers and chooses POI icons from map tags", () => {
    expect(renderToStaticMarkup(getArrowSvg(null, "turn"))).toContain("M20 4L9 17h22z");
    expect(renderToStaticMarkup(getArrowSvg("left", "arrive"))).toContain(
      "M20 4C15.03 4 11 8.03 11 13",
    );
    for (const tags of [
      { amenity: "university" },
      { amenity: "school" },
      { amenity: "hospital" },
      { amenity: "fuel" },
      { leisure: "park" },
      { shop: "mall" },
      { shop: "supermarket" },
      { shop: "department_store" },
      { shop: "convenience" },
      {},
    ]) {
      expect(renderToStaticMarkup(getPoiIcon(tags))).toContain("<svg");
    }
  });
});
