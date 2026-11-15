export const RULES = [
  { error: "PB", delta: "PF", heater: "FULL (255)", fan: "OFF (0)",    hColor: "#c0392b", fColor: "#9a8e82" },
  { error: "PB", delta: "Z",  heater: "FULL (255)", fan: "OFF (0)",    hColor: "#c0392b", fColor: "#9a8e82" },
  { error: "PB", delta: "NF", heater: "HIGH (192)", fan: "OFF (0)",    hColor: "#d47c2e", fColor: "#9a8e82" },
  { error: "PM", delta: "PF", heater: "HIGH (192)", fan: "OFF (0)",    hColor: "#d47c2e", fColor: "#9a8e82" },
  { error: "PM", delta: "Z",  heater: "HIGH (192)", fan: "OFF (0)",    hColor: "#d47c2e", fColor: "#9a8e82" },
  { error: "PM", delta: "NF", heater: "LOW (50)",   fan: "HIGH (255)", hColor: "#8b5e3c", fColor: "#2e7d6b" },
  { error: "Z",  delta: "PF", heater: "LOW (50)",   fan: "LOW (80)",   hColor: "#8b5e3c", fColor: "#2e7d6b" },
  { error: "Z",  delta: "Z",  heater: "LOW (50)",   fan: "LOW (80)",   hColor: "#8b5e3c", fColor: "#2e7d6b" },
  { error: "Z",  delta: "NF", heater: "OFF (0)",    fan: "LOW (80)",   hColor: "#9a8e82", fColor: "#2e7d6b" },
  { error: "NM", delta: "PF", heater: "LOW (50)",   fan: "LOW (80)",   hColor: "#8b5e3c", fColor: "#2e7d6b" },
  { error: "NM", delta: "Z",  heater: "OFF (0)",    fan: "HIGH (255)", hColor: "#9a8e82", fColor: "#2e7d6b" },
  { error: "NM", delta: "NF", heater: "OFF (0)",    fan: "HIGH (255)", hColor: "#9a8e82", fColor: "#2e7d6b" },
  { error: "NB", delta: "PF", heater: "OFF (0)",    fan: "HIGH (255)", hColor: "#9a8e82", fColor: "#2e7d6b" },
  { error: "NB", delta: "Z",  heater: "OFF (0)",    fan: "HIGH (255)", hColor: "#9a8e82", fColor: "#2e7d6b" },
  { error: "NB", delta: "NF", heater: "OFF (0)",    fan: "HIGH (255)", hColor: "#9a8e82", fColor: "#2e7d6b" },
];

export const ERROR_MF = [
  { label: "NB", name: "Negative Big",    desc: "Suhu jauh LEBIH dari setpoint",  fn: "trapmf(−8, −5, −3, −2)" },
  { label: "NM", name: "Negative Medium", desc: "Suhu agak LEBIH dari setpoint",  fn: "trimf(−3, −1.5, 0)"     },
  { label: "Z",  name: "Zero",            desc: "Suhu TEPAT di setpoint",          fn: "trimf(−1, 0, 1)"        },
  { label: "PM", name: "Positive Medium", desc: "Suhu agak KURANG dari setpoint",  fn: "trimf(0, 1.5, 3)"       },
  { label: "PB", name: "Positive Big",    desc: "Suhu jauh KURANG dari setpoint",  fn: "trapmf(2, 3, 5, 8)"     },
];

export const DELTA_MF = [
  { label: "NF", name: "Negative Fast", desc: "Error mengecil — suhu mendekati SP", fn: "trapmf(−3, −1.5, −0.3, 0)" },
  { label: "Z",  name: "Zero",          desc: "Error stabil",                        fn: "trimf(−0.3, 0, 0.3)"       },
  { label: "PF", name: "Positive Fast", desc: "Error membesar — suhu menjauhi SP",   fn: "trapmf(0, 0.3, 1.5, 3)"    },
];

export const EMERGENCY_TEMP = 42;
export const FLOW_STEPS = [
  "DHT22 → Suhu",
  "Error = SP − T",
  "Fuzzifikasi",
  "15 Rules (Mamdani)",
  "Defuzzifikasi (COG)",
  "PWM Heater & Fan",
];
