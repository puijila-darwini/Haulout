// haulout.js - Pure Symbolic Engine Core
import * as Data from "./data.js";

let engineState = null;

function wheel(value, size, multiplier, offset) {
  const result = (value * multiplier + offset) % size;
  return result < 0 ? result + size : result;
}

function generateId() {
  return 'hevt-xxxx-xxxx-4xxx-yxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isMatchingTime(dateA, dateB) {
  if (!dateA || !dateB) return false;
  const dA = new Date(dateA);
  const dB = new Date(dateB);
  return dA.getHours() === dB.getHours() && dA.getMinutes() === dB.getMinutes();
}

function allocateLocation(state) {
  const counts = {};
  state.activeEmergences.forEach((e) => { 
    const loc = e.metadata?.location || "Near Shore";
    counts[loc] = (counts[loc] || 0) + 1; 
  });
  
  let bestLoc = Data.LOCATIONS[0].name;
  let minCount = Infinity;
  for (const loc of Data.LOCATIONS) {
    const count = counts[loc.name] || 0;
    if (count < minCount) {
      minCount = count;
      bestLoc = loc.name;
    }
  }
  return bestLoc;
}

export function generateSeal(seed) {
  if (seed < 1 || seed > Data.SEAL_COUNT) throw new RangeError("Seal index out of bounds.");
  const x = seed - 1;
  const speciesObj = Data.SPECIES[wheel(x, Data.SPECIES.length, 5, 1)];
  const solarZodiacIdx = wheel(x, 12, 1, 0);
  const lunarZodiacIdx = wheel(x, 12, 7, 3);
  
  return {
    id: seed,
    species: speciesObj.name,
    behaviour: Data.BEHAVIOURS[wheel(x, Data.BEHAVIOURS.length, 3, 0)],
    solarAssociation: Data.ZODIAC[solarZodiacIdx],
    lunarAssociation: Data.ZODIAC[lunarZodiacIdx],
    symbolicWeight: speciesObj.symbolicWeight
  };
}

export function solarSeal(date) {
  const d = new Date(date);
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((d - startOfYear) / Data.DAY);
  return generateSeal((wheel(dayOfYear, Data.SEAL_COUNT, 1, 0)) + 1);
}

export function lunarSeal(date) {
  const timeMs = new Date(date).getTime();
  const progress = (timeMs % (Data.LUNAR_CYCLE * Data.DAY)) / (Data.LUNAR_CYCLE * Data.DAY);
  return generateSeal(Math.floor(progress * Data.SEAL_COUNT) + 1);
}

export function createWorldState() {
  return { 
    lastTick: null, 
    currentTime: null, 
    currentSolarSeal: null, 
    currentLunarSeal: null, 
    activeEmergences: [], 
    scheduledEvents: [], 
    notifications: [], 
    journal: [], 
    ritualState: { active: false, phase: null, began: null, expectedEnd: null } 
  };
}

export function validateEnvironment(env) {
  if (!env) throw new Error("Environment reference is invalid.");
  if (!(env.time instanceof Date) || isNaN(env.time)) throw new Error("Environment clock is corrupted.");
  if (!(env.sunrise instanceof Date) || isNaN(env.sunrise)) throw new Error("Environment sunrise timestamp is invalid.");
  if (!(env.sunset instanceof Date) || isNaN(env.sunset)) throw new Error("Environment sunset timestamp is invalid.");
}

export function validateState(state) {
  if (!state) throw new Error("State structurally invalid.");
  if (!Array.isArray(state.scheduledEvents)) throw new Error("State scheduler queue missing.");
}

export function getEngineState() {
  if (!engineState) engineState = createWorldState();
  return engineState;
}

export function setEngineState(state) {
  engineState = state;
}

export function tick(environment) {
  validateEnvironment(environment);
  
  const state = getEngineState();
  const nextState = {
    ...state,
    currentTime: new Date(environment.time),
    ritualState: { ...state.ritualState },
    activeEmergences: state.activeEmergences.map(e => ({ ...e, metadata: { ...e.metadata } })),
    scheduledEvents: state.scheduledEvents.map(e => ({ ...e })),
    notifications: state.notifications.map(n => ({ ...n })),
    journal: state.journal.map(j => ({ ...j }))
  };

  advanceWorld(nextState, environment);
  validateState(nextState);
  
  nextState.lastTick = new Date();
  engineState = nextState;
  return nextState;
}

function advanceWorld(state, environment) {
  state.currentSolarSeal = solarSeal(environment.time);
  state.currentLunarSeal = lunarSeal(environment.time);
  
  executeScheduledEvents(state, environment);
  createEmergences(state, environment);
}

function executeScheduledEvents(state, environment) {
  const currentSimTime = environment.time;
  const dueEvents = state.scheduledEvents.filter(e => new Date(e.executeAt) <= currentSimTime && !e.completed);
  state.scheduledEvents = state.scheduledEvents.filter(e => new Date(e.executeAt) > currentSimTime);
  
  dueEvents.sort((a, b) => new Date(a.executeAt) - new Date(b.executeAt));
  for (const event of dueEvents) {
    event.completed = true;
    if (event.type === "EMERGENCE_LIFECYCLE_TRANSITION") handleLifecycleTransition(state, event.payload, currentSimTime);
    if (event.type === "RITUAL_TIMEOUT") {
      state.ritualState.active = false;
      appendJournal(state, currentSimTime, "Ritual Terminated", "The active focusing period faded to quietness.", "RITUAL");
    }
  }
}

function createEmergences(state, environment) {
  const currentSimTime = environment.time;
  if (state.lastTick && new Date(state.lastTick).getMinutes() === currentSimTime.getMinutes()) return;

  if (isMatchingTime(currentSimTime, environment.sunrise)) {
    triggerEmergence(state, "Dawn Solar", "Major", currentSimTime, state.currentSolarSeal);
  }
  if (isMatchingTime(currentSimTime, environment.sunset)) {
    triggerEmergence(state, "Dusk Solar", "Major", currentSimTime, state.currentSolarSeal);
  }
  if (isMatchingTime(currentSimTime, environment.moonrise)) {
    triggerEmergence(state, "Moonrise Lunar", "Major", currentSimTime, state.currentLunarSeal);
  }
  if (isMatchingTime(currentSimTime, environment.moonset)) {
    triggerEmergence(state, "Moonset Lunar", "Major", currentSimTime, state.currentLunarSeal);
  }
}

export function triggerEmergence(state, type, strengthLabel, time, sealInstance) {
  const emergenceId = generateId();
  const duration = 4 * 60 * 60 * 1000;
  const placementZone = allocateLocation(state);
  
  state.activeEmergences.push({
    id: emergenceId,
    type: type,
    created: new Date(time),
    expires: new Date(time.getTime() + duration),
    strength: strengthLabel === "Major" ? 2 : 1,
    metadata: {
      location: placementZone,
      state: "Latent",
      behaviour: sealInstance.behaviour,
      seal: sealInstance
    }
  });

  const category = type.includes("Solar") ? "SOLAR" : type.includes("Lunar") ? "LUNAR" : "SYSTEM";
  state.notifications.unshift({
    id: generateId(),
    timestamp: new Date(time),
    type: category,
    title: `${sealInstance.species} Spotted`,
    body: `A manifestation of seal #${sealInstance.id} is surfacing at ${placementZone}.`,
    read: false
  });

  appendJournal(state, time, "Seal Surface", `${sealInstance.species} (#${sealInstance.id}) emerged at ${placementZone}.`, category);

  const scheduleEvent = (offset, targetState) => {
    state.scheduledEvents.push({ 
      id: generateId(), 
      executeAt: new Date(time.getTime() + offset), 
      type: "EMERGENCE_LIFECYCLE_TRANSITION", 
      payload: { id: emergenceId, targetState }, 
      completed: false 
    });
  };
  scheduleEvent(duration * 0.1, "Approaching");
  scheduleEvent(duration * 0.25, "Active");
  scheduleEvent(duration * 0.5, "Peak");
  scheduleEvent(duration * 0.85, "Fading");
  scheduleEvent(duration, "Resolved");
  state.scheduledEvents.sort((a, b) => new Date(a.executeAt) - new Date(b.executeAt));
}

function handleLifecycleTransition(state, payload, time) {
  const idx = state.activeEmergences.findIndex(e => e.id === payload.id);
  if (idx === -1) return;
  const em = state.activeEmergences[idx];
  em.metadata.state = payload.targetState;
  
  if (em.metadata.state === "Resolved") {
    state.activeEmergences.splice(idx, 1);
    appendJournal(state, time, "Emergence Resolved", `The manifestation at ${em.metadata.location} returned to the deep.`, "SYSTEM");
  }
}

export function forceResolveEmergence(state, emergenceId) {
  const idx = state.activeEmergences.findIndex(e => e.id === emergenceId);
  if (idx !== -1) {
    const em = state.activeEmergences[idx];
    state.activeEmergences.splice(idx, 1);
    appendJournal(state, new Date(), "Tracking Overridden", `Observation of ${em.metadata.seal.species} ended manually.`, "SYSTEM");
  }
  state.scheduledEvents = state.scheduledEvents.filter(e => e.payload?.id !== emergenceId);
}

export function forceCategorizedEmergence(state, category, customSealId) {
  const time = state.currentTime || new Date();
  let seal;
  const explicitNumber = parseInt(customSealId, 10);
  const customSeal = (!isNaN(explicitNumber) && explicitNumber >= 1 && explicitNumber <= Data.SEAL_COUNT) ? generateSeal(explicitNumber) : null;

  if (category === "LUNAR") seal = customSeal || lunarSeal(time);
  else seal = customSeal || solarSeal(time);

  triggerEmergence(state, `Forced ${category}`, "Major", time, seal);
}

export function beginRitual(state, phaseName, durationMs) {
  state.ritualState = { active: true, phase: phaseName, began: new Date(state.currentTime), expectedEnd: new Date(state.currentTime.getTime() + durationMs) };
  state.scheduledEvents.push({ id: generateId(), executeAt: state.ritualState.expectedEnd, type: "RITUAL_TIMEOUT", payload: {}, completed: false });
  state.scheduledEvents.sort((a, b) => new Date(a.executeAt) - new Date(b.executeAt));
}

export function appendJournal(state, timestamp, title, text, category) {
  state.journal.unshift({ id: generateId(), timestamp: new Date(timestamp), title, text, category });
}
