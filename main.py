from machine import Pin, PWM, I2C
import time
import dht
from machine_i2c_lcd import I2cLcd

# ===================== KONFIGURASI PIN =====================
DHT_PIN         = 4
RELAY_PIN       = 5
LED_VACTROL_PIN = 14

I2C_SDA  = 21
I2C_SCL  = 22
LCD_ADDR = 0x27
LCD_COLS = 16
LCD_ROWS = 2

# ===================== INISIALISASI ========================
dht_sensor = dht.DHT22(Pin(DHT_PIN))

relay = Pin(RELAY_PIN, Pin.OUT)
relay.value(1)  # Active Low: mulai OFF

led_vactrol = PWM(Pin(LED_VACTROL_PIN))
led_vactrol.freq(1000)
led_vactrol.duty(0)

i2c = I2C(0, sda=Pin(I2C_SDA), scl=Pin(I2C_SCL), freq=400000)
lcd = I2cLcd(i2c, LCD_ADDR, LCD_ROWS, LCD_COLS)

# Splash screen
lcd.clear()
lcd.move_to(0, 0)
lcd.putstr("  Penetas Telur ")
lcd.move_to(0, 1)
lcd.putstr("  Initializing..")
time.sleep(2)
lcd.clear()

# ===================== BATAS KIPAS =========================
BATAS_SUHU_KIPAS       = 38.5
BATAS_KELEMBAPAN_KIPAS = 80.0  # dinaikkan dari 70 → kipas tidak trigger di kelembapan normal

# Output crisp fuzzy
PWM_DINGIN = 255
PWM_PAS    = 80
PWM_PANAS  = 0


# ===================== HELPER ==============================
def map_val(x, in_min, in_max, out_min, out_max):
    x = max(in_min, min(in_max, x))
    return int((x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min)


def lcd_write(row0, row1):
    try:
        lcd.move_to(0, 0)
        lcd.putstr(row0)
        lcd.move_to(0, 1)
        lcd.putstr(row1)
    except OSError:
        print("[WARN] LCD error, skip display")


# =================== FUZZY MEMBERSHIP ======================
def fuzzyDingin(t):
    if t <= 37.0: return 1.0
    if t >= 37.5: return 0.0
    return (37.5 - t) / (37.5 - 37.0)


def fuzzyPas(t):
    if t <= 37.0 or t >= 38.5: return 0.0
    if 37.0 < t <= 37.5:       return (t - 37.0) / (37.5 - 37.0)
    if 37.5 < t < 38.0:        return 1.0
    if 38.0 <= t < 38.5:       return (38.5 - t) / (38.5 - 38.0)
    return 0.0


def fuzzyPanas(t):
    if t <= 38.0: return 0.0
    if t >= 38.5: return 1.0
    return (t - 38.0) / (38.5 - 38.0)


# ===================== MAIN LOOP ===========================
while True:
    try:
        dht_sensor.measure()
        h = dht_sensor.humidity()
        t = dht_sensor.temperature()
    except OSError:
        print("[ERR] DHT22 gagal baca, skip...")
        lcd_write("  Sensor Error! ", "  Cek DHT22...  ")
        time.sleep(2)
        continue

    # Fuzzifikasi
    dDingin = fuzzyDingin(t)
    dPas    = fuzzyPas(t)
    dPanas  = fuzzyPanas(t)

    # Defuzzifikasi (Weighted Average)
    totalDerajat = dDingin + dPas + dPanas
    if totalDerajat > 0:
        outputPWM = (
            (dDingin * PWM_DINGIN) +
            (dPas    * PWM_PAS)    +
            (dPanas  * PWM_PANAS)
        ) / totalDerajat
    else:
        outputPWM = PWM_PAS

    finalPWM  = int(outputPWM)
    duty_1023 = map_val(finalPWM, 0, 255, 0, 1023)
    led_vactrol.duty(duty_1023)

    # Logika Kipas
    if t > BATAS_SUHU_KIPAS or h > BATAS_KELEMBAPAN_KIPAS:
        relay.value(1)
        fanStatus = "ON "
    else:
        relay.value(0)
        fanStatus = "OFF"

    persentaseDaya = map_val(finalPWM, 0, 255, 0, 100)

    # Serial monitor
    print(
        f"T:{t:.1f}C H:{h:.0f}% | Lmp:{persentaseDaya:3d}% | Kp:{fanStatus} "
        f"[D:{dDingin:.2f} P:{dPas:.2f} H:{dPanas:.2f}]"
    )

    # LCD
    lcd_write(
        f"T:{t:.1f}C  H:{h:.0f}%  ",
        f"Lmp:{persentaseDaya:3d}% Kp:{fanStatus}"
    )

    time.sleep(3)