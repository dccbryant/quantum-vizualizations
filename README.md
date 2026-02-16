# quantum-vizualizations

A minimal quantum drag-and-drop circuit UI with an in-browser simulator and two focused outputs:

1. **Illustrated Bloch spheres** on the right (per-qubit state view).
2. A **large cinematic fluid stage canvas** below the main UI showing measured-qubit particle dynamics.

## Features

- Drag/drop gates (`H`, `X`, `Y`, `Z`, `S`, `T`, `Measure`) onto up to **20 qubits**.
- Place gates at **any timeline column**.
- Convert two `X` placements in the same column into a **CNOT** pair.
- Run the circuit on demand with **Run Circuit**.
- Right panel always shows illustrated Bloch spheres for qubit states.
- Bottom full-width canvas renders a cool Navier-Stokes-inspired particle vortex visualization of measured qubits.

## Run locally

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173>.

## Basic usage

1. Configure qubit and timeline length.
2. Drag gates from the palette to any grid cell.
3. Add `Measure` gates for qubits you want emphasized in the fluid stage.
4. Click **Run Circuit**.
