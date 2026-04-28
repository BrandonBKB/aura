"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/* =========================================================================
   AURA Simulator — pure client-side smart home demo.
   Single-route app. All SVG inline. Scenario buttons drive a state object,
   Framer Motion handles animated transitions, no backend.
   ========================================================================= */

type ScenarioId =
  | "sunny"
  | "storm"
  | "badair"
  | "leak"
  | "cheap"
  | "goodnight"
  | "idle"
  | "reset";

type Weather = "clear" | "storm" | "smoky" | "night";
type AirQuality = "good" | "poor";
type WaterStatus = "flowing" | "off" | "leak";

type AuraState = {
  scenario: ScenarioId;
  weather: Weather;
  airQuality: AirQuality;
  waterStatus: WaterStatus;
  leakRoom: "kitchen" | "bath" | null;
  exteriorLights: boolean;
  solarActive: boolean;
  batteryLevel: number; // 0..100
  batteryCharging: boolean;
  evCharging: boolean;
  totalPowerKw: number;
  blindsClosed: boolean;
  lightsBrightness: number; // 0..100
  thermostatF: number;
  airPurifierSpeed: number; // 0..3
  tvOn: boolean;
  toast: string | null;
};

const RESET_STATE: AuraState = {
  scenario: "reset",
  weather: "clear",
  airQuality: "good",
  waterStatus: "flowing",
  leakRoom: null,
  exteriorLights: false,
  solarActive: true,
  batteryLevel: 62,
  batteryCharging: false,
  evCharging: false,
  totalPowerKw: 1.8,
  blindsClosed: false,
  lightsBrightness: 70,
  thermostatF: 72,
  airPurifierSpeed: 1,
  tvOn: true,
  toast: null,
};

const SCENARIOS: Record<
  Exclude<ScenarioId, "reset">,
  {
    label: string;
    blurb: string;
    icon: (cls?: string) => React.ReactElement;
    apply: (s: AuraState) => AuraState;
    toast: string;
  }
> = {
  sunny: {
    label: "Super Sunny",
    blurb: "Solar peaks, blinds open, lights dim",
    icon: SunIcon,
    apply: (s) => ({
      ...s,
      weather: "clear",
      airQuality: "good",
      waterStatus: "flowing",
      leakRoom: null,
      solarActive: true,
      batteryCharging: true,
      batteryLevel: Math.min(100, s.batteryLevel + 6),
      evCharging: false,
      blindsClosed: false,
      lightsBrightness: 25,
      thermostatF: 74,
      airPurifierSpeed: 1,
      exteriorLights: false,
      totalPowerKw: 0.6,
    }),
    toast: "AURA: harvesting solar, dimming lights.",
  },
  storm: {
    label: "Storm Incoming",
    blurb: "Blinds close, exterior lights on, battery discharges",
    icon: StormIcon,
    apply: (s) => ({
      ...s,
      weather: "storm",
      airQuality: "good",
      waterStatus: "flowing",
      leakRoom: null,
      solarActive: false,
      batteryCharging: false,
      batteryLevel: Math.max(8, s.batteryLevel - 4),
      evCharging: false,
      blindsClosed: true,
      lightsBrightness: 80,
      thermostatF: 70,
      airPurifierSpeed: 1,
      exteriorLights: true,
      totalPowerKw: 3.4,
    }),
    toast: "AURA: storm mode — sealing the home, drawing from battery.",
  },
  badair: {
    label: "Bad Air Quality",
    blurb: "Windows shut, purifier ramps up",
    icon: AirIcon,
    apply: (s) => ({
      ...s,
      weather: "smoky",
      airQuality: "poor",
      waterStatus: "flowing",
      leakRoom: null,
      solarActive: true,
      batteryCharging: false,
      evCharging: false,
      blindsClosed: true,
      lightsBrightness: 65,
      thermostatF: 72,
      airPurifierSpeed: 3,
      exteriorLights: false,
      totalPowerKw: 2.4,
    }),
    toast: "AURA: AQI spike — sealing windows, purifier on high.",
  },
  leak: {
    label: "Water Leak",
    blurb: "Shutoff valve closed, alert raised",
    icon: DropIcon,
    apply: (s) => ({
      ...s,
      weather: s.weather === "night" ? "night" : "clear",
      waterStatus: "off",
      leakRoom: "kitchen",
      airQuality: "good",
      solarActive: s.weather !== "night",
      batteryCharging: false,
      evCharging: false,
      blindsClosed: false,
      lightsBrightness: 70,
      thermostatF: 72,
      airPurifierSpeed: 1,
      exteriorLights: false,
      totalPowerKw: 1.6,
    }),
    toast: "AURA: leak detected at kitchen sink — water shut off.",
  },
  cheap: {
    label: "Cheap Energy",
    blurb: "EV charging, battery topping up",
    icon: BoltIcon,
    apply: (s) => ({
      ...s,
      weather: "clear",
      airQuality: "good",
      waterStatus: "flowing",
      leakRoom: null,
      solarActive: true,
      batteryCharging: true,
      batteryLevel: Math.min(100, s.batteryLevel + 3),
      evCharging: true,
      blindsClosed: false,
      lightsBrightness: 60,
      thermostatF: 72,
      airPurifierSpeed: 1,
      exteriorLights: false,
      totalPowerKw: 11.2,
    }),
    toast: "AURA: off-peak rates — charging EV and battery, saving money.",
  },
  goodnight: {
    label: "Goodnight",
    blurb: "Lights dim, blinds close, thermostat cools",
    icon: MoonIcon,
    apply: (s) => ({
      ...s,
      weather: "night",
      airQuality: "good",
      waterStatus: "flowing",
      leakRoom: null,
      solarActive: false,
      batteryCharging: false,
      batteryLevel: Math.max(15, s.batteryLevel - 2),
      evCharging: true,
      blindsClosed: true,
      lightsBrightness: 8,
      thermostatF: 68,
      airPurifierSpeed: 1,
      tvOn: false,
      exteriorLights: true,
      totalPowerKw: 0.9,
    }),
    toast: "AURA: goodnight — locking down, cooling to 68°.",
  },
  idle: {
    label: "Idle Mode",
    blurb: "No activity — power down devices",
    icon: IdleIcon,
    apply: (s) => ({
      ...s,
      airQuality: "good",
      waterStatus: "flowing",
      leakRoom: null,
      batteryCharging: false,
      evCharging: false,
      lightsBrightness: 0,
      thermostatF: 76,
      airPurifierSpeed: 1,
      tvOn: false,
      exteriorLights: false,
      totalPowerKw: 0.3,
    }),
    toast: "AURA: home is idle — powering down devices to save energy.",
  },
};

// ---------- Page ------------------------------------------------------------

export default function Page() {
  const [state, setState] = useState<AuraState>(RESET_STATE);
  const [flicker, setFlicker] = useState(false);

  function runScenario(id: ScenarioId) {
    if (id === "reset") {
      setState({ ...RESET_STATE, toast: "AURA: returning to defaults." });
      scheduleToastClear();
      return;
    }
    const def = SCENARIOS[id];
    setState((prev) => ({ ...def.apply(prev), scenario: id, toast: def.toast }));
    scheduleToastClear();
  }

  function scheduleToastClear() {
    window.setTimeout(() => {
      setState((s) => ({ ...s, toast: null }));
    }, 2000);
  }

  // ambient flicker every ~10s
  useEffect(() => {
    const id = window.setInterval(() => {
      setFlicker(true);
      window.setTimeout(() => setFlicker(false), 180);
    }, 10000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <main className="flex flex-col h-screen w-full overflow-hidden">
      <TopBar state={state} />

      <section className="flex-1 min-h-0 flex items-center justify-center px-4 sm:px-8 py-4">
        <div className="w-full h-full max-w-[1400px] flex items-center justify-center">
          <FloorPlan state={state} flicker={flicker} />
        </div>
      </section>

      <BottomBar active={state.scenario} onPick={runScenario} />

      <AnimatePresence>
        {state.toast && (
          <motion.div
            key={state.toast}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-36 right-6 z-30 px-4 py-2.5 rounded-xl bg-[#0F1A30]/95 border border-[#1F2A40] backdrop-blur shadow-2xl text-sm flex items-center gap-2 max-w-sm"
          >
            <span className="size-2 rounded-full bg-[#5EE2C6] animate-pulse" />
            <span>{state.toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

// ---------- Top bar ---------------------------------------------------------

function TopBar({ state }: { state: AuraState }) {
  const weatherLabel: Record<Weather, string> = {
    clear: "Clear · 74°F",
    storm: "Storm · 61°F",
    smoky: "Smoky · 78°F",
    night: "Night · 64°F",
  };
  const aqLabel = state.airQuality === "good" ? "AQI 28" : "AQI 162";
  const aqColor = state.airQuality === "good" ? "mint" : "amber";
  const waterLabel =
    state.waterStatus === "flowing" ? "Water OK" : "Water OFF";
  const waterColor = state.waterStatus === "flowing" ? "mint" : "amber";

  return (
    <header className="h-[60px] flex items-center justify-between px-4 sm:px-6 border-b border-[#1F2A40] bg-[#0B1220]/80 backdrop-blur">
      <div className="flex items-center gap-3">
        <span className="size-2.5 rounded-full bg-[#5EE2C6] shadow-[0_0_10px_#5EE2C6]" />
        <h1 className="text-base sm:text-lg font-semibold tracking-wide">
          AURA <span className="text-[#5EE2C6]">·</span>{" "}
          <span className="text-[#8A98B3] font-normal">Simulator</span>
        </h1>
      </div>
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <Pill label={weatherLabel[state.weather]} color="mint" />
        <Pill label={aqLabel} color={aqColor as "mint" | "amber"} />
        <Pill label={waterLabel} color={waterColor as "mint" | "amber"} />
        <Pill
          label={`${state.totalPowerKw.toFixed(1)} kW`}
          color="mint"
          mono
        />
      </div>
    </header>
  );
}

function Pill({
  label,
  color,
  mono,
}: {
  label: string;
  color: "mint" | "amber" | "rose";
  mono?: boolean;
}) {
  const colorMap = {
    mint: "border-[#1F2A40] text-[#5EE2C6] bg-[#0F1A30]",
    amber: "border-[#3A2E18] text-[#F5B544] bg-[#1A1408]",
    rose: "border-[#3A1820] text-[#FF6B7A] bg-[#1A0A10]",
  } as const;
  return (
    <motion.div
      layout
      className={`px-2.5 py-1 rounded-full border text-xs ${colorMap[color]} ${
        mono ? "font-mono" : ""
      }`}
    >
      {label}
    </motion.div>
  );
}

// ---------- Bottom bar ------------------------------------------------------

function BottomBar({
  active,
  onPick,
}: {
  active: ScenarioId;
  onPick: (id: ScenarioId) => void;
}) {
  const buttons: {
    id: ScenarioId;
    label: string;
    blurb: string;
    icon: (c?: string) => React.ReactElement;
  }[] = [
    { id: "sunny", label: SCENARIOS.sunny.label, blurb: SCENARIOS.sunny.blurb, icon: SCENARIOS.sunny.icon },
    { id: "storm", label: SCENARIOS.storm.label, blurb: SCENARIOS.storm.blurb, icon: SCENARIOS.storm.icon },
    { id: "badair", label: SCENARIOS.badair.label, blurb: SCENARIOS.badair.blurb, icon: SCENARIOS.badair.icon },
    { id: "leak", label: SCENARIOS.leak.label, blurb: SCENARIOS.leak.blurb, icon: SCENARIOS.leak.icon },
    { id: "cheap", label: SCENARIOS.cheap.label, blurb: SCENARIOS.cheap.blurb, icon: SCENARIOS.cheap.icon },
    { id: "goodnight", label: SCENARIOS.goodnight.label, blurb: SCENARIOS.goodnight.blurb, icon: SCENARIOS.goodnight.icon },
    { id: "idle", label: SCENARIOS.idle.label, blurb: SCENARIOS.idle.blurb, icon: SCENARIOS.idle.icon },
    { id: "reset", label: "Reset", blurb: "Default neutral state", icon: ResetIcon },
  ];

  return (
    <footer className="border-t border-[#1F2A40] bg-[#0B1220]/80 backdrop-blur px-3 sm:px-4 py-3">
      <div className="flex flex-wrap gap-2 justify-center">
        {buttons.map((b) => {
          const isActive = active === b.id;
          return (
            <button
              key={b.id}
              onClick={() => onPick(b.id)}
              className={`group relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-left transition-all duration-200 ${
                isActive
                  ? "border-[#5EE2C6] bg-[#0F1A30] shadow-[0_0_24px_rgba(94,226,198,0.18)]"
                  : "border-[#1F2A40] bg-[#0F1A30] hover:border-[#2A3550] hover:bg-[#142042]"
              }`}
            >
              <span
                className={`flex items-center justify-center size-8 rounded-lg transition-colors ${
                  isActive
                    ? "bg-[#5EE2C6]/15 text-[#5EE2C6]"
                    : "bg-[#162038] text-[#8A98B3] group-hover:text-[#E6ECF5]"
                }`}
              >
                {b.icon("size-4")}
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-medium leading-tight">
                  {b.label}
                </span>
                <span className="text-[11px] text-[#8A98B3] leading-tight">
                  {b.blurb}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </footer>
  );
}

// ---------- Floor plan ------------------------------------------------------

function FloorPlan({ state, flicker }: { state: AuraState; flicker: boolean }) {
  const lightOpacity = state.lightsBrightness / 100;
  const flickerMul = flicker ? 0.55 : 1;
  const isNight = state.weather === "night";
  const isStorm = state.weather === "storm";
  const isSmoky = state.weather === "smoky";
  const isSunny = state.scenario === "sunny";

  const skyTop = isNight
    ? "#0A1024"
    : isStorm
    ? "#1B2433"
    : isSmoky
    ? "#3B2A1E"
    : isSunny
    ? "#3F8FCB"
    : "#142235";
  const skyBot = isNight
    ? "#0B1220"
    : isStorm
    ? "#0F1828"
    : isSmoky
    ? "#241710"
    : isSunny
    ? "#A8D4EE"
    : "#0F1A2A";
  const grass = isNight
    ? "#1A2A1F"
    : isSmoky
    ? "#2D2A1A"
    : isSunny
    ? "#4D7E48"
    : "#22392A";

  return (
    <div className="relative w-full h-full">
      <svg
        viewBox="0 0 1200 750"
        className="w-full h-full block"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="AURA smart home floor plan"
      >
        <defs>
          <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={skyTop} />
            <stop offset="100%" stopColor={skyBot} />
          </linearGradient>
          <linearGradient id="floor" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#C9A678" />
            <stop offset="100%" stopColor="#A88758" />
          </linearGradient>
          <linearGradient id="solarOn" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#7FE3C6" />
            <stop offset="100%" stopColor="#3FA290" />
          </linearGradient>
          <linearGradient id="solarOff" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2A3550" />
            <stop offset="100%" stopColor="#1A2236" />
          </linearGradient>
          <radialGradient id="lightHalo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#FFE9B0" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#FFD27A" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#FFD27A" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="solarGlow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#5EE2C6" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#5EE2C6" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sunGlow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#FFE38A" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#FFD060" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#FFD060" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sunWash" cx="0.85" cy="0.15" r="0.9">
            <stop offset="0%" stopColor="#FFE38A" stopOpacity="0.35" />
            <stop offset="60%" stopColor="#FFE38A" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#FFE38A" stopOpacity="0" />
          </radialGradient>
          <pattern id="poolPattern" x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
            <rect width="14" height="14" fill="#2C7A9C" />
            <path d="M0 7 Q3.5 4 7 7 T14 7" fill="none" stroke="#5EB6D4" strokeWidth="1.2" opacity="0.6" />
          </pattern>
        </defs>

        <rect width="1200" height="750" fill="url(#sky)" />

        <motion.rect
          x="0"
          y="80"
          width="1200"
          height="640"
          animate={{ fill: grass }}
          transition={{ duration: 0.8 }}
          fill={grass}
        />

        {/* Yard texture flecks */}
        <g opacity="0.3">
          {Array.from({ length: 60 }).map((_, i) => (
            <circle
              key={i}
              cx={(i * 73) % 1200}
              cy={150 + ((i * 47) % 540)}
              r="1.2"
              fill="#3D5A45"
            />
          ))}
        </g>

        {/* Sunny: warm light wash + sun in corner */}
        <AnimatePresence>
          {isSunny && (
            <motion.g
              key="sun-layer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7 }}
            >
              <rect x="0" y="0" width="1200" height="750" fill="url(#sunWash)" />
              <motion.g
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                style={{ transformOrigin: "1100px 70px" }}
              >
                <circle cx="1100" cy="70" r="80" fill="url(#sunGlow)" />
                <circle cx="1100" cy="70" r="34" fill="#FFE38A" />
                <circle cx="1100" cy="70" r="26" fill="#FFD060" />
                {Array.from({ length: 8 }).map((_, i) => {
                  const angle = (i * Math.PI) / 4;
                  const x1 = 1100 + Math.cos(angle) * 42;
                  const y1 = 70 + Math.sin(angle) * 42;
                  const x2 = 1100 + Math.cos(angle) * 56;
                  const y2 = 70 + Math.sin(angle) * 56;
                  return (
                    <line
                      key={i}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#FFD060"
                      strokeWidth="3"
                      strokeLinecap="round"
                      opacity="0.85"
                    />
                  );
                })}
              </motion.g>
            </motion.g>
          )}
        </AnimatePresence>

        {/* Trees */}
        <Tree x={120} y={180} />
        <Tree x={70} y={300} small />
        <Tree x={100} y={460} />
        <Tree x={70} y={620} small />
        <Tree x={1090} y={180} />
        <Tree x={1130} y={310} small />
        <Tree x={1090} y={620} small />

        {/* Hedge bottom strip */}
        <rect x="160" y="690" width="900" height="14" rx="7" fill="#2F4A36" />
        <rect x="180" y="700" width="860" height="14" rx="7" fill="#3A5A41" />

        {/* Weather station */}
        <WeatherStation x={1060} y={150} weather={state.weather} />

        {/* Pool */}
        <g>
          <rect
            x="240"
            y="640"
            width="180"
            height="80"
            rx="14"
            fill="url(#poolPattern)"
            stroke="#1A2236"
            strokeWidth="2"
          />
          <rect
            x="232"
            y="632"
            width="196"
            height="96"
            rx="18"
            fill="none"
            stroke="#0E1828"
            strokeWidth="2"
            opacity="0.5"
          />
        </g>

        {/* EV charger + car */}
        <EvSetup x={780} y={628} active={state.evCharging} />

        {/* Home Battery */}
        <HomeBattery
          x={140}
          y={380}
          level={state.batteryLevel}
          charging={state.batteryCharging}
        />

        {/* Solar panels */}
        {[0, 1, 2, 3].map((i) => (
          <SolarPanel key={i} x={300 + i * 130} y={92} active={state.solarActive} />
        ))}

        {/* House shell */}
        <rect x="200" y="135" width="800" height="14" fill="#1F2A40" />
        <rect
          x="200"
          y="148"
          width="800"
          height="462"
          fill="#F4EFE6"
          stroke="#1F2A40"
          strokeWidth="3"
        />
        <rect
          x="210"
          y="158"
          width="780"
          height="442"
          fill="url(#floor)"
          opacity="0.85"
        />
        {/* Floor plank lines */}
        <g stroke="#8A6A40" strokeWidth="0.6" opacity="0.35">
          {Array.from({ length: 10 }).map((_, i) => (
            <line key={i} x1="210" y1={158 + i * 45} x2="990" y2={158 + i * 45} />
          ))}
        </g>

        {/* Interior walls */}
        <g stroke="#8A6A40" strokeWidth="3" opacity="0.45">
          <line x1="600" y1="158" x2="600" y2="220" />
          <line x1="600" y1="280" x2="600" y2="378" />
          <line x1="210" y1="378" x2="380" y2="378" />
          <line x1="440" y1="378" x2="780" y2="378" />
          <line x1="840" y1="378" x2="990" y2="378" />
        </g>

        {/* Room labels */}
        <g fill="#5C4628" fontSize="12" fontWeight="600" opacity="0.55">
          <text x="225" y="178">BEDROOM</text>
          <text x="615" y="178">BATHROOM</text>
          <text x="225" y="398">LIVING</text>
          <text x="615" y="398">KITCHEN</text>
        </g>

        {/* Bed (bedroom) */}
        <g>
          <rect x="240" y="220" width="160" height="100" rx="10" fill="#E8E4DA" stroke="#9A8662" strokeWidth="2" />
          <rect x="248" y="225" width="60" height="90" rx="6" fill="#B8C4D6" />
          <rect x="320" y="232" width="32" height="36" rx="5" fill="#FFFFFF" stroke="#A89870" />
          <rect x="358" y="232" width="32" height="36" rx="5" fill="#FFFFFF" stroke="#A89870" />
          <rect x="248" y="280" width="144" height="38" rx="6" fill="#BCC8D9" opacity="0.5" />
        </g>
        <rect x="408" y="232" width="40" height="40" rx="4" fill="#9A7A4E" stroke="#6F5530" />

        {/* Bathroom: toilet + sink + shower */}
        <g>
          <rect x="640" y="220" width="38" height="56" rx="10" fill="#FFFFFF" stroke="#A89870" strokeWidth="1.5" />
          <rect x="640" y="218" width="38" height="14" rx="4" fill="#E8E4DA" stroke="#A89870" />
          <rect x="700" y="220" width="180" height="44" rx="6" fill="#D8CFC0" stroke="#A89870" strokeWidth="1.5" />
          <ellipse cx="790" cy="242" rx="34" ry="14" fill="#FFFFFF" stroke="#A89870" />
          <rect x="900" y="220" width="74" height="120" rx="6" fill="#C7D8E2" opacity="0.55" stroke="#7A99B0" />
        </g>
        <WaterDroplet x={790} y={238} on={state.waterStatus === "flowing"} />

        {/* Living room: couch + coffee table + rug */}
        <g>
          <rect x="240" y="450" width="200" height="60" rx="14" fill="#445B7E" stroke="#1F2A40" strokeWidth="1.5" />
          <rect x="248" y="442" width="60" height="22" rx="6" fill="#5A7AA3" />
          <rect x="312" y="442" width="60" height="22" rx="6" fill="#5A7AA3" />
          <rect x="376" y="442" width="60" height="22" rx="6" fill="#5A7AA3" />
          <rect x="290" y="528" width="120" height="44" rx="6" fill="#7A5A36" stroke="#4A3520" />
          <rect x="232" y="438" width="220" height="148" rx="8" fill="none" stroke="#9A8662" strokeWidth="2" opacity="0.5" />
        </g>
        <AirPurifier x={490} y={508} speed={state.airPurifierSpeed} />
        {/* Bedroom purifier — only kicks on when air quality is poor */}
        <AirPurifier x={555} y={310} speed={state.airQuality === "poor" ? 3 : 0} />
        {/* TV mounted on the south wall facing the couch */}
        <TV x={272} y={580} on={state.tvOn} />

        {/* Kitchen */}
        <g>
          <rect x="640" y="430" width="180" height="80" rx="6" fill="#A47E4B" stroke="#5C4220" strokeWidth="1.5" />
          {[660, 720, 780].map((cx) => (
            <rect key={`top-${cx}`} x={cx - 14} y="412" width="28" height="14" rx="3" fill="#7A5A36" />
          ))}
          {[660, 720, 780].map((cx) => (
            <rect key={`bot-${cx}`} x={cx - 14} y="514" width="28" height="14" rx="3" fill="#7A5A36" />
          ))}
          <rect x="850" y="430" width="120" height="40" rx="4" fill="#D8CFC0" stroke="#A89870" />
          <rect x="870" y="438" width="44" height="24" rx="4" fill="#FFFFFF" stroke="#A89870" />
          <rect x="850" y="490" width="60" height="40" rx="4" fill="#2A2A2E" stroke="#1A1A1E" />
          <circle cx="865" cy="505" r="5" fill="#3A3A3E" />
          <circle cx="895" cy="505" r="5" fill="#3A3A3E" />
          <circle cx="865" cy="520" r="5" fill="#3A3A3E" />
          <circle cx="895" cy="520" r="5" fill="#3A3A3E" />
          <rect x="920" y="490" width="50" height="80" rx="4" fill="#E8E4DA" stroke="#A89870" />
          <line x1="920" y1="528" x2="970" y2="528" stroke="#A89870" />
        </g>
        <WaterDroplet x={892} y={448} on={state.waterStatus === "flowing"} />

        {/* Leak alert overlay */}
        <AnimatePresence>
          {state.leakRoom === "kitchen" && (
            <motion.g
              key="leak"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.circle
                cx="892"
                cy="450"
                fill="none"
                stroke="#FF6B7A"
                strokeWidth="2"
                animate={{ r: [22, 38, 22], opacity: [0.9, 0.1, 0.9] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
              <text
                x="892"
                y="408"
                fontSize="11"
                fontWeight="700"
                fill="#FF6B7A"
                textAnchor="middle"
              >
                ! LEAK
              </text>
            </motion.g>
          )}
        </AnimatePresence>

        {/* Windows */}
        <Window x={260} y={148} w={80} h={10} closed={state.blindsClosed} side="top" />
        <Window x={420} y={148} w={80} h={10} closed={state.blindsClosed} side="top" />
        <Window x={680} y={148} w={80} h={10} closed={state.blindsClosed} side="top" />
        <Window x={840} y={148} w={80} h={10} closed={state.blindsClosed} side="top" />
        <Window x={260} y={602} w={80} h={10} closed={state.blindsClosed} side="bottom" />
        <Window x={680} y={602} w={80} h={10} closed={state.blindsClosed} side="bottom" />
        <Window x={192} y={220} w={10} h={70} closed={state.blindsClosed} side="left" />
        <Window x={192} y={460} w={10} h={70} closed={state.blindsClosed} side="left" />
        <Window x={998} y={220} w={10} h={70} closed={state.blindsClosed} side="right" />
        <Window x={998} y={460} w={10} h={70} closed={state.blindsClosed} side="right" />

        {/* Ceiling lights */}
        <CeilingLight cx={400} cy={260} brightness={lightOpacity * flickerMul} />
        <CeilingLight cx={800} cy={260} brightness={lightOpacity * flickerMul} />
        <CeilingLight cx={400} cy={490} brightness={lightOpacity * flickerMul} />
        <CeilingLight cx={800} cy={490} brightness={lightOpacity * flickerMul} />

        {/* Smart thermostat */}
        <Thermostat x={555} y={400} tempF={state.thermostatF} />

        {/* Front door + porch lights */}
        <rect x="590" y="600" width="20" height="14" fill="#5C4628" />
        <ExteriorLight cx={580} cy={612} on={state.exteriorLights} />
        <ExteriorLight cx={620} cy={612} on={state.exteriorLights} />

        {/* Storm rain */}
        <AnimatePresence>
          {isStorm && (
            <motion.g
              key="rain"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            >
              {Array.from({ length: 50 }).map((_, i) => {
                const baseX = (i * 97) % 1200;
                const delay = (i % 12) * 0.08;
                return (
                  <motion.line
                    key={i}
                    x1={baseX}
                    y1={-20}
                    x2={baseX - 8}
                    y2={20}
                    stroke="#7AA9C6"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    initial={{ y: -40 }}
                    animate={{ y: [0, 760] }}
                    transition={{
                      duration: 0.9,
                      repeat: Infinity,
                      delay,
                      ease: "linear",
                    }}
                  />
                );
              })}
            </motion.g>
          )}
        </AnimatePresence>

        {/* Smoky overlay */}
        <AnimatePresence>
          {isSmoky && (
            <motion.rect
              key="smoke"
              width="1200"
              height="750"
              fill="#C0905C"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.18 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              style={{ mixBlendMode: "multiply" }}
            />
          )}
        </AnimatePresence>

        {/* Stars at night */}
        <AnimatePresence>
          {isNight && (
            <motion.g
              key="stars"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.9 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7 }}
            >
              {Array.from({ length: 22 }).map((_, i) => (
                <motion.circle
                  key={i}
                  cx={((i * 113) % 1180) + 10}
                  cy={((i * 31) % 70) + 12}
                  r={1.2 + (i % 3) * 0.4}
                  fill="#E6ECF5"
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{
                    duration: 2 + (i % 5) * 0.4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </motion.g>
          )}
        </AnimatePresence>
      </svg>
    </div>
  );
}

// ---------- SVG sub-components ----------------------------------------------

function SolarPanel({
  x,
  y,
  active,
}: {
  x: number;
  y: number;
  active: boolean;
}) {
  return (
    <g transform={`translate(${x},${y})`}>
      <AnimatePresence>
        {active && (
          <motion.circle
            cx="55"
            cy="22"
            r="60"
            fill="url(#solarGlow)"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.4, 0.85, 0.4] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </AnimatePresence>
      <rect
        width="110"
        height="44"
        rx="3"
        fill={active ? "url(#solarOn)" : "url(#solarOff)"}
        stroke="#0F1A30"
        strokeWidth="1.5"
      />
      <g stroke="#0F1A30" strokeWidth="0.8" opacity="0.7">
        <line x1="0" y1="14.6" x2="110" y2="14.6" />
        <line x1="0" y1="29.3" x2="110" y2="29.3" />
        <line x1="27.5" y1="0" x2="27.5" y2="44" />
        <line x1="55" y1="0" x2="55" y2="44" />
        <line x1="82.5" y1="0" x2="82.5" y2="44" />
      </g>
    </g>
  );
}

function WeatherStation({
  x,
  y,
  weather,
}: {
  x: number;
  y: number;
  weather: Weather;
}) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x="-2" y="0" width="4" height="48" fill="#5A6478" />
      <circle cx="0" cy="-8" r="3" fill="#8A98B3" />
      <motion.g
        animate={{ rotate: 360 }}
        transition={{
          duration: weather === "storm" ? 0.6 : 4,
          repeat: Infinity,
          ease: "linear",
        }}
        style={{ transformOrigin: "0px -8px" }}
      >
        <circle cx="0" cy="-22" r="3" fill="#5EE2C6" />
        <circle cx="13" cy="-8" r="3" fill="#5EE2C6" />
        <circle cx="0" cy="6" r="3" fill="#5EE2C6" />
        <circle cx="-13" cy="-8" r="3" fill="#5EE2C6" />
        <line x1="0" y1="-8" x2="0" y2="-22" stroke="#5EE2C6" strokeWidth="1.5" />
        <line x1="0" y1="-8" x2="13" y2="-8" stroke="#5EE2C6" strokeWidth="1.5" />
        <line x1="0" y1="-8" x2="0" y2="6" stroke="#5EE2C6" strokeWidth="1.5" />
        <line x1="0" y1="-8" x2="-13" y2="-8" stroke="#5EE2C6" strokeWidth="1.5" />
      </motion.g>
    </g>
  );
}

function HomeBattery({
  x,
  y,
  level,
  charging,
}: {
  x: number;
  y: number;
  level: number;
  charging: boolean;
}) {
  const pct = Math.max(0, Math.min(100, level));
  const fillColor = pct > 60 ? "#5EE2C6" : pct > 25 ? "#F5B544" : "#FF6B7A";
  return (
    <g transform={`translate(${x},${y})`}>
      <rect width="36" height="120" rx="6" fill="#0F1A30" stroke="#5EE2C6" strokeWidth="2" />
      <rect x="10" y="-6" width="16" height="6" rx="2" fill="#5EE2C6" />
      <motion.rect
        x="3"
        width="30"
        rx="3"
        fill={fillColor}
        initial={false}
        animate={{
          y: 3 + ((100 - pct) / 100) * 114,
          height: (pct / 100) * 114,
          fill: fillColor,
        }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
      />
      {charging && (
        <motion.path
          d="M18 30 l-6 24 h6 l-3 18 l9 -28 h-6 l3 -14 z"
          fill="#0B1220"
          stroke="#0B1220"
          strokeWidth="1"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        />
      )}
      <text x="18" y="138" fontSize="10" fill="#5EE2C6" textAnchor="middle" fontWeight="600">
        {pct}%
      </text>
    </g>
  );
}

function EvSetup({
  x,
  y,
  active,
}: {
  x: number;
  y: number;
  active: boolean;
}) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x="-10" y="-6" width="220" height="78" rx="6" fill="#3F4858" opacity="0.55" />
      <rect x="0" y="0" width="22" height="56" rx="4" fill="#1F2A40" stroke="#5EE2C6" strokeWidth="1.5" />
      <rect x="4" y="6" width="14" height="14" rx="2" fill={active ? "#5EE2C6" : "#2A3550"} />
      <text x="11" y="34" fontSize="8" fill="#5EE2C6" textAnchor="middle" fontWeight="700">EV</text>
      <motion.path
        d="M22 24 Q60 6 100 30"
        fill="none"
        stroke={active ? "#5EE2C6" : "#3D4D6A"}
        strokeWidth="3"
        strokeLinecap="round"
        animate={{ stroke: active ? "#5EE2C6" : "#3D4D6A" }}
        transition={{ duration: 0.5 }}
      />
      {active && (
        <motion.circle
          r="3.5"
          fill="#E6ECF5"
          animate={{ offsetDistance: ["0%", "100%"] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
          style={{ offsetPath: "path('M22 24 Q60 6 100 30')" }}
        />
      )}
      <g transform="translate(96, 6)">
        <rect width="100" height="36" rx="14" fill="#5A7AA3" stroke="#1F2A40" strokeWidth="1.5" />
        <path d="M18 6 L34 -8 H68 L84 6 Z" fill="#3E5878" stroke="#1F2A40" strokeWidth="1.2" />
        <circle cx="22" cy="38" r="7" fill="#1A1F2E" />
        <circle cx="78" cy="38" r="7" fill="#1A1F2E" />
        <circle cx="22" cy="38" r="3" fill="#3D4D6A" />
        <circle cx="78" cy="38" r="3" fill="#3D4D6A" />
      </g>
    </g>
  );
}

function Window({
  x,
  y,
  w,
  h,
  closed,
  side,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  closed: boolean;
  side: "top" | "bottom" | "left" | "right";
}) {
  const isVertical = side === "left" || side === "right";
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#9CC2DA" stroke="#1F2A40" strokeWidth="1.2" />
      {isVertical ? (
        <line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y + h} stroke="#1F2A40" strokeWidth="0.8" />
      ) : (
        <line x1={x} y1={y + h / 2} x2={x + w} y2={y + h / 2} stroke="#1F2A40" strokeWidth="0.8" />
      )}
      <Blinds x={x} y={y} w={w} h={h} closed={closed} side={side} />
    </g>
  );
}

function Blinds({
  x,
  y,
  w,
  h,
  closed,
  side,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  closed: boolean;
  side: "top" | "bottom" | "left" | "right";
}) {
  const depth = 34;
  const horizontal = side === "top" || side === "bottom";

  let panelX: number;
  let panelY: number;
  let panelW: number;
  let panelH: number;
  if (side === "top") {
    panelX = x;
    panelY = y + h;
    panelW = w;
    panelH = depth;
  } else if (side === "bottom") {
    panelX = x;
    panelY = y - depth;
    panelW = w;
    panelH = depth;
  } else if (side === "left") {
    panelX = x + w;
    panelY = y;
    panelW = depth;
    panelH = h;
  } else {
    panelX = x - depth;
    panelY = y;
    panelW = depth;
    panelH = h;
  }

  const slatCount = horizontal ? 5 : 5;
  const slats = Array.from({ length: slatCount - 1 }).map((_, i) => {
    const t = (i + 1) / slatCount;
    return horizontal
      ? { x1: panelX, y1: panelY + panelH * t, x2: panelX + panelW, y2: panelY + panelH * t }
      : { x1: panelX + panelW * t, y1: panelY, x2: panelX + panelW * t, y2: panelY + panelH };
  });

  const transformOrigin =
    side === "top"
      ? "50% 0%"
      : side === "bottom"
      ? "50% 100%"
      : side === "left"
      ? "0% 50%"
      : "100% 50%";

  return (
    <motion.g
      style={{ transformOrigin, transformBox: "fill-box" }}
      initial={false}
      animate={
        horizontal
          ? { scaleY: closed ? 1 : 0 }
          : { scaleX: closed ? 1 : 0 }
      }
      transition={{ duration: 0.7, ease: [0.6, 0, 0.2, 1] }}
    >
      <rect
        x={panelX}
        y={panelY}
        width={panelW}
        height={panelH}
        fill="#5C4628"
        stroke="#3A2A14"
        strokeWidth={0.8}
        opacity={0.95}
      />
      {slats.map((s, i) => (
        <line
          key={i}
          x1={s.x1}
          y1={s.y1}
          x2={s.x2}
          y2={s.y2}
          stroke="#3A2A14"
          strokeWidth={0.8}
          opacity={0.6}
        />
      ))}
    </motion.g>
  );
}

function CeilingLight({
  cx,
  cy,
  brightness,
}: {
  cx: number;
  cy: number;
  brightness: number;
}) {
  const haloR = 50 + brightness * 35;
  return (
    <g>
      <motion.circle
        cx={cx}
        cy={cy}
        animate={{ r: haloR, opacity: brightness * 0.85 }}
        transition={{ duration: 0.5 }}
        fill="url(#lightHalo)"
      />
      <circle cx={cx} cy={cy} r="6" fill="#FFE9B0" stroke="#A89870" strokeWidth="1.2" />
      <motion.circle
        cx={cx}
        cy={cy}
        r="6"
        fill="#FFD27A"
        animate={{ opacity: brightness }}
        transition={{ duration: 0.4 }}
      />
    </g>
  );
}

function Thermostat({
  x,
  y,
  tempF,
}: {
  x: number;
  y: number;
  tempF: number;
}) {
  const t = Math.max(0, Math.min(1, (tempF - 65) / 13));
  const color = lerpColor("#5EAFE2", "#F5B544", t);
  return (
    <g transform={`translate(${x},${y})`}>
      <rect
        x="0"
        y="-30"
        width="34"
        height="22"
        rx="4"
        fill="#0F1A30"
        stroke="#5EE2C6"
        strokeWidth="1"
      />
      <motion.text
        x="17"
        y="-15"
        fontSize="11"
        fontWeight="700"
        textAnchor="middle"
        animate={{ fill: color }}
        transition={{ duration: 0.6 }}
      >
        {tempF}°F
      </motion.text>
    </g>
  );
}

function WaterDroplet({
  x,
  y,
  on,
}: {
  x: number;
  y: number;
  on: boolean;
}) {
  return (
    <AnimatePresence>
      {on && (
        <motion.g
          key="drop"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.2, 1, 0.2] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <path
            d={`M${x} ${y - 4} q4 6 0 10 q-4 -4 0 -10 z`}
            fill="#5EAFE2"
            stroke="#3D8AB8"
            strokeWidth="0.8"
          />
        </motion.g>
      )}
    </AnimatePresence>
  );
}

function AirPurifier({
  x,
  y,
  speed,
}: {
  x: number;
  y: number;
  speed: number;
}) {
  const dur = speed === 0 ? 0 : speed === 3 ? 0.3 : speed === 2 ? 0.7 : 1.6;
  const accent = speed === 0 ? "#3D4D6A" : "#5EE2C6";
  const bladeOpacity = speed === 0 ? 0.25 : 0.65;
  const indicatorFill = speed >= 2 ? "#5EE2C6" : speed === 1 ? "#A89870" : "#3D4D6A";
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x="0" y="0" width="36" height="64" rx="8" fill="#1F2A40" stroke={accent} strokeWidth="1.2" />
      <line x1="6" y1="48" x2="30" y2="48" stroke={accent} strokeWidth="0.6" />
      <line x1="6" y1="52" x2="30" y2="52" stroke={accent} strokeWidth="0.6" />
      <line x1="6" y1="56" x2="30" y2="56" stroke={accent} strokeWidth="0.6" />
      <circle cx="30" cy="60" r="1.8" fill={indicatorFill} />
      <motion.g
        animate={dur > 0 ? { rotate: 360 } : { rotate: 0 }}
        transition={dur > 0 ? { duration: dur, repeat: Infinity, ease: "linear" } : {}}
        style={{ transformOrigin: "18px 22px" }}
      >
        <circle cx="18" cy="22" r="14" fill="none" stroke={accent} strokeWidth="1" opacity="0.6" />
        <path d="M18 22 L18 8 A14 14 0 0 1 30 28 Z" fill={accent} opacity={bladeOpacity} />
        <path d="M18 22 L18 36 A14 14 0 0 1 6 16 Z" fill={accent} opacity={bladeOpacity} />
        <circle cx="18" cy="22" r="3" fill="#0B1220" />
      </motion.g>
    </g>
  );
}

function TV({ x, y, on }: { x: number; y: number; on: boolean }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <motion.ellipse
        cx="60"
        cy="6"
        rx="78"
        ry="14"
        fill="#5BA8E8"
        animate={{ opacity: on ? 0.35 : 0 }}
        transition={{ duration: 0.5 }}
      />
      <rect x="0" y="0" width="120" height="14" rx="2" fill="#1A1F2E" stroke="#3D4D6A" strokeWidth="1" />
      <rect
        x="3"
        y="2"
        width="114"
        height="10"
        rx="1"
        fill={on ? "#0E2A48" : "#0A0F1A"}
        stroke={on ? "#5BA8E8" : "#1F2A40"}
        strokeWidth="0.6"
      />
      <AnimatePresence>
        {on && (
          <motion.g
            key="tv-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <motion.rect
              x="6"
              y="4"
              width="20"
              height="6"
              rx="1"
              fill="#5EE2C6"
              animate={{ opacity: [0.5, 0.95, 0.6] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.rect
              x="30"
              y="4"
              width="34"
              height="6"
              rx="1"
              fill="#FFD27A"
              animate={{ opacity: [0.7, 0.4, 0.85] }}
              transition={{ duration: 3.1, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.rect
              x="68"
              y="4"
              width="46"
              height="6"
              rx="1"
              fill="#7FBEE8"
              animate={{ opacity: [0.45, 0.85, 0.55] }}
              transition={{ duration: 2.7, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.g>
        )}
      </AnimatePresence>
      <rect x="56" y="14" width="8" height="3" fill="#3D4D6A" />
      <rect x="44" y="17" width="32" height="2" rx="1" fill="#3D4D6A" />
    </g>
  );
}

function ExteriorLight({
  cx,
  cy,
  on,
}: {
  cx: number;
  cy: number;
  on: boolean;
}) {
  return (
    <g>
      <motion.circle
        cx={cx}
        cy={cy}
        animate={{ r: on ? 22 : 0, opacity: on ? 0.7 : 0 }}
        transition={{ duration: 0.5 }}
        fill="url(#lightHalo)"
      />
      <circle cx={cx} cy={cy} r="3" fill={on ? "#FFD27A" : "#3D4D6A"} stroke="#A89870" strokeWidth="0.8" />
    </g>
  );
}

function Tree({ x, y, small }: { x: number; y: number; small?: boolean }) {
  const r = small ? 18 : 28;
  return (
    <g transform={`translate(${x},${y})`}>
      <circle r={r + 2} fill="#1F3327" />
      <circle r={r} fill="#3A5A41" />
      <circle r={r * 0.6} cx={-r * 0.3} cy={-r * 0.3} fill="#4F7A57" opacity="0.6" />
    </g>
  );
}

// ---------- Button icons ----------------------------------------------------

function SunIcon(cls: string = "size-4") {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function StormIcon(cls: string = "size-4") {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <path d="M19 16.9A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
      <polyline points="13,11 9,17 13,17 11,22" />
    </svg>
  );
}

function AirIcon(cls: string = "size-4") {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <path d="M3 8h12a3 3 0 1 0-3-3" />
      <path d="M3 12h17a3 3 0 1 1-3 3" />
      <path d="M3 16h9" />
    </svg>
  );
}

function DropIcon(cls: string = "size-4") {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <path d="M12 2.5s6 7 6 11.5a6 6 0 1 1-12 0c0-4.5 6-11.5 6-11.5z" />
    </svg>
  );
}

function BoltIcon(cls: string = "size-4") {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2" />
    </svg>
  );
}

function MoonIcon(cls: string = "size-4") {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function ResetIcon(cls: string = "size-4") {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}

function IdleIcon(cls: string = "size-4") {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      <line x1="12" y1="2" x2="12" y2="12" />
    </svg>
  );
}

// ---------- Util ------------------------------------------------------------

function lerpColor(a: string, b: string, t: number) {
  const ah = a.replace("#", "");
  const bh = b.replace("#", "");
  const ar = parseInt(ah.substring(0, 2), 16);
  const ag = parseInt(ah.substring(2, 4), 16);
  const ab = parseInt(ah.substring(4, 6), 16);
  const br = parseInt(bh.substring(0, 2), 16);
  const bg = parseInt(bh.substring(2, 4), 16);
  const bb = parseInt(bh.substring(4, 6), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl
    .toString(16)
    .padStart(2, "0")}`;
}
