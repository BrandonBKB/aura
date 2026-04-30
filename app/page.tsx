"use client";

import { useEffect, useRef, useState } from "react";
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
  | "away"
  | "home"
  | "reset";

type Weather = "clear" | "storm" | "smoky" | "night";
type AirQuality = "good" | "poor";
type WaterStatus = "flowing" | "off" | "leak";

type Recommendation = {
  title: string;
  savings: string;
  input: string;
  plan: string;
  control: string;
};

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
  doorLocked: boolean;
  garageOpen: boolean;
  alarmArmed: boolean;
  vacuumActive: boolean;
  outlets: { kitchen: boolean; bedroom: boolean; garage: boolean };
  personPresent: boolean;
  personWalking: boolean;
  toast: string | null;
  recommendation: Recommendation | null;
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
  doorLocked: true,
  garageOpen: false,
  alarmArmed: false,
  vacuumActive: false,
  outlets: { kitchen: true, bedroom: true, garage: false },
  personPresent: true,
  personWalking: false,
  toast: null,
  recommendation: {
    title: "Pre-cool studio before 5 PM",
    savings: "Save $0.61",
    input: "Studio occupied, peak pricing in 32 min.",
    plan: "Drop studio to 71°F, ramp HVAC down before peak.",
    control: "Comfort change — AURA asks before acting.",
  },
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
  away: {
    label: "Not Home",
    blurb: "Empty house — vacuum + charging while you're out",
    icon: AwayIcon,
    apply: (s) => ({
      ...s,
      airQuality: "good",
      waterStatus: "flowing",
      leakRoom: null,
      personPresent: false,
      personWalking: false,
      lightsBrightness: 0,
      tvOn: false,
      blindsClosed: true,
      doorLocked: true,
      alarmArmed: true,
      vacuumActive: true,
      airPurifierSpeed: 1,
      batteryCharging: true,
      evCharging: false,
      exteriorLights: false,
      thermostatF: 76,
      totalPowerKw: 0.6,
    }),
    toast: "AURA: away mode — house secured, vacuum cleaning, battery charging.",
  },
  home: {
    label: "I'm Home",
    blurb: "Walking in — lights and car follow",
    icon: HomeIcon,
    apply: (s) => ({
      ...s,
      airQuality: "good",
      waterStatus: "flowing",
      leakRoom: null,
      personPresent: true,
      personWalking: true,
      lightsBrightness: 0,
      tvOn: false,
      blindsClosed: false,
      doorLocked: false,
      alarmArmed: false,
      vacuumActive: false,
      airPurifierSpeed: 1,
      batteryCharging: false,
      evCharging: false,
      exteriorLights: false,
      thermostatF: 72,
      totalPowerKw: 0.4,
    }),
    toast: "AURA: welcome home — opening up.",
  },
};

// ---------- Page ------------------------------------------------------------

export default function Page() {
  const [state, setState] = useState<AuraState>(RESET_STATE);
  const [flicker, setFlicker] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [viewTab, setViewTab] = useState<"floorplan" | "devices" | "stats" | "simple" | "privacy">("floorplan");
  const [ipadMode, setIpadMode] = useState(false);
  const sequenceTimeouts = useRef<number[]>([]);

  function clearSequence() {
    sequenceTimeouts.current.forEach((id) => window.clearTimeout(id));
    sequenceTimeouts.current = [];
  }

  function runScenario(id: ScenarioId) {
    clearSequence();
    if (id === "reset") {
      setState({ ...RESET_STATE, toast: "AURA: returning to defaults." });
      scheduleToastClear();
      return;
    }
    const def = SCENARIOS[id];
    setState((prev) => ({ ...def.apply(prev), scenario: id, toast: def.toast }));
    scheduleToastClear();

    if (id === "home") {
      sequenceTimeouts.current.push(
        window.setTimeout(() => {
          setState((s) => ({
            ...s,
            lightsBrightness: 80,
            tvOn: true,
            toast: "AURA: lights on, TV resuming.",
          }));
          scheduleToastClear();
        }, 2800),
      );
      sequenceTimeouts.current.push(
        window.setTimeout(() => {
          setState((s) => ({
            ...s,
            evCharging: true,
            batteryCharging: true,
            personWalking: false,
            totalPowerKw: 7.4,
            toast: "AURA: car plugged in, charging.",
          }));
          scheduleToastClear();
        }, 4600),
      );
    }
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

  const handleApproveRec = () => {
    setState((s) => ({
      ...s,
      recommendation: null,
      toast: "AURA: applying recommendation.",
    }));
    scheduleToastClear();
  };
  const handleDismissRec = () =>
    setState((s) => ({ ...s, recommendation: null }));

  return (
    <IPadFrame
      on={ipadMode}
      sidebar={
        <RecommendationCard
          rec={state.recommendation}
          onApprove={handleApproveRec}
          onDismiss={handleDismissRec}
        />
      }
    >
      <main className="flex flex-col h-full w-full overflow-hidden bg-[#0B1220]">
        <TopBar
          state={state}
          onOpenVoice={() => setVoiceOpen(true)}
          ipadMode={ipadMode}
          onToggleIpad={() => setIpadMode((v) => !v)}
        />

        <ViewTabs active={viewTab} onPick={setViewTab} />

        <section className="flex-1 min-h-0 flex items-center justify-center px-4 sm:px-8 py-4">
          <div className="w-full h-full max-w-[1400px] flex items-center justify-center">
            {viewTab === "floorplan" ? (
              <FloorPlan state={state} flicker={flicker} />
            ) : viewTab === "devices" ? (
              <DevicesView state={state} setState={setState} />
            ) : viewTab === "stats" ? (
              <StatsView state={state} />
            ) : viewTab === "simple" ? (
              <SimpleView state={state} setState={setState} runScenario={runScenario} />
            ) : (
              <PrivacyView />
            )}
          </div>
        </section>

        {viewTab === "floorplan" && (
          <BottomBar active={state.scenario} onPick={runScenario} />
        )}

        <VoiceMode
          open={voiceOpen}
          onClose={() => setVoiceOpen(false)}
          state={state}
          setState={setState}
          runScenario={runScenario}
        />

        <AnimatePresence>
          {state.toast && (
            <motion.div
              key={state.toast}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.25 }}
              className="absolute bottom-44 sm:bottom-36 right-3 sm:right-6 left-3 sm:left-auto z-30 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-[#0F1A30]/95 border border-[#1F2A40] backdrop-blur shadow-2xl text-xs sm:text-sm flex items-center gap-2 sm:max-w-sm"
            >
              <span className="size-2 rounded-full bg-[#5EE2C6] animate-pulse" />
              <span>{state.toast}</span>
            </motion.div>
          )}
        </AnimatePresence>

      </main>
    </IPadFrame>
  );
}

// ---------- AURA Recommends card -------------------------------------------

function RecommendationCard({
  rec,
  onApprove,
  onDismiss,
}: {
  rec: Recommendation | null;
  onApprove: () => void;
  onDismiss: () => void;
}) {
  return (
    <AnimatePresence>
      {rec && (
        <motion.div
          key={rec.title}
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="w-full rounded-2xl bg-[#0F1A30]/95 border border-[#1F2A40] backdrop-blur shadow-2xl p-4 sm:p-5"
        >
          <div className="text-[11px] font-semibold tracking-[0.18em] text-[#5EE2C6] mb-2">
            AURA RECOMMENDS
          </div>
          <div className="text-base sm:text-lg font-semibold leading-snug mb-2">
            {rec.title}
          </div>
          <div className="text-sm font-medium text-[#5EE2C6] mb-4">
            {rec.savings}
          </div>
          <div className="space-y-3 text-[12px] leading-snug mb-4">
            <div>
              <div className="text-[10px] font-semibold tracking-[0.16em] text-[#8A98B3] mb-0.5">
                INPUT
              </div>
              <div className="text-[#D6DEEC]">{rec.input}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold tracking-[0.16em] text-[#8A98B3] mb-0.5">
                PLAN
              </div>
              <div className="text-[#D6DEEC]">{rec.plan}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold tracking-[0.16em] text-[#8A98B3] mb-0.5">
                CONTROL
              </div>
              <div className="text-[#D6DEEC]">{rec.control}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onApprove}
              className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold bg-[#5EE2C6] text-[#0B1220] hover:bg-[#7BEAD3] transition-colors"
            >
              Approve
            </button>
            <button
              onClick={onDismiss}
              className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-[#1A2740] text-[#D6DEEC] border border-[#2A3A5C] hover:bg-[#243153] transition-colors"
            >
              Dismiss
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------- Top bar ---------------------------------------------------------

function TopBar({
  state,
  onOpenVoice,
  ipadMode,
  onToggleIpad,
}: {
  state: AuraState;
  onOpenVoice: () => void;
  ipadMode: boolean;
  onToggleIpad: () => void;
}) {
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
    <header className="h-[60px] flex items-center justify-between px-3 sm:px-6 border-b border-[#1F2A40] bg-[#0B1220]/80 backdrop-blur shrink-0">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <span className="size-2.5 rounded-full bg-[#5EE2C6] shadow-[0_0_10px_#5EE2C6] shrink-0" />
        <h1 className="text-base sm:text-lg font-semibold tracking-wide truncate">
          AURA
          <span className="hidden sm:inline">
            {" "}
            <span className="text-[#5EE2C6]">·</span>{" "}
            <span className="text-[#8A98B3] font-normal">Simulator</span>
          </span>
        </h1>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
        <span className="hidden sm:flex">
          <Pill label={weatherLabel[state.weather]} color="mint" />
        </span>
        <span className="hidden md:flex">
          <Pill label={aqLabel} color={aqColor as "mint" | "amber"} />
        </span>
        <Pill label={waterLabel} color={waterColor as "mint" | "amber"} />
        <Pill
          label={`${state.totalPowerKw.toFixed(1)} kW`}
          color="mint"
          mono
        />
        <button
          onClick={onToggleIpad}
          className={`hidden sm:flex ml-1 size-8 rounded-lg border items-center justify-center transition-colors ${
            ipadMode
              ? "border-[#5EE2C6] bg-[#142042] text-[#5EE2C6]"
              : "border-[#1F2A40] bg-[#0F1A30] text-[#8A98B3] hover:border-[#5EE2C6] hover:text-[#5EE2C6]"
          }`}
          title={ipadMode ? "Hide iPad frame" : "Show iPad frame"}
          aria-label="Toggle iPad frame"
        >
          <TabletIcon />
        </button>
        <button
          onClick={onOpenVoice}
          className="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium border border-[#5EE2C6]/40 bg-[#0F1A30] text-[#5EE2C6] hover:border-[#5EE2C6] hover:bg-[#142042] transition-colors flex items-center gap-1.5 shadow-[0_0_12px_rgba(94,226,198,0.12)]"
          aria-label="Talk to AURA"
        >
          <MicIcon />
          <span className="hidden sm:inline">Talk to AURA</span>
        </button>
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
    { id: "away", label: SCENARIOS.away.label, blurb: SCENARIOS.away.blurb, icon: SCENARIOS.away.icon },
    { id: "home", label: SCENARIOS.home.label, blurb: SCENARIOS.home.blurb, icon: SCENARIOS.home.icon },
    { id: "reset", label: "Reset", blurb: "Default neutral state", icon: ResetIcon },
  ];

  return (
    <footer className="border-t border-[#1F2A40] bg-[#0B1220]/80 backdrop-blur px-2 sm:px-4 py-2 sm:py-3 shrink-0">
      <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center">
        {buttons.map((b) => {
          const isActive = active === b.id;
          return (
            <button
              key={b.id}
              onClick={() => onPick(b.id)}
              className={`group relative flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2.5 rounded-xl border text-left transition-all duration-200 ${
                isActive
                  ? "border-[#5EE2C6] bg-[#0F1A30] shadow-[0_0_24px_rgba(94,226,198,0.18)]"
                  : "border-[#1F2A40] bg-[#0F1A30] hover:border-[#2A3550] hover:bg-[#142042]"
              }`}
            >
              <span
                className={`flex items-center justify-center size-7 sm:size-8 rounded-lg transition-colors shrink-0 ${
                  isActive
                    ? "bg-[#5EE2C6]/15 text-[#5EE2C6]"
                    : "bg-[#162038] text-[#8A98B3] group-hover:text-[#E6ECF5]"
                }`}
              >
                {b.icon("size-4")}
              </span>
              <span className="flex flex-col">
                <span className="text-xs sm:text-sm font-medium leading-tight">
                  {b.label}
                </span>
                <span className="hidden sm:flex text-[11px] text-[#8A98B3] leading-tight">
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
        {/* Robot vacuum + dock */}
        <Vacuum active={state.vacuumActive} />
        {/* Person — appears when home, animates in from car when arriving */}
        <Person present={state.personPresent} walking={state.personWalking} />

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
  const depth = 14;
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

  const slatCount = 3;
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

function Person({ present, walking }: { present: boolean; walking: boolean }) {
  // Walk path: from car (right side, outside) → driveway → into living room
  const pathX = [820, 820, 740, 660, 580, 520, 460, 400, 360];
  const pathY = [680, 660, 645, 645, 640, 605, 560, 525, 500];
  const finalX = pathX[pathX.length - 1];
  const finalY = pathY[pathY.length - 1];

  const visible = present || walking;

  return (
    <motion.g
      initial={false}
      animate={
        walking
          ? { x: pathX, y: pathY, opacity: 1 }
          : { x: finalX, y: finalY, opacity: visible ? 1 : 0 }
      }
      transition={
        walking
          ? { duration: 4.2, ease: "easeInOut", times: [0, 0.05, 0.2, 0.4, 0.55, 0.7, 0.82, 0.92, 1] }
          : { duration: 0.6, ease: "easeOut" }
      }
    >
      {/* Subtle ground shadow */}
      <ellipse cx="0" cy="20" rx="7" ry="2" fill="#0B1220" opacity="0.35" />
      {/* Head */}
      <circle r="5" cy="-9" fill="#FFE9B0" stroke="#A89870" strokeWidth="0.8" />
      {/* Body */}
      <rect x="-5" y="-4" width="10" height="14" rx="3" fill="#5BA8E8" stroke="#1F2A40" strokeWidth="0.6" />
      {/* Legs — sway when walking */}
      <motion.g
        animate={walking ? { rotate: [0, 10, -10, 10, -10, 0] } : { rotate: 0 }}
        transition={
          walking
            ? { duration: 0.55, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.2 }
        }
        style={{ transformOrigin: "0px 10px" }}
      >
        <line x1="-2.5" y1="10" x2="-2.5" y2="18" stroke="#3D4D6A" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="2.5" y1="10" x2="2.5" y2="18" stroke="#3D4D6A" strokeWidth="2.5" strokeLinecap="round" />
      </motion.g>
    </motion.g>
  );
}

function Vacuum({ active }: { active: boolean }) {
  const dockX = 230;
  const dockY = 565;
  const pathX = [
    dockX, dockX, 350, 400, 500, 580, 600, 700, 880, 900, 870, 810, 720, 600, 500, 350, 270, dockX,
  ];
  const pathY = [
    dockY, 410, 360, 290, 320, 250, 240, 320, 320, 240, 370, 410, 480, 540, 540, 540, 540, dockY,
  ];

  return (
    <g>
      <g>
        <rect
          x={dockX - 14}
          y={dockY + 14}
          width="28"
          height="6"
          rx="2"
          fill="#1F2A40"
          stroke={active ? "#3D4D6A" : "#5EE2C6"}
          strokeWidth="0.8"
        />
        <circle cx={dockX} cy={dockY + 17} r="1.5" fill={active ? "#3D4D6A" : "#5EE2C6"} />
      </g>

      <motion.g
        animate={active ? { x: pathX, y: pathY } : { x: dockX, y: dockY }}
        transition={
          active
            ? { duration: 26, repeat: Infinity, ease: "linear" }
            : { duration: 1.4, ease: "easeInOut" }
        }
      >
        {active && (
          <motion.circle
            r="20"
            fill="#5EE2C6"
            opacity={0.12}
            animate={{ scale: [0.8, 1.2, 0.8] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        <circle r="11" fill="#1F2A40" stroke={active ? "#5EE2C6" : "#3D4D6A"} strokeWidth="1.5" />
        <circle r="7" fill="#0F1A30" />
        <motion.g
          animate={active ? { rotate: 360 } : { rotate: 0 }}
          transition={
            active
              ? { duration: 0.6, repeat: Infinity, ease: "linear" }
              : { duration: 0.3 }
          }
          style={{ transformOrigin: "0px 0px" }}
        >
          <line
            x1="-7"
            y1="0"
            x2="7"
            y2="0"
            stroke={active ? "#5EE2C6" : "#3D4D6A"}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="0"
            y1="-7"
            x2="0"
            y2="7"
            stroke={active ? "#5EE2C6" : "#3D4D6A"}
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.6"
          />
        </motion.g>
        <circle cx="6" cy="-6" r="1.5" fill={active ? "#5EE2C6" : "#3D4D6A"} />
      </motion.g>
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

// ---------- iPad frame wrapper ----------------------------------------------

function IPadFrame({
  on,
  children,
  sidebar,
}: {
  on: boolean;
  children: React.ReactNode;
  sidebar?: React.ReactNode;
}) {
  if (!on) {
    return (
      <div className="h-screen w-full relative">
        {children}
        {sidebar && (
          <div className="fixed top-20 right-3 sm:right-6 z-40 w-[300px] sm:w-[340px] max-w-[calc(100vw-1.5rem)]">
            {sidebar}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#1A2236] via-[#0E1828] to-[#1A2236] flex items-center justify-center gap-4 sm:gap-6 p-4 sm:p-8">
      <div
        className="relative bg-[#0F141E] rounded-[44px] p-3 sm:p-4 shadow-[0_30px_80px_rgba(0,0,0,0.6)] border border-[#1F2A40] shrink"
        style={{
          width: "min(100%, 1400px)",
          aspectRatio: "16 / 10",
          maxHeight: "calc(100vh - 4rem)",
        }}
      >
        {/* Camera dot */}
        <div className="absolute top-1.5 sm:top-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
          <div className="size-1.5 rounded-full bg-[#1F2A40] border border-[#3D4D6A]" />
          <div className="size-1 rounded-full bg-[#3D4D6A]" />
        </div>
        {/* Inner screen */}
        <div className="bg-[#0B1220] rounded-[28px] overflow-hidden h-full w-full relative">
          {children}
        </div>
        {/* Home indicator pill */}
        <div className="absolute bottom-1.5 sm:bottom-2 left-1/2 -translate-x-1/2 w-20 h-[3px] rounded-full bg-[#3D4D6A]" />
      </div>
      {sidebar && (
        <div className="hidden lg:block w-[340px] shrink-0">{sidebar}</div>
      )}
    </div>
  );
}

// ---------- View tabs + devices view ----------------------------------------

function ViewTabs({
  active,
  onPick,
}: {
  active: "floorplan" | "devices" | "stats" | "simple" | "privacy";
  onPick: (v: "floorplan" | "devices" | "stats" | "simple" | "privacy") => void;
}) {
  type Id = "floorplan" | "devices" | "stats" | "simple" | "privacy";
  const tabs: { id: Id; label: string }[] = [
    { id: "floorplan", label: "Floor Plan" },
    { id: "devices", label: "Devices" },
    { id: "stats", label: "Stats for Nerds" },
    { id: "simple", label: "Simple" },
    { id: "privacy", label: "Privacy" },
  ];
  return (
    <nav className="px-2 sm:px-6 border-b border-[#1F2A40] bg-[#0B1220]/60 shrink-0">
      <div className="flex gap-0 sm:gap-1 max-w-[1400px] mx-auto overflow-x-auto sm:overflow-visible scrollbar-none">
        {tabs.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onPick(t.id)}
              className={`relative px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                isActive ? "text-[#5EE2C6]" : "text-[#8A98B3] hover:text-[#E6ECF5]"
              }`}
            >
              {t.id === "stats" ? (
                <>
                  <span className="sm:hidden">Stats</span>
                  <span className="hidden sm:inline">{t.label}</span>
                </>
              ) : t.id === "floorplan" ? (
                <>
                  <span className="sm:hidden">Plan</span>
                  <span className="hidden sm:inline">{t.label}</span>
                </>
              ) : (
                t.label
              )}
              {isActive && (
                <motion.span
                  layoutId="tab-underline"
                  className="absolute left-2 right-2 -bottom-px h-[2px] bg-[#5EE2C6] rounded-full"
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function DevicesView({
  state,
  setState,
}: {
  state: AuraState;
  setState: React.Dispatch<React.SetStateAction<AuraState>>;
}) {
  return (
    <div className="w-full h-full overflow-y-auto py-2">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-w-[1400px] mx-auto">
        <CategorySection title="Climate" summary={`${state.thermostatF}°F`}>
          <DeviceRow
            label="Whole Home"
            badge={state.thermostatF >= 74 ? "Cooling" : state.thermostatF >= 68 ? "Comfort" : "Eco"}
            value={`${state.thermostatF}°F`}
          >
            <RowAdjust
              onMinus={() =>
                setState((s) => ({ ...s, thermostatF: Math.max(60, s.thermostatF - 1) }))
              }
              onPlus={() =>
                setState((s) => ({ ...s, thermostatF: Math.min(85, s.thermostatF + 1) }))
              }
            />
          </DeviceRow>
        </CategorySection>

        <CategorySection title="Lights" summary={`${state.lightsBrightness}%`}>
          <DeviceRow
            label="All Rooms"
            badge={state.lightsBrightness === 0 ? "Off" : "On"}
            value={`${state.lightsBrightness}%`}
          >
            <RowAdjust
              onMinus={() =>
                setState((s) => ({
                  ...s,
                  lightsBrightness: Math.max(0, s.lightsBrightness - 10),
                }))
              }
              onPlus={() =>
                setState((s) => ({
                  ...s,
                  lightsBrightness: Math.min(100, s.lightsBrightness + 10),
                }))
              }
            />
          </DeviceRow>
          <DeviceRow
            label="Exterior"
            badge={state.exteriorLights ? "On" : "Off"}
            value={state.exteriorLights ? "Floods" : "—"}
          >
            <PanelToggle
              on={state.exteriorLights}
              onClick={() => setState((s) => ({ ...s, exteriorLights: !s.exteriorLights }))}
            />
          </DeviceRow>
        </CategorySection>

        <CategorySection
          title="Shades"
          summary={state.blindsClosed ? "Closed" : "Open"}
        >
          <DeviceRow
            label="All Windows"
            badge={state.blindsClosed ? "Closed" : "Open"}
            value="10 windows"
          >
            <PanelToggle
              on={!state.blindsClosed}
              onClick={() => setState((s) => ({ ...s, blindsClosed: !s.blindsClosed }))}
            />
          </DeviceRow>
        </CategorySection>

        <CategorySection title="Entertainment" summary={state.tvOn ? "On" : "Off"}>
          <DeviceRow
            label="Living Room TV"
            badge={state.tvOn ? "Streaming" : "Off"}
            value={state.tvOn ? "65″ Display" : "Off"}
          >
            <PanelToggle
              on={state.tvOn}
              onClick={() => setState((s) => ({ ...s, tvOn: !s.tvOn }))}
            />
          </DeviceRow>
          <DeviceRow label="Speakers" badge="Idle" value="Whole-home" muted>
            <PanelToggle on={false} onClick={() => undefined} />
          </DeviceRow>
        </CategorySection>

        <CategorySection title="Cameras" summary="Recording">
          <DeviceRow label="Front Door" badge="Recording" value="1080p · Clear" />
          <DeviceRow label="Backyard" badge="Recording" value="1080p · Clear" />
          <DeviceRow label="Driveway" badge="Motion 2m ago" value="1080p · Clear" muted />
        </CategorySection>

        <CategorySection
          title="Safety & Access"
          summary={state.alarmArmed ? "Armed" : "Disarmed"}
        >
          <DeviceRow
            label="Front Door Lock"
            badge={state.doorLocked ? "Locked" : "Unlocked"}
            value="Last opened 2:08 PM"
            amber={!state.doorLocked}
          >
            <PanelToggle
              on={state.doorLocked}
              onClick={() => setState((s) => ({ ...s, doorLocked: !s.doorLocked }))}
            />
          </DeviceRow>
          <DeviceRow
            label="Garage"
            badge={state.garageOpen ? "Open" : "Closed"}
            value={state.garageOpen ? "Opened 12 min ago" : "Secure"}
            amber={state.garageOpen}
          >
            <PanelToggle
              on={state.garageOpen}
              onClick={() => setState((s) => ({ ...s, garageOpen: !s.garageOpen }))}
            />
          </DeviceRow>
          <DeviceRow
            label="Alarm"
            badge={state.alarmArmed ? "Armed (Stay)" : "Disarmed"}
            value={state.alarmArmed ? "All zones active" : "Idle"}
          >
            <PanelToggle
              on={state.alarmArmed}
              onClick={() => setState((s) => ({ ...s, alarmArmed: !s.alarmArmed }))}
            />
          </DeviceRow>
        </CategorySection>

        <CategorySection
          title="Robot Vacuum"
          summary={state.vacuumActive ? "Cleaning" : "Idle"}
        >
          <DeviceRow
            label="Roomie"
            badge={state.vacuumActive ? "Cleaning" : "Docked"}
            value={state.vacuumActive ? "Living Room" : "Battery 100%"}
          >
            <button
              onClick={() => setState((s) => ({ ...s, vacuumActive: !s.vacuumActive }))}
              className="px-3 py-1.5 rounded-lg border border-[#1F2A40] bg-[#0B1220] text-[#5EE2C6] hover:border-[#5EE2C6] hover:bg-[#142042] text-xs font-medium transition-colors"
            >
              {state.vacuumActive ? "Stop" : "Start"}
            </button>
          </DeviceRow>
        </CategorySection>

        <CategorySection title="Smart Outlets" summary={`${countOutlets(state)} on`}>
          <DeviceRow
            label="Kitchen Outlet"
            badge={state.outlets.kitchen ? "On" : "Off"}
            value={state.outlets.kitchen ? "42 W" : "0 W"}
          >
            <PanelToggle
              on={state.outlets.kitchen}
              onClick={() =>
                setState((s) => ({
                  ...s,
                  outlets: { ...s.outlets, kitchen: !s.outlets.kitchen },
                }))
              }
            />
          </DeviceRow>
          <DeviceRow
            label="Bedroom Outlet"
            badge={state.outlets.bedroom ? "On" : "Off"}
            value={state.outlets.bedroom ? "18 W" : "0 W"}
          >
            <PanelToggle
              on={state.outlets.bedroom}
              onClick={() =>
                setState((s) => ({
                  ...s,
                  outlets: { ...s.outlets, bedroom: !s.outlets.bedroom },
                }))
              }
            />
          </DeviceRow>
          <DeviceRow
            label="Garage Outlet"
            badge={state.outlets.garage ? "On" : "Off"}
            value={state.outlets.garage ? "9 W" : "0 W"}
          >
            <PanelToggle
              on={state.outlets.garage}
              onClick={() =>
                setState((s) => ({
                  ...s,
                  outlets: { ...s.outlets, garage: !s.outlets.garage },
                }))
              }
            />
          </DeviceRow>
        </CategorySection>
      </div>
    </div>
  );
}

function countOutlets(s: AuraState) {
  return Number(s.outlets.kitchen) + Number(s.outlets.bedroom) + Number(s.outlets.garage);
}

function CategorySection({
  title,
  summary,
  children,
}: {
  title: string;
  summary?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#1F2A40] bg-[#0F1A30]/60 overflow-hidden">
      <header className="px-4 py-2.5 flex items-center justify-between border-b border-[#1F2A40]">
        <h3 className="text-xs uppercase tracking-wider font-semibold text-[#E6ECF5]">
          {title}
        </h3>
        {summary && <span className="text-xs text-[#5EE2C6]">{summary}</span>}
      </header>
      <div className="divide-y divide-[#1F2A40]">{children}</div>
    </section>
  );
}

function DeviceRow({
  label,
  value,
  badge,
  amber,
  muted,
  children,
}: {
  label: string;
  value: string;
  badge?: string;
  amber?: boolean;
  muted?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`px-4 py-3 flex items-center justify-between gap-3 ${
        muted ? "opacity-60" : ""
      }`}
    >
      <div className="min-w-0">
        <div className="text-sm font-medium text-[#E6ECF5] truncate">{label}</div>
        <div className="flex items-center gap-2 mt-0.5">
          {badge && (
            <span
              className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                amber
                  ? "bg-[#1A1408] text-[#F5B544] border border-[#3A2E18]"
                  : "bg-[#0B1220] text-[#8A98B3] border border-[#1F2A40]"
              }`}
            >
              {badge}
            </span>
          )}
          <span className="text-xs text-[#8A98B3] truncate">{value}</span>
        </div>
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  );
}

function RowAdjust({ onMinus, onPlus }: { onMinus: () => void; onPlus: () => void }) {
  return (
    <div className="flex gap-1.5">
      <button
        onClick={onMinus}
        className="size-8 rounded-lg border border-[#1F2A40] bg-[#0B1220] text-[#5EE2C6] hover:border-[#5EE2C6] hover:bg-[#142042] transition-colors text-sm font-medium"
      >
        −
      </button>
      <button
        onClick={onPlus}
        className="size-8 rounded-lg border border-[#1F2A40] bg-[#0B1220] text-[#5EE2C6] hover:border-[#5EE2C6] hover:bg-[#142042] transition-colors text-sm font-medium"
      >
        +
      </button>
    </div>
  );
}

// ---------- Simple view (large tap-targets, minimal text) ------------------

function SimpleView({
  state,
  setState,
  runScenario,
}: {
  state: AuraState;
  setState: React.Dispatch<React.SetStateAction<AuraState>>;
  runScenario: (id: ScenarioId) => void;
}) {
  const lightsOn = state.lightsBrightness > 0;
  return (
    <div className="w-full h-full overflow-y-auto py-4 px-3">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="text-2xl sm:text-3xl font-semibold text-[#E6ECF5]">Welcome home</h2>
          <p className="text-[#8A98B3] text-base sm:text-lg mt-1">Tap a button to control your home.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          <BigTile
            label="Lights"
            status={lightsOn ? `On · ${state.lightsBrightness}%` : "Off"}
            active={lightsOn}
            onClick={() =>
              setState((s) => ({ ...s, lightsBrightness: lightsOn ? 0 : 80 }))
            }
            icon={<TileBulb on={lightsOn} />}
          />
          <BigTile
            label="Blinds"
            status={state.blindsClosed ? "Closed" : "Open"}
            active={!state.blindsClosed}
            onClick={() => setState((s) => ({ ...s, blindsClosed: !s.blindsClosed }))}
            icon={<TileBlinds closed={state.blindsClosed} />}
          />
          <BigTile
            label="TV"
            status={state.tvOn ? "On" : "Off"}
            active={state.tvOn}
            onClick={() => setState((s) => ({ ...s, tvOn: !s.tvOn }))}
            icon={<TileTV on={state.tvOn} />}
          />
          <TempTile state={state} setState={setState} />
          <BigTile
            label="Goodnight"
            status="Tap to sleep"
            onClick={() => runScenario("goodnight")}
            icon={<TileMoon />}
          />
          <BigTile
            label="Help"
            status="Call family"
            onClick={() =>
              setState((s) => ({ ...s, toast: "AURA: calling Mary now…" }))
            }
            icon={<TilePhone />}
            danger
          />
        </div>

        <p className="text-center text-[#5A6A85] text-xs mt-6">
          Need to do more? Use the Floor Plan or Devices tabs at the top.
        </p>
      </div>
    </div>
  );
}

function BigTile({
  label,
  status,
  onClick,
  icon,
  active,
  danger,
}: {
  label: string;
  status: string;
  onClick: () => void;
  icon: React.ReactNode;
  active?: boolean;
  danger?: boolean;
}) {
  const borderColor = danger
    ? "border-[#FF6B7A]/40 hover:border-[#FF6B7A]"
    : active
    ? "border-[#5EE2C6] shadow-[0_0_24px_rgba(94,226,198,0.18)]"
    : "border-[#1F2A40] hover:border-[#5EE2C6]";
  const bg = danger ? "bg-[#1A0E10]" : active ? "bg-[#0F1A30]" : "bg-[#0F1A30]";
  const labelColor = danger ? "text-[#FF6B7A]" : "text-[#E6ECF5]";
  return (
    <button
      onClick={onClick}
      className={`${bg} ${borderColor} border-2 rounded-2xl p-5 sm:p-6 flex flex-col items-center gap-2 sm:gap-3 transition-all hover:scale-[1.02] active:scale-[0.98]`}
    >
      <div className="size-16 sm:size-20 flex items-center justify-center">{icon}</div>
      <div className={`text-lg sm:text-xl font-semibold ${labelColor}`}>{label}</div>
      <div className="text-xs sm:text-sm text-[#8A98B3]">{status}</div>
    </button>
  );
}

function TempTile({
  state,
  setState,
}: {
  state: AuraState;
  setState: React.Dispatch<React.SetStateAction<AuraState>>;
}) {
  return (
    <div className="bg-[#0F1A30] border-2 border-[#1F2A40] rounded-2xl p-5 sm:p-6 flex flex-col items-center gap-2 sm:gap-3">
      <div className="text-3xl sm:text-4xl font-semibold text-[#5EE2C6] tabular-nums">
        {state.thermostatF}°
      </div>
      <div className="text-lg sm:text-xl font-semibold text-[#E6ECF5]">Temperature</div>
      <div className="flex gap-2 mt-1">
        <button
          onClick={() =>
            setState((s) => ({ ...s, thermostatF: Math.max(60, s.thermostatF - 1) }))
          }
          className="size-10 rounded-xl border-2 border-[#1F2A40] bg-[#0B1220] text-[#5EE2C6] hover:border-[#5EE2C6] text-2xl font-bold leading-none active:scale-95 transition-all"
          aria-label="Cooler"
        >
          −
        </button>
        <button
          onClick={() =>
            setState((s) => ({ ...s, thermostatF: Math.min(85, s.thermostatF + 1) }))
          }
          className="size-10 rounded-xl border-2 border-[#1F2A40] bg-[#0B1220] text-[#5EE2C6] hover:border-[#5EE2C6] text-2xl font-bold leading-none active:scale-95 transition-all"
          aria-label="Warmer"
        >
          +
        </button>
      </div>
    </div>
  );
}

function TileBulb({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className="size-full">
      {on && <circle cx="32" cy="28" r="22" fill="#FFD27A" opacity="0.25" />}
      <path
        d="M32 8 C22 8 16 16 16 24 C16 30 18 34 22 38 L22 44 L42 44 L42 38 C46 34 48 30 48 24 C48 16 42 8 32 8 Z"
        fill={on ? "#FFE9B0" : "#1F2A40"}
        stroke={on ? "#FFD27A" : "#3D4D6A"}
        strokeWidth="2"
      />
      <rect x="22" y="46" width="20" height="6" rx="2" fill={on ? "#A89870" : "#3D4D6A"} />
      <rect x="24" y="54" width="16" height="4" rx="2" fill={on ? "#8A7860" : "#2A3550"} />
    </svg>
  );
}

function TileBlinds({ closed }: { closed: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className="size-full">
      <rect x="10" y="10" width="44" height="44" rx="4" fill="#0B1220" stroke="#3D4D6A" strokeWidth="2" />
      {closed ? (
        <>
          <rect x="12" y="14" width="40" height="36" fill="#5C4628" />
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={i}
              x1="12"
              y1={20 + i * 7}
              x2="52"
              y2={20 + i * 7}
              stroke="#3A2A14"
              strokeWidth="1"
            />
          ))}
        </>
      ) : (
        <>
          <rect x="12" y="14" width="40" height="36" fill="#9CC2DA" opacity="0.85" />
          <line x1="32" y1="14" x2="32" y2="50" stroke="#1F2A40" strokeWidth="1" />
          <line x1="12" y1="32" x2="52" y2="32" stroke="#1F2A40" strokeWidth="1" />
        </>
      )}
    </svg>
  );
}

function TileTV({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className="size-full">
      <rect x="6" y="14" width="52" height="32" rx="3" fill="#1A1F2E" stroke="#3D4D6A" strokeWidth="2" />
      <rect x="9" y="17" width="46" height="26" rx="2" fill={on ? "#0E2A48" : "#0A0F1A"} />
      {on && (
        <>
          <rect x="13" y="22" width="10" height="4" rx="1" fill="#5EE2C6" />
          <rect x="26" y="22" width="14" height="4" rx="1" fill="#FFD27A" />
          <rect x="43" y="22" width="9" height="4" rx="1" fill="#7FBEE8" />
          <rect x="13" y="30" width="22" height="3" rx="1" fill="#5EE2C6" opacity="0.7" />
        </>
      )}
      <rect x="20" y="50" width="24" height="3" rx="1" fill="#3D4D6A" />
      <rect x="14" y="54" width="36" height="3" rx="1" fill="#3D4D6A" />
    </svg>
  );
}

function TileMoon() {
  return (
    <svg viewBox="0 0 64 64" className="size-full">
      <circle cx="32" cy="32" r="22" fill="#0B1220" stroke="#5EE2C6" strokeWidth="2" />
      <path
        d="M40 14 A22 22 0 1 0 40 50 A18 18 0 1 1 40 14 Z"
        fill="#5EE2C6"
        opacity="0.85"
      />
      <circle cx="20" cy="22" r="1.5" fill="#FFD27A" />
      <circle cx="14" cy="40" r="1" fill="#FFD27A" />
      <circle cx="48" cy="48" r="1.2" fill="#FFD27A" />
    </svg>
  );
}

function TilePhone() {
  return (
    <svg viewBox="0 0 64 64" className="size-full">
      <path
        d="M14 18 L20 14 L28 22 L24 28 C26 34 30 38 36 40 L42 36 L50 44 L46 50 C32 50 14 32 14 18 Z"
        fill="#FF6B7A"
        opacity="0.9"
        stroke="#FF6B7A"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------- Privacy & Ethics ------------------------------------------------

function PrivacyView() {
  const [shareUtility, setShareUtility] = useState(false);
  const [anonAnalytics, setAnonAnalytics] = useState(false);
  const [voiceCloud, setVoiceCloud] = useState(false);
  const [cameraSharing, setCameraSharing] = useState(false);

  return (
    <div className="w-full h-full overflow-y-auto py-2 px-3">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Hero */}
        <div className="text-center pt-2 pb-2">
          <div className="inline-flex items-center justify-center size-12 rounded-2xl bg-[#0F1A30] border border-[#5EE2C6]/30 mb-3">
            <ShieldIcon />
          </div>
          <h2 className="text-2xl sm:text-3xl font-semibold text-[#E6ECF5]">
            Privacy &amp; Ethics
          </h2>
          <p className="text-[#8A98B3] mt-1.5 text-sm">
            How AURA keeps your home <em>your home</em>.
          </p>
        </div>

        {/* Trust principles */}
        <PrivacyCard title="Our principles" tone="mint">
          <ul className="space-y-2.5 text-sm text-[#E6ECF5]">
            <PrincipleRow>
              <strong className="text-[#5EE2C6]">Local first.</strong> Your home&apos;s data
              stays on a device in your home unless you choose otherwise.
            </PrincipleRow>
            <PrincipleRow>
              <strong className="text-[#5EE2C6]">You always override.</strong> Any
              automation can be paused, reversed, or disabled at any time.
            </PrincipleRow>
            <PrincipleRow>
              <strong className="text-[#5EE2C6]">Explainable.</strong> When AURA acts, it
              tells you what it did and why — never silent surveillance.
            </PrincipleRow>
            <PrincipleRow>
              <strong className="text-[#5EE2C6]">Household transparency.</strong> Anyone
              living here can see what&apos;s being collected and turn it off.
            </PrincipleRow>
          </ul>
        </PrivacyCard>

        {/* What we collect */}
        <PrivacyCard title="What we collect">
          <ul className="space-y-2 text-sm text-[#8A98B3]">
            <li className="flex items-start gap-2">
              <CheckDot />
              <span>
                <span className="text-[#E6ECF5]">Device states</span> — light brightness,
                thermostat setpoint, lock status. Stored on your local hub.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckDot />
              <span>
                <span className="text-[#E6ECF5]">Energy &amp; water usage</span> —
                aggregated by hour, kept on the hub for your own dashboard.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckDot />
              <span>
                <span className="text-[#E6ECF5]">Voice commands</span> — transcribed
                in-browser; the audio is discarded after the command runs.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckDot />
              <span>
                <span className="text-[#E6ECF5]">Camera footage</span> — encrypted, kept
                for 7 days on local storage. Never uploaded by default.
              </span>
            </li>
          </ul>
        </PrivacyCard>

        {/* What we never do */}
        <PrivacyCard title="What we never do" tone="amber">
          <ul className="space-y-2 text-sm text-[#8A98B3]">
            <li className="flex items-start gap-2">
              <NoDot />
              <span>Sell your data to advertisers, insurers, or data brokers.</span>
            </li>
            <li className="flex items-start gap-2">
              <NoDot />
              <span>Listen continuously — the mic only activates when you tap it.</span>
            </li>
            <li className="flex items-start gap-2">
              <NoDot />
              <span>Track who&apos;s home and when for any third party.</span>
            </li>
            <li className="flex items-start gap-2">
              <NoDot />
              <span>
                Make automated decisions you can&apos;t see, audit, or undo.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <NoDot />
              <span>
                Share camera or audio with law enforcement without a court order.
              </span>
            </li>
          </ul>
        </PrivacyCard>

        {/* Your controls */}
        <PrivacyCard title="Your controls">
          <div className="space-y-1">
            <PrivacyToggle
              label="Share anonymized energy data with utility"
              sub="Helps grid demand forecasting. Off by default."
              on={shareUtility}
              onClick={() => setShareUtility((v) => !v)}
            />
            <PrivacyToggle
              label="Anonymous product analytics"
              sub="Crash reports + feature usage, no identifiers."
              on={anonAnalytics}
              onClick={() => setAnonAnalytics((v) => !v)}
            />
            <PrivacyToggle
              label="Cloud voice fallback"
              sub="Use cloud transcription when offline accuracy is low."
              on={voiceCloud}
              onClick={() => setVoiceCloud((v) => !v)}
            />
            <PrivacyToggle
              label="Share cameras with neighborhood"
              sub="Off. Has serious privacy implications — review carefully."
              on={cameraSharing}
              onClick={() => setCameraSharing((v) => !v)}
            />
          </div>
          <div className="mt-4 pt-3 border-t border-[#1F2A40] text-xs text-[#8A98B3]">
            All settings are off by default. You can export or wipe everything AURA
            stores about your home from{" "}
            <span className="text-[#5EE2C6]">Settings → Data &amp; Privacy</span>.
          </div>
        </PrivacyCard>

        {/* Ethics statement */}
        <PrivacyCard title="Ethical considerations">
          <p className="text-sm text-[#8A98B3] leading-relaxed">
            A smart home is still a home. AURA is designed so that no person living
            here is monitored without their knowledge, no automation can be used to
            control or harm a household member, and no data is collected that
            wouldn&apos;t reasonably be needed to run the home itself. If you live with
            someone, they should be told this system exists and given the same access
            you have.
          </p>
          <p className="text-sm text-[#8A98B3] leading-relaxed mt-2.5">
            For domestic abuse situations, see{" "}
            <span className="text-[#5EE2C6]">aura.example/safe-exit</span> for guidance
            on regaining device control.
          </p>
        </PrivacyCard>

        <p className="text-center text-[10px] text-[#5A6A85] pt-2 pb-4">
          This is a class-project demo. Privacy claims are illustrative; a real product
          would require legal review.
        </p>
      </div>
    </div>
  );
}

function PrivacyCard({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: "mint" | "amber";
  children: React.ReactNode;
}) {
  const accent =
    tone === "amber"
      ? "border-[#3A2E18] bg-[#1A1408]/40"
      : tone === "mint"
      ? "border-[#5EE2C6]/30 bg-[#0F1A30]"
      : "border-[#1F2A40] bg-[#0F1A30]/60";
  return (
    <section className={`rounded-xl border p-4 sm:p-5 ${accent}`}>
      <h3 className="text-xs uppercase tracking-wider font-semibold text-[#E6ECF5] mb-3">
        {title}
      </h3>
      {children}
    </section>
  );
}

function PrincipleRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 leading-relaxed">
      <span className="size-1.5 rounded-full bg-[#5EE2C6] mt-1.5 shrink-0" />
      <span>{children}</span>
    </li>
  );
}

function CheckDot() {
  return (
    <span className="inline-flex items-center justify-center size-4 rounded-full bg-[#5EE2C6]/15 text-[#5EE2C6] text-[10px] mt-0.5 shrink-0">
      ✓
    </span>
  );
}

function NoDot() {
  return (
    <span className="inline-flex items-center justify-center size-4 rounded-full bg-[#F5B544]/15 text-[#F5B544] text-[10px] mt-0.5 shrink-0">
      ×
    </span>
  );
}

function PrivacyToggle({
  label,
  sub,
  on,
  onClick,
}: {
  label: string;
  sub: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-[#1F2A40] last:border-b-0">
      <div className="min-w-0">
        <div className="text-sm text-[#E6ECF5]">{label}</div>
        <div className="text-xs text-[#8A98B3] mt-0.5">{sub}</div>
      </div>
      <button
        onClick={onClick}
        className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${
          on ? "bg-[#5EE2C6]" : "bg-[#1F2A40]"
        }`}
        aria-pressed={on}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-[#0B1220] transition-transform ${
            on ? "translate-x-6" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="#5EE2C6"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-6"
    >
      <path d="M12 2 L4 6 V12 C4 17 8 21 12 22 C16 21 20 17 20 12 V6 Z" />
      <path d="M9 12 L11 14 L15 10" />
    </svg>
  );
}

// ---------- Stats for Nerds -------------------------------------------------

function StatsView({ state }: { state: AuraState }) {
  // Live values driven by state
  const solarKw = state.solarActive ? 6.2 : 0;
  const drawKw = state.totalPowerKw;
  const netKw = solarKw - drawKw;

  // Estimated daily totals (mock but plausible — varied based on current state)
  const solarToday = state.solarActive ? 38.4 : 12.6;
  const drawToday = 24.7 + (state.evCharging ? 8 : 0) + (state.vacuumActive ? 0.4 : 0);
  const exportedToday = Math.max(0, solarToday - drawToday);
  const savingsToday = (exportedToday * 0.18 + drawToday * 0.04).toFixed(2);

  // Power breakdown — sums to drawKw approximately
  const breakdown = [
    { name: "Climate", w: 1.4 + (state.thermostatF < 70 ? 0.3 : 0), color: "#5EE2C6" },
    { name: "Lights", w: (state.lightsBrightness / 100) * 0.4, color: "#FFD27A" },
    { name: "TV + Media", w: state.tvOn ? 0.18 : 0.02, color: "#7FBEE8" },
    { name: "Air Purifier", w: state.airPurifierSpeed >= 2 ? 0.09 : 0.03, color: "#A8E6F0" },
    { name: "EV Charger", w: state.evCharging ? 7.2 : 0, color: "#5EE2C6" },
    { name: "Appliances", w: 0.6, color: "#F5B544" },
    { name: "Vacuum", w: state.vacuumActive ? 0.04 : 0, color: "#C9A678" },
    { name: "Standby", w: 0.12, color: "#3D4D6A" },
  ];
  const breakdownMax = Math.max(...breakdown.map((b) => b.w), 1);

  // Water — daily gallons by fixture
  const waterUsedToday = state.waterStatus === "off" ? 142.0 : 168.4;
  const waterSavedToday = 47.2; // saved by smart fixtures vs baseline
  const waterFixtures = [
    { name: "Kitchen Sink", g: 12.4, color: "#7FBEE8" },
    { name: "Bathroom Sink", g: 8.9, color: "#5BA8E8" },
    { name: "Shower", g: 26.5, color: "#A8E6F0" },
    { name: "Toilets", g: 18.2, color: "#5EE2C6" },
    { name: "Dishwasher", g: 9.6, color: "#5EE2C6" },
    { name: "Washer", g: 22.8, color: "#7FBEE8" },
    { name: "Irrigation", g: 70.0, color: "#3FA290" },
  ];
  const fixturesMax = Math.max(...waterFixtures.map((f) => f.g));

  // Hourly power chart (24h) — sine-ish curve weighted by solar
  const hourly = Array.from({ length: 24 }).map((_, h) => {
    const sun = Math.max(0, Math.sin(((h - 6) / 12) * Math.PI)) * 5.8;
    const baseline = 1.2 + 0.7 * Math.sin((h / 24) * Math.PI * 2);
    return { hour: h, draw: Math.max(0.4, baseline), solar: sun };
  });

  // Carbon offset (kg CO2 saved this month)
  const carbonOffsetKg = 184.6;
  // Voice + automation activity
  const voiceCommands = 27;
  const automationsRun = 142;
  const devicesOnline = 31;

  return (
    <div className="w-full h-full overflow-y-auto py-2">
      <div className="max-w-[1400px] mx-auto space-y-4">
        {/* Hero stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <HeroStat
            label="Solar (now)"
            value={`${solarKw.toFixed(1)} kW`}
            sub={state.solarActive ? "Harvesting" : "Idle"}
            accent={state.solarActive ? "mint" : "muted"}
          />
          <HeroStat
            label="Battery"
            value={`${state.batteryLevel}%`}
            sub={state.batteryCharging ? "Charging" : "Idle"}
            accent={state.batteryLevel < 25 ? "amber" : "mint"}
          />
          <HeroStat
            label="Net flow"
            value={`${netKw >= 0 ? "+" : ""}${netKw.toFixed(1)} kW`}
            sub={netKw >= 0 ? "Exporting" : "Drawing"}
            accent={netKw >= 0 ? "mint" : "amber"}
          />
          <HeroStat
            label="Saved today"
            value={`$${savingsToday}`}
            sub={`${exportedToday.toFixed(1)} kWh exported`}
            accent="mint"
          />
        </div>

        {/* Power breakdown + water breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <StatPanel title="Power draw by device" right={`${drawKw.toFixed(2)} kW now`}>
            <div className="space-y-2">
              {breakdown.map((b) => (
                <div key={b.name} className="flex items-center gap-2 text-xs">
                  <div className="w-24 text-[#8A98B3] truncate">{b.name}</div>
                  <div className="flex-1 h-2 rounded-full bg-[#1F2A40] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(b.w / breakdownMax) * 100}%`,
                        backgroundColor: b.color,
                      }}
                    />
                  </div>
                  <div className="w-16 text-right tabular-nums text-[#E6ECF5]">
                    {b.w.toFixed(2)} kW
                  </div>
                </div>
              ))}
            </div>
          </StatPanel>

          <StatPanel title="Water by fixture" right={`${waterUsedToday.toFixed(1)} gal today`}>
            <div className="space-y-2">
              {waterFixtures.map((f) => (
                <div key={f.name} className="flex items-center gap-2 text-xs">
                  <div className="w-28 text-[#8A98B3] truncate">{f.name}</div>
                  <div className="flex-1 h-2 rounded-full bg-[#1F2A40] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(f.g / fixturesMax) * 100}%`,
                        backgroundColor: f.color,
                      }}
                    />
                  </div>
                  <div className="w-16 text-right tabular-nums text-[#E6ECF5]">
                    {f.g.toFixed(1)} gal
                  </div>
                </div>
              ))}
              <div className="pt-2 mt-2 border-t border-[#1F2A40] flex items-center justify-between text-xs">
                <span className="text-[#8A98B3]">Saved by smart fixtures vs baseline</span>
                <span className="text-[#5EE2C6] tabular-nums">
                  {waterSavedToday.toFixed(1)} gal · 22%
                </span>
              </div>
              {state.waterStatus === "off" && (
                <div className="text-xs text-[#F5B544] flex items-center gap-1.5 pt-1">
                  <span className="size-1.5 rounded-full bg-[#F5B544] animate-pulse" />
                  Shutoff valve closed — leak isolated
                </div>
              )}
            </div>
          </StatPanel>
        </div>

        {/* 24h power chart + activity + carbon */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2">
            <StatPanel title="24-hour power (kW)" right="Solar vs draw">
              <HourlyChart data={hourly} />
              <div className="flex items-center gap-4 text-xs text-[#8A98B3] pt-2">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-sm bg-[#FFD27A]" /> Solar
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-sm bg-[#5EE2C6]" /> Draw
                </span>
              </div>
            </StatPanel>
          </div>
          <StatPanel title="This month" right="Apr">
            <div className="space-y-3">
              <BigStat label="CO₂ offset" value={`${carbonOffsetKg.toFixed(1)} kg`} sub="≈ 412 mi not driven" />
              <BigStat label="Automations run" value={automationsRun.toString()} sub="last 24h" />
              <BigStat label="Voice commands" value={voiceCommands.toString()} sub="processed" />
              <BigStat label="Devices online" value={`${devicesOnline} / ${devicesOnline}`} sub="all healthy" />
            </div>
          </StatPanel>
        </div>

        {/* Footnote */}
        <p className="text-[10px] text-[#5A6A85] text-center pt-1 pb-3">
          Stats are simulated for demo purposes. Live values reflect current scenario state.
        </p>
      </div>
    </div>
  );
}

function HeroStat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: "mint" | "amber" | "muted";
}) {
  const valueColor =
    accent === "amber" ? "text-[#F5B544]" : accent === "muted" ? "text-[#8A98B3]" : "text-[#5EE2C6]";
  return (
    <div className="rounded-xl border border-[#1F2A40] bg-[#0F1A30] px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-[#8A98B3]">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${valueColor}`}>{value}</div>
      <div className="text-xs text-[#8A98B3] mt-0.5">{sub}</div>
    </div>
  );
}

function StatPanel({
  title,
  right,
  children,
}: {
  title: string;
  right?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#1F2A40] bg-[#0F1A30]/60 p-4">
      <header className="flex items-center justify-between mb-3">
        <h3 className="text-xs uppercase tracking-wider font-semibold text-[#E6ECF5]">{title}</h3>
        {right && <span className="text-xs text-[#5EE2C6] tabular-nums">{right}</span>}
      </header>
      {children}
    </div>
  );
}

function BigStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 pb-2.5 border-b border-[#1F2A40] last:border-b-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-xs text-[#8A98B3]">{label}</div>
        <div className="text-[10px] text-[#5A6A85]">{sub}</div>
      </div>
      <div className="text-lg font-semibold text-[#E6ECF5] tabular-nums shrink-0">{value}</div>
    </div>
  );
}

function HourlyChart({ data }: { data: { hour: number; draw: number; solar: number }[] }) {
  const w = 600;
  const h = 140;
  const pad = 16;
  const max = Math.max(...data.map((d) => Math.max(d.draw, d.solar)));
  const x = (i: number) => pad + (i / (data.length - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);

  const drawPath = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.draw).toFixed(1)}`).join(" ");
  const solarPath = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.solar).toFixed(1)}`).join(" ");
  const solarFill = `${solarPath} L${x(data.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-32 block">
      {/* Grid */}
      {[0.25, 0.5, 0.75].map((t) => (
        <line
          key={t}
          x1={pad}
          x2={w - pad}
          y1={pad + t * (h - pad * 2)}
          y2={pad + t * (h - pad * 2)}
          stroke="#1F2A40"
          strokeDasharray="2 4"
        />
      ))}
      {/* Solar fill */}
      <path d={solarFill} fill="#FFD27A" opacity="0.18" />
      <path d={solarPath} fill="none" stroke="#FFD27A" strokeWidth="1.6" />
      {/* Draw line */}
      <path d={drawPath} fill="none" stroke="#5EE2C6" strokeWidth="1.6" />
      {/* Hour ticks */}
      {[0, 6, 12, 18].map((tick) => (
        <text
          key={tick}
          x={x(tick)}
          y={h - 2}
          fontSize="9"
          fill="#5A6A85"
          textAnchor="middle"
        >
          {tick === 0 ? "12a" : tick === 12 ? "12p" : `${tick}${tick < 12 ? "a" : "p"}`}
        </text>
      ))}
    </svg>
  );
}

// ---------- Device panel + voice chat ---------------------------------------

function DevicePanel({
  open,
  onClose,
  state,
  setState,
  runScenario,
}: {
  open: boolean;
  onClose: () => void;
  state: AuraState;
  setState: React.Dispatch<React.SetStateAction<AuraState>>;
  runScenario: (id: ScenarioId) => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          />
          <motion.aside
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.32, ease: [0.6, 0, 0.2, 1] }}
            className="fixed top-0 right-0 h-full w-full sm:max-w-[420px] bg-[#0B1220] border-l border-[#1F2A40] z-50 flex flex-col shadow-2xl"
          >
            <header className="h-[60px] px-4 flex items-center justify-between border-b border-[#1F2A40] shrink-0">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-[#5EE2C6] shadow-[0_0_8px_#5EE2C6]" />
                <h2 className="font-semibold text-sm tracking-wide">Devices</h2>
              </div>
              <button
                onClick={onClose}
                className="size-8 rounded-lg border border-[#1F2A40] hover:border-[#5EE2C6] text-[#8A98B3] hover:text-[#5EE2C6] transition-colors flex items-center justify-center"
                aria-label="Close panel"
              >
                ×
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              <DeviceCard
                title="Climate"
                value={`${state.thermostatF}°F`}
                subtitle={state.thermostatF >= 74 ? "Cooling" : state.thermostatF >= 68 ? "Comfort" : "Eco"}
              >
                <div className="flex gap-1.5">
                  <PanelBtn
                    onClick={() =>
                      setState((s) => ({ ...s, thermostatF: Math.max(60, s.thermostatF - 1) }))
                    }
                  >
                    −
                  </PanelBtn>
                  <PanelBtn
                    onClick={() =>
                      setState((s) => ({ ...s, thermostatF: Math.min(85, s.thermostatF + 1) }))
                    }
                  >
                    +
                  </PanelBtn>
                </div>
              </DeviceCard>

              <DeviceCard
                title="Lights"
                value={`${state.lightsBrightness}%`}
                subtitle={state.lightsBrightness === 0 ? "Off" : "On"}
              >
                <div className="flex gap-1.5">
                  <PanelBtn
                    onClick={() =>
                      setState((s) => ({ ...s, lightsBrightness: Math.max(0, s.lightsBrightness - 10) }))
                    }
                  >
                    −
                  </PanelBtn>
                  <PanelBtn
                    onClick={() =>
                      setState((s) => ({ ...s, lightsBrightness: Math.min(100, s.lightsBrightness + 10) }))
                    }
                  >
                    +
                  </PanelBtn>
                </div>
              </DeviceCard>

              <DeviceCard
                title="Shades"
                value={state.blindsClosed ? "Closed" : "Open"}
                subtitle="All windows"
              >
                <PanelToggle
                  on={!state.blindsClosed}
                  onClick={() => setState((s) => ({ ...s, blindsClosed: !s.blindsClosed }))}
                />
              </DeviceCard>

              <DeviceCard
                title="Entertainment"
                value={state.tvOn ? "On" : "Off"}
                subtitle="Living room TV"
              >
                <PanelToggle
                  on={state.tvOn}
                  onClick={() => setState((s) => ({ ...s, tvOn: !s.tvOn }))}
                />
              </DeviceCard>

              <DeviceCard
                title="Air"
                value={state.airQuality === "good" ? "AQI 28" : "AQI 162"}
                subtitle={
                  state.airPurifierSpeed === 0
                    ? "Purifier off"
                    : state.airPurifierSpeed >= 2
                    ? "Purifier high"
                    : "Purifier low"
                }
                amber={state.airQuality !== "good"}
              />

              <DeviceCard
                title="Battery"
                value={`${state.batteryLevel}%`}
                subtitle={state.batteryCharging ? "Charging" : "Idle"}
                amber={state.batteryLevel < 25}
              >
                <div className="w-16 h-2 rounded-full bg-[#1F2A40] overflow-hidden">
                  <div
                    className="h-full bg-[#5EE2C6] transition-all duration-500"
                    style={{ width: `${state.batteryLevel}%` }}
                  />
                </div>
              </DeviceCard>
            </div>

            <VoiceChat state={state} setState={setState} runScenario={runScenario} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function DeviceCard({
  title,
  value,
  subtitle,
  amber,
  children,
}: {
  title: string;
  value: string;
  subtitle?: string;
  amber?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-3 py-2.5 rounded-xl border border-[#1F2A40] bg-[#0F1A30] flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-[#8A98B3]">{title}</div>
        <div className="flex items-baseline gap-2">
          <div
            className={`text-base font-semibold ${
              amber ? "text-[#F5B544]" : "text-[#E6ECF5]"
            }`}
          >
            {value}
          </div>
          {subtitle && <div className="text-xs text-[#8A98B3] truncate">{subtitle}</div>}
        </div>
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  );
}

function PanelBtn({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="size-8 rounded-lg border border-[#1F2A40] bg-[#0B1220] text-[#5EE2C6] hover:border-[#5EE2C6] hover:bg-[#142042] transition-colors text-sm font-medium"
    >
      {children}
    </button>
  );
}

function PanelToggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative w-12 h-6 rounded-full transition-colors ${
        on ? "bg-[#5EE2C6]" : "bg-[#1F2A40]"
      }`}
      aria-pressed={on}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-[#0B1220] transition-transform ${
          on ? "translate-x-6" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function VoiceChat({
  state,
  setState,
  runScenario,
}: {
  state: AuraState;
  setState: React.Dispatch<React.SetStateAction<AuraState>>;
  runScenario: (id: ScenarioId) => void;
}) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [history, setHistory] = useState<{ from: "user" | "aura"; text: string }[]>([
    { from: "aura", text: "Hi — try 'lights off', 'goodnight', or 'set to 70 degrees'." },
  ]);
  const [textInput, setTextInput] = useState("");
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<unknown>(null);
  const transcriptRef = useRef("");

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR =
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const Ctor = SR as new () => {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: (e: { results: { 0: { transcript: string } }[] & { length: number } }) => void;
      onend: () => void;
      onerror: () => void;
      start: () => void;
      abort: () => void;
    };
    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (event) => {
      let t = "";
      for (let i = 0; i < event.results.length; i++) {
        t += event.results[i][0].transcript;
      }
      setTranscript(t);
    };
    rec.onend = () => {
      setListening(false);
      const final = transcriptRef.current.trim();
      if (final) {
        submit(final);
        setTranscript("");
      }
    };
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    return () => {
      try {
        rec.abort();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startListening() {
    const rec = recognitionRef.current as { start: () => void } | null;
    if (!rec) return;
    setTranscript("");
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }

  function stopListening() {
    const rec = recognitionRef.current as { abort: () => void } | null;
    if (!rec) return;
    try {
      rec.abort();
    } catch {}
    setListening(false);
  }

  function submit(text: string) {
    const reply = parseCommand(text, state, setState, runScenario);
    setHistory((h) => [...h.slice(-6), { from: "user", text }, { from: "aura", text: reply }]);
  }

  function onTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = textInput.trim();
    if (!v) return;
    submit(v);
    setTextInput("");
  }

  return (
    <div className="border-t border-[#1F2A40] shrink-0 flex flex-col">
      <div className="px-3 py-2 max-h-44 overflow-y-auto space-y-1.5">
        {history.map((m, i) => (
          <div
            key={i}
            className={`text-xs leading-snug ${
              m.from === "user" ? "text-[#E6ECF5]" : "text-[#5EE2C6]"
            }`}
          >
            <span className="text-[#5A6A85] mr-1.5">
              {m.from === "user" ? "you" : "aura"}
            </span>
            {m.text}
          </div>
        ))}
        {listening && transcript && (
          <div className="text-xs leading-snug text-[#8A98B3] italic">
            <span className="text-[#5A6A85] mr-1.5">you</span>
            {transcript}
          </div>
        )}
      </div>
      <form
        onSubmit={onTextSubmit}
        className="border-t border-[#1F2A40] p-2.5 flex items-center gap-2"
      >
        {supported && (
          <button
            type="button"
            onClick={listening ? stopListening : startListening}
            className={`size-9 shrink-0 rounded-lg border flex items-center justify-center transition-colors ${
              listening
                ? "border-[#FF6B7A] bg-[#1A0E10] text-[#FF6B7A]"
                : "border-[#1F2A40] bg-[#0F1A30] text-[#5EE2C6] hover:border-[#5EE2C6]"
            }`}
            aria-label={listening ? "Stop listening" : "Start listening"}
          >
            {listening ? (
              <span className="size-2 rounded-full bg-[#FF6B7A] animate-pulse" />
            ) : (
              <MicIcon />
            )}
          </button>
        )}
        <input
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder={
            supported ? "Speak or type a command…" : "Type a command (mic not supported)…"
          }
          className="flex-1 bg-[#0F1A30] border border-[#1F2A40] rounded-lg px-3 py-2 text-sm text-[#E6ECF5] placeholder:text-[#5A6A85] focus:outline-none focus:border-[#5EE2C6]"
        />
        <button
          type="submit"
          className="px-3 py-2 rounded-lg border border-[#1F2A40] bg-[#0F1A30] text-[#5EE2C6] hover:border-[#5EE2C6] text-sm font-medium"
        >
          Send
        </button>
      </form>
    </div>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
    </svg>
  );
}

// ---------- Voice mode (modal) ----------------------------------------------

function playOpenSound() {
  if (typeof window === "undefined") return;
  try {
    type WindowWithCtx = Window & { webkitAudioContext?: typeof AudioContext };
    const w = window as unknown as WindowWithCtx;
    const Ctx = window.AudioContext || w.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const note = (freq: number, start: number, dur: number, peak = 0.13) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + start);
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(peak, now + start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.05);
    };
    note(523.25, 0, 0.28); // C5
    note(783.99, 0.09, 0.36); // G5
  } catch {
    // audio playback blocked — fail silent
  }
}

function playCloseSound() {
  if (typeof window === "undefined") return;
  try {
    type WindowWithCtx = Window & { webkitAudioContext?: typeof AudioContext };
    const w = window as unknown as WindowWithCtx;
    const Ctx = window.AudioContext || w.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(659.25, now); // E5
    osc.frequency.exponentialRampToValueAtTime(329.63, now + 0.18); // E4
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.start(now);
    osc.stop(now + 0.25);
  } catch {}
}

function AuraLogo({ listening, speaking }: { listening: boolean; speaking: boolean }) {
  const active = listening || speaking;
  const ringColor = listening ? "#5EE2C6" : speaking ? "#7FBEE8" : "#5EE2C6";
  const fast = active ? 0.95 : 2.6;

  return (
    <div className="relative size-28 sm:size-32">
      <svg viewBox="0 0 100 100" className="size-full">
        <defs>
          <radialGradient id="auralogo-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor={ringColor} stopOpacity="0.55" />
            <stop offset="100%" stopColor={ringColor} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer halo */}
        <motion.circle
          cx="50"
          cy="50"
          fill="url(#auralogo-glow)"
          animate={{
            r: active ? [40, 48, 40] : [38, 42, 38],
            opacity: active ? [0.55, 0.85, 0.55] : [0.35, 0.5, 0.35],
          }}
          transition={{ duration: fast, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Outer ring */}
        <motion.circle
          cx="50"
          cy="50"
          fill="none"
          stroke={ringColor}
          strokeWidth="1.6"
          animate={{
            r: active ? [33, 37, 33] : [33, 34, 33],
            opacity: [0.35, 0.85, 0.35],
          }}
          transition={{ duration: fast, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Middle ring */}
        <motion.circle
          cx="50"
          cy="50"
          fill="none"
          stroke={ringColor}
          strokeWidth="1.8"
          animate={{
            r: active ? [22, 26, 22] : [22.5, 23.5, 22.5],
            opacity: [0.55, 1, 0.55],
          }}
          transition={{
            duration: fast,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.25,
          }}
        />

        {/* Inner ring */}
        <motion.circle
          cx="50"
          cy="50"
          fill="none"
          stroke={ringColor}
          strokeWidth="2"
          animate={{
            r: active ? [13, 15, 13] : [13, 13.6, 13],
            opacity: [0.7, 1, 0.7],
          }}
          transition={{
            duration: fast,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.5,
          }}
        />

        {/* Core */}
        <circle cx="50" cy="50" r="6" fill="#0B1220" />
        <motion.circle
          cx="50"
          cy="50"
          fill={ringColor}
          animate={{
            r: active ? [3, 4.2, 3] : [3, 3.4, 3],
            opacity: [0.9, 1, 0.9],
          }}
          transition={{
            duration: fast,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </svg>
    </div>
  );
}

function VoiceMode({
  open,
  onClose,
  state,
  setState,
  runScenario,
}: {
  open: boolean;
  onClose: () => void;
  state: AuraState;
  setState: React.Dispatch<React.SetStateAction<AuraState>>;
  runScenario: (id: ScenarioId) => void;
}) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [history, setHistory] = useState<{ from: "user" | "aura"; text: string }[]>([]);
  const [textInput, setTextInput] = useState("");
  const [supported, setSupported] = useState(true);
  const [auraSpeaking, setAuraSpeaking] = useState(false);
  const recognitionRef = useRef<unknown>(null);
  const transcriptRef = useRef("");

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // Play activation sound when modal opens
  useEffect(() => {
    if (open) playOpenSound();
  }, [open]);

  // Speech recognition setup
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR =
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const Ctor = SR as new () => {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: (e: { results: { 0: { transcript: string } }[] & { length: number } }) => void;
      onend: () => void;
      onerror: () => void;
      start: () => void;
      abort: () => void;
    };
    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (event) => {
      let t = "";
      for (let i = 0; i < event.results.length; i++) {
        t += event.results[i][0].transcript;
      }
      setTranscript(t);
    };
    rec.onend = () => {
      setListening(false);
      const final = transcriptRef.current.trim();
      if (final) {
        submit(final);
        setTranscript("");
      }
    };
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    return () => {
      try {
        rec.abort();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startListening() {
    const rec = recognitionRef.current as { start: () => void } | null;
    if (!rec) return;
    setTranscript("");
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }

  function stopListening() {
    const rec = recognitionRef.current as { abort: () => void } | null;
    if (!rec) return;
    try {
      rec.abort();
    } catch {}
    setListening(false);
  }

  function submit(text: string) {
    const reply = parseCommand(text, state, setState, runScenario);
    setHistory((h) => [...h.slice(-4), { from: "user", text }, { from: "aura", text: reply }]);
    setAuraSpeaking(true);
    window.setTimeout(() => setAuraSpeaking(false), 1800);
  }

  function onTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = textInput.trim();
    if (!v) return;
    submit(v);
    setTextInput("");
  }

  function close() {
    if (listening) stopListening();
    playCloseSound();
    onClose();
  }

  const lastUser = history.filter((h) => h.from === "user").slice(-1)[0]?.text;
  const lastAura = history.filter((h) => h.from === "aura").slice(-1)[0]?.text;
  const statusLine = listening
    ? transcript
      ? `"${transcript}"`
      : "Listening…"
    : auraSpeaking && lastAura
    ? lastAura
    : lastUser
    ? `Last: "${lastUser}"`
    : "Tap the mic, or type below.";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="vm-bd"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
            className="absolute inset-0 bg-black/65 backdrop-blur z-50"
          />
          <motion.div
            key="vm"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.25, ease: [0.6, 0, 0.2, 1] }}
            className="absolute inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="pointer-events-auto bg-[#0B1220] border border-[#1F2A40] rounded-3xl shadow-2xl w-full max-w-md p-6 sm:p-7 relative">
              <button
                onClick={close}
                className="absolute top-3 right-3 size-8 rounded-lg border border-[#1F2A40] hover:border-[#5EE2C6] text-[#8A98B3] hover:text-[#5EE2C6] flex items-center justify-center transition-colors"
                aria-label="Close voice mode"
              >
                ×
              </button>

              <div className="flex flex-col items-center pt-1">
                <AuraLogo listening={listening} speaking={auraSpeaking} />

                <div className="mt-3 text-base sm:text-lg font-semibold text-[#E6ECF5] tracking-wide">
                  {listening ? "I'm listening" : auraSpeaking ? "AURA" : "AURA"}
                </div>
                <div className="text-xs sm:text-sm text-[#8A98B3] mt-1.5 min-h-[20px] text-center max-w-[320px]">
                  {statusLine}
                </div>

                {supported && (
                  <button
                    onClick={listening ? stopListening : startListening}
                    className={`mt-5 size-16 rounded-full border-2 flex items-center justify-center transition-all ${
                      listening
                        ? "border-[#FF6B7A] bg-[#1A0E10] text-[#FF6B7A] shadow-[0_0_24px_rgba(255,107,122,0.35)]"
                        : "border-[#5EE2C6] bg-[#0F1A30] text-[#5EE2C6] hover:bg-[#142042] shadow-[0_0_18px_rgba(94,226,198,0.25)]"
                    }`}
                    aria-label={listening ? "Stop listening" : "Start listening"}
                  >
                    {listening ? (
                      <span className="size-3 rounded-full bg-[#FF6B7A] animate-pulse" />
                    ) : (
                      <MicIcon />
                    )}
                  </button>
                )}

                <form onSubmit={onTextSubmit} className="mt-5 w-full flex gap-2">
                  <input
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder={
                      supported
                        ? "Or type a command…"
                        : "Type a command (mic not supported)…"
                    }
                    className="flex-1 bg-[#0F1A30] border border-[#1F2A40] rounded-lg px-3 py-2 text-sm text-[#E6ECF5] placeholder:text-[#5A6A85] focus:outline-none focus:border-[#5EE2C6]"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 rounded-lg border border-[#1F2A40] bg-[#0F1A30] text-[#5EE2C6] hover:border-[#5EE2C6] text-sm font-medium"
                  >
                    Send
                  </button>
                </form>

                <div className="mt-4 w-full text-[11px] text-[#5A6A85] text-center">
                  Try: &quot;goodnight&quot;, &quot;sunny mode&quot;, &quot;close blinds&quot;,
                  &quot;set to 70&quot;, &quot;I&apos;m home&quot;
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function parseCommand(
  raw: string,
  state: AuraState,
  setState: React.Dispatch<React.SetStateAction<AuraState>>,
  runScenario: (id: ScenarioId) => void,
): string {
  const t = raw.toLowerCase().trim();

  // Scenarios
  if (/(super\s+)?sunny|sun mode/.test(t)) {
    runScenario("sunny");
    return "Switching to Super Sunny.";
  }
  if (/storm|rain mode|incoming weather/.test(t)) {
    runScenario("storm");
    return "Storm mode — sealing the home.";
  }
  if (/bad air|smoke|smoky|aqi|air quality/.test(t)) {
    runScenario("badair");
    return "Sealing windows, purifier on high.";
  }
  if (/leak|water shutoff|shut off water|water emergency/.test(t)) {
    runScenario("leak");
    return "Water shut off, alert raised.";
  }
  if (/cheap energy|off.?peak|charge mode/.test(t)) {
    runScenario("cheap");
    return "Charging on cheap energy.";
  }
  if (/good\s?night|bedtime|sleep mode/.test(t)) {
    runScenario("goodnight");
    return "Goodnight — locking down.";
  }
  if (/idle|nobody home(?! mode)|no one home(?! mode)/.test(t)) {
    runScenario("idle");
    return "Idle mode — powering down.";
  }
  if (/^away|not home|leaving|going out|heading out/.test(t)) {
    runScenario("away");
    return "Away mode — securing the home.";
  }
  if (/i'?m home|welcome home|i am home|coming home|just got home/.test(t)) {
    runScenario("home");
    return "Welcome home.";
  }
  if (/^reset|default.*state|start over/.test(t)) {
    runScenario("reset");
    return "Reset to defaults.";
  }

  // Lights
  if (/(lights?|lamps?)\b.*(off|out)|turn off (the )?lights?|kill the lights?/.test(t)) {
    setState((s) => ({ ...s, lightsBrightness: 0 }));
    return "Lights off.";
  }
  if (/(lights?|lamps?)\b.*on|turn on (the )?lights?/.test(t)) {
    setState((s) => ({ ...s, lightsBrightness: 80 }));
    return "Lights on at 80%.";
  }
  if (/dim|darker/.test(t)) {
    let next = 0;
    setState((s) => {
      next = Math.max(0, s.lightsBrightness - 20);
      return { ...s, lightsBrightness: next };
    });
    return "Dimming lights.";
  }
  if (/brighten|brighter|more light/.test(t)) {
    let next = 0;
    setState((s) => {
      next = Math.min(100, s.lightsBrightness + 20);
      return { ...s, lightsBrightness: next };
    });
    return "Brightening lights.";
  }

  // Blinds / shades
  if (/(close|shut|drop).*(blinds?|shades?)/.test(t)) {
    setState((s) => ({ ...s, blindsClosed: true }));
    return "Closing blinds.";
  }
  if (/(open|raise|lift).*(blinds?|shades?)/.test(t)) {
    setState((s) => ({ ...s, blindsClosed: false }));
    return "Opening blinds.";
  }

  // TV
  if (/(tv|television)\b.*off|turn off (the )?(tv|television)/.test(t)) {
    setState((s) => ({ ...s, tvOn: false }));
    return "TV off.";
  }
  if (/(tv|television)\b.*on|turn on (the )?(tv|television)/.test(t)) {
    setState((s) => ({ ...s, tvOn: true }));
    return "TV on.";
  }

  // Thermostat — explicit number
  const tempMatch = t.match(/(\d{2,3})\s*(?:degrees?|°|f|fahrenheit)?/);
  const wantsTemp = /thermostat|temperature|temp\b|degree|cooler|warmer|set to/.test(t);
  if (wantsTemp && tempMatch) {
    const v = parseInt(tempMatch[1], 10);
    if (v >= 55 && v <= 90) {
      setState((s) => ({ ...s, thermostatF: v }));
      return `Setting thermostat to ${v}°F.`;
    }
  }
  if (/warmer|warm up|too cold|heat up/.test(t)) {
    setState((s) => ({ ...s, thermostatF: Math.min(85, s.thermostatF + 2) }));
    return "Warming up 2°F.";
  }
  if (/cooler|cool down|too hot/.test(t)) {
    setState((s) => ({ ...s, thermostatF: Math.max(60, s.thermostatF - 2) }));
    return "Cooling 2°F.";
  }

  // Lock / unlock door
  if (/(lock|secure).*(door|front door)|lock up/.test(t)) {
    setState((s) => ({ ...s, doorLocked: true }));
    return "Front door locked.";
  }
  if (/unlock.*(door|front door)/.test(t)) {
    setState((s) => ({ ...s, doorLocked: false }));
    return "Front door unlocked.";
  }

  // Garage
  if (/(close|shut).*garage/.test(t)) {
    setState((s) => ({ ...s, garageOpen: false }));
    return "Garage closed.";
  }
  if (/open.*garage/.test(t)) {
    setState((s) => ({ ...s, garageOpen: true }));
    return "Garage opening.";
  }

  // Alarm
  if (/arm.*alarm|set alarm|enable alarm/.test(t)) {
    setState((s) => ({ ...s, alarmArmed: true }));
    return "Alarm armed.";
  }
  if (/disarm.*alarm|alarm off|disable alarm/.test(t)) {
    setState((s) => ({ ...s, alarmArmed: false }));
    return "Alarm disarmed.";
  }

  // Vacuum
  if (/(start|run).*(vacuum|roomie|cleaning)/.test(t)) {
    setState((s) => ({ ...s, vacuumActive: true }));
    return "Starting vacuum.";
  }
  if (/(stop|pause|dock).*(vacuum|roomie|cleaning)/.test(t)) {
    setState((s) => ({ ...s, vacuumActive: false }));
    return "Vacuum stopping.";
  }

  return "Sorry, I didn't catch that. Try 'lights off', 'goodnight', or 'sunny mode'.";
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

function TabletIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <line x1="11" y1="18" x2="13" y2="18" />
    </svg>
  );
}

function AwayIcon(cls: string = "size-4") {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <path d="M9 21H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function HomeIcon(cls: string = "size-4") {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z" />
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
