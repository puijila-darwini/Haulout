// ui.js - Presentation Logic & Time Warp Controller
import * as Data from "./data.js";
import { 
  tick, 
  getEngineState, 
  setEngineState, 
  forceResolveEmergence, 
  forceCategorizedEmergence,
  createWorldState
} from "./haulout.js";

let state = null;
let simTimeMs = Date.now();
let lastRealTime = Date.now();
let lastSaveTime = Date.now();
let timeMultiplier = 1; 
let observatoryInitialized = false;

const diagnostics = { tickDurationMs: 0, pollCount: 0, lastTick: null };

export function start() {
  const loadedState = loadState();
  setEngineState(loadedState);
  
  if (loadedState && loadedState.currentTime) {
    simTimeMs = new Date(loadedState.currentTime).getTime();
  } else {
    simTimeMs = Date.now();
  }
  
  lastRealTime = Date.now();
  lastSaveTime = Date.now();

  poll();
  setInterval(poll, 1000); 
  setupUIEventListeners();
}

function calculateZodiac(date, period) {
  const d = new Date(date);
  const diffDays = (d - new Date(2026, 0, 1)) / Data.DAY;
  let longitude = ((diffDays / period) * 360) % 360;
  if (longitude < 0) longitude += 360;
  return {
    sign: Data.ZODIAC[Math.floor(longitude / 30)].sign,
    degree: parseFloat((longitude % 30).toFixed(1)),
    longitude: parseFloat(longitude.toFixed(1))
  };
}

export function readEnvironment(specificTime) {
  const simTime = specificTime || new Date(simTimeMs);
  const y = simTime.getFullYear(), m = simTime.getMonth(), d = simTime.getDate();
  return {
    time: simTime,
    sunrise: new Date(y, m, d, 6, 0, 0),
    sunset: new Date(y, m, d, 18, 0, 0),
    moonrise: new Date(y, m, d, 22, 0, 0),
    moonset: new Date(y, m, d, 10, 0, 0),
    solarPosition: calculateZodiac(simTime, Data.SOLAR_YEAR),
    lunarPosition: calculateZodiac(simTime, 27.32166)
  };
}

function poll() {
  const nowReal = Date.now();
  const deltaReal = nowReal - lastRealTime;
  lastRealTime = nowReal;

  const previousSimTime = new Date(simTimeMs);
  simTimeMs += deltaReal * timeMultiplier;
  const currentSimTime = new Date(simTimeMs);

  if (timeMultiplier > 1) {
    let runner = new Date(previousSimTime.getTime());
    let safety = 0;
    while (runner < currentSimTime && safety < 1440) {
      runner.setMinutes(runner.getMinutes() + 1);
      if (runner > currentSimTime) break;
      tick(readEnvironment(runner));
      safety++;
    }
  }

  const env = readEnvironment(currentSimTime);
  const t0 = performance.now();
  state = tick(env);
  diagnostics.tickDurationMs = performance.now() - t0;
  diagnostics.pollCount++;

  if (nowReal - lastSaveTime >= Data.CONFIG.autosaveInterval) {
    saveState(state);
    lastSaveTime = nowReal;
  }

  render(state, env);
}

function formatCountdown(ms) {
  if (ms <= 0) return "Reached";
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return `${h > 0 ? h + "h " : ""}${m}m ${s}s`;
}

function render(currentState, currentEnv) {
  document.getElementById("sim-clock").textContent = `${currentEnv.time.toLocaleDateString()} ${currentEnv.time.toLocaleTimeString()}`;
  const coast = document.getElementById("coast-viewport");
  
  coast.innerHTML = Data.LOCATIONS.map(loc => {
    const matching = currentState.activeEmergences.filter(e => e.metadata.location === loc.name);
    
    let contentHtml = `
      <p class="empty-msg" style="color: var(--text-muted); font-style: italic; font-size: 11px; padding: 8px; margin: 0; background: rgba(0,0,0,0.15); border: 1px dashed var(--border-color); border-radius: 4px;">
        Empty Station
      </p>`;
    
    if (matching.length > 0) {
      contentHtml = matching.map(e => {
        const seal = e.metadata.seal;
        const start = new Date(e.created).getTime();
        const end = new Date(e.expires).getTime();
        const dur = end - start;
        const now = currentEnv.time.getTime();

        return `
          <div class="emergence-card" style="border-left: 3px solid var(--accent); padding: 8px; background: var(--bg-primary); font-size: 12px; display: flex; flex-direction: column; gap: 4px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <h4 style="margin: 0; color: var(--accent); font-size:12px;">${seal.species} (#${seal.id})</h4>
              <span class="badge status-${e.metadata.state.toLowerCase()}" style="font-size:9px; padding:1px 4px;">${e.metadata.state}</span>
            </div>
            
            <div style="background: rgba(0,0,0,0.4); padding: 6px; border-radius: 3px; font-family: monospace; font-size: 10px; line-height: 1.3; border: 1px solid var(--border-color); display: grid; grid-template-columns: 1fr 1fr; gap: 2px 8px;">
              <div>• Appr: ${now < start + dur * 0.1 ? formatCountdown((start + dur * 0.1) - now) : "✓"}</div>
              <div>• Active: ${now < start + dur * 0.25 ? formatCountdown((start + dur * 0.25) - now) : "✓"}</div>
              <div>• Peak: ${now < start + dur * 0.5 ? formatCountdown((start + dur * 0.5) - now) : "✓"}</div>
              <div>• Fade: ${now < start + dur * 0.85 ? formatCountdown((start + dur * 0.85) - now) : "✓"}</div>
              <div style="color: #ef4444; grid-column: span 2; border-top: 1px dashed #334155; margin-top: 2px; padding-top: 2px;">• Despawn: ${formatCountdown(end - now)}</div>
            </div>
            <button class="btn terminate-btn" data-emergence-id="${e.id}" style="font-size: 9px; border-color:#ef4444; color:#ef4444; padding: 2px; width: 100%;">Force End</button>
          </div>
        `;
      }).join("");
    }

    return `
      <div class="location-zone" style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; padding: 10px; display: grid; grid-template-columns: 160px 1fr; gap: 15px; align-items: center;">
        <div style="border-right: 2px solid var(--accent-muted); padding-right: 8px;">
          <h3 style="margin: 0; font-size: 13px; color: var(--accent); font-weight: bold;">${loc.name}</h3>
          <span style="font-size: 9px; color: var(--text-muted); font-family: monospace;">[${loc.type}]</span>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">${contentHtml}</div>
      </div>
    `;
  }).join("");

  document.getElementById("notifications-viewport").innerHTML = currentState.notifications.slice(0, 10).map(n => 
    `<div style="font-size:11px; margin-bottom:4px; border-bottom:1px dashed #1e293b;">[${n.type}] ${n.title}</div>`
  ).join("");

  document.getElementById("journal-viewport").innerHTML = currentState.journal.slice(0, 15).map(j => 
    `<div style="font-size:11px; margin-bottom:4px;"><strong>${j.title}</strong>: ${j.text}</div>`
  ).join("");

  renderObservatory(currentState, currentEnv);
}

function renderObservatory(currentState, currentEnv) {
  const obsEl = document.getElementById("observatory-panel");
  if (!obsEl) return;
  
  if (!observatoryInitialized) {
    obsEl.innerHTML = `
      <h2 style="border-bottom: 2px solid var(--accent); padding-bottom: 5px; font-size: 1.1rem; margin-top:0;">Observatory Controls</h2>
      
      <div class="collapsible-section">
        <button class="accordion-header">Panel 1: Warp Configuration Engine <span>+</span></button>
        <div class="accordion-content hidden">
          <label style="font-size:11px; color:var(--accent);">Time Dilation Factor Selection:</label>
          <select id="obs-time-multiplier" style="background: var(--bg-primary); color: var(--text-main); border: 1px solid var(--border-color); width: 100%; padding: 4px; border-radius: 4px; margin-top: 4px;">
            <option value="1">1x Real-Time</option>
            <option value="60">60x Speed (1h / Real Min)</option>
            <option value="288">288x Warp (1d / 5 Real Min)</option>
            <option value="1440">1440x Warp (1d / 1 Real Min)</option>
          </select>
        </div>
      </div>

      <div class="collapsible-section"><button class="accordion-header">Panel 2: Coordinates <span>+</span></button><div class="accordion-content hidden" style="font-size:11px;" id="val-panel-2"></div></div>
      <div class="collapsible-section"><button class="accordion-header">Panel 3: State Backup <span>+</span></button><div class="accordion-content hidden"><button class="btn btn-sm block-btn" id="obs-manual-save">Force Save State</button><button class="btn btn-sm block-btn" id="obs-clear-save" style="margin-top:4px; color:#ef4444; border-color:#ef4444;">Wipe Memory</button></div></div>
      <div class="collapsible-section"><button class="accordion-header">Panel 4: Scheduler <span>+</span></button><div class="accordion-content hidden" style="font-size:10px;" id="val-panel-4"></div></div>
      <div class="collapsible-section"><button class="accordion-header">Panel 5: Astronomy Vectors <span>+</span></button><div class="accordion-content hidden" style="font-size:11px;" id="val-panel-5"></div></div>
      
      <div class="collapsible-section">
        <button class="accordion-header">Panel 6: Sighting Injector <span>+</span></button>
        <div class="accordion-content hidden">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
            <button class="btn btn-sm inject-btn" data-category="SOLAR">Inject Solar</button>
            <button class="btn btn-sm inject-btn" data-category="LUNAR">Inject Lunar</button>
          </div>
          <input type="number" id="obs-seal-override" placeholder="Seal Specific ID (1-360)" style="background:var(--bg-primary); color:var(--text-main); border:1px solid var(--border-color); width:100%; box-sizing:border-box; margin-top:4px; padding:4px;">
        </div>
      </div>
      
      <div class="collapsible-section"><button class="accordion-header">Panel 7: Notices <span>+</span></button><div class="accordion-content hidden" style="font-size:10px;">Logs active.</div></div>
      <div class="collapsible-section"><button class="accordion-header">Panel 8: History <span>+</span></button><div class="accordion-content hidden" style="font-size:10px;">Archive streaming.</div></div>
      <div class="collapsible-section"><button class="accordion-header">Panel 9: Metrology Diagnostics <span>+</span></button><div class="accordion-content hidden" style="font-size:10px;" id="val-panel-9"></div></div>
    `;
    observatoryInitialized = true;
    document.getElementById("obs-time-multiplier").value = timeMultiplier;
  }
  
  // Directly target text nodes without modifying structural element toggles
  const p2 = document.getElementById("val-panel-2");
  if (p2) p2.innerHTML = `<p>Sun: ${currentEnv.solarPosition.sign} ${currentEnv.solarPosition.degree}°</p><p>Moon: ${currentEnv.lunarPosition.sign} ${currentEnv.lunarPosition.degree}°</p>`;
  
  const p4 = document.getElementById("val-panel-4");
  if (p4) p4.textContent = `Queue Size: ${currentState.scheduledEvents.length} active nodes`;
  
  const p5 = document.getElementById("val-panel-5");
  if (p5) p5.innerHTML = `<p>Solar Target: #${currentState.currentSolarSeal?.id || 'None'}</p><p>Lunar Target: #${currentState.currentLunarSeal?.id || 'None'}</p>`;
  
  const p9 = document.getElementById("val-panel-9");
  if (p9) p9.innerHTML = `<p>Loop Cost: ${diagnostics.tickDurationMs.toFixed(3)}ms</p>`;
}

function setupUIEventListeners() {
  document.getElementById("toggle-obs-btn")?.addEventListener("click", () => {
    document.getElementById("observatory-panel").classList.toggle("hidden");
  });

  document.getElementById("coast-viewport")?.addEventListener("click", (e) => {
    if (e.target.classList.contains("terminate-btn")) {
      forceResolveEmergence(state, e.target.getAttribute("data-emergence-id"));
      poll();
    }
  });

  const obs = document.getElementById("observatory-panel");
  obs?.addEventListener("change", (e) => {
    if (e.target.id === "obs-time-multiplier") {
      timeMultiplier = parseInt(e.target.value, 10);
      lastRealTime = Date.now();
    }
  });

  obs?.addEventListener("click", (e) => {
    if (e.target.classList.contains("accordion-header")) {
      const content = e.target.nextElementSibling;
      content.classList.toggle("hidden");
      e.target.querySelector("span").textContent = content.classList.contains("hidden") ? "+" : "-";
    }
    if (e.target.id === "obs-manual-save") { saveState(state); poll(); }
    if (e.target.id === "obs-clear-save") { localStorage.removeItem("haulout_world_state"); location.reload(); }
    if (e.target.classList.contains("inject-btn")) {
      forceCategorizedEmergence(state, e.target.getAttribute("data-category"), document.getElementById("obs-seal-override").value);
      poll();
    }
  });
}

function saveState(s) { try { localStorage.setItem("haulout_world_state", JSON.stringify(s)); } catch(e){} }
function loadState() {
  const raw = localStorage.getItem("haulout_world_state");
  if (!raw) return createWorldState();
  try {
    const p = JSON.parse(raw);
    p.currentTime = p.currentTime ? new Date(p.currentTime) : null;
    return p;
  } catch(e) { return createWorldState(); }
}

window.addEventListener("DOMContentLoaded", start);
