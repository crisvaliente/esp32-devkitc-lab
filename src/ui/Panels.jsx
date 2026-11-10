// Paneles de instrumentos: inspector, conexiones, monitor serie, código y límites.

import { SOURCES, PINS, PIN_BY_ID, pinInfo, DC, BOARD_PARTS } from '../data/pins.js';
import { PARTS, PART_IDS, LED_OHMS, termLabel } from '../lab/parts.js';
import { PROGRAMS, levelName, potMillivolts, tempMillivolts, mvToRaw } from '../sim/engine.js';

const { useState, useRef, useEffect } = React;

export const Src = ({ ids }) => (
  <span className="src">
    {ids.map((id) => (
      <abbr key={id} className={`src-${id}`} title={SOURCES[id].label}>{id}</abbr>
    ))}
  </span>
);

const STATUS = { ok: 'Correcto', warn: 'Con advertencias', error: 'Con errores', unused: 'Sin conectar' };
const LEVEL = { error: 'Error', warn: 'Advertencia', info: 'Nota' };

const pinLabel = (p) => (p.gpio != null && !p.name.startsWith('IO') ? `${p.name} · GPIO${p.gpio}` : p.name);
const pinOption = (p) => `${p.header}-${p.no} · ${pinLabel(p)}`;

/* ---------- Inspector ---------- */

function PinState({ pin, board, wiring }) {
  const users = Object.entries(wiring).filter(([, id]) => id === pin.id).map(([k]) => termLabel(k));
  const st = pin.kind === 'gpio' ? board.pins[pin.gpio] : null;
  let state = 'Placa sin alimentación.';
  if (board.power) {
    if (pin.kind !== 'gpio') state = pin.kind === 'gnd' ? '0 V (referencia).' : pin.kind === 'en' ? 'En alto: chip habilitado.' : pin.kind === 'flash' ? 'No se simula.' : 'Alimentado.';
    else if (!st) state = 'Sin configurar por el programa actual.';
    else if (st.mode === 'ANALOG') state = `Entrada analógica: ${st.mv} mV, lectura ${st.raw} de 4095 (ideal).`;
    else state = `${st.mode}, nivel ${levelName(st.level)}.`;
  }
  return (
    <div className="simbox">
      <h4>En esta simulación</h4>
      <dl className="kv">
        <dt>Conectado a</dt>
        <dd>{users.length ? users.join(' · ') : 'Nada'}</dd>
        <dt>Estado</dt>
        <dd>{state}</dd>
      </dl>
    </div>
  );
}

function PinInspector({ pin, board, wiring }) {
  const info = pinInfo(pin);
  return (
    <div className="insp">
      <header className="insp-head">
        <div>
          <h3>{pin.gpio != null ? `${pin.name} · GPIO${pin.gpio}` : pin.name}</h3>
          <p className="muted">{info.sub}</p>
        </div>
        <span className={`tag k-${pin.kind}${info.caps.length && !info.caps[1]?.ok && pin.kind === 'gpio' ? ' k-in' : ''}`}>
          {pin.kind === 'gpio' ? (info.caps[1].ok ? 'Entrada y salida' : 'Solo entrada') : pin.kind === 'flash' ? 'Reservado' : pin.kind === 'gnd' ? 'Tierra' : pin.kind === 'en' ? 'Reset' : 'Alimentación'}
        </span>
      </header>

      <div className="chips" aria-label="Funciones según la guía">
        {pin.fn.split(', ').map((f) => <code key={f}>{f}</code>)}
        <Src ids={['G']} />
      </div>

      <PinState pin={pin} board={board} wiring={wiring} />

      {info.caps.length > 0 && (
        <section>
          <h4>Capacidades</h4>
          <ul className="caps">
            {info.caps.map((c) => (
              <li key={c.k} className={c.ok ? 'yes' : 'no'}>
                <span className="mark" aria-hidden="true">{c.ok ? '✓' : '—'}</span>
                <span className="cap-k">{c.k}</span>
                <span className="cap-v">{c.v} <Src ids={c.src} /></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {info.facts.length > 0 && (
        <section>
          <h4>{pin.kind === 'gpio' ? 'Comunicaciones y otras funciones' : 'Datos'}</h4>
          <dl className="kv">
            {info.facts.map((f) => (
              <React.Fragment key={f.k}>
                <dt>{f.k}</dt>
                <dd>{f.v} <Src ids={f.src} /></dd>
              </React.Fragment>
            ))}
          </dl>
        </section>
      )}

      {info.restrictions.length > 0 && (
        <section>
          <h4>Restricciones de arranque y de uso</h4>
          <ul className="notes restr">
            {info.restrictions.map((r, i) => <li key={i}>{r.text} <Src ids={r.src} /></li>)}
          </ul>
        </section>
      )}

      {info.warnings.length > 0 && (
        <section>
          <h4>Advertencias de seguridad</h4>
          <ul className="notes warnl">
            {info.warnings.map((r, i) => <li key={i}>{r.text} <Src ids={r.src} /></li>)}
          </ul>
        </section>
      )}

      {info.electrical && (
        <details className="dc">
          <summary>Características eléctricas del datasheet (3,3 V, 25 °C)</summary>
          <dl className="kv">
            {DC.map(([k, v]) => (
              <React.Fragment key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </React.Fragment>
            ))}
          </dl>
          <p className="muted small">Valores típicos de caracterización <Src ids={['D']} />. El laboratorio no los usa para calcular nada.</p>
        </details>
      )}
    </div>
  );
}

function CompInspector({ id, board, onReset, onDownload }) {
  const c = BOARD_PARTS[id];
  return (
    <div className="insp">
      <header className="insp-head">
        <div>
          <h3>{c.name}</h3>
          <p className="muted">Componente de la placa</p>
        </div>
      </header>
      <ul className="notes plain">
        {c.lines.map(([text, src], i) => <li key={i}>{text} <Src ids={src} /></li>)}
      </ul>
      {(id === 'en' || id === 'boot') && (
        <div className="row">
          {id === 'en' && <button type="button" className="btn" onClick={onReset} disabled={!board.power}>Pulsar EN</button>}
          {id === 'boot' && <button type="button" className="btn" onClick={onDownload} disabled={!board.power}>Mantener Boot y pulsar EN</button>}
          {!board.power && <span className="muted small">Primero iniciá la simulación.</span>}
        </div>
      )}
    </div>
  );
}

function PartInspector({ id, analysis, wiring }) {
  const p = PARTS[id];
  const a = analysis.parts[id];
  return (
    <div className="insp">
      <header className="insp-head">
        <div>
          <h3>{p.name}</h3>
          <p className="muted">Componente del banco · modelo del laboratorio</p>
        </div>
        <span className={`tag st-${a.status}`}>{STATUS[a.status]}</span>
      </header>
      <dl className="kv">
        {p.terms.map((t) => {
          const pin = wiring[`${id}.${t.id}`];
          return (
            <React.Fragment key={t.id}>
              <dt>{t.label} · {t.long}</dt>
              <dd>{pin ? pinOption(PIN_BY_ID[pin]) : 'Sin conectar'}</dd>
            </React.Fragment>
          );
        })}
      </dl>
      <Issues list={a.issues} />
      <section>
        <h4>Cómo se modela</h4>
        <ul className="notes plain">
          {p.model.map((m, i) => <li key={i}>{m} <Src ids={['L']} /></li>)}
        </ul>
      </section>
    </div>
  );
}

export function Inspector({ sel, board, wiring, analysis, onReset, onDownload }) {
  return (
    <div>
      {sel.type === 'pin' && <PinInspector pin={PIN_BY_ID[sel.id]} board={board} wiring={wiring} />}
      {sel.type === 'comp' && <CompInspector id={sel.id} board={board} onReset={onReset} onDownload={onDownload} />}
      {sel.type === 'part' && <PartInspector id={sel.id} analysis={analysis} wiring={wiring} />}
      <p className="srckey">
        {Object.entries(SOURCES).map(([id, s]) => (
          <span key={id}>
            <abbr className={`src-${id}`}>{id}</abbr>{' '}
            {s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.label}</a> : s.label}
          </span>
        ))}
      </p>
    </div>
  );
}

/* ---------- Conexiones ---------- */

function Issues({ list }) {
  if (!list.length) return null;
  return (
    <ul className="issues">
      {list.map((i, n) => (
        <li key={n} className={`lv-${i.level}`}>
          <b>{LEVEL[i.level]}</b> {i.text}
        </li>
      ))}
    </ul>
  );
}

export function Connections({ wiring, analysis, ledOhms, armed, onConnect, onArm, onOhms, onClear, onRestore }) {
  return (
    <div className="conn">
      <div className="conn-top">
        <p className={`summary ${analysis.errors ? 'bad' : analysis.warnings ? 'warn' : 'good'}`}>
          {analysis.errors
            ? `${analysis.errors} ${analysis.errors === 1 ? 'error' : 'errores'} de cableado`
            : analysis.warnings
              ? `Sin errores, ${analysis.warnings} ${analysis.warnings === 1 ? 'advertencia' : 'advertencias'}`
              : 'Cableado sin errores ni advertencias'}
        </p>
        <button type="button" className="btn ghost" onClick={onRestore}>Restaurar cableado de ejemplo</button>
      </div>
      <p className="muted small">
        Elegí el pin en la lista, o tocá un terminal en el banco y después un pin de la placa. La validación revisa alimentación, polaridad, tipo de pin y resistencia limitadora; no calcula tensiones ni corrientes reales.
      </p>
      {PART_IDS.map((id) => {
        const p = PARTS[id];
        const a = analysis.parts[id];
        return (
          <fieldset key={id} className={`partcard st-${a.status}`}>
            <legend>
              {p.name} <span className={`tag st-${a.status}`}>{STATUS[a.status]}</span>
            </legend>
            {p.terms.map((t) => {
              const key = `${id}.${t.id}`;
              return (
                <div className="termrow" key={key}>
                  <label htmlFor={`sel-${key}`}><b>{t.label}</b> {t.long}</label>
                  <select id={`sel-${key}`} value={wiring[key] || ''} onChange={(e) => onConnect(key, e.target.value || null)}>
                    <option value="">Sin conectar</option>
                    <optgroup label="J2 (izquierda)">
                      {PINS.filter((x) => x.header === 'J2').map((x) => <option key={x.id} value={x.id}>{pinOption(x)}</option>)}
                    </optgroup>
                    <optgroup label="J3 (derecha)">
                      {PINS.filter((x) => x.header === 'J3').map((x) => <option key={x.id} value={x.id}>{pinOption(x)}</option>)}
                    </optgroup>
                  </select>
                  <button type="button" className={`btn mini${armed === key ? ' on' : ''}`} aria-pressed={armed === key} onClick={() => onArm(key)}>
                    {armed === key ? 'Cancelar' : 'Elegir en la placa'}
                  </button>
                </div>
              );
            })}
            {id === 'led' && (
              <div className="termrow">
                <label htmlFor="sel-ohms"><b>R</b> resistencia en serie</label>
                <select id="sel-ohms" value={ledOhms} onChange={(e) => onOhms(Number(e.target.value))}>
                  {LED_OHMS.map((o) => <option key={o} value={o}>{o ? `${o} Ω` : 'Sin resistencia'}</option>)}
                </select>
                <span />
              </div>
            )}
            <Issues list={a.issues} />
            {a.status !== 'unused' && (
              <button type="button" className="btn ghost mini" onClick={() => onClear(id)}>Desconectar {p.short.toLowerCase()}</button>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}

/* ---------- Monitor serie ---------- */

const stamp = (t) => `${(t / 1000).toFixed(3).padStart(8, ' ')} s`;

export function Monitor({ log, board, onSend, onClear }) {
  const [text, setText] = useState('');
  const [follow, setFollow] = useState(true);
  const box = useRef(null);
  useEffect(() => {
    if (follow && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [log, follow]);
  const submit = (e) => {
    e.preventDefault();
    if (!text) return;
    onSend(text);
    setText('');
  };
  return (
    <div className="mon">
      <div className="mon-top">
        <span className="tag sim">Salida simulada</span>
        <span className="muted small">Equivale a 115200 baudios en el sketch. Las líneas [sim] son eventos del laboratorio y no existirían en una placa real.</span>
      </div>
      <div className="mon-box" ref={box} role="log" aria-label="Monitor serie" tabIndex={0}>
        {log.map((l) => (
          <div key={l.id} className={`ln ${l.kind}`}>
            <span className="ts">{stamp(l.t)}</span>
            <span className="tx">{l.kind === 'sim' ? `[sim] ${l.text}` : l.kind === 'rx' ? `→ ${l.text}` : l.text}</span>
          </div>
        ))}
      </div>
      <form className="mon-send" onSubmit={submit}>
        <label htmlFor="mon-input" className="vh">Texto para enviar a la placa</label>
        <input id="mon-input" value={text} onChange={(e) => setText(e.target.value)} placeholder={board.program === 'digital' && board.mode === 'run' ? "Escribí 1 o 0" : 'Texto para enviar'} maxLength={32} autoComplete="off" />
        <button type="submit" className="btn" disabled={!text}>Enviar</button>
        <button type="button" className="btn ghost" onClick={onClear} disabled={!log.length}>Limpiar</button>
        <label className="check"><input id="mon-follow" type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> Seguir el final</label>
      </form>
    </div>
  );
}

/* ---------- Código ---------- */

export function Code({ sketch, program }) {
  const [msg, setMsg] = useState('');
  const pre = useRef(null);
  useEffect(() => setMsg(''), [sketch.code]);
  const selectAll = () => {
    const r = document.createRange();
    r.selectNodeContents(pre.current);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  };
  const copy = () => {
    const fallback = () => {
      selectAll();
      setMsg('No se pudo copiar automáticamente. El código quedó seleccionado: copialo con el menú del sistema.');
    };
    try {
      navigator.clipboard.writeText(sketch.code).then(() => setMsg('Copiado'), fallback);
    } catch {
      fallback();
    }
  };
  return (
    <div className="code">
      <p className="callout">
        Este sketch se genera a partir del cableado y del programa elegidos. El laboratorio no lo compila ni lo ejecuta: el motor de simulación reproduce su comportamiento esperado con una implementación aparte en JavaScript.
      </p>
      {sketch.code ? (
        <>
          <div className="code-bar">
            <span className="fname">{program}.ino</span>
            <span className="muted small" role="status">{msg}</span>
            <button type="button" className="btn" onClick={copy}>Copiar código</button>
          </div>
          <pre ref={pre} tabIndex={0}><code>{sketch.code}</code></pre>
        </>
      ) : (
        <p className="empty">No hay código para {PROGRAMS[program].name} con este cableado. {sketch.reason}</p>
      )}
    </div>
  );
}

/* ---------- Límites ---------- */

const REAL = [
  ['Orden, nombre, tipo y funciones de los 38 pines de J2 y J3; componentes clave de la placa; opciones de alimentación; nota sobre los pines de la flash y sobre GPIO16 y GPIO17.', ['G']],
  ['Pines de strapping con su valor por defecto y efecto; funciones alternativas de cada pin; límites de tensión, características DC y periféricos ADC, DAC, táctil y LED PWM del módulo.', ['D']],
  ['Pines de solo entrada sin resistencias internas, restricción de ADC2 con Wi-Fi activo, uso habitual de GPIO1 y GPIO3 y de los pines JTAG.', ['I']],
  ['Alias por defecto de los pines en el core Arduino (SDA, SCL, MOSI, A0…).', ['A']],
];
const SIMULATED = [
  'Los tres programas (Blink, GPIO digital, Lectura ADC) son máquinas de estados en JavaScript que reproducen lo que haría el sketch mostrado. No se interpreta ni se compila el código.',
  'El tiempo avanza con el reloj del navegador en pasos de unos 50 ms. No representa la temporización real del microcontrolador.',
  'El ADC es ideal: lectura lineal de 0 a 4095 sobre 0 a 3300 mV, sin ruido ni calibración. El datasheet indica diferencias de ±6 % entre chips por defecto, que acá no existen.',
  'El LED enciende o apaga de forma lógica. La corriente mostrada es una estimación con una caída supuesta de 2,0 V.',
  'El sensor de temperatura es un modelo genérico (500 mV + 10 mV/°C). El pulsador no tiene rebote y las resistencias internas son ideales.',
  'El monitor serie muestra texto generado por el simulador. No se reproduce el registro de arranque del bootloader.',
  'El dibujo de la placa es esquemático: proporciones y posición de los componentes menores son aproximadas. El orden y el lado de los pines sí siguen la guía.',
];
const MISSING = [
  'Emulación del procesador, ejecución o carga de firmware. El modo descarga solo se muestra como estado.',
  'Wi-Fi, Bluetooth y cualquier medición o comportamiento de radiofrecuencia.',
  'PWM, DAC, sensores táctiles, I2C, SPI, UART adicionales, interrupciones y modos de bajo consumo.',
  'Análisis eléctrico: tensiones y corrientes reales, consumo, calentamiento o daño de componentes.',
  'Efecto real de los pines de strapping sobre el arranque y conflicto entre ADC2 y Wi-Fi: solo se advierten.',
  'Edición libre del código o del circuito: hay cuatro componentes fijos y tres programas.',
];

export function Limits() {
  return (
    <div className="limits">
      <p className="callout">
        Esta aplicación es un laboratorio didáctico. No es un simulador eléctrico de precisión ni un emulador del ESP32, y no sirve para validar un diseño antes de fabricarlo.
      </p>
      <section className="lim real">
        <h4>Datos reales de la documentación de Espressif</h4>
        <ul>{REAL.map(([t, s], i) => <li key={i}>{t} <Src ids={s} /></li>)}</ul>
        <ul className="links">
          {Object.entries(SOURCES).filter(([, s]) => s.url).map(([id, s]) => (
            <li key={id}><abbr className={`src-${id}`}>{id}</abbr> <a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></li>
          ))}
        </ul>
      </section>
      <section className="lim simd">
        <h4>Comportamientos simulados</h4>
        <ul>{SIMULATED.map((t, i) => <li key={i}>{t}</li>)}</ul>
      </section>
      <section className="lim miss">
        <h4>No implementado</h4>
        <ul>{MISSING.map((t, i) => <li key={i}>{t}</li>)}</ul>
      </section>
    </div>
  );
}

/* ---------- Entradas y estado de GPIO ---------- */

export function Bench({ inputs, board, circuit, program, onInput, onSend }) {
  const running = board.mode === 'run';
  const potMv = circuit.pot ? potMillivolts(inputs.pot, circuit.pot.inverted) : null;
  const tmpMv = tempMillivolts(inputs.tempC);
  const hold = {
    onPointerDown: (e) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      onInput({ pressed: true });
    },
    onPointerUp: () => onInput({ pressed: false }),
    onPointerCancel: () => onInput({ pressed: false }),
    onLostPointerCapture: () => onInput({ pressed: false }),
    onKeyDown: (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) onInput({ pressed: true });
    },
    onKeyUp: (e) => {
      if (e.key === ' ' || e.key === 'Enter') onInput({ pressed: false });
    },
    onBlur: () => inputs.pressed && onInput({ pressed: false }),
  };
  const rows = Object.entries(board.pins);
  return (
    <div className="bench">
      <div className="inputs">
        <div className="ctl">
          <label htmlFor="in-pot">Potenciómetro <output>{Math.round(inputs.pot * 100)} %</output></label>
          <input id="in-pot" type="range" min="0" max="100" step="1" value={Math.round(inputs.pot * 100)} onChange={(e) => onInput({ pot: Number(e.target.value) / 100 })} />
          <p className="hint">{potMv == null ? 'Sin efecto: el potenciómetro no está bien conectado.' : `Cursor ideal: ${potMv} mV, lectura ${mvToRaw(potMv)}. Lo usa Lectura ADC.`}</p>
        </div>
        <div className="ctl">
          <label htmlFor="in-temp">Temperatura del sensor <output>{inputs.tempC.toFixed(1).replace('.', ',')} °C</output></label>
          <input id="in-temp" type="range" min="-10" max="60" step="0.5" value={inputs.tempC} onChange={(e) => onInput({ tempC: Number(e.target.value) })} />
          <p className="hint">{circuit.tmp ? `Salida del modelo: ${tmpMv} mV. La usa Lectura ADC.` : 'Sin efecto: el sensor no está bien conectado.'}</p>
        </div>
        <div className="ctl">
          <span className="ctl-l">Pulsador <output>{inputs.pressed ? 'pulsado' : 'suelto'}</output></span>
          <button type="button" className={`btn hold${inputs.pressed ? ' on' : ''}`} aria-pressed={inputs.pressed} {...hold}>Mantener para pulsar</button>
          <p className="hint">{circuit.btn ? 'En GPIO digital, cada pulsación alterna la salida.' : 'Sin efecto: el pulsador no está bien conectado.'}</p>
        </div>
        <div className="ctl">
          <span className="ctl-l">Comando por puerto serie</span>
          <div className="row">
            <button type="button" className="btn" onClick={() => onSend('1')} disabled={!running || program !== 'digital'}>Enviar 1 (encender)</button>
            <button type="button" className="btn" onClick={() => onSend('0')} disabled={!running || program !== 'digital'}>Enviar 0 (apagar)</button>
          </div>
          <p className="hint">{program !== 'digital' ? 'Disponible con el programa GPIO digital.' : running ? 'Cambia el nivel del GPIO del LED.' : 'Iniciá la simulación para enviar comandos.'}</p>
        </div>
      </div>
      <div className="gpio">
        <h3>Estado de los GPIO <span className="tag sim">simulado</span></h3>
        {rows.length ? (
          <table>
            <thead><tr><th>Pin</th><th>Modo</th><th>Valor</th></tr></thead>
            <tbody>
              {rows.map(([g, s]) => (
                <tr key={g}>
                  <td>GPIO{g}</td>
                  <td>{s.mode}</td>
                  <td>{s.mode === 'ANALOG' ? <span className="lvl an">{s.raw} · {s.mv} mV</span> : <span className={`lvl ${s.level ? 'hi' : 'lo'}`}>{levelName(s.level)}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted small">{board.power ? (board.mode === 'download' ? 'Modo descarga: ningún pin configurado.' : 'Ningún pin configurado.') : 'Placa sin alimentación: ningún pin configurado.'}</p>
        )}
      </div>
    </div>
  );
}
