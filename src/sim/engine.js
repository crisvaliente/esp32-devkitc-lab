// MOTOR DE SIMULACIÓN. Reproduce el comportamiento esperado de los sketches de ejemplo.
// No interpreta ni ejecuta el código Arduino: cada programa está reescrito acá como
// una máquina de estados en JavaScript. Funciones puras, sin React ni DOM.

export const PROGRAMS = {
  blink: { name: 'Blink', about: 'El LED cambia de estado cada intervalo.' },
  digital: { name: 'GPIO digital', about: "El GPIO del LED responde a los comandos '1' y '0' y al pulsador." },
  adc: { name: 'Lectura ADC', about: 'Lee el potenciómetro y el sensor y lo informa por el puerto serie.' },
};

export const TICK_MS = 50;

export function canRun(program, c) {
  if (program === 'blink' || program === 'digital') {
    return c.led && c.led.gpio != null
      ? { ok: true }
      : { ok: false, reason: `${PROGRAMS[program].name} necesita el LED con resistencia controlado por un GPIO y sin errores de cableado.` };
  }
  if (program === 'adc') {
    return c.pot || c.tmp
      ? { ok: true }
      : { ok: false, reason: 'Lectura ADC necesita el potenciómetro o el sensor conectados a un pin con ADC y sin errores de cableado.' };
  }
  return { ok: false, reason: 'Programa desconocido.' };
}

// Modelos ideales de las entradas analógicas.
export const potMillivolts = (pos, inverted) => {
  const p = Math.min(1, Math.max(0, inverted ? 1 - pos : pos));
  return Math.round(p * 3300);
};
export const tempMillivolts = (tempC) => Math.round(500 + 10 * tempC);
export const mvToRaw = (mv) => Math.max(0, Math.min(4095, Math.round((mv / 3300) * 4095)));
export const levelName = (v) => (v ? 'HIGH' : 'LOW');

export const createBoard = () => ({ power: false, mode: 'off', program: null, t: 0, pins: {}, v: {} });

const sim = (t, text) => ({ t, kind: 'sim', text });
const fw = (t, text) => ({ t, kind: 'fw', text });

const ledLevel = (c, on) => (on !== c.led.activeLow ? 1 : 0);
const btnLevel = (c, inputs) => {
  const active = c.btn.pull === 'up' ? 0 : 1;
  return inputs.pressed ? active : 1 - active;
};

function analogPins(c, inputs) {
  const pins = {};
  if (c.pot) {
    const mv = potMillivolts(inputs.pot, c.pot.inverted);
    pins[c.pot.gpio] = { mode: 'ANALOG', mv, raw: mvToRaw(mv) };
  }
  if (c.tmp) {
    const mv = tempMillivolts(inputs.tempC);
    pins[c.tmp.gpio] = { mode: 'ANALOG', mv, raw: mvToRaw(mv) };
  }
  return pins;
}

function boot(program, c, params, inputs, log) {
  const b = { power: true, mode: 'run', program, t: 0, pins: {}, v: {} };
  const ready = canRun(program, c);
  if (!ready.ok) {
    b.mode = 'halt';
    log.push(sim(0, `Programa detenido. ${ready.reason}`));
    return b;
  }
  if (program === 'blink') {
    b.pins[c.led.gpio] = { mode: 'OUTPUT', level: ledLevel(c, false) };
    b.v = { on: false, next: 0 };
    log.push(fw(0, `Blink: GPIO${c.led.gpio}, ${params.intervalMs} ms`));
  }
  if (program === 'digital') {
    b.pins[c.led.gpio] = { mode: 'OUTPUT', level: ledLevel(c, false) };
    b.v = { on: false };
    if (c.btn) {
      const lv = btnLevel(c, inputs);
      b.pins[c.btn.gpio] = { mode: c.btn.pull === 'up' ? 'INPUT_PULLUP' : 'INPUT_PULLDOWN', level: lv };
      b.v.lastBtn = lv;
    }
    log.push(fw(0, "Listo: comandos '1' y '0' por puerto serie"));
  }
  if (program === 'adc') {
    b.pins = analogPins(c, inputs);
    b.v = { next: 0 };
    log.push(fw(0, `Lectura ADC cada ${params.intervalMs} ms`));
  }
  return b;
}

/** Conecta el USB: alimenta la placa y arranca el programa desde setup(). */
export function powerOn(program, c, params, inputs) {
  const log = [sim(0, `USB conectado. Arranca "${PROGRAMS[program].name}" (comportamiento simulado, no se ejecuta firmware).`)];
  return { board: boot(program, c, params, inputs, log), log };
}

export function powerOff(b) {
  if (!b.power) return { board: b, log: [] };
  return { board: createBoard(), log: [sim(b.t, 'USB desconectado. Placa sin alimentación.')] };
}

/** Reset por EN o por un cambio de cableado o parámetros. */
export function reset(b, program, c, params, inputs, cause = 'en') {
  if (!b.power) return { board: b, log: [sim(0, 'La placa no tiene alimentación: EN no tiene efecto.')] };
  const why =
    cause === 'en'
      ? 'Reset por EN: pines sin configurar, tiempo en cero y el programa arranca de nuevo.'
      : 'Cambió el cableado o un parámetro: se reinicia el programa.';
  const log = [sim(b.t, why)];
  return { board: boot(program, c, params, inputs, log), log };
}

/** Boot + EN: estado de descarga. El laboratorio no carga firmware. */
export function enterDownload(b) {
  if (!b.power) return { board: b, log: [sim(0, 'La placa no tiene alimentación: Boot + EN no tiene efecto.')] };
  return {
    board: { power: true, mode: 'download', program: b.program, t: 0, pins: {}, v: {} },
    log: [
      sim(b.t, 'Boot + EN: GPIO0 en bajo durante el reset. Una placa real quedaría esperando firmware por el puerto serie.'),
      sim(0, 'El laboratorio no carga firmware. Usá Reiniciar o EN para volver a ejecutar el programa.'),
    ],
  };
}

function applyOutput(b, c, on, t, log) {
  const lv = ledLevel(c, on);
  b.v.on = on;
  b.pins[c.led.gpio] = { mode: 'OUTPUT', level: lv };
  log.push(fw(t, `GPIO${c.led.gpio} = ${levelName(lv)}`));
}

/** Avanza el tiempo simulado dt milisegundos. */
export function step(b, dt, inputs, c, params) {
  // Si el cableado dejó de ser válido, no avanza: el reset por cambio de configuración lo resuelve.
  if (b.mode !== 'run' || !canRun(b.program, c).ok) return { board: b, log: [] };
  const log = [];
  const nb = { ...b, t: b.t + dt, pins: { ...b.pins }, v: { ...b.v } };

  if (nb.program === 'blink') {
    while (nb.t >= nb.v.next) {
      nb.v.on = !nb.v.on;
      nb.pins[c.led.gpio] = { mode: 'OUTPUT', level: ledLevel(c, nb.v.on) };
      log.push(fw(nb.v.next, nb.v.on ? 'LED ON' : 'LED OFF'));
      nb.v.next += params.intervalMs;
    }
  }

  if (nb.program === 'digital' && c.btn) {
    const lv = btnLevel(c, inputs);
    nb.pins[c.btn.gpio] = { ...nb.pins[c.btn.gpio], level: lv };
    if (lv !== nb.v.lastBtn) {
      nb.v.lastBtn = lv;
      log.push(fw(nb.t, `GPIO${c.btn.gpio} (pulsador) = ${levelName(lv)}`));
      const active = c.btn.pull === 'up' ? 0 : 1;
      if (lv === active) applyOutput(nb, c, !nb.v.on, nb.t, log);
    }
  }

  if (nb.program === 'adc') {
    Object.assign(nb.pins, analogPins(c, inputs));
    while (nb.t >= nb.v.next) {
      if (c.pot) {
        const p = nb.pins[c.pot.gpio];
        log.push(fw(nb.v.next, `POT GPIO${c.pot.gpio}: raw=${p.raw} (~${p.mv} mV)`));
      }
      if (c.tmp) {
        const p = nb.pins[c.tmp.gpio];
        log.push(fw(nb.v.next, `TEMP GPIO${c.tmp.gpio}: ${p.mv} mV -> ${((p.mv - 500) / 10).toFixed(1)} C`));
      }
      nb.v.next += params.intervalMs;
    }
  }
  return { board: nb, log };
}

/** Texto que llega por el puerto serie hacia la placa. */
export function serialInput(b, text, c) {
  const log = [{ t: b.t, kind: 'rx', text }];
  if (b.mode !== 'run') {
    log.push(sim(b.t, 'No hay ningún programa en ejecución que reciba el dato.'));
    return { board: b, log };
  }
  if (!canRun(b.program, c).ok) return { board: b, log };
  if (b.program !== 'digital') {
    log.push(sim(b.t, `El programa ${PROGRAMS[b.program].name} no lee el puerto serie.`));
    return { board: b, log };
  }
  const nb = { ...b, pins: { ...b.pins }, v: { ...b.v } };
  let used = false;
  for (const ch of text) {
    if (ch === '1' || ch === '0') {
      applyOutput(nb, c, ch === '1', nb.t, log);
      used = true;
    }
  }
  if (!used) log.push(sim(b.t, "El programa solo reconoce '1' y '0'."));
  return { board: nb, log };
}

/** ¿Está encendido el LED del banco? */
export function ledLit(b, c) {
  if (!b.power || !c.led) return false;
  if (c.led.alwaysOn) return true;
  const p = b.pins[c.led.gpio];
  return !!p && p.mode === 'OUTPUT' && p.level === (c.led.activeLow ? 0 : 1);
}
