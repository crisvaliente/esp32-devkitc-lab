import test from 'node:test';
import assert from 'node:assert/strict';
import { J2, J3, PINS, GPIO, pinInfo, PIN_BY_ID } from '../src/data/pins.js';
import { DEFAULT_WIRING } from '../src/lab/parts.js';
import { analyze } from '../src/lab/analyze.js';
import * as E from '../src/sim/engine.js';
import { generateSketch } from '../src/codegen/arduino.js';

const opts = { ledOhms: 220 };
const inputs = { pressed: false, pot: 0.5, tempC: 25 };
const params = { intervalMs: 500 };
const texts = (log, kind = 'fw') => log.filter((l) => l.kind === kind).map((l) => l.text);

test('tabla de pines: 19 + 19, orden de la guía', () => {
  assert.equal(J2.length, 19);
  assert.equal(J3.length, 19);
  assert.deepEqual(J2.map((p) => p.name), ['3V3', 'EN', 'VP', 'VN', 'IO34', 'IO35', 'IO32', 'IO33', 'IO25', 'IO26', 'IO27', 'IO14', 'IO12', 'GND', 'IO13', 'D2', 'D3', 'CMD', '5V']);
  assert.deepEqual(J3.map((p) => p.name), ['GND', 'IO23', 'IO22', 'TX', 'RX', 'IO21', 'GND', 'IO19', 'IO18', 'IO5', 'IO17', 'IO16', 'IO4', 'IO0', 'IO2', 'IO15', 'D1', 'D0', 'CLK']);
  const gpios = PINS.filter((p) => p.gpio != null).map((p) => p.gpio);
  assert.equal(new Set(gpios).size, gpios.length, 'ningún GPIO repetido');
  for (const p of PINS) {
    if (p.gpio == null) continue;
    assert.ok(GPIO[p.gpio], `GPIO${p.gpio} tiene ficha`);
    assert.ok(p.fn.startsWith(`GPIO${p.gpio}`), `${p.name} declara GPIO${p.gpio}`);
    // El canal ADC de la ficha coincide con el texto de la guía.
    const m = p.fn.match(/ADC(\d)_CH(\d)/);
    if (m) assert.deepEqual(GPIO[p.gpio].adc, [Number(m[1]), Number(m[2])]);
    else assert.equal(GPIO[p.gpio].adc, undefined);
    const t = p.fn.match(/TOUCH_CH(\d)/);
    if (t) assert.equal(GPIO[p.gpio].touch, Number(t[1]));
  }
  // Solo entrada = tipo "I" de la guía.
  for (const p of PINS.filter((x) => x.kind === 'gpio')) assert.equal(!!GPIO[p.gpio].inputOnly, p.type === 'I', p.name);
  assert.deepEqual(Object.keys(GPIO).filter((g) => GPIO[g].strap).map(Number).sort((a, b) => a - b), [0, 2, 5, 12, 15]);
});

test('ficha de pin: IO34 solo entrada, IO25 con DAC, D0 reservado', () => {
  const io34 = pinInfo(PIN_BY_ID['J2-5']);
  assert.equal(io34.caps.find((c) => c.k === 'Salida digital').ok, false);
  assert.match(io34.caps.find((c) => c.k === 'ADC').v, /ADC1_CH6/);
  assert.match(pinInfo(PIN_BY_ID['J2-9']).caps.find((c) => c.k === 'DAC').v, /DAC_1/);
  assert.ok(pinInfo(PIN_BY_ID['J3-18']).restrictions.length >= 2);
  assert.ok(pinInfo(PIN_BY_ID['J2-13']).restrictions.some((r) => /strapping/.test(r.text)));
});

test('cableado de ejemplo: sin errores ni advertencias', () => {
  const a = analyze(DEFAULT_WIRING, opts);
  assert.equal(a.errors, 0);
  assert.equal(a.warnings, 0);
  assert.deepEqual(a.circuit.led, { gpio: 23, pinId: 'J3-2', activeLow: false, alwaysOn: false, ohms: 220 });
  assert.equal(a.circuit.btn.pull, 'up');
  assert.equal(a.circuit.pot.gpio, 34);
  assert.equal(a.circuit.tmp.gpio, 35);
});

test('validación: resistencia, polaridad, pines incompatibles, alimentación', () => {
  const w = (patch) => ({ ...DEFAULT_WIRING, ...patch });
  const errs = (a, part) => a.parts[part].issues.filter((i) => i.level === 'error').map((i) => i.text).join(' | ');

  let a = analyze(DEFAULT_WIRING, { ledOhms: 0 });
  assert.match(errs(a, 'led'), /resistencia limitadora/);
  assert.equal(a.circuit.led, null);

  a = analyze(w({ 'led.a': 'J3-1', 'led.k': 'J3-2' }), opts);
  assert.match(errs(a, 'led'), /Polaridad invertida/);

  a = analyze(w({ 'led.a': 'J2-5' }), opts); // IO34 solo entrada
  assert.match(errs(a, 'led'), /solo entrada/);

  a = analyze(w({ 'led.a': 'J3-18' }), opts); // D0 flash
  assert.match(errs(a, 'led'), /flash/);

  a = analyze(w({ 'led.a': 'J2-1', 'led.k': 'J3-2' }), opts); // activo en bajo
  assert.equal(a.circuit.led.activeLow, true);

  a = analyze(w({ 'led.a': 'J2-19', 'led.k': 'J3-2' }), opts); // 5V hacia GPIO
  assert.match(errs(a, 'led'), /5V/);

  a = analyze(w({ 'led.a': 'J3-15' }), opts); // IO2 strapping
  assert.equal(a.parts.led.status, 'warn');
  assert.ok(a.circuit.led);

  a = analyze(w({ 'pot.w': 'J3-3' }), opts); // IO22 sin ADC
  assert.match(errs(a, 'pot'), /no tiene canal ADC/);
  a = analyze(w({ 'pot.w': 'J2-9' }), opts); // IO25 ADC2
  assert.equal(a.parts.pot.status, 'warn');
  a = analyze(w({ 'pot.a': 'J2-19' }), opts);
  assert.match(errs(a, 'pot'), /5V/);
  a = analyze(w({ 'pot.b': null }), opts);
  assert.match(errs(a, 'pot'), /Falta conectar: extremo B/);

  a = analyze(w({ 'btn.t1': 'J2-3' }), opts); // VP sin pull
  assert.match(errs(a, 'btn'), /pull-up/);
  a = analyze(w({ 'btn.t1': 'J2-1' }), opts); // 3V3 + GND
  assert.match(errs(a, 'btn'), /Cortocircuito/);
  a = analyze(w({ 'btn.t2': 'J2-1' }), opts);
  assert.equal(a.circuit.btn.pull, 'down');

  a = analyze(w({ 'tmp.vcc': 'J2-14', 'tmp.gnd': 'J2-1' }), opts);
  assert.match(errs(a, 'tmp'), /Polaridad invertida/);

  a = analyze(w({ 'tmp.out': 'J2-5' }), opts); // comparte IO34 con el pot
  assert.match(errs(a, 'tmp'), /compartido/);
  assert.match(errs(a, 'pot'), /compartido/);

  a = analyze({ 'led.a': 'J3-2', 'led.k': 'J3-1' }, opts);
  assert.equal(a.parts.pot.status, 'unused');
});

test('motor: Blink alterna cada intervalo y enciende el LED', () => {
  const c = analyze(DEFAULT_WIRING, opts).circuit;
  let { board, log } = E.powerOn('blink', c, params, inputs);
  assert.deepEqual(texts(log), ['Blink: GPIO23, 500 ms']);
  assert.equal(E.ledLit(board, c), false);
  const all = [];
  for (let i = 0; i < 30; i++) {
    const r = E.step(board, 50, inputs, c, params);
    board = r.board;
    all.push(...r.log);
    if (i === 0) assert.equal(E.ledLit(board, c), true, 'encendido al primer paso');
  }
  assert.deepEqual(texts(all), ['LED ON', 'LED OFF', 'LED ON', 'LED OFF']); // t = 0, 500, 1000, 1500
  assert.deepEqual(all.map((l) => l.t), [0, 500, 1000, 1500]);
  assert.equal(board.t, 1500);
  assert.equal(E.ledLit(board, c), false);
});

test('motor: GPIO digital responde al puerto serie y al pulsador', () => {
  const c = analyze(DEFAULT_WIRING, opts).circuit;
  let { board } = E.powerOn('digital', c, params, inputs);
  assert.equal(board.pins[21].mode, 'INPUT_PULLUP');
  assert.equal(board.pins[21].level, 1);
  let r = E.serialInput(board, '1', c);
  assert.deepEqual(texts(r.log), ['GPIO23 = HIGH']);
  assert.equal(E.ledLit(r.board, c), true);
  r = E.serialInput(r.board, '0', c);
  assert.equal(E.ledLit(r.board, c), false);
  r = E.step(r.board, 50, { ...inputs, pressed: true }, c, params);
  assert.deepEqual(texts(r.log), ['GPIO21 (pulsador) = LOW', 'GPIO23 = HIGH']);
  r = E.step(r.board, 50, inputs, c, params);
  assert.deepEqual(texts(r.log), ['GPIO21 (pulsador) = HIGH']);
  assert.equal(E.ledLit(r.board, c), true, 'el pulsador alterna, no sigue');
  r = E.serialInput(r.board, 'x', c);
  assert.equal(texts(r.log, 'sim').length, 1);
});

test('motor: LED activo en bajo', () => {
  const c = analyze({ ...DEFAULT_WIRING, 'led.a': 'J2-1', 'led.k': 'J3-2' }, opts).circuit;
  const { board } = E.powerOn('digital', c, params, inputs);
  assert.equal(board.pins[23].level, 1);
  assert.equal(E.ledLit(board, c), false);
  const r = E.serialInput(board, '1', c);
  assert.deepEqual(texts(r.log), ['GPIO23 = LOW']);
  assert.equal(E.ledLit(r.board, c), true);
});

test('motor: ADC ideal del potenciómetro y del sensor', () => {
  const c = analyze(DEFAULT_WIRING, opts).circuit;
  const { board } = E.powerOn('adc', c, params, inputs);
  let r = E.step(board, 50, inputs, c, params);
  assert.deepEqual(texts(r.log), ['POT GPIO34: raw=2048 (~1650 mV)', 'TEMP GPIO35: 750 mV -> 25.0 C']);
  r = E.step(r.board, 500, { pressed: false, pot: 1, tempC: -10 }, c, params);
  assert.deepEqual(texts(r.log), ['POT GPIO34: raw=4095 (~3300 mV)', 'TEMP GPIO35: 400 mV -> -10.0 C']);
  assert.equal(E.mvToRaw(0), 0);
  assert.equal(E.potMillivolts(0.25, true), 2475);
});

test('motor: reset, descarga, apagado y programa sin circuito', () => {
  const c = analyze(DEFAULT_WIRING, opts).circuit;
  let { board } = E.powerOn('blink', c, params, inputs);
  board = E.step(board, 700, inputs, c, params).board;
  let r = E.reset(board, 'blink', c, params, inputs);
  assert.equal(r.board.t, 0);
  assert.equal(E.ledLit(r.board, c), false);
  r = E.enterDownload(r.board);
  assert.equal(r.board.mode, 'download');
  assert.deepEqual(r.board.pins, {});
  assert.deepEqual(E.step(r.board, 500, inputs, c, params).log, []);
  r = E.powerOff(r.board);
  assert.equal(r.board.power, false);
  assert.equal(E.reset(r.board, 'blink', c, params, inputs).board.power, false);

  const bad = analyze(DEFAULT_WIRING, { ledOhms: 0 }).circuit;
  assert.equal(E.canRun('blink', bad).ok, false);
  assert.equal(E.powerOn('blink', bad, params, inputs).board.mode, 'halt');
  assert.equal(E.canRun('adc', bad).ok, true);
});

test('código: coincide con el cableado y con los textos del motor', () => {
  const c = analyze(DEFAULT_WIRING, opts).circuit;
  const blink = generateSketch('blink', c, params).code;
  assert.match(blink, /const int LED_PIN = 23;/);
  assert.match(blink, /INTERVALO_MS = 500;/);
  assert.match(blink, /Serial\.println\("LED ON"\)/);
  const dig = generateSketch('digital', c, params).code;
  assert.match(dig, /pinMode\(BTN_PIN, INPUT_PULLUP\)/);
  assert.match(dig, /const int BTN_PIN = 21;/);
  const adc = generateSketch('adc', c, params).code;
  assert.match(adc, /const int POT_PIN = 34;/);
  assert.match(adc, /const int TEMP_PIN = 35;/);
  assert.match(adc, /POT GPIO%d: raw=%d \(~%d mV\)/);

  const low = analyze({ ...DEFAULT_WIRING, 'led.a': 'J2-1', 'led.k': 'J3-10', 'btn.t1': null, 'btn.t2': null }, opts).circuit;
  const dl = generateSketch('digital', low, params).code;
  assert.match(dl, /const int LED_PIN = 5;/);
  assert.match(dl, /LED_ON  = LOW;/);
  assert.doesNotMatch(dl, /BTN_PIN/);

  assert.equal(generateSketch('blink', analyze(DEFAULT_WIRING, { ledOhms: 0 }).circuit, params).code, null);
  for (const code of [blink, dig, adc, dl]) {
    const open = (code.match(/{/g) || []).length, close = (code.match(/}/g) || []).length;
    assert.equal(open, close, 'llaves balanceadas');
  }
});
