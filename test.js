// test.js - Engine Verification Harness
import * as Data from "./data.js";
import { generateSeal, createWorldState, allocateLocation } from "./haulout.js";

export function runTestSuite() {
  console.group("%c▲ Haulout Engine Verification Suite", "color: #38bdf8; font-weight: bold;");
  
  try {
    const seal1 = generateSeal(1);
    console.log(seal1.species === "Harbour" ? "✔ PASS: Seal #1 species resolves to Harbour" : "✘ FAIL: Seal #1 species mismatch");
    console.log(seal1.sex === "Male" ? "✔ PASS: Seal #1 sex resolves to Male" : "✘ FAIL: Seal #1 sex mismatch");
  } catch(e) { console.error("Test 1 crashed", e); }

  try {
    const state = createWorldState();
    state.activeEmergences = Array.from({length: 10}, (_, i) => ({ id: i, location: "Big Smooth" }));
    const loc = allocateLocation(state);
    console.log(Data.LOCATIONS.SHORE.includes(loc) ? "✔ PASS: Bypasses full rocks to shorelines safely" : "✘ FAIL: Failed capacity override redirection");
  } catch(e) { console.error("Test 5 crashed", e); }

  console.groupEnd();
}
