# quantum-vizualizations

A minimal quantum drag-and-drop circuit UI with an in-browser simulator and three focused areas:

1. Drag/drop circuit grid.
2. A right-side **Qiskit composer** editor for basic circuit text editing.
3. A full-width **unified fluid surface** that creatively visualizes qubit state dynamics.

## Features

- Drag/drop gates (`H`, `X`, `Y`, `Z`, `S`, `T`, `Measure`) onto up to **20 qubits**.
- Place gates at **any timeline column**.
- Convert two `X` placements in the same column into a **CNOT** pair.
- Run the circuit on demand with **Run Circuit**.
- Use the right-side **Qiskit Composer**:
  - Generate Qiskit-like code from the drag/drop grid.
  - Apply basic Qiskit-like code back into the grid (`h/x/y/z/s/t`, `cx`, `measure`).
  - Save composer code to a local `.qiskit.py` file and load it back later.
- Bloch spheres are shown in a **horizontal strip below the palette/grid/composer row** for better space usage.
- Bottom visualization supports multiple modes: **Interactive Qubit Landscape** (default) and **Angled 3D Fluid Plane**.
- Landscape mode presents a rotatable/zoomable 3D point terrain where qubits shape peaks and troughs directly (drag to rotate, wheel to zoom). Use movement icons to pan (⬅️➡️⬆️⬇️), flip (🔄), and reset view (♻️).
- 3D mapping: x≈Bloch x drift, y≈Bloch y energy, z≈Bloch z depth lift, and measurements intensify nearby motion.

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
3. Optional: edit or paste Qiskit code in the composer and click **Apply Qiskit Code**.
4. Click **Run Circuit**.
