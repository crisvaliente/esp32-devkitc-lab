// Validación básica del cableado. Función pura: cableado + opciones -> problemas + circuito resuelto.
// No es un análisis eléctrico: aplica reglas sobre el tipo de pin de cada terminal.

import { PIN_BY_ID, GPIO, STRAP_NOTE } from '../data/pins.js';
import { PARTS, PART_IDS } from './parts.js';

const kindOf = (id) => (id ? PIN_BY_ID[id].kind : null);
const nameOf = (id) => PIN_BY_ID[id].name;
const isPow = (k) => k === 'p3v3' || k === 'p5v';
const isSig = (k) => k === 'gpio' || k === 'flash' || k === 'en';
const gp = (id) => {
  const p = PIN_BY_ID[id];
  return `GPIO${p.gpio}`;
};

export const LED_VF = 2.0; // supuesto del laboratorio

/** Revisa un pin usado como señal. role: 'out' | 'din' | 'adc'. Devuelve false si hay error. */
function checkSignal(id, role, add) {
  const pin = PIN_BY_ID[id];
  if (pin.kind === 'en') {
    add('error', 'EN es la entrada de reset (CHIP_PU), no un GPIO. Usá un pin IO.');
    return false;
  }
  if (pin.kind === 'flash') {
    add('error', `${pin.name} (GPIO${pin.gpio}) está reservado para la memoria flash SPI del módulo. La guía pide no usarlo.`);
    return false;
  }
  const g = GPIO[pin.gpio];
  let ok = true;
  if (role === 'out' && g.inputOnly) {
    add('error', `${gp(id)} es de solo entrada: no puede manejar una salida. Elegí un pin de tipo I/O.`);
    ok = false;
  }
  if (role === 'din' && g.inputOnly) {
    add('error', `${gp(id)} no tiene pull-up ni pull-down interno. Necesitaría una resistencia externa, que este laboratorio no modela. Elegí un pin de tipo I/O.`);
    ok = false;
  }
  if (role === 'adc' && !g.adc) {
    add('error', `${gp(id)} no tiene canal ADC. Usá un pin con ADC1 (GPIO32 a GPIO39) o ADC2.`);
    ok = false;
  }
  if (role === 'adc' && g.adc && g.adc[0] === 2)
    add('warn', `${gp(id)} pertenece a ADC2, que no puede leerse mientras el Wi-Fi está activo. Para un diseño con Wi-Fi conviene ADC1 (GPIO32 a GPIO39).`);
  if (g.uart0)
    add('warn', `${gp(id)} es ${g.uart0}: lo usa el puente USB-UART para cargar firmware y para el monitor serie.`);
  if (g.strap) add('warn', STRAP_NOTE[pin.gpio]);
  return ok;
}

function analyzeLed(w, opts, add) {
  const a = w['led.a'], k = w['led.k'];
  if (!a || !k) {
    add('error', `Falta conectar el ${!a ? 'ánodo (A)' : 'cátodo (K)'}.`);
    return null;
  }
  const ka = kindOf(a), kk = kindOf(k);
  let ctl = null, activeLow = false, alwaysOn = false, rail = 3.3;

  if (ka === 'gnd' && kk === 'gnd') add('error', 'Los dos terminales están en GND: no circula corriente.');
  else if (isPow(ka) && isPow(kk)) add('error', 'Ánodo y cátodo están en pines de alimentación positiva: no es un circuito válido.');
  else if (isPow(ka) && kk === 'gnd') {
    alwaysOn = true;
    rail = ka === 'p5v' ? 5 : 3.3;
    add('warn', `El LED está entre ${nameOf(a)} y GND: queda encendido siempre que la placa tenga alimentación y ningún GPIO lo controla.`);
  } else if (ka === 'gnd')
    add('error', 'Polaridad invertida: el ánodo (A) está en GND. El LED solo conduce de ánodo a cátodo. Intercambiá las dos conexiones.');
  else if (isPow(kk))
    add('error', `Polaridad invertida: el cátodo (K) está en ${nameOf(k)}. Llevá el cátodo a GND, o el ánodo a 3V3 y el cátodo al GPIO.`);
  else if (kk === 'gnd') ctl = a;
  else if (ka === 'p3v3') {
    ctl = k;
    activeLow = true;
  } else if (ka === 'p5v')
    add('error', 'El ánodo está en 5V y el cátodo en un pin de señal: el pin quedaría expuesto a más de VDD + 0,3 V. Usá 3V3.');
  else add('error', 'Los dos terminales están en pines de señal. Uno tiene que ir a GND (o el ánodo a 3V3).');

  let ok = ctl ? checkSignal(ctl, 'out', add) : alwaysOn;
  if (opts.ledOhms === 0) {
    add('error', 'Falta la resistencia limitadora: sin ella la corriente solo queda limitada por el pin y el LED. El laboratorio no enciende el LED en estas condiciones.');
    ok = false;
  }
  if (!ok) return null;

  const mA = ((rail - LED_VF) / opts.ledOhms) * 1000;
  add('info', `Corriente estimada: ${mA.toFixed(1).replace('.', ',')} mA (cálculo ideal con ${opts.ledOhms} Ω y caída supuesta de 2,0 V en el LED).`);
  if (activeLow) add('info', 'Conexión activa en bajo: el LED enciende cuando el GPIO está en LOW.');
  return { gpio: ctl ? PIN_BY_ID[ctl].gpio : null, pinId: ctl, activeLow, alwaysOn, ohms: opts.ledOhms };
}

function analyzeBtn(w, add) {
  const t1 = w['btn.t1'], t2 = w['btn.t2'];
  if (!t1 || !t2) {
    add('error', `Falta conectar el contacto ${!t1 ? '1' : '2'}.`);
    return null;
  }
  const k1 = kindOf(t1), k2 = kindOf(t2);
  const s1 = isSig(k1), s2 = isSig(k2);
  if (s1 && s2) {
    add('error', 'Los dos contactos están en pines de señal. Uno tiene que ir a GND o a 3V3.');
    return null;
  }
  if (!s1 && !s2) {
    if (k1 === k2 || (isPow(k1) && isPow(k2))) add('error', 'Los dos contactos están en pines de alimentación: ningún GPIO puede leer el pulsador.');
    else add('error', 'Cortocircuito: al pulsar se unirían alimentación y GND. Conectá un contacto a un GPIO.');
    return null;
  }
  const sig = s1 ? t1 : t2;
  const ref = kindOf(s1 ? t2 : t1);
  if (ref === 'p5v') {
    add('error', 'Al pulsar, el GPIO recibiría 5 V: supera la entrada máxima de VDD + 0,3 V. Usá GND o 3V3.');
    return null;
  }
  if (!checkSignal(sig, 'din', add)) return null;
  const pull = ref === 'gnd' ? 'up' : 'down';
  add('info', pull === 'up' ? 'Lectura con INPUT_PULLUP: en reposo HIGH, pulsado LOW.' : 'Lectura con INPUT_PULLDOWN: en reposo LOW, pulsado HIGH.');
  return { gpio: PIN_BY_ID[sig].gpio, pinId: sig, pull };
}

function analyzePot(w, add) {
  const a = w['pot.a'], wi = w['pot.w'], b = w['pot.b'];
  const missing = [!a && 'extremo A', !wi && 'cursor (W)', !b && 'extremo B'].filter(Boolean);
  if (missing.length) {
    add('error', `Falta conectar: ${missing.join(', ')}.`);
    return null;
  }
  const ka = kindOf(a), kb = kindOf(b), kw = kindOf(wi);
  let ok = true;
  if (ka === 'p5v' || kb === 'p5v') {
    add('error', 'Un extremo está en 5V: el cursor podría entregar hasta 5 V al GPIO, por encima de VDD + 0,3 V. Usá 3V3.');
    ok = false;
  } else if (isSig(ka) || isSig(kb)) {
    add('error', 'Los extremos A y B van a 3V3 y GND, no a pines de señal.');
    ok = false;
  } else if (ka === kb) {
    add('error', 'Los dos extremos están al mismo potencial: la lectura no cambiaría al girar. Conectá uno a 3V3 y el otro a GND.');
    ok = false;
  }
  if (!isSig(kw)) {
    add('error', 'El cursor (W) tiene que ir a un GPIO con ADC, no a un pin de alimentación.');
    ok = false;
  } else if (!checkSignal(wi, 'adc', add)) ok = false;
  if (!ok) return null;
  const inverted = ka === 'gnd';
  if (inverted) add('info', 'Extremo A en GND: la lectura baja al aumentar el recorrido.');
  return { gpio: PIN_BY_ID[wi].gpio, pinId: wi, inverted };
}

function analyzeTmp(w, add) {
  const v = w['tmp.vcc'], o = w['tmp.out'], g = w['tmp.gnd'];
  const missing = [!v && 'V+', !o && 'OUT', !g && 'GND'].filter(Boolean);
  if (missing.length) {
    add('error', `Falta conectar: ${missing.join(', ')}.`);
    return null;
  }
  const kv = kindOf(v), kg = kindOf(g), ko = kindOf(o);
  let ok = true;
  if (kv === 'gnd' && isPow(kg)) {
    add('error', 'Polaridad invertida: V+ está en GND y GND en un pin de alimentación. Intercambiá las dos conexiones.');
    ok = false;
  } else {
    if (!isPow(kv)) {
      add('error', 'V+ tiene que ir a 3V3.');
      ok = false;
    }
    if (kg !== 'gnd') {
      add('error', 'El terminal GND del sensor tiene que ir a un pin GND.');
      ok = false;
    }
  }
  if (ok && kv === 'p5v')
    add('warn', 'Sensor alimentado desde 5V. Con el modelo simulado la salida queda por debajo de 3,3 V, pero con un sensor real verificá que nunca supere VDD + 0,3 V.');
  if (!isSig(ko)) {
    add('error', 'OUT tiene que ir a un GPIO con ADC, no a un pin de alimentación.');
    ok = false;
  } else if (!checkSignal(o, 'adc', add)) ok = false;
  if (!ok) return null;
  return { gpio: PIN_BY_ID[o].gpio, pinId: o };
}

/**
 * @param {Record<string,string|null>} wiring  clave "parte.terminal" -> id de pin
 * @param {{ledOhms:number}} opts
 */
export function analyze(wiring, opts) {
  const issues = [];
  const parts = {};
  const circuit = { led: null, btn: null, pot: null, tmp: null };

  // Pines de señal compartidos por más de un terminal.
  const users = {};
  for (const [key, pinId] of Object.entries(wiring)) {
    if (pinId && isSig(kindOf(pinId))) (users[pinId] ||= []).push(key);
  }

  for (const id of PART_IDS) {
    const keys = PARTS[id].terms.map((t) => `${id}.${t.id}`);
    const connected = keys.filter((k) => wiring[k]);
    const mine = [];
    const add = (level, text) => mine.push({ part: id, level, text });
    let resolved = null;

    if (connected.length === 0) {
      parts[id] = { status: 'unused', issues: [] };
      continue;
    }
    if (id === 'led') resolved = analyzeLed(wiring, opts, add);
    if (id === 'btn') resolved = analyzeBtn(wiring, add);
    if (id === 'pot') resolved = analyzePot(wiring, add);
    if (id === 'tmp') resolved = analyzeTmp(wiring, add);

    for (const k of connected) {
      const shared = users[wiring[k]];
      if (shared && shared.length > 1) {
        add('error', `${nameOf(wiring[k])} está compartido por más de un terminal de señal. Cada señal necesita su propio GPIO.`);
        resolved = null;
        break;
      }
    }

    const status = mine.some((i) => i.level === 'error') ? 'error' : mine.some((i) => i.level === 'warn') ? 'warn' : 'ok';
    parts[id] = { status, issues: mine };
    circuit[id] = status === 'error' ? null : resolved;
    issues.push(...mine);
  }

  const count = (lv) => issues.filter((i) => i.level === lv).length;
  return { issues, parts, circuit, errors: count('error'), warnings: count('warn') };
}
