const MAX_QUBITS = 20;
const paletteGates = ["H", "X", "Y", "Z", "S", "T", "M"];

const state = {
  qubitCount: 4,
  timelineLength: 16,
  grid: [],
  draggedGate: null,
  runCache: null,
  fluidStageStop: null,
  visualizationMode: "angled3d",
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
const saveQiskitButton = document.getElementById("saveQiskitButton");
const loadQiskitButton = document.getElementById("loadQiskitButton");
const loadQiskitFile = document.getElementById("loadQiskitFile");
const visualizationModeSelect = document.getElementById("visualizationModeSelect");

function emptyGrid() {
  return Array.from({ length: state.qubitCount }, () => Array(state.timelineLength).fill(null));
}

function init() {
  state.grid = emptyGrid();
  buildPalette();
  renderGrid();
  drawVisualizations([]);
  syncQiskitFromGrid();
  if (visualizationModeSelect) visualizationModeSelect.value = state.visualizationMode;
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

function project3DPoint(x, y, z, w, h) {
  const sx = w * 0.5 + x + y * 0.4;
  const sy = h * 0.55 + y * 0.25 - z * 0.72;
  return { x: sx, y: sy };
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

  const particles = Array.from({ length: Math.max(3400, qubits.length * 460) }, (_, i) => ({
    x: (Math.random() - 0.5) * fluidStageCanvas.clientWidth * 0.86,
    y: (Math.random() - 0.5) * fluidStageCanvas.clientHeight * 0.74,
    z: (Math.random() - 0.5) * 260,
    vx: 0,
    vy: 0,
    vz: 0,
    life: Math.random(),
    seed: i * 0.013,
  }));

  const fieldSources = qubits.map((qubit, i) => {
    const angle = (i / qubits.length) * Math.PI * 2;
    const rad = 130 + (i % 4) * 45;
    return {
      x: Math.cos(angle) * rad,
      y: Math.sin(angle) * rad * 0.8,
      z: qubit.z * 130,
      driftX: qubit.x * 0.9,
      driftY: qubit.y * 0.65,
      hue: (200 + qubit.p1 * 120 + i * 14) % 360,
      boost: 1 + (measuredCountByQubit.get(qubit.q) || 0) * 0.32,
    };
  });

  const onResize = () => resize();
  window.addEventListener("resize", onResize);

  state.fluidStageStop = createAnimationLoop((time) => {
    const w = fluidStageCanvas.clientWidth;
    const h = fluidStageCanvas.clientHeight;
    const mode = state.visualizationMode;

    ctx.fillStyle = mode === "angled3d" ? "rgba(4, 10, 22, 0.14)" : "rgba(7, 5, 20, 0.12)";
    ctx.fillRect(0, 0, w, h);

    const plane = ctx.createLinearGradient(0, h * 0.18, w, h * 0.92);
    plane.addColorStop(0, mode === "angled3d" ? "rgba(39, 79, 160, 0.09)" : "rgba(172, 73, 255, 0.07)");
    plane.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = plane;
    ctx.fillRect(0, 0, w, h);

    if (mode === "angled3d") {
      const axes = [
        { a: { x: -260, y: 0, z: 0 }, b: { x: 260, y: 0, z: 0 }, color: "rgba(255,95,120,0.24)", label: "X" },
        { a: { x: 0, y: -220, z: 0 }, b: { x: 0, y: 220, z: 0 }, color: "rgba(80,255,190,0.22)", label: "Y" },
        { a: { x: 0, y: 0, z: -200 }, b: { x: 0, y: 0, z: 200 }, color: "rgba(104,170,255,0.25)", label: "Z" },
      ];
      axes.forEach((axis) => {
        const p0 = project3DPoint(axis.a.x, axis.a.y, axis.a.z, w, h);
        const p1 = project3DPoint(axis.b.x, axis.b.y, axis.b.z, w, h);
        ctx.strokeStyle = axis.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
        ctx.fillStyle = axis.color;
        ctx.fillText(axis.label, p1.x + 6, p1.y - 2);
      });
    }

    particles.forEach((p) => {
      let fx = Math.sin((p.x * 0.007) + p.seed + time * 0.0008) * 0.032;
      let fy = Math.cos((p.y * 0.007) - p.seed - time * 0.0007) * 0.032;
      let fz = Math.sin((p.z * 0.01) + p.seed + time * 0.0004) * 0.026;
      let hue = mode === "angled3d" ? 210 : 280;

      fieldSources.forEach((s) => {
        const dx = p.x - s.x;
        const dy = p.y - s.y;
        const dz = p.z - s.z;
        const dist2 = dx * dx + dy * dy + dz * dz + 260;
        const inv = 1 / dist2;
        fx += (-dy * s.boost * 16 + s.driftX * 20) * inv;
        fy += (dx * s.boost * 16 + s.driftY * 18) * inv;
        fz += (-dz * 9 + s.driftX * 10) * inv;
        hue = (hue + s.hue * inv * 1400) % 360;
      });

      if (mode === "neonstorm") {
        fx *= 1.3;
        fy *= 1.3;
        fz *= 1.1;
        hue = (hue + 45 + Math.sin(time * 0.002 + p.seed) * 25) % 360;
      }

      p.vx = p.vx * 0.965 + fx;
      p.vy = p.vy * 0.965 + fy;
      p.vz = p.vz * 0.965 + fz;
      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;

      const boundsX = w * 0.56;
      const boundsY = h * 0.46;
      if (p.x < -boundsX) p.x = boundsX;
      if (p.x > boundsX) p.x = -boundsX;
      if (p.y < -boundsY) p.y = boundsY;
      if (p.y > boundsY) p.y = -boundsY;
      if (p.z < -260) p.z = 260;
      if (p.z > 260) p.z = -260;

      p.life += 0.0022;
      if (p.life > 1) {
        p.life = 0;
        p.x = (Math.random() - 0.5) * w * 0.86;
        p.y = (Math.random() - 0.5) * h * 0.74;
        p.z = (Math.random() - 0.5) * 260;
      }

      const proj = project3DPoint(p.x, p.y, p.z, w, h);
      const depth = (p.z + 260) / 520;
      const radius = 0.8 + depth * 1.5;
      const alpha = (mode === "neonstorm" ? 0.24 : 0.18) + 0.42 * (1 - p.life);
      ctx.fillStyle = `hsla(${(hue + 360) % 360} 96% 70% / ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    fieldSources.forEach((s) => {
      const sourcePoint = project3DPoint(s.x, s.y, s.z, w, h);
      const glowRadius = mode === "neonstorm" ? 40 : 28;
      const glow = ctx.createRadialGradient(sourcePoint.x, sourcePoint.y, 1, sourcePoint.x, sourcePoint.y, glowRadius);
      glow.addColorStop(0, `hsla(${s.hue} 95% 72% / 0.28)`);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sourcePoint.x, sourcePoint.y, glowRadius, 0, Math.PI * 2);
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

saveQiskitButton.addEventListener("click", () => {
  const content = qiskitEditor.value || "";
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `quantum-circuit-${Date.now()}.qiskit.py`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  qiskitStatus.textContent = "Qiskit code saved to file.";
});

loadQiskitButton.addEventListener("click", () => loadQiskitFile.click());
loadQiskitFile.addEventListener("change", async () => {
  const file = loadQiskitFile.files?.[0];
  if (!file) return;
  const text = await file.text();
  qiskitEditor.value = text;
  qiskitStatus.textContent = `Loaded ${file.name}. Click Apply Qiskit Code to build the grid.`;
  loadQiskitFile.value = "";
});

visualizationModeSelect.addEventListener("change", () => {
  state.visualizationMode = visualizationModeSelect.value;
  if (state.runCache) {
    drawFluidStage(state.runCache.qubitBlochVectors, state.runCache.measured);
  }
});

init();
