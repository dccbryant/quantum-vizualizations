# quantum-vizualizations

A minimal quantum drag-and-drop circuit UI with an in-browser simulator and two focused outputs:

1. **Illustrated Bloch spheres** on the right (per-qubit state view).
2. A **large minimal fluid stage canvas** below the main UI showing all-qubit particle flow dynamics.

## Features

- Drag/drop gates (`H`, `X`, `Y`, `Z`, `S`, `T`, `Measure`) onto up to **20 qubits**.
- Place gates at **any timeline column**.
- Convert two `X` placements in the same column into a **CNOT** pair.
- Run the circuit on demand with **Run Circuit**.
- Right panel always shows illustrated Bloch spheres for qubit states.
- Bottom full-width canvas renders a minimal water-like particle flow visualization representing all qubits.

## Run locally

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173>.

## Getting the latest version

If you're missing recent changes locally, sync from git before running:

```bash
git fetch origin
git checkout <your-branch-or-commit>
```

Then run the local server command above.

## Basic usage

1. Configure qubit and timeline length.
2. Drag gates from the palette to any grid cell.
3. Optional: add `Measure` gates to influence local flow intensity.
4. Click **Run Circuit**.
