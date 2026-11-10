// GENERADOR DE CÓDIGO. Produce un sketch Arduino/C++ para el cableado actual.
// Es texto: el laboratorio no lo compila ni lo ejecuta. El motor de simulación
// (src/sim/engine.js) reproduce por separado el comportamiento que este código tendría.

import { PIN_BY_ID, GPIO } from '../data/pins.js';
import { PROGRAMS, canRun } from '../sim/engine.js';

const adcName = (gpio) => {
  const a = GPIO[gpio].adc;
  return a ? `ADC${a[0]}_CH${a[1]}` : '';
};

function header(program, lines) {
  return [
    `// ${PROGRAMS[program].name} · ESP32-DevKitC V4 (ESP32-WROOM-32E) · core Arduino-ESP32`,
    '// Generado por el laboratorio para el cableado actual. No fue compilado ni ejecutado.',
    '//',
    '// Circuito:',
    ...lines.map((l) => `//   ${l}`),
    '',
  ];
}

function ledWiring(c) {
  const pin = PIN_BY_ID[c.led.pinId].name;
  return c.led.activeLow
    ? `LED: 3V3 -> resistencia ${c.led.ohms} ohm -> anodo; catodo -> ${pin} (enciende en LOW)`
    : `LED: ${pin} -> resistencia ${c.led.ohms} ohm -> anodo; catodo -> GND (enciende en HIGH)`;
}

function ledConsts(c) {
  return [
    `const int LED_PIN = ${c.led.gpio};`,
    `const int LED_ON  = ${c.led.activeLow ? 'LOW' : 'HIGH'};`,
    `const int LED_OFF = ${c.led.activeLow ? 'HIGH' : 'LOW'};`,
  ];
}

function blink(c, p) {
  return [
    ...header('blink', [ledWiring(c)]),
    ...ledConsts(c),
    `const unsigned long INTERVALO_MS = ${p.intervalMs};`,
    '',
    'void setup() {',
    '  Serial.begin(115200);',
    '  pinMode(LED_PIN, OUTPUT);',
    '  digitalWrite(LED_PIN, LED_OFF);',
    '  Serial.printf("Blink: GPIO%d, %lu ms\\n", LED_PIN, INTERVALO_MS);',
    '}',
    '',
    'void loop() {',
    '  digitalWrite(LED_PIN, LED_ON);',
    '  Serial.println("LED ON");',
    '  delay(INTERVALO_MS);',
    '  digitalWrite(LED_PIN, LED_OFF);',
    '  Serial.println("LED OFF");',
    '  delay(INTERVALO_MS);',
    '}',
  ];
}

function digital(c) {
  const wiring = [ledWiring(c)];
  const btn = c.btn;
  if (btn) {
    const pin = PIN_BY_ID[btn.pinId].name;
    wiring.push(
      btn.pull === 'up'
        ? `Pulsador: ${pin} -> pulsador -> GND (INPUT_PULLUP, pulsado = LOW)`
        : `Pulsador: ${pin} -> pulsador -> 3V3 (INPUT_PULLDOWN, pulsado = HIGH)`,
    );
  }
  const out = [...header('digital', wiring), ...ledConsts(c)];
  if (btn) {
    out.push(`const int BTN_PIN = ${btn.gpio};`, `const int BTN_ACTIVO = ${btn.pull === 'up' ? 'LOW' : 'HIGH'};`);
  }
  out.push('', 'bool salida = false;');
  if (btn) out.push('int ultimoBoton;');
  out.push(
    '',
    'void aplicar(bool encender) {',
    '  salida = encender;',
    '  int nivel = salida ? LED_ON : LED_OFF;',
    '  digitalWrite(LED_PIN, nivel);',
    '  Serial.printf("GPIO%d = %s\\n", LED_PIN, nivel == HIGH ? "HIGH" : "LOW");',
    '}',
    '',
    'void setup() {',
    '  Serial.begin(115200);',
    '  pinMode(LED_PIN, OUTPUT);',
    '  digitalWrite(LED_PIN, LED_OFF);',
  );
  if (btn) out.push(`  pinMode(BTN_PIN, ${btn.pull === 'up' ? 'INPUT_PULLUP' : 'INPUT_PULLDOWN'});`, '  ultimoBoton = digitalRead(BTN_PIN);');
  out.push(
    '  Serial.println("Listo: comandos \'1\' y \'0\' por puerto serie");',
    '}',
    '',
    'void loop() {',
    '  if (Serial.available() > 0) {',
    '    char c = Serial.read();',
    "    if (c == '1') aplicar(true);",
    "    if (c == '0') aplicar(false);",
    '  }',
  );
  if (btn)
    out.push(
      '',
      '  int lectura = digitalRead(BTN_PIN);',
      '  if (lectura != ultimoBoton) {',
      '    ultimoBoton = lectura;',
      '    Serial.printf("GPIO%d (pulsador) = %s\\n", BTN_PIN, lectura == HIGH ? "HIGH" : "LOW");',
      '    if (lectura == BTN_ACTIVO) aplicar(!salida);',
      '    delay(20);  // antirrebote simple',
      '  }',
    );
  out.push('}');
  return out;
}

function adc(c, p) {
  const wiring = [];
  if (c.pot) {
    const pin = PIN_BY_ID[c.pot.pinId].name;
    wiring.push(`Potenciometro: extremos a 3V3 y GND; cursor -> ${pin} (${adcName(c.pot.gpio)})`);
  }
  if (c.tmp) {
    const pin = PIN_BY_ID[c.tmp.pinId].name;
    wiring.push(`Sensor de temperatura: V+ y GND a alimentacion; OUT -> ${pin} (${adcName(c.tmp.gpio)})`);
  }
  const out = [...header('adc', wiring)];
  if (c.pot) out.push(`const int POT_PIN = ${c.pot.gpio};   // ${adcName(c.pot.gpio)}`);
  if (c.tmp) out.push(`const int TEMP_PIN = ${c.tmp.gpio};  // ${adcName(c.tmp.gpio)}`);
  out.push(
    `const unsigned long PERIODO_MS = ${p.intervalMs};`,
    '',
    'void setup() {',
    '  Serial.begin(115200);',
    '  analogReadResolution(12);  // 0 a 4095',
    '  Serial.printf("Lectura ADC cada %lu ms\\n", PERIODO_MS);',
    '}',
    '',
    'void loop() {',
  );
  if (c.pot)
    out.push(
      '  int raw = analogRead(POT_PIN);',
      '  int mv = analogReadMilliVolts(POT_PIN);',
      '  Serial.printf("POT GPIO%d: raw=%d (~%d mV)\\n", POT_PIN, raw, mv);',
    );
  if (c.pot && c.tmp) out.push('');
  if (c.tmp)
    out.push(
      '  // Modelo del sensor simulado: Vout = 500 mV + 10 mV/C.',
      '  // Con un sensor real, usa la formula de su hoja de datos.',
      '  int mvT = analogReadMilliVolts(TEMP_PIN);',
      '  float tempC = (mvT - 500) / 10.0f;',
      '  Serial.printf("TEMP GPIO%d: %d mV -> %.1f C\\n", TEMP_PIN, mvT, tempC);',
    );
  out.push('', '  delay(PERIODO_MS);', '}');
  return out;
}

/** @returns {{code:string|null, reason?:string}} */
export function generateSketch(program, circuit, params) {
  const ready = canRun(program, circuit);
  if (!ready.ok) return { code: null, reason: ready.reason };
  const lines = program === 'blink' ? blink(circuit, params) : program === 'digital' ? digital(circuit) : adc(circuit, params);
  return { code: lines.join('\n') + '\n' };
}
