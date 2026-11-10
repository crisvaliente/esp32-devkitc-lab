# Laboratorio ESP32-DevKitC V4

Laboratorio educativo e interactivo de la placa **ESP32-DevKitC V4** con módulo **ESP32-WROOM-32E**. Funciona en el navegador, en computadoras y teléfonos, sin instalar nada.

**Abrir el laboratorio:** https://crisvaliente.github.io/esp32-devkitc-lab/

[![Verificar sitio publicado](https://github.com/crisvaliente/esp32-devkitc-lab/actions/workflows/verificar.yml/badge.svg)](https://github.com/crisvaliente/esp32-devkitc-lab/actions/workflows/verificar.yml)

## Propósito

Sirve para aprender el pinout de la placa, practicar conexiones básicas y ver qué haría un programa sencillo antes de tocar hardware real. Es material didáctico: reproduce comportamientos esperados, no ejecuta firmware.

## Funcionalidades

- **Placa interactiva**: los 38 pines de J2 y J3 en el orden de la guía de Espressif, con zoom e inspección de componentes (módulo, USB, EN, Boot, LED de encendido, puente USB-UART).
- **Inspector de GPIO**: funciones, entrada y salida, ADC, DAC, táctil, PWM, restricciones de arranque y advertencias. Cada dato indica su fuente.
- **Laboratorio de conexiones**: LED con resistencia, pulsador, potenciómetro y sensor de temperatura simulado, con cables editables.
- **Validación básica**: alimentación, polaridad, pines incompatibles, pines compartidos y falta de resistencia limitadora.
- **Simulación**: Blink, GPIO digital (puerto serie y pulsador) y lectura ADC, con Iniciar, Detener y Reiniciar.
- **Monitor serie** con los eventos y lecturas del simulador.
- **Código Arduino/C++** generado para el cableado elegido, listo para copiar.

## Limitaciones

- No emula el procesador ESP32 ni ejecuta o carga firmware. Los sketches generados no fueron compilados por el laboratorio.
- No es un simulador eléctrico: no calcula tensiones, corrientes ni consumo reales. El ADC es ideal (lineal y sin ruido).
- El sensor de temperatura es un modelo genérico inventado (500 mV + 10 mV/°C).
- No simula Wi-Fi, Bluetooth ni radiofrecuencia. Tampoco PWM, DAC, táctil, I2C ni SPI.
- Los pines de strapping y la restricción de ADC2 con Wi-Fi solo se advierten.
- El dibujo de la placa es esquemático; el orden y el lado de los pines sí siguen la guía.
- **No sirve para validar un diseño antes de fabricarlo.**

La pestaña **Límites** de la aplicación separa datos reales, comportamientos simulados y lo no implementado.

## Estructura

Sitio estático, sin servidor ni servicios externos. GitHub Pages publica la rama `main` desde la raíz.

| Ruta | Contenido |
|---|---|
| `index.html` | Página publicada (generada por `build.mjs`) |
| `vendor/` | React y ReactDOM 18.3.1 (UMD de producción) y su licencia |
| `src/data/` | Datos de pines tomados de la documentación de Espressif |
| `src/lab/` | Componentes del banco y validación del cableado |
| `src/sim/` | Motor de simulación |
| `src/codegen/` | Generador de sketches Arduino |
| `src/ui/` | Interfaz (React) |
| `test/` | Pruebas de lógica y de interfaz |
| `.github/workflows/verificar.yml` | Prueba automática del sitio publicado tras cada cambio en `main` |

## Desarrollo

```sh
npm ci            # instala esbuild y React (solo para compilar)
npm run build     # regenera index.html y vendor/
npm test          # pruebas de datos, validación, motor y código generado
```

Prueba de interfaz en navegador sin cabeza (requiere Python con Playwright y Chromium):

```sh
python3 test/ui.py                                              # index.html local
python3 test/ui.py https://crisvaliente.github.io/esp32-devkitc-lab/   # sitio publicado
```

Para publicar un cambio: editar `src/`, ejecutar `npm run build` y subir el commit a `main`. Después de cada subida, el workflow **Verificar sitio publicado** espera a que GitHub Pages sirva el commit nuevo y corre las pruebas contra la URL pública.

## Fuentes y licencias

Datos técnicos:

- [Guía de usuario ESP32-DevKitC V4](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html)
- [Datasheet ESP32-WROOM-32E / 32UE](https://documentation.espressif.com/esp32-wroom-32e_esp32-wroom-32ue_datasheet_en.pdf)
- [ESP-IDF: GPIO & RTC GPIO (ESP32)](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/gpio.html)
- [arduino-esp32: pins_arduino.h](https://github.com/espressif/arduino-esp32/blob/master/variants/esp32/pins_arduino.h)

React y ReactDOM se distribuyen bajo licencia MIT; el texto está en [`vendor/LICENSE-react.txt`](vendor/LICENSE-react.txt).

Proyecto independiente, sin relación con Espressif Systems. Los nombres de productos pertenecen a sus dueños.
