# inkubator_fuzzy.py
# Target: ESP32 + DHT22 (Pin 4) + Motor Driver MX1508
# Pin 14 → IN1 (Heater PWM), Pin 5 → IN3 (Fan PWM)
# LCD I2C: SDA=21, SCL=22

from machine import Pin, PWM, SoftI2C
import dht
import time

# ─────────────────────────────────────────
# KONSTANTA
# ─────────────────────────────────────────
SETPOINT      = 38.0  # °C suhu target inkubator
DHT_PIN       = 4
HEATER_PIN    = 14
FAN_PIN       = 5
SDA_PIN       = 21
SCL_PIN       = 22
PWM_FREQ      = 1000  # Hz
LOOP_DELAY_MS = 2000  # 2 detik per siklus

# ─────────────────────────────────────────
# INISIALISASI HARDWARE
# ─────────────────────────────────────────
sensor = dht.DHT22(Pin(DHT_PIN))
heater = PWM(Pin(HEATER_PIN), freq=PWM_FREQ)
fan    = PWM(Pin(FAN_PIN),    freq=PWM_FREQ)

try:
    from lcd_api import LcdApi
    from i2c_lcd import I2cLcd
    i2c      = SoftI2C(sda=Pin(SDA_PIN), scl=Pin(SCL_PIN), freq=400000)
    devices  = i2c.scan()
    lcd_addr = devices[0] if devices else 0x27
    lcd      = I2cLcd(i2c, lcd_addr, 2, 16)
    USE_LCD  = True
except Exception as e:
    print(f"[WARN] LCD tidak tersedia: {e}")
    USE_LCD = False

# ─────────────────────────────────────────
# FUZZY MEMBERSHIP FUNCTIONS
# ─────────────────────────────────────────

def trimf(x: float, a: float, b: float, c: float) -> float:
    """Triangular membership function."""
    if x <= a or x >= c:
        return 0.0
    if x == b:
        return 1.0
    if x < b:
        return (x - a) / (b - a)
    return (c - x) / (c - b)

def trapmf(x: float, a: float, b: float, c: float, d: float) -> float:
    """Trapezoidal membership function."""
    if x <= a or x >= d:
        return 0.0
    if b <= x <= c:
        return 1.0
    if x < b:
        return (x - a) / (b - a)
    return (d - x) / (d - c)

# ─────────────────────────────────────────
# FUZZIFIKASI
# Konvensi:
#   Error POSITIF (+) = suhu KURANG dari setpoint → heater harus ON
#   Error NEGATIF (-) = suhu LEBIH dari setpoint  → fan harus ON
# ─────────────────────────────────────────

def fuzz_error(error: float) -> dict:
    return {
        # error negatif besar = suhu jauh di ATAS setpoint → fan FULL
        "NB": trapmf(error, -6.0, -4.0, -3.0, -2.0),
        "NM": trimf (error, -3.0, -1.5,  0.0),
        # mendekati setpoint
        "Z" : trimf (error, -1.0,  0.0,  1.0),
        "PM": trimf (error,  0.0,  1.5,  3.0),
        # error positif besar = suhu jauh di BAWAH setpoint → heater FULL
        "PB": trapmf(error,  2.0,  3.0,  4.0,  6.0),
    }

def fuzz_delta(delta: float) -> dict:
    return {
        # delta negatif = error mengecil (suhu mendekati/melebihi setpoint)
        "NF": trapmf(delta, -3.0, -1.5, -0.5,  0.0),
        "Z" : trimf (delta, -0.5,  0.0,  0.5),
        # delta positif = error membesar (suhu makin jauh dari setpoint)
        "PF": trapmf(delta,  0.0,  0.5,  1.5,  3.0),
    }

# ─────────────────────────────────────────
# RULE BASE
# (error_label, delta_label): (heater_level, fan_level)
#
# Heater level: 0=OFF(0), 1=LOW(50), 2=MED(128), 3=HIGH(192), 4=FULL(255)
# Fan level   : 0=OFF(0), 1=LOW(80), 2=HIGH(255)
#
# Logika:
#   PB (suhu jauh kurang)  → heater FULL, fan OFF
#   PM (suhu agak kurang)  → heater HIGH, fan OFF/LOW
#   Z  (suhu tepat)        → heater LOW,  fan LOW (sirkulasi)
#   NM (suhu agak lebih)   → heater OFF,  fan HIGH
#   NB (suhu jauh lebih)   → heater OFF,  fan FULL
# ─────────────────────────────────────────

RULES = {
    # Suhu jauh KURANG → heater FULL, jangan buang panas
    ("PB", "PF"): (4, 0),
    ("PB", "Z" ): (4, 0),
    ("PB", "NF"): (3, 0),

    # Suhu agak KURANG
    ("PM", "PF"): (3, 0),
    ("PM", "Z" ): (3, 0),
    ("PM", "NF"): (2, 1),  # mulai sirkulasi ringan

    # Suhu TEPAT di setpoint → heater low, fan sirkulasi
    ("Z",  "PF"): (2, 1),
    ("Z",  "Z" ): (1, 1),  # stabil → heater low, fan tetap sirkulasi
    ("Z",  "NF"): (0, 1),

    # Suhu agak LEBIH → heater off, fan buang panas
    ("NM", "PF"): (1, 1),
    ("NM", "Z" ): (0, 2),
    ("NM", "NF"): (0, 2),

    # Suhu jauh LEBIH → heater OFF, fan FULL
    ("NB", "PF"): (0, 2),
    ("NB", "Z" ): (0, 2),
    ("NB", "NF"): (0, 2),
}

# Mapping level → nilai PWM aktual
HEATER_PWM = {0: 0, 1: 50, 2: 128, 3: 192, 4: 255}
FAN_PWM    = {0: 0, 1: 80, 2: 255}

# ─────────────────────────────────────────
# FUZZY INFERENCE — Mamdani + COG defuzzifikasi
# ─────────────────────────────────────────

def fuzzy_inference(error: float, delta: float) -> tuple:
    mu_e = fuzz_error(error)
    mu_d = fuzz_delta(delta)

    heater_num = heater_den = 0.0
    fan_num    = fan_den    = 0.0

    for (el, dl), (hl, fl) in RULES.items():
        strength = min(mu_e.get(el, 0.0), mu_d.get(dl, 0.0))
        if strength <= 0.0:
            continue

        heater_num += strength * HEATER_PWM[hl]
        heater_den += strength
        fan_num    += strength * FAN_PWM[fl]
        fan_den    += strength

    pwm_h = int(heater_num / heater_den) if heater_den > 0.0 else 0
    pwm_f = int(fan_num    / fan_den)    if fan_den    > 0.0 else 0

    return pwm_h, pwm_f

# ─────────────────────────────────────────
# PROTEKSI OVERTEMPERATURE
# Hard cutoff independen dari fuzzy
# ─────────────────────────────────────────

def emergency_cutoff(temp: float, pwm_h: int, pwm_f: int) -> tuple:
    """Matikan heater paksa jika suhu >= 42°C untuk keselamatan telur."""
    if temp >= 42.0:
        print(f"[EMERGENCY] Suhu {temp:.1f}C! Heater dimatikan paksa.")
        return 0, 255
    return pwm_h, pwm_f

# ─────────────────────────────────────────
# LCD HELPER
# ─────────────────────────────────────────

def update_lcd(temp: float, hum: float, pwm_h: int, pwm_f: int):
    if not USE_LCD:
        return
    try:
        lcd.clear()
        lcd.putstr(f"T:{temp:.1f}C H:{hum:.0f}%")
        lcd.move_to(0, 1)
        lcd.putstr(f"Htr:{pwm_h:3d} Fan:{pwm_f:3d}")
    except Exception as e:
        print(f"[LCD ERR] {e}")

# ─────────────────────────────────────────
# MAIN LOOP
# ─────────────────────────────────────────

def main():
    error      = 0.0
    prev_error = 0.0

    print("=" * 40)
    print(" Inkubator Telur — Fuzzy Logic Control")
    print(f" Setpoint : {SETPOINT}C")
    print(f" Emergency: 42.0C")
    print("=" * 40)

    while True:
        # 1. Baca sensor DHT22
        try:
            sensor.measure()
            temp = sensor.temperature()
            hum  = sensor.humidity()
        except OSError as e:
            print(f"[ERR] Gagal baca DHT22: {e}")
            # Matikan heater saat sensor error — fail-safe
            heater.duty(0)
            fan.duty(80)
            time.sleep_ms(LOOP_DELAY_MS)
            continue

        # 2. Hitung error & delta error
        prev_error = error
        error      = SETPOINT - temp
        delta      = error - prev_error

        # 3. Fuzzy inference
        pwm_h, pwm_f = fuzzy_inference(error, delta)

        # 4. Hard safety cutoff
        pwm_h, pwm_f = emergency_cutoff(temp, pwm_h, pwm_f)

        # 5. Aktuasi
        heater.duty(pwm_h)
        fan.duty(pwm_f)

        # 6. Output
        update_lcd(temp, hum, pwm_h, pwm_f)
        print(
            f"[{time.ticks_ms() // 1000:6d}s] "
            f"Suhu={temp:.2f}C | Err={error:+.2f} | dErr={delta:+.2f} | "
            f"Heater={pwm_h:3d} | Fan={pwm_f:3d}"
        )

        time.sleep_ms(LOOP_DELAY_MS)

# ─────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────
if __name__ == "__main__":
    main()