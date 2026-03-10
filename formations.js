/**
 * Formations — Pure Geometry Module
 *
 * Stateless offset calculators. Given unit count, types, facing angle,
 * formation type -> returns array of {x,y} offsets relative to leader (slot 0).
 *
 * No game state, no modes, no combat logic.
 */
(function () {
  "use strict";

  const SPACING = {
    fighter: 52,
    destroyer: 72,
    cruiser: 100,
    battleship: 130,
    hyperDestroyer: 170
  };

  function spacingFor(typeA, typeB) {
    const a = SPACING[typeA] || SPACING.fighter;
    const b = SPACING[typeB] || SPACING.fighter;
    return Math.max(a, b);
  }

  function rotate(x, y, cos, sin) {
    return { x: x * cos - y * sin, y: x * sin + y * cos };
  }

  // --- Line formation (rows x cols grid) ---
  function getLineOffsets(unitTypes, rows, facing, widthScale) {
    const n = unitTypes.length;
    if (n === 0) return [];
    if (n === 1) return [{ x: 0, y: 0 }];
    const ws = widthScale || 1;

    rows = Math.max(1, Math.min(rows, n));
    const cols = Math.ceil(n / rows);
    const cos = Math.cos(facing + Math.PI / 2);
    const sin = Math.sin(facing + Math.PI / 2);

    const offsets = [];
    let idx = 0;
    for (let r = 0; r < rows && idx < n; r++) {
      const inRow = Math.min(cols, n - idx);
      const rowTypes = unitTypes.slice(idx, idx + inRow);

      let rowSpacings = [];
      for (let c = 0; c < inRow; c++) {
        const left = c > 0 ? spacingFor(rowTypes[c], rowTypes[c - 1]) * ws : 0;
        rowSpacings.push(left);
      }

      let positions = [0];
      for (let c = 1; c < inRow; c++) {
        positions.push(positions[c - 1] + rowSpacings[c]);
      }
      const rowWidth = positions.length > 1 ? positions[positions.length - 1] : 0;
      const centerX = rowWidth / 2;

      const rowSpacing = r > 0
        ? spacingFor(unitTypes[idx], unitTypes[idx - 1 >= 0 ? idx - 1 : 0])
        : 0;
      const yOff = r > 0 ? r * Math.max(rowSpacing, 20) : 0;

      for (let c = 0; c < inRow; c++) {
        const lx = positions[c] - centerX;
        const ly = yOff;
        offsets.push(rotate(lx, ly, cos, sin));
        idx++;
      }
    }
    return offsets;
  }

  // --- Wedge formation (V-shape, leader at front) ---
  function getWedgeOffsets(unitTypes, facing) {
    const n = unitTypes.length;
    if (n === 0) return [];
    if (n === 1) return [{ x: 0, y: 0 }];

    const cos = Math.cos(facing + Math.PI / 2);
    const sin = Math.sin(facing + Math.PI / 2);
    const offsets = [{ x: 0, y: 0 }];

    let leftCount = 0, rightCount = 0;
    for (let i = 1; i < n; i++) {
      const sp = spacingFor(unitTypes[i], unitTypes[i - 1]);
      const goLeft = leftCount <= rightCount;
      if (goLeft) {
        leftCount++;
        const lx = -leftCount * sp;
        const ly = leftCount * sp * 0.7;
        offsets.push(rotate(lx, ly, cos, sin));
      } else {
        rightCount++;
        const lx = rightCount * sp;
        const ly = rightCount * sp * 0.7;
        offsets.push(rotate(lx, ly, cos, sin));
      }
    }
    return offsets;
  }

  // --- Circle formation (ring, leader at front) ---
  function getCircleOffsets(unitTypes, facing) {
    const n = unitTypes.length;
    if (n === 0) return [];
    if (n === 1) return [{ x: 0, y: 0 }];

    const avgSpacing = unitTypes.reduce((s, t) => s + (SPACING[t] || 16), 0) / n;
    const circumference = n * avgSpacing;
    const radius = Math.max(20, circumference / (2 * Math.PI));

    const offsets = [];
    for (let i = 0; i < n; i++) {
      const angle = facing + (i / n) * Math.PI * 2;
      offsets.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
    }
    return offsets;
  }

  // --- Unified entry point ---
  function getFormationOffsets(unitTypes, formationType, rows, facing, widthScale) {
    if (!unitTypes || unitTypes.length === 0) return [];
    switch (formationType) {
      case "wedge": return getWedgeOffsets(unitTypes, facing);
      case "circle": return getCircleOffsets(unitTypes, facing);
      case "line":
      default:
        return getLineOffsets(unitTypes, rows || 3, facing, widthScale);
    }
  }

  const FORMATIONS = {
    SPACING,
    spacingFor,
    getFormationOffsets,
    getLineOffsets,
    getWedgeOffsets,
    getCircleOffsets
  };

  if (typeof window !== "undefined") window.FORMATIONS = FORMATIONS;
  if (typeof module !== "undefined") module.exports = FORMATIONS;
})();
