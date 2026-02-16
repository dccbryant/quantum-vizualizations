const MAX_QUBITS = 20;
const paletteGates = ["H", "X", "Y", "Z", "S", "T", "M"];

const state = {
  qubitCount: 4,
  timelineLength: 16,
  grid: [],
  draggedGate: null,
  runCache: null,
  animationStops: [],
};

const gatePalette = document.getElementById("gatePalette");
const circuitGrid = document.getElementById("circuitGrid");
const runButton = document.getElementById("runButton");
const clearButton = document.getElementById("clearButton");
const qubitCountInput = document.getElementById("qubitCount");
const timelineLengthInput = document.getElementById("timelineLength");
const resizeButton = document.getElementById("resizeButton");
const resultSummary = document.getElementById("resultSummary");
const vizMode = document.getElementById("vizMode");
const visualizationContainer = document.getElementById("visualizationContainer");

function emptyGrid() {
  return Array.from({ length: state.qubitCount }, () => Array(state.timelineLength).fill(null));
}

function init() {
  state.grid = emptyGrid();
  buildPalette();
  renderGrid();
  drawVisualizations([], []);
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
  stopVisualAnimations();
  visualizationContainer.innerHTML = "";
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

function stopVisualAnimations() {
  state.animationStops.forEach((stop) => stop());
  state.animationStops = [];
}

function trackAnimation(stop) {
  if (typeof stop === "function") {
    state.animationStops.push(stop);
  }
}

function drawVisualizations(vectors, measured) {
  stopVisualAnimations();
  visualizationContainer.innerHTML = "";

  if (vizMode.value === "fluid") {
    const card = document.createElement("article");
    card.className = "viz-card";
    const label = document.createElement("div");
    label.textContent = `All qubits fluid field (${vectors.length} qubits)`;
    const canvas = document.createElement("canvas");
    canvas.width = 560;
    canvas.height = 340;
    card.append(label, canvas);
    visualizationContainer.appendChild(card);
    trackAnimation(drawFluidVizAllQubits(canvas, vectors, measured));
    return;
  }

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

    if (vizMode.value === "bloch") drawBloch(canvas, v);
    if (vizMode.value === "heatmap") trackAnimation(drawHeatmapSphere(canvas, v));
    if (vizMode.value === "qsphere") trackAnimation(drawQSphere(canvas, v, index, vectors.length));
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
  ctx.moveTo(c, c - r);
  ctx.lineTo(c, c + r);
  ctx.stroke();

  const px = c + v.x * r;
  const py = c - v.z * r;
  ctx.strokeStyle = "#7bf8d6";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(c, c);
  ctx.lineTo(px, py);
  ctx.stroke();
}

function canUseWebGL() {
  const probe = document.createElement("canvas");
  return Boolean(probe.getContext("webgl") || probe.getContext("experimental-webgl"));
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

function drawHeatmapSphere(canvas, v) {
  if (!canUseWebGL()) {
    drawBloch(canvas, v);
    return null;
  }
  const ctx = canvas.getContext("2d");

  return createAnimationLoop((time) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const points = 420;
    for (let i = 0; i < points; i++) {
      const progress = i / points;
      const theta = progress * Math.PI * 2 + time * 0.0005;
      const wobble = Math.sin(time * 0.0015 + i * 0.13) * 0.4;
      const phi = Math.acos(Math.max(-1, Math.min(1, 2 * progress - 1 + wobble * 0.1)));
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.sin(phi) * Math.sin(theta);
      const z = Math.cos(phi);
      const intensity = Math.max(0.12, 0.5 + 0.5 * (x * v.x + y * v.y + z * v.z));
      const px = canvas.width / 2 + x * 70;
      const py = canvas.height / 2 + y * 70;
      const radius = 1.5 + intensity * 1.8;
      ctx.fillStyle = `rgba(${Math.floor(255 * intensity)}, ${Math.floor(90 + 120 * (1 - intensity))}, 255, 0.7)`;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function drawQSphere(canvas, v, index, total) {
  if (!canUseWebGL()) {
    drawBloch(canvas, v);
    return null;
  }
  const ctx = canvas.getContext("2d");
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const r = canvas.width * 0.4;

  return createAnimationLoop((time) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#778bd6";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    const phases = [v.x, v.y, v.z, v.p1];
    phases.forEach((phase, i) => {
      const spin = time * 0.0008 * (0.8 + i * 0.2);
      const angle = (i / phases.length) * Math.PI * 2 + index * 0.2 + spin;
      const pr = Math.max(0.15, Math.abs(phase));
      const pulse = 0.7 + 0.3 * Math.sin(time * 0.003 + i + index * 0.4);
      const px = cx + Math.cos(angle) * r * pr;
      const py = cy + Math.sin(angle) * r * pr;
      ctx.fillStyle = `hsl(${(phase * 180 + 360 + time * 0.03) % 360} 90% 65%)`;
      ctx.beginPath();
      ctx.arc(px, py, (5 + 7 * pr) * pulse, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = "#9eb1ff";
    ctx.fillText(`state ${index + 1}/${total}`, 8, canvas.height - 10);
  });
}

function drawFluidVizAllQubits(canvas, vectors, measured) {
  if (!canUseWebGL()) {
    drawBloch(canvas, { x: 0, y: 0, z: 1 });
    return null;
  }
  const ctx = canvas.getContext("2d");

  const cols = Math.ceil(Math.sqrt(Math.max(1, vectors.length)));
  const rows = Math.ceil(vectors.length / cols);
  const cellW = canvas.width / cols;
  const cellH = canvas.height / rows;

  const vortices = vectors.map((vector, index) => {
    const measuredCount = measured.filter((m) => m.q === index).length;
    const col = index % cols;
    const row = Math.floor(index / cols);
    const centerX = col * cellW + cellW * 0.5;
    const centerY = row * cellH + cellH * 0.5;

    // Clockwise/anticlockwise from Bloch x sign.
    const direction = vector.x >= 0 ? 1 : -1;
    // Fast/slow from Bloch y magnitude + measurements.
    const spin = 0.004 + Math.abs(vector.y) * 0.015 + measuredCount * 0.003;
    const pull = 0.010 + Math.max(0, vector.p1) * 0.018;
    const radius = Math.min(cellW, cellH) * (0.18 + 0.08 * Math.min(1, Math.abs(vector.z)));

    return {
      index,
      vector,
      measuredCount,
      centerX,
      centerY,
      direction,
      spin,
      pull,
      radius,
      hue: ((Math.atan2(vector.y, vector.x) * 180) / Math.PI + 360) % 360,
    };
  });

  const particles = Array.from({ length: Math.max(480, vectors.length * 120) }, (_, i) => {
    const v = vortices[i % vortices.length];
    const angle = Math.random() * Math.PI * 2;
    const dist = v.radius * (1.0 + Math.random() * 2.8);
    return {
      x: v.centerX + Math.cos(angle) * dist,
      y: v.centerY + Math.sin(angle) * dist,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      hue: (v.hue + i * 3) % 360,
      target: i % vortices.length,
    };
  });

  return createAnimationLoop((time) => {
    ctx.fillStyle = "rgba(4, 8, 18, 0.23)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    vortices.forEach((vortex) => {
      const corePulse = 1 + 0.12 * Math.sin(time * 0.004 + vortex.index);
      const ringRadius = vortex.radius * 2.5;

      const ringGrad = ctx.createRadialGradient(
        vortex.centerX,
        vortex.centerY,
        vortex.radius * 0.6,
        vortex.centerX,
        vortex.centerY,
        ringRadius
      );
      ringGrad.addColorStop(0, `hsla(${vortex.hue} 90% 55% / 0.28)`);
      ringGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = ringGrad;
      ctx.beginPath();
      ctx.arc(vortex.centerX, vortex.centerY, ringRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(2, 4, 10, 0.98)";
      ctx.beginPath();
      ctx.arc(vortex.centerX, vortex.centerY, vortex.radius * corePulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `hsla(${vortex.hue} 95% 70% / 0.65)`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(vortex.centerX, vortex.centerY, vortex.radius * 1.6, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "rgba(220, 230, 255, 0.85)";
      const directionLabel = vortex.direction > 0 ? "cw" : "ccw";
      const speedLabel = vortex.spin > 0.015 ? "fast" : vortex.spin > 0.01 ? "med" : "slow";
      ctx.fillText(`q${vortex.index} ${directionLabel} ${speedLabel}`, vortex.centerX - 32, vortex.centerY + ringRadius + 12);
    });

    particles.forEach((p, i) => {
      const vortex = vortices[p.target];
      const dx = p.x - vortex.centerX;
      const dy = p.y - vortex.centerY;
      const dist = Math.hypot(dx, dy) + 0.0001;

      // Tangential swirl for clockwise/anticlockwise spin.
      const tx = (-dy / dist) * vortex.direction;
      const ty = (dx / dist) * vortex.direction;

      // Inward pull + state-driven wobble.
      const pullX = (-dx / dist) * vortex.pull;
      const pullY = (-dy / dist) * vortex.pull;
      const wobble = Math.sin(time * 0.002 + i * 0.07 + vortex.index) * 0.015;

      p.vx += tx * vortex.spin + pullX + wobble * vortex.vector.z;
      p.vy += ty * vortex.spin + pullY + wobble * vortex.vector.y;
      p.vx *= 0.987;
      p.vy *= 0.987;
      p.x += p.vx;
      p.y += p.vy;

      if (dist < vortex.radius * 0.85 || dist > Math.min(cellW, cellH) * 0.68) {
        const respawnAngle = Math.random() * Math.PI * 2;
        const respawnDist = vortex.radius * (1.6 + Math.random() * 2.8);
        p.x = vortex.centerX + Math.cos(respawnAngle) * respawnDist;
        p.y = vortex.centerY + Math.sin(respawnAngle) * respawnDist;
        p.vx = (Math.random() - 0.5) * 0.25;
        p.vy = (Math.random() - 0.5) * 0.25;
      }

      if (p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) {
        p.x = (p.x + canvas.width) % canvas.width;
        p.y = (p.y + canvas.height) % canvas.height;
      }

      p.hue = (vortex.hue + dist * 0.35 + time * 0.015) % 360;
      ctx.fillStyle = `hsla(${p.hue} 95% 67% / 0.8)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.8 + Math.abs(vortex.vector.y) * 1.3, 0, Math.PI * 2);
      ctx.fill();
    });
  });
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
    Sample probabilities: ${result.amplitudes.slice(0, 8).join(" | ")}
  `;
  drawVisualizations(result.qubitBlochVectors, result.measured);
});

clearButton.addEventListener("click", () => {
  state.grid = emptyGrid();
  state.runCache = null;
  renderGrid();
  resultSummary.textContent = "Circuit cleared.";
  stopVisualAnimations();
  visualizationContainer.innerHTML = "";
});

resizeButton.addEventListener("click", setGridSize);
vizMode.addEventListener("change", () => {
  if (state.runCache) {
    drawVisualizations(state.runCache.qubitBlochVectors, state.runCache.measured);
  }
});

init();
