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
  visualizationContainer.innerHTML = "";
  stopFluidStageAnimation();
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
    ctx.fillStyle = "#0b1529";
    ctx.fillRect(0, 0, fluidStageCanvas.clientWidth, fluidStageCanvas.clientHeight);
    return;
  }

  const laneTop = 42;
  const laneBottom = 20;
  const laneHeight = Math.max(24, (fluidStageCanvas.clientHeight - laneTop - laneBottom) / qubits.length);
  const laneMap = qubits.map((qubit, idx) => {
    const measuredCount = measured.filter((m) => m.q === qubit.q).length;
    const centerY = laneTop + laneHeight * (idx + 0.5);
    return {
      ...qubit,
      blochX: qubit.x,
      blochY: qubit.y,
      blochZ: qubit.z,
      centerY,
      measuredCount,
      speed: 0.45 + Math.abs(qubit.y) * 1.55 + measuredCount * 0.2,
      wobble: 7 + (1 - Math.abs(qubit.z)) * 16,
      direction: qubit.x >= 0 ? 1 : -1,
      hueA: 200 + qubit.p1 * 140,
      hueB: 300 - qubit.p1 * 120,
    };
  });

  const pulses = measured.map((m, i) => ({
    q: m.q,
    t0: i * 90,
    strength: 0.7 + m.p1 * 0.6,
  }));

  const particles = Array.from({ length: Math.max(2600, qubits.length * 360) }, (_, i) => {
    const lane = laneMap[i % laneMap.length];
    return {
      laneIndex: i % laneMap.length,
      x: Math.random() * fluidStageCanvas.clientWidth,
      y: lane.centerY + (Math.random() - 0.5) * laneHeight * 0.75,
      vx: 0,
      vy: 0,
      life: Math.random(),
      seed: i * 0.017,
    };
  });

  const onResize = () => resize();
  window.addEventListener("resize", onResize);

  state.fluidStageStop = createAnimationLoop((time) => {
    const w = fluidStageCanvas.clientWidth;

    ctx.fillStyle = "rgba(5, 10, 18, 0.11)";
    ctx.fillRect(0, 0, w, fluidStageCanvas.clientHeight);

    laneMap.forEach((lane) => {
      const grad = ctx.createLinearGradient(0, lane.centerY, w, lane.centerY);
      grad.addColorStop(0, `hsla(${lane.hueA} 85% 60% / 0.03)`);
      grad.addColorStop(0.5, `hsla(${lane.hueB} 85% 60% / 0.12)`);
      grad.addColorStop(1, `hsla(${lane.hueA} 85% 60% / 0.03)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, lane.centerY - laneHeight * 0.42, w, laneHeight * 0.84);

      ctx.strokeStyle = "rgba(140, 172, 255, 0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, lane.centerY);
      ctx.lineTo(w, lane.centerY);
      ctx.stroke();

      const arrowX = lane.direction > 0 ? w - 26 : 26;
      const arrowTail = lane.direction > 0 ? arrowX - 12 : arrowX + 12;
      ctx.strokeStyle = "rgba(220, 235, 255, 0.7)";
      ctx.beginPath();
      ctx.moveTo(arrowTail, lane.centerY);
      ctx.lineTo(arrowX, lane.centerY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(arrowX, lane.centerY);
      ctx.lineTo(arrowX - lane.direction * 4, lane.centerY - 3);
      ctx.lineTo(arrowX - lane.direction * 4, lane.centerY + 3);
      ctx.closePath();
      ctx.fillStyle = "rgba(220, 235, 255, 0.7)";
      ctx.fill();
    });

    pulses.forEach((pulse) => {
      const lane = laneMap.find((item) => item.q === pulse.q);
      if (!lane) return;
      const phase = ((time * 0.09 + pulse.t0) % (w + 160)) - 80;
      const r = 12 + pulse.strength * 16;
      ctx.strokeStyle = `hsla(${lane.hueA} 95% 72% / 0.33)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(phase, lane.centerY, r, 0, Math.PI * 2);
      ctx.stroke();
    });

    ctx.fillStyle = "rgba(220,230,255,0.8)";
    ctx.font = "12px Inter, system-ui, sans-serif";
    ctx.fillText("Legend: row=qubit, arrow=x direction, waviness=z coherence, speed=|y|, color=p(|1⟩), circles=measure pulses", 10, 18);

    laneMap.forEach((lane) => {
      ctx.fillStyle = "rgba(227, 239, 255, 0.9)";
      ctx.fillText(`q${lane.q}  p1:${lane.p1.toFixed(2)}  x:${lane.blochX.toFixed(2)}  y:${lane.blochY.toFixed(2)}  z:${lane.blochZ.toFixed(2)}  m:${lane.measuredCount}`, 8, lane.centerY - 6);
    });

    particles.forEach((p) => {
      const lane = laneMap[p.laneIndex % laneMap.length];
      const dxCenter = p.y - lane.centerY;
      const localWave = Math.sin((p.x * 0.008) + time * 0.0015 * lane.direction + p.seed) * lane.wobble;
      const wavePull = (lane.centerY + localWave - p.y) * 0.007;
      const flowX = lane.direction * lane.speed * (0.12 + Math.abs(lane.blochX) * 0.1);

      let fx = flowX;
      let fy = wavePull - dxCenter * 0.0022;

      if (lane.measuredCount > 0) {
        const pulseWave = Math.sin((p.x * 0.015) - time * 0.003 + p.seed) * 0.09 * lane.measuredCount;
        fy += pulseWave;
      }

      p.vx = p.vx * 0.965 + fx;
      p.vy = p.vy * 0.965 + fy;

      const px = p.x;
      const py = p.y;
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < -40 || p.x > w + 40) {
        p.x = lane.direction > 0 ? -20 : w + 20;
        p.y = lane.centerY + (Math.random() - 0.5) * laneHeight * 0.8;
      }

      if (p.y < lane.centerY - laneHeight * 0.6 || p.y > lane.centerY + laneHeight * 0.6) {
        p.y = lane.centerY + (Math.random() - 0.5) * laneHeight * 0.35;
        p.vy *= 0.3;
      }

      p.life += 0.0026;
      if (p.life > 1) {
        p.life = 0;
        p.x = lane.direction > 0 ? Math.random() * (w * 0.35) : w - Math.random() * (w * 0.35);
        p.y = lane.centerY + (Math.random() - 0.5) * laneHeight * 0.75;
      }

      const alpha = 0.25 + 0.45 * (1 - p.life);
      const blendHue = lane.hueA * (1 - p.life) + lane.hueB * p.life;
      ctx.strokeStyle = `hsla(${blendHue.toFixed(1)} 96% 72% / ${alpha.toFixed(3)})`;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
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
    Sample probabilities: ${result.amplitudes.slice(0, 8).join(" | ")}
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
});

resizeButton.addEventListener("click", setGridSize);

init();
