"""Prueba funcional de la interfaz en un navegador sin cabeza (Playwright + Chromium).

Uso:
  python3 test/ui.py                      prueba el index.html local
  python3 test/ui.py https://…/           prueba una URL publicada
  python3 test/ui.py <url> <carpeta>      además guarda capturas en esa carpeta
"""
import os, pathlib, sys
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = sys.argv[1] if len(sys.argv) > 1 else (ROOT / "index.html").as_uri()
SHOTS = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else None
REMOTE = URL.startswith("http")
LOCALHOST = urlparse(URL).hostname in ("localhost", "127.0.0.1")
PROXY = os.environ.get("HTTPS_PROXY") if REMOTE and not LOCALHOST else None


def shot(target, name, **kw):
    if SHOTS:
        target.screenshot(path=str(SHOTS / name), **kw)


fails = []


def check(name, cond, extra=""):
    print(("ok   " if cond else "FAIL ") + name + (f"  [{extra}]" if extra and not cond else ""), flush=True)
    if not cond:
        fails.append(name)
        if os.environ.get("GITHUB_ACTIONS"):  # anotación visible en la ejecución de Actions
            print(f"::error title=Prueba de interfaz::{name} {extra}".strip(), flush=True)


with sync_playwright() as p:
    browser = p.chromium.launch(proxy={"server": PROXY} if PROXY else None)

    # ---------- Escritorio ----------
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    requests, failed = [], []
    page.on("request", lambda r: requests.append(r.url))
    page.on("response", lambda r: failed.append(f"{r.status} {r.url}") if r.status >= 400 else None)
    page.goto(URL)
    page.wait_for_selector(".scene")
    print("URL:", URL)
    check("React 18.3.1 cargado", page.evaluate("window.React && React.version") == "18.3.1")
    check("ReactDOM cargado", page.evaluate("!!(window.ReactDOM && ReactDOM.createRoot)"))
    here = urlparse(URL)
    foreign = [u for u in requests if urlparse(u).scheme in ("http", "https") and urlparse(u).netloc != here.netloc]
    check("sin peticiones a otros dominios", not foreign, "; ".join(foreign)[:300])
    check("React servido desde vendor/ del mismo sitio", sum("vendor/react" in u for u in requests) == 2, str(requests)[:300])
    check("sin recursos con error HTTP", not failed, "; ".join(failed)[:300])
    if REMOTE and not LOCALHOST:
        check("servido por HTTPS", here.scheme == "https")
    check("38 pines dibujados", page.locator(".pin").count() == 38)
    check("10 cables del ejemplo", page.locator(".wire").count() == 10)
    check("inspector abre en IO23", "IO23 · GPIO23" in page.locator(".insp-head h3").inner_text())
    shot(page, "desktop-rest.png", full_page=True)

    # Inspección de pines
    page.locator('.pin[aria-label="J2 pin 5: IO34"]').click()
    insp = page.locator(".insp").inner_text()
    check("IO34: solo entrada y ADC1_CH6", "No: pin de solo entrada" in insp and "ADC1_CH6" in insp)
    page.locator('.pin[aria-label="J2 pin 13: IO12"]').click()
    check("IO12: strapping MTDI", "strapping" in page.locator(".insp").inner_text())
    page.locator('.pin[aria-label="J3 pin 19: CLK"]').click()
    check("CLK: reservado para flash", "flash" in page.locator(".insp").inner_text().lower())
    page.locator('.comp[aria-label="Módulo ESP32-WROOM-32E"]').click()
    check("módulo inspeccionable", "ESP32-WROOM-32E" in page.locator(".insp-head h3").inner_text())

    # Blink
    check("LED apagado antes de iniciar", page.locator(".led-dome.on").count() == 0)
    page.get_by_role("button", name="Iniciar", exact=True).click()
    page.wait_for_selector(".led-dome.on", timeout=2000)
    check("Blink enciende el LED", True)
    page.wait_for_selector(".led-dome:not(.on)", timeout=2000)
    check("Blink apaga el LED", True)
    check("LED de encendido 5V activo", page.locator(".pwr-led.on").count() == 1)
    check("pin IO23 refleja el nivel", page.locator('.pin[aria-label="J3 pin 2: IO23"]').get_attribute("class").count("hi") + page.locator('.pin[aria-label="J3 pin 2: IO23"]').get_attribute("class").count("lo") >= 1)
    page.get_by_role("tab", name="Monitor serie").click()
    page.wait_for_timeout(1300)
    mon = page.locator(".mon-box").inner_text()
    check("monitor: Blink, LED ON y LED OFF", "Blink: GPIO23, 500 ms" in mon and "LED ON" in mon and "LED OFF" in mon)

    # Reset
    page.get_by_role("button", name="Reiniciar", exact=True).click()
    page.wait_for_timeout(120)
    check("reset registra el evento", "Reset por EN" in page.locator(".mon-box").inner_text())
    t = float(page.locator(".readout .time").inner_text().split("=")[1].replace("s", ""))
    check("reset pone el tiempo en cero", t < 0.6, str(t))

    # GPIO digital: puerto serie y pulsador
    page.locator("#sel-program").select_option("digital")
    page.wait_for_timeout(150)
    page.get_by_role("button", name="Enviar 1 (encender)").click()
    page.wait_for_selector(".led-dome.on", timeout=1000)
    check("comando 1 enciende el LED", "GPIO23 = HIGH" in page.locator(".mon-box").inner_text())
    check("tabla GPIO muestra HIGH", "HIGH" in page.locator(".gpio table").inner_text())
    page.get_by_role("button", name="Enviar 0 (apagar)").click()
    page.wait_for_selector(".led-dome:not(.on)", timeout=1000)
    hold = page.get_by_role("button", name="Mantener para pulsar")
    hold.dispatch_event("pointerdown", {"pointerId": 1, "bubbles": True})
    page.wait_for_selector(".led-dome.on", timeout=1000)
    hold.dispatch_event("pointerup", {"pointerId": 1, "bubbles": True})
    page.wait_for_timeout(150)
    mon = page.locator(".mon-box").inner_text()
    check("pulsador alterna la salida", "GPIO21 (pulsador) = LOW" in mon and "GPIO21 (pulsador) = HIGH" in mon)
    page.locator("#mon-input").fill("0")
    page.get_by_role("button", name="Enviar", exact=True).click()
    page.wait_for_selector(".led-dome:not(.on)", timeout=1000)
    check("monitor envía texto a la placa", "→ 0" in page.locator(".mon-box").inner_text())

    # ADC
    page.locator("#sel-program").select_option("adc")
    page.locator("#in-pot").fill("100")
    page.locator("#in-temp").fill("40")
    page.wait_for_timeout(700)
    mon = page.locator(".mon-box").inner_text()
    check("ADC: potenciómetro al máximo", "POT GPIO34: raw=4095 (~3300 mV)" in mon)
    check("ADC: sensor a 40 °C", "TEMP GPIO35: 900 mV -> 40.0 C" in mon)

    # Código
    page.get_by_role("tab", name="Código").click()
    code = page.locator(".code pre").inner_text()
    check("código ADC coherente", "const int POT_PIN = 34;" in code and "analogReadMilliVolts(TEMP_PIN)" in code)

    # Cambiar conexiones por lista y validar
    page.get_by_role("tab", name="Conexiones").click()
    check("cableado de ejemplo sin errores", "sin errores ni advertencias" in page.locator(".summary").inner_text())
    page.locator("#sel-ohms").select_option("0")
    check("sin resistencia: error", "resistencia limitadora" in page.locator(".conn").inner_text())
    page.locator("#sel-ohms").select_option("220")
    page.locator('[id="sel-led.a"]').select_option("J3-1")
    page.locator('[id="sel-led.k"]').select_option("J3-2")
    check("polaridad invertida: error", "Polaridad invertida" in page.locator(".conn").inner_text())
    page.locator("#sel-program").select_option("blink")
    check("Blink bloqueado con LED inválido", "necesita el LED" in page.locator(".about").inner_text())
    page.get_by_role("button", name="Restaurar cableado de ejemplo").click()
    check("restaurar deja el cableado válido", "sin errores ni advertencias" in page.locator(".summary").inner_text())

    # Cambiar una conexión tocando terminal y pin
    page.locator('.term[aria-label^="LED + resistencia, terminal A"]').click()
    check("terminal armado", "Conectando" in page.locator(".strip").inner_text())
    page.locator('.pin[aria-label="J3 pin 3: IO22"]').click()
    page.get_by_role("tab", name="Código").click()
    check("código sigue al cableado (IO22)", "const int LED_PIN = 22;" in page.locator(".code pre").inner_text())
    page.locator('.term[aria-label^="Potenciómetro, terminal W"]').click()
    page.locator('.pin[aria-label="J3 pin 9: IO18"]').click()
    page.get_by_role("tab", name="Conexiones").click()
    check("pin sin ADC: error", "no tiene canal ADC" in page.locator(".conn").inner_text())
    shot(page, "desktop-error.png", full_page=True)
    page.get_by_role("button", name="Restaurar cableado de ejemplo").click()

    # Zoom, descarga y detener
    full = page.locator(".scene").get_attribute("viewBox")
    page.get_by_role("button", name="Acercar").click()
    check("zoom cambia el viewBox", page.locator(".scene").get_attribute("viewBox") != full)
    page.get_by_role("button", name="Ver todo").click()
    check("ver todo restaura el viewBox", page.locator(".scene").get_attribute("viewBox") == full)
    page.locator('.comp[aria-label="Botón BOOT"]').click()
    page.get_by_role("tab", name="Inspector").click()
    page.get_by_role("button", name="Mantener Boot y pulsar EN").click()
    check("modo descarga", "Modo descarga" in page.locator(".pill").inner_text())
    page.locator('.comp[aria-label="Botón EN"]').click()
    check("EN vuelve a ejecutar", "Ejecutando" in page.locator(".pill").inner_text())
    page.get_by_role("button", name="Detener", exact=True).click()
    check("detener apaga la placa", "Sin alimentación" in page.locator(".pill").inner_text() and page.locator(".pwr-led.on").count() == 0)
    page.get_by_role("tab", name="Límites").click()
    lim = page.locator(".limits").inner_text()
    check("límites: tres categorías", "DATOS REALES" in lim.upper() and "SIMULADOS" in lim.upper() and "NO IMPLEMENTADO" in lim.upper())
    check("sin errores de consola", not errors, "; ".join(errors)[:300])

    # ---------- Teléfono ----------
    phone = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
    perr = []
    phone.on("pageerror", lambda e: perr.append(str(e)))
    phone.goto(URL)
    phone.wait_for_selector(".scene")
    over = phone.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    check("teléfono: sin scroll horizontal", over <= 0, str(over))
    phone.locator('.pin[aria-label="J2 pin 7: IO32"]').tap()
    check("teléfono: tocar un pin lo selecciona", "IO32" in phone.locator(".strip").inner_text())
    phone.get_by_role("button", name="Iniciar", exact=True).tap()
    phone.wait_for_selector(".led-dome.on", timeout=2000)
    check("teléfono: Blink funciona", True)
    shot(phone, "phone-top.png")
    shot(phone.locator(".scene"), "phone-scene.png")
    small = phone.evaluate("""() => [...document.querySelectorAll('button, select, input[type=range]')]
        .filter(e => e.offsetParent && e.getBoundingClientRect().height < 28).map(e => e.textContent || e.id)""")
    check("teléfono: controles de al menos 28 px de alto", not small, str(small)[:200])
    phone.locator('.term[aria-label^="LED + resistencia, terminal A"]').tap()
    phone.locator('.pin[aria-label="J3 pin 3: IO22"]').tap()
    phone.get_by_role("tab", name="Código").tap()
    check("teléfono: mover un cable con el dedo actualiza el código", "const int LED_PIN = 22;" in phone.locator(".code pre").inner_text())
    phone.get_by_role("tab", name="Monitor serie").tap()
    phone.wait_for_timeout(700)
    check("teléfono: monitor serie recibe eventos", "LED ON" in phone.locator(".mon-box").inner_text())
    phone.get_by_role("tab", name="Conexiones").tap()
    over = phone.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    check("teléfono: Conexiones sin desborde", over <= 0, str(over))
    shot(phone, "phone-full.png", full_page=True)
    check("teléfono: sin errores", not perr, "; ".join(perr)[:300])
    browser.close()

print(f"\n{len(fails)} fallas" if fails else "\nTodo en orden")
sys.exit(1 if fails else 0)
