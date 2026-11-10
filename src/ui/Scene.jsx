// Escena SVG: placa ESP32-DevKitC V4, banco de componentes y cables.
// Dibujo esquemático. Solo el orden y el lado de los pines siguen la guía al pie de la letra.

import { J2, J3, PIN_BY_ID, GPIO } from '../data/pins.js';
import { PARTS, PART_IDS } from '../lab/parts.js';

const { useState, useRef, useMemo } = React;

export const GEO = { W: 460, H: 814, BX: 90, BY: 16, BW: 280, BH: 545, PITCH: 25.4, TERM_Y: 672, BUS_BOTTOM: 648 };
const { W, H, BX, BY, BW, BH, PITCH, TERM_Y, BUS_BOTTOM } = GEO;

export const pinPos = (pin) => ({
  x: pin.header === 'J2' ? BX + 11 : BX + BW - 11,
  y: BY + 44 + (pin.no - 1) * PITCH,
  side: pin.header === 'J2' ? 'L' : 'R',
});

const SLOT_X = { led: 65, btn: 175, pot: 285, tmp: 395 };
export const termPos = (key) => {
  const [p, t] = key.split('.');
  const terms = PARTS[p].terms;
  const i = terms.findIndex((x) => x.id === t);
  const dx = terms.length === 2 ? (i === 0 ? -15 : 15) : (i - 1) * 26;
  return { x: SLOT_X[p] + dx, y: TERM_Y, dx };
};

const SIGNAL_COLOR = { led: '#f4c95d', btn: '#6cb2ff', pot: '#46d6c8', tmp: '#c9a4ff' };
export const wireColor = (key, pinId) => {
  const k = PIN_BY_ID[pinId].kind;
  if (k === 'p3v3') return '#f2716b';
  if (k === 'p5v') return '#f59a4a';
  if (k === 'gnd') return '#a3b1bb';
  return SIGNAL_COLOR[key.split('.')[0]];
};

function roundPath(pts, r = 5) {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const d1 = Math.hypot(x1 - x0, y1 - y0), d2 = Math.hypot(x2 - x1, y2 - y1);
    const rr = Math.min(r, d1 / 2, d2 / 2);
    if (!(rr > 0.5)) {
      d += ` L${x1},${y1}`;
      continue;
    }
    const ax = x1 - ((x1 - x0) / d1) * rr, ay = y1 - ((y1 - y0) / d1) * rr;
    const bx = x1 + ((x2 - x1) / d2) * rr, by = y1 + ((y2 - y1) / d2) * rr;
    d += ` L${ax.toFixed(1)},${ay.toFixed(1)} Q${x1},${y1} ${bx.toFixed(1)},${by.toFixed(1)}`;
  }
  const l = pts[pts.length - 1];
  return `${d} L${l[0]},${l[1]}`;
}

/** Ruteo ortogonal: del pin a un carril lateral, baja al bus y entra al terminal desde arriba. */
export function routeWires(wiring) {
  const wires = Object.entries(wiring)
    .filter(([, pinId]) => pinId)
    .map(([key, pinId]) => ({ key, pinId, p: pinPos(PIN_BY_ID[pinId]), t: termPos(key) }));
  const bySide = { L: [], R: [] };
  wires.forEach((w) => bySide[w.p.side].push(w));
  for (const s of ['L', 'R']) {
    bySide[s].sort((a, b) => a.p.y - b.p.y || a.t.x - b.t.x);
    bySide[s].forEach((w, r) => (w.rank = r));
  }
  // Niveles del bus: el pin más alto usa el carril exterior y el nivel más bajo.
  const order = [...wires].sort((a, b) => a.rank - b.rank || (a.p.side < b.p.side ? -1 : 1));
  const busStep = Math.min(7, 62 / Math.max(1, order.length - 1));
  order.forEach((w, slot) => (w.by = BUS_BOTTOM - slot * busStep));
  return wires.map((w) => {
    const n = bySide[w.p.side].length;
    const laneStep = Math.min(8, 68 / Math.max(1, n - 1));
    const lane = (n - 1 - w.rank) * laneStep;
    const lx = w.p.side === 'L' ? BX - 12 - lane : BX + BW + 12 + lane;
    const d = roundPath([[w.p.x, w.p.y], [lx, w.p.y], [lx, w.by], [w.t.x, w.by], [w.t.x, TERM_Y - 7]]);
    return { key: w.key, pinId: w.pinId, d, color: wireColor(w.key, w.pinId), part: w.key.split('.')[0] };
  });
}

const act = (fn) => ({
  role: 'button',
  tabIndex: 0,
  onClick: (e) => {
    e.stopPropagation();
    fn();
  },
  onKeyDown: (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  },
});

function Pin({ pin, selected, state, wired, armed, onPin }) {
  const { x, y, side } = pinPos(pin);
  const g = pin.gpio != null ? GPIO[pin.gpio] : null;
  const cls = ['pin', `k-${pin.kind}`, g && g.inputOnly ? 'k-in' : '', selected ? 'sel' : '', armed ? 'target' : ''];
  if (state) cls.push(state.mode === 'ANALOG' ? 'an' : state.level ? 'hi' : 'lo');
  return (
    <g className={cls.join(' ')} aria-label={`${pin.header} pin ${pin.no}: ${pin.name}`} {...act(() => onPin(pin))}>
      <rect className="hit" x={side === 'L' ? x - 21 : x - 37} y={y - PITCH / 2} width={58} height={PITCH} rx={4} />
      <rect className="pad" x={x - 6.5} y={y - 6.5} width={13} height={13} rx={pin.no === 1 ? 2 : 6.5} />
      <circle className="hole" cx={x} cy={y} r={3.1} />
      {wired && <circle cx={x} cy={y} r={3.1} fill={wired} />}
      <text className="lbl" x={side === 'L' ? x + 12 : x - 12} y={y + 3.6} textAnchor={side === 'L' ? 'start' : 'end'}>
        {pin.name}
      </text>
    </g>
  );
}

function Board({ sel, power, pressed, onComp }) {
  const comp = (id, label) => ({ className: `comp${sel === id ? ' sel' : ''}`, 'aria-label': label, ...act(() => onComp(id)) });
  const mx = BX + 50, my = BY + 4;
  const meander = [];
  for (let i = 0; i < 7; i++) {
    const x = mx + 22 + i * 21;
    meander.push(`${i ? 'L' : 'M'}${x},${my + 46} V${my + 14} H${x + 10.5} V${my + 46}`);
  }
  return (
    <g>
      <rect className="pcb" x={BX} y={BY} width={BW} height={BH} rx={9} />
      <text className="silk dim" x={BX + 14} y={BY + 24} textAnchor="middle">J2</text>
      <text className="silk dim" x={BX + BW - 14} y={BY + 24} textAnchor="middle">J3</text>

      {/* Módulo ESP32-WROOM-32E: antena PCB arriba, blindaje abajo */}
      <rect className="mod-base" x={mx} y={my} width={180} height={255} rx={3} />
      <g {...comp('antenna', 'Antena PCB del módulo')}>
        <rect className="outline" x={mx + 3} y={my + 3} width={174} height={56} rx={3} />
        <path className="ant" d={`${meander.join(' ')} H${mx + 168}`} />
      </g>
      <g {...comp('module', 'Módulo ESP32-WROOM-32E')}>
        <rect className="shield" x={mx + 7} y={my + 64} width={166} height={184} rx={5} />
        <rect className="outline" x={mx + 7} y={my + 64} width={166} height={184} rx={5} />
        <text className="shield-txt big" x={mx + 90} y={my + 150} textAnchor="middle">ESP32-WROOM-32E</text>
        <text className="shield-txt" x={mx + 90} y={my + 168} textAnchor="middle">módulo · flash 4 MB</text>
      </g>

      {/* Componentes menores sin identificar: solo ambientación */}
      <rect className="smd" x={BX + 100} y={BY + 352} width={34} height={26} rx={2} />
      <rect className="smd-pad" x={BX + 103} y={BY + 380} width={6} height={7} />
      <rect className="smd-pad" x={BX + 114} y={BY + 380} width={6} height={7} />
      <rect className="smd-pad" x={BX + 125} y={BY + 380} width={6} height={7} />
      {[[62, 330], [62, 352], [150, 288], [222, 362], [150, 420], [118, 420]].map(([dx, dy], i) => (
        <rect key={i} className="smd-pass" x={BX + dx} y={BY + dy} width={11} height={6} rx={1} />
      ))}

      <g {...comp('pwr', 'LED de encendido 5V')}>
        <rect className="outline" x={BX + 56} y={BY + 286} width={36} height={30} rx={4} />
        {power && <circle className="pwr-halo" cx={BX + 68} cy={BY + 297} r={11} />}
        <rect className={`pwr-led${power ? ' on' : ''}`} x={BX + 61} y={BY + 293} width={14} height={8} rx={1.5} />
        <text className="silk tiny" x={BX + 74} y={BY + 312} textAnchor="middle">5V ON</text>
      </g>

      <g {...comp('bridge', 'Puente USB-UART')}>
        <rect className="outline" x={BX + 160} y={BY + 290} width={66} height={66} rx={4} />
        <rect className="chip" x={BX + 172} y={BY + 296} width={42} height={42} rx={2} />
        <circle className="chip-dot" cx={BX + 178} cy={BY + 302} r={2} />
        <text className="silk tiny" x={BX + 193} y={BY + 351} textAnchor="middle">USB-UART</text>
      </g>

      {[['en', 'EN', BX + 52], ['boot', 'BOOT', BX + 184]].map(([id, label, x]) => (
        <g key={id} {...comp(id, `Botón ${label}`)}>
          <rect className="outline" x={x - 4} y={BY + 432} width={52} height={66} rx={5} />
          <text className="silk" x={x + 22} y={BY + 445} textAnchor="middle">{label}</text>
          <rect className="sw" x={x} y={BY + 450} width={44} height={44} rx={4} />
          <circle className={`sw-cap${pressed === id ? ' down' : ''}`} cx={x + 22} cy={BY + 472} r={pressed === id ? 10 : 12} />
        </g>
      ))}

      <g {...comp('usb', 'Puerto micro-USB')}>
        <rect className="usb" x={BX + 104} y={BY + 484} width={72} height={68} rx={4} />
        <rect className="outline" x={BX + 104} y={BY + 484} width={72} height={68} rx={4} />
        <rect className="usb-slot" x={BX + 116} y={BY + 536} width={48} height={9} rx={3} />
        <text className="usb-txt" x={BX + 140} y={BY + 516} textAnchor="middle">USB</text>
      </g>
    </g>
  );
}

function Lead({ d }) {
  return <path className="lead" d={d} />;
}

function PartBody({ id, lit, ohms, inputs, onPress }) {
  if (id === 'led') {
    return (
      <g>
        <Lead d="M-15,7 V22" />
        {ohms > 0 ? (
          <g>
            <rect className="res" x={-21} y={22} width={12} height={28} rx={3.5} />
            <rect className="res-b1" x={-21} y={27} width={12} height={3} />
            <rect className="res-b2" x={-21} y={33} width={12} height={3} />
            <rect className="res-b3" x={-21} y={39} width={12} height={3} />
          </g>
        ) : (
          <g>
            <Lead d="M-15,22 V50" />
            <rect className="res-missing" x={-23} y={22} width={16} height={28} rx={3.5} />
          </g>
        )}
        <Lead d="M-15,50 V58 H-7 V66" />
        <Lead d="M15,7 V58 H7 V66" />
        {lit && <circle className="led-halo" cx={0} cy={84} r={32} />}
        <rect className="led-base" x={-18} y={66} width={36} height={5} rx={1.5} />
        <path className={`led-dome${lit ? ' on' : ''}`} d="M-15,71 V86 a15,15 0 0 0 30,0 V71 Z" />
        <text className="part-name" y={117}>LED</text>
        <text className={`part-sub${ohms ? '' : ' bad'}`} y={129}>{ohms ? `R ${ohms} Ω · ${lit ? 'encendido' : 'apagado'}` : 'sin resistencia'}</text>
      </g>
    );
  }
  if (id === 'btn') {
    const hold = {
      onPointerDown: (e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        onPress(true);
      },
      onPointerUp: () => onPress(false),
      onPointerCancel: () => onPress(false),
      onLostPointerCapture: () => onPress(false),
      onClick: (e) => e.stopPropagation(),
    };
    return (
      <g>
        <Lead d="M-15,7 V32" />
        <Lead d="M15,7 V32" />
        <rect className="btn-body" x={-24} y={32} width={48} height={46} rx={5} />
        <circle className={`btn-cap${inputs.pressed ? ' down' : ''}`} cx={0} cy={55} r={inputs.pressed ? 12 : 14.5} aria-label="Pulsar" {...hold} />
        <text className="part-name" y={98}>Pulsador</text>
        <text className="part-sub" y={110}>{inputs.pressed ? 'pulsado' : 'suelto'}</text>
      </g>
    );
  }
  if (id === 'pot') {
    const a = ((-135 + inputs.pot * 270) * Math.PI) / 180;
    return (
      <g>
        <Lead d="M-26,7 V40" />
        <Lead d="M0,7 V36" />
        <Lead d="M26,7 V40" />
        <circle className="pot-body" cx={0} cy={62} r={29} />
        <circle className="pot-knob" cx={0} cy={62} r={18} />
        <line className="pot-mark" x1={0} y1={62} x2={(Math.sin(a) * 16).toFixed(1)} y2={(62 - Math.cos(a) * 16).toFixed(1)} />
        <text className="part-name" y={108}>Potenciómetro</text>
        <text className="part-sub" y={120}>{Math.round(inputs.pot * 100)} % del recorrido</text>
      </g>
    );
  }
  return (
    <g>
      <Lead d="M-26,7 V36" />
      <Lead d="M0,7 V36" />
      <Lead d="M26,7 V36" />
      <path className="tmp-body" d="M-34,36 H34 V62 a34,24 0 0 1 -68,0 Z" />
      <text className="tmp-read" y={64}>{inputs.tempC.toFixed(1)} °C</text>
      <text className="part-name" y={108}>Sensor temp.</text>
      <text className="part-sub" y={120}>modelo simulado</text>
    </g>
  );
}

export function Scene({ wiring, analysis, board, lit, inputs, ledOhms, sel, armed, pressedSw, onPin, onTerm, onPart, onComp, onPress }) {
  const [view, setView] = useState({ z: 1, cx: W / 2, cy: H / 2 });
  const svg = useRef(null);
  const drag = useRef(null);
  const wires = useMemo(() => routeWires(wiring), [wiring]);
  const wiredColor = useMemo(() => Object.fromEntries(wires.map((w) => [w.pinId, w.color])), [wires]);

  const vw = W / view.z, vh = H / view.z;
  const vx = Math.min(W - vw, Math.max(0, view.cx - vw / 2));
  const vy = Math.min(H - vh, Math.max(0, view.cy - vh / 2));

  const focus = () => {
    if (sel.type === 'pin') return pinPos(PIN_BY_ID[sel.id]);
    if (sel.type === 'part') return { x: SLOT_X[sel.id], y: TERM_Y + 50 };
    return { x: vx + vw / 2, y: vy + vh / 2 };
  };
  const zoomTo = (z) => {
    const f = focus();
    setView(z <= 1 ? { z: 1, cx: W / 2, cy: H / 2 } : { z, cx: f.x, cy: f.y });
  };

  const onPointerDown = (e) => {
    if (view.z > 1) drag.current = { x: e.clientX, y: e.clientY, cx: vx + vw / 2, cy: vy + vh / 2, moved: false };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    if (!d.moved) {
      d.moved = true;
      svg.current.setPointerCapture(e.pointerId);
    }
    const k = vw / svg.current.clientWidth;
    setView((v) => ({ ...v, cx: d.cx - dx * k, cy: d.cy - dy * k }));
  };
  const endDrag = () => {
    const d = drag.current;
    drag.current = d && d.moved ? { done: true } : null;
  };
  const onClickCapture = (e) => {
    if (drag.current && drag.current.done) {
      e.stopPropagation();
      drag.current = null;
    }
  };

  const armedPart = armed ? armed.split('.')[0] : null;
  const focusPart = armedPart || (sel.type === 'part' ? sel.id : null);

  return (
    <div className="scene-wrap">
      <div className="zoom" role="group" aria-label="Zoom de la escena">
        <button type="button" onClick={() => zoomTo(Math.max(1, view.z / 1.5))} disabled={view.z <= 1} aria-label="Alejar">−</button>
        <span className="zoom-val">{Math.round(view.z * 100)} %</span>
        <button type="button" onClick={() => zoomTo(Math.min(3.375, view.z * 1.5))} disabled={view.z >= 3.3} aria-label="Acercar">+</button>
        <button type="button" className="wide" onClick={() => zoomTo(1)} disabled={view.z <= 1}>Ver todo</button>
      </div>
      <svg
        ref={svg}
        className={`scene${armed ? ' arming' : ''}${view.z > 1 ? ' zoomed' : ''}`}
        viewBox={`${vx.toFixed(1)} ${vy.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}`}
        role="group"
        aria-label="Placa ESP32-DevKitC V4 y banco de componentes"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
      >
        <defs>
          <linearGradient id="g-shield" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#c3cad0" />
            <stop offset="1" stopColor="#8d979f" />
          </linearGradient>
          <filter id="f-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
        </defs>

        <Board sel={sel.type === 'comp' ? sel.id : null} power={board.power} pressed={pressedSw} onComp={onComp} />

        <g className="wires">
          {wires.map((w) => (
            <g key={w.key} className={focusPart && focusPart !== w.part ? 'wire dim' : 'wire'}>
              <path className="wire-halo" d={w.d} />
              <path className="wire-line" d={w.d} stroke={w.color} />
            </g>
          ))}
        </g>

        <g>
          {[...J2, ...J3].map((pin) => (
            <Pin
              key={pin.id}
              pin={pin}
              selected={sel.type === 'pin' && sel.id === pin.id}
              state={pin.kind === 'gpio' ? board.pins[pin.gpio] : null}
              wired={wiredColor[pin.id]}
              armed={!!armed}
              onPin={onPin}
            />
          ))}
        </g>

        {PART_IDS.map((id) => {
          const st = analysis.parts[id].status;
          return (
            <g key={id} transform={`translate(${SLOT_X[id]},${TERM_Y})`} className={`part st-${st}${sel.type === 'part' && sel.id === id ? ' sel' : ''}`}>
              <g aria-label={PARTS[id].name} {...act(() => onPart(id))}>
                <rect className="part-hit" x={-52} y={24} width={104} height={102} rx={8} />
                <PartBody id={id} lit={lit} ohms={ledOhms} inputs={inputs} onPress={onPress} />
              </g>
              {st !== 'ok' && st !== 'unused' && <circle className={`part-flag ${st}`} cx={44} cy={34} r={5} />}
              {PARTS[id].terms.map((t) => {
                const key = `${id}.${t.id}`;
                const { dx } = termPos(key);
                const c = wiring[key] ? wireColor(key, wiring[key]) : null;
                return (
                  <g key={key} className={`term${armed === key ? ' armed' : ''}${c ? '' : ' open'}`} aria-label={`${PARTS[id].name}, terminal ${t.label}: ${t.long}`} {...act(() => onTerm(key))}>
                    <rect className="hit" x={dx - 13} y={-17} width={26} height={40} rx={5} />
                    <circle className="term-pad" cx={dx} cy={0} r={7} style={c ? { stroke: c } : null} />
                    <text className="term-lbl" x={dx + 4} y={21}>{t.label}</text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      <div className="legend" aria-label="Referencias de color de los pines">
        <span><i className="sw-pwr" />Alimentación</span>
        <span><i className="sw-gnd" />GND</span>
        <span><i className="sw-io" />GPIO</span>
        <span><i className="sw-in" />Solo entrada</span>
        <span><i className="sw-flash" />Flash, no usar</span>
      </div>
    </div>
  );
}
