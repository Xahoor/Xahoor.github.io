# PakBuild Estimator - Civil Engineering Construction Material Calculator

A comprehensive, responsive, and user-friendly web application for construction material estimation and quantity surveying, tailored specifically for **Pakistan's construction landscape** and conforming to international civil engineering standards.

Built with pure **HTML5, CSS3, and vanilla JavaScript** (zero external dependencies, zero build steps, 100% offline-ready).

---

## 🏗️ Supported Construction Types (15 Civil Engineering Members)

1. **Brick Wall** – Calculates 4.5", 9", and 13.5" walls with door/window deductions, mortar ratios (1:3 to 1:7), and Pakistani kiln-burnt brick sizing.
2. **Single Room Construction** – Integrated estimation covering foundation excavation, lean PCC base (1:4:8), stepped brick footing, 4 superstructure walls, RCC roof slab, PCC floor, and plastering.
3. **Complete House Construction** – Multi-storey residential estimation based on Pakistani Marla/Kanal footprints (3, 5, 7, 10 Marla, 1 Kanal) or custom covered area.
4. **Boundary Wall** – Perimeter masonry, stiffener brick/RCC pillars, foundation trenching, and top coping.
5. **Foundation / Strip Footing** – Earthwork trench excavation, lean concrete bed (1:4:8), stepped brick courses, or RCC isolated pad footing with steel rebar.
6. **Roof / RCC Slab** – Compressive concrete volume, mix ratios (1:2:4, 1:1.5:3, 1:1:2), and explicit 2-way reinforcement (sutar rebar, spacing, hooks, and crank allowance).
7. **Concrete Floor** – Sub-base sand/kassu compaction layer, PCC base course (1:3:6 or 1:4:8), and 1:2:4 top finishing screed.
8. **Columns (RCC)** – Structural columns, vertical longitudinal sutar bars with lap/development embedment, and lateral tie rings.
9. **Beams (RCC)** – Plinth, lintel, and roof beams with bottom tension bars, top hanger bars, and shear stirrup rings.
10. **Plastering** – Internal (1:4) and external (1:5) plastering with opening deductions, surface roughness allowances, and dry volume multipliers.
11. **Brick Masonry (Direct Volume)** – Direct volume or dimensional masonry calculation with customizable mortar ratios.
12. **PCC (Plain Cement Concrete)** – Unreinforced concrete for mass beddings, sub-floors, and aprons.
13. **RCC (Reinforced Concrete)** – General reinforced concrete supporting either explicit sutar rebar detailing or civil engineering structural steel percentage rules.
14. **Staircase (RCC)** – Inclined waist slab, triangular risers/treads steps volume, landing slab, and longitudinal rebar.
15. **Custom Construction Calculation** – User-defined arbitrary volume and customizable cement, sand, and aggregate ratios.

---

## 🇵🇰 Pakistan Construction Context & Engineering Standards

- **Steel Sutar System**: Rebar trade sizes are mapped from the Pakistani traditional Sutar system (eighths of an inch) to millimeter diameters with an editable confirmation field:
  - **3 Sutar** = 3/8" ≈ 9.5 mm (nominal #3 / 10 mm)
  - **4 Sutar** = 1/2" ≈ 12.7 mm (nominal #4 / 12 mm)
  - **5 Sutar** = 5/8" ≈ 15.8 mm (nominal #5 / 16 mm)
  - **6 Sutar** = 3/4" ≈ 19.0 mm (nominal #6 / 20 mm)
  - **8 Sutar** = 1" ≈ 25.4 mm (nominal #8 / 25 mm)
  - **Custom Diameter** in mm
- **Steel Weight Formula**: $\text{Weight (kg)} = \frac{\text{Diameter}^2 (\text{mm}) \times \text{Length (m)}}{162.196}$
- **Brick Dimensions**: Standard Pakistani brick size of $9" \times 4.5" \times 3"$ ($228.6 \times 114.3 \times 76.2\text{ mm}$) with $3/8"$ ($10\text{ mm}$) mortar joint.
- **Dry Volume Multipliers**:
  - **Concrete**: $1.54\times$ (54% allowance for dry aggregate void space and shrinkage).
  - **Mortar / Plaster**: $1.33\times$ (33% allowance for dry sand void space and cement paste shrinkage).
- **Cement Bags**: Standard 50 kg Portland cement bags ($\text{bulk density} = 1,440\text{ kg/m}^3$, $\text{volume} \approx 1.25\text{ CFT}$ or $0.03472\text{ m}^3$).
- **Water Estimate**: Defensible calculation based on a $0.50$ water-cement ratio ($\approx 26\text{ to }28\text{ liters}$ of potable water per 50 kg cement bag).

---

## 🚀 How to Run the Application

1. Open `index.html` in any modern web browser (Google Chrome, Microsoft Edge, Mozilla Firefox, Safari).
2. No internet connection, server, or build step is required.

---

## 📁 File Structure

```
construction-calculator/
├── index.html     # Semantic, accessible HTML5 structure & forms
├── style.css      # Professional civil engineering design, responsive layout & print stylesheet
├── script.js      # Calculation engine, unit converters, BOQ generator, and LocalStorage
└── README.md      # Documentation, standards, and formula reference
```
