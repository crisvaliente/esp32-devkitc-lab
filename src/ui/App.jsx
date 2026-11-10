import { PIN_BY_ID, GPIO, BOARD_PARTS } from '../data/pins.js';
import { PARTS, DEFAULT_WIRING, INTERVALS, termLabel } from '../lab/parts.js';
import { analyze } from '../lab/analyze.js';
import { PROGRAMS, TICK_MS, canRun, createBoard, powerOn, powerOff, reset, enterDownload, step, serialInput, ledLit } from '../sim/engine.js';
import { generateSketch } from '../codegen/arduino.js';
import { Scene } from './Scene.jsx';
import { Inspector, Connections, Monitor, Code, Limits, Bench } from './Panels.jsx';

const { useState, useRef, useMemo, useEffect, useCallback } = React;

const TABS = [
  ['inspector', 'Inspector'],
  ['conexiones', 'Conexiones'],
  ['monitor', 'Monitor serie'],
  ['codigo', 'Código'],
  ['limites', 'Límites'],
];

const MODE = {
  off: ['off', 'Sin alimentación'],
  run: ['run', 'Ejecutando'],
  halt: ['halt', 'Detenido por el cableado'],
  download: ['dl', 'Modo descarga'],
};

function selectionText(sel, analysis) {
  if (sel.type === 'pin') {
    const p = PIN_BY_ID[sel.id];
    if (p.kind === 'gpio') {
      const g = GPIO[p.gpio];
      const bits = [g.inputOnly ? 'solo entrada' : 'entrada y salida'];
      if (g.adc) bits.push(`ADC${g.adc[0]}_CH${g.adc[1]}`);
      if (g.strap) bits.push('strapping');
      if (g.uart0) bits.push(g.uart0);
      return [`${p.name} · GPIO${p.gpio}`, bits.join(' · ')];
    }
    const what = { p3v3: 'alimentación de 3,3 V', p5v: 'alimentación de 5 V', gnd: 'tierra', en: 'reset (CHIP_PU)', flash: `GPIO${p.gpio} · reservado para la flash` }[p.kind];
    return [`${p.name} · ${p.header} pin ${p.no}`, what];
  }
  if (sel.type === 'comp') return [BOARD_PARTS[sel.id].name, 'componente de la placa'];
  const st = { ok: 'correcto', warn: 'con advertencias', error: 'con errores', unused: 'sin conectar' }[analysis.parts[sel.id].status];
  return [PARTS[sel.id].name, `componente del banco · ${st}`];
}

export function App() {
  const [wiring, setWiring] = useState(DEFAULT_WIRING);
  const [ledOhms, setLedOhms] = useState(220);
  const [program, setProgram] = useState('blink');
  const [intervalMs, setIntervalMs] = useState(500);
  const [inputs, setInputs] = useState({ pressed: false, pot: 0.5, tempC: 25 });
  const [board, setBoard] = useState(createBoard);
  const [log, setLog] = useState([{ id: 0, t: 0, kind: 'sim', text: 'Laboratorio listo. Iniciar conecta el USB virtual y arranca el programa elegido.' }]);
  const [sel, setSel] = useState({ type: 'pin', id: 'J3-2' });
  const [armed, setArmed] = useState(null);
  const [tab, setTab] = useState('inspector');
  const [pressedSw, setPressedSw] = useState(null);

  const analysis = useMemo(() => analyze(wiring, { ledOhms }), [wiring, ledOhms]);
  const params = useMemo(() => ({ intervalMs }), [intervalMs]);
  const circuit = analysis.circuit;
  const sketch = useMemo(() => generateSketch(program, circuit, params), [program, circuit, params]);
  const ready = canRun(program, circuit);

  const boardRef = useRef(board);
  const inputsRef = useRef(inputs);
  const cfg = useRef(null);
  cfg.current = { program, circuit, params };
  const seq = useRef(1);
  const tabsEl = useRef(null);

  const commit = useCallback((r) => {
    if (r.board !== boardRef.current) {
      boardRef.current = r.board;
      setBoard(r.board);
    }
    if (r.log.length) {
      const entries = r.log.map((e) => ({ ...e, id: seq.current++ }));
      setLog((l) => [...l, ...entries].slice(-300));
    }
  }, []);
  const note = (text) => commit({ board: boardRef.current, log: [{ t: boardRef.current.t, kind: 'sim', text }] });

  // Reloj del simulador.
  const running = board.mode === 'run';
  useEffect(() => {
    if (!running) return undefined;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(250, Math.round(now - last));
      last = now;
      const c = cfg.current;
      commit(step(boardRef.current, dt, inputsRef.current, c.circuit, c.params));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [running, commit]);

  // Cambiar cableado, programa o intervalo con la placa alimentada equivale a recargar y reiniciar.
  const cfgKey = JSON.stringify([circuit, program, intervalMs]);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const b = boardRef.current;
    if (b.power && b.mode !== 'download') commit(reset(b, program, circuit, params, inputsRef.current, 'config'));
  }, [cfgKey]);

  const start = () => commit(powerOn(program, circuit, params, inputsRef.current));
  const stop = () => commit(powerOff(boardRef.current));
  const doReset = () => commit(reset(boardRef.current, program, circuit, params, inputsRef.current, 'en'));
  const download = () => commit(enterDownload(boardRef.current));
  const send = (text) => commit(serialInput(boardRef.current, text, circuit));
  const onInput = (patch) => {
    inputsRef.current = { ...inputsRef.current, ...patch };
    setInputs(inputsRef.current);
    if (boardRef.current.mode === 'run') commit(step(boardRef.current, 0, inputsRef.current, circuit, params));
  };

  const connect = (key, pinId) => {
    setWiring((w) => ({ ...w, [key]: pinId }));
    note(pinId ? `Cable: ${termLabel(key)} a ${PIN_BY_ID[pinId].name}.` : `Cable retirado: ${termLabel(key)}.`);
  };
  const clearPart = (id) => {
    setWiring((w) => Object.fromEntries(Object.entries(w).map(([k, v]) => [k, k.startsWith(`${id}.`) ? null : v])));
    if (armed && armed.startsWith(`${id}.`)) setArmed(null);
    note(`${PARTS[id].name}: todos los cables retirados.`);
  };
  const restore = () => {
    setWiring(DEFAULT_WIRING);
    setLedOhms(220);
    setArmed(null);
    note('Cableado de ejemplo restaurado.');
  };

  const flash = (id) => {
    setPressedSw(id);
    setTimeout(() => setPressedSw(null), 180);
  };
  const onPin = (pin) => {
    setSel({ type: 'pin', id: pin.id });
    if (armed) {
      connect(armed, pin.id);
      setArmed(null);
    }
  };
  const onTerm = (key) => {
    setArmed((a) => (a === key ? null : key));
    setSel({ type: 'part', id: key.split('.')[0] });
  };
  const onPart = (id) => {
    setArmed(null);
    setSel({ type: 'part', id });
  };
  const onComp = (id) => {
    setArmed(null);
    setSel({ type: 'comp', id });
    if (id === 'en') {
      flash('en');
      doReset();
    }
    if (id === 'boot') {
      flash('boot');
      note(boardRef.current.power ? 'Boot pulsado: GPIO0 en bajo mientras se mantiene. Solo cambia el modo de arranque si coincide con un reset.' : 'Boot pulsado sin alimentación: no tiene efecto.');
    }
  };

  const showTab = (id) => {
    setTab(id);
    if (tabsEl.current) tabsEl.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  const lit = ledLit(board, circuit);
  const [selTitle, selSub] = selectionText(sel, analysis);
  const last = log[log.length - 1];
  const [modeCls, modeText] = MODE[board.mode];

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Laboratorio ESP32-DevKitC V4</h1>
          <p>Módulo ESP32-WROOM-32E. Simula el comportamiento de tres programas de ejemplo; no ejecuta firmware.</p>
        </div>
        <span className={`pill ${modeCls}`} role="status">
          <i aria-hidden="true" />
          {modeText}{board.mode === 'run' ? ` · ${PROGRAMS[board.program].name}` : ''}
        </span>
      </header>

      <main className="lab">
        <section className="panel control" aria-label="Control de la simulación">
          <div className="fields">
            <div className="field">
              <label htmlFor="sel-program">Programa</label>
              <select id="sel-program" value={program} onChange={(e) => setProgram(e.target.value)}>
                {Object.entries(PROGRAMS).map(([id, p]) => <option key={id} value={id}>{p.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="sel-interval">{program === 'adc' ? 'Período de lectura' : 'Intervalo'}</label>
              <select id="sel-interval" value={intervalMs} onChange={(e) => setIntervalMs(Number(e.target.value))} disabled={program === 'digital'}>
                {INTERVALS.map((v) => <option key={v} value={v}>{v} ms</option>)}
              </select>
            </div>
            <div className="actions">
              <button type="button" className="btn primary" onClick={start} disabled={board.power || !ready.ok}>Iniciar</button>
              <button type="button" className="btn" onClick={stop} disabled={!board.power}>Detener</button>
              <button type="button" className="btn" onClick={doReset} disabled={!board.power}>Reiniciar</button>
            </div>
          </div>
          <p className="about">
            {ready.ok ? PROGRAMS[program].about : <span className="bad">{ready.reason}</span>}
            {program === 'digital' && ready.ok ? ' El intervalo no se usa.' : ''}
          </p>
          <div className="readout">
            <span className="time">t = {(board.t / 1000).toFixed(1)} s</span>
            <span className={`ev ${last ? last.kind : ''}`} title="Último evento del monitor serie">
              {last ? (last.kind === 'sim' ? `[sim] ${last.text}` : last.kind === 'rx' ? `→ ${last.text}` : last.text) : 'Sin eventos'}
            </span>
          </div>
        </section>

        <section className="panel scene-panel" aria-label="Placa y banco de componentes">
          <div className={`strip${armed ? ' arming' : ''}`}>
            {armed ? (
              <>
                <p><b>Conectando {termLabel(armed)}</b><span>Tocá un pin de la placa para llevar el cable.</span></p>
                <div className="row">
                  {wiring[armed] && <button type="button" className="btn mini" onClick={() => { connect(armed, null); setArmed(null); }}>Quitar cable</button>}
                  <button type="button" className="btn mini" onClick={() => setArmed(null)}>Cancelar</button>
                </div>
              </>
            ) : (
              <>
                <p><b>{selTitle}</b><span>{selSub}</span></p>
                <button type="button" className="btn mini" onClick={() => showTab('inspector')}>Ver ficha</button>
              </>
            )}
          </div>
          <Scene
            wiring={wiring}
            analysis={analysis}
            board={board}
            lit={lit}
            inputs={inputs}
            ledOhms={ledOhms}
            sel={sel}
            armed={armed}
            pressedSw={pressedSw}
            onPin={onPin}
            onTerm={onTerm}
            onPart={onPart}
            onComp={onComp}
            onPress={(v) => onInput({ pressed: v })}
          />
        </section>

        <section className="panel inputs-panel" aria-label="Entradas y estado de los GPIO">
          <Bench inputs={inputs} board={board} circuit={circuit} program={program} onInput={onInput} onSend={send} />
        </section>

        <section className="panel tabs-panel" ref={tabsEl}>
          <div className="tabs" role="tablist" aria-label="Instrumentos">
            {TABS.map(([id, label]) => (
              <button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`pane-${id}`} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
                {label}
                {id === 'conexiones' && analysis.errors > 0 && <span className="badge err">{analysis.errors}</span>}
                {id === 'conexiones' && !analysis.errors && analysis.warnings > 0 && <span className="badge warn">{analysis.warnings}</span>}
              </button>
            ))}
          </div>
          <div className="pane" role="tabpanel" id={`pane-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === 'inspector' && <Inspector sel={sel} board={board} wiring={wiring} analysis={analysis} onReset={() => { flash('en'); doReset(); }} onDownload={() => { flash('boot'); download(); }} />}
            {tab === 'conexiones' && (
              <Connections
                wiring={wiring}
                analysis={analysis}
                ledOhms={ledOhms}
                armed={armed}
                onConnect={connect}
                onArm={(key) => { setArmed((a) => (a === key ? null : key)); setSel({ type: 'part', id: key.split('.')[0] }); }}
                onOhms={(v) => { setLedOhms(v); note(v ? `Resistencia del LED: ${v} Ω.` : 'Resistencia del LED retirada.'); }}
                onClear={clearPart}
                onRestore={restore}
              />
            )}
            {tab === 'monitor' && <Monitor log={log} board={board} onSend={send} onClear={() => setLog([])} />}
            {tab === 'codigo' && <Code sketch={sketch} program={program} />}
            {tab === 'limites' && <Limits />}
          </div>
        </section>
      </main>
    </div>
  );
}
