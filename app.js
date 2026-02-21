const MAX_QUBITS = 20;
const paletteGates = ["H", "X", "Y", "Z", "S", "T", "M"];

const state = {
  qubitCount: 4,
  timelineLength: 16,
  grid: [],
  draggedGate: null,
  runCache: null,
  fluidStageStop: null,
};

const gatePalette = document.getElementById("gatePalette");
const circuitGrid = document.getElementById("circuitGrid");
const runButton = document.getElementById("runButton");
const clearButton = document.getElementById("clearButton");
const qubitCountInput = document.getElementById("qubitCount");
const timelineLengthInput = document.getElementById("timelineLength");
const resizeButton = document.getElementById("resizeButton");
const resultSummary = document.getElementById("resultSummary");
const visualizationContainer = document.getElementById("visualizationContainer");
const fluidStageCanvas = document.getElementById("fluidStageCanvas");
const qiskitEditor = document.getElementById("qiskitEditor");
const applyQiskitButton = document.getElementById("applyQiskitButton");
const syncQiskitButton = document.getElementById("syncQiskitButton");
const qiskitStatus = document.getElementById("qiskitStatus");

function emptyGrid() {
  return Array.from({ length: state.qubitCount }, () => Array(state.timelineLength).fill(null));
}

function init() {
  state.grid = emptyGrid();
  buildPalette();
  renderGrid();
  drawVisualizations([]);
  syncQiskitFromGrid();
}

function buildPalette() {
  gatePalette.innerHTML = "";
  for (const gate of paletteGates) {
    const button = document.createElement("button");
    button.className = "gate";
    button.draggable = true;
    button.dataset.gate = gate;
    button.textContent = gate === "M" ? "Measure" : gate;
    button.addEventListener("dragstart", () => {
      state.draggedGate = { type: "new", gate };
    });
    gatePalette.appendChild(button);
  }
}

function renderGrid() {
  const table = document.createElement("table");
  table.className = "grid-table";

  const head = document.createElement("tr");
  head.appendChild(document.createElement("th"));
  for (let t = 0; t < state.timelineLength; t++) {
    const th = document.createElement("th");
    th.textContent = t.toString();
    head.appendChild(th);
  }
  table.appendChild(head);

  for (let q = 0; q < state.qubitCount; q++) {
    const row = document.createElement("tr");
    const label = document.createElement("th");
    label.textContent = `q${q}`;
    row.appendChild(label);

    for (let t = 0; t < state.timelineLength; t++) {
      const cell = document.createElement("td");
      cell.className = "drop-cell";
      cell.dataset.qubit = q;
      cell.dataset.time = t;
      wireDropCell(cell, q, t);

      const gate = state.grid[q][t];
      if (gate) {
        const placed = renderPlacedGate(gate, q, t);
        cell.appendChild(placed);
      }
      row.appendChild(cell);
    }
    table.appendChild(row);
  }

  circuitGrid.innerHTML = "";
  circuitGrid.appendChild(table);
}

function renderPlacedGate(gate, q, t) {
  const placed = document.createElement("div");
  placed.className = "placed-gate";
  placed.draggable = true;
  placed.dataset.gate = gate.type;
  if (gate.type === "CNOT_TARGET") placed.classList.add("cnot-target");
  if (gate.type === "CNOT_CONTROL") placed.classList.add("cnot-control");
  placed.textContent = gate.type.startsWith("CNOT") ? "CNOT" : gate.type;

  placed.addEventListener("dragstart", () => {
    state.draggedGate = { type: "move", fromQ: q, fromT: t, gate: gate.type, meta: gate };
  });

  placed.addEventListener("dblclick", () => {
    removeGate(q, t);
    renderGrid();
  });

  return placed;
}

function wireDropCell(cell, q, t) {
  cell.addEventListener("dragover", (e) => {
    e.preventDefault();
    cell.classList.add("drag-over");
  });
  cell.addEventListener("dragleave", () => cell.classList.remove("drag-over"));
  cell.addEventListener("drop", (e) => {
    e.preventDefault();
    cell.classList.remove("drag-over");
    if (!state.draggedGate) return;

    if (state.draggedGate.type === "new") {
      placeGate(q, t, state.draggedGate.gate);
    } else {
      moveGate(q, t, state.draggedGate);
    }

    state.draggedGate = null;
    state.runCache = null;
    renderGrid();
  });
}

function placeGate(q, t, gateType) {
  if (gateType === "X") {
    const existingXQ = findSingleXInColumn(t, q);
    if (existingXQ !== -1) {
      state.grid[existingXQ][t] = { type: "CNOT_CONTROL", target: q };
      state.grid[q][t] = { type: "CNOT_TARGET", control: existingXQ };
      return;
    }
  }
  if (gateType === "M") {
    state.grid[q][t] = { type: "M" };
    return;
  }
  state.grid[q][t] = { type: gateType };
}

function moveGate(q, t, dragged) {
  const { fromQ, fromT, gate, meta } = dragged;
  if (fromQ === q && fromT === t) return;

  removeGate(fromQ, fromT);

  if (gate === "X") {
    const existingXQ = findSingleXInColumn(t, q);
    if (existingXQ !== -1) {
      state.grid[existingXQ][t] = { type: "CNOT_CONTROL", target: q };
      state.grid[q][t] = { type: "CNOT_TARGET", control: existingXQ };
      return;
    }
  }

  if (gate === "CNOT_CONTROL") {
    const target = meta.target;
    if (target < state.qubitCount) {
      state.grid[q][t] = { type: "CNOT_CONTROL", target };
      state.grid[target][t] = { type: "CNOT_TARGET", control: q };
      return;
    }
  }

  if (gate === "CNOT_TARGET") {
    const control = meta.control;
    if (control < state.qubitCount) {
      state.grid[control][t] = { type: "CNOT_CONTROL", target: q };
      state.grid[q][t] = { type: "CNOT_TARGET", control };
      return;
    }
  }

  state.grid[q][t] = { type: gate };
}

function removeGate(q, t) {
  const gate = state.grid[q][t];
  if (!gate) return;
  if (gate.type === "CNOT_CONTROL" && Number.isInteger(gate.target)) {
    state.grid[gate.target][t] = null;
  }
  if (gate.type === "CNOT_TARGET" && Number.isInteger(gate.control)) {
    state.grid[gate.control][t] = null;
  }
  state.grid[q][t] = null;
}

function findSingleXInColumn(time, ignoreQubit) {
  for (let q = 0; q < state.qubitCount; q++) {
    if (q === ignoreQubit) continue;
    const gate = state.grid[q][time];
    if (gate?.type === "X") return q;
  }
  return -1;
}

function setGridSize() {
  state.qubitCount = Math.min(MAX_QUBITS, Math.max(1, Number(qubitCountInput.value || 1)));
  state.timelineLength = Math.min(64, Math.max(4, Number(timelineLengthInput.value || 16)));
  qubitCountInput.value = state.qubitCount;
  timelineLengthInput.value = state.timelineLength;
  state.grid = emptyGrid();
  state.runCache = null;
  renderGrid();
  resultSummary.textContent = "Grid resized. Rebuild and run your circuit.";
  visualizationContainer.innerHTML = "";
  stopFluidStageAnimation();
  syncQiskitFromGrid();
}

function simulateCircuit() {
  const n = state.qubitCount;
  const size = 1 << n;
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  re[0] = 1;

  const measurements = [];

  for (let t = 0; t < state.timelineLength; t++) {
    const singleQubitOps = [];
    const cnotPairs = [];

    for (let q = 0; q < n; q++) {
      const gate = state.grid[q][t];
      if (!gate) continue;
      if (["H", "X", "Y", "Z", "S", "T"].includes(gate.type)) singleQubitOps.push([q, gate.type]);
      if (gate.type === "CNOT_CONTROL" && Number.isInteger(gate.target)) cnotPairs.push([q, gate.target]);
      if (gate.type === "M") measurements.push({ q, t });
    }

    for (const [q, g] of singleQubitOps) {
      applySingleQubitGate(re, im, n, q, g);
    }
    for (const [control, target] of cnotPairs) {
      applyCNOT(re, im, n, control, target);
    }
  }

  const qubitBlochVectors = [];
  for (let q = 0; q < n; q++) {
    qubitBlochVectors.push(getBlochFromState(re, im, n, q));
  }

  const measured = measurements.map(({ q, t }) => {
    const p1 = probabilityOne(re, im, n, q);
    const outcome = Math.random() < p1 ? 1 : 0;
    collapseQubit(re, im, n, q, outcome);
    return { q, t, p1, outcome };
  });

  return {
    qubitBlochVectors,
    measured,
    amplitudes: Array.from({ length: Math.min(16, size) }, (_, i) => {
      const magnitude = Math.hypot(re[i], im[i]);
      return `${i.toString(2).padStart(n, "0")}: ${(magnitude * magnitude).toFixed(4)}`;
    }),
  };
}

function applySingleQubitGate(re, im, n, q, gate) {
  const stride = 1 << q;
  const step = stride << 1;

  const sqrtHalf = Math.SQRT1_2;

  for (let base = 0; base < 1 << n; base += step) {
    for (let offset = 0; offset < stride; offset++) {
      const i0 = base + offset;
      const i1 = i0 + stride;
      const aRe = re[i0], aIm = im[i0], bRe = re[i1], bIm = im[i1];

      if (gate === "H") {
        re[i0] = (aRe + bRe) * sqrtHalf;
        im[i0] = (aIm + bIm) * sqrtHalf;
        re[i1] = (aRe - bRe) * sqrtHalf;
        im[i1] = (aIm - bIm) * sqrtHalf;
      } else if (gate === "X") {
        re[i0] = bRe; im[i0] = bIm;
        re[i1] = aRe; im[i1] = aIm;
      } else if (gate === "Y") {
        re[i0] = bIm; im[i0] = -bRe;
        re[i1] = -aIm; im[i1] = aRe;
      } else if (gate === "Z") {
        re[i1] = -bRe;
        im[i1] = -bIm;
      } else if (gate === "S") {
        re[i1] = -bIm;
        im[i1] = bRe;
      } else if (gate === "T") {
        const c = Math.cos(Math.PI / 4);
        const s = Math.sin(Math.PI / 4);
        re[i1] = bRe * c - bIm * s;
        im[i1] = bRe * s + bIm * c;
      }
    }
  }
}

function applyCNOT(re, im, n, control, target) {
  const controlMask = 1 << control;
  const targetMask = 1 << target;
  const size = 1 << n;

  for (let i = 0; i < size; i++) {
    if ((i & controlMask) && !(i & targetMask)) {
      const j = i | targetMask;
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
}

function probabilityOne(re, im, n, q) {
  const mask = 1 << q;
  let total = 0;
  const size = 1 << n;
  for (let i = 0; i < size; i++) {
    if (i & mask) total += re[i] * re[i] + im[i] * im[i];
  }
  return total;
}

function collapseQubit(re, im, n, q, outcome) {
  const mask = 1 << q;
  let normSq = 0;
  const size = 1 << n;
  for (let i = 0; i < size; i++) {
    const bit = (i & mask) ? 1 : 0;
    if (bit !== outcome) {
      re[i] = 0; im[i] = 0;
    } else {
      normSq += re[i] * re[i] + im[i] * im[i];
    }
  }
  const invNorm = normSq > 0 ? 1 / Math.sqrt(normSq) : 0;
  if (!invNorm) return;
  for (let i = 0; i < size; i++) {
    re[i] *= invNorm;
    im[i] *= invNorm;
  }
}

function getBlochFromState(re, im, n, q) {
  const stride = 1 << q;
  const step = stride << 1;
  let rho00 = 0;
  let rho11 = 0;
  let rho01Re = 0;
  let rho01Im = 0;

  for (let base = 0; base < 1 << n; base += step) {
    for (let offset = 0; offset < stride; offset++) {
      const i0 = base + offset;
      const i1 = i0 + stride;
      const aRe = re[i0], aIm = im[i0];
      const bRe = re[i1], bIm = im[i1];

      rho00 += aRe * aRe + aIm * aIm;
      rho11 += bRe * bRe + bIm * bIm;
      rho01Re += aRe * bRe + aIm * bIm;
      rho01Im += aIm * bRe - aRe * bIm;
    }
  }

  return {
    x: 2 * rho01Re,
    y: 2 * rho01Im,
    z: rho00 - rho11,
    p1: rho11,
  };
}

function stopFluidStageAnimation() {
  if (typeof state.fluidStageStop === "function") {
    state.fluidStageStop();
    state.fluidStageStop = null;
  }
}

function drawVisualizations(vectors) {
  visualizationContainer.innerHTML = "";
  vectors.forEach((v, index) => {
    const card = document.createElement("article");
    card.className = "viz-card";
    const label = document.createElement("div");
    label.textContent = `q${index} | p(1)=${v.p1.toFixed(3)}`;
    const canvas = document.createElement("canvas");
    canvas.width = 220;
    canvas.height = 220;
    card.append(label, canvas);
    visualizationContainer.appendChild(card);
    drawBloch(canvas, v);
  });
}

function drawBloch(canvas, v) {
  const ctx = canvas.getContext("2d");
  const c = canvas.width / 2;
  const r = canvas.width * 0.4;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#5d79c9";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#2f467d";
  ctx.beginPath();
  ctx.ellipse(c, c, r, r * 0.28, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(c - r, c);
  ctx.lineTo(c + r, c);
  ctx.moveTo(c, c - r);
  ctx.lineTo(c, c + r);
  ctx.stroke();

  const px = c + v.x * r;
  const py = c - v.z * r - v.y * (r * 0.24);
  ctx.strokeStyle = "#7bf8d6";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(c, c);
  ctx.lineTo(px, py);
  ctx.stroke();

  ctx.fillStyle = "#7bf8d6";
  ctx.beginPath();
  ctx.arc(px, py, 4, 0, Math.PI * 2);
  ctx.fill();
}


function gateToQiskitMethod(gate) {
  const map = { H: "h", X: "x", Y: "y", Z: "z", S: "s", T: "t" };
  return map[gate] || null;
}

function syncQiskitFromGrid() {
  if (!qiskitEditor) return;
  const lines = [
    "from qiskit import QuantumCircuit",
    `qc = QuantumCircuit(${state.qubitCount}, ${state.qubitCount})`,
    "",
  ];

  for (let t = 0; t < state.timelineLength; t++) {
    for (let q = 0; q < state.qubitCount; q++) {
      const gate = state.grid[q][t];
      if (!gate) continue;
      if (["H", "X", "Y", "Z", "S", "T"].includes(gate.type)) {
        const method = gateToQiskitMethod(gate.type);
        lines.push(`qc.${method}(${q})`);
      } else if (gate.type === "CNOT_CONTROL" && Number.isInteger(gate.target)) {
        lines.push(`qc.cx(${q}, ${gate.target})`);
      } else if (gate.type === "M") {
        lines.push(`qc.measure(${q}, ${q})`);
      }
    }
  }

  lines.push("", "print(qc)");
  qiskitEditor.value = lines.join("\n");
}

function applyQiskitToGrid() {
  if (!qiskitEditor) return;
  const source = qiskitEditor.value;
  const lines = source.split(/\r?\n/);

  const ops = [];
  let maxQubit = state.qubitCount - 1;
  let error = null;

  const parseSingle = (line, method) => {
    const match = line.match(new RegExp(`\.\s*${method}\s*\(\s*(\d+)\s*\)`));
    if (!match) return false;
    const q = Number(match[1]);
    ops.push({ type: method.toUpperCase(), q });
    maxQubit = Math.max(maxQubit, q);
    return true;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("from ") || line.startsWith("import ") || line.startsWith("qc =") || line.startsWith("print(")) continue;

    if (["h", "x", "y", "z", "s", "t"].some((m) => parseSingle(line, m))) continue;

    let match = line.match(/\.\s*cx\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (match) {
      const control = Number(match[1]);
      const target = Number(match[2]);
      maxQubit = Math.max(maxQubit, control, target);
      ops.push({ type: "CX", control, target });
      continue;
    }

    match = line.match(/\.\s*measure\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (match) {
      const q = Number(match[1]);
      maxQubit = Math.max(maxQubit, q);
      ops.push({ type: "M", q });
      continue;
    }

    error = `Unsupported line: ${line}`;
    break;
  }

  if (error) {
    qiskitStatus.textContent = error;
    return;
  }

  const nextQubitCount = Math.min(MAX_QUBITS, Math.max(1, maxQubit + 1));
  state.qubitCount = nextQubitCount;
  qubitCountInput.value = state.qubitCount;

  const nextTimeline = Math.min(64, Math.max(4, ops.length + 2));
  state.timelineLength = nextTimeline;
  timelineLengthInput.value = state.timelineLength;
  state.grid = emptyGrid();

  let t = 0;
  for (const op of ops) {
    if (t >= state.timelineLength) break;
    if (op.type === "CX") {
      if (op.control < state.qubitCount && op.target < state.qubitCount && op.control !== op.target) {
        state.grid[op.control][t] = { type: "CNOT_CONTROL", target: op.target };
        state.grid[op.target][t] = { type: "CNOT_TARGET", control: op.control };
      }
    } else if (op.type === "M") {
      if (op.q < state.qubitCount) state.grid[op.q][t] = { type: "M" };
    } else {
      const gate = op.type;
      if (op.q < state.qubitCount) state.grid[op.q][t] = { type: gate };
    }
    t += 1;
  }

  state.runCache = null;
  renderGrid();
  stopFluidStageAnimation();
  visualizationContainer.innerHTML = "";
  resultSummary.textContent = "Qiskit code applied. Click Run Circuit to simulate.";
  qiskitStatus.textContent = `Applied ${ops.length} operations from Qiskit composer.`;
}

function createAnimationLoop(drawFrame) {
  let active = true;
  let raf = 0;
  const tick = (time) => {
    if (!active) return;
    drawFrame(time);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => {
    active = false;
    cancelAnimationFrame(raf);
  };
}

function drawFluidStage(vectors, measured) {
  stopFluidStageAnimation();
  if (!fluidStageCanvas) return;
  const ctx = fluidStageCanvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const resize = () => {
    const w = Math.max(900, Math.floor(fluidStageCanvas.clientWidth));
    const h = Math.max(380, Math.floor(fluidStageCanvas.clientHeight));
    fluidStageCanvas.width = Math.floor(w * dpr);
    fluidStageCanvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();

  const qubits = vectors.map((v, q) => ({ q, ...v }));
  if (!qubits.length) {
    ctx.fillStyle = "#081124";
    ctx.fillRect(0, 0, fluidStageCanvas.clientWidth, fluidStageCanvas.clientHeight);
    return;
  }

  const measuredCountByQubit = new Map();
  measured.forEach((m) => measuredCountByQubit.set(m.q, (measuredCountByQubit.get(m.q) || 0) + 1));

  const vortices = qubits.map((qubit, i) => {
    const angle = (i / qubits.length) * Math.PI * 2;
    const radius = Math.min(fluidStageCanvas.clientWidth, fluidStageCanvas.clientHeight) * (0.2 + 0.22 * (i % 3) / 2);
    const measuredWeight = 1 + (measuredCountByQubit.get(qubit.q) || 0) * 0.25;
    return {
      x: fluidStageCanvas.clientWidth * 0.5 + Math.cos(angle) * radius,
      y: fluidStageCanvas.clientHeight * 0.5 + Math.sin(angle) * radius * 0.58,
      swirl: (qubit.x >= 0 ? 1 : -1) * (0.32 + Math.abs(qubit.y) * 0.9) * measuredWeight,
      pull: 0.08 + (1 - Math.abs(qubit.z)) * 0.2,
      hue: (210 + qubit.p1 * 130 + i * 18) % 360,
      pulse: measuredWeight,
    };
  });

  const particles = Array.from({ length: Math.max(3200, qubits.length * 420) }, (_, i) => ({
    x: Math.random() * fluidStageCanvas.clientWidth,
    y: Math.random() * fluidStageCanvas.clientHeight,
    vx: 0,
    vy: 0,
    life: Math.random(),
    seed: i * 0.011,
  }));

  const onResize = () => resize();
  window.addEventListener("resize", onResize);

  state.fluidStageStop = createAnimationLoop((time) => {
    const w = fluidStageCanvas.clientWidth;
    const h = fluidStageCanvas.clientHeight;

    ctx.fillStyle = "rgba(4, 9, 18, 0.12)";
    ctx.fillRect(0, 0, w, h);

    const centerWave = Math.sin(time * 0.0012) * 0.5 + 0.5;
    const bg = ctx.createRadialGradient(w * 0.5, h * 0.5, 20, w * 0.5, h * 0.5, Math.max(w, h) * 0.6);
    bg.addColorStop(0, `rgba(40, 78, 165, ${0.06 + centerWave * 0.06})`);
    bg.addColorStop(1, "rgba(3, 8, 18, 0)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    particles.forEach((p) => {
      const noiseA = Math.sin((p.x * 0.004) + time * 0.0008 + p.seed);
      const noiseB = Math.cos((p.y * 0.0045) - time * 0.0007 - p.seed);
      let fx = noiseA * 0.035;
      let fy = noiseB * 0.035;
      let hue = 212;

      vortices.forEach((v) => {
        const dx = p.x - v.x;
        const dy = p.y - v.y;
        const dist2 = dx * dx + dy * dy + 180;
        const inv = 1 / dist2;
        fx += (-dy * v.swirl) * inv * 28;
        fy += (dx * v.swirl) * inv * 28;
        fx += (-dx) * inv * v.pull * 9;
        fy += (-dy) * inv * v.pull * 9;
        hue = (hue + v.hue * inv * 1200) % 360;
      });

      p.vx = p.vx * 0.964 + fx;
      p.vy = p.vy * 0.964 + fy;
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < -20) p.x = w + 20;
      if (p.x > w + 20) p.x = -20;
      if (p.y < -20) p.y = h + 20;
      if (p.y > h + 20) p.y = -20;

      p.life += 0.0022;
      if (p.life > 1) {
        p.life = 0;
        p.x = Math.random() * w;
        p.y = Math.random() * h;
      }

      const alpha = 0.20 + 0.45 * (1 - p.life);
      const size = 0.9 + (1 - p.life) * 1.6;
      ctx.fillStyle = `hsla(${(hue + 360) % 360} 95% 70% / ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
    });

    vortices.forEach((v) => {
      const pulse = 0.18 + (Math.sin(time * 0.002 * v.pulse) * 0.5 + 0.5) * 0.32;
      const glow = ctx.createRadialGradient(v.x, v.y, 1, v.x, v.y, 26);
      glow.addColorStop(0, `hsla(${v.hue} 95% 72% / ${pulse.toFixed(3)})`);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(v.x, v.y, 26, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  const stop = state.fluidStageStop;
  state.fluidStageStop = () => {
    stop();
    window.removeEventListener("resize", onResize);
    state.fluidStageStop = null;
  };
}

runButton.addEventListener("click", () => {
  const result = simulateCircuit();
  state.runCache = result;
  const measuredText = result.measured.length
    ? result.measured.map((m) => `q${m.q}@t${m.t}→${m.outcome} (p1=${m.p1.toFixed(2)})`).join(", ")
    : "No measurements in timeline.";
  resultSummary.innerHTML = `
    <strong>Simulation complete.</strong><br>
    ${measuredText}<br>
    Sample probabilities: ${result.amplitudes.slice(0, 8).join(" | ")}<br>
    Fluid mapping: direction from Bloch x, speed from Bloch y magnitude, coherence from Bloch z, measurements boost local motion.
  `;
  drawVisualizations(result.qubitBlochVectors);
  drawFluidStage(result.qubitBlochVectors, result.measured);
});

clearButton.addEventListener("click", () => {
  state.grid = emptyGrid();
  state.runCache = null;
  renderGrid();
  resultSummary.textContent = "Circuit cleared.";
  visualizationContainer.innerHTML = "";
  stopFluidStageAnimation();
  syncQiskitFromGrid();
});

resizeButton.addEventListener("click", setGridSize);

applyQiskitButton.addEventListener("click", applyQiskitToGrid);
syncQiskitButton.addEventListener("click", () => {
  syncQiskitFromGrid();
  qiskitStatus.textContent = "Qiskit code regenerated from drag/drop grid.";
});

init();
