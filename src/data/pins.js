// DATOS REALES. Todo lo que hay en este archivo sale de documentación de Espressif.
// Cada dato lleva la clave de su fuente (G, D, I, A). Lo que no tiene fuente de
// Espressif se marca con L (criterio del laboratorio).

export const SOURCES = {
  G: {
    label: 'Guía de usuario ESP32-DevKitC V4',
    url: 'https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html',
  },
  D: {
    label: 'Datasheet ESP32-WROOM-32E / 32UE v2.1',
    url: 'https://documentation.espressif.com/esp32-wroom-32e_esp32-wroom-32ue_datasheet_en.pdf',
  },
  I: {
    label: 'ESP-IDF · GPIO & RTC GPIO (ESP32)',
    url: 'https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/gpio.html',
  },
  A: {
    label: 'arduino-esp32 · variants/esp32/pins_arduino.h',
    url: 'https://github.com/espressif/arduino-esp32/blob/master/variants/esp32/pins_arduino.h',
  },
  L: { label: 'Criterio del laboratorio (no es un dato de Espressif)', url: null },
};

const rows = (header, list) =>
  list.map(([name, type, fn, kind, gpio], i) => ({
    id: `${header}-${i + 1}`,
    header,
    no: i + 1,
    name,
    type,
    fn,
    kind,
    gpio: gpio ?? null,
  }));

// Tablas J2 y J3 de la guía, en el mismo orden (pin 1 del lado de la antena).
export const J2 = rows('J2', [
  ['3V3', 'P', '3.3 V power supply', 'p3v3'],
  ['EN', 'I', 'CHIP_PU, Reset', 'en'],
  ['VP', 'I', 'GPIO36, ADC1_CH0, S_VP', 'gpio', 36],
  ['VN', 'I', 'GPIO39, ADC1_CH3, S_VN', 'gpio', 39],
  ['IO34', 'I', 'GPIO34, ADC1_CH6, VDET_1', 'gpio', 34],
  ['IO35', 'I', 'GPIO35, ADC1_CH7, VDET_2', 'gpio', 35],
  ['IO32', 'I/O', 'GPIO32, ADC1_CH4, TOUCH_CH9, XTAL_32K_P', 'gpio', 32],
  ['IO33', 'I/O', 'GPIO33, ADC1_CH5, TOUCH_CH8, XTAL_32K_N', 'gpio', 33],
  ['IO25', 'I/O', 'GPIO25, ADC2_CH8, DAC_1', 'gpio', 25],
  ['IO26', 'I/O', 'GPIO26, ADC2_CH9, DAC_2', 'gpio', 26],
  ['IO27', 'I/O', 'GPIO27, ADC2_CH7, TOUCH_CH7', 'gpio', 27],
  ['IO14', 'I/O', 'GPIO14, ADC2_CH6, TOUCH_CH6, MTMS', 'gpio', 14],
  ['IO12', 'I/O', 'GPIO12, ADC2_CH5, TOUCH_CH5, MTDI', 'gpio', 12],
  ['GND', 'G', 'Ground', 'gnd'],
  ['IO13', 'I/O', 'GPIO13, ADC2_CH4, TOUCH_CH4, MTCK', 'gpio', 13],
  ['D2', 'I/O', 'GPIO9, D2', 'flash', 9],
  ['D3', 'I/O', 'GPIO10, D3', 'flash', 10],
  ['CMD', 'I/O', 'GPIO11, CMD', 'flash', 11],
  ['5V', 'P', '5 V power supply', 'p5v'],
]);

export const J3 = rows('J3', [
  ['GND', 'G', 'Ground', 'gnd'],
  ['IO23', 'I/O', 'GPIO23', 'gpio', 23],
  ['IO22', 'I/O', 'GPIO22', 'gpio', 22],
  ['TX', 'I/O', 'GPIO1, U0TXD', 'gpio', 1],
  ['RX', 'I/O', 'GPIO3, U0RXD', 'gpio', 3],
  ['IO21', 'I/O', 'GPIO21', 'gpio', 21],
  ['GND', 'G', 'Ground', 'gnd'],
  ['IO19', 'I/O', 'GPIO19', 'gpio', 19],
  ['IO18', 'I/O', 'GPIO18', 'gpio', 18],
  ['IO5', 'I/O', 'GPIO5', 'gpio', 5],
  ['IO17', 'I/O', 'GPIO17', 'gpio', 17],
  ['IO16', 'I/O', 'GPIO16', 'gpio', 16],
  ['IO4', 'I/O', 'GPIO4, ADC2_CH0, TOUCH_CH0', 'gpio', 4],
  ['IO0', 'I/O', 'GPIO0, ADC2_CH1, TOUCH_CH1, Boot', 'gpio', 0],
  ['IO2', 'I/O', 'GPIO2, ADC2_CH2, TOUCH_CH2', 'gpio', 2],
  ['IO15', 'I/O', 'GPIO15, ADC2_CH3, TOUCH_CH3, MTDO', 'gpio', 15],
  ['D1', 'I/O', 'GPIO8, D1', 'flash', 8],
  ['D0', 'I/O', 'GPIO7, D0', 'flash', 7],
  ['CLK', 'I/O', 'GPIO6, CLK', 'flash', 6],
]);

export const PINS = [...J2, ...J3];
export const PIN_BY_ID = Object.fromEntries(PINS.map((p) => [p.id, p]));

// Capacidades por GPIO. adc: [unidad, canal]. rtc/touch/dac: número de canal.
// alt: otras funciones que lista la tabla de pines del datasheet del módulo.
export const GPIO = {
  36: { adc: [1, 0], rtc: 0, inputOnly: true, alt: [] },
  39: { adc: [1, 3], rtc: 3, inputOnly: true, alt: [] },
  34: { adc: [1, 6], rtc: 4, inputOnly: true, alt: [] },
  35: { adc: [1, 7], rtc: 5, inputOnly: true, alt: [] },
  32: { adc: [1, 4], rtc: 9, touch: 9, alt: ['XTAL_32K_P'] },
  33: { adc: [1, 5], rtc: 8, touch: 8, alt: ['XTAL_32K_N'] },
  25: { adc: [2, 8], rtc: 6, dac: 1, alt: ['EMAC_RXD0'] },
  26: { adc: [2, 9], rtc: 7, dac: 2, alt: ['EMAC_RXD1'] },
  27: { adc: [2, 7], rtc: 17, touch: 7, alt: ['EMAC_RX_DV'] },
  14: { adc: [2, 6], rtc: 16, touch: 6, jtag: 'MTMS', alt: ['HSPICLK', 'HS2_CLK', 'SD_CLK', 'EMAC_TXD2'] },
  12: { adc: [2, 5], rtc: 15, touch: 5, jtag: 'MTDI', strap: true, alt: ['HSPIQ', 'HS2_DATA2', 'SD_DATA2', 'EMAC_TXD3'] },
  13: { adc: [2, 4], rtc: 14, touch: 4, jtag: 'MTCK', alt: ['HSPID', 'HS2_DATA3', 'SD_DATA3', 'EMAC_RX_ER'] },
  15: { adc: [2, 3], rtc: 13, touch: 3, jtag: 'MTDO', strap: true, alt: ['HSPICS0', 'HS2_CMD', 'SD_CMD', 'EMAC_RXD3'] },
  2: { adc: [2, 2], rtc: 12, touch: 2, strap: true, alt: ['HSPIWP', 'HS2_DATA0', 'SD_DATA0'] },
  0: { adc: [2, 1], rtc: 11, touch: 1, strap: true, alt: ['CLK_OUT1', 'EMAC_TX_CLK'] },
  4: { adc: [2, 0], rtc: 10, touch: 0, alt: ['HSPIHD', 'HS2_DATA1', 'SD_DATA1', 'EMAC_TX_ER'] },
  16: { alt: ['HS1_DATA4', 'U2RXD', 'EMAC_CLK_OUT'] },
  17: { alt: ['HS1_DATA5', 'U2TXD', 'EMAC_CLK_OUT_180'] },
  5: { strap: true, alt: ['VSPICS0', 'HS1_DATA6', 'EMAC_RX_CLK'] },
  18: { alt: ['VSPICLK', 'HS1_DATA7'] },
  19: { alt: ['VSPIQ', 'U0CTS', 'EMAC_TXD0'] },
  21: { alt: ['VSPIHD', 'EMAC_TX_EN'] },
  3: { uart0: 'U0RXD', alt: ['CLK_OUT2'] },
  1: { uart0: 'U0TXD', alt: ['CLK_OUT3', 'EMAC_RXD2'] },
  22: { alt: ['VSPIWP', 'U0RTS', 'EMAC_TXD1'] },
  23: { alt: ['VSPID', 'HS1_STROBE'] },
  6: { flash: true, alt: [] },
  7: { flash: true, alt: [] },
  8: { flash: true, alt: [] },
  9: { flash: true, alt: [] },
  10: { flash: true, alt: [] },
  11: { flash: true, alt: [] },
};

// Pines de strapping: valor por defecto y efecto durante el reset (datasheet).
export const STRAP_NOTE = {
  0: 'GPIO0 es pin de strapping (pull-up por defecto). En alto durante el reset, arranque normal desde la flash; en bajo junto con GPIO2 en bajo, modo descarga. Es el pin del botón Boot.',
  2: 'GPIO2 es pin de strapping (pull-down por defecto). Tiene que estar en bajo, junto con GPIO0, para entrar en modo descarga: un circuito que lo fuerce a alto durante el reset puede impedir la carga de firmware.',
  5: 'GPIO5 es pin de strapping (pull-up por defecto). Junto con MTDO define la temporización del esclavo SDIO durante el reset.',
  12: 'GPIO12 (MTDI) es pin de strapping (pull-down por defecto). En alto durante el reset selecciona el regulador interno de 1,8 V para VDD_SDIO. El datasheet pide mantener IO12 en bajo al energizar el módulo.',
  15: 'GPIO15 (MTDO) es pin de strapping (pull-up por defecto). En bajo durante el reset desactiva los mensajes de arranque por U0TXD; también interviene en la temporización SDIO.',
};

// Alias por defecto del core Arduino para la variante "esp32".
export const ARDUINO_ALIAS = {
  1: ['TX'], 3: ['RX'], 21: ['SDA'], 22: ['SCL'], 5: ['SS'], 23: ['MOSI'], 19: ['MISO'], 18: ['SCK'],
  36: ['A0'], 39: ['A3'], 32: ['A4', 'T9'], 33: ['A5', 'T8'], 34: ['A6'], 35: ['A7'],
  4: ['A10', 'T0'], 0: ['A11', 'T1'], 2: ['A12', 'T2'], 15: ['A13', 'T3'], 13: ['A14', 'T4'],
  12: ['A15', 'T5'], 14: ['A16', 'T6'], 27: ['A17', 'T7'], 25: ['A18', 'DAC1'], 26: ['A19', 'DAC2'],
};

// Características DC del datasheet (3,3 V, 25 °C).
export const DC = [
  ['Entrada en alto (VIH)', '0,75 × VDD … VDD + 0,3 V'],
  ['Entrada en bajo (VIL)', '−0,3 V … 0,25 × VDD'],
  ['Salida en alto (VOH)', '≥ 0,8 × VDD'],
  ['Salida en bajo (VOL)', '≤ 0,1 × VDD'],
  ['Corriente de fuente (IOH)', 'típ. 40 mA con VOH ≥ 2,64 V y fuerza de salida máxima; baja hacia ~29 mA por pin al aumentar la cantidad de pines que entregan corriente'],
  ['Corriente de sumidero (IOL)', 'típ. 28 mA con VOL = 0,495 V y fuerza de salida máxima'],
  ['Pull-up / pull-down internos', 'típ. 45 kΩ'],
  ['Capacitancia de pin', 'típ. 2 pF'],
];

const POWER_RULE =
  'La placa admite tres formas de alimentación mutuamente excluyentes: puerto micro-USB (por defecto), pines 5V y GND, o pines 3V3 y GND. Usar más de una a la vez puede dañar la placa o la fuente.';

/** Ficha de inspección de un pin. Solo reordena los datos de arriba. */
export function pinInfo(pin) {
  const info = {
    title: pin.name,
    sub: `${pin.header} · pin ${pin.no} · tipo ${pin.type === 'G' ? 'G (tierra)' : pin.type === 'P' ? 'P (alimentación)' : pin.type}`,
    fn: pin.fn,
    caps: [],
    facts: [],
    restrictions: [],
    warnings: [],
    electrical: false,
  };
  const cap = (k, ok, v, src) => info.caps.push({ k, ok, v, src });
  const fact = (k, v, src) => info.facts.push({ k, v, src });
  const restr = (text, src) => info.restrictions.push({ text, src });
  const warn = (text, src) => info.warnings.push({ text, src });

  if (pin.kind === 'p3v3' || pin.kind === 'p5v') {
    fact('Función', pin.kind === 'p3v3' ? 'Alimentación de 3,3 V' : 'Alimentación de 5 V', ['G']);
    if (pin.kind === 'p3v3') {
      fact('Tensión recomendada (VDD33)', '3,0 a 3,6 V, típ. 3,3 V', ['D']);
      fact('Máximo absoluto (VDD33)', '3,6 V', ['D']);
      fact('Corriente que debe poder entregar la fuente', '0,5 A como mínimo', ['D']);
    }
    restr(POWER_RULE, ['G']);
    warn('No es un GPIO: no se configura como entrada ni salida.', ['G']);
    if (pin.kind === 'p5v')
      warn('5 V no debe llegar a ningún GPIO: el datasheet fija la entrada máxima en VDD + 0,3 V.', ['D']);
    return info;
  }
  if (pin.kind === 'gnd') {
    fact('Función', 'Tierra (referencia de 0 V)', ['G']);
    restr(POWER_RULE, ['G']);
    return info;
  }
  if (pin.kind === 'en') {
    fact('Función', 'CHIP_PU, reset. Es la misma línea que acciona el botón EN.', ['G']);
    fact('Nivel alto', 'Chip habilitado', ['D']);
    fact('Nivel bajo', 'Chip apagado. El pin EN del módulo no debe quedar flotante.', ['D']);
    fact('Umbrales', 'Apagado con ≤ 0,6 V; liberación del reset con ≥ 0,75 × VDD', ['D']);
    warn('No es un GPIO: no admite pinMode, lecturas ni escrituras.', ['G']);
    return info;
  }

  const g = GPIO[pin.gpio];
  if (pin.kind === 'flash') {
    cap('Entrada / salida de usuario', false, 'No usar', ['G']);
    restr(
      'D0, D1, D2, D3, CMD y CLK se usan internamente para la comunicación entre el ESP32 y la memoria flash SPI. La guía pide evitarlos: usarlos puede interrumpir el acceso a la flash.',
      ['G'],
    );
    restr(
      'El datasheet del WROOM-32E indica que GPIO6 a GPIO11 están conectados a la flash integrada y no salen del módulo (sus pines 17 a 22 figuran como NC).',
      ['D'],
    );
    warn('El laboratorio rechaza cualquier conexión a este pin.', ['L']);
    return info;
  }

  info.electrical = true;
  const out = !g.inputOnly;
  cap('Entrada digital', true, 'Sí', ['G']);
  cap('Salida digital', out, out ? 'Sí' : 'No: pin de solo entrada', out ? ['G'] : ['G', 'I']);
  cap(
    'Pull-up / pull-down internos',
    out,
    out ? 'Sí, típ. 45 kΩ' : 'No: GPIO34 a GPIO39 no tienen resistencias internas',
    out ? ['D'] : ['I'],
  );
  cap('ADC', !!g.adc, g.adc ? `ADC${g.adc[0]}_CH${g.adc[1]} · SAR de 12 bits` : 'Sin canal ADC', g.adc ? ['G', 'D'] : ['G']);
  cap('DAC', !!g.dac, g.dac ? `DAC_${g.dac} · 8 bits` : 'No', g.dac ? ['G', 'D'] : ['D']);
  cap('Sensor táctil', g.touch != null, g.touch != null ? `TOUCH_CH${g.touch}` : 'No', g.touch != null ? ['G'] : ['D']);
  cap(
    'PWM (LED PWM)',
    out,
    out ? 'Sí: el LED PWM se asigna a cualquier GPIO por la matriz GPIO' : 'No: requiere salida',
    out ? ['D'] : ['I'],
  );
  cap('RTC GPIO', g.rtc != null, g.rtc != null ? `RTC_GPIO${g.rtc}` : 'No', ['D']);

  if (g.uart0) fact('UART0', g.uart0, ['G']);
  if (g.jtag) fact('JTAG', g.jtag, ['G', 'I']);
  if (ARDUINO_ALIAS[pin.gpio]) fact('Alias en el core Arduino', ARDUINO_ALIAS[pin.gpio].join(', '), ['A']);
  if (g.alt.length) fact('Otras funciones del pin', g.alt.join(', '), ['D']);

  if (g.strap) restr(STRAP_NOTE[pin.gpio], ['D']);
  if (g.inputOnly)
    restr(
      'GPIO34 a GPIO39 solo pueden configurarse como entrada y no tienen pull-up ni pull-down activables por software.',
      ['I'],
    );
  if (g.adc && g.adc[0] === 2)
    restr('Los pines de ADC2 no pueden usarse para leer el ADC mientras el Wi-Fi está activo. Para eso conviene un pin de ADC1.', ['I']);
  if (g.uart0)
    restr('GPIO1 (TXD) y GPIO3 (RXD) se usan habitualmente para cargar firmware y depurar: son la conexión con el puente USB-UART.', ['I', 'G']);
  if (g.jtag) restr('GPIO12 a GPIO15 se usan habitualmente para depuración JTAG.', ['I']);
  if (pin.gpio === 16 || pin.gpio === 17)
    restr(
      'GPIO16 y GPIO17 están disponibles en placas con módulos ESP32-WROOM y ESP32-SOLO-1. En placas con módulos ESP32-WROVER quedan reservados para uso interno.',
      ['G'],
    );
  if (pin.gpio === 36 || pin.gpio === 39)
    restr('Conviene evitar interrupciones en GPIO36 y GPIO39 cuando se usan ADC, Wi-Fi o Bluetooth con modo de sueño habilitado.', ['I']);

  warn('No apliques más de VDD + 0,3 V a este pin (unos 3,6 V con VDD = 3,3 V). Una señal de 5 V excede ese límite.', ['D']);
  if (out) warn('Para manejar un LED usá siempre una resistencia en serie. El laboratorio no enciende un LED sin ella.', ['L']);
  return info;
}

// Componentes clave de la placa según la guía (el orden de la guía es horario desde el LED).
export const BOARD_PARTS = {
  module: {
    name: 'ESP32-WROOM-32E',
    lines: [
      ['Módulo con el ESP32 como núcleo.', ['G']],
      ['En la variante ESP32-DevKitC-32E: flash de 4 MB, sin PSRAM, antena PCB integrada.', ['G']],
      ['Cristal de 40 MHz. Dimensiones del módulo: 18,0 × 25,5 × 3,1 mm.', ['D']],
      ['Dos ADC SAR de 12 bits con 18 canales, dos DAC de 8 bits, 10 GPIO táctiles y 16 generadores de LED PWM.', ['D']],
      ['El laboratorio no emula el procesador ni simula Wi-Fi o Bluetooth.', ['L']],
    ],
  },
  antenna: {
    name: 'Antena PCB del módulo',
    lines: [
      ['El ESP32-WROOM-32E trae antena PCB integrada, con una zona de exclusión alrededor.', ['D']],
      ['El laboratorio no simula ni mide radiofrecuencia.', ['L']],
    ],
  },
  usb: {
    name: 'Puerto micro-USB',
    lines: [
      ['Alimenta la placa y comunica la computadora con el módulo ESP32-WROOM-32E.', ['G']],
      ['Es la opción de alimentación por defecto.', ['G']],
      ['En el laboratorio, Iniciar equivale a conectar el USB y Detener a desconectarlo.', ['L']],
    ],
  },
  bridge: {
    name: 'Puente USB-UART',
    lines: [
      ['Un único chip puente USB-UART, con velocidades de hasta 3 Mbps.', ['G']],
      ['En el laboratorio, el monitor serie representa este enlace con texto generado por el simulador.', ['L']],
    ],
  },
  en: {
    name: 'Botón EN',
    lines: [
      ['Botón de reset.', ['G']],
      ['En el laboratorio reinicia el estado virtual: pines sin configurar, tiempo en cero y el programa arranca de nuevo desde setup().', ['L']],
    ],
  },
  boot: {
    name: 'Botón Boot',
    lines: [
      ['Botón de descarga. Mantener Boot y pulsar EN inicia el modo de descarga de firmware por el puerto serie.', ['G']],
      ['Boot actúa sobre GPIO0, que es pin de strapping.', ['G', 'D']],
      ['El laboratorio muestra ese estado pero no carga firmware.', ['L']],
    ],
  },
  pwr: {
    name: 'LED de encendido 5V',
    lines: [
      ['Se enciende cuando se conecta el USB o una fuente externa de 5 V.', ['G']],
      ['En el laboratorio se enciende mientras la placa virtual está alimentada.', ['L']],
    ],
  },
};
