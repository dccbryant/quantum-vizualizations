# quantum-vizualizations

A super minimal quantum drag-and-drop circuit UI with a lightweight in-browser simulator and pluggable visualization modes.

## Features

- Drag/drop gates (`H`, `X`, `Y`, `Z`, `S`, `T`, `Measure`) onto up to **20 qubits**.
- Place gates at **any timeline column** (not left-compacted).
- Convert two `X` placements in the same column into a **CNOT** (control + target pair).
- Run the circuit on demand with the **Run Circuit** button.
- Measurement operations are available from the palette.
- Visualization mode switcher with:
  - Illustrated Bloch spheres
  - Particle heatmap sphere (WebGL-backed canvas path)
  - Q-sphere style view (WebGL-backed canvas path)
  - Fluid-like particle flow view (WebGL-backed canvas path)
- Visualization module design is open for extension by adding new draw functions and option values.

## Run locally

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173>.

## Basic usage

1. Configure qubit and timeline length.
2. Drag gates from the palette to any cell.
3. Double click a placed gate to remove it.
4. Click **Run Circuit** to simulate and update visualizations.
