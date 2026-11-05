/**
 * ============================================================================
 * PakBuild Estimator - Civil Engineering & Construction Material Calculator
 * Architecture & Calculation Engine (Vanilla JavaScript)
 * Tailored for Pakistan and Universal Civil Engineering Standards
 * ============================================================================
 */

// Global State
const appState = {
  unitSystem: 'imperial', // 'imperial' (ft, in, cft) or 'metric' (m, cm, m3)
  activeType: 'roof_slab',
  openings: [
    { type: 'Door', width: 3.5, height: 7.0, qty: 1 },
    { type: 'Window', width: 4.0, height: 4.0, qty: 1 }
  ],
  savedCalculations: [],
  lastResult: null
};

// Sutar to Millimeter standard conversion table
const SUTAR_MAP = {
  '3_sutar': { label: '3 Sutar (3/8" trade)', mm: 9.53, nominal: 10 },
  '4_sutar': { label: '4 Sutar (1/2" trade)', mm: 12.70, nominal: 12 },
  '5_sutar': { label: '5 Sutar (5/8" trade)', mm: 15.88, nominal: 16 },
  '6_sutar': { label: '6 Sutar (3/4" trade)', mm: 19.05, nominal: 20 },
  '8_sutar': { label: '8 Sutar (1" trade)', mm: 25.40, nominal: 25 },
  'custom': { label: 'Custom Diameter (mm)', mm: 12.00, nominal: 12 }
};

// Standard Mix Ratios
const MIX_RATIOS = {
  '1:1:2': { c: 1, s: 1, a: 2, sum: 4, desc: 'M25 (Heavy RCC, water tanks)' },
  '1:1.5:3': { c: 1, s: 1.5, a: 3, sum: 5.5, desc: 'M20 (Standard RCC slabs, beams, columns)' },
  '1:2:4': { c: 1, s: 2, a: 4, sum: 7, desc: 'M15 (General RCC & floor concrete)' },
  '1:3:6': { c: 1, s: 3, a: 6, sum: 10, desc: 'M10 (PCC foundation bed, sub-flooring)' },
  '1:4:8': { c: 1, s: 4, a: 8, sum: 13, desc: 'M7.5 (Lean concrete foundation base)' }
};

const MORTAR_RATIOS = {
  '1:3': { c: 1, s: 3, sum: 4, desc: '1:3 (High strength / damp conditions)' },
  '1:4': { c: 1, s: 4, sum: 5, desc: '1:4 (Standard for 4.5" partition walls & plaster)' },
  '1:5': { c: 1, s: 5, sum: 6, desc: '1:5 (Standard for external plaster & 9" walls)' },
  '1:6': { c: 1, s: 6, sum: 7, desc: '1:6 (Standard for 9" & 13.5" brick masonry)' },
  '1:7': { c: 1, s: 7, sum: 8, desc: '1:7 (Economy brickwork)' },
  '1:8': { c: 1, s: 8, sum: 9, desc: '1:8 (Boundary / low load walls)' }
};

// Engineering Constants
const CEMENT_BAG_WEIGHT_KG = 50.0;
const CEMENT_BULK_DENSITY_KG_M3 = 1440.0;
const CEMENT_BAG_VOL_M3 = CEMENT_BAG_WEIGHT_KG / CEMENT_BULK_DENSITY_KG_M3; // ~0.03472 m3
const CEMENT_BAG_VOL_CFT = 1.25; // Standard Pakistani field constant (1 bag = 1.25 CFT)
const DRY_VOL_FACTOR_CONCRETE = 1.54; // 54% void factor for dry aggregates
const DRY_VOL_FACTOR_MORTAR = 1.33; // 33% void factor for dry sand & cement shrinkage
const STEEL_DENSITY_KG_M3 = 7850.0;
const METER_TO_FEET = 3.28084;
const CFT_PER_CUBIC_METER = 35.3147;

/* ============================================================================
   1. DOM INITIALIZATION & EVENT BINDINGS
   ============================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  initUnitSwitcher();
  initTypeSelector();
  initOpeningsManager();
  initAccordions();
  initStorage();
  initActionButtons();
  
  // Render default form (Roof Slab)
  renderDynamicForm(appState.activeType);
});

function initUnitSwitcher() {
  const container = document.getElementById('globalUnitControl');
  if (!container) return;

  const buttons = container.querySelectorAll('.segment-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const newUnit = btn.dataset.unit;
      if (newUnit !== appState.unitSystem) {
        appState.unitSystem = newUnit;
        updateUnitLabels();
        renderDynamicForm(appState.activeType);
        // If results already shown, re-run calculate
        if (appState.lastResult) {
          calculateCurrentProject();
        }
      }
    });
  });
}

function updateUnitLabels() {
  const isMetric = appState.unitSystem === 'metric';
  const lenUnit = isMetric ? 'm' : 'ft';
  document.querySelectorAll('.unit-len-label').forEach(el => el.textContent = lenUnit);
}

function initTypeSelector() {
  const select = document.getElementById('constructionTypeSelect');
  const gridBtns = document.querySelectorAll('.type-btn');

  // Grid buttons click
  gridBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      setActiveType(type);
    });
  });

  // Mobile select change
  if (select) {
    select.addEventListener('change', (e) => {
      setActiveType(e.target.value);
    });
  }
}

function setActiveType(type) {
  appState.activeType = type;

  // Sync grid buttons
  document.querySelectorAll('.type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === type);
  });

  // Sync mobile select
  const select = document.getElementById('constructionTypeSelect');
  if (select) select.value = type;

  renderDynamicForm(type);
}

function initAccordions() {
  setupAccordion('costAccordionHeader', 'costAccordionBody');
  setupAccordion('assumptionsAccordionHeader', 'assumptionsAccordionBody');
}

function setupAccordion(headerId, bodyId) {
  const header = document.getElementById(headerId);
  const body = document.getElementById(bodyId);
  if (!header || !body) return;

  header.addEventListener('click', () => {
    const isCollapsed = body.classList.toggle('collapsed');
    const arrow = header.querySelector('.accordion-arrow');
    if (arrow) arrow.classList.toggle('collapsed', isCollapsed);
  });
}

function initActionButtons() {
  const form = document.getElementById('calculatorForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      calculateCurrentProject();
    });
  }

  const btnReset = document.getElementById('btnReset');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all inputs to defaults?')) {
        renderDynamicForm(appState.activeType);
        document.getElementById('resultsContainer').style.display = 'none';
        document.getElementById('resultsPlaceholder').style.display = 'block';
        appState.lastResult = null;
      }
    });
  }

  const btnPrintTop = document.getElementById('btnPrintTop');
  if (btnPrintTop) btnPrintTop.addEventListener('click', printReport);

  const btnPrintReport = document.getElementById('btnPrintReport');
  if (btnPrintReport) btnPrintReport.addEventListener('click', printReport);

  const btnExportCSV = document.getElementById('btnExportCSV');
  if (btnExportCSV) btnExportCSV.addEventListener('click', exportCSV);

  const btnSaveEstimate = document.getElementById('btnSaveEstimate');
  if (btnSaveEstimate) btnSaveEstimate.addEventListener('click', saveCurrentEstimate);

  const btnOpenSaved = document.getElementById('btnOpenSaved');
  if (btnOpenSaved) btnOpenSaved.addEventListener('click', openSavedModal);

  const btnCloseSavedModal = document.getElementById('btnCloseSavedModal');
  if (btnCloseSavedModal) btnCloseSavedModal.addEventListener('click', closeSavedModal);

  const btnCloseSavedModalBtn = document.getElementById('btnCloseSavedModalBtn');
  if (btnCloseSavedModalBtn) btnCloseSavedModalBtn.addEventListener('click', closeSavedModal);

  const btnClearAllSaved = document.getElementById('btnClearAllSaved');
  if (btnClearAllSaved) btnClearAllSaved.addEventListener('click', clearAllSaved);
}

/* ============================================================================
   2. UNIT CONVERSIONS & HELPER FUNCTIONS
   ============================================================================ */

/**
 * Converts length input into internal standard unit (Meters)
 */
function convertToMeters(value, fromUnit) {
  const v = parseFloat(value);
  if (isNaN(v)) return 0;
  switch (fromUnit) {
    case 'meters':
    case 'm':
      return v;
    case 'cm':
      return v / 100.0;
    case 'mm':
      return v / 1000.0;
    case 'feet':
    case 'ft':
      return v * 0.3048;
    case 'inches':
    case 'in':
      return v * 0.0254;
    default:
      return v;
  }
}

/**
 * Converts meters into current active length display unit
 */
function metersToActiveUnit(meters) {
  if (appState.unitSystem === 'metric') return meters;
  return meters * METER_TO_FEET;
}

/**
 * Converts cubic meters to active volume unit (CFT or m³)
 */
function m3ToActiveVolume(m3) {
  if (appState.unitSystem === 'metric') {
    return { val: m3, unit: 'm³', altVal: m3 * CFT_PER_CUBIC_METER, altUnit: 'CFT' };
  } else {
    return { val: m3 * CFT_PER_CUBIC_METER, unit: 'CFT', altVal: m3, altUnit: 'm³' };
  }
}

/**
 * Calculate Sutar equivalent in millimeters with confirmation
 */
function getSutarDiameter(sutarKey, customMm = null) {
  if (sutarKey === 'custom' && customMm) {
    return parseFloat(customMm) || 12.0;
  }
  const entry = SUTAR_MAP[sutarKey];
  return entry ? entry.mm : 12.0;
}

/**
 * Standard Civil Engineering Steel Unit Weight formula
 * Weight (kg) = Diameter² (mm) * Total Length (m) / 162.196
 */
function calculateSteelWeightKg(diameterMm, lengthMeters) {
  if (!diameterMm || !lengthMeters) return 0;
  return (Math.pow(diameterMm, 2) * lengthMeters) / 162.196;
}

/* ============================================================================
   3. OPENINGS MANAGER (DOORS, WINDOWS, VENTS)
   ============================================================================ */

function initOpeningsManager() {
  const btnAdd = document.getElementById('btnAddOpening');
  if (btnAdd) {
    btnAdd.addEventListener('click', () => {
      appState.openings.push({ type: 'Window', width: 4.0, height: 4.0, qty: 1 });
      renderOpeningsTable();
    });
  }
  renderOpeningsTable();
}

function renderOpeningsTable() {
  const tbody = document.getElementById('openingsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const isMetric = appState.unitSystem === 'metric';
  const unitLabel = isMetric ? 'm' : 'ft';
  const areaUnit = isMetric ? 'm²' : 'sq.ft';

  if (appState.openings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding: 1rem;">No openings specified. Full wall area will be calculated.</td></tr>`;
    return;
  }

  appState.openings.forEach((op, index) => {
    const area = op.width * op.height * op.qty;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <input type="text" class="form-control form-control-sm" value="${escapeHtml(op.type)}" onchange="updateOpening(${index}, 'type', this.value)">
      </td>
      <td>
        <input type="number" step="0.1" min="0" class="form-control form-control-sm" value="${op.width}" onchange="updateOpening(${index}, 'width', this.value)">
      </td>
      <td>
        <input type="number" step="0.1" min="0" class="form-control form-control-sm" value="${op.height}" onchange="updateOpening(${index}, 'height', this.value)">
      </td>
      <td>
        <input type="number" step="1" min="1" class="form-control form-control-sm" style="width: 70px;" value="${op.qty}" onchange="updateOpening(${index}, 'qty', this.value)">
      </td>
      <td>
        <strong>${area.toFixed(2)}</strong> ${areaUnit}
      </td>
      <td>
        <button type="button" class="btn-icon-danger" onclick="removeOpening(${index})" title="Remove opening">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.updateOpening = function(index, field, value) {
  if (!appState.openings[index]) return;
  if (field === 'type') {
    appState.openings[index].type = value;
  } else {
    appState.openings[index][field] = Math.max(0, parseFloat(value) || 0);
  }
  renderOpeningsTable();
};

window.removeOpening = function(index) {
  appState.openings.splice(index, 1);
  renderOpeningsTable();
};

/**
 * Returns total openings area in square meters
 */
function getTotalOpeningsAreaM2() {
  let totalArea = 0;
  const isMetric = appState.unitSystem === 'metric';
  appState.openings.forEach(op => {
    const w = parseFloat(op.width) || 0;
    const h = parseFloat(op.height) || 0;
    const q = parseFloat(op.qty) || 0;
    if (isMetric) {
      totalArea += (w * h * q);
    } else {
      // ft² to m²
      totalArea += (w * h * q) * 0.092903;
    }
  });
  return totalArea;
}

/* ============================================================================
   4. DYNAMIC FORM GENERATOR (15 CONSTRUCTION TYPES)
   ============================================================================ */

function renderDynamicForm(type) {
  const container = document.getElementById('dynamicFormFields');
  const openingsSec = document.getElementById('openingsSection');
  const steelSec = document.getElementById('steelDetailSection');
  const steelGrid = document.getElementById('steelInputsGrid');
  const titleEl = document.getElementById('formHeaderTitle');
  const descEl = document.getElementById('formHeaderDesc');

  if (!container) return;

  const isMetric = appState.unitSystem === 'metric';
  const lenUnit = isMetric ? 'm' : 'ft';
  const thkUnit = isMetric ? 'mm' : 'in';

  // Toggle auxiliary sections visibility by default
  if (openingsSec) openingsSec.style.display = 'none';
  if (steelSec) steelSec.style.display = 'none';
  if (steelGrid) steelGrid.innerHTML = '';

  let html = '';

  switch (type) {
    case 'brick_wall':
      titleEl.textContent = '3. Brick Wall Specifications';
      descEl.textContent = 'Specify wall dimensions, brick sizing, mortar ratios, and deductions for doors & windows.';
      if (openingsSec) openingsSec.style.display = 'block';

      html = `
        <div class="form-grid grid-3">
          <div class="form-group">
            <label for="wallLength">Wall Length (<span class="unit-len-label">${lenUnit}</span>) *</label>
            <input type="number" id="wallLength" class="form-control" step="0.1" min="0.1" value="${isMetric ? '6.0' : '20.0'}" required>
          </div>
          <div class="form-group">
            <label for="wallHeight">Wall Height (<span class="unit-len-label">${lenUnit}</span>) *</label>
            <input type="number" id="wallHeight" class="form-control" step="0.1" min="0.1" value="${isMetric ? '3.2' : '10.5'}" required>
          </div>
          <div class="form-group">
            <label for="wallCount">Number of Identical Walls</label>
            <input type="number" id="wallCount" class="form-control" step="1" min="1" value="1" required>
          </div>
        </div>

        <div class="form-grid grid-3 mt-3">
          <div class="form-group">
            <label for="wallThicknessSelect">Wall Thickness *</label>
            <select id="wallThicknessSelect" class="form-control">
              <option value="4.5">4.5 Inches (Single / Partition Wall)</option>
              <option value="9.0" selected>9.0 Inches (One Brick Standard Wall)</option>
              <option value="13.5">13.5 Inches (1.5 Brick Heavy / Load Wall)</option>
              <option value="custom">Custom Thickness</option>
            </select>
          </div>
          <div class="form-group" id="customThicknessGroup" style="display: none;">
            <label for="customWallThickness">Custom Thickness (<span class="unit-len-label">${thkUnit}</span>)</label>
            <input type="number" id="customWallThickness" class="form-control" step="0.5" value="${isMetric ? '225' : '9.0'}">
          </div>
          <div class="form-group">
            <label for="brickSizeSelect">Brick Dimensions</label>
            <select id="brickSizeSelect" class="form-control">
              <option value="pk_standard" selected>Standard Pakistani Brick (9" × 4.5" × 3")</option>
              <option value="metric_std">Metric Standard (225 × 112.5 × 75 mm)</option>
              <option value="modular">Modular Brick (190 × 90 × 90 mm)</option>
              <option value="custom">Custom Dimensions</option>
            </select>
          </div>
          <div class="form-group">
            <label for="mortarRatioSelect">Mortar Ratio (Cement : Sand)</label>
            <select id="mortarRatioSelect" class="form-control">
              <option value="1:3">1:3 (High Strength / Parapet)</option>
              <option value="1:4">1:4 (Standard for 4.5" Partition)</option>
              <option value="1:5">1:5 (Standard for Masonry)</option>
              <option value="1:6" selected>1:6 (Pakistani Practice for 9" Walls)</option>
              <option value="1:7">1:7 (Lean Mortar)</option>
            </select>
          </div>
        </div>

        <div class="form-grid grid-3 mt-3" id="customBrickDimsRow" style="display: none;">
          <div class="form-group">
            <label for="brickLen">Brick Length (${thkUnit})</label>
            <input type="number" id="brickLen" class="form-control" step="0.1" value="${isMetric ? '228.6' : '9.0'}">
          </div>
          <div class="form-group">
            <label for="brickWid">Brick Width (${thkUnit})</label>
            <input type="number" id="brickWid" class="form-control" step="0.1" value="${isMetric ? '114.3' : '4.5'}">
          </div>
          <div class="form-group">
            <label for="brickHgt">Brick Height (${thkUnit})</label>
            <input type="number" id="brickHgt" class="form-control" step="0.1" value="${isMetric ? '76.2' : '3.0'}">
          </div>
        </div>
      `;
      break;

    case 'room':
      titleEl.textContent = '3. Single Room Construction Specifications';
      descEl.textContent = 'Integrated calculation for Foundation, 4 Walls, Roof RCC Slab, PCC Floor, and Internal/External Plastering.';
      if (openingsSec) openingsSec.style.display = 'block';
      if (steelSec) steelSec.style.display = 'block';

      html = `
        <div class="form-grid grid-4">
          <div class="form-group">
            <label for="roomLength">Room Length (Inside) (${lenUnit}) *</label>
            <input type="number" id="roomLength" class="form-control" step="0.1" min="1" value="${isMetric ? '4.5' : '15.0'}" required>
          </div>
          <div class="form-group">
            <label for="roomWidth">Room Width (Inside) (${lenUnit}) *</label>
            <input type="number" id="roomWidth" class="form-control" step="0.1" min="1" value="${isMetric ? '3.6' : '12.0'}" required>
          </div>
          <div class="form-group">
            <label for="roomWallHeight">Clear Wall Height (${lenUnit}) *</label>
            <input type="number" id="roomWallHeight" class="form-control" step="0.1" min="1" value="${isMetric ? '3.2' : '10.5'}" required>
          </div>
          <div class="form-group">
            <label for="roomWallThick">Wall Thickness</label>
            <select id="roomWallThick" class="form-control">
              <option value="9.0" selected>9 Inches (Standard 1 Brick)</option>
              <option value="4.5">4.5 Inches</option>
              <option value="13.5">13.5 Inches</option>
            </select>
          </div>
        </div>

        <div class="form-grid grid-3 mt-3">
          <div class="form-group">
            <label for="roomFoundationDepth">Foundation Depth Below Plinth (${lenUnit})</label>
            <input type="number" id="roomFoundationDepth" class="form-control" step="0.1" value="${isMetric ? '0.9' : '3.0'}">
            <span class="field-hint">Includes trench excavation & stepped footing</span>
          </div>
          <div class="form-group">
            <label for="roomSlabThick">Roof Slab Thickness (${thkUnit})</label>
            <input type="number" id="roomSlabThick" class="form-control" step="0.5" value="${isMetric ? '150' : '6.0'}">
          </div>
          <div class="form-group">
            <label for="roomSlabOverhang">Roof Slab Overhang / Projection (${lenUnit})</label>
            <input type="number" id="roomSlabOverhang" class="form-control" step="0.1" value="${isMetric ? '0.45' : '1.5'}">
          </div>
        </div>

        <div class="form-grid grid-3 mt-3">
          <div class="form-group">
            <label for="roomMortarRatio">Wall Mortar Ratio</label>
            <select id="roomMortarRatio" class="form-control">
              <option value="1:4">1:4 Ratio</option>
              <option value="1:5">1:5 Ratio</option>
              <option value="1:6" selected>1:6 Ratio (Standard)</option>
            </select>
          </div>
          <div class="form-group">
            <label for="roomConcreteMix">RCC Slab Concrete Mix</label>
            <select id="roomConcreteMix" class="form-control">
              <option value="1:1.5:3">1:1.5:3 (M20 Structural)</option>
              <option value="1:2:4" selected>1:2:4 (M15 Standard Slab)</option>
            </select>
          </div>
          <div class="form-group">
            <label for="roomPlasterOption">Plaster Requirements</label>
            <select id="roomPlasterOption" class="form-control">
              <option value="both" selected>Both Internal & External Plaster</option>
              <option value="internal_only">Internal Plaster Only</option>
              <option value="none">No Plaster Estimate</option>
            </select>
          </div>
        </div>
      `;

      renderSteelInputsForSlab();
      break;

    case 'complete_house':
      titleEl.textContent = '3. Complete House Construction Estimator';
      descEl.textContent = 'Multi-storey building estimation based on Pakistani Marla/Kanal plot footprints or custom covered area.';

      html = `
        <div class="form-grid grid-3">
          <div class="form-group">
            <label for="housePlotPreset">Standard Plot Preset</label>
            <select id="housePlotPreset" class="form-control">
              <option value="3_marla">3 Marla (675 sq ft / 62.7 m²)</option>
              <option value="5_marla" selected>5 Marla (1,125 sq ft / 104.5 m²)</option>
              <option value="7_marla">7 Marla (1,575 sq ft / 146.3 m²)</option>
              <option value="10_marla">10 Marla (2,250 sq ft / 209 m²)</option>
              <option value="1_kanal">1 Kanal (4,500 sq ft / 418 m²)</option>
              <option value="custom">Custom Covered Area</option>
            </select>
          </div>
          <div class="form-group">
            <label for="houseStoreys">Number of Storeys</label>
            <select id="houseStoreys" class="form-control">
              <option value="1">Single Storey (Ground Floor only)</option>
              <option value="2" selected>Double Storey (G + 1st Floor)</option>
              <option value="3">Triple Storey (G + 1 + 2nd Floor)</option>
            </select>
          </div>
          <div class="form-group">
            <label for="houseCoveredArea">Total Covered Area (All Floors, sq ft) *</label>
            <input type="number" id="houseCoveredArea" class="form-control" step="10" min="100" value="1950" required>
            <span class="field-hint">e.g. 5 Marla double storey ~1,900 - 2,100 sq ft</span>
          </div>
        </div>

        <div class="form-grid grid-3 mt-3">
          <div class="form-group">
            <label for="houseQuality">Construction Specification</label>
            <select id="houseQuality" class="form-control">
              <option value="A_plus">A+ Premium Grade (Deformed Grade 60 steel, 1:1.5:3 slabs)</option>
              <option value="A" selected>A Quality Standard (Standard 9" brickwork, 1:2:4 RCC)</option>
              <option value="economy">Economy Standard</option>
            </select>
          </div>
          <div class="form-group">
            <label for="houseBoundaryWall">Include Boundary Wall</label>
            <select id="houseBoundaryWall" class="form-control">
              <option value="yes" selected>Yes (Standard front & side boundary)</option>
              <option value="no">No (Covered structure only)</option>
            </select>
          </div>
          <div class="form-group">
            <label for="houseFloorHeight">Average Story Height (${lenUnit})</label>
            <input type="number" id="houseFloorHeight" class="form-control" step="0.5" value="${isMetric ? '3.3' : '11.0'}">
          </div>
        </div>
      `;
      break;

    case 'boundary_wall':
      titleEl.textContent = '3. Boundary Wall Specifications';
      descEl.textContent = 'Perimeter walling with brickwork, foundation trench, RCC pillars/columns, and top coping.';
      if (openingsSec) openingsSec.style.display = 'block';

      html = `
        <div class="form-grid grid-3">
          <div class="form-group">
            <label for="boundLength">Total Perimeter Length (<span class="unit-len-label">${lenUnit}</span>) *</label>
            <input type="number" id="boundLength" class="form-control" step="0.5" min="1" value="${isMetric ? '30.0' : '100.0'}" required>
          </div>
          <div class="form-group">
            <label for="boundHeight">Wall Height Above Ground (<span class="unit-len-label">${lenUnit}</span>) *</label>
            <input type="number" id="boundHeight" class="form-control" step="0.1" min="0.5" value="${isMetric ? '2.1' : '7.0'}" required>
          </div>
          <div class="form-group">
            <label for="boundThickness">Wall Thickness</label>
            <select id="boundThickness" class="form-control">
              <option value="4.5">4.5 Inches (With Brick Pillars)</option>
              <option value="9.0" selected>9.0 Inches (Standard Solid Wall)</option>
              <option value="13.5">13.5 Inches</option>
            </select>
          </div>
        </div>

        <div class="form-grid grid-3 mt-3">
          <div class="form-group">
            <label for="boundPillars">Brick/RCC Pillars Spacing (${lenUnit})</label>
            <input type="number" id="boundPillars" class="form-control" step="1" value="${isMetric ? '3.0' : '10.0'}">
            <span class="field-hint">e.g. 13.5" × 13.5" stiffener pillars every 10 ft</span>
          </div>
          <div class="form-group">
            <label for="boundFoundDepth">Foundation Depth (${lenUnit})</label>
            <input type="number" id="boundFoundDepth" class="form-control" step="0.1" value="${isMetric ? '0.75' : '2.5'}">
          </div>
          <div class="form-group">
            <label for="boundMortar">Mortar Mix Ratio</label>
            <select id="boundMortar" class="form-control">
              <option value="1:4">1:4 Ratio</option>
              <option value="1:5">1:5 Ratio</option>
              <option value="1:6" selected>1:6 Ratio (Standard)</option>
            </select>
          </div>
        </div>
      `;
      break;

    case 'foundation':
      titleEl.textContent = '3. Foundation / Footing Specifications';
      descEl.textContent = 'Excavation trench, lean concrete PCC base (1:4:8), stepped brick masonry, or RCC pad footing.';
      if (steelSec) steelSec.style.display = 'block';

      html = `
        <div class="form-grid grid-3">
          <div class="form-group">
            <label for="foundTypeSelect">Foundation System</label>
            <select id="foundTypeSelect" class="form-control">
              <option value="strip_stepped" selected>Strip Footing (Trench + PCC + Stepped Bricks)</option>
              <option value="rcc_isolated">RCC Isolated Pad Footing</option>
              <option value="pcc_raft">Plain Raft / PCC Bedding</option>
            </select>
          </div>
          <div class="form-group">
            <label for="foundLength">Total Foundation Length (${lenUnit}) *</label>
            <input type="number" id="foundLength" class="form-control" step="0.5" min="1" value="${isMetric ? '25.0' : '80.0'}" required>
          </div>
          <div class="form-group">
            <label for="foundTrenchWidth">Trench Width (${lenUnit}) *</label>
            <input type="number" id="foundTrenchWidth" class="form-control" step="0.1" min="0.5" value="${isMetric ? '0.9' : '3.0'}" required>
          </div>
        </div>

        <div class="form-grid grid-3 mt-3">
          <div class="form-group">
            <label for="foundTrenchDepth">Trench Depth (${lenUnit}) *</label>
            <input type="number" id="foundTrenchDepth" class="form-control" step="0.1" min="0.5" value="${isMetric ? '1.0' : '3.5'}" required>
          </div>
          <div class="form-group">
            <label for="foundPccThick">PCC Lean Base Thickness (${thkUnit})</label>
            <input type="number" id="foundPccThick" class="form-control" step="0.5" value="${isMetric ? '150' : '6.0'}">
          </div>
          <div class="form-group">
            <label for="foundPccMix">PCC Mix Ratio</label>
            <select id="foundPccMix" class="form-control">
              <option value="1:4:8" selected>1:4:8 (Standard Lean Concrete Base)</option>
              <option value="1:3:6">1:3:6 (Stronger Base)</option>
              <option value="1:2:4">1:2:4 (Heavy Bedding)</option>
            </select>
          </div>
        </div>

        <div class="form-grid grid-2 mt-3" id="foundSteppedBricksRow">
          <div class="form-group">
            <label for="foundStepCourses">Number of Stepped Brick Courses</label>
            <input type="number" id="foundStepCourses" class="form-control" step="1" min="1" max="10" value="4">
            <span class="field-hint">e.g. 4 steps (22.5", 18", 13.5", 9" wide)</span>
          </div>
          <div class="form-group">
            <label for="foundBrickMortar">Foundation Brick Mortar Ratio</label>
            <select id="foundBrickMortar" class="form-control">
              <option value="1:4">1:4 Ratio</option>
              <option value="1:5">1:5 Ratio</option>
              <option value="1:6" selected>1:6 Ratio</option>
            </select>
          </div>
        </div>
      `;

      renderSteelInputsForFoundation();
      break;

    case 'roof_slab':
      titleEl.textContent = '3. Roof / RCC Slab Specifications';
      descEl.textContent = 'Calculate concrete mix (cement, sand, crush), water, and explicit 2-way reinforcement (sutar rebar).';
      if (steelSec) steelSec.style.display = 'block';

      html = `
        <div class="form-grid grid-3">
          <div class="form-group">
            <label for="slabLength">Slab Length (Span 1) (${lenUnit}) *</label>
            <input type="number" id="slabLength" class="form-control" step="0.1" min="1" value="${isMetric ? '6.0' : '20.0'}" required>
          </div>
          <div class="form-group">
            <label for="slabWidth">Slab Width (Span 2) (${lenUnit}) *</label>
            <input type="number" id="slabWidth" class="form-control" step="0.1" min="1" value="${isMetric ? '4.5' : '15.0'}" required>
          </div>
          <div class="form-group">
            <label for="slabThick">Slab Thickness (${thkUnit}) *</label>
            <input type="number" id="slabThick" class="form-control" step="0.25" min="1" value="${isMetric ? '150' : '6.0'}" required>
            <span class="field-hint">Residential slabs: 5" to 6" (125 - 150 mm)</span>
          </div>
        </div>

        <div class="form-grid grid-3 mt-3">
          <div class="form-group">
            <label for="slabCount">Number of Slabs</label>
            <input type="number" id="slabCount" class="form-control" step="1" min="1" value="1" required>
          </div>
          <div class="form-group">
            <label for="slabConcreteMix">Concrete Mix Ratio</label>
            <select id="slabConcreteMix" class="form-control">
              <option value="1:2:4" selected>1:2:4 (M15 - Standard Slab Concrete)</option>
              <option value="1:1.5:3">1:1.5:3 (M20 - High Strength Slab)</option>
              <option value="1:1:2">1:1:2 (M25 - Heavy Load / Commercial)</option>
            </select>
          </div>
          <div class="form-group">
            <label for="slabCover">Concrete Clear Cover (${thkUnit})</label>
            <input type="number" id="slabCover" class="form-control" step="0.1" value="${isMetric ? '20' : '0.75'}">
            <span class="field-hint">Standard slab cover is 0.75" (20 mm)</span>
          </div>
        </div>
      `;

      renderSteelInputsForSlab();
      break;

    case 'concrete_floor':
      titleEl.textContent = '3. Concrete Floor Specifications';
      descEl.textContent = 'Sub-base sand/gravel compaction, PCC base bedding, and top finish screed concrete.';
      if (steelSec) steelSec.style.display = 'block';

      html = `
        <div class="form-grid grid-3">
          <div class="form-group">
            <label for="floorLength">Floor Length (${lenUnit}) *</label>
            <input type="number" id="floorLength" class="form-control" step="0.1" min="1" value="${isMetric ? '6.0' : '20.0'}" required>
          </div>
          <div class="form-group">
            <label for="floorWidth">Floor Width (${lenUnit}) *</label>
            <input type="number" id="floorWidth" class="form-control" step="0.1" min="1" value="${isMetric ? '4.5' : '15.0'}" required>
          </div>
          <div class="form-group">
            <label for="floorSubBaseThick">Sub-base Sand/Kassu Layer (${thkUnit})</label>
            <input type="number" id="floorSubBaseThick" class="form-control" step="0.5" value="${isMetric ? '100' : '4.0'}">
          </div>
        </div>

        <div class="form-grid grid-3 mt-3">
          <div class="form-group">
            <label for="floorPccThick">PCC Base Concrete Thickness (${thkUnit}) *</label>
            <input type="number" id="floorPccThick" class="form-control" step="0.5" value="${isMetric ? '75' : '3.0'}" required>
          </div>
          <div class="form-group">
            <label for="floorPccMix">PCC Base Mix Ratio</label>
            <select id="floorPccMix" class="form-control">
              <option value="1:3:6" selected>1:3:6 (Standard Sub-floor Bed)</option>
              <option value="1:4:8">1:4:8 (Lean Concrete Bed)</option>
              <option value="1:2:4">1:2:4 (Heavy Duty Floor)</option>
            </select>
          </div>
          <div class="form-group">
            <label for="floorTopThick">Top Screed / Topping Thickness (${thkUnit})</label>
            <input type="number" id="floorTopThick" class="form-control" step="0.25" value="${isMetric ? '38' : '1.5'}">
          </div>
        </div>
      `;

      renderSteelInputsForFloor();
      break;

    case 'columns':
      titleEl.textContent = '3. Columns (RCC) Specifications';
      descEl.textContent = 'Reinforced concrete columns, vertical longitudinal sutar bars, and lateral ties/stirrups.';
      if (steelSec) steelSec.style.display = 'block';

      html = `
        <div class="form-grid grid-3">
          <div class="form-group">
            <label for="colCount">Number of Columns *</label>
            <input type="number" id="colCount" class="form-control" step="1" min="1" value="4" required>
          </div>
          <div class="form-group">
            <label for="colHeight">Column Height (${lenUnit}) *</label>
            <input type="number" id="colHeight" class="form-control" step="0.1" min="1" value="${isMetric ? '3.5' : '11.5'}" required>
            <span class="field-hint">Floor height + lap/anchorage embedment</span>
          </div>
          <div class="form-group">
            <label for="colConcreteMix">Concrete Mix Ratio</label>
            <select id="colConcreteMix" class="form-control">
              <option value="1:1.5:3" selected>1:1.5:3 (M20 Structural Columns)</option>
              <option value="1:2:4">1:2:4 (M15 General)</option>
              <option value="1:1:2">1:1:2 (M25 Heavy Load)</option>
            </select>
          </div>
        </div>

        <div class="form-grid grid-3 mt-3">
          <div class="form-group">
            <label for="colWidth">Cross-Section Width (${thkUnit}) *</label>
            <input type="number" id="colWidth" class="form-control" step="0.5" value="${isMetric ? '225' : '9.0'}" required>
          </div>
          <div class="form-group">
            <label for="colDepth">Cross-Section Depth (${thkUnit}) *</label>
            <input type="number" id="colDepth" class="form-control" step="0.5" value="${isMetric ? '300' : '12.0'}" required>
          </div>
          <div class="form-group">
            <label for="colCover">Clear Concrete Cover (${thkUnit})</label>
            <input type="number" id="colCover" class="form-control" step="0.1" value="${isMetric ? '40' : '1.5'}">
            <span class="field-hint">Columns require 1.5" (40 mm) cover</span>
          </div>
        </div>
      `;

      renderSteelInputsForColumn();
      break;

    case 'beams':
      titleEl.textContent = '3. Beams (RCC) Specifications';
      descEl.textContent = 'Plinth, lintel, or roof beams with longitudinal bars (top & bottom) and shear stirrups (rings).';
      if (steelSec) steelSec.style.display = 'block';

      html = `
        <div class="form-grid grid-3">
          <div class="form-group">
            <label for="beamCount">Number of Beams *</label>
            <input type="number" id="beamCount" class="form-control" step="1" min="1" value="2" required>
          </div>
          <div class="form-group">
            <label for="beamSpan">Beam Clear Span (${lenUnit}) *</label>
            <input type="number" id="beamSpan" class="form-control" step="0.5" min="1" value="${isMetric ? '5.0' : '16.0'}" required>
          </div>
          <div class="form-group">
            <label for="beamConcreteMix">Concrete Mix Ratio</label>
            <select id="beamConcreteMix" class="form-control">
              <option value="1:1.5:3" selected>1:1.5:3 (M20 Structural Beams)</option>
              <option value="1:2:4">1:2:4 (M15 General)</option>
            </select>
          </div>
        </div>

        <div class="form-grid grid-3 mt-3">
          <div class="form-group">
            <label for="beamWidth">Beam Width (${thkUnit}) *</label>
            <input type="number" id="beamWidth" class="form-control" step="0.5" value="${isMetric ? '225' : '9.0'}" required>
          </div>
          <div class="form-group">
            <label for="beamDepth">Beam Overall Depth (${thkUnit}) *</label>
            <input type="number" id="beamDepth" class="form-control" step="0.5" value="${isMetric ? '380' : '15.0'}" required>
          </div>
          <div class="form-group">
            <label for="beamCover">Clear Concrete Cover (${thkUnit})</label>
            <input type="number" id="beamCover" class="form-control" step="0.1" value="${isMetric ? '25' : '1.0'}">
          </div>
        </div>
      `;

      renderSteelInputsForBeam();
      break;

    case 'plastering':
      titleEl.textContent = '3. Plastering Specifications';
      descEl.textContent = 'Internal or external wall plastering with opening deductions and surface roughness factors.';
      if (openingsSec) openingsSec.style.display = 'block';

      html = `
        <div class="form-grid grid-3">
          <div class="form-group">
            <label for="plasterLength">Total Wall Length (${lenUnit}) *</label>
            <input type="number" id="plasterLength" class="form-control" step="0.5" min="1" value="${isMetric ? '10.0' : '30.0'}" required>
          </div>
          <div class="form-group">
            <label for="plasterHeight">Wall Height (${lenUnit}) *</label>
            <input type="number" id="plasterHeight" class="form-control" step="0.1" min="1" value="${isMetric ? '3.2' : '10.5'}" required>
          </div>
          <div class="form-group">
            <label for="plasterFaces">Wall Faces to Plaster</label>
            <select id="plasterFaces" class="form-control">
              <option value="1" selected>1 Face Only (e.g. Internal side)</option>
              <option value="2">2 Faces (Both Internal & External)</option>
            </select>
          </div>
        </div>

        <div class="form-grid grid-3 mt-3">
          <div class="form-group">
            <label for="plasterThick">Plaster Thickness (${thkUnit}) *</label>
            <input type="number" id="plasterThick" class="form-control" step="0.1" value="${isMetric ? '13' : '0.5'}" required>
            <span class="field-hint">Standard internal: 1/2" (12.7 mm); external: 3/4" (19 mm)</span>
          </div>
          <div class="form-group">
            <label for="plasterRatio">Mortar Ratio (Cement : Sand)</label>
            <select id="plasterRatio" class="form-control">
              <option value="1:3">1:3 (Damp Proof / Waterproof)</option>
              <option value="1:4" selected>1:4 (Standard Internal Plaster)</option>
              <option value="1:5">1:5 (Standard External Plaster)</option>
              <option value="1:6">1:6 (Economy Plaster)</option>
            </select>
          </div>
          <div class="form-group">
            <label for="plasterUnevenFactor">Joint Fill & Roughness Allowance</label>
            <div class="input-with-addon">
              <input type="number" id="plasterUnevenFactor" class="form-control" min="5" max="30" value="20">
              <span class="input-addon">%</span>
            </div>
            <span class="field-hint">Civil standard: 20% extra for masonry joints</span>
          </div>
        </div>
      `;
      break;

    case 'brick_masonry':
      titleEl.textContent = '3. Direct Brick Masonry Specifications';
      descEl.textContent = 'Direct volume-based brick and mortar calculation for walls, wells, piers, or retaining work.';

      html = `
        <div class="form-grid grid-2">
          <div class="form-group">
            <label for="masonryMode">Input Method</label>
            <select id="masonryMode" class="form-control" onchange="toggleMasonryMode(this.value)">
              <option value="dimensions" selected>Enter Dimensions (L × W × H)</option>
              <option value="direct_volume">Direct Volume (${isMetric ? 'm³' : 'CFT'})</option>
            </select>
          </div>
          <div class="form-group">
            <label for="masonryMortarRatio">Mortar Mix Ratio</label>
            <select id="masonryMortarRatio" class="form-control">
              <option value="1:3">1:3 Ratio</option>
              <option value="1:4">1:4 Ratio</option>
              <option value="1:5">1:5 Ratio</option>
              <option value="1:6" selected>1:6 Ratio (Standard)</option>
              <option value="1:7">1:7 Ratio</option>
            </select>
          </div>
        </div>

        <div class="form-grid grid-3 mt-3" id="masonryDimsGrid">
          <div class="form-group">
            <label for="masLength">Length (${lenUnit})</label>
            <input type="number" id="masLength" class="form-control" step="0.5" value="${isMetric ? '6.0' : '20.0'}">
          </div>
          <div class="form-group">
            <label for="masWidth">Width / Thickness (${lenUnit})</label>
            <input type="number" id="masWidth" class="form-control" step="0.1" value="${isMetric ? '0.228' : '0.75'}">
          </div>
          <div class="form-group">
            <label for="masHeight">Height (${lenUnit})</label>
            <input type="number" id="masHeight" class="form-control" step="0.5" value="${isMetric ? '3.0' : '10.0'}">
          </div>
        </div>

        <div class="form-group mt-3" id="masonryDirectVolGrid" style="display: none;">
          <label for="masDirectVol">Total Brickwork Volume (${isMetric ? 'm³' : 'CFT'}) *</label>
          <input type="number" id="masDirectVol" class="form-control" step="1" value="${isMetric ? '10' : '350'}">
        </div>
      `;
      break;

    case 'pcc':
      titleEl.textContent = '3. PCC (Plain Cement Concrete) Specifications';
      descEl.textContent = 'Plain unreinforced concrete for beddings, aprons, copings, sub-floors, and mass gravity works.';

      html = `
        <div class="form-grid grid-3">
          <div class="form-group">
            <label for="pccLength">Length (${lenUnit}) *</label>
            <input type="number" id="pccLength" class="form-control" step="0.5" min="0.5" value="${isMetric ? '5.0' : '15.0'}" required>
          </div>
          <div class="form-group">
            <label for="pccWidth">Width (${lenUnit}) *</label>
            <input type="number" id="pccWidth" class="form-control" step="0.5" min="0.5" value="${isMetric ? '3.0' : '10.0'}" required>
          </div>
          <div class="form-group">
            <label for="pccThick">Thickness / Depth (${thkUnit}) *</label>
            <input type="number" id="pccThick" class="form-control" step="0.5" min="0.5" value="${isMetric ? '100' : '4.0'}" required>
          </div>
        </div>

        <div class="form-grid grid-3 mt-3">
          <div class="form-group">
            <label for="pccCount">Number of Identical Sections</label>
            <input type="number" id="pccCount" class="form-control" step="1" min="1" value="1" required>
          </div>
          <div class="form-group">
            <label for="pccMixRatio">Nominal Mix Ratio *</label>
            <select id="pccMixRatio" class="form-control">
              <option value="1:4:8">1:4:8 (Lean Concrete M7.5)</option>
              <option value="1:3:6" selected>1:3:6 (Standard PCC Bedding M10)</option>
              <option value="1:2:4">1:2:4 (High Strength Plain Concrete M15)</option>
            </select>
          </div>
          <div class="form-group">
            <label for="pccDryFactor">Dry Volume Conversion Factor</label>
            <input type="number" id="pccDryFactor" class="form-control" step="0.01" value="1.54">
            <span class="field-hint">Civil standard: 1.54 (54% dry void allowance)</span>
          </div>
        </div>
      `;
      break;

    case 'rcc':
      titleEl.textContent = '3. RCC (Reinforced Concrete) General Specifications';
      descEl.textContent = 'Reinforced concrete calculation supporting detailed rebar or standard civil structural steel % rule.';
      if (steelSec) steelSec.style.display = 'block';

      html = `
        <div class="form-grid grid-3">
          <div class="form-group">
            <label for="rccLength">Length (${lenUnit}) *</label>
            <input type="number" id="rccLength" class="form-control" step="0.5" min="0.5" value="${isMetric ? '6.0' : '20.0'}" required>
          </div>
          <div class="form-group">
            <label for="rccWidth">Width (${lenUnit}) *</label>
            <input type="number" id="rccWidth" class="form-control" step="0.5" min="0.5" value="${isMetric ? '4.0' : '12.0'}" required>
          </div>
          <div class="form-group">
            <label for="rccThick">Thickness / Depth (${thkUnit}) *</label>
            <input type="number" id="rccThick" class="form-control" step="0.5" min="0.5" value="${isMetric ? '150' : '6.0'}" required>
          </div>
        </div>

        <div class="form-grid grid-3 mt-3">
          <div class="form-group">
            <label for="rccMixRatio">Concrete Mix Ratio</label>
            <select id="rccMixRatio" class="form-control">
              <option value="1:1:2">1:1:2 (M25 High Strength)</option>
              <option value="1:1.5:3" selected>1:1.5:3 (M20 Standard Structural)</option>
              <option value="1:2:4">1:2:4 (M15 Standard)</option>
            </select>
          </div>
          <div class="form-group">
            <label for="rccSteelMethod">Steel Calculation Method</label>
            <select id="rccSteelMethod" class="form-control" onchange="toggleRccSteelMethod(this.value)">
              <option value="percentage" selected>Civil Engineering % Rule of Thumb</option>
              <option value="detailed">Explicit Rebar Sutar & Spacing</option>
            </select>
          </div>
          <div class="form-group" id="rccPercentGroup">
            <label for="rccSteelPercent">Steel Ratio (% of Concrete Volume)</label>
            <div class="input-with-addon">
              <input type="number" id="rccSteelPercent" class="form-control" step="0.1" min="0.2" max="5.0" value="1.0">
              <span class="input-addon">%</span>
            </div>
            <span class="field-hint">Slabs: ~0.8%, Beams: 1.2-1.8%, Columns: 1.5-2.5%</span>
          </div>
        </div>
      `;

      renderSteelInputsForRccGeneral();
      break;

    case 'staircase':
      titleEl.textContent = '3. Staircase (RCC) Specifications';
      descEl.textContent = 'Waist slab, risers, treads, landing, and main/cross rebar for standard RCC dog-legged or straight flight.';
      if (steelSec) steelSec.style.display = 'block';

      html = `
        <div class="form-grid grid-3">
          <div class="form-group">
            <label for="stairFlightLength">Waist Slab Inclined Length (${lenUnit}) *</label>
            <input type="number" id="stairFlightLength" class="form-control" step="0.5" min="1" value="${isMetric ? '3.5' : '11.5'}" required>
          </div>
          <div class="form-group">
            <label for="stairWidth">Stair Width (${lenUnit}) *</label>
            <input type="number" id="stairWidth" class="form-control" step="0.25" min="0.5" value="${isMetric ? '1.0' : '3.5'}" required>
          </div>
          <div class="form-group">
            <label for="stairWaistThick">Waist Slab Thickness (${thkUnit}) *</label>
            <input type="number" id="stairWaistThick" class="form-control" step="0.5" value="${isMetric ? '150' : '6.0'}" required>
          </div>
        </div>

        <div class="form-grid grid-3 mt-3">
          <div class="form-group">
            <label for="stairStepsCount">Number of Steps (Risers) *</label>
            <input type="number" id="stairStepsCount" class="form-control" step="1" min="1" value="10" required>
          </div>
          <div class="form-group">
            <label for="stairRiser">Riser Height (${thkUnit})</label>
            <input type="number" id="stairRiser" class="form-control" step="0.25" value="${isMetric ? '175' : '7.0'}">
          </div>
          <div class="form-group">
            <label for="stairTread">Tread Width (${thkUnit})</label>
            <input type="number" id="stairTread" class="form-control" step="0.5" value="${isMetric ? '250' : '10.0'}">
          </div>
        </div>

        <div class="form-grid grid-2 mt-3">
          <div class="form-group">
            <label for="stairLandingLength">Landing Length (${lenUnit})</label>
            <input type="number" id="stairLandingLength" class="form-control" step="0.25" value="${isMetric ? '1.0' : '3.5'}">
          </div>
          <div class="form-group">
            <label for="stairConcreteMix">Concrete Mix Ratio</label>
            <select id="stairConcreteMix" class="form-control">
              <option value="1:2:4" selected>1:2:4 (M15 Standard)</option>
              <option value="1:1.5:3">1:1.5:3 (M20 High Strength)</option>
            </select>
          </div>
        </div>
      `;

      renderSteelInputsForStairs();
      break;

    case 'custom':
      titleEl.textContent = '3. Custom Construction Specifications';
      descEl.textContent = 'User-defined arbitrary dimensions or direct volume with customizable cement, sand, aggregate ratios.';

      html = `
        <div class="form-grid grid-3">
          <div class="form-group">
            <label for="customLength">Length (${lenUnit})</label>
            <input type="number" id="customLength" class="form-control" step="0.5" value="${isMetric ? '5.0' : '15.0'}">
          </div>
          <div class="form-group">
            <label for="customWidth">Width (${lenUnit})</label>
            <input type="number" id="customWidth" class="form-control" step="0.5" value="${isMetric ? '3.0' : '10.0'}">
          </div>
          <div class="form-group">
            <label for="customDepth">Height / Depth (${lenUnit})</label>
            <input type="number" id="customDepth" class="form-control" step="0.5" value="${isMetric ? '1.0' : '3.0'}">
          </div>
        </div>

        <div class="form-grid grid-4 mt-3">
          <div class="form-group">
            <label for="customPartC">Cement Part</label>
            <input type="number" id="customPartC" class="form-control" step="0.5" min="0" value="1">
          </div>
          <div class="form-group">
            <label for="customPartS">Sand Part</label>
            <input type="number" id="customPartS" class="form-control" step="0.5" min="0" value="2">
          </div>
          <div class="form-group">
            <label for="customPartA">Crush / Aggregate Part</label>
            <input type="number" id="customPartA" class="form-control" step="0.5" min="0" value="4">
          </div>
          <div class="form-group">
            <label for="customDryFactor">Dry Volume Factor</label>
            <input type="number" id="customDryFactor" class="form-control" step="0.01" value="1.54">
          </div>
        </div>
      `;
      break;

    default:
      html = '<p class="text-muted">Please select a construction type from above.</p>';
      break;
  }

  container.innerHTML = html;

  // Bind dynamic event listeners within generated form
  bindDynamicEvents(type);
}

function bindDynamicEvents(type) {
  if (type === 'brick_wall') {
    const thickSelect = document.getElementById('wallThicknessSelect');
    const customGroup = document.getElementById('customThicknessGroup');
    const brickSelect = document.getElementById('brickSizeSelect');
    const customDims = document.getElementById('customBrickDimsRow');

    if (thickSelect && customGroup) {
      thickSelect.addEventListener('change', () => {
        customGroup.style.display = thickSelect.value === 'custom' ? 'block' : 'none';
      });
    }

    if (brickSelect && customDims) {
      brickSelect.addEventListener('change', () => {
        customDims.style.display = brickSelect.value === 'custom' ? 'grid' : 'none';
      });
    }
  }

  if (type === 'complete_house') {
    const preset = document.getElementById('housePlotPreset');
    const covered = document.getElementById('houseCoveredArea');
    const storeys = document.getElementById('houseStoreys');
    if (preset && covered && storeys) {
      const updateArea = () => {
        const p = preset.value;
        const s = parseInt(storeys.value) || 2;
        let baseFootprint = 1000;
        if (p === '3_marla') baseFootprint = 600;
        else if (p === '5_marla') baseFootprint = 1000;
        else if (p === '7_marla') baseFootprint = 1400;
        else if (p === '10_marla') baseFootprint = 2000;
        else if (p === '1_kanal') baseFootprint = 3800;

        if (p !== 'custom') {
          covered.value = baseFootprint * (s === 1 ? 1 : (s === 2 ? 1.9 : 2.7));
        }
      };
      preset.addEventListener('change', updateArea);
      storeys.addEventListener('change', updateArea);
    }
  }
}

window.toggleMasonryMode = function(mode) {
  const dimsGrid = document.getElementById('masonryDimsGrid');
  const directGrid = document.getElementById('masonryDirectVolGrid');
  if (dimsGrid && directGrid) {
    if (mode === 'direct_volume') {
      dimsGrid.style.display = 'none';
      directGrid.style.display = 'block';
    } else {
      dimsGrid.style.display = 'grid';
      directGrid.style.display = 'none';
    }
  }
};

window.toggleRccSteelMethod = function(method) {
  const percentGrp = document.getElementById('rccPercentGroup');
  const steelSec = document.getElementById('steelDetailSection');
  if (percentGrp) {
    percentGrp.style.display = method === 'percentage' ? 'block' : 'none';
  }
  if (steelSec) {
    steelSec.style.display = method === 'detailed' ? 'block' : 'none';
  }
};

/* ============================================================================
   5. STEEL DETAIL TEMPLATES & SUTAR LOGIC
   ============================================================================ */

function renderSteelInputsForSlab() {
  const grid = document.getElementById('steelInputsGrid');
  if (!grid) return;
  const isMetric = appState.unitSystem === 'metric';
  const spacingUnit = isMetric ? 'mm' : 'in';

  grid.innerHTML = `
    <div class="form-group">
      <label for="slabMainSutar">Main Bars Trade Size (Sutar)</label>
      <select id="slabMainSutar" class="form-control" onchange="syncSutarMm('slabMainSutar', 'slabMainMm')">
        <option value="3_sutar">3 Sutar (3/8" ≈ 9.5 mm / #3)</option>
        <option value="4_sutar" selected>4 Sutar (1/2" ≈ 12.7 mm / #4)</option>
        <option value="5_sutar">5 Sutar (5/8" ≈ 15.8 mm / #5)</option>
        <option value="custom">Custom mm Diameter</option>
      </select>
    </div>

    <div class="form-group">
      <label for="slabMainMm">Main Bar Diameter (Confirmed mm) *</label>
      <input type="number" id="slabMainMm" class="form-control" step="0.1" value="12.7" required>
      <span class="field-hint">Verify actual site caliper bar diameter</span>
    </div>

    <div class="form-group">
      <label for="slabMainSpacing">Main Bars Spacing c/c (${spacingUnit}) *</label>
      <input type="number" id="slabMainSpacing" class="form-control" step="0.5" value="${isMetric ? '150' : '6.0'}" required>
    </div>

    <div class="form-group">
      <label for="slabDistSutar">Distribution Bars Trade Size</label>
      <select id="slabDistSutar" class="form-control" onchange="syncSutarMm('slabDistSutar', 'slabDistMm')">
        <option value="3_sutar" selected>3 Sutar (3/8" ≈ 9.5 mm / #3)</option>
        <option value="4_sutar">4 Sutar (1/2" ≈ 12.7 mm / #4)</option>
        <option value="custom">Custom mm Diameter</option>
      </select>
    </div>

    <div class="form-group">
      <label for="slabDistMm">Distribution Bar (Confirmed mm) *</label>
      <input type="number" id="slabDistMm" class="form-control" step="0.1" value="9.5" required>
    </div>

    <div class="form-group">
      <label for="slabDistSpacing">Distribution Spacing c/c (${spacingUnit}) *</label>
      <input type="number" id="slabDistSpacing" class="form-control" step="0.5" value="${isMetric ? '200' : '8.0'}" required>
    </div>
  `;
}

function renderSteelInputsForFoundation() {
  const grid = document.getElementById('steelInputsGrid');
  if (!grid) return;
  const isMetric = appState.unitSystem === 'metric';
  const spacingUnit = isMetric ? 'mm' : 'in';

  grid.innerHTML = `
    <div class="form-group">
      <label for="foundSteelSutar">Footing Mesh Sutar Size</label>
      <select id="foundSteelSutar" class="form-control" onchange="syncSutarMm('foundSteelSutar', 'foundSteelMm')">
        <option value="4_sutar" selected>4 Sutar (1/2" ≈ 12.7 mm)</option>
        <option value="5_sutar">5 Sutar (5/8" ≈ 15.8 mm)</option>
      </select>
    </div>
    <div class="form-group">
      <label for="foundSteelMm">Mesh Bar Diameter (Confirmed mm)</label>
      <input type="number" id="foundSteelMm" class="form-control" step="0.1" value="12.7">
    </div>
    <div class="form-group">
      <label for="foundSteelSpacing">Mesh Spacing c/c (${spacingUnit})</label>
      <input type="number" id="foundSteelSpacing" class="form-control" step="0.5" value="${isMetric ? '150' : '6.0'}">
    </div>
  `;
}

function renderSteelInputsForFloor() {
  const grid = document.getElementById('steelInputsGrid');
  if (!grid) return;
  const isMetric = appState.unitSystem === 'metric';
  const spacingUnit = isMetric ? 'mm' : 'in';

  grid.innerHTML = `
    <div class="form-group">
      <label for="floorSteelOption">Reinforcement Mesh in Floor</label>
      <select id="floorSteelOption" class="form-control">
        <option value="none">No Steel (Plain PCC 1:3:6)</option>
        <option value="mesh_3_sutar" selected>3 Sutar Light Anti-Crack Mesh</option>
      </select>
    </div>
    <div class="form-group">
      <label for="floorMeshSpacing">Mesh Grid Spacing (${spacingUnit})</label>
      <input type="number" id="floorMeshSpacing" class="form-control" step="1" value="${isMetric ? '200' : '8.0'}">
    </div>
  `;
}

function renderSteelInputsForColumn() {
  const grid = document.getElementById('steelInputsGrid');
  if (!grid) return;
  const isMetric = appState.unitSystem === 'metric';
  const spacingUnit = isMetric ? 'mm' : 'in';

  grid.innerHTML = `
    <div class="form-group">
      <label for="colMainSutar">Main Vertical Bars (Sutar)</label>
      <select id="colMainSutar" class="form-control" onchange="syncSutarMm('colMainSutar', 'colMainMm')">
        <option value="4_sutar">4 Sutar (1/2" ≈ 12.7 mm)</option>
        <option value="5_sutar" selected>5 Sutar (5/8" ≈ 15.8 mm)</option>
        <option value="6_sutar">6 Sutar (3/4" ≈ 19.0 mm)</option>
        <option value="8_sutar">8 Sutar (1" ≈ 25.4 mm)</option>
      </select>
    </div>
    <div class="form-group">
      <label for="colMainMm">Main Bar Diameter (Confirmed mm)</label>
      <input type="number" id="colMainMm" class="form-control" step="0.1" value="15.8">
    </div>
    <div class="form-group">
      <label for="colMainCount">Vertical Bars per Column</label>
      <input type="number" id="colMainCount" class="form-control" step="1" min="4" value="4">
      <span class="field-hint">e.g. 4 bars (corners) or 6/8 bars</span>
    </div>

    <div class="form-group">
      <label for="colTieSutar">Lateral Ties / Rings (Sutar)</label>
      <select id="colTieSutar" class="form-control" onchange="syncSutarMm('colTieSutar', 'colTieMm')">
        <option value="3_sutar" selected>3 Sutar (3/8" ≈ 9.5 mm)</option>
        <option value="4_sutar">4 Sutar (1/2" ≈ 12.7 mm)</option>
      </select>
    </div>
    <div class="form-group">
      <label for="colTieMm">Tie Bar Diameter (Confirmed mm)</label>
      <input type="number" id="colTieMm" class="form-control" step="0.1" value="9.5">
    </div>
    <div class="form-group">
      <label for="colTieSpacing">Tie Ring Spacing c/c (${spacingUnit})</label>
      <input type="number" id="colTieSpacing" class="form-control" step="0.5" value="${isMetric ? '175' : '7.0'}">
    </div>
  `;
}

function renderSteelInputsForBeam() {
  const grid = document.getElementById('steelInputsGrid');
  if (!grid) return;
  const isMetric = appState.unitSystem === 'metric';
  const spacingUnit = isMetric ? 'mm' : 'in';

  grid.innerHTML = `
    <div class="form-group">
      <label for="beamBottomSutar">Bottom Tension Bars (Sutar)</label>
      <select id="beamBottomSutar" class="form-control" onchange="syncSutarMm('beamBottomSutar', 'beamBottomMm')">
        <option value="4_sutar">4 Sutar (1/2" ≈ 12.7 mm)</option>
        <option value="5_sutar" selected>5 Sutar (5/8" ≈ 15.8 mm)</option>
        <option value="6_sutar">6 Sutar (3/4" ≈ 19.0 mm)</option>
      </select>
    </div>
    <div class="form-group">
      <label for="beamBottomMm">Bottom Bar (Confirmed mm)</label>
      <input type="number" id="beamBottomMm" class="form-control" step="0.1" value="15.8">
    </div>
    <div class="form-group">
      <label for="beamBottomCount">Bottom Bars Count per Beam</label>
      <input type="number" id="beamBottomCount" class="form-control" step="1" min="2" value="3">
    </div>

    <div class="form-group">
      <label for="beamTopSutar">Top Hanger Bars (Sutar)</label>
      <select id="beamTopSutar" class="form-control" onchange="syncSutarMm('beamTopSutar', 'beamTopMm')">
        <option value="3_sutar">3 Sutar (3/8" ≈ 9.5 mm)</option>
        <option value="4_sutar" selected>4 Sutar (1/2" ≈ 12.7 mm)</option>
      </select>
    </div>
    <div class="form-group">
      <label for="beamTopMm">Top Bar (Confirmed mm)</label>
      <input type="number" id="beamTopMm" class="form-control" step="0.1" value="12.7">
    </div>
    <div class="form-group">
      <label for="beamTopCount">Top Bars Count per Beam</label>
      <input type="number" id="beamTopCount" class="form-control" step="1" min="2" value="2">
    </div>

    <div class="form-group">
      <label for="beamStirrupSutar">Shear Stirrups / Rings (Sutar)</label>
      <select id="beamStirrupSutar" class="form-control" onchange="syncSutarMm('beamStirrupSutar', 'beamStirrupMm')">
        <option value="3_sutar" selected>3 Sutar (3/8" ≈ 9.5 mm)</option>
        <option value="4_sutar">4 Sutar (1/2" ≈ 12.7 mm)</option>
      </select>
    </div>
    <div class="form-group">
      <label for="beamStirrupMm">Stirrup Bar (Confirmed mm)</label>
      <input type="number" id="beamStirrupMm" class="form-control" step="0.1" value="9.5">
    </div>
    <div class="form-group">
      <label for="beamStirrupSpacing">Stirrup Spacing c/c (${spacingUnit})</label>
      <input type="number" id="beamStirrupSpacing" class="form-control" step="0.5" value="${isMetric ? '150' : '6.0'}">
    </div>
  `;
}

function renderSteelInputsForRccGeneral() {
  renderSteelInputsForSlab();
}

function renderSteelInputsForStairs() {
  const grid = document.getElementById('steelInputsGrid');
  if (!grid) return;
  const isMetric = appState.unitSystem === 'metric';
  const spacingUnit = isMetric ? 'mm' : 'in';

  grid.innerHTML = `
    <div class="form-group">
      <label for="stairMainSutar">Waist Slab Main Bars (Sutar)</label>
      <select id="stairMainSutar" class="form-control" onchange="syncSutarMm('stairMainSutar', 'stairMainMm')">
        <option value="4_sutar" selected>4 Sutar (1/2" ≈ 12.7 mm)</option>
        <option value="5_sutar">5 Sutar (5/8" ≈ 15.8 mm)</option>
      </select>
    </div>
    <div class="form-group">
      <label for="stairMainMm">Main Bar (Confirmed mm)</label>
      <input type="number" id="stairMainMm" class="form-control" step="0.1" value="12.7">
    </div>
    <div class="form-group">
      <label for="stairMainSpacing">Main Bars Spacing (${spacingUnit})</label>
      <input type="number" id="stairMainSpacing" class="form-control" step="0.5" value="${isMetric ? '150' : '6.0'}">
    </div>

    <div class="form-group">
      <label for="stairDistSutar">Distribution Bars (Sutar)</label>
      <select id="stairDistSutar" class="form-control" onchange="syncSutarMm('stairDistSutar', 'stairDistMm')">
        <option value="3_sutar" selected>3 Sutar (3/8" ≈ 9.5 mm)</option>
        <option value="4_sutar">4 Sutar (1/2" ≈ 12.7 mm)</option>
      </select>
    </div>
    <div class="form-group">
      <label for="stairDistMm">Distribution Bar (Confirmed mm)</label>
      <input type="number" id="stairDistMm" class="form-control" step="0.1" value="9.5">
    </div>
    <div class="form-group">
      <label for="stairDistSpacing">Distribution Spacing (${spacingUnit})</label>
      <input type="number" id="stairDistSpacing" class="form-control" step="0.5" value="${isMetric ? '200' : '8.0'}">
    </div>
  `;
}

window.syncSutarMm = function(selectId, mmInputId) {
  const sel = document.getElementById(selectId);
  const inp = document.getElementById(mmInputId);
  if (!sel || !inp) return;
  const key = sel.value;
  if (SUTAR_MAP[key]) {
    inp.value = SUTAR_MAP[key].mm.toFixed(1);
  }
};

/* ============================================================================
   6. CALCULATION ENGINE - CORE FUNCTIONS
   ============================================================================ */

/**
 * Validates inputs before running calculations
 */
function validateInputs() {
  const errors = [];
  const wastageInput = document.getElementById('wastageAllowance');
  if (wastageInput) {
    const w = parseFloat(wastageInput.value);
    if (isNaN(w) || w < 0 || w > 30) {
      errors.push('Wastage allowance must be between 0% and 30%.');
    }
  }

  // Type specific validation
  const type = appState.activeType;
  if (type === 'brick_wall') {
    const len = parseFloat(document.getElementById('wallLength')?.value);
    const hgt = parseFloat(document.getElementById('wallHeight')?.value);
    const wallCount = parseInt(document.getElementById('wallCount')?.value) || 1;
    if (!len || len <= 0) errors.push('Wall length must be greater than zero.');
    if (!hgt || hgt <= 0) errors.push('Wall height must be greater than zero.');

    const isMetric = appState.unitSystem === 'metric';
    const grossAreaM2 = isMetric ? (len * hgt * wallCount) : (len * hgt * wallCount * 0.092903);
    const openingsAreaM2 = getTotalOpeningsAreaM2();
    if (openingsAreaM2 >= grossAreaM2) {
      errors.push(`Total openings area (${(isMetric ? openingsAreaM2 : openingsAreaM2 * 10.7639).toFixed(1)} ${isMetric ? 'm²' : 'sq.ft'}) exceeds or equals the gross wall area (${(isMetric ? grossAreaM2 : grossAreaM2 * 10.7639).toFixed(1)}). Please verify dimensions.`);
    }
  }

  if (type === 'roof_slab') {
    const l = parseFloat(document.getElementById('slabLength')?.value);
    const w = parseFloat(document.getElementById('slabWidth')?.value);
    const t = parseFloat(document.getElementById('slabThick')?.value);
    if (!l || l <= 0) errors.push('Slab length must be greater than zero.');
    if (!w || w <= 0) errors.push('Slab width must be greater than zero.');
    if (!t || t <= 0) errors.push('Slab thickness must be greater than zero.');
  }

  return errors;
}

/**
 * Main Controller: calculate current project based on active type
 */
function calculateCurrentProject() {
  const errors = validateInputs();
  if (errors.length > 0) {
    alert('Please correct the following errors:\n• ' + errors.join('\n• '));
    return;
  }

  const wastagePct = parseFloat(document.getElementById('wastageAllowance')?.value) || 5.0;
  const wastageMultiplier = 1.0 + (wastagePct / 100.0);

  let result = null;

  switch (appState.activeType) {
    case 'brick_wall':
      result = calculateWallMaterials(wastageMultiplier, wastagePct);
      break;
    case 'room':
      result = calculateRoomMaterials(wastageMultiplier, wastagePct);
      break;
    case 'complete_house':
      result = calculateHouseMaterials(wastageMultiplier, wastagePct);
      break;
    case 'boundary_wall':
      result = calculateBoundaryWallMaterials(wastageMultiplier, wastagePct);
      break;
    case 'foundation':
      result = calculateFoundationMaterials(wastageMultiplier, wastagePct);
      break;
    case 'roof_slab':
      result = calculateRoofSlabMaterials(wastageMultiplier, wastagePct);
      break;
    case 'concrete_floor':
      result = calculateFloorMaterials(wastageMultiplier, wastagePct);
      break;
    case 'columns':
      result = calculateColumnMaterials(wastageMultiplier, wastagePct);
      break;
    case 'beams':
      result = calculateBeamMaterials(wastageMultiplier, wastagePct);
      break;
    case 'plastering':
      result = calculatePlasterMaterials(wastageMultiplier, wastagePct);
      break;
    case 'brick_masonry':
      result = calculateBrickMasonryDirect(wastageMultiplier, wastagePct);
      break;
    case 'pcc':
      result = calculatePccMaterials(wastageMultiplier, wastagePct);
      break;
    case 'rcc':
      result = calculateRccGeneralMaterials(wastageMultiplier, wastagePct);
      break;
    case 'staircase':
      result = calculateStaircaseMaterials(wastageMultiplier, wastagePct);
      break;
    case 'custom':
      result = calculateCustomMaterials(wastageMultiplier, wastagePct);
      break;
  }

  if (result) {
    // Attach costs
    result = calculateTotalCost(result);
    // Generate narrative
    result.narrative = generateResultDescription(result);
    // Cache
    appState.lastResult = result;
    // Render
    renderResults(result);
  }
}

/**
 * 6.A Brick Wall Calculator
 */
function calculateWallMaterials(wastageMultiplier, wastagePct) {
  const isMetric = appState.unitSystem === 'metric';
  const lenRaw = parseFloat(document.getElementById('wallLength')?.value) || 0;
  const hgtRaw = parseFloat(document.getElementById('wallHeight')?.value) || 0;
  const wallCount = parseInt(document.getElementById('wallCount')?.value) || 1;

  // Length in meters
  const lenM = convertToMeters(lenRaw, isMetric ? 'm' : 'ft');
  const hgtM = convertToMeters(hgtRaw, isMetric ? 'm' : 'ft');

  // Thickness in meters
  let thickM = 0.2286; // default 9 inches
  const thickChoice = document.getElementById('wallThicknessSelect')?.value;
  if (thickChoice === '4.5') thickM = 0.1143;
  else if (thickChoice === '9.0') thickM = 0.2286;
  else if (thickChoice === '13.5') thickM = 0.3429;
  else if (thickChoice === 'custom') {
    const customThick = parseFloat(document.getElementById('customWallThickness')?.value) || 9.0;
    thickM = convertToMeters(customThick, isMetric ? 'mm' : 'in');
  }

  // Areas
  const singleGrossAreaM2 = lenM * hgtM;
  const totalGrossAreaM2 = singleGrossAreaM2 * wallCount;
  const openingsAreaM2 = getTotalOpeningsAreaM2();
  const netAreaM2 = Math.max(0, totalGrossAreaM2 - openingsAreaM2);
  const wallVolumeM3 = netAreaM2 * thickM;

  // Brick calculation
  const brickCalc = calculateBrickQuantity(wallVolumeM3);

  // Mortar calculation
  const mortarRatioKey = document.getElementById('mortarRatioSelect')?.value || '1:6';
  const mortarCalc = calculateMortarMaterials(brickCalc.wetMortarM3, mortarRatioKey);

  // Bill of materials
  const items = [
    {
      name: 'Bricks',
      description: 'First-Class burnt clay standard bricks',
      netQty: brickCalc.netBricks,
      wastagePct: wastagePct,
      finalQty: Math.ceil(brickCalc.netBricks * wastageMultiplier),
      primaryUnit: 'Pieces',
      altQty: Math.ceil(brickCalc.netBricks * wastageMultiplier),
      altUnit: 'Nos',
      rateKey: 'rateBrick'
    },
    {
      name: 'Portland Cement',
      description: `Ordinary Portland Cement (${mortarRatioKey} mortar mix)`,
      netQty: mortarCalc.cementBags,
      wastagePct: wastagePct,
      finalQty: Math.ceil(mortarCalc.cementBags * wastageMultiplier),
      primaryUnit: 'Bags (50 kg)',
      altQty: Math.round(mortarCalc.cementBags * wastageMultiplier * CEMENT_BAG_WEIGHT_KG),
      altUnit: 'kg',
      rateKey: 'rateCement'
    },
    {
      name: 'Masonry Sand',
      description: 'Screened river sand (fine aggregate)',
      netQty: mortarCalc.sandCft,
      wastagePct: wastagePct,
      finalQty: parseFloat((mortarCalc.sandCft * wastageMultiplier).toFixed(1)),
      primaryUnit: 'CFT',
      altQty: parseFloat((mortarCalc.sandM3 * wastageMultiplier).toFixed(2)),
      altUnit: 'm³',
      rateKey: 'rateSand'
    },
    {
      name: 'Mixing & Curing Water',
      description: 'Potable water (~26 Liters per 50 kg cement bag)',
      netQty: Math.round(mortarCalc.cementBags * 26),
      wastagePct: wastagePct,
      finalQty: Math.round(mortarCalc.cementBags * wastageMultiplier * 26),
      primaryUnit: 'Liters',
      altQty: Math.round(mortarCalc.cementBags * wastageMultiplier * 26 * 0.264172),
      altUnit: 'Gallons',
      rateKey: null
    }
  ];

  return {
    category: 'Brick Wall',
    title: document.getElementById('projectName')?.value || 'Brick Wall Construction',
    wallCount,
    grossAreaM2: totalGrossAreaM2,
    openingsAreaM2,
    netAreaM2,
    wallVolumeM3,
    thickInches: (thickM * 39.3701).toFixed(1),
    mortarRatio: mortarRatioKey,
    dryMortarM3: mortarCalc.dryMortarM3,
    wetMortarM3: brickCalc.wetMortarM3,
    items
  };
}

/**
 * 6.B Brick Quantity Calculation Helper
 * Uses precise brick dimensions + 10mm (3/8") mortar joint
 */
function calculateBrickQuantity(wallVolumeM3) {
  // Standard Pakistani Brick (9" x 4.5" x 3")
  // In meters: 0.2286 x 0.1143 x 0.0762
  const brickChoice = document.getElementById('brickSizeSelect')?.value || 'pk_standard';
  let L = 0.2286, W = 0.1143, H = 0.0762;

  if (brickChoice === 'metric_std') {
    L = 0.225; W = 0.1125; H = 0.075;
  } else if (brickChoice === 'modular') {
    L = 0.190; W = 0.090; H = 0.090;
  } else if (brickChoice === 'custom') {
    const isMetric = appState.unitSystem === 'metric';
    const lRaw = parseFloat(document.getElementById('brickLen')?.value) || 9.0;
    const wRaw = parseFloat(document.getElementById('brickWid')?.value) || 4.5;
    const hRaw = parseFloat(document.getElementById('brickHgt')?.value) || 3.0;
    L = convertToMeters(lRaw, isMetric ? 'mm' : 'in');
    W = convertToMeters(wRaw, isMetric ? 'mm' : 'in');
    H = convertToMeters(hRaw, isMetric ? 'mm' : 'in');
  }

  const jointThickness = 0.010; // 10mm (3/8") mortar joint
  const nominalVol = (L + jointThickness) * (W + jointThickness) * (H + jointThickness);
  const bareBrickVol = L * W * H;

  // Number of bricks without wastage
  const netBricks = Math.round(wallVolumeM3 / nominalVol);

  // Volume of wet mortar = Net wall volume - bare bricks volume
  const bareBricksTotalVol = netBricks * bareBrickVol;
  let wetMortarM3 = wallVolumeM3 - bareBricksTotalVol;
  // In field practice, frogs and slight waste in joints account for ~25% to 30% of wall volume
  if (wetMortarM3 <= 0 || wetMortarM3 < wallVolumeM3 * 0.20) {
    wetMortarM3 = wallVolumeM3 * 0.28;
  }

  return {
    netBricks,
    bareBrickVol,
    nominalVol,
    wetMortarM3
  };
}

/**
 * 6.C Mortar Materials Calculation Helper
 */
function calculateMortarMaterials(wetMortarM3, ratioKey) {
  const ratio = MORTAR_RATIOS[ratioKey] || MORTAR_RATIOS['1:6'];
  // Dry volume = Wet volume * 1.33
  const dryMortarM3 = wetMortarM3 * DRY_VOL_FACTOR_MORTAR;
  const cementVolM3 = dryMortarM3 * (ratio.c / ratio.sum);
  const sandVolM3 = dryMortarM3 * (ratio.s / ratio.sum);

  // Cement bags = cementVolM3 / CEMENT_BAG_VOL_M3
  const cementBags = cementVolM3 / CEMENT_BAG_VOL_M3;
  const sandCft = sandVolM3 * CFT_PER_CUBIC_METER;

  return {
    dryMortarM3,
    cementVolM3,
    sandVolM3,
    cementBags,
    sandCft,
    sandM3: sandVolM3
  };
}

/**
 * 6.D Concrete Materials Calculation Helper
 */
function calculateConcreteMaterials(wetVolumeM3, ratioKey, customParts = null) {
  let ratio = MIX_RATIOS[ratioKey];
  if (!ratio && customParts) {
    const sum = customParts.c + customParts.s + customParts.a;
    ratio = { c: customParts.c, s: customParts.s, a: customParts.a, sum };
  }
  if (!ratio) ratio = MIX_RATIOS['1:2:4'];

  const dryVolumeM3 = wetVolumeM3 * DRY_VOL_FACTOR_CONCRETE;
  const cementVolM3 = dryVolumeM3 * (ratio.c / ratio.sum);
  const sandVolM3 = dryVolumeM3 * (ratio.s / ratio.sum);
  const crushVolM3 = dryVolumeM3 * (ratio.a / ratio.sum);

  const cementBags = cementVolM3 / CEMENT_BAG_VOL_M3;
  const sandCft = sandVolM3 * CFT_PER_CUBIC_METER;
  const crushCft = crushVolM3 * CFT_PER_CUBIC_METER;

  return {
    wetVolumeM3,
    dryVolumeM3,
    cementVolM3,
    sandVolM3,
    crushVolM3,
    cementBags,
    sandCft,
    crushCft,
    sandM3: sandVolM3,
    crushM3: crushVolM3,
    ratioDesc: ratio.desc || `${ratio.c}:${ratio.s}:${ratio.a}`
  };
}

/**
 * 6.E Roof Slab / RCC Calculator
 */
function calculateRoofSlabMaterials(wastageMultiplier, wastagePct) {
  const isMetric = appState.unitSystem === 'metric';
  const lenRaw = parseFloat(document.getElementById('slabLength')?.value) || 0;
  const widRaw = parseFloat(document.getElementById('slabWidth')?.value) || 0;
  const thkRaw = parseFloat(document.getElementById('slabThick')?.value) || 6;
  const slabCount = parseInt(document.getElementById('slabCount')?.value) || 1;
  const coverRaw = parseFloat(document.getElementById('slabCover')?.value) || 0.75;
  const mixKey = document.getElementById('slabConcreteMix')?.value || '1:2:4';

  const lenM = convertToMeters(lenRaw, isMetric ? 'm' : 'ft');
  const widM = convertToMeters(widRaw, isMetric ? 'm' : 'ft');
  const thkM = convertToMeters(thkRaw, isMetric ? 'mm' : 'in');
  const coverM = convertToMeters(coverRaw, isMetric ? 'mm' : 'in');

  const singleSlabVolM3 = lenM * widM * thkM;
  const totalConcreteM3 = singleSlabVolM3 * slabCount;

  // Concrete components
  const concreteCalc = calculateConcreteMaterials(totalConcreteM3, mixKey);

  // Steel calculation
  const mainMm = parseFloat(document.getElementById('slabMainMm')?.value) || 12.7;
  const distMm = parseFloat(document.getElementById('slabDistMm')?.value) || 9.5;
  const mainSpacingRaw = parseFloat(document.getElementById('slabMainSpacing')?.value) || 6.0;
  const distSpacingRaw = parseFloat(document.getElementById('slabDistSpacing')?.value) || 8.0;

  const mainSpacingM = convertToMeters(mainSpacingRaw, isMetric ? 'mm' : 'in');
  const distSpacingM = convertToMeters(distSpacingRaw, isMetric ? 'mm' : 'in');

  // Main bars run along shorter span, spaced along longer span
  const shortSpanM = Math.min(lenM, widM);
  const longSpanM = Math.max(lenM, widM);

  // Single bar length = span - 2*cover + 2*hooks (hooks = 12 * diameter)
  const hookAllowanceMain = 24 * (mainMm / 1000.0);
  const hookAllowanceDist = 24 * (distMm / 1000.0);

  const mainBarLenM = (shortSpanM - 2 * coverM) + hookAllowanceMain;
  const numMainBars = Math.ceil((longSpanM - 2 * coverM) / mainSpacingM) + 1;
  const totalMainLenM = mainBarLenM * numMainBars * slabCount;
  // Crank / top curtailment extra allowance (12% typical for continuous two-way action)
  const totalMainLenWithCrankM = totalMainLenM * 1.12;
  const mainSteelKg = calculateSteelWeightKg(mainMm, totalMainLenWithCrankM);

  const distBarLenM = (longSpanM - 2 * coverM) + hookAllowanceDist;
  const numDistBars = Math.ceil((shortSpanM - 2 * coverM) / distSpacingM) + 1;
  const totalDistLenM = distBarLenM * numDistBars * slabCount;
  const distSteelKg = calculateSteelWeightKg(distMm, totalDistLenM);

  const totalSteelKg = mainSteelKg + distSteelKg;

  const items = [
    {
      name: 'Portland Cement',
      description: `Ordinary Portland Cement (${mixKey} RCC Mix)`,
      netQty: concreteCalc.cementBags,
      wastagePct: wastagePct,
      finalQty: Math.ceil(concreteCalc.cementBags * wastageMultiplier),
      primaryUnit: 'Bags (50 kg)',
      altQty: Math.round(concreteCalc.cementBags * wastageMultiplier * CEMENT_BAG_WEIGHT_KG),
      altUnit: 'kg',
      rateKey: 'rateCement'
    },
    {
      name: 'Sand (Fine Aggregate)',
      description: 'Clean coarse concrete sand (Chenab / Lawrencepur)',
      netQty: concreteCalc.sandCft,
      wastagePct: wastagePct,
      finalQty: parseFloat((concreteCalc.sandCft * wastageMultiplier).toFixed(1)),
      primaryUnit: 'CFT',
      altQty: parseFloat((concreteCalc.sandM3 * wastageMultiplier).toFixed(2)),
      altUnit: 'm³',
      rateKey: 'rateSand'
    },
    {
      name: 'Crush / Coarse Aggregate',
      description: 'Crushed stone aggregate 1/2" to 3/4" (Margalla / Sargodha)',
      netQty: concreteCalc.crushCft,
      wastagePct: wastagePct,
      finalQty: parseFloat((concreteCalc.crushCft * wastageMultiplier).toFixed(1)),
      primaryUnit: 'CFT',
      altQty: parseFloat((concreteCalc.crushM3 * wastageMultiplier).toFixed(2)),
      altUnit: 'm³',
      rateKey: 'rateCrush'
    },
    {
      name: 'Steel Reinforcement (Rebar)',
      description: `Grade 60 Deformed Bars (Main: ${mainMm.toFixed(1)}mm @ ${mainSpacingRaw}", Dist: ${distMm.toFixed(1)}mm @ ${distSpacingRaw}")`,
      netQty: totalSteelKg,
      wastagePct: wastagePct,
      finalQty: Math.round(totalSteelKg * wastageMultiplier),
      primaryUnit: 'kg',
      altQty: parseFloat(((totalSteelKg * wastageMultiplier) / 1000.0).toFixed(3)),
      altUnit: 'Metric Tons',
      rateKey: 'rateSteel'
    },
    {
      name: 'Curing & Mixing Water',
      description: 'Potable water (~28 Liters per cement bag)',
      netQty: Math.round(concreteCalc.cementBags * 28),
      wastagePct: wastagePct,
      finalQty: Math.round(concreteCalc.cementBags * wastageMultiplier * 28),
      primaryUnit: 'Liters',
      altQty: Math.round(concreteCalc.cementBags * wastageMultiplier * 28 * 0.264172),
      altUnit: 'Gallons',
      rateKey: null
    }
  ];

  return {
    category: 'Roof / RCC Slab',
    title: document.getElementById('projectName')?.value || 'Roof Slab RCC Estimation',
    slabCount,
    lenM,
    widM,
    thkInches: (thkM * 39.3701).toFixed(1),
    wetVolumeM3: totalConcreteM3,
    dryVolumeM3: concreteCalc.dryVolumeM3,
    concreteMix: mixKey,
    mainMm,
    distMm,
    numMainBars,
    numDistBars,
    totalSteelKg,
    items
  };
}

/**
 * 6.F Room Construction Calculator
 */
function calculateRoomMaterials(wastageMultiplier, wastagePct) {
  const isMetric = appState.unitSystem === 'metric';
  const lenRaw = parseFloat(document.getElementById('roomLength')?.value) || 15;
  const widRaw = parseFloat(document.getElementById('roomWidth')?.value) || 12;
  const hgtRaw = parseFloat(document.getElementById('roomWallHeight')?.value) || 10.5;
  const thickChoice = document.getElementById('roomWallThick')?.value || '9.0';
  const fDepthRaw = parseFloat(document.getElementById('roomFoundationDepth')?.value) || 3.0;
  const slabThkRaw = parseFloat(document.getElementById('roomSlabThick')?.value) || 6.0;
  const slabOverhangRaw = parseFloat(document.getElementById('roomSlabOverhang')?.value) || 1.5;

  const lenM = convertToMeters(lenRaw, isMetric ? 'm' : 'ft');
  const widM = convertToMeters(widRaw, isMetric ? 'm' : 'ft');
  const hgtM = convertToMeters(hgtRaw, isMetric ? 'm' : 'ft');
  const thickM = convertToMeters(parseFloat(thickChoice), 'in');
  const fDepthM = convertToMeters(fDepthRaw, isMetric ? 'm' : 'ft');
  const slabThkM = convertToMeters(slabThkRaw, isMetric ? 'mm' : 'in');
  const overhangM = convertToMeters(slabOverhangRaw, isMetric ? 'm' : 'ft');

  // Centerline perimeter of room: 2 * (len + thick + wid + thick)
  const centerPerimeterM = 2 * (lenM + widM + 2 * thickM);

  // 1. Excavation & Foundation
  const trenchWidthM = thickM * 3; // Standard rule of thumb: trench width = 3 * wall thickness
  const excavationM3 = centerPerimeterM * trenchWidthM * fDepthM;
  // PCC lean base (6" thick, 1:4:8)
  const pccBaseThickM = 0.1524;
  const pccVolM3 = centerPerimeterM * trenchWidthM * pccBaseThickM;
  const pccCalc = calculateConcreteMaterials(pccVolM3, '1:4:8');

  // Stepped foundation brickwork: approx 1.5 times wall thickness average
  const foundWallVolM3 = centerPerimeterM * (thickM * 1.5) * (fDepthM - pccBaseThickM);
  const foundBrickCalc = calculateBrickQuantity(foundWallVolM3);
  const foundMortarCalc = calculateMortarMaterials(foundBrickCalc.wetMortarM3, '1:6');

  // 2. Superstructure Brickwork
  const grossWallAreaM2 = centerPerimeterM * hgtM;
  const openingsAreaM2 = getTotalOpeningsAreaM2();
  const netWallAreaM2 = Math.max(0, grossWallAreaM2 - openingsAreaM2);
  const superWallVolM3 = netWallAreaM2 * thickM;
  const superBrickCalc = calculateBrickQuantity(superWallVolM3);
  const superMortarRatio = document.getElementById('roomMortarRatio')?.value || '1:6';
  const superMortarCalc = calculateMortarMaterials(superBrickCalc.wetMortarM3, superMortarRatio);

  // Total Bricks & Wall Mortar
  const totalNetBricks = foundBrickCalc.netBricks + superBrickCalc.netBricks;
  const totalMasonryCementBags = foundMortarCalc.cementBags + superMortarCalc.cementBags;
  const totalMasonrySandCft = foundMortarCalc.sandCft + superMortarCalc.sandCft;

  // 3. Roof Slab
  const slabLenM = lenM + 2 * thickM + 2 * overhangM;
  const slabWidM = widM + 2 * thickM + 2 * overhangM;
  const slabVolM3 = slabLenM * slabWidM * slabThkM;
  const slabMix = document.getElementById('roomConcreteMix')?.value || '1:2:4';
  const slabCalc = calculateConcreteMaterials(slabVolM3, slabMix);

  // Rebar in slab (4 sutar main @ 6", 3 sutar dist @ 8")
  const mainBarLenM = Math.min(slabLenM, slabWidM);
  const longSpanM = Math.max(slabLenM, slabWidM);
  const numMain = Math.ceil(longSpanM / 0.1524) + 1;
  const numDist = Math.ceil(mainBarLenM / 0.2032) + 1;
  const slabSteelKg = (calculateSteelWeightKg(12.7, mainBarLenM * numMain * 1.12) +
                       calculateSteelWeightKg(9.5, longSpanM * numDist));

  // 4. Floor (4" PCC 1:3:6)
  const floorAreaM2 = lenM * widM;
  const floorVolM3 = floorAreaM2 * 0.1016; // 4 inches
  const floorCalc = calculateConcreteMaterials(floorVolM3, '1:3:6');

  // 5. Plastering (Internal 1:4 12mm, External 1:5 19mm)
  const plasterOpt = document.getElementById('roomPlasterOption')?.value || 'both';
  let plasterCementBags = 0;
  let plasterSandCft = 0;

  if (plasterOpt === 'both' || plasterOpt === 'internal_only') {
    // Internal walls area + ceiling area
    const intWallAreaM2 = 2 * (lenM + widM) * hgtM - openingsAreaM2;
    const ceilingAreaM2 = lenM * widM;
    const intTotalAreaM2 = Math.max(0, intWallAreaM2 + ceilingAreaM2);
    const intWetM3 = intTotalAreaM2 * 0.0127 * 1.20; // 12mm + 20% joint fill
    const intMortar = calculateMortarMaterials(intWetM3, '1:4');
    plasterCementBags += intMortar.cementBags;
    plasterSandCft += intMortar.sandCft;
  }

  if (plasterOpt === 'both') {
    // External walls area
    const extWallAreaM2 = 2 * (lenM + 2 * thickM + widM + 2 * thickM) * hgtM - (openingsAreaM2 * 0.5);
    const extWetM3 = Math.max(0, extWallAreaM2) * 0.019 * 1.20; // 19mm
    const extMortar = calculateMortarMaterials(extWetM3, '1:5');
    plasterCementBags += extMortar.cementBags;
    plasterSandCft += extMortar.sandCft;
  }

  // Consolidated Bill of Materials
  const totalCementBags = (pccCalc.cementBags + totalMasonryCementBags +
                           slabCalc.cementBags + floorCalc.cementBags + plasterCementBags);
  const totalSandCft = (pccCalc.sandCft + totalMasonrySandCft +
                        slabCalc.sandCft + floorCalc.sandCft + plasterSandCft);
  const totalCrushCft = pccCalc.crushCft + slabCalc.crushCft + floorCalc.crushCft;

  const items = [
    {
      name: 'Bricks',
      description: 'Superstructure walls & stepped foundation masonry',
      netQty: totalNetBricks,
      wastagePct: wastagePct,
      finalQty: Math.ceil(totalNetBricks * wastageMultiplier),
      primaryUnit: 'Pieces',
      altQty: Math.ceil(totalNetBricks * wastageMultiplier),
      altUnit: 'Nos',
      rateKey: 'rateBrick'
    },
    {
      name: 'Portland Cement',
      description: 'Total for foundation PCC, masonry, RCC slab, floor & plaster',
      netQty: totalCementBags,
      wastagePct: wastagePct,
      finalQty: Math.ceil(totalCementBags * wastageMultiplier),
      primaryUnit: 'Bags (50 kg)',
      altQty: Math.round(totalCementBags * wastageMultiplier * CEMENT_BAG_WEIGHT_KG),
      altUnit: 'kg',
      rateKey: 'rateCement'
    },
    {
      name: 'Sand',
      description: 'Masonry, plastering, and concrete fine aggregate',
      netQty: totalSandCft,
      wastagePct: wastagePct,
      finalQty: parseFloat((totalSandCft * wastageMultiplier).toFixed(1)),
      primaryUnit: 'CFT',
      altQty: parseFloat(((totalSandCft * wastageMultiplier) / CFT_PER_CUBIC_METER).toFixed(2)),
      altUnit: 'm³',
      rateKey: 'rateSand'
    },
    {
      name: 'Crush / Aggregate',
      description: 'Coarse stone aggregate for PCC foundation, slab & floor',
      netQty: totalCrushCft,
      wastagePct: wastagePct,
      finalQty: parseFloat((totalCrushCft * wastageMultiplier).toFixed(1)),
      primaryUnit: 'CFT',
      altQty: parseFloat(((totalCrushCft * wastageMultiplier) / CFT_PER_CUBIC_METER).toFixed(2)),
      altUnit: 'm³',
      rateKey: 'rateCrush'
    },
    {
      name: 'Steel Rebar',
      description: 'Grade 60 reinforcement for RCC roof slab',
      netQty: slabSteelKg,
      wastagePct: wastagePct,
      finalQty: Math.round(slabSteelKg * wastageMultiplier),
      primaryUnit: 'kg',
      altQty: parseFloat(((slabSteelKg * wastageMultiplier) / 1000.0).toFixed(3)),
      altUnit: 'Metric Tons',
      rateKey: 'rateSteel'
    },
    {
      name: 'Foundation Earthwork Excavation',
      description: 'Foundation trench excavation quantity',
      netQty: excavationM3 * CFT_PER_CUBIC_METER,
      wastagePct: 0,
      finalQty: parseFloat((excavationM3 * CFT_PER_CUBIC_METER).toFixed(1)),
      primaryUnit: 'CFT',
      altQty: parseFloat(excavationM3.toFixed(2)),
      altUnit: 'm³',
      rateKey: null
    },
    {
      name: 'Total Potable Water',
      description: 'Water for concrete batching, masonry mortar, and curing',
      netQty: Math.round(totalCementBags * 28),
      wastagePct: wastagePct,
      finalQty: Math.round(totalCementBags * wastageMultiplier * 28),
      primaryUnit: 'Liters',
      altQty: Math.round(totalCementBags * wastageMultiplier * 28 * 0.264172),
      altUnit: 'Gallons',
      rateKey: null
    }
  ];

  return {
    category: 'Single Room',
    title: document.getElementById('projectName')?.value || 'Single Room Construction',
    roomDims: `${lenRaw}' × ${widRaw}' × ${hgtRaw}'`,
    totalNetBricks,
    totalCementBags,
    totalSandCft,
    totalCrushCft,
    slabSteelKg,
    excavationCft: excavationM3 * CFT_PER_CUBIC_METER,
    items
  };
}

/**
 * 6.G Complete House Construction Calculator
 */
function calculateHouseMaterials(wastageMultiplier, wastagePct) {
  const coveredAreaSqFt = parseFloat(document.getElementById('houseCoveredArea')?.value) || 2000;
  const storeys = parseInt(document.getElementById('houseStoreys')?.value) || 2;
  const quality = document.getElementById('houseQuality')?.value || 'A';
  const includeBoundary = document.getElementById('houseBoundaryWall')?.value === 'yes';

  // Civil engineering empirical coefficients in Pakistan per sq ft of covered area (LDA / PEC standards)
  // Bricks: ~28 to 34 bricks per sq ft of covered area
  // Cement: ~0.45 to 0.52 bags per sq ft of covered area
  // Sand: ~1.8 to 2.2 CFT per sq ft
  // Crush: ~1.2 to 1.5 CFT per sq ft
  // Steel: ~3.8 to 4.5 kg per sq ft (for frame + slabs)

  let brickRate = 30.0;
  let cementRate = 0.48;
  let sandRate = 2.0;
  let crushRate = 1.35;
  let steelRate = 4.0;

  if (quality === 'A_plus') {
    brickRate = 32.0;
    cementRate = 0.52;
    sandRate = 2.2;
    crushRate = 1.5;
    steelRate = 4.6;
  } else if (quality === 'economy') {
    brickRate = 27.0;
    cementRate = 0.44;
    sandRate = 1.8;
    crushRate = 1.2;
    steelRate = 3.5;
  }

  let totalBricks = coveredAreaSqFt * brickRate;
  let totalCement = coveredAreaSqFt * cementRate;
  let totalSand = coveredAreaSqFt * sandRate;
  let totalCrush = coveredAreaSqFt * crushRate;
  let totalSteel = coveredAreaSqFt * steelRate;

  if (includeBoundary) {
    // Add allowance for 80-100 ft boundary wall
    totalBricks += 4500;
    totalCement += 35;
    totalSand += 160;
    totalCrush += 60;
    totalSteel += 180;
  }

  const items = [
    {
      name: 'Bricks',
      description: 'First-Class kiln-burnt bricks for full grey structure',
      netQty: totalBricks,
      wastagePct: wastagePct,
      finalQty: Math.ceil(totalBricks * wastageMultiplier),
      primaryUnit: 'Pieces',
      altQty: Math.ceil(totalBricks * wastageMultiplier),
      altUnit: 'Nos',
      rateKey: 'rateBrick'
    },
    {
      name: 'Portland Cement',
      description: 'Total for grey structure (foundations, columns, slabs, plaster)',
      netQty: totalCement,
      wastagePct: wastagePct,
      finalQty: Math.ceil(totalCement * wastageMultiplier),
      primaryUnit: 'Bags (50 kg)',
      altQty: Math.round(totalCement * wastageMultiplier * CEMENT_BAG_WEIGHT_KG),
      altUnit: 'kg',
      rateKey: 'rateCement'
    },
    {
      name: 'Sand',
      description: 'Masonry, plastering, and concrete sand (Ravi / Chenab)',
      netQty: totalSand,
      wastagePct: wastagePct,
      finalQty: Math.round(totalSand * wastageMultiplier),
      primaryUnit: 'CFT',
      altQty: parseFloat(((totalSand * wastageMultiplier) / CFT_PER_CUBIC_METER).toFixed(1)),
      altUnit: 'm³',
      rateKey: 'rateSand'
    },
    {
      name: 'Crush / Aggregate',
      description: 'Margalla / Sargodha crushed stone for RCC slabs, beams & columns',
      netQty: totalCrush,
      wastagePct: wastagePct,
      finalQty: Math.round(totalCrush * wastageMultiplier),
      primaryUnit: 'CFT',
      altQty: parseFloat(((totalCrush * wastageMultiplier) / CFT_PER_CUBIC_METER).toFixed(1)),
      altUnit: 'm³',
      rateKey: 'rateCrush'
    },
    {
      name: 'Steel Reinforcement (Rebar)',
      description: 'Grade 60 Deformed Rebar for all RCC structural members',
      netQty: totalSteel,
      wastagePct: wastagePct,
      finalQty: Math.round(totalSteel * wastageMultiplier),
      primaryUnit: 'kg',
      altQty: parseFloat(((totalSteel * wastageMultiplier) / 1000.0).toFixed(2)),
      altUnit: 'Metric Tons',
      rateKey: 'rateSteel'
    },
    {
      name: 'Potable Water Estimate',
      description: 'Water requirement for mixing, compaction & 21-day curing',
      netQty: Math.round(totalCement * 28),
      wastagePct: wastagePct,
      finalQty: Math.round(totalCement * wastageMultiplier * 28),
      primaryUnit: 'Liters',
      altQty: Math.round(totalCement * wastageMultiplier * 28 * 0.264172),
      altUnit: 'Gallons',
      rateKey: null
    }
  ];

  return {
    category: 'Complete House',
    title: document.getElementById('projectName')?.value || 'Complete House Grey Structure',
    coveredAreaSqFt,
    storeys,
    quality,
    items
  };
}

/**
 * 6.H Boundary Wall Calculator
 */
function calculateBoundaryWallMaterials(wastageMultiplier, wastagePct) {
  const isMetric = appState.unitSystem === 'metric';
  const lenRaw = parseFloat(document.getElementById('boundLength')?.value) || 100;
  const hgtRaw = parseFloat(document.getElementById('boundHeight')?.value) || 7;
  const thickChoice = document.getElementById('boundThickness')?.value || '9.0';
  const pillarSpacingRaw = parseFloat(document.getElementById('boundPillars')?.value) || 10;
  const fDepthRaw = parseFloat(document.getElementById('boundFoundDepth')?.value) || 2.5;
  const mortarRatio = document.getElementById('boundMortar')?.value || '1:6';

  const lenM = convertToMeters(lenRaw, isMetric ? 'm' : 'ft');
  const hgtM = convertToMeters(hgtRaw, isMetric ? 'm' : 'ft');
  const thickM = convertToMeters(parseFloat(thickChoice), 'in');
  const fDepthM = convertToMeters(fDepthRaw, isMetric ? 'm' : 'ft');
  const pillarSpacingM = convertToMeters(pillarSpacingRaw, isMetric ? 'm' : 'ft');

  // Superstructure wall volume minus gate opening
  const openingsAreaM2 = getTotalOpeningsAreaM2();
  const netWallAreaM2 = Math.max(0, (lenM * hgtM) - openingsAreaM2);
  const wallVolM3 = netWallAreaM2 * thickM;

  // Pillars volume: 13.5" x 13.5" (0.343m x 0.343m)
  const numPillars = Math.floor(lenM / pillarSpacingM) + 1;
  const pillarExtraVolM3 = numPillars * (0.343 * 0.343 - thickM * 0.343) * hgtM;

  // Foundation: Trench 2.5 ft wide, PCC 6" base + stepped brick footing
  const trenchWidthM = 0.762;
  const excavationM3 = lenM * trenchWidthM * fDepthM;
  const pccVolM3 = lenM * trenchWidthM * 0.1524;
  const pccCalc = calculateConcreteMaterials(pccVolM3, '1:4:8');

  // Foundation stepped bricks
  const foundWallVolM3 = lenM * (thickM * 1.4) * (fDepthM - 0.1524);

  // Total brickwork volume
  const totalBrickVolM3 = wallVolM3 + pillarExtraVolM3 + foundWallVolM3;
  const brickCalc = calculateBrickQuantity(totalBrickVolM3);
  const mortarCalc = calculateMortarMaterials(brickCalc.wetMortarM3, mortarRatio);

  const totalCementBags = pccCalc.cementBags + mortarCalc.cementBags;
  const totalSandCft = pccCalc.sandCft + mortarCalc.sandCft;
  const totalCrushCft = pccCalc.crushCft;

  const items = [
    {
      name: 'Bricks',
      description: 'Burnt clay bricks for wall, pillars, and foundation',
      netQty: brickCalc.netBricks,
      wastagePct: wastagePct,
      finalQty: Math.ceil(brickCalc.netBricks * wastageMultiplier),
      primaryUnit: 'Pieces',
      altQty: Math.ceil(brickCalc.netBricks * wastageMultiplier),
      altUnit: 'Nos',
      rateKey: 'rateBrick'
    },
    {
      name: 'Portland Cement',
      description: `Foundation PCC (1:4:8) and Wall Mortar (${mortarRatio})`,
      netQty: totalCementBags,
      wastagePct: wastagePct,
      finalQty: Math.ceil(totalCementBags * wastageMultiplier),
      primaryUnit: 'Bags (50 kg)',
      altQty: Math.round(totalCementBags * wastageMultiplier * CEMENT_BAG_WEIGHT_KG),
      altUnit: 'kg',
      rateKey: 'rateCement'
    },
    {
      name: 'Sand',
      description: 'Masonry mortar and foundation concrete sand',
      netQty: totalSandCft,
      wastagePct: wastagePct,
      finalQty: parseFloat((totalSandCft * wastageMultiplier).toFixed(1)),
      primaryUnit: 'CFT',
      altQty: parseFloat(((totalSandCft * wastageMultiplier) / CFT_PER_CUBIC_METER).toFixed(2)),
      altUnit: 'm³',
      rateKey: 'rateSand'
    },
    {
      name: 'Crush / Aggregate',
      description: 'Coarse stone aggregate for foundation PCC base',
      netQty: totalCrushCft,
      wastagePct: wastagePct,
      finalQty: parseFloat((totalCrushCft * wastageMultiplier).toFixed(1)),
      primaryUnit: 'CFT',
      altQty: parseFloat(((totalCrushCft * wastageMultiplier) / CFT_PER_CUBIC_METER).toFixed(2)),
      altUnit: 'm³',
      rateKey: 'rateCrush'
    },
    {
      name: 'Excavation Quantity',
      description: 'Trench excavation for boundary wall foundation',
      netQty: excavationM3 * CFT_PER_CUBIC_METER,
      wastagePct: 0,
      finalQty: parseFloat((excavationM3 * CFT_PER_CUBIC_METER).toFixed(1)),
      primaryUnit: 'CFT',
      altQty: parseFloat(excavationM3.toFixed(2)),
      altUnit: 'm³',
      rateKey: null
    }
  ];

  return {
    category: 'Boundary Wall',
    title: document.getElementById('projectName')?.value || 'Boundary Wall Estimation',
    lenM,
    hgtM,
    numPillars,
    items
  };
}

/**
 * 6.I Foundation Calculator
 */
function calculateFoundationMaterials(wastageMultiplier, wastagePct) {
  const isMetric = appState.unitSystem === 'metric';
  const foundType = document.getElementById('foundTypeSelect')?.value || 'strip_stepped';
  const lenRaw = parseFloat(document.getElementById('foundLength')?.value) || 80;
  const widRaw = parseFloat(document.getElementById('foundTrenchWidth')?.value) || 3;
  const depRaw = parseFloat(document.getElementById('foundTrenchDepth')?.value) || 3.5;
  const pccThkRaw = parseFloat(document.getElementById('foundPccThick')?.value) || 6;
  const pccMix = document.getElementById('foundPccMix')?.value || '1:4:8';

  const lenM = convertToMeters(lenRaw, isMetric ? 'm' : 'ft');
  const widM = convertToMeters(widRaw, isMetric ? 'm' : 'ft');
  const depM = convertToMeters(depRaw, isMetric ? 'm' : 'ft');
  const pccThkM = convertToMeters(pccThkRaw, isMetric ? 'mm' : 'in');

  const excavationM3 = lenM * widM * depM;
  const pccVolM3 = lenM * widM * pccThkM;
  const pccCalc = calculateConcreteMaterials(pccVolM3, pccMix);

  let items = [];

  if (foundType === 'strip_stepped') {
    // Stepped brick footing
    const mortarRatio = document.getElementById('foundBrickMortar')?.value || '1:6';
    const brickHgtM = Math.max(0, depM - pccThkM);
    // Average width of stepped footing: (widM + 0.228) / 2
    const avgStepWidM = (widM + 0.2286) / 2.0;
    const brickVolM3 = lenM * avgStepWidM * brickHgtM;
    const brickCalc = calculateBrickQuantity(brickVolM3);
    const mortarCalc = calculateMortarMaterials(brickCalc.wetMortarM3, mortarRatio);

    const totalCementBags = pccCalc.cementBags + mortarCalc.cementBags;
    const totalSandCft = pccCalc.sandCft + mortarCalc.sandCft;

    items = [
      {
        name: 'Bricks',
        description: 'Stepped foundation masonry courses',
        netQty: brickCalc.netBricks,
        wastagePct: wastagePct,
        finalQty: Math.ceil(brickCalc.netBricks * wastageMultiplier),
        primaryUnit: 'Pieces',
        altQty: Math.ceil(brickCalc.netBricks * wastageMultiplier),
        altUnit: 'Nos',
        rateKey: 'rateBrick'
      },
      {
        name: 'Portland Cement',
        description: `Foundation PCC (${pccMix}) + Stepped Footing Mortar (${mortarRatio})`,
        netQty: totalCementBags,
        wastagePct: wastagePct,
        finalQty: Math.ceil(totalCementBags * wastageMultiplier),
        primaryUnit: 'Bags (50 kg)',
        altQty: Math.round(totalCementBags * wastageMultiplier * CEMENT_BAG_WEIGHT_KG),
        altUnit: 'kg',
        rateKey: 'rateCement'
      },
      {
        name: 'Sand',
        description: 'PCC bedding & brick mortar sand',
        netQty: totalSandCft,
        wastagePct: wastagePct,
        finalQty: parseFloat((totalSandCft * wastageMultiplier).toFixed(1)),
        primaryUnit: 'CFT',
        altQty: parseFloat(((totalSandCft * wastageMultiplier) / CFT_PER_CUBIC_METER).toFixed(2)),
        altUnit: 'm³',
        rateKey: 'rateSand'
      },
      {
        name: 'Crush / Aggregate',
        description: 'PCC foundation bedding aggregate',
        netQty: pccCalc.crushCft,
        wastagePct: wastagePct,
        finalQty: parseFloat((pccCalc.crushCft * wastageMultiplier).toFixed(1)),
        primaryUnit: 'CFT',
        altQty: parseFloat((pccCalc.crushM3 * wastageMultiplier).toFixed(2)),
        altUnit: 'm³',
        rateKey: 'rateCrush'
      },
      {
        name: 'Trench Earthwork Excavation',
        description: 'Earth excavation in foundation trenches',
        netQty: excavationM3 * CFT_PER_CUBIC_METER,
        wastagePct: 0,
        finalQty: parseFloat((excavationM3 * CFT_PER_CUBIC_METER).toFixed(1)),
        primaryUnit: 'CFT',
        altQty: parseFloat(excavationM3.toFixed(2)),
        altUnit: 'm³',
        rateKey: null
      }
    ];
  } else {
    // RCC Footing
    const steelMm = parseFloat(document.getElementById('foundSteelMm')?.value) || 12.7;
    const steelSpacingRaw = parseFloat(document.getElementById('foundSteelSpacing')?.value) || 6.0;
    const spacingM = convertToMeters(steelSpacingRaw, isMetric ? 'mm' : 'in');
    const barsCount = Math.ceil(lenM / spacingM) + Math.ceil(widM / spacingM);
    const avgBarLenM = Math.max(lenM, widM);
    const steelKg = calculateSteelWeightKg(steelMm, barsCount * avgBarLenM);

    items = [
      {
        name: 'Portland Cement',
        description: `PCC Base & RCC Footing Concrete`,
        netQty: pccCalc.cementBags * 1.5,
        wastagePct: wastagePct,
        finalQty: Math.ceil(pccCalc.cementBags * 1.5 * wastageMultiplier),
        primaryUnit: 'Bags (50 kg)',
        altQty: Math.round(pccCalc.cementBags * 1.5 * wastageMultiplier * CEMENT_BAG_WEIGHT_KG),
        altUnit: 'kg',
        rateKey: 'rateCement'
      },
      {
        name: 'Sand',
        description: 'Concrete fine aggregate',
        netQty: pccCalc.sandCft * 1.5,
        wastagePct: wastagePct,
        finalQty: parseFloat((pccCalc.sandCft * 1.5 * wastageMultiplier).toFixed(1)),
        primaryUnit: 'CFT',
        altQty: parseFloat(((pccCalc.sandCft * 1.5 * wastageMultiplier) / CFT_PER_CUBIC_METER).toFixed(2)),
        altUnit: 'm³',
        rateKey: 'rateSand'
      },
      {
        name: 'Crush / Aggregate',
        description: 'Coarse stone aggregate',
        netQty: pccCalc.crushCft * 1.5,
        wastagePct: wastagePct,
        finalQty: parseFloat((pccCalc.crushCft * 1.5 * wastageMultiplier).toFixed(1)),
        primaryUnit: 'CFT',
        altQty: parseFloat((pccCalc.crushM3 * 1.5 * wastageMultiplier).toFixed(2)),
        altUnit: 'm³',
        rateKey: 'rateCrush'
      },
      {
        name: 'Steel Rebar',
        description: `Footing bottom mesh (${steelMm.toFixed(1)} mm @ ${steelSpacingRaw}")`,
        netQty: steelKg,
        wastagePct: wastagePct,
        finalQty: Math.round(steelKg * wastageMultiplier),
        primaryUnit: 'kg',
        altQty: parseFloat(((steelKg * wastageMultiplier) / 1000.0).toFixed(3)),
        altUnit: 'Metric Tons',
        rateKey: 'rateSteel'
      },
      {
        name: 'Trench Earthwork Excavation',
        description: 'Earth excavation in foundation trenches',
        netQty: excavationM3 * CFT_PER_CUBIC_METER,
        wastagePct: 0,
        finalQty: parseFloat((excavationM3 * CFT_PER_CUBIC_METER).toFixed(1)),
        primaryUnit: 'CFT',
        altQty: parseFloat(excavationM3.toFixed(2)),
        altUnit: 'm³',
        rateKey: null
      }
    ];
  }

  return {
    category: 'Foundation',
    title: document.getElementById('projectName')?.value || 'Foundation Material Estimation',
    foundType,
    excavationCft: excavationM3 * CFT_PER_CUBIC_METER,
    items
  };
}

/**
 * 6.J Concrete Floor Calculator
 */
function calculateFloorMaterials(wastageMultiplier, wastagePct) {
  const isMetric = appState.unitSystem === 'metric';
  const lenRaw = parseFloat(document.getElementById('floorLength')?.value) || 20;
  const widRaw = parseFloat(document.getElementById('floorWidth')?.value) || 15;
  const subBaseThkRaw = parseFloat(document.getElementById('floorSubBaseThick')?.value) || 4;
  const pccThkRaw = parseFloat(document.getElementById('floorPccThick')?.value) || 3;
  const topThkRaw = parseFloat(document.getElementById('floorTopThick')?.value) || 1.5;
  const pccMix = document.getElementById('floorPccMix')?.value || '1:3:6';

  const lenM = convertToMeters(lenRaw, isMetric ? 'm' : 'ft');
  const widM = convertToMeters(widRaw, isMetric ? 'm' : 'ft');
  const pccThkM = convertToMeters(pccThkRaw, isMetric ? 'mm' : 'in');
  const topThkM = convertToMeters(topThkRaw, isMetric ? 'mm' : 'in');
  const subBaseThkM = convertToMeters(subBaseThkRaw, isMetric ? 'mm' : 'in');

  const areaM2 = lenM * widM;
  const subBaseVolM3 = areaM2 * subBaseThkM;
  const pccVolM3 = areaM2 * pccThkM;
  const topVolM3 = areaM2 * topThkM;

  const pccCalc = calculateConcreteMaterials(pccVolM3, pccMix);
  const topCalc = calculateConcreteMaterials(topVolM3, '1:2:4');

  const totalCementBags = pccCalc.cementBags + topCalc.cementBags;
  const totalSandCft = pccCalc.sandCft + topCalc.sandCft;
  const totalCrushCft = pccCalc.crushCft + topCalc.crushCft;

  const items = [
    {
      name: 'Sub-base Compaction Sand / Kassu',
      description: 'Cushion layer under concrete floor',
      netQty: subBaseVolM3 * CFT_PER_CUBIC_METER,
      wastagePct: wastagePct,
      finalQty: Math.round(subBaseVolM3 * CFT_PER_CUBIC_METER * wastageMultiplier),
      primaryUnit: 'CFT',
      altQty: parseFloat((subBaseVolM3 * wastageMultiplier).toFixed(2)),
      altUnit: 'm³',
      rateKey: 'rateSand'
    },
    {
      name: 'Portland Cement',
      description: `PCC Base (${pccMix}) + Top Screed (1:2:4)`,
      netQty: totalCementBags,
      wastagePct: wastagePct,
      finalQty: Math.ceil(totalCementBags * wastageMultiplier),
      primaryUnit: 'Bags (50 kg)',
      altQty: Math.round(totalCementBags * wastageMultiplier * CEMENT_BAG_WEIGHT_KG),
      altUnit: 'kg',
      rateKey: 'rateCement'
    },
    {
      name: 'Sand (Fine Aggregate)',
      description: 'Concrete fine aggregate for base and screed',
      netQty: totalSandCft,
      wastagePct: wastagePct,
      finalQty: parseFloat((totalSandCft * wastageMultiplier).toFixed(1)),
      primaryUnit: 'CFT',
      altQty: parseFloat(((totalSandCft * wastageMultiplier) / CFT_PER_CUBIC_METER).toFixed(2)),
      altUnit: 'm³',
      rateKey: 'rateSand'
    },
    {
      name: 'Crush / Aggregate',
      description: 'Coarse aggregate for PCC floor base & topping',
      netQty: totalCrushCft,
      wastagePct: wastagePct,
      finalQty: parseFloat((totalCrushCft * wastageMultiplier).toFixed(1)),
      primaryUnit: 'CFT',
      altQty: parseFloat(((totalCrushCft * wastageMultiplier) / CFT_PER_CUBIC_METER).toFixed(2)),
      altUnit: 'm³',
      rateKey: 'rateCrush'
    }
  ];

  return {
    category: 'Concrete Floor',
    title: document.getElementById('projectName')?.value || 'Concrete Flooring Estimation',
    areaSqFt: areaM2 * 10.7639,
    items
  };
}

/**
 * 6.K Columns (RCC) Calculator
 */
function calculateColumnMaterials(wastageMultiplier, wastagePct) {
  const isMetric = appState.unitSystem === 'metric';
  const count = parseInt(document.getElementById('colCount')?.value) || 4;
  const hgtRaw = parseFloat(document.getElementById('colHeight')?.value) || 11.5;
  const widRaw = parseFloat(document.getElementById('colWidth')?.value) || 9.0;
  const depRaw = parseFloat(document.getElementById('colDepth')?.value) || 12.0;
  const coverRaw = parseFloat(document.getElementById('colCover')?.value) || 1.5;
  const mixKey = document.getElementById('colConcreteMix')?.value || '1:1.5:3';

  const hgtM = convertToMeters(hgtRaw, isMetric ? 'm' : 'ft');
  const widM = convertToMeters(widRaw, isMetric ? 'mm' : 'in');
  const depM = convertToMeters(depRaw, isMetric ? 'mm' : 'in');
  const coverM = convertToMeters(coverRaw, isMetric ? 'mm' : 'in');

  const singleColVolM3 = widM * depM * hgtM;
  const totalVolM3 = singleColVolM3 * count;
  const concreteCalc = calculateConcreteMaterials(totalVolM3, mixKey);

  // Vertical steel
  const mainMm = parseFloat(document.getElementById('colMainMm')?.value) || 15.8;
  const mainCount = parseInt(document.getElementById('colMainCount')?.value) || 4;
  // Lap / foundation anchorage length (50 * diameter)
  const lapM = 50 * (mainMm / 1000.0);
  const totalMainBarLenM = (hgtM + lapM) * mainCount * count;
  const mainSteelKg = calculateSteelWeightKg(mainMm, totalMainBarLenM);

  // Lateral Ties
  const tieMm = parseFloat(document.getElementById('colTieMm')?.value) || 9.5;
  const tieSpacingRaw = parseFloat(document.getElementById('colTieSpacing')?.value) || 7.0;
  const tieSpacingM = convertToMeters(tieSpacingRaw, isMetric ? 'mm' : 'in');

  const tiePerimeterM = 2 * (widM - 2 * coverM) + 2 * (depM - 2 * coverM) + 24 * (tieMm / 1000.0);
  const numTiesPerCol = Math.ceil(hgtM / tieSpacingM) + 1;
  const totalTieLenM = tiePerimeterM * numTiesPerCol * count;
  const tieSteelKg = calculateSteelWeightKg(tieMm, totalTieLenM);

  const totalSteelKg = mainSteelKg + tieSteelKg;

  const items = [
    {
      name: 'Portland Cement',
      description: `Structural Column Concrete (${mixKey})`,
      netQty: concreteCalc.cementBags,
      wastagePct: wastagePct,
      finalQty: Math.ceil(concreteCalc.cementBags * wastageMultiplier),
      primaryUnit: 'Bags (50 kg)',
      altQty: Math.round(concreteCalc.cementBags * wastageMultiplier * CEMENT_BAG_WEIGHT_KG),
      altUnit: 'kg',
      rateKey: 'rateCement'
    },
    {
      name: 'Sand',
      description: 'Concrete fine aggregate',
      netQty: concreteCalc.sandCft,
      wastagePct: wastagePct,
      finalQty: parseFloat((concreteCalc.sandCft * wastageMultiplier).toFixed(1)),
      primaryUnit: 'CFT',
      altQty: parseFloat((concreteCalc.sandM3 * wastageMultiplier).toFixed(2)),
      altUnit: 'm³',
      rateKey: 'rateSand'
    },
    {
      name: 'Crush / Aggregate',
      description: 'Margalla / Sargodha crushed aggregate (1/2" down)',
      netQty: concreteCalc.crushCft,
      wastagePct: wastagePct,
      finalQty: parseFloat((concreteCalc.crushCft * wastageMultiplier).toFixed(1)),
      primaryUnit: 'CFT',
      altQty: parseFloat((concreteCalc.crushM3 * wastageMultiplier).toFixed(2)),
      altUnit: 'm³',
      rateKey: 'rateCrush'
    },
    {
      name: 'Steel Reinforcement (Rebar)',
      description: `Vertical Bars (${mainMm.toFixed(1)}mm) & Lateral Ties (${tieMm.toFixed(1)}mm @ ${tieSpacingRaw}")`,
      netQty: totalSteelKg,
      wastagePct: wastagePct,
      finalQty: Math.round(totalSteelKg * wastageMultiplier),
      primaryUnit: 'kg',
      altQty: parseFloat(((totalSteelKg * wastageMultiplier) / 1000.0).toFixed(3)),
      altUnit: 'Metric Tons',
      rateKey: 'rateSteel'
    }
  ];

  return {
    category: 'Columns (RCC)',
    title: document.getElementById('projectName')?.value || 'RCC Columns Estimation',
    count,
    hgtM,
    widIn: widRaw,
    depIn: depRaw,
    totalSteelKg,
    items
  };
}

/**
 * 6.L Beams (RCC) Calculator
 */
function calculateBeamMaterials(wastageMultiplier, wastagePct) {
  const isMetric = appState.unitSystem === 'metric';
  const count = parseInt(document.getElementById('beamCount')?.value) || 2;
  const spanRaw = parseFloat(document.getElementById('beamSpan')?.value) || 16;
  const widRaw = parseFloat(document.getElementById('beamWidth')?.value) || 9.0;
  const depRaw = parseFloat(document.getElementById('beamDepth')?.value) || 15.0;
  const coverRaw = parseFloat(document.getElementById('beamCover')?.value) || 1.0;
  const mixKey = document.getElementById('beamConcreteMix')?.value || '1:1.5:3';

  const spanM = convertToMeters(spanRaw, isMetric ? 'm' : 'ft');
  const widM = convertToMeters(widRaw, isMetric ? 'mm' : 'in');
  const depM = convertToMeters(depRaw, isMetric ? 'mm' : 'in');
  const coverM = convertToMeters(coverRaw, isMetric ? 'mm' : 'in');

  const totalVolM3 = widM * depM * spanM * count;
  const concreteCalc = calculateConcreteMaterials(totalVolM3, mixKey);

  // Longitudinal Bars
  const bottomMm = parseFloat(document.getElementById('beamBottomMm')?.value) || 15.8;
  const bottomCount = parseInt(document.getElementById('beamBottomCount')?.value) || 3;
  const topMm = parseFloat(document.getElementById('beamTopMm')?.value) || 12.7;
  const topCount = parseInt(document.getElementById('beamTopCount')?.value) || 2;

  // Development length & hooks allowance = span + 2 * (40 * d)
  const bottomBarLenM = spanM + 2 * (40 * (bottomMm / 1000.0));
  const topBarLenM = spanM + 2 * (40 * (topMm / 1000.0));

  const bottomSteelKg = calculateSteelWeightKg(bottomMm, bottomBarLenM * bottomCount * count);
  const topSteelKg = calculateSteelWeightKg(topMm, topBarLenM * topCount * count);

  // Stirrups
  const stirrupMm = parseFloat(document.getElementById('beamStirrupMm')?.value) || 9.5;
  const stirrupSpacingRaw = parseFloat(document.getElementById('beamStirrupSpacing')?.value) || 6.0;
  const stirrupSpacingM = convertToMeters(stirrupSpacingRaw, isMetric ? 'mm' : 'in');

  const stirrupPerimeterM = 2 * (widM - 2 * coverM) + 2 * (depM - 2 * coverM) + 24 * (stirrupMm / 1000.0);
  const numStirrupsPerBeam = Math.ceil(spanM / stirrupSpacingM) + 1;
  const totalStirrupLenM = stirrupPerimeterM * numStirrupsPerBeam * count;
  const stirrupSteelKg = calculateSteelWeightKg(stirrupMm, totalStirrupLenM);

  const totalSteelKg = bottomSteelKg + topSteelKg + stirrupSteelKg;

  const items = [
    {
      name: 'Portland Cement',
      description: `Structural Beam Concrete (${mixKey})`,
      netQty: concreteCalc.cementBags,
      wastagePct: wastagePct,
      finalQty: Math.ceil(concreteCalc.cementBags * wastageMultiplier),
      primaryUnit: 'Bags (50 kg)',
      altQty: Math.round(concreteCalc.cementBags * wastageMultiplier * CEMENT_BAG_WEIGHT_KG),
      altUnit: 'kg',
      rateKey: 'rateCement'
    },
    {
      name: 'Sand',
      description: 'Concrete fine aggregate',
      netQty: concreteCalc.sandCft,
      wastagePct: wastagePct,
      finalQty: parseFloat((concreteCalc.sandCft * wastageMultiplier).toFixed(1)),
      primaryUnit: 'CFT',
      altQty: parseFloat((concreteCalc.sandM3 * wastageMultiplier).toFixed(2)),
      altUnit: 'm³',
      rateKey: 'rateSand'
    },
    {
      name: 'Crush / Aggregate',
      description: 'Coarse crushed stone aggregate',
      netQty: concreteCalc.crushCft,
      wastagePct: wastagePct,
      finalQty: parseFloat((concreteCalc.crushCft * wastageMultiplier).toFixed(1)),
      primaryUnit: 'CFT',
      altQty: parseFloat((concreteCalc.crushM3 * wastageMultiplier).toFixed(2)),
      altUnit: 'm³',
      rateKey: 'rateCrush'
    },
    {
      name: 'Steel Reinforcement (Rebar)',
      description: `Bottom (${bottomMm.toFixed(1)}mm), Top (${topMm.toFixed(1)}mm), & Stirrups (${stirrupMm.toFixed(1)}mm)`,
      netQty: totalSteelKg,
      wastagePct: wastagePct,
      finalQty: Math.round(totalSteelKg * wastageMultiplier),
      primaryUnit: 'kg',
      altQty: parseFloat(((totalSteelKg * wastageMultiplier) / 1000.0).toFixed(3)),
      altUnit: 'Metric Tons',
      rateKey: 'rateSteel'
    }
  ];

  return {
    category: 'Beams (RCC)',
    title: document.getElementById('projectName')?.value || 'RCC Beams Estimation',
    count,
    spanM,
    totalSteelKg,
    items
  };
}

/**
 * 6.M Plastering Calculator
 */
function calculatePlasterMaterials(wastageMultiplier, wastagePct) {
  const isMetric = appState.unitSystem === 'metric';
  const lenRaw = parseFloat(document.getElementById('plasterLength')?.value) || 30;
  const hgtRaw = parseFloat(document.getElementById('plasterHeight')?.value) || 10.5;
  const faces = parseInt(document.getElementById('plasterFaces')?.value) || 1;
  const thkRaw = parseFloat(document.getElementById('plasterThick')?.value) || 0.5;
  const ratioKey = document.getElementById('plasterRatio')?.value || '1:4';
  const unevenPct = parseFloat(document.getElementById('plasterUnevenFactor')?.value) || 20;

  const lenM = convertToMeters(lenRaw, isMetric ? 'm' : 'ft');
  const hgtM = convertToMeters(hgtRaw, isMetric ? 'm' : 'ft');
  const thkM = convertToMeters(thkRaw, isMetric ? 'mm' : 'in');

  const grossAreaM2 = lenM * hgtM * faces;
  const openingsAreaM2 = getTotalOpeningsAreaM2();
  const netAreaM2 = Math.max(0, grossAreaM2 - openingsAreaM2);

  // Wet volume = net area * thickness + unevenness allowance (20%)
  const baseWetM3 = netAreaM2 * thkM;
  const totalWetM3 = baseWetM3 * (1.0 + (unevenPct / 100.0));

  const mortarCalc = calculateMortarMaterials(totalWetM3, ratioKey);

  const items = [
    {
      name: 'Portland Cement',
      description: `Plaster Mortar (${ratioKey} mix)`,
      netQty: mortarCalc.cementBags,
      wastagePct: wastagePct,
      finalQty: Math.ceil(mortarCalc.cementBags * wastageMultiplier),
      primaryUnit: 'Bags (50 kg)',
      altQty: Math.round(mortarCalc.cementBags * wastageMultiplier * CEMENT_BAG_WEIGHT_KG),
      altUnit: 'kg',
      rateKey: 'rateCement'
    },
    {
      name: 'Plaster Sand',
      description: 'Screened fine river sand (sieved)',
      netQty: mortarCalc.sandCft,
      wastagePct: wastagePct,
      finalQty: parseFloat((mortarCalc.sandCft * wastageMultiplier).toFixed(1)),
      primaryUnit: 'CFT',
      altQty: parseFloat((mortarCalc.sandM3 * wastageMultiplier).toFixed(2)),
      altUnit: 'm³',
      rateKey: 'rateSand'
    },
    {
      name: 'Mixing & Curing Water',
      description: 'Water requirement for plastering & 7-day curing',
      netQty: Math.round(mortarCalc.cementBags * 25),
      wastagePct: wastagePct,
      finalQty: Math.round(mortarCalc.cementBags * wastageMultiplier * 25),
      primaryUnit: 'Liters',
      altQty: Math.round(mortarCalc.cementBags * wastageMultiplier * 25 * 0.264172),
      altUnit: 'Gallons',
      rateKey: null
    }
  ];

  return {
    category: 'Plastering',
    title: document.getElementById('projectName')?.value || 'Wall Plastering Estimation',
    netAreaSqFt: netAreaM2 * 10.7639,
    faces,
    ratioKey,
    thkMm: (thkM * 1000).toFixed(1),
    items
  };
}

/**
 * 6.N Direct Brick Masonry Calculator
 */
function calculateBrickMasonryDirect(wastageMultiplier, wastagePct) {
  const isMetric = appState.unitSystem === 'metric';
  const mode = document.getElementById('masonryMode')?.value || 'dimensions';
  let totalVolM3 = 0;

  if (mode === 'direct_volume') {
    const volRaw = parseFloat(document.getElementById('masDirectVol')?.value) || 350;
    totalVolM3 = isMetric ? volRaw : (volRaw / CFT_PER_CUBIC_METER);
  } else {
    const lRaw = parseFloat(document.getElementById('masLength')?.value) || 20;
    const wRaw = parseFloat(document.getElementById('masWidth')?.value) || 0.75;
    const hRaw = parseFloat(document.getElementById('masHeight')?.value) || 10;
    const lM = convertToMeters(lRaw, isMetric ? 'm' : 'ft');
    const wM = convertToMeters(wRaw, isMetric ? 'm' : 'ft');
    const hM = convertToMeters(hRaw, isMetric ? 'm' : 'ft');
    totalVolM3 = lM * wM * hM;
  }

  const ratioKey = document.getElementById('masonryMortarRatio')?.value || '1:6';
  const brickCalc = calculateBrickQuantity(totalVolM3);
  const mortarCalc = calculateMortarMaterials(brickCalc.wetMortarM3, ratioKey);

  const items = [
    {
      name: 'Bricks',
      description: 'Standard burnt clay masonry bricks',
      netQty: brickCalc.netBricks,
      wastagePct: wastagePct,
      finalQty: Math.ceil(brickCalc.netBricks * wastageMultiplier),
      primaryUnit: 'Pieces',
      altQty: Math.ceil(brickCalc.netBricks * wastageMultiplier),
      altUnit: 'Nos',
      rateKey: 'rateBrick'
    },
    {
      name: 'Portland Cement',
      description: `Brickwork Mortar (${ratioKey})`,
      netQty: mortarCalc.cementBags,
      wastagePct: wastagePct,
      finalQty: Math.ceil(mortarCalc.cementBags * wastageMultiplier),
      primaryUnit: 'Bags (50 kg)',
      altQty: Math.round(mortarCalc.cementBags * wastageMultiplier * CEMENT_BAG_WEIGHT_KG),
      altUnit: 'kg',
      rateKey: 'rateCement'
    },
    {
      name: 'Masonry Sand',
      description: 'River sand for brick joint mortar',
      netQty: mortarCalc.sandCft,
      wastagePct: wastagePct,
      finalQty: parseFloat((mortarCalc.sandCft * wastageMultiplier).toFixed(1)),
      primaryUnit: 'CFT',
      altQty: parseFloat((mortarCalc.sandM3 * wastageMultiplier).toFixed(2)),
      altUnit: 'm³',
      rateKey: 'rateSand'
    }
  ];

  return {
    category: 'Brick Masonry',
    title: document.getElementById('projectName')?.value || 'Brick Masonry Estimation',
    totalVolCft: totalVolM3 * CFT_PER_CUBIC_METER,
    ratioKey,
    items
  };
}

/**
 * 6.O PCC Materials Calculator
 */
function calculatePccMaterials(wastageMultiplier, wastagePct) {
  const isMetric = appState.unitSystem === 'metric';
  const lenRaw = parseFloat(document.getElementById('pccLength')?.value) || 15;
  const widRaw = parseFloat(document.getElementById('pccWidth')?.value) || 10;
  const thkRaw = parseFloat(document.getElementById('pccThick')?.value) || 4;
  const count = parseInt(document.getElementById('pccCount')?.value) || 1;
  const mixKey = document.getElementById('pccMixRatio')?.value || '1:3:6';

  const lenM = convertToMeters(lenRaw, isMetric ? 'm' : 'ft');
  const widM = convertToMeters(widRaw, isMetric ? 'm' : 'ft');
  const thkM = convertToMeters(thkRaw, isMetric ? 'mm' : 'in');

  const totalVolM3 = lenM * widM * thkM * count;
  const concreteCalc = calculateConcreteMaterials(totalVolM3, mixKey);

  const items = [
    {
      name: 'Portland Cement',
      description: `PCC Plain Concrete (${mixKey})`,
      netQty: concreteCalc.cementBags,
      wastagePct: wastagePct,
      finalQty: Math.ceil(concreteCalc.cementBags * wastageMultiplier),
      primaryUnit: 'Bags (50 kg)',
      altQty: Math.round(concreteCalc.cementBags * wastageMultiplier * CEMENT_BAG_WEIGHT_KG),
      altUnit: 'kg',
      rateKey: 'rateCement'
    },
    {
      name: 'Sand',
      description: 'Fine concrete sand',
      netQty: concreteCalc.sandCft,
      wastagePct: wastagePct,
      finalQty: parseFloat((concreteCalc.sandCft * wastageMultiplier).toFixed(1)),
      primaryUnit: 'CFT',
      altQty: parseFloat((concreteCalc.sandM3 * wastageMultiplier).toFixed(2)),
      altUnit: 'm³',
      rateKey: 'rateSand'
    },
    {
      name: 'Crush / Aggregate',
      description: 'Crushed stone aggregate for PCC',
      netQty: concreteCalc.crushCft,
      wastagePct: wastagePct,
      finalQty: parseFloat((concreteCalc.crushCft * wastageMultiplier).toFixed(1)),
      primaryUnit: 'CFT',
      altQty: parseFloat((concreteCalc.crushM3 * wastageMultiplier).toFixed(2)),
      altUnit: 'm³',
      rateKey: 'rateCrush'
    }
  ];

  return {
    category: 'PCC Concrete',
    title: document.getElementById('projectName')?.value || 'PCC Plain Concrete Estimation',
    totalVolCft: totalVolM3 * CFT_PER_CUBIC_METER,
    mixKey,
    items
  };
}

/**
 * 6.P RCC General Calculator
 */
function calculateRccGeneralMaterials(wastageMultiplier, wastagePct) {
  const isMetric = appState.unitSystem === 'metric';
  const lenRaw = parseFloat(document.getElementById('rccLength')?.value) || 20;
  const widRaw = parseFloat(document.getElementById('rccWidth')?.value) || 12;
  const thkRaw = parseFloat(document.getElementById('rccThick')?.value) || 6;
  const mixKey = document.getElementById('rccMixRatio')?.value || '1:1.5:3';
  const steelMethod = document.getElementById('rccSteelMethod')?.value || 'percentage';

  const lenM = convertToMeters(lenRaw, isMetric ? 'm' : 'ft');
  const widM = convertToMeters(widRaw, isMetric ? 'm' : 'ft');
  const thkM = convertToMeters(thkRaw, isMetric ? 'mm' : 'in');

  const totalVolM3 = lenM * widM * thkM;
  const concreteCalc = calculateConcreteMaterials(totalVolM3, mixKey);

  let steelKg = 0;
  if (steelMethod === 'percentage') {
    const percent = parseFloat(document.getElementById('rccSteelPercent')?.value) || 1.0;
    // Steel volume = concreteVol * percent / 100
    // Weight = steelVol * 7850 kg/m3
    const steelVolM3 = totalVolM3 * (percent / 100.0);
    steelKg = steelVolM3 * STEEL_DENSITY_KG_M3;
  } else {
    // Sutar based calculation
    const mainMm = parseFloat(document.getElementById('slabMainMm')?.value) || 12.7;
    const distMm = parseFloat(document.getElementById('slabDistMm')?.value) || 9.5;
    const mainSpacingRaw = parseFloat(document.getElementById('slabMainSpacing')?.value) || 6.0;
    const distSpacingRaw = parseFloat(document.getElementById('slabDistSpacing')?.value) || 8.0;
    const mainSpacingM = convertToMeters(mainSpacingRaw, isMetric ? 'mm' : 'in');
    const distSpacingM = convertToMeters(distSpacingRaw, isMetric ? 'mm' : 'in');

    const numMain = Math.ceil(widM / mainSpacingM) + 1;
    const numDist = Math.ceil(lenM / distSpacingM) + 1;
    steelKg = calculateSteelWeightKg(mainMm, lenM * numMain * 1.1) + calculateSteelWeightKg(distMm, widM * numDist);
  }

  const items = [
    {
      name: 'Portland Cement',
      description: `RCC Concrete (${mixKey})`,
      netQty: concreteCalc.cementBags,
      wastagePct: wastagePct,
      finalQty: Math.ceil(concreteCalc.cementBags * wastageMultiplier),
      primaryUnit: 'Bags (50 kg)',
      altQty: Math.round(concreteCalc.cementBags * wastageMultiplier * CEMENT_BAG_WEIGHT_KG),
      altUnit: 'kg',
      rateKey: 'rateCement'
    },
    {
      name: 'Sand',
      description: 'Fine concrete aggregate',
      netQty: concreteCalc.sandCft,
      wastagePct: wastagePct,
      finalQty: parseFloat((concreteCalc.sandCft * wastageMultiplier).toFixed(1)),
      primaryUnit: 'CFT',
      altQty: parseFloat((concreteCalc.sandM3 * wastageMultiplier).toFixed(2)),
      altUnit: 'm³',
      rateKey: 'rateSand'
    },
    {
      name: 'Crush / Aggregate',
      description: 'Coarse stone aggregate',
      netQty: concreteCalc.crushCft,
      wastagePct: wastagePct,
      finalQty: parseFloat((concreteCalc.crushCft * wastageMultiplier).toFixed(1)),
      primaryUnit: 'CFT',
      altQty: parseFloat((concreteCalc.crushM3 * wastageMultiplier).toFixed(2)),
      altUnit: 'm³',
      rateKey: 'rateCrush'
    },
    {
      name: 'Steel Reinforcement (Rebar)',
      description: `Deformed Steel Bars (${steelMethod === 'percentage' ? 'Rule of Thumb %' : 'Explicit Rebar'})`,
      netQty: steelKg,
      wastagePct: wastagePct,
      finalQty: Math.round(steelKg * wastageMultiplier),
      primaryUnit: 'kg',
      altQty: parseFloat(((steelKg * wastageMultiplier) / 1000.0).toFixed(3)),
      altUnit: 'Metric Tons',
      rateKey: 'rateSteel'
    }
  ];

  return {
    category: 'RCC Concrete',
    title: document.getElementById('projectName')?.value || 'RCC Reinforced Concrete Estimation',
    totalVolCft: totalVolM3 * CFT_PER_CUBIC_METER,
    steelKg,
    mixKey,
    items
  };
}

/**
 * 6.Q Staircase Calculator
 */
function calculateStaircaseMaterials(wastageMultiplier, wastagePct) {
  const isMetric = appState.unitSystem === 'metric';
  const flightLenRaw = parseFloat(document.getElementById('stairFlightLength')?.value) || 11.5;
  const widthRaw = parseFloat(document.getElementById('stairWidth')?.value) || 3.5;
  const waistThkRaw = parseFloat(document.getElementById('stairWaistThick')?.value) || 6.0;
  const stepsCount = parseInt(document.getElementById('stairStepsCount')?.value) || 10;
  const riserRaw = parseFloat(document.getElementById('stairRiser')?.value) || 7.0;
  const treadRaw = parseFloat(document.getElementById('stairTread')?.value) || 10.0;
  const landingLenRaw = parseFloat(document.getElementById('stairLandingLength')?.value) || 3.5;
  const mixKey = document.getElementById('stairConcreteMix')?.value || '1:2:4';

  const flightLenM = convertToMeters(flightLenRaw, isMetric ? 'm' : 'ft');
  const widthM = convertToMeters(widthRaw, isMetric ? 'm' : 'ft');
  const waistThkM = convertToMeters(waistThkRaw, isMetric ? 'mm' : 'in');
  const riserM = convertToMeters(riserRaw, isMetric ? 'mm' : 'in');
  const treadM = convertToMeters(treadRaw, isMetric ? 'mm' : 'in');
  const landingLenM = convertToMeters(landingLenRaw, isMetric ? 'm' : 'ft');

  // Concrete volumes:
  // 1. Inclined waist slab: flightLen * width * waistThk
  const waistVolM3 = flightLenM * widthM * waistThkM;
  // 2. Steps triangular volume: 0.5 * riser * tread * width * stepsCount
  const stepsVolM3 = 0.5 * riserM * treadM * widthM * stepsCount;
  // 3. Landing slab: landingLen * width * waistThk
  const landingVolM3 = landingLenM * widthM * waistThkM;

  const totalVolM3 = waistVolM3 + stepsVolM3 + landingVolM3;
  const concreteCalc = calculateConcreteMaterials(totalVolM3, mixKey);

  // Stair rebar: Main waist slab bars (4 sutar @ 6" c/c) + distribution (3 sutar @ 8" c/c)
  const mainMm = parseFloat(document.getElementById('stairMainMm')?.value) || 12.7;
  const distMm = parseFloat(document.getElementById('stairDistMm')?.value) || 9.5;
  const mainSpacingRaw = parseFloat(document.getElementById('stairMainSpacing')?.value) || 6.0;
  const distSpacingRaw = parseFloat(document.getElementById('stairDistSpacing')?.value) || 8.0;
  const mainSpacingM = convertToMeters(mainSpacingRaw, isMetric ? 'mm' : 'in');
  const distSpacingM = convertToMeters(distSpacingRaw, isMetric ? 'mm' : 'in');

  const numMain = Math.ceil(widthM / mainSpacingM) + 1;
  const mainBarLenM = flightLenM + landingLenM + 0.6; // hooks & development
  const mainSteelKg = calculateSteelWeightKg(mainMm, mainBarLenM * numMain);

  const numDist = Math.ceil((flightLenM + landingLenM) / distSpacingM) + 1;
  const distBarLenM = widthM;
  const distSteelKg = calculateSteelWeightKg(distMm, distBarLenM * numDist);

  const totalSteelKg = mainSteelKg + distSteelKg;

  const items = [
    {
      name: 'Portland Cement',
      description: `Staircase Structural Concrete (${mixKey})`,
      netQty: concreteCalc.cementBags,
      wastagePct: wastagePct,
      finalQty: Math.ceil(concreteCalc.cementBags * wastageMultiplier),
      primaryUnit: 'Bags (50 kg)',
      altQty: Math.round(concreteCalc.cementBags * wastageMultiplier * CEMENT_BAG_WEIGHT_KG),
      altUnit: 'kg',
      rateKey: 'rateCement'
    },
    {
      name: 'Sand',
      description: 'Concrete fine aggregate',
      netQty: concreteCalc.sandCft,
      wastagePct: wastagePct,
      finalQty: parseFloat((concreteCalc.sandCft * wastageMultiplier).toFixed(1)),
      primaryUnit: 'CFT',
      altQty: parseFloat((concreteCalc.sandM3 * wastageMultiplier).toFixed(2)),
      altUnit: 'm³',
      rateKey: 'rateSand'
    },
    {
      name: 'Crush / Aggregate',
      description: 'Coarse stone aggregate',
      netQty: concreteCalc.crushCft,
      wastagePct: wastagePct,
      finalQty: parseFloat((concreteCalc.crushCft * wastageMultiplier).toFixed(1)),
      primaryUnit: 'CFT',
      altQty: parseFloat((concreteCalc.crushM3 * wastageMultiplier).toFixed(2)),
      altUnit: 'm³',
      rateKey: 'rateCrush'
    },
    {
      name: 'Steel Reinforcement (Rebar)',
      description: `Waist slab main (${mainMm.toFixed(1)}mm) & distribution (${distMm.toFixed(1)}mm) bars`,
      netQty: totalSteelKg,
      wastagePct: wastagePct,
      finalQty: Math.round(totalSteelKg * wastageMultiplier),
      primaryUnit: 'kg',
      altQty: parseFloat(((totalSteelKg * wastageMultiplier) / 1000.0).toFixed(3)),
      altUnit: 'Metric Tons',
      rateKey: 'rateSteel'
    }
  ];

  return {
    category: 'Staircase',
    title: document.getElementById('projectName')?.value || 'RCC Staircase Estimation',
    stepsCount,
    totalSteelKg,
    totalVolCft: totalVolM3 * CFT_PER_CUBIC_METER,
    items
  };
}

/**
 * 6.R Custom Construction Calculator
 */
function calculateCustomMaterials(wastageMultiplier, wastagePct) {
  const isMetric = appState.unitSystem === 'metric';
  const lenRaw = parseFloat(document.getElementById('customLength')?.value) || 15;
  const widRaw = parseFloat(document.getElementById('customWidth')?.value) || 10;
  const depRaw = parseFloat(document.getElementById('customDepth')?.value) || 3;
  const cPart = parseFloat(document.getElementById('customPartC')?.value) || 1;
  const sPart = parseFloat(document.getElementById('customPartS')?.value) || 2;
  const aPart = parseFloat(document.getElementById('customPartA')?.value) || 4;
  const dryFactor = parseFloat(document.getElementById('customDryFactor')?.value) || 1.54;

  const lenM = convertToMeters(lenRaw, isMetric ? 'm' : 'ft');
  const widM = convertToMeters(widRaw, isMetric ? 'm' : 'ft');
  const depM = convertToMeters(depRaw, isMetric ? 'm' : 'ft');

  const totalVolM3 = lenM * widM * depM;
  const sum = cPart + sPart + aPart;
  const dryVolM3 = totalVolM3 * dryFactor;

  const cementM3 = dryVolM3 * (cPart / sum);
  const sandM3 = dryVolM3 * (sPart / sum);
  const crushM3 = dryVolM3 * (aPart / sum);

  const cementBags = cementM3 / CEMENT_BAG_VOL_M3;
  const sandCft = sandM3 * CFT_PER_CUBIC_METER;
  const crushCft = crushM3 * CFT_PER_CUBIC_METER;

  const items = [
    {
      name: 'Portland Cement',
      description: `Custom Mix Ratio (${cPart}:${sPart}:${aPart})`,
      netQty: cementBags,
      wastagePct: wastagePct,
      finalQty: Math.ceil(cementBags * wastageMultiplier),
      primaryUnit: 'Bags (50 kg)',
      altQty: Math.round(cementBags * wastageMultiplier * CEMENT_BAG_WEIGHT_KG),
      altUnit: 'kg',
      rateKey: 'rateCement'
    },
    {
      name: 'Sand',
      description: 'Fine aggregate volume',
      netQty: sandCft,
      wastagePct: wastagePct,
      finalQty: parseFloat((sandCft * wastageMultiplier).toFixed(1)),
      primaryUnit: 'CFT',
      altQty: parseFloat((sandM3 * wastageMultiplier).toFixed(2)),
      altUnit: 'm³',
      rateKey: 'rateSand'
    }
  ];

  if (aPart > 0) {
    items.push({
      name: 'Crush / Coarse Aggregate',
      description: 'Coarse aggregate volume',
      netQty: crushCft,
      wastagePct: wastagePct,
      finalQty: parseFloat((crushCft * wastageMultiplier).toFixed(1)),
      primaryUnit: 'CFT',
      altQty: parseFloat((crushM3 * wastageMultiplier).toFixed(2)),
      altUnit: 'm³',
      rateKey: 'rateCrush'
    });
  }

  return {
    category: 'Custom Specification',
    title: document.getElementById('projectName')?.value || 'Custom Construction Estimation',
    totalVolCft: totalVolM3 * CFT_PER_CUBIC_METER,
    items
  };
}

/* ============================================================================
   7. COST ESTIMATOR ENGINE
   ============================================================================ */

function calculateTotalCost(result) {
  let grandTotalCost = 0;

  result.items.forEach(item => {
    let unitRate = 0;
    if (item.rateKey) {
      const inputEl = document.getElementById(item.rateKey);
      unitRate = inputEl ? parseFloat(inputEl.value) || 0 : 0;
    }
    const itemCost = item.finalQty * unitRate;
    item.unitRate = unitRate;
    item.itemCost = Math.round(itemCost);
    grandTotalCost += item.itemCost;
  });

  // Optional labor cost
  const laborRateInput = document.getElementById('rateLabor');
  const laborRate = laborRateInput ? parseFloat(laborRateInput.value) || 0 : 0;
  result.laborCost = 0;

  if (laborRate > 0) {
    // If user entered a rate, calculate either based on area or lump sum
    const areaSqFt = result.netAreaSqFt || (result.netAreaM2 ? result.netAreaM2 * 10.7639 : 0);
    if (areaSqFt > 0) {
      result.laborCost = Math.round(areaSqFt * laborRate);
    } else {
      result.laborCost = Math.round(laborRate);
    }
    grandTotalCost += result.laborCost;
  }

  result.grandTotalCost = grandTotalCost;
  return result;
}

/* ============================================================================
   8. PLAIN-LANGUAGE NARRATIVE & ASSUMPTIONS ENGINE
   ============================================================================ */

/**
 * Generates plain-language civil engineering summary
 */
function generateResultDescription(result) {
  const isMetric = appState.unitSystem === 'metric';
  const unitSysName = isMetric ? 'Metric (SI)' : 'Imperial (FPS)';
  const wastage = document.getElementById('wastageAllowance')?.value || '5';
  let p = '';

  const bricksItem = result.items.find(i => i.name === 'Bricks');
  const cementItem = result.items.find(i => i.name.includes('Cement'));
  const sandItem = result.items.find(i => i.name.includes('Sand'));
  const crushItem = result.items.find(i => i.name.includes('Crush'));
  const steelItem = result.items.find(i => i.name.includes('Steel'));

  switch (result.category) {
    case 'Brick Wall':
      const grossArea = isMetric ? result.grossAreaM2.toFixed(1) : (result.grossAreaM2 * 10.7639).toFixed(1);
      const netArea = isMetric ? result.netAreaM2.toFixed(1) : (result.netAreaM2 * 10.7639).toFixed(1);
      const areaUnit = isMetric ? 'square meters' : 'square feet';

      p = `<p>Your brick wall has a <strong>gross surface area of ${grossArea} ${areaUnit}</strong>. `;
      if (result.openingsAreaM2 > 0) {
        const opArea = isMetric ? result.openingsAreaM2.toFixed(1) : (result.openingsAreaM2 * 10.7639).toFixed(1);
        p += `After deducting ${opArea} ${areaUnit} of door and window openings, the <strong>net brickwork area is ${netArea} ${areaUnit}</strong>. `;
      } else {
        p += `With no openings deducted, the net brickwork area equals the gross area. `;
      }

      p += `Based on the selected <strong>${result.thickInches}" wall thickness</strong>, standard Pakistani brick dimensions, and a <strong>${wastage}% site wastage allowance</strong>, your estimated brick requirement is approximately <span class="narrative-highlight">${bricksItem?.finalQty.toLocaleString()} bricks</span>.</p>`;

      p += `<p>The estimated mortar requirement is <span class="narrative-highlight">${cementItem?.finalQty.toLocaleString()} cement bags</span> (50 kg each) and <span class="narrative-highlight">${sandItem?.finalQty.toLocaleString()} cubic feet of sand</span> (${sandItem?.altQty} m³). These quantities are derived using a <strong>${result.mortarRatio} mortar mix ratio</strong> and a standard 33% dry volume expansion factor.</p>`;
      break;

    case 'Roof / RCC Slab':
      const volCft = (result.wetVolumeM3 * CFT_PER_CUBIC_METER).toFixed(1);
      p = `<p>Your reinforced concrete roof slab measures <strong>${result.lenM.toFixed(1)}m × ${result.widM.toFixed(1)}m</strong> with a structural thickness of <strong>${result.thkInches}"</strong>. The total wet concrete volume is <strong>${result.wetVolumeM3.toFixed(2)} m³ (${volCft} CFT)</strong> across ${result.slabCount} slab section(s).</p>`;

      p += `<p>Using the specified <strong>${result.concreteMix} concrete mix</strong> with a 54% dry volume factor, the estimated cement requirement is <span class="narrative-highlight">${cementItem?.finalQty.toLocaleString()} bags</span>, along with <span class="narrative-highlight">${sandItem?.finalQty.toLocaleString()} CFT of sand</span> and <span class="narrative-highlight">${crushItem?.finalQty.toLocaleString()} CFT of crush</span> (coarse aggregate).</p>`;

      p += `<p>Steel reinforcement detailing accounts for explicit 2-way layout: <strong>${result.numMainBars} main bars</strong> (${result.mainMm.toFixed(1)} mm diameter) running in the short span with end hooks, and <strong>${result.numDistBars} distribution bars</strong> (${result.distMm.toFixed(1)} mm diameter). Total estimated steel requirement is <span class="narrative-highlight">${steelItem?.finalQty.toLocaleString()} kg</span> (${steelItem?.altQty} metric tons) including a ${wastage}% cutting and lap wastage allowance.</p>`;
      break;

    case 'Single Room':
      p = `<p>This comprehensive estimate for your <strong>${result.roomDims} room</strong> synthesizes all major structural stages: trench excavation, foundation PCC base (1:4:8), stepped brick footing, superstructure brick masonry, 6" RCC roof slab, 4" floor concrete, and internal/external wall plastering.</p>`;

      p += `<p>Overall material procurement requirements are <span class="narrative-highlight">${bricksItem?.finalQty.toLocaleString()} bricks</span>, <span class="narrative-highlight">${cementItem?.finalQty.toLocaleString()} cement bags</span>, <span class="narrative-highlight">${sandItem?.finalQty.toLocaleString()} CFT of sand</span>, and <span class="narrative-highlight">${crushItem?.finalQty.toLocaleString()} CFT of crush</span>. The RCC slab requires approximately <span class="narrative-highlight">${steelItem?.finalQty.toLocaleString()} kg</span> of Grade 60 rebar.</p>`;
      break;

    case 'Complete House':
      p = `<p>This complete multi-storey house estimate is based on a <strong>total covered area of ${result.coveredAreaSqFt.toLocaleString()} sq.ft</strong> across <strong>${result.storeys} storey(s)</strong> under Pakistani LDA and PEC residential building standards.</p>`;

      p += `<p>Total estimated quantities for the complete grey structure are <span class="narrative-highlight">${bricksItem?.finalQty.toLocaleString()} bricks</span>, <span class="narrative-highlight">${cementItem?.finalQty.toLocaleString()} cement bags</span>, <span class="narrative-highlight">${sandItem?.finalQty.toLocaleString()} CFT of sand</span>, <span class="narrative-highlight">${crushItem?.finalQty.toLocaleString()} CFT of crush</span>, and <span class="narrative-highlight">${steelItem?.finalQty.toLocaleString()} kg (${steelItem?.altQty} tons)</span> of Grade 60 reinforcement steel.</p>`;
      break;

    default:
      p = `<p>Preliminary quantity surveying calculation for <strong>${result.category}</strong> completed using the <strong>${unitSysName}</strong> measurement system. All calculations incorporate a documented <strong>${wastage}% wastage allowance</strong> to accommodate site handling, cut ends, and uneven surfaces.</p>`;
      if (cementItem) {
        p += `<p>Estimated material demand comprises <span class="narrative-highlight">${cementItem.finalQty} cement bags</span>, ${sandItem ? `<span class="narrative-highlight">${sandItem.finalQty} ${sandItem.primaryUnit} sand</span>` : ''}, and ${crushItem ? `<span class="narrative-highlight">${crushItem.finalQty} ${crushItem.primaryUnit} crush</span>` : ''}.</p>`;
      }
      break;
  }

  // Cost summary sentence
  if (result.grandTotalCost > 0) {
    p += `<p>At current market rates entered, the total estimated material expenditure is <strong class="text-success">PKR ${result.grandTotalCost.toLocaleString()}</strong> (Pakistani Rupees). This estimate excludes taxes, freight, and unloading unless factored into unit rates.</p>`;
  }

  return p;
}

/**
 * Builds detailed technical assumptions and formula explanations
 */
function buildAssumptionsHtml(result) {
  const isMetric = appState.unitSystem === 'metric';
  let html = `
    <div class="assumption-box">
      <h4>1. Core Engineering Formulas Applied</h4>
      <span class="formula-code">Wall Net Area = (Length × Height × Wall Count) − Total Openings Area</span>
      <span class="formula-code">Dry Concrete Volume = Wet Compacted Volume × 1.54 (54% void factor)</span>
      <span class="formula-code">Dry Mortar Volume = Wet Mortar Volume × 1.33 (33% shrinkage & void factor)</span>
      <span class="formula-code">Cement Quantity (Bags) = (Dry Volume × Cement Part ÷ Sum of Ratios) ÷ 0.03472 m³ (or 1.25 CFT)</span>
      <span class="formula-code">Steel Rebar Weight (kg) = Diameter² (mm) × Total Bar Length (m) ÷ 162.196</span>
    </div>

    <div class="assumption-box">
      <h4>2. Pakistani Trade Dimensions & Material Constants</h4>
      <ul>
        <li><strong>Standard Brick:</strong> Nominal size 9" × 4.5" × 3" (228.6 × 114.3 × 76.2 mm). Mortar joint thickness: 3/8" (10 mm).</li>
        <li><strong>Cement Bag:</strong> Standard 50 kg Portland Cement bag with bulk density of 1,440 kg/m³ (~1.25 CFT / 0.03472 m³).</li>
        <li><strong>Steel Rebar (Sutar System):</strong> 3 Sutar = 9.5 mm, 4 Sutar = 12.7 mm, 5 Sutar = 15.8 mm, 6 Sutar = 19.0 mm, 8 Sutar = 25.4 mm. Unit weight calculated strictly on verified mm diameter.</li>
        <li><strong>Water-Cement Ratio:</strong> Defensible estimate calculated at 0.50 W/C ratio (~26 to 28 Liters of potable water per 50 kg cement bag).</li>
      </ul>
    </div>

    <div class="assumption-box">
      <h4>3. Wastage & Site Factors</h4>
      <p>A single <strong>${document.getElementById('wastageAllowance')?.value || '5'}% site wastage allowance</strong> has been applied to gross quantities. Wastage is calculated once on final quantities to avoid compounding errors.</p>
    </div>
  `;

  return html;
}

/* ============================================================================
   9. RESULTS RENDERING & DASHBOARD
   ============================================================================ */

function renderResults(result) {
  const container = document.getElementById('resultsContainer');
  const placeholder = document.getElementById('resultsPlaceholder');
  if (!container || !placeholder) return;

  placeholder.style.display = 'none';
  container.style.display = 'block';

  // Header Title & Meta
  document.getElementById('resTagCategory').textContent = result.category;
  document.getElementById('resReportTitle').textContent = result.title;
  const loc = document.getElementById('projectLocation')?.value || 'Pakistan';
  const now = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  document.getElementById('resReportMeta').textContent = `Location: ${loc} • Date: ${now} • Unit System: ${appState.unitSystem.toUpperCase()}`;

  // KPI Summary Cards
  renderSummaryCards(result);

  // Narrative
  document.getElementById('resultNarrative').innerHTML = result.narrative;

  // BOQ Table
  renderBoqTable(result);

  // Assumptions
  document.getElementById('assumptionsContent').innerHTML = buildAssumptionsHtml(result);

  // Smooth scroll to results on mobile
  if (window.innerWidth < 1080) {
    container.scrollIntoView({ behavior: 'smooth' });
  }
}

function renderSummaryCards(result) {
  const grid = document.getElementById('summaryCardsGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const cardsData = [];

  const bricksItem = result.items.find(i => i.name === 'Bricks');
  if (bricksItem) {
    cardsData.push({
      cls: 'kpi-brick',
      icon: '🧱',
      title: 'Total Bricks',
      val: bricksItem.finalQty.toLocaleString(),
      unit: 'Pieces',
      alt: `Net: ${bricksItem.netQty.toLocaleString()}`
    });
  }

  const cementItem = result.items.find(i => i.name.includes('Cement'));
  if (cementItem) {
    cardsData.push({
      cls: 'kpi-cement',
      icon: '🏛️',
      title: 'Cement Bags',
      val: cementItem.finalQty.toLocaleString(),
      unit: 'Bags (50 kg)',
      alt: `${cementItem.altQty.toLocaleString()} kg`
    });
  }

  const sandItem = result.items.find(i => i.name.includes('Sand'));
  if (sandItem) {
    cardsData.push({
      cls: 'kpi-sand',
      icon: '🏖️',
      title: 'Sand Volume',
      val: sandItem.finalQty.toLocaleString(),
      unit: sandItem.primaryUnit,
      alt: `${sandItem.altQty} ${sandItem.altUnit}`
    });
  }

  const crushItem = result.items.find(i => i.name.includes('Crush'));
  if (crushItem) {
    cardsData.push({
      cls: 'kpi-crush',
      icon: '🪨',
      title: 'Crush Aggregate',
      val: crushItem.finalQty.toLocaleString(),
      unit: crushItem.primaryUnit,
      alt: `${crushItem.altQty} ${crushItem.altUnit}`
    });
  }

  const steelItem = result.items.find(i => i.name.includes('Steel'));
  if (steelItem) {
    cardsData.push({
      cls: 'kpi-steel',
      icon: '🔩',
      title: 'Steel Rebar',
      val: steelItem.finalQty.toLocaleString(),
      unit: 'kg',
      alt: `${steelItem.altQty} Metric Tons`
    });
  }

  if (result.grandTotalCost > 0) {
    cardsData.push({
      cls: 'kpi-cost',
      icon: '💰',
      title: 'Estimated Cost',
      val: 'Rs. ' + result.grandTotalCost.toLocaleString(),
      unit: 'PKR',
      alt: 'Materials Total'
    });
  }

  cardsData.forEach(cd => {
    const div = document.createElement('div');
    div.className = `kpi-card ${cd.cls}`;
    div.innerHTML = `
      <div class="kpi-header">
        <span class="kpi-title">${cd.title}</span>
        <span class="kpi-icon">${cd.icon}</span>
      </div>
      <div class="kpi-value">${cd.val}</div>
      <div class="kpi-unit">${cd.unit}</div>
      <div class="kpi-alt-val">${cd.alt}</div>
    `;
    grid.appendChild(div);
  });
}

function renderBoqTable(result) {
  const tbody = document.getElementById('boqTableBody');
  const tfoot = document.getElementById('boqTableFoot');
  const countBadge = document.getElementById('boqItemsCount');
  if (!tbody || !tfoot) return;

  tbody.innerHTML = '';
  tfoot.innerHTML = '';

  countBadge.textContent = `${result.items.length} Items`;

  result.items.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="boq-material-name">${escapeHtml(item.name)}</div>
        <div class="text-xs text-muted">${escapeHtml(item.description)}</div>
      </td>
      <td>${item.netQty.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
      <td>+${item.wastagePct}%</td>
      <td class="boq-final-qty">${item.finalQty.toLocaleString()}</td>
      <td><strong>${item.primaryUnit}</strong></td>
      <td class="text-muted">${item.altQty ? item.altQty.toLocaleString() + ' ' + item.altUnit : '-'}</td>
      <td>${item.unitRate > 0 ? 'Rs. ' + item.unitRate.toLocaleString() : '-'}</td>
      <td class="boq-cost-val">${item.itemCost > 0 ? 'Rs. ' + item.itemCost.toLocaleString() : '-'}</td>
    `;
    tbody.appendChild(tr);
  });

  // Footer Total Cost Row
  tfoot.innerHTML = `
    <tr>
      <td colspan="7" style="text-align: right; padding-right: 1.5rem;">
        Total Estimated Material Cost (PKR):
      </td>
      <td class="boq-total-cost-val">
        ${result.grandTotalCost > 0 ? 'Rs. ' + result.grandTotalCost.toLocaleString() : 'Rs. 0'}
      </td>
    </tr>
  `;
}

/* ============================================================================
   10. EXPORT & PRINT HANDLERS
   ============================================================================ */

function printReport() {
  if (!appState.lastResult) {
    alert('Please calculate material quantities before printing.');
    return;
  }
  window.print();
}

function exportCSV() {
  if (!appState.lastResult) {
    alert('Please calculate material quantities first.');
    return;
  }

  const res = appState.lastResult;
  let csv = 'PakBuild Estimator - Material Bill of Quantities (BOQ)\n';
  csv += `Project Name,"${res.title}"\n`;
  csv += `Category,"${res.category}"\n`;
  csv += `Date,"${new Date().toLocaleDateString()}"\n\n`;

  csv += 'Material,Description,Calculated Net,Wastage %,Final Required Quantity,Primary Unit,Equivalent Unit,Unit Rate (PKR),Total Cost (PKR)\n';

  res.items.forEach(item => {
    csv += `"${item.name}","${item.description}",${item.netQty},${item.wastagePct}%,${item.finalQty},"${item.primaryUnit}","${item.altQty || ''} ${item.altUnit || ''}",${item.unitRate || 0},${item.itemCost || 0}\n`;
  });

  csv += `\n,,,,,,,Total Estimated Material Cost (PKR),${res.grandTotalCost}\n`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PakBuild_${res.category.replace(/\s+/g, '_')}_BOQ.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ============================================================================
   11. LOCAL STORAGE: SAVE / RESTORE ESTIMATES
   ============================================================================ */

function initStorage() {
  try {
    const raw = localStorage.getItem('pakbuild_saved_estimates');
    if (raw) {
      appState.savedCalculations = JSON.parse(raw);
    }
  } catch (e) {
    console.error('LocalStorage error:', e);
    appState.savedCalculations = [];
  }
  updateSavedCountPill();
}

function updateSavedCountPill() {
  const el = document.getElementById('savedCount');
  if (el) el.textContent = appState.savedCalculations.length;
}

function saveCurrentEstimate() {
  if (!appState.lastResult) {
    alert('Please run a calculation before saving.');
    return;
  }

  const name = prompt('Enter a label or title for this saved calculation:', appState.lastResult.title);
  if (!name) return;

  const item = {
    id: Date.now().toString(),
    title: name,
    category: appState.lastResult.category,
    date: new Date().toLocaleDateString(),
    activeType: appState.activeType,
    unitSystem: appState.unitSystem,
    result: appState.lastResult
  };

  appState.savedCalculations.unshift(item);
  try {
    localStorage.setItem('pakbuild_saved_estimates', JSON.stringify(appState.savedCalculations));
    updateSavedCountPill();
    alert('Estimate saved successfully to browser local storage!');
  } catch (e) {
    alert('Failed to save to local storage: ' + e.message);
  }
}

function openSavedModal() {
  const modal = document.getElementById('savedModal');
  const list = document.getElementById('savedListContainer');
  if (!modal || !list) return;

  list.innerHTML = '';
  if (appState.savedCalculations.length === 0) {
    list.innerHTML = '<p class="text-muted text-center" style="padding: 2rem 0;">No saved estimates found. Calculate and click "Save to Browser" to keep estimates here.</p>';
  } else {
    appState.savedCalculations.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'saved-item';
      div.innerHTML = `
        <div>
          <div class="saved-item-title">${escapeHtml(item.title)}</div>
          <div class="saved-item-meta">${escapeHtml(item.category)} • Saved on ${escapeHtml(item.date)}</div>
        </div>
        <div class="saved-item-actions">
          <button type="button" class="btn btn-primary btn-sm" onclick="loadSavedEstimate('${item.id}')">Load</button>
          <button type="button" class="btn btn-outline btn-sm text-danger" onclick="deleteSavedEstimate('${item.id}')">Delete</button>
        </div>
      `;
      list.appendChild(div);
    });
  }

  modal.style.display = 'flex';
}

function closeSavedModal() {
  const modal = document.getElementById('savedModal');
  if (modal) modal.style.display = 'none';
}

window.loadSavedEstimate = function(id) {
  const found = appState.savedCalculations.find(i => i.id === id);
  if (!found) return;

  appState.activeType = found.activeType;
  appState.unitSystem = found.unitSystem;

  // Sync unit buttons
  document.querySelectorAll('#globalUnitControl .segment-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.unit === found.unitSystem);
  });
  updateUnitLabels();

  // Sync type grid & select
  setActiveType(found.activeType);

  // Restore result
  appState.lastResult = found.result;
  renderResults(found.result);
  closeSavedModal();
};

window.deleteSavedEstimate = function(id) {
  if (!confirm('Are you sure you want to delete this saved estimate?')) return;
  appState.savedCalculations = appState.savedCalculations.filter(i => i.id !== id);
  localStorage.setItem('pakbuild_saved_estimates', JSON.stringify(appState.savedCalculations));
  updateSavedCountPill();
  openSavedModal();
};

function clearAllSaved() {
  if (appState.savedCalculations.length === 0) return;
  if (!confirm('Are you sure you want to delete ALL saved estimates? This cannot be undone.')) return;
  appState.savedCalculations = [];
  localStorage.removeItem('pakbuild_saved_estimates');
  updateSavedCountPill();
  openSavedModal();
}

/**
 * Escapes HTML characters for safe template string rendering
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
