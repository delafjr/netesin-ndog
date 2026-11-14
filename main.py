# inkubator_fuzzy.py
# Target: ESP32 + DHT22 (Pin 4) + Motor Driver MX1508
# Pin 14 → IN1 (Heater PWM), Pin 5 → IN3 (Fan PWM)
# LCD I2C: SDA=21, SCL=22

from machine import Pin, PWM, SoftI2C
import network
import urequests
import ujson
import dht
import time

# ─────────────────────────────────────────
# KONSTANTA
# ─────────────────────────────────────────
SETPOINT         = 38.0   # °C suhu target inkubator
EMERGENCY_T      = 42.0   # °C hard cutoff keselamatan telur
DHT_PIN          = 4
HEATER_PIN       = 14
FAN_PIN          = 5
SDA_PIN          = 21
SCL_PIN          = 22
PWM_FREQ         = 1000   # Hz
LOOP_DELAY_MS    = 2000   # ms per siklus
PUSH_INTERVAL_MS = 5_000  # push ke Supabase tiap 5 detik
PUSH_DELTA_T     = 0.3    # atau kalau suhu berubah > 0.3°C

SUPABASE_URL = "https://touuqnnovbguxzffoyic.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvdXVxbm5vdmJndXh6ZmZveWljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2Mzg1NzAsImV4cCI6MjExMDIxNDU3MH0.IYz9emwcybuB6gYYsRM7C1XtJ_PSV7HBrky-hO7Qmy0"
WIFI_SSID    = "Mawar1"
WIFI_PASS    = "mawar119"

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
# WIFI
# ─────────────────────────────────────────

def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    if wlan.isconnected():
        return True
    print("Connecting WiFi...")
    wlan.connect(WIFI_SSID, WIFI_PASS)
    timeout = 15
    while not wlan.isconnected() and timeout > 0:
        time.sleep(1)
        timeout -= 1
    if wlan.isconnected():
        print(f"WiFi OK: {wlan.ifconfig()[0]}")
        return True
    print("[ERR] WiFi gagal")
    return False

# ─────────────────────────────────────────
# SUPABASE
# ─────────────────────────────────────────

def push_to_supabase(temp, hum, pwm_h, pwm_f):
    try:
        payload = ujson.dumps({
            "suhu"    : temp,
            "humidity": hum,
            "heater"  : pwm_h,
            "fan"     : pwm_f,
            "setpoint": SETPOINT
        })
        headers = {
            "Content-Type" : "application/json",
            "apikey"       : SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Prefer"       : "return=minimal"
        }
        r = urequests.post(
            f"{SUPABASE_URL}/rest/v1/inkubator_log",
            data=payload,
            headers=headers
        )
        r.close()
    except Exception as e:
        print(f"[WARN] Supabase push gagal: {e}")

# ─────────────────────────────────────────
# FUZZY MEMBERSHIP FUNCTIONS
# ─────────────────────────────────────────

def trimf(x, a, b, c):
    if x <= a or x >= c:
        return 0.0
    if x == b:
        return 1.0
    if x < b:
        return (x - a) / (b - a)
    return (c - x) / (c - b)

def trapmf(x, a, b, c, d):
    if x <= a or x >= d:
        return 0.0
    if b <= x <= c:
        return 1.0
    if x < b:
        return (x - a) / (b - a)
    return (d - x) / (d - c)

# ─────────────────────────────────────────
# FUZZIFIKASI
#
# error = Setpoint - Suhu
#   (+) → suhu KURANG → heater ON
#   (-) → suhu LEBIH  → fan ON
#
# delta = error_sekarang - error_sebelumnya
#   (+) → error membesar  → suhu makin jauh
#   (-) → error mengecil  → suhu mendekati/melebihi setpoint
# ─────────────────────────────────────────

def fuzz_error(error):
    return {
        "NB": trapmf(error, -6.0, -4.0, -3.0, -2.0),
        "NM": trimf (error, -3.0, -1.5,  0.0),
        "Z" : trimf (error, -1.0,  0.0,  1.0),
        "PM": trimf (error,  0.0,  1.5,  3.0),
        "PB": trapmf(error,  2.0,  3.0,  4.0,  6.0),
    }

def fuzz_delta(delta):
    return {
        "NF": trapmf(delta, -3.0, -1.5, -0.3,  0.0),
        "Z" : trimf (delta, -0.3,  0.0,  0.3),
        "PF": trapmf(delta,  0.0,  0.3,  1.5,  3.0),
    }

# ─────────────────────────────────────────
# RULE BASE
#
# Heater: 0=OFF(0)  1=LOW(50)  2=MED(128)  3=HIGH(192)  4=FULL(255)
# Fan   : 0=OFF(0)  1=LOW(80)  2=HIGH(255)
# ─────────────────────────────────────────

RULES = {
    # Suhu jauh KURANG → heater FULL, fan OFF
    ("PB", "PF"): (4, 0),
    ("PB", "Z" ): (4, 0),
    ("PB", "NF"): (3, 0),

    # Suhu agak KURANG
    ("PM", "PF"): (3, 0),
    ("PM", "Z" ): (3, 0),
    ("PM", "NF"): (1, 2),  # naik cepat → potong heater, fan bantu

    # Suhu TEPAT
    ("Z",  "PF"): (1, 1),  # masih naik → heater rendah
    ("Z",  "Z" ): (1, 1),  # stabil → heater low, fan sirkulasi
    ("Z",  "NF"): (0, 1),  # turun → heater off, pantau

    # Suhu agak LEBIH → heater off, fan buang panas
    ("NM", "PF"): (1, 1),
    ("NM", "Z" ): (0, 2),
    ("NM", "NF"): (0, 2),

    # Suhu jauh LEBIH → heater OFF, fan FULL
    ("NB", "PF"): (0, 2),
    ("NB", "Z" ): (0, 2),
    ("NB", "NF"): (0, 2),
}

HEATER_PWM = {0: 0, 1: 50, 2: 128, 3: 192, 4: 255}
FAN_PWM    = {0: 0, 1: 80, 2: 255}

# ─────────────────────────────────────────
# FUZZY INFERENCE — Mamdani + COG defuzzifikasi
# ─────────────────────────────────────────

def fuzzy_inference(error, delta):
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
# ─────────────────────────────────────────

def emergency_cutoff(temp, pwm_h, pwm_f):
    if temp >= EMERGENCY_T:
        print(f"[EMERGENCY] Suhu {temp:.1f}C >= {EMERGENCY_T}C! Heater dimatikan.")
        return 0, 255
    return pwm_h, pwm_f

# ─────────────────────────────────────────
# LCD HELPER
# ─────────────────────────────────────────

def update_lcd(temp, hum, pwm_h, pwm_f):
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
# FAN DEAD-BAND
# ─────────────────────────────────────────

def apply_fan(pwm_f):
    MIN_FAN_PWM = 60
    if 0 < pwm_f < MIN_FAN_PWM:
        pwm_f = 0
    fan.duty(pwm_f)

# ─────────────────────────────────────────
# MAIN LOOP
# ─────────────────────────────────────────

def main():
    error          = 0.0
    prev_error     = 0.0
    last_push_ms   = 0
    last_push_temp = 0.0

    connect_wifi()

    print("=" * 42)
    print("  Inkubator Telur — Fuzzy Logic Control")
    print(f"  Setpoint : {SETPOINT}C")
    print(f"  Emergency: {EMERGENCY_T}C")
    print("=" * 42)

    while True:
        # 1. Baca sensor
        try:
            sensor.measure()
            temp = sensor.temperature()
            hum  = sensor.humidity()
        except OSError as e:
            print(f"[ERR] Gagal baca DHT22: {e}")
            heater.duty(0)
            apply_fan(80)
            time.sleep_ms(LOOP_DELAY_MS)
            continue

        # 2. Hitung error & delta
        prev_error = error
        error      = SETPOINT - temp
        delta      = error - prev_error

        # 3. Fuzzy inference
        pwm_h, pwm_f = fuzzy_inference(error, delta)

        # 4. Hard safety cutoff
        pwm_h, pwm_f = emergency_cutoff(temp, pwm_h, pwm_f)

        # 5. Aktuasi
        heater.duty(pwm_h)
        apply_fan(pwm_f)

        # 6. Push ke Supabase (tiap 5s atau delta suhu > 0.3°C)
        now_ms      = time.ticks_ms()
        interval_ok = time.ticks_diff(now_ms, last_push_ms) >= PUSH_INTERVAL_MS
        delta_ok    = abs(temp - last_push_temp) >= PUSH_DELTA_T

        if interval_ok or delta_ok:
            push_to_supabase(temp, hum, pwm_h, pwm_f)
            last_push_ms   = now_ms
            last_push_temp = temp

        # 7. Log
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