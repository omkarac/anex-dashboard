/**
 * MMR airport configuration — canonical source for OLS calculation.
 *
 * Sourced from db/seed_airports.sql (which itself derives from AAI eAIP).
 * If you update either file, update both. CI should diff them eventually.
 */

import type { Airport } from "./types.ts";

export const VABB: Airport = {
  code: "VABB",
  name: "Chhatrapati Shivaji Maharaj International Airport (Santa Cruz)",
  arp: { lat: 19.0916944, lon: 72.8654722 },
  elevation_m: 11.28,
  runways: [
    {
      designator: "09/27",
      threshold_a: { name: "09", lat: 19.0931, lon: 72.8516, elev_m: 11.0 },
      threshold_b: { name: "27", lat: 19.0857, lon: 72.8836, elev_m: 9.5 },
      length_m: 3445,
      width_m: 60,
      true_bearing: 92.1,
      code: 4,
      precision_approach: true,
    },
    {
      designator: "14/32",
      threshold_a: { name: "14", lat: 19.1022, lon: 72.8641, elev_m: 8.5 },
      threshold_b: { name: "32", lat: 19.0793, lon: 72.8836, elev_m: 10.7 },
      length_m: 2925,
      width_m: 45,
      true_bearing: 142.6,
      code: 4,
      precision_approach: true,
    },
  ],
};

export const VAJJ: Airport = {
  code: "VAJJ",
  name: "Juhu Aerodrome",
  arp: { lat: 19.0967, lon: 72.8347 },
  elevation_m: 4.5,
  runways: [
    {
      designator: "08/26",
      threshold_a: { name: "08", lat: 19.0966, lon: 72.8311, elev_m: 4.5 },
      threshold_b: { name: "26", lat: 19.0968, lon: 72.8389, elev_m: 4.5 },
      length_m: 1143,
      width_m: 23,
      true_bearing: 79.5,
      code: 2,
      precision_approach: false,
    },
    {
      designator: "03/21",
      threshold_a: { name: "03", lat: 19.0950, lon: 72.8334, elev_m: 4.5 },
      threshold_b: { name: "21", lat: 19.0982, lon: 72.8361, elev_m: 4.5 },
      length_m: 700,
      width_m: 23,
      true_bearing: 33.5,
      code: 1,
      precision_approach: false,
    },
  ],
};

export const VANM: Airport = {
  code: "VANM",
  name: "Navi Mumbai International Airport",
  arp: { lat: 19.0567, lon: 73.025 },
  elevation_m: 3.0,
  runways: [
    {
      designator: "08/26",
      threshold_a: { name: "08", lat: 19.0567, lon: 73.007, elev_m: 3.0 },
      threshold_b: { name: "26", lat: 19.0567, lon: 73.043, elev_m: 3.0 },
      length_m: 3700,
      width_m: 60,
      true_bearing: 80.0,
      code: 4,
      precision_approach: true,
    },
  ],
};

/** All MMR airports the engine considers. */
export const MMR_AIRPORTS: readonly Airport[] = [VABB, VAJJ, VANM];
