// Componentes del banco y cableado de ejemplo. Modelos del laboratorio, no datos de Espressif.

export const PARTS = {
  led: {
    name: 'LED + resistencia',
    short: 'LED',
    terms: [
      { id: 'a', label: 'A', long: 'ánodo (+)' },
      { id: 'k', label: 'K', long: 'cátodo (−)' },
    ],
    model: [
      'LED rojo genérico con una resistencia en serie del lado del ánodo.',
      'La corriente se estima como (V − 2,0 V) / R, con una caída directa supuesta de 2,0 V.',
      'El encendido es lógico: el laboratorio no calcula brillo ni temperatura.',
    ],
  },
  btn: {
    name: 'Pulsador',
    short: 'Pulsador',
    terms: [
      { id: 't1', label: '1', long: 'contacto 1' },
      { id: 't2', label: '2', long: 'contacto 2' },
    ],
    model: [
      'Pulsador normalmente abierto, ideal y sin rebote.',
      'A GND usa INPUT_PULLUP (pulsado = LOW). A 3V3 usa INPUT_PULLDOWN (pulsado = HIGH).',
    ],
  },
  pot: {
    name: 'Potenciómetro',
    short: 'Pot.',
    terms: [
      { id: 'a', label: 'A', long: 'extremo A' },
      { id: 'w', label: 'W', long: 'cursor' },
      { id: 'b', label: 'B', long: 'extremo B' },
    ],
    model: [
      'Divisor resistivo ideal y lineal entre los dos extremos.',
      'La tensión del cursor va de 0 a 3300 mV según el recorrido.',
    ],
  },
  tmp: {
    name: 'Sensor de temperatura',
    short: 'Sensor',
    terms: [
      { id: 'vcc', label: 'V+', long: 'alimentación' },
      { id: 'out', label: 'OUT', long: 'salida analógica' },
      { id: 'gnd', label: 'GND', long: 'tierra' },
    ],
    model: [
      'Sensor analógico genérico simulado. No es un componente de Espressif ni un modelo comercial concreto.',
      'Función de transferencia supuesta: Vout = 500 mV + 10 mV/°C.',
      'La temperatura la fija el control deslizante, no una medición.',
    ],
  },
};

export const PART_IDS = ['led', 'btn', 'pot', 'tmp'];
export const TERM_KEYS = PART_IDS.flatMap((p) => PARTS[p].terms.map((t) => `${p}.${t.id}`));

export const LED_OHMS = [0, 220, 330, 1000];
export const INTERVALS = [100, 250, 500, 1000, 2000];

// Cableado de ejemplo: los cuatro componentes conectados sin advertencias.
export const DEFAULT_WIRING = {
  'led.a': 'J3-2', // IO23
  'led.k': 'J3-1', // GND
  'btn.t1': 'J3-6', // IO21
  'btn.t2': 'J3-7', // GND
  'pot.a': 'J2-1', // 3V3
  'pot.w': 'J2-5', // IO34 (ADC1_CH6)
  'pot.b': 'J2-14', // GND
  'tmp.vcc': 'J2-1', // 3V3
  'tmp.out': 'J2-6', // IO35 (ADC1_CH7)
  'tmp.gnd': 'J2-14', // GND
};

export const termLabel = (key) => {
  const [p, t] = key.split('.');
  const term = PARTS[p].terms.find((x) => x.id === t);
  return `${PARTS[p].short} · ${term.label} (${term.long})`;
};
