// LinkRad PACS — runtime toolbar replacement
// Replaces OHIF's stock toolbar with the redesigned LinkRad layout
// (24-icon legacy spec, 4 logical groups, modality-aware mode tabs).
//
// Strategy: hide stock toolbar via CSS, inject our DOM via fixed-position
// element, wire each button to OHIF's commandsManager. MutationObserver
// keeps the injection alive across React re-renders.
//
// Visual reference: ./mockup-redesign.html
// Spec reference:   memory/project_ohif_toolbar.md
(function () {
  'use strict';

  // ============================================================
  // Toolbar definition (single source of truth)
  // ============================================================
  // Each entry is one toolbar slot. type=btn|divider|spacer|mode-tabs
  // cmd: OHIF commandsManager command name (string)
  // cmdOpts: command options
  // tool: shortcut for {cmd: 'setToolActive', cmdOpts: { toolName: <tool> }}
  // ctx: command context (default 'CORNERSTONE')
  // dropdown: array of menu items shown below the button on click
  // fn: in-script function (for custom logic that doesn't fit OHIF commands)
  // todo: logs a console message instead of running a command (placeholder)
  var TOOLBAR = [
    // ---- Mode tabs (left edge, modality-aware) ----
    { type: 'mode-tabs' },
    { type: 'divider' },

    // ---- Group A: Display tools (mouse-mode) ----
    { type: 'btn', id: 'wl',         svg: 'sun',      tip: 'W/L · Cửa sổ (W)',          tool: 'WindowLevel' },
    { type: 'btn', id: 'pan',        svg: 'pan',      tip: 'Pan · Di chuyển (P)',       tool: 'Pan' },
    { type: 'btn', id: 'zoom',       svg: 'zoom',     tip: 'Zoom · Phóng to (Z)',       tool: 'Zoom' },
    { type: 'btn', id: 'scroll',     svg: 'scroll',   tip: 'Scroll Image (S)',          tool: 'StackScroll' },
    { type: 'btn', id: 'magnify',    svg: 'magnify',  tip: 'Magnify · Kính lúp (M)',    tool: 'Magnify' },
    { type: 'btn', id: 'probe',      svg: 'probe',    tip: 'Probe · Đo điểm pixel',     tool: 'Probe' },
    { type: 'btn', id: 'crosshairs', svg: 'cross',    tip: '3D Cursor · Tham chiếu (Q)', tool: 'Crosshairs' },
    { type: 'btn', id: 'wlpresets',  svg: 'sliders',  tip: 'W/L Presets ▾',
      dynamicDropdown: 'wl' },
    { type: 'btn', id: 'reset',      svg: 'reset',    tip: 'Reset · Đặt lại',           cmd: 'resetViewport' },

    { type: 'divider' },

    // ---- Group B: Annotations / measurements ----
    { type: 'btn', id: 'length',     svg: 'length',   tip: 'Length · Đo chiều dài (L)', tool: 'Length' },
    { type: 'btn', id: 'angle',      svg: 'angle',    tip: 'Angle · Đo góc (A)',        tool: 'Angle' },
    { type: 'btn', id: 'bidir',      svg: 'bidir',    tip: 'Bidirectional · Đo hai chiều (B)', tool: 'Bidirectional' },
    { type: 'btn', id: 'ellipse',    svg: 'ellipse',  tip: 'Ellipse · Hình elip (E)',   tool: 'EllipticalROI' },
    { type: 'btn', id: 'rectangle',  svg: 'rect',     tip: 'Rectangle · Hình chữ nhật (R)', tool: 'RectangleROI' },
    { type: 'btn', id: 'annotate',   svg: 'text',     tip: 'Text · Ghi chú (T)',        tool: 'ArrowAnnotate' },
    { type: 'btn', id: 'specialty',  svg: 'specialty',tip: 'Specialty Tools ▾',
      dropdown: [
        { label: 'CTR — Tỷ lệ tim/ngực',    tool: 'CardiothoracicRatio' },
        { label: 'Cobb Angle — Góc Cobb',   tool: 'CobbAngle' },
        { label: 'Spine Labeling — Đốt sống', tool: 'SpineLabeling' },
        { label: 'Spine Balance (SVA)',     tool: 'SpineBalance' },
        { divider: true },
        { label: 'Calibration · Hiệu chuẩn', tool: 'CalibrationLine' },
      ]
    },
    { type: 'btn', id: 'delLast',    svg: 'undo',     tip: 'Delete Last · Xóa phép đo cuối', fn: 'deleteLastAnnotation' },
    { type: 'btn', id: 'delAll',     svg: 'cross-x',  tip: 'Delete All · Xóa tất cả',   fn: 'deleteAllAnnotations', style: 'color:#ef4444' },

    { type: 'divider' },

    // ---- Group C: Image transforms ----
    { type: 'btn', id: 'rotateCW',   svg: 'rotateCW', tip: 'Rotate CW · Xoay phải',     cmd: 'rotateViewportCW' },
    { type: 'btn', id: 'rotateCCW',  svg: 'rotateCCW',tip: 'Rotate CCW · Xoay trái',    cmd: 'rotateViewportCCW' },
    { type: 'btn', id: 'flipH',      svg: 'flipH',    tip: 'Flip H · Lật ngang',        cmd: 'flipViewportHorizontal' },
    { type: 'btn', id: 'flipV',      svg: 'flipV',    tip: 'Flip V · Lật dọc',          cmd: 'flipViewportVertical' },
    { type: 'btn', id: 'invert',     svg: 'invert',   tip: 'Invert · Đảo màu',          cmd: 'invertViewport' },

    { type: 'divider' },

    // ---- Group D: Layout / sync / cine (added per redesign, not legacy) ----
    { type: 'btn', id: 'sync',       svg: 'sync',     tip: 'Sync Scroll · Đồng bộ', cmd: 'toggleSynchronizer', cmdOpts: { type: 'imageSlice' } },
    { type: 'btn', id: 'cine',       svg: 'play',     tip: 'Cine · Phát ảnh động (Shift+P)', cmd: 'toggleCine' },

    { type: 'spacer' },

    // ---- Group E: Output / metadata (right edge) ----
    { type: 'btn', id: 'capture',    svg: 'camera',   tip: 'Capture · Chụp viewport',  cmd: 'showDownloadViewportModal' },
    { type: 'btn', id: 'tags',       svg: 'info',     tip: 'Info ▾',
      dropdown: [
        { label: 'DICOM Tags · Xem thẻ DICOM', cmd: 'openDICOMTagViewer', ctx: 'DEFAULT' },
        { label: 'Patient Info · Hiển thị / Ẩn',     fn: 'togglePatientOverlay' },
        { label: 'Anony Info · Mờ thông tin BN',     fn: 'toggleAnonymizeOverlay' },
      ]
    },
  ];

  // ============================================================
  // SVG icon library (24x24, currentColor)
  // ============================================================
  var ICONS = {
    sun: '<path d="M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66l1.41-1.41M4.93 19.07l1.41-1.41m0-11.32L4.93 4.93m14.14 14.14l-1.41-1.41M12 7a5 5 0 100 10 5 5 0 000-10z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    pan: '<path d="M12 2v8m0 4v8m-8-10h8m4 0h8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    zoom: '<circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M16 16l5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M8 11h6M11 8v6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
    scroll: '<path d="M12 3v18m-5-5l5 5 5-5M7 8l5-5 5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    magnify: '<circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M16 16l5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M8 11h6M11 8v6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="11" cy="11" r="2.5" fill="currentColor" opacity="0.3"/>',
    probe: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    cross: '<path d="M12 2v20M2 12h20" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    sliders: '<path d="M4 8h12M16 8h4M4 16h4M8 16h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="16" cy="8" r="2" fill="currentColor"/><circle cx="8" cy="16" r="2" fill="currentColor"/>',
    reset: '<path d="M4 12a8 8 0 1014-5.3M14 4l4 2.7-2 4.3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',

    length: '<path d="M5 19L19 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="5" cy="19" r="2" fill="currentColor"/><circle cx="19" cy="5" r="2" fill="currentColor"/>',
    angle: '<path d="M5 19V5l14 14H5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 19a4 4 0 014-4" fill="none" stroke="currentColor" stroke-width="1.4"/>',
    bidir: '<path d="M3 12h18M12 3v18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M5 9l-2 3 2 3M19 9l2 3-2 3M9 5l3-2 3 2M9 19l3 2 3-2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    ellipse: '<ellipse cx="12" cy="12" rx="9" ry="6" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    rect: '<rect x="3.5" y="6.5" width="17" height="11" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    text: '<path d="M5 5h14M12 5v14M9 19h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    specialty: '<path d="M12 3v18M3 12h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.4"/>',
    undo: '<path d="M9 14L4 9l5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 9h11a5 5 0 015 5v0a5 5 0 01-5 5h-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    'cross-x': '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',

    rotateCW: '<path d="M4 12a8 8 0 1014-5.3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M14 4l4 2.7-2 4.3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><rect x="9" y="9" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1.2"/>',
    rotateCCW: '<path d="M20 12a8 8 0 11-14-5.3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M10 4L6 6.7l2 4.3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><rect x="9" y="9" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1.2"/>',
    flipH: '<path d="M12 3v18" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2 2"/><path d="M3 7l5-3v16l-5-3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M21 7l-5-3v16l5-3z" fill="currentColor" opacity="0.4" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    flipV: '<path d="M3 12h18" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2 2"/><path d="M7 3l-3 5h16l-3-5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M7 21l-3-5h16l-3 5z" fill="currentColor" opacity="0.4" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    invert: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 3v18a9 9 0 000-18z" fill="currentColor"/>',

    sync: '<path d="M4 9h11l-3-3M20 15H9l3 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    play: '<path d="M7 5v14l12-7-12-7z" fill="currentColor"/>',
    camera: '<rect x="3" y="7" width="18" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 7l1.5-3h3L15 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="14" r="3.5" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    info: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="8" r="1.2" fill="currentColor"/><path d="M12 11v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  };

  function svgIcon(name) {
    return '<svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">' +
           (ICONS[name] || ICONS.info) + '</svg>';
  }

  // ============================================================
  // CSS — hides stock OHIF toolbar, styles ours
  // ============================================================
  var TOOLBAR_CSS = [
    // Hide OHIF v3.8 stock header (contains the duplicate toolbar + back button + Patient menu).
    // Identified via Playwright DOM inspector: the header div uses these Tailwind classes.
    // We replace it entirely with our own toolbar; Patient / settings will be re-added later.
    'div.bg-secondary-dark.z-20.border-black.px-1.relative { display: none !important; }',
    // Hide the legacy floating brand badge from linkrad-extras.js — our toolbar carries the brand now.
    '#linkrad-brand-badge { display: none !important; }',

    // Push viewport down to make room for our toolbar (48px)
    '#root { padding-top: 48px !important; box-sizing: border-box; }',

    // Our toolbar container
    '#linkrad-toolbar {',
    '  position: fixed; top: 0; left: 0; right: 0; height: 48px;',
    '  background: #1e293b; border-bottom: 1px solid #334155;',
    '  display: flex; align-items: center; padding: 0 8px;',
    '  font-family: system-ui, -apple-system, sans-serif;',
    '  z-index: 9990;',
    '  user-select: none;',
    '}',

    // Mode tabs cluster
    '#linkrad-toolbar .lr-mode-tabs { display: flex; gap: 2px; margin-right: 4px; }',
    '#linkrad-toolbar .lr-mode-tab {',
    '  padding: 5px 14px; cursor: pointer; font-size: 12px; font-weight: 600;',
    '  border-radius: 4px; color: #94a3b8;',
    '  transition: background 0.1s, color 0.1s;',
    '}',
    '#linkrad-toolbar .lr-mode-tab:hover { background: #334155; color: #e2e8f0; }',
    '#linkrad-toolbar .lr-mode-tab.active { background: #5acce6; color: #0f172a; }',
    '#linkrad-toolbar .lr-mammo-label {',
    '  padding: 5px 12px; color: #f9a8d4; font-size: 13px; font-weight: 600;',
    '  letter-spacing: 0.3px;',
    '}',

    // Buttons
    '#linkrad-toolbar .lr-btn {',
    '  width: 32px; height: 32px; margin: 0 1px;',
    '  display: inline-flex; align-items: center; justify-content: center;',
    '  border-radius: 4px; cursor: pointer; color: #cbd5e1;',
    '  background: transparent; border: 0;',
    '  transition: background 0.1s, color 0.1s;',
    '  position: relative;',
    '}',
    '#linkrad-toolbar .lr-btn:hover { background: #334155; color: #e2e8f0; }',
    '#linkrad-toolbar .lr-btn.active { background: #0e7490; color: #fff; }',
    '#linkrad-toolbar .lr-btn:hover::after {',
    '  content: attr(data-tip); position: absolute;',
    '  top: 38px; left: 50%; transform: translateX(-50%);',
    '  background: #0f172a; color: #e2e8f0;',
    '  padding: 4px 8px; border-radius: 4px;',
    '  font-size: 11px; white-space: nowrap; z-index: 100;',
    '  border: 1px solid #334155;',
    '  pointer-events: none;',
    '}',

    // Dividers + spacer
    '#linkrad-toolbar .lr-divider { width: 1px; height: 22px; background: #334155; margin: 0 6px; }',
    '#linkrad-toolbar .lr-spacer { flex: 1; }',

    // Branding (right edge)
    '#linkrad-toolbar .lr-brand {',
    '  margin-left: 8px; padding: 0 10px;',
    '  color: #5acce6; font-size: 11px; font-weight: 700;',
    '  letter-spacing: 0.6px;',
    '}',

    // Dropdown popup
    '.lr-dropdown {',
    '  position: fixed; min-width: 220px;',
    '  background: #1e293b; border: 1px solid #334155; border-radius: 6px;',
    '  padding: 4px 0; z-index: 9991;',
    '  box-shadow: 0 8px 24px rgba(0,0,0,0.5);',
    '  font-family: system-ui, -apple-system, sans-serif; font-size: 12px;',
    '  user-select: none;',
    '}',
    '.lr-dropdown .lr-item {',
    '  padding: 8px 14px; color: #cbd5e1; cursor: pointer;',
    '  display: flex; align-items: center; gap: 8px;',
    '}',
    '.lr-dropdown .lr-item:hover { background: #334155; color: #e2e8f0; }',
    '.lr-dropdown .lr-item-divider {',
    '  height: 1px; background: #334155; margin: 4px 0;',
    '}',

    // Caret indicator on dropdown buttons
    '#linkrad-toolbar .lr-btn[data-has-dropdown]::before {',
    '  content: ""; position: absolute; bottom: 2px; right: 2px;',
    '  border-style: solid; border-width: 4px 3px 0 3px;',
    '  border-color: #94a3b8 transparent transparent transparent;',
    '}',

    // ---- Right sidebar ----
    // Hide OHIF stock right sidebar (identified via Playwright: ml-2 distinguishes right from left)
    'div.transition-all.duration-300.ml-2.bg-black { display: none !important; }',
    // Make room on right for our sidebar (240px), since OHIF main expands when stock sidebar hides
    '#root { padding-right: 240px !important; }',

    '#linkrad-sidebar {',
    '  position: fixed; top: 48px; right: 0; bottom: 0; width: 240px;',
    '  background: #1e293b; border-left: 1px solid #334155;',
    '  overflow-y: auto; z-index: 9989;',
    '  font-family: system-ui, -apple-system, sans-serif; font-size: 12px;',
    '  color: #cbd5e1; padding: 12px;',
    '  user-select: none;',
    '}',
    '#linkrad-sidebar .lr-sec { margin-bottom: 18px; }',
    '#linkrad-sidebar .lr-sec-title {',
    '  font-size: 10px; color: #5acce6; font-weight: 700;',
    '  letter-spacing: 0.6px; text-transform: uppercase;',
    '  margin-bottom: 8px;',
    '}',
    '#linkrad-sidebar .lr-sec-hint {',
    '  font-size: 10px; color: #64748b; margin-top: 6px;',
    '}',
    '#linkrad-sidebar .lr-pill-grid {',
    '  display: grid; grid-template-columns: 1fr 1fr; gap: 6px;',
    '}',
    '#linkrad-sidebar .lr-pill {',
    '  padding: 6px 8px; font-size: 11px;',
    '  background: #0f172a; color: #cbd5e1;',
    '  border: 1px solid #334155; border-radius: 4px;',
    '  cursor: pointer; transition: all 0.1s;',
    '  text-align: center;',
    '}',
    '#linkrad-sidebar .lr-pill:hover { border-color: #5acce6; color: #e2e8f0; }',
    '#linkrad-sidebar .lr-pill.active { background: #0e7490; border-color: #5acce6; color: #fff; }',
    '#linkrad-sidebar .lr-layout-row { display: flex; gap: 4px; }',
    '#linkrad-sidebar .lr-layout-btn {',
    '  width: 40px; height: 40px;',
    '  border: 1px solid #334155; border-radius: 4px;',
    '  background: #0f172a; cursor: pointer;',
    '  display: flex; align-items: center; justify-content: center;',
    '  transition: all 0.1s;',
    '}',
    '#linkrad-sidebar .lr-layout-btn:hover { border-color: #5acce6; }',
    '#linkrad-sidebar .lr-layout-btn.active { background: #0e7490; border-color: #5acce6; }',
    '#linkrad-sidebar .lr-layout-btn svg { display: block; }',
    '#linkrad-sidebar .lr-check {',
    '  display: flex; align-items: center; gap: 8px;',
    '  padding: 5px 0; cursor: pointer; font-size: 12px;',
    '  color: #cbd5e1;',
    '}',
    '#linkrad-sidebar .lr-check input { accent-color: #5acce6; cursor: pointer; }',
    '#linkrad-sidebar .lr-cine-bar {',
    '  display: flex; align-items: center; gap: 6px;',
    '}',
    '#linkrad-sidebar .lr-cine-btn {',
    '  width: 30px; height: 30px;',
    '  border: 1px solid #334155; border-radius: 4px;',
    '  background: #0f172a; color: #cbd5e1; cursor: pointer;',
    '  display: flex; align-items: center; justify-content: center;',
    '}',
    '#linkrad-sidebar .lr-cine-btn:hover { border-color: #5acce6; }',
    '#linkrad-sidebar select {',
    '  background: #0f172a; border: 1px solid #334155;',
    '  border-radius: 4px; color: #cbd5e1; padding: 4px 6px;',
    '  font-size: 11px; margin-left: auto;',
    '}',
    // Slider (slab thickness)
    '#linkrad-sidebar .lr-slider-wrap { display: flex; flex-direction: column; gap: 4px; }',
    '#linkrad-sidebar .lr-slider-wrap input[type="range"] {',
    '  width: 100%; accent-color: #5acce6; cursor: pointer;',
    '}',
    '#linkrad-sidebar .lr-slider-val {',
    '  font-size: 11px; color: #94a3b8; text-align: right;',
    '}',
    '#linkrad-sidebar .lr-slider-presets {',
    '  display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px;',
    '}',
    '#linkrad-sidebar .lr-slider-preset {',
    '  padding: 2px 8px; font-size: 10px;',
    '  background: #0f172a; color: #94a3b8;',
    '  border: 1px solid #334155; border-radius: 3px;',
    '  cursor: pointer;',
    '}',
    '#linkrad-sidebar .lr-slider-preset:hover { color: #e2e8f0; border-color: #5acce6; }',
    // Patient overlay toggles (driven by Info dropdown)
    'body.lr-hide-overlays .viewport-overlay,',
    'body.lr-hide-overlays .lr-compression-overlay { display: none !important; }',
    'body.lr-anonymize .viewport-overlay,',
    'body.lr-anonymize .lr-compression-overlay { filter: blur(5px); }',

    // Mammo compression / paddle / kVp / mAs overlay (LinkRad v1 value-add)
    '.lr-compression-overlay {',
    '  position: absolute; bottom: 8px; right: 8px;',
    '  background: rgba(15, 23, 42, 0.85); color: #5acce6;',
    '  padding: 6px 10px; border-radius: 4px;',
    '  font-size: 11px; font-family: ui-monospace, SFMono-Regular, monospace;',
    '  line-height: 1.45; pointer-events: none;',
    '  z-index: 10; max-width: 180px;',
    '}',
    '.lr-compression-overlay .lr-comp-label { color: #94a3b8; font-size: 10px; }',

    // Placeholder (Phase 2)
    '#linkrad-sidebar .lr-placeholder {',
    '  background: #0f172a; border: 1px dashed #334155;',
    '  border-radius: 4px; padding: 10px;',
    '  font-size: 11px; color: #64748b; line-height: 1.5;',
    '}',
    '#linkrad-sidebar .lr-placeholder-tag {',
    '  display: inline-block; padding: 1px 6px;',
    '  background: rgba(245, 158, 11, 0.15); color: #f59e0b;',
    '  border-radius: 3px; font-size: 9px; font-weight: 700;',
    '  letter-spacing: 0.5px; margin-left: 6px;',
    '}',

    // ---- Volume loading overlay (MPR / 3D feedback) ----
    '.lr-volume-loading {',
    '  position: absolute; inset: 0; z-index: 50;',
    '  display: flex; flex-direction: column; align-items: center; justify-content: center;',
    '  background: rgba(15, 23, 42, 0.85); color: #e2e8f0;',
    '  font-family: system-ui, -apple-system, sans-serif;',
    '  pointer-events: none;',
    '}',
    '.lr-volume-spinner {',
    '  width: 32px; height: 32px; border-radius: 50%;',
    '  border: 3px solid rgba(90, 204, 230, 0.2);',
    '  border-top-color: #5acce6;',
    '  animation: lr-spin 0.8s linear infinite;',
    '  margin-bottom: 12px;',
    '}',
    '.lr-volume-msg { font-size: 13px; font-weight: 600; color: #5acce6; }',
    '.lr-volume-sub { font-size: 11px; color: #94a3b8; margin-top: 4px; }',
    '@keyframes lr-spin { to { transform: rotate(360deg); } }',

    // ---- Per-viewport plane picker (MPR Axial / Sagittal / Coronal / 3D) ----
    '.lr-vp-plane-picker {',
    '  position: absolute; top: 6px; right: 8px; z-index: 12;',
    '  font-family: system-ui, sans-serif; font-size: 11px; font-weight: 600;',
    '  color: #5acce6; cursor: pointer; padding: 1px 6px;',
    '  background: rgba(15, 23, 42, 0.55); border-radius: 3px;',
    '  text-decoration: underline; user-select: none;',
    '}',
    '.lr-vp-plane-picker:hover { background: rgba(15, 23, 42, 0.85); }',
    '.lr-vp-plane-menu {',
    '  position: absolute; top: 28px; right: 8px; z-index: 13;',
    '  background: rgba(15, 23, 42, 0.97); border: 1px solid #475569;',
    '  border-radius: 4px; min-width: 130px; padding: 4px 0;',
    '  box-shadow: 0 4px 12px rgba(0,0,0,0.5);',
    '  font-family: system-ui, sans-serif; font-size: 12px;',
    '}',
    '.lr-vp-plane-menu .lr-mi {',
    '  padding: 6px 10px 6px 22px; cursor: pointer; color: #e2e8f0;',
    '  position: relative;',
    '}',
    '.lr-vp-plane-menu .lr-mi:hover { background: #1e293b; color: #5acce6; }',
    '.lr-vp-plane-menu .lr-mi.active::before {',
    '  content: "✓"; position: absolute; left: 8px; color: #5acce6;',
    '}',
    '.lr-vp-plane-menu .lr-mi.disabled {',
    '  color: #475569; cursor: not-allowed; pointer-events: none;',
    '}',

    // (Mammo gap-removal CSS removed — resizing the wrappers triggered
    // cornerstone canvas refit which wiped our setDisplayArea anchoring.)

    // ---- Anatomical orientation cube (A P L R H F) on volume3d viewports ----
    '.lr-orient-cube {',
    '  position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%);',
    '  z-index: 12; display: flex; gap: 2px;',
    '  font-family: system-ui, sans-serif; user-select: none;',
    '}',
    '.lr-orient-cube .lr-oc-btn {',
    '  width: 26px; height: 26px; line-height: 26px; text-align: center;',
    '  font-size: 12px; font-weight: 700; cursor: pointer;',
    '  background: rgba(15, 23, 42, 0.7); color: #cbd5e1;',
    '  border: 1px solid rgba(100, 116, 139, 0.4);',
    '}',
    '.lr-orient-cube .lr-oc-btn:hover {',
    '  background: rgba(56, 189, 248, 0.25); color: #5acce6;',
    '  border-color: #5acce6;',
    '}',
    // Hide OHIF's "for investigational use only" bottom snackbar — pops up
    // on every load and requires a Confirm-and-Hide click. Class chain is
    // unique enough that this won't collide with other fixed elements.
    'div.fixed.bottom-2.z-50.w-full.justify-center { display: none !important; }',
  ].join('\n');

  function injectCSS() {
    if (document.getElementById('linkrad-toolbar-css')) return;
    var s = document.createElement('style');
    s.id = 'linkrad-toolbar-css';
    s.textContent = TOOLBAR_CSS;
    document.head.appendChild(s);
  }

  // ============================================================
  // Render
  // ============================================================
  // Modality of currently active study; updated by detectModality()
  var currentModality = null;
  var currentMode = '2d';

  // ============================================================
  // Modality-aware W/L presets
  // ============================================================
  // CT presets are radiology-standard Hounsfield windows. MR/XR/MG use
  // generic settings since W/L for those is largely encoded in the DICOM
  // VOI LUT and varies per sequence — the "Mặc định" pill below restores
  // exactly what's in the source DICOM.
  var WL_PRESETS_BY_MODALITY = {
    CT: [
      { label: 'Phổi',       w: 1500, l: -600 },
      { label: 'Trung thất', w: 400,  l: 40 },
      { label: 'Bụng',       w: 400,  l: 50 },
      { label: 'Xương',      w: 1800, l: 400 },
      { label: 'Não',        w: 80,   l: 40 },
      { label: 'CTA',        w: 700,  l: 200 },
    ],
    MR: [
      { label: 'Sáng',       w: 1000, l: 500 },
      { label: 'Tối',        w: 300,  l: 100 },
    ],
    XR: [
      { label: 'Mềm',        w: 4000, l: 2000 },
      { label: 'Xương',      w: 2000, l: 800 },
    ],
    MG: [
      { label: 'Mềm',        w: 4000, l: 2000 },
      { label: 'Tương phản',  w: 1500, l: 1500 },
    ],
  };
  // Aliases — DICOM Modality codes the imaging community uses interchangeably.
  WL_PRESETS_BY_MODALITY.CR = WL_PRESETS_BY_MODALITY.XR;
  WL_PRESETS_BY_MODALITY.DX = WL_PRESETS_BY_MODALITY.XR;
  WL_PRESETS_BY_MODALITY.MRI = WL_PRESETS_BY_MODALITY.MR;

  function getPresetsFor(modality) {
    return WL_PRESETS_BY_MODALITY[modality] || WL_PRESETS_BY_MODALITY.CT;
  }

  // Reset the active viewport's colormap to grayscale. Pseudo-color LUTs
  // applied by cyclePseudoColor persist across W/L preset changes otherwise,
  // which makes presets after Pseudo Color look "stuck" in color.
  function clearColormap() {
    try {
      var grid = window.services && window.services.viewportGridService && window.services.viewportGridService.getState();
      var activeId = grid && grid.activeViewportId;
      if (!activeId) return;
      var vp = grid.viewports && (grid.viewports.get ? grid.viewports.get(activeId) : grid.viewports[activeId]);
      var dsUID = vp && vp.displaySetInstanceUIDs && vp.displaySetInstanceUIDs[0];
      if (!dsUID) return;
      window.commandsManager.run({
        commandName: 'setViewportColormap',
        commandOptions: {
          viewportId: activeId,
          displaySetInstanceUID: dsUID,
          colormap: { name: 'Grayscale' },
          immediate: true,
        },
        context: 'CORNERSTONE',
      });
    } catch (e) { /* silent — colormap clearing is best-effort */ }
  }

  // Apply a W/L preset, first clearing any pseudo-color LUT
  function applyWLPreset(arg) {
    clearColormap();
    if (!arg) return;
    window.commandsManager.run({
      commandName: 'setWindowLevel',
      commandOptions: { window: String(arg.w), level: String(arg.l) },
      context: 'CORNERSTONE',
    });
  }

  // "Mặc định" — restore the WindowCenter / WindowWidth values encoded in
  // the active display set's DICOM tags (the radiologist's source-of-truth W/L).
  function restoreDefaultWL() {
    clearColormap();
    try {
      var dss = window.services && window.services.displaySetService;
      var grid = window.services && window.services.viewportGridService && window.services.viewportGridService.getState();
      if (!dss || !grid || !grid.activeViewportId) {
        console.warn('[LinkRad] restoreDefaultWL: no active viewport');
        return;
      }
      var vp = grid.viewports.get ? grid.viewports.get(grid.activeViewportId) : grid.viewports[grid.activeViewportId];
      var dsUID = vp && vp.displaySetInstanceUIDs && vp.displaySetInstanceUIDs[0];
      if (!dsUID) return;
      var ds = dss.getDisplaySetByUID ? dss.getDisplaySetByUID(dsUID) : null;
      if (!ds) {
        var all = dss.getActiveDisplaySets() || [];
        ds = all.find(function (d) { return d.displaySetInstanceUID === dsUID; });
      }
      if (!ds) return;
      var img = ds.images && ds.images[0];
      var w = img && (img.WindowWidth || (img.metaData && img.metaData.WindowWidth));
      var l = img && (img.WindowCenter || (img.metaData && img.metaData.WindowCenter));
      if (Array.isArray(w)) w = w[0];
      if (Array.isArray(l)) l = l[0];
      if (w == null || l == null) {
        // Fall back to OHIF's resetViewport which re-applies VOI LUT
        window.commandsManager.run({ commandName: 'resetViewport', context: 'CORNERSTONE' });
        return;
      }
      window.commandsManager.run({
        commandName: 'setWindowLevel',
        commandOptions: { window: String(w), level: String(l) },
        context: 'CORNERSTONE',
      });
      console.log('[LinkRad] W/L → DICOM default:', w, '/', l);
    } catch (e) {
      console.warn('[LinkRad] restoreDefaultWL failed', e);
    }
  }
  // Expose for sidebar pill / toolbar dropdown
  window._linkradRestoreDefaultWL = restoreDefaultWL;

  function buildWLPresetDropdown() {
    var items = [{ label: 'Mặc định (DICOM gốc)', fn: 'restoreDefaultWL' }, { divider: true }];
    var presets = getPresetsFor(currentModality);
    presets.forEach(function (p) {
      items.push({
        label: p.label + ' (' + p.w + ' / ' + p.l + ')',
        fn: 'applyWLPreset',
        arg: { w: p.w, l: p.l },
      });
    });
    items.push({ divider: true });
    items.push({ label: 'Pseudo Color (cycle)', cmd: 'cyclePseudoColor' });
    return items;
  }

  function buildWLPresetPills() {
    var pills = [{ label: 'Mặc định', tip: 'Khôi phục W/L gốc của ảnh DICOM', fn: 'restoreDefaultWL' }];
    var presets = getPresetsFor(currentModality);
    presets.forEach(function (p) {
      pills.push({
        label: p.label,
        tip: p.w + ' / ' + p.l,
        fn: 'applyWLPreset',
        arg: { w: p.w, l: p.l },
      });
    });
    pills.push({ label: 'Pseudo', tip: 'Pseudo color cycle', cmd: 'cyclePseudoColor' });
    return pills;
  }

  // Modes available per modality. CT/MR get all three; CR/DX/US get 2D only;
  // MG hides tabs entirely (header label switches to "Mammo Viewer").
  function modesForModality(mod) {
    if (mod === 'MG') return [];
    if (mod === 'CT' || mod === 'MR' || mod === 'PT' || mod === 'NM') {
      return ['2d', 'mpr', '3d'];
    }
    return ['2d'];
  }

  function buildModeTabs() {
    var wrap = document.createElement('div');
    var modes = modesForModality(currentModality);
    if (currentModality === 'MG') {
      wrap.className = 'lr-mammo-label';
      wrap.textContent = 'Mammo Viewer';
      return wrap;
    }
    wrap.className = 'lr-mode-tabs';
    var labels = { '2d': '2D', 'mpr': 'MPR', '3d': '3D' };
    modes.forEach(function (m) {
      var tab = document.createElement('div');
      tab.className = 'lr-mode-tab' + (m === currentMode ? ' active' : '');
      tab.textContent = labels[m];
      tab.dataset.mode = m;
      tab.onclick = function () { switchMode(m); };
      wrap.appendChild(tab);
    });
    return wrap;
  }

  // Resolve a dynamicDropdown id → array of menu items at render/click time
  function resolveDynamicDropdown(id) {
    if (id === 'wl') return buildWLPresetDropdown();
    return [];
  }

  function buildButton(item) {
    var b = document.createElement('button');
    b.className = 'lr-btn';
    b.id = 'lr-btn-' + item.id;
    b.dataset.tip = item.tip;
    if (item.dropdown || item.dynamicDropdown) b.dataset.hasDropdown = '1';
    if (item.style) b.style.cssText = item.style;
    b.innerHTML = svgIcon(item.svg);
    b.onclick = function (ev) {
      ev.stopPropagation();
      if (item.dropdown) openDropdown(b, item.dropdown);
      else if (item.dynamicDropdown) openDropdown(b, resolveDynamicDropdown(item.dynamicDropdown));
      else runItem(item);
    };
    return b;
  }

  function renderToolbar() {
    var bar = document.getElementById('linkrad-toolbar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'linkrad-toolbar';
      document.body.appendChild(bar);
    }
    bar.innerHTML = '';
    TOOLBAR.forEach(function (item) {
      if (item.type === 'mode-tabs') bar.appendChild(buildModeTabs());
      else if (item.type === 'divider') {
        var d = document.createElement('div'); d.className = 'lr-divider'; bar.appendChild(d);
      }
      else if (item.type === 'spacer') {
        var s = document.createElement('div'); s.className = 'lr-spacer'; bar.appendChild(s);
      }
      else if (item.type === 'btn') {
        bar.appendChild(buildButton(item));
      }
    });
    // Branding on the right edge
    var brand = document.createElement('div');
    brand.className = 'lr-brand';
    brand.textContent = 'LINKRAD PACS';
    bar.appendChild(brand);
  }

  // ============================================================
  // Command wiring
  // ============================================================
  function runItem(item) {
    if (item.todo) {
      console.log('[LinkRad toolbar] TODO not yet wired:', item.todo);
      return;
    }
    if (item.fn) {
      var f = LR_FUNCS[item.fn];
      if (typeof f === 'function') f(item.arg);
      else console.warn('[LinkRad toolbar] unknown fn:', item.fn);
      return;
    }
    var cm = window.commandsManager;
    if (!cm || !cm.run) {
      console.warn('[LinkRad toolbar] commandsManager not ready');
      return;
    }
    try {
      var ctx = item.ctx || 'CORNERSTONE';
      var cmd, opts;
      if (item.tool) {
        cmd = 'setToolActive';
        opts = { toolName: item.tool };
      } else {
        cmd = item.cmd;
        opts = item.cmdOpts || {};
      }
      cm.run({ commandName: cmd, commandOptions: opts, context: ctx });
      // Visual active state for tool buttons
      if (item.tool) markActive(item.id);
    } catch (e) {
      console.warn('[LinkRad toolbar] command failed', item.id, e);
    }
  }

  // ============================================================
  // Dropdown popup
  // ============================================================
  var openDD = null;
  function closeDropdown() {
    if (openDD) { openDD.remove(); openDD = null; }
  }
  function openDropdown(anchor, items) {
    closeDropdown();
    var rect = anchor.getBoundingClientRect();
    var dd = document.createElement('div');
    dd.className = 'lr-dropdown';
    dd.style.left = rect.left + 'px';
    dd.style.top  = (rect.bottom + 4) + 'px';
    items.forEach(function (it) {
      if (it.divider) {
        var d = document.createElement('div');
        d.className = 'lr-item-divider';
        dd.appendChild(d);
        return;
      }
      var row = document.createElement('div');
      row.className = 'lr-item';
      row.textContent = it.label;
      row.onclick = function (ev) {
        ev.stopPropagation();
        closeDropdown();
        runItem(it);
      };
      dd.appendChild(row);
    });
    document.body.appendChild(dd);
    openDD = dd;
    // Keep dropdown within viewport (right edge)
    var ddRect = dd.getBoundingClientRect();
    if (ddRect.right > window.innerWidth - 8) {
      dd.style.left = (window.innerWidth - ddRect.width - 8) + 'px';
    }
  }
  document.addEventListener('click', function () { closeDropdown(); });

  // ============================================================
  // Custom button functions (LR_FUNCS)
  // ============================================================
  // LIFO annotation stack for "Delete Last"
  var annotationStack = [];

  function hookAnnotationEvents() {
    var cst = window.cornerstoneTools;
    if (!cst || !cst.Enums || hookAnnotationEvents._done) return;
    var Events = cst.Enums.Events;
    if (!Events || !Events.ANNOTATION_ADDED) return;

    // Cornerstone3D fires events on the rendering engine's element. Easiest hook
    // is via the global eventTarget exposed on cornerstoneTools.utilities or via
    // CornerstoneTools.eventTarget. v3.8 ships eventTarget on the lib.
    var tgt = (window.cornerstone && window.cornerstone.eventTarget) || cst.eventTarget;
    if (!tgt || typeof tgt.addEventListener !== 'function') return;
    tgt.addEventListener(Events.ANNOTATION_ADDED, function (ev) {
      var d = ev && (ev.detail || ev.data);
      var uid = d && d.annotation && d.annotation.annotationUID;
      if (uid) annotationStack.push(uid);
    });
    tgt.addEventListener(Events.ANNOTATION_REMOVED, function (ev) {
      var d = ev && (ev.detail || ev.data);
      var uid = d && d.annotation && d.annotation.annotationUID;
      if (!uid) return;
      annotationStack = annotationStack.filter(function (u) { return u !== uid; });
    });
    hookAnnotationEvents._done = true;
    console.log('[LinkRad toolbar] annotation events hooked');
  }

  function deleteLastAnnotation() {
    var cst = window.cornerstoneTools;
    if (!cst || !cst.annotation || !cst.annotation.state) {
      console.warn('[LinkRad toolbar] no cornerstoneTools.annotation.state');
      return;
    }
    if (!annotationStack.length) {
      console.log('[LinkRad toolbar] no annotation to delete');
      return;
    }
    var uid = annotationStack.pop();
    try {
      cst.annotation.state.removeAnnotation(uid);
      // Force rerender of all viewports
      var renderingEngine = window.cornerstone && window.cornerstone.getRenderingEngines && window.cornerstone.getRenderingEngines()[0];
      if (renderingEngine && renderingEngine.render) renderingEngine.render();
      console.log('[LinkRad toolbar] deleted last annotation', uid);
    } catch (e) {
      console.warn('[LinkRad toolbar] removeAnnotation failed', e);
    }
  }

  function deleteAllAnnotations() {
    var cm = window.commandsManager;
    var ms = window.services && window.services.measurementService;
    // Prefer OHIF's measurementService if available — it cleans up SR + tool state.
    if (ms && typeof ms.clearMeasurements === 'function') {
      try { ms.clearMeasurements(); annotationStack = []; console.log('[LinkRad toolbar] cleared all measurements'); return; } catch (e) {}
    }
    // Fallback: enumerate annotation state and remove each
    var cst = window.cornerstoneTools;
    if (cst && cst.annotation && cst.annotation.state) {
      try {
        var state = cst.annotation.state.getAnnotationManager().getAllAnnotations();
        var uids = [];
        if (Array.isArray(state)) {
          state.forEach(function (a) { if (a && a.annotationUID) uids.push(a.annotationUID); });
        } else {
          // state may be keyed object
          Object.keys(state || {}).forEach(function (k) {
            var arr = state[k];
            if (Array.isArray(arr)) arr.forEach(function (a) { if (a && a.annotationUID) uids.push(a.annotationUID); });
          });
        }
        uids.forEach(function (u) { try { cst.annotation.state.removeAnnotation(u); } catch (e) {} });
        annotationStack = [];
        var re = window.cornerstone && window.cornerstone.getRenderingEngines && window.cornerstone.getRenderingEngines()[0];
        if (re && re.render) re.render();
        console.log('[LinkRad toolbar] deleted', uids.length, 'annotations');
      } catch (e) {
        console.warn('[LinkRad toolbar] deleteAll fallback failed', e);
      }
    }
  }

  function togglePatientOverlay() {
    document.body.classList.toggle('lr-hide-overlays');
    var hidden = document.body.classList.contains('lr-hide-overlays');
    console.log('[LinkRad toolbar] Patient overlay →', hidden ? 'hidden' : 'shown');
  }
  function toggleAnonymizeOverlay() {
    document.body.classList.toggle('lr-anonymize');
    var on = document.body.classList.contains('lr-anonymize');
    console.log('[LinkRad toolbar] Anonymize →', on ? 'on (PHI blurred)' : 'off');
  }

  // ---- MPR-specific: blend mode + slab thickness ----
  // Maps our pill labels to Cornerstone3D BlendModes enum names.
  // BlendModes lives at window.cornerstone.Enums.BlendModes (vtk.js-backed).
  var MPR_BLEND_NAMES = {
    'COMPOSITE': 'COMPOSITE',
    'AVERAGE':   'AVERAGE_INTENSITY_BLEND',
    'MAXIMUM':   'MAXIMUM_INTENSITY_BLEND',
    'MINIMUM':   'MINIMUM_INTENSITY_BLEND',
    'VOLUME':    'COMPOSITE',  // VR uses composite on a volumeViewport
  };

  // ============================================================
  // Volume loading overlay (MPR / 3D feedback)
  // ============================================================
  // Streaming a 500+ slice CT through wado-rs takes 60-120s. Without progress
  // feedback the partially-loaded volume produces white bands at top/bottom of
  // sagittal/coronal MPR (unloaded slices = HU 0 = upper-clip in lung W/L) and
  // users think the viewer is broken. Show live "N/T lát" progress polled from
  // the volume's scalar buffer; clear once loadStatus.loaded flips true.
  var _volPollTimer = null;
  function showVolumeLoadingOverlay() {
    var panes = document.querySelectorAll('[data-cy="viewport-pane"]');
    panes.forEach(function (p) {
      if (p.querySelector('.lr-volume-loading')) return;
      var ov = document.createElement('div');
      ov.className = 'lr-volume-loading';
      ov.innerHTML = '<div class="lr-volume-spinner"></div>'
        + '<div class="lr-volume-msg">Đang tải khối ảnh…</div>'
        + '<div class="lr-volume-sub" data-lr-progress>0/?</div>';
      p.appendChild(ov);
    });
    // Poll volume load progress every 500ms
    if (_volPollTimer) clearInterval(_volPollTimer);
    _volPollTimer = setInterval(updateVolumeLoadProgress, 500);
    // Run once immediately so the first frame has correct numbers
    updateVolumeLoadProgress();
  }
  function hideVolumeLoadingOverlay() {
    if (_volPollTimer) { clearInterval(_volPollTimer); _volPollTimer = null; }
    document.querySelectorAll('.lr-volume-loading').forEach(function (n) { n.remove(); });
  }
  function updateVolumeLoadProgress() {
    try {
      var vols = window.cornerstone && window.cornerstone.cache && window.cornerstone.cache.getVolumes && window.cornerstone.cache.getVolumes();
      if (!vols || !vols.length) return;
      // Pick the volume with the most slices (the active study volume)
      var v = vols.reduce(function (a, b) { return (b.dimensions && b.dimensions[2] || 0) > (a.dimensions && a.dimensions[2] || 0) ? b : a; });
      if (!v.scalarData || !v.dimensions) return;
      var total = v.dimensions[2];
      var sliceSize = v.dimensions[0] * v.dimensions[1];
      var sd = v.scalarData;
      var loaded = 0;
      // Count slices whose center voxel is non-zero. Empty buffer = 0 everywhere;
      // even air voxels in real data are -1024, never 0 by coincidence.
      for (var s = 0; s < total; s++) {
        if (sd[s * sliceSize + (sliceSize >> 1)] !== 0) loaded++;
      }
      var pct = total ? Math.floor(loaded * 100 / total) : 0;
      document.querySelectorAll('.lr-volume-loading [data-lr-progress]').forEach(function (n) {
        n.textContent = loaded + '/' + total + ' lát (' + pct + '%)';
      });
      if (v.loadStatus && v.loadStatus.loaded) hideVolumeLoadingOverlay();
    } catch (e) { /* swallow — overlay just stays static this tick */ }
  }
  // Kept for back-compat with switchMode call sites; no-op now (polling replaces events).
  function hookVolumeLoadEvents() {}

  // ============================================================
  // Per-viewport plane picker (legacy "MPR Axial / Sagittal / Coronal / 3D" dropdown)
  // ============================================================
  // Each viewport gets a small clickable label in the top-right corner that
  // opens a dropdown to switch the plane. Orthographic viewports support live
  // orientation switching via cornerstone's setOrientation(). The volume3d
  // viewport's MPR options are shown but disabled (volume3d↔orthographic swap
  // requires viewport recreation — Phase 2).
  function getVpOrientation(vp) {
    if (vp.type === 'volume3d') return '3d';
    try {
      var cam = vp.getCamera && vp.getCamera();
      if (!cam || !cam.viewPlaneNormal) return null;
      var n = cam.viewPlaneNormal;
      var ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
      if (az >= ax && az >= ay) return 'axial';
      if (ax >= ay && ax >= az) return 'sagittal';
      return 'coronal';
    } catch (e) { return null; }
  }
  function getVpLabel(vp) {
    var o = getVpOrientation(vp);
    if (o === '3d') return '3D';
    if (o === 'axial') return 'MPR Axial';
    if (o === 'sagittal') return 'MPR Sagittal';
    if (o === 'coronal') return 'MPR Coronal';
    return 'MPR';
  }
  function setVpPlane(vp, plane) {
    if (vp.type === 'volume3d') return; // can't convert to orthographic in-place
    var Enums = window.cornerstone && window.cornerstone.Enums;
    var OrientationAxis = Enums && Enums.OrientationAxis;
    if (!vp.setOrientation || !OrientationAxis) return;
    try {
      var key = plane.toUpperCase();
      vp.setOrientation(OrientationAxis[key] || key);
      vp.render();
    } catch (e) { console.warn('[LinkRad] setOrientation failed', plane, e); }
  }
  function buildPlaneMenu(picker, vp) {
    // Close any existing menu
    document.querySelectorAll('.lr-vp-plane-menu').forEach(function (m) { m.remove(); });
    var menu = document.createElement('div');
    menu.className = 'lr-vp-plane-menu';
    var current = getVpOrientation(vp);
    var is3D = vp.type === 'volume3d';
    var items = [
      { id: '3d', label: '3D', disabled: !is3D },
      { id: 'axial', label: 'MPR Axial', disabled: is3D },
      { id: 'sagittal', label: 'MPR Sagittal', disabled: is3D },
      { id: 'coronal', label: 'MPR Coronal', disabled: is3D },
    ];
    items.forEach(function (it) {
      var d = document.createElement('div');
      d.className = 'lr-mi' + (current === it.id ? ' active' : '') + (it.disabled ? ' disabled' : '');
      d.textContent = it.label;
      d.onclick = function (ev) {
        ev.stopPropagation();
        if (it.disabled) return;
        setVpPlane(vp, it.id);
        menu.remove();
        // Refresh label
        picker.textContent = getVpLabel(vp);
      };
      menu.appendChild(d);
    });
    picker.parentElement.appendChild(menu);
    // Close on next click anywhere
    setTimeout(function () {
      var off = function () { menu.remove(); document.removeEventListener('click', off); };
      document.addEventListener('click', off);
    }, 0);
  }
  function injectPlanePickers() {
    var re = window.cornerstone && window.cornerstone.getRenderingEngines && window.cornerstone.getRenderingEngines()[0];
    if (!re) return;
    var vps = re.getViewports();
    document.querySelectorAll('[data-cy="viewport-pane"]').forEach(function (pane) {
      var vpEl = pane.querySelector('[data-viewport-uid]');
      if (!vpEl) return;
      var uid = vpEl.getAttribute('data-viewport-uid');
      var vp = vps.find(function (v) { return v.id === uid; });
      if (!vp) return;
      var existing = pane.querySelector('.lr-vp-plane-picker');
      if (existing) {
        existing.textContent = getVpLabel(vp);
        return;
      }
      pane.style.position = pane.style.position || 'relative';
      var picker = document.createElement('div');
      picker.className = 'lr-vp-plane-picker';
      picker.textContent = getVpLabel(vp);
      picker.onclick = function (ev) { ev.stopPropagation(); buildPlaneMenu(picker, vp); };
      pane.appendChild(picker);
    });
  }
  function refreshPlanePickers() {
    // Used after orientation changes to update the labels
    injectPlanePickers();
  }

  // ============================================================
  // First-render health check — auto-recover from Intel UHD ANGLE shader race
  // ============================================================
  // The vtk.js vtkPolyDataVS shader fails to compile on the first cold render
  // through Chrome's ANGLE/D3D11 path on Intel UHD GPUs. Subsequent compiles
  // work because of ANGLE's translated-shader cache. Detect the all-black
  // canvas after volume load and silently reload once to dodge the race. A
  // sessionStorage counter prevents reload loops if the failure is permanent.
  // Only sample orthographic MPR canvases — volume3d's dark VR background can
  // sample as black even on a healthy render. MPR cuts always have visible
  // anatomy when WebGL is working.
  var _renderHealthDone = false;
  // Tracks how many times the user has entered 3D/MPR mode in this session.
  // First entry can hit the cold ANGLE shader-compile race and benefit from
  // a one-shot reload. Subsequent entries (e.g. swap-back-with-restore)
  // shouldn't reload — shader cache is warm, all-black is a different bug
  // (vtk.js re-mount race), and reloading would destroy the snapshotted
  // state the parent just restored.
  var _volumeModeEntries = 0;
  // One-shot auto-retry guard for the cold ANGLE shader-compile race.
  var _renderRetryDone = false;
  function checkRenderHealth() {
    if (_renderHealthDone) return;
    try {
      if (currentMode !== 'mpr' && currentMode !== '3d') return;
      var v = window.cornerstone && window.cornerstone.cache && window.cornerstone.cache.getVolumes && window.cornerstone.cache.getVolumes()[0];
      if (!v || !v.loadStatus || !v.loadStatus.loaded) {
        setTimeout(checkRenderHealth, 5000);
        return;
      }
      // Map orthographic canvases to viewport ids via the rendering engine
      var re = window.cornerstone.getRenderingEngines && window.cornerstone.getRenderingEngines()[0];
      if (!re) return;
      var orthoCanvases = re.getViewports().filter(function (vp) {
        return vp.type === 'orthographic';
      }).map(function (vp) { return vp.canvas; }).filter(Boolean);
      if (!orthoCanvases.length) return;
      var allBlack = true;
      var tmp = document.createElement('canvas');
      tmp.width = 1; tmp.height = 1;
      var tctx = tmp.getContext('2d');
      // 5×5 = 25 samples per orthographic canvas — anatomy fills enough of the
      // pane that any healthy render produces non-black at most positions.
      for (var i = 0; i < orthoCanvases.length && allBlack; i++) {
        var c = orthoCanvases[i];
        if (!c.width || !c.height) continue;
        for (var yi = 1; yi <= 5 && allBlack; yi++) {
          for (var xi = 1; xi <= 5 && allBlack; xi++) {
            tctx.clearRect(0, 0, 1, 1);
            tctx.drawImage(c, c.width * xi / 6, c.height * yi / 6, 1, 1, 0, 0, 1, 1);
            var d = tctx.getImageData(0, 0, 1, 1).data;
            if (d[0] > 5 || d[1] > 5 || d[2] > 5) allBlack = false;
          }
        }
      }
      _renderHealthDone = true;
      if (!allBlack) {
        return;
      }
      // All-black detected — most likely the cold ANGLE shader-compile race
      // on Intel UHD. Auto-retry by re-running switchMode in-place (no full
      // page reload). The first failed compile primes ANGLE's translated-
      // shader cache, so the second attempt almost always succeeds. We cap
      // at one retry to avoid loops on broken drivers.
      if (_renderRetryDone) {
        console.error('[LinkRad] 3D still all-black after one auto-retry. Click the 3D button manually, or update Intel GPU driver.');
        return;
      }
      _renderRetryDone = true;
      _renderHealthDone = false;  // let the check run again after the retry
      console.warn('[LinkRad] 3D all-black on first mount — auto-retrying switchMode in-place (no reload)');
      setTimeout(function () { try { switchMode(currentMode); } catch (e) {} }, 300);
    } catch (e) { console.warn('[LinkRad] checkRenderHealth failed', e); }
  }

  // ============================================================
  // Anatomical orientation cube (A P L R H F) — volume3d viewports only
  // ============================================================
  // Legacy DICOM viewers show 6 letter buttons at the bottom of the 3D
  // viewport that snap the camera to the corresponding anatomical view.
  function injectOrientCubes() {
    var re = window.cornerstone && window.cornerstone.getRenderingEngines && window.cornerstone.getRenderingEngines()[0];
    if (!re) return;
    var vps = re.getViewports();
    document.querySelectorAll('[data-cy="viewport-pane"]').forEach(function (pane) {
      var vpEl = pane.querySelector('[data-viewport-uid]');
      if (!vpEl) return;
      var uid = vpEl.getAttribute('data-viewport-uid');
      var vp = vps.find(function (v) { return v.id === uid; });
      if (!vp || vp.type !== 'volume3d') return;
      if (pane.querySelector('.lr-orient-cube')) return; // already injected
      pane.style.position = pane.style.position || 'relative';
      var cube = document.createElement('div');
      cube.className = 'lr-orient-cube';
      ['A', 'P', 'L', 'R', 'H', 'F'].forEach(function (letter) {
        var b = document.createElement('div');
        b.className = 'lr-oc-btn';
        b.textContent = letter;
        b.title = {
          A: 'Anterior — nhìn từ phía trước',
          P: 'Posterior — nhìn từ phía sau',
          L: 'Left — nhìn từ bên trái bệnh nhân',
          R: 'Right — nhìn từ bên phải bệnh nhân',
          H: 'Head/Superior — nhìn từ trên đỉnh đầu',
          F: 'Feet/Inferior — nhìn từ dưới chân',
        }[letter];
        b.onclick = function (ev) { ev.stopPropagation(); set3DOrientation(letter); };
        cube.appendChild(b);
      });
      pane.appendChild(cube);
    });
  }

  function eachVolumeViewport(fn) {
    try {
      var engines = window.cornerstone && window.cornerstone.getRenderingEngines && window.cornerstone.getRenderingEngines();
      if (!engines || !engines.length) return;
      var hit = 0;
      engines.forEach(function (re) {
        var vps = (re && re.getVolumeViewports) ? re.getVolumeViewports() : [];
        vps.forEach(function (vp) {
          if (vp && typeof vp.setBlendMode === 'function') { fn(vp); hit++; }
        });
        if (re && re.render) re.render();
      });
      if (hit === 0) console.warn('[LinkRad sidebar] no volume viewports found');
    } catch (e) { console.warn('[LinkRad sidebar] eachVolumeViewport failed', e); }
  }

  function setMPRBlendMode(arg) {
    var BlendModes = window.cornerstone && window.cornerstone.Enums && window.cornerstone.Enums.BlendModes;
    if (!BlendModes) {
      console.warn('[LinkRad sidebar] cornerstone BlendModes not exposed');
      return;
    }
    var modeName = MPR_BLEND_NAMES[arg] || arg;
    var modeVal = BlendModes[modeName];
    if (modeVal === undefined) {
      console.warn('[LinkRad sidebar] unknown blend mode', modeName);
      return;
    }
    eachVolumeViewport(function (vp) { vp.setBlendMode(modeVal); });
    console.log('[LinkRad sidebar] MPR blend mode →', modeName);
  }

  function setSlabThickness(mm) {
    eachVolumeViewport(function (vp) {
      if (typeof vp.setSlabThickness === 'function') vp.setSlabThickness(mm);
    });
    console.log('[LinkRad sidebar] slab thickness →', mm, 'mm');
  }

  function toggleMPRCrossline() {
    // MPR Crossline = Crosshairs tool active on all 3 viewports.
    // Use our existing toolbar crosshairs button by toggling Crosshairs tool active/passive.
    try {
      var cst = window.cornerstoneTools;
      if (!cst || !cst.ToolGroupManager) return;
      var tg = cst.ToolGroupManager.getToolGroup('mpr') || cst.ToolGroupManager.getToolGroup('default');
      if (!tg) return;
      var opts = tg.getToolOptions ? tg.getToolOptions('Crosshairs') : null;
      var currentlyActive = opts && opts.mode === 'Active';
      if (currentlyActive) {
        tg.setToolPassive('Crosshairs');
        console.log('[LinkRad sidebar] Crossline → off');
      } else {
        tg.setToolActive('Crosshairs', { bindings: [{ mouseButton: cst.Enums.MouseBindings.Primary }] });
        console.log('[LinkRad sidebar] Crossline → on');
      }
    } catch (e) { console.warn('[LinkRad sidebar] toggleMPRCrossline failed', e); }
  }

  // ---- 3D-specific ----
  function each3DViewport(fn) {
    try {
      var engines = window.cornerstone && window.cornerstone.getRenderingEngines && window.cornerstone.getRenderingEngines();
      if (!engines || !engines.length) return 0;
      var hit = 0;
      engines.forEach(function (re) {
        var vps = (re && re.getVolumeViewports) ? re.getVolumeViewports() : [];
        vps.forEach(function (vp) {
          // VolumeViewport3D has resetCamera + getCamera + setOrientation
          if (vp && (vp.type === 'volume3d' || typeof vp.resetCamera === 'function')) {
            fn(vp); hit++;
          }
        });
        if (re && re.render) re.render();
      });
      return hit;
    } catch (e) { console.warn('[LinkRad sidebar] each3DViewport failed', e); return 0; }
  }

  // Standard camera vectors per anatomical view. viewPlaneNormal is the unit
  // vector pointing from focal point toward the camera position (i.e., the
  // outward direction the camera "looks from"). LPS coords: +X = patient left,
  // +Y = patient posterior, +Z = patient head.
  // Fixed 2026-05-06 after legacy-comparison revealed the existing axial/
  // sagittal/coronal had viewUp inverted (feet up → upside down on side views).
  var ORIENTATION_VECTORS = {
    // Anatomical 6-way (legacy "A P L R H F" cube)
    A: { viewUp: [0, 0, 1],  viewPlaneNormal: [0, -1, 0] },  // Anterior — camera at -Y (in front of patient)
    P: { viewUp: [0, 0, 1],  viewPlaneNormal: [0, 1, 0]  },  // Posterior — camera at +Y (behind patient)
    L: { viewUp: [0, 0, 1],  viewPlaneNormal: [1, 0, 0]  },  // patient's Left side — camera at +X
    R: { viewUp: [0, 0, 1],  viewPlaneNormal: [-1, 0, 0] },  // patient's Right side — camera at -X
    H: { viewUp: [0, -1, 0], viewPlaneNormal: [0, 0, 1]  },  // Superior/Head — camera at +Z (above patient)
    F: { viewUp: [0, -1, 0], viewPlaneNormal: [0, 0, -1] },  // Inferior/Feet — camera at -Z (below patient)
    // Sidebar pills inherit the same vectors via aliases
    axial:    { viewUp: [0, -1, 0], viewPlaneNormal: [0, 0, 1]  },  // = H (looking down from above)
    coronal:  { viewUp: [0, 0, 1],  viewPlaneNormal: [0, -1, 0] },  // = A (looking at front)
    sagittal: { viewUp: [0, 0, 1],  viewPlaneNormal: [-1, 0, 0] },  // = R (looking at patient's right)
  };

  function set3DOrientation(arg) {
    var n = each3DViewport(function (vp) {
      if (arg === 'reset') {
        if (typeof vp.resetCamera === 'function') vp.resetCamera();
      } else {
        var v = ORIENTATION_VECTORS[arg];
        if (!v) return;
        if (typeof vp.setCamera === 'function') {
          vp.setCamera({ viewUp: v.viewUp, viewPlaneNormal: v.viewPlaneNormal });
          if (typeof vp.resetCamera === 'function') vp.resetCamera({ resetPan: false, resetZoom: false });
        }
      }
    });
    console.log('[LinkRad sidebar] 3D orientation →', arg, '(viewports:', n + ')');
  }

  function set3DRenderMode(arg) {
    // Try OHIF's setViewportPreset command first — it's the official way
    try {
      window.commandsManager.run({
        commandName: 'setViewportPreset',
        commandOptions: { preset: arg },
        context: 'CORNERSTONE',
      });
      console.log('[LinkRad sidebar] 3D render mode → preset', arg);
    } catch (e) { console.warn('[LinkRad sidebar] setViewportPreset failed', arg, e); }
  }

  // Continuous orbit animation (pure stub — wiring requires vtk camera API)
  var orbitTimer = null;
  function toggle3DOrbit() {
    if (orbitTimer) {
      clearInterval(orbitTimer); orbitTimer = null;
      console.log('[LinkRad sidebar] 3D Batch orbit → stopped');
      return;
    }
    var degPerFrame = 2;
    orbitTimer = setInterval(function () {
      each3DViewport(function (vp) {
        try {
          var cam = vp.getCamera();
          // rotate viewPlaneNormal around viewUp by degPerFrame
          var rad = degPerFrame * Math.PI / 180;
          var n = cam.viewPlaneNormal;
          var u = cam.viewUp;
          // simple rotation around viewUp axis (assumes axis is unit)
          var cos = Math.cos(rad), sin = Math.sin(rad);
          // Rodrigues rotation of n around u
          var dot = n[0]*u[0] + n[1]*u[1] + n[2]*u[2];
          var cross = [u[1]*n[2]-u[2]*n[1], u[2]*n[0]-u[0]*n[2], u[0]*n[1]-u[1]*n[0]];
          var nx = n[0]*cos + cross[0]*sin + u[0]*dot*(1-cos);
          var ny = n[1]*cos + cross[1]*sin + u[1]*dot*(1-cos);
          var nz = n[2]*cos + cross[2]*sin + u[2]*dot*(1-cos);
          if (typeof vp.setCamera === 'function') vp.setCamera({ viewPlaneNormal: [nx, ny, nz] });
        } catch (e) { /* skip if no camera */ }
      });
    }, 50);
    console.log('[LinkRad sidebar] 3D Batch orbit → started');
  }

  function toggle3DBox()              { console.log('[LinkRad sidebar] 3D Box toggle TODO — needs vtk cube actor overlay'); }
  function toggle3DCursor()           { console.log('[LinkRad sidebar] 3D Cursor toggle TODO — same as toolbar Crosshairs'); }
  function toggleRotateAroundCursor() { console.log('[LinkRad sidebar] Rotate around cursor TODO — change camera focal point to cursor pos'); }

  // Bỏ giường — make the bed HU range transparent on the volume3d opacity TF.
  // CT couch contains foam (HU -100 to -50), plastic (HU 0 to 100), and on
  // some scanners carbon fiber (HU 100 to 300). To reliably hide the entire
  // couch we cut everything below HU 200 — this is a "bone-emphasis" view that
  // also fades muscle/organs. Acceptable for skeletal 3D; user can use Render
  // Mode preset if they want soft-tissue back. tf.modified() is required to
  // invalidate vtk's cached opacity texture.
  function removeBed() {
    var hits = 0;
    eachVolumeViewport(function (vp) {
      if (vp.type !== 'volume3d') return;
      try {
        var actors = vp.getActors ? vp.getActors() : [];
        actors.forEach(function (a) {
          var prop = a.actor && a.actor.getProperty ? a.actor.getProperty() : null;
          if (!prop || !prop.getScalarOpacity) return;
          var tf = prop.getScalarOpacity(0);
          if (!tf) return;
          // Stash original on the actor so we can restore exactly
          if (!a._lrOpacityBackup) {
            var backup = [];
            var sz = tf.getSize();
            for (var i = 0; i < sz; i++) {
              var nd = [];
              tf.getNodeValue(i, nd);
              backup.push(nd.slice());
            }
            a._lrOpacityBackup = backup;
          }
          // Cortical-bone-only ramp. Carbon fiber CT couches have HU 200-400
          // which overlaps with cancellous bone, so HU < 500 must all be 0 to
          // reliably hide the bed. This sacrifices cancellous bone visibility
          // (rib internals, vertebrae spongiosa) but keeps cortical bone +
          // dense calcifications + metal artifacts visible.
          tf.removeAllPoints();
          tf.addPoint(-3024, 0);
          tf.addPoint(500,   0);     // bed (incl. carbon fiber) + soft tissue + cancellous bone all transparent
          tf.addPoint(700,   0.45);  // cortical bone start
          tf.addPoint(1200,  0.80);
          tf.addPoint(3071,  0.95);  // dense cortical / metal
          if (typeof tf.modified === 'function') tf.modified();
          if (typeof prop.modified === 'function') prop.modified();
          hits++;
        });
        if (vp.render) vp.render();
        var re = vp.getRenderingEngine && vp.getRenderingEngine();
        if (re && re.render) re.render();
      } catch (e) { console.warn('[LinkRad] removeBed failed', e); }
    });
    console.log('[LinkRad sidebar] Bỏ giường — opacity TF rewritten on', hits, 'actor(s) (bone-emphasis)');
  }
  // Reset tissue — restore the original opacity TF
  function resetTissue() {
    var hits = 0;
    eachVolumeViewport(function (vp) {
      if (vp.type !== 'volume3d') return;
      try {
        var actors = vp.getActors ? vp.getActors() : [];
        actors.forEach(function (a) {
          var prop = a.actor && a.actor.getProperty ? a.actor.getProperty() : null;
          if (!prop || !prop.getScalarOpacity) return;
          var tf = prop.getScalarOpacity(0);
          if (!tf || !a._lrOpacityBackup) return;
          tf.removeAllPoints();
          a._lrOpacityBackup.forEach(function (nd) {
            tf.addPoint(nd[0], nd[1], nd[2] != null ? nd[2] : 0.5, nd[3] != null ? nd[3] : 0);
          });
          delete a._lrOpacityBackup;
          if (typeof tf.modified === 'function') tf.modified();
          if (typeof prop.modified === 'function') prop.modified();
          hits++;
        });
        if (vp.render) vp.render();
        var re = vp.getRenderingEngine && vp.getRenderingEngine();
        if (re && re.render) re.render();
      } catch (e) { console.warn('[LinkRad] resetTissue failed', e); }
    });
    console.log('[LinkRad sidebar] Reset tissue — restored TF on', hits, 'actor(s)');
  }

  // ---- Mammo-specific ----
  // Maps each Hanging Protocol preset to a layout config.
  // Series-to-viewport matching (which series goes where) is TODO — needs
  // DICOM tag (ViewPosition / ImageLaterality / TOMO detection) inspection.
  var MAMMO_HANGING = {
    cc:        { rows: 1, cols: 2, label: 'CC bilateral (RCC | LCC)' },
    mlo:       { rows: 1, cols: 2, label: 'MLO bilateral (RMLO | LMLO)' },
    ccmlo4:    { rows: 2, cols: 2, label: 'RCC | LCC / RMLO | LMLO' },
    rccmlo:    { rows: 1, cols: 2, label: 'R CC + MLO' },
    lccmlo:    { rows: 1, cols: 2, label: 'L CC + MLO' },
    tomocc:    { rows: 1, cols: 2, label: 'TOMO CC bilateral',  tomo: true },
    tomomlo:   { rows: 1, cols: 2, label: 'TOMO MLO bilateral', tomo: true },
    tomo4up:   { rows: 2, cols: 2, label: 'TOMO 4-up',   tomo: true },
    tomor:     { rows: 1, cols: 2, label: 'TOMO R',      tomo: true },
    tomol:     { rows: 1, cols: 2, label: 'TOMO L',      tomo: true },
  };

  function hasTomoSeries() {
    // Smart TOMO detection (LinkRad v1 value-add):
    // Inspects active display sets for SOPClassUID = Breast Tomosynthesis (1.2.840.10008.5.1.4.1.1.13.1.3)
    // OR series description containing 'TOMO'/'DBT'.
    try {
      var dss = window.services && window.services.displaySetService;
      if (!dss || !dss.getActiveDisplaySets) return null;
      var sets = dss.getActiveDisplaySets() || [];
      for (var i = 0; i < sets.length; i++) {
        var s = sets[i];
        var desc = (s.SeriesDescription || '').toUpperCase();
        if (desc.indexOf('TOMO') >= 0 || desc.indexOf('DBT') >= 0) return true;
        var sop = s.SOPClassUID || (s.instances && s.instances[0] && s.instances[0].SOPClassUID);
        if (sop === '1.2.840.10008.5.1.4.1.1.13.1.3') return true;
      }
      return false;
    } catch (e) { return null; }
  }

  // Last user-applied layout in this iframe. In-memory only — sessionStorage
  // bleeds across same-origin iframes within the same tab, so persisting it
  // would make a layout the user picked in case A leak into case B's iframe
  // and break case B's natural protocol defaults. Losing the saved layout
  // on a hard refresh is the right behavior anyway: a fresh page should use
  // OHIF's defaults, not a stale custom layout.
  //
  // Shape: { kind: 'grid', rows, cols } | { kind: 'protocol', id }
  //      | { kind: 'mammo', arg }   ← Mammo HPs go through their own setter
  //                                   so we can re-run series matching too.
  var _lastUserLayout = null;
  // Clean up any leaked value from prior versions that did persist to
  // sessionStorage — would cause cross-iframe layout contamination.
  try { sessionStorage.removeItem('lrLastUserLayout'); } catch (e) {}
  try { sessionStorage.removeItem('lrLastMammoPreset'); } catch (e) {}

  function rememberLayout(layout) {
    _lastUserLayout = layout;
  }

  function setMammoHanging(arg, opts) {
    var silent = !!(opts && opts.silent);
    var cfg = MAMMO_HANGING[arg];
    if (!cfg) { console.warn('[LinkRad sidebar] unknown mammo hanging:', arg); return false; }
    if (cfg.tomo) {
      var tomoOk = hasTomoSeries();
      if (tomoOk === false) {
        // Smart detection: warn instead of silently showing black viewports (legacy did this)
        if (!silent) alert('Ca chụp này không có chuỗi TOMO — chọn Hanging Protocol thường.');
        console.warn('[LinkRad sidebar] TOMO requested but no TOMO series detected');
        return false;
      }
    }
    try {
      window.commandsManager.run({
        commandName: 'setViewportGridLayout',
        commandOptions: { numRows: cfg.rows, numCols: cfg.cols },
        context: 'DEFAULT',
      });
      console.log('[LinkRad sidebar] Mammo hanging →', arg, '(', cfg.label, ')');
      rememberLayout({ kind: 'mammo', arg: arg });
      // After layout settles, populate viewports with matched series
      setTimeout(function () { populateMammoViewports(arg); }, 350);
      return true;
    } catch (e) { console.warn('[LinkRad sidebar] mammo hanging failed', e); return false; }
  }

  // Called when the parent (Teleradiology page) tells this iframe it has
  // become the active case tab. Defensive re-apply: if the user has
  // previously picked a layout and the grid no longer matches, the layout
  // has reverted (typical scenario: opened a second case in another iframe
  // and switched back). Re-apply silently — no alerts when the iframe
  // wasn't even focused.
  function onParentTabActivated() {
    if (!_lastUserLayout) {
      console.log('[LinkRad] tab-activated: no saved layout — skip');
      return;
    }
    var gs = window.services && window.services.viewportGridService;
    var grid = gs && gs.getState && gs.getState();
    if (!grid || !grid.layout) {
      // Service isn't ready yet — try again after a short delay.
      console.log('[LinkRad] tab-activated: viewportGridService not ready, deferring');
      setTimeout(onParentTabActivated, 500);
      return;
    }
    var rows = grid.layout.numRows, cols = grid.layout.numCols;
    var saved = _lastUserLayout;

    if (saved.kind === 'grid' || saved.kind === 'mammo') {
      var wantRows, wantCols, label;
      if (saved.kind === 'mammo') {
        var cfg = MAMMO_HANGING[saved.arg];
        if (!cfg) { console.warn('[LinkRad] tab-activated: unknown mammo arg', saved.arg); return; }
        wantRows = cfg.rows; wantCols = cfg.cols; label = 'mammo:' + saved.arg;
      } else {
        wantRows = saved.rows; wantCols = saved.cols; label = 'grid:' + saved.rows + '×' + saved.cols;
      }
      if (rows === wantRows && cols === wantCols) {
        console.log('[LinkRad] tab-activated: layout intact (' + rows + '×' + cols + ', wanted ' + label + ')');
        return;
      }
      console.warn('[LinkRad] tab-activated: layout reverted (was ' + wantRows + '×' + wantCols + ', now ' + rows + '×' + cols + ', wanted ' + label + ') — re-applying');
      if (saved.kind === 'mammo') {
        setMammoHanging(saved.arg, { silent: true });
      } else {
        try {
          window.commandsManager.run({
            commandName: 'setViewportGridLayout',
            commandOptions: { numRows: wantRows, numCols: wantCols },
            context: 'DEFAULT',
          });
        } catch (e) { console.warn('[LinkRad] tab-activated: re-apply failed', e); }
      }
      return;
    }

    if (saved.kind === 'protocol') {
      // We don't have a cheap way to read the active protocol ID from grid
      // state, so just re-apply unconditionally. cheap & idempotent.
      console.log('[LinkRad] tab-activated: re-applying protocol', saved.id);
      try {
        window.commandsManager.run({
          commandName: 'setHangingProtocol',
          commandOptions: { protocolId: saved.id },
          context: 'DEFAULT',
        });
      } catch (e) { console.warn('[LinkRad] tab-activated: re-apply protocol failed', e); }
    }
  }

  // ---- Grid-state watchdog ----
  // The reason the layout reverts between tab activations: OHIF's
  // hangingProtocolService re-runs `applyProtocol` whenever new
  // displaySets stream in (lazy load). That resets the grid to the
  // protocol's default 1×1 even though the iframe is hidden. By the
  // time the user switches back, the revert has already happened.
  //
  // Subscribe to viewportGridService events and restore the saved
  // layout the moment OHIF tries to revert it. Throttled and gated
  // by `_restoreInflight` so OHIF's own GRID_STATE_CHANGED reaction
  // to our re-apply doesn't loop.
  var _restoreInflight = false;
  var _lastRestoreTs = 0;

  function checkGridAgainstSaved() {
    if (!_lastUserLayout) return;
    if (_restoreInflight) return;
    var now = Date.now();
    if (now - _lastRestoreTs < 600) return;

    var gs = window.services && window.services.viewportGridService;
    var grid = gs && gs.getState && gs.getState();
    if (!grid || !grid.layout) return;

    var rows = grid.layout.numRows, cols = grid.layout.numCols;
    // 0×0 means OHIF is mid-initialization — never override the natural
    // boot sequence, the user hasn't seen anything yet anyway.
    if (!rows || !cols) return;
    var saved = _lastUserLayout;
    var wantRows, wantCols, label;
    if (saved.kind === 'mammo') {
      var cfg = MAMMO_HANGING[saved.arg];
      if (!cfg) return;
      wantRows = cfg.rows; wantCols = cfg.cols; label = 'mammo:' + saved.arg;
    } else if (saved.kind === 'grid') {
      wantRows = saved.rows; wantCols = saved.cols; label = 'grid:' + saved.rows + '×' + saved.cols;
    } else {
      // protocol kind — only re-applied on tab activation, not by watchdog
      return;
    }
    if (rows === wantRows && cols === wantCols) return;

    console.warn('[LinkRad] watchdog: grid auto-reverted to ' + rows + '×' + cols + ', restoring ' + label);
    _restoreInflight = true;
    _lastRestoreTs = now;
    try {
      if (saved.kind === 'mammo') {
        setMammoHanging(saved.arg, { silent: true });
      } else {
        window.commandsManager.run({
          commandName: 'setViewportGridLayout',
          commandOptions: { numRows: wantRows, numCols: wantCols },
          context: 'DEFAULT',
        });
      }
    } catch (e) { console.warn('[LinkRad] watchdog re-apply failed', e); }
    setTimeout(function () { _restoreInflight = false; }, 600);
  }

  function subscribeLayoutWatchdog() {
    if (subscribeLayoutWatchdog._done) return;
    try {
      var gs = window.services && window.services.viewportGridService;
      if (!gs || !gs.subscribe || !gs.EVENTS) return;
      // Prefer the narrow LAYOUT_CHANGED event when present; fall back to
      // GRID_STATE_CHANGED with a throttle if not.
      var evName = gs.EVENTS.LAYOUT_CHANGED || gs.EVENTS.GRID_STATE_CHANGED;
      if (!evName) return;
      gs.subscribe(evName, function () { checkGridAgainstSaved(); });
      subscribeLayoutWatchdog._done = true;
      console.log('[LinkRad] layout watchdog subscribed (' + evName + ')');
    } catch (e) {}
  }

  function setMagnifyLevel(level) {
    // Activate Magnify tool then set its magnifier ratio. Magnify tool config
    // accepts magnifierSize + magnificationLevel.
    try {
      var cst = window.cornerstoneTools;
      var tg = cst && cst.ToolGroupManager.getToolGroup('default');
      if (!tg) return;
      tg.setToolActive('Magnify');
      // Magnify tool config update — varies by Cornerstone3D version
      if (typeof tg.setToolConfiguration === 'function') {
        tg.setToolConfiguration('Magnify', { magnificationLevel: level });
      }
      console.log('[LinkRad sidebar] Magnify level →', level + 'x');
    } catch (e) { console.warn('[LinkRad sidebar] setMagnifyLevel failed', e); }
  }

  // ---- Mammo Compression / Paddle / kVp / mAs overlay (LinkRad v1 value-add) ----
  // Reads DICOM tags 0018,11A0 / 11A2 / 11A4 / 0060 / 1152 from each viewport's
  // active display set and renders a small bottom-right overlay per viewport.
  // Re-renders on grid-state changes + 3s safety poll.
  function viewportsAsArray(grid) {
    var out = [];
    if (!grid || !grid.viewports) return out;
    if (typeof grid.viewports.forEach === 'function') {
      grid.viewports.forEach(function (vp, id) { out.push({ id: id, vp: vp }); });
    } else {
      Object.keys(grid.viewports).forEach(function (id) { out.push({ id: id, vp: grid.viewports[id] }); });
    }
    return out;
  }

  function renderMammoOverlays() {
    // Always wipe stale overlays
    document.querySelectorAll('.lr-compression-overlay').forEach(function (el) { el.remove(); });
    if (currentModality !== 'MG') return;

    try {
      var grid = window.services && window.services.viewportGridService && window.services.viewportGridService.getState();
      var dss = window.services && window.services.displaySetService;
      if (!grid || !dss) return;

      viewportsAsArray(grid).forEach(function (entry) {
        var dsUIDs = (entry.vp.displaySetInstanceUIDs || []);
        if (!dsUIDs.length) return;
        var ds = dss.getDisplaySetByUID(dsUIDs[0]);
        if (!ds || !ds.instances || !ds.instances[0]) return;
        var inst = ds.instances[0];

        var lines = [];
        if (inst.CompressionForce !== undefined && inst.CompressionForce !== null) {
          lines.push('<span class="lr-comp-label">Force</span> ' + Math.round(inst.CompressionForce) + ' N');
        }
        if (inst.BodyPartThickness !== undefined && inst.BodyPartThickness !== null) {
          lines.push('<span class="lr-comp-label">Th</span> ' + Math.round(inst.BodyPartThickness) + ' mm');
        }
        if (inst.PaddleDescription) {
          lines.push('<span class="lr-comp-label">Paddle</span> ' + inst.PaddleDescription);
        }
        var expo = [];
        if (inst.KVP !== undefined && inst.KVP !== null) expo.push(inst.KVP + ' kVp');
        if (inst.ExposureInmAs !== undefined && inst.ExposureInmAs !== null) expo.push(Math.round(inst.ExposureInmAs) + ' mAs');
        else if (inst.XRayTubeCurrent !== undefined && inst.ExposureTime !== undefined) {
          // Some manufacturers don't ship ExposureInmAs — derive from current·time
          var derived = (inst.XRayTubeCurrent * inst.ExposureTime) / 1000;
          expo.push(Math.round(derived) + ' mAs');
        }
        if (expo.length) lines.push('<span class="lr-comp-label">Expo</span> ' + expo.join(' · '));

        // Also include view + laterality in the overlay header for clarity
        var head = [];
        if (inst.ImageLaterality) head.push(inst.ImageLaterality);
        if (inst.ViewPosition)   head.push(inst.ViewPosition);
        var intent = (inst.PresentationIntentType || '').toUpperCase();
        if (intent === 'FOR PRESENTATION') head.push('PROC');
        else if (intent === 'FOR PROCESSING') head.push('RAW');

        if (!lines.length && !head.length) return;

        var vpEl = document.querySelector('[data-viewport-uid="' + entry.id + '"]');
        if (!vpEl) return;
        var pane = vpEl.closest('[data-cy="viewport-pane"]') || vpEl.parentElement;
        if (!pane) return;

        var ov = document.createElement('div');
        ov.className = 'lr-compression-overlay';
        var html = '';
        if (head.length) html += '<div style="font-weight:700;color:#f9a8d4;margin-bottom:4px;">' + head.join(' ') + '</div>';
        html += lines.join('<br>');
        ov.innerHTML = html;
        pane.appendChild(ov);
      });
    } catch (e) { console.warn('[LinkRad] renderMammoOverlays failed', e); }
  }

  function subscribeMammoOverlays() {
    if (subscribeMammoOverlays._done) return;
    var gs = window.services && window.services.viewportGridService;
    if (gs && typeof gs.subscribe === 'function' && gs.EVENTS) {
      try {
        if (gs.EVENTS.GRID_STATE_CHANGED) gs.subscribe(gs.EVENTS.GRID_STATE_CHANGED, function () { setTimeout(renderMammoOverlays, 200); });
        if (gs.EVENTS.ACTIVE_VIEWPORT_ID_CHANGED) gs.subscribe(gs.EVENTS.ACTIVE_VIEWPORT_ID_CHANGED, function () { setTimeout(renderMammoOverlays, 200); });
        subscribeMammoOverlays._done = true;
      } catch (e) {}
    }
    // Safety poll: covers modality change + display set replacement events
    setInterval(renderMammoOverlays, 3000);
  }

  // ---- Mammo hanging-protocol series matching (LinkRad v1 value-add) ----
  // Maps a Mammo preset slot (e.g. "RCC", "LMLO_TOMO") → displaySetInstanceUID
  // by reading ViewPosition + ImageLaterality + PresentationIntentType + SOPClassUID.
  // Prefers FOR PRESENTATION (PROC) over FOR PROCESSING (RAW) when both exist.
  function findMammoSeriesMap() {
    var map = {};
    try {
      var sets = (window.services && window.services.displaySetService && window.services.displaySetService.getActiveDisplaySets()) || [];
      sets.forEach(function (ds) {
        var inst = ds.instances && ds.instances[0];
        if (!inst) return;
        var view = (inst.ViewPosition || '').toUpperCase().replace(/\s+/g, '');
        var lat  = (inst.ImageLaterality || '').toUpperCase();
        var sd   = (ds.SeriesDescription || '').toUpperCase();
        var isTomo = (ds.SOPClassUID === '1.2.840.10008.5.1.4.1.1.13.1.3') ||
                     /TOMO|DBT/.test(sd) || /\bVOL\b|3D/.test(sd);
        // Hologic BTO instances frequently lack ImageLaterality/ViewPosition
        // DICOM tags. Fall back to parsing the SeriesDescription, which
        // follows the convention "ROUTINE3D_VOL_<LAT><VIEW>" (e.g. RCC, LMLO).
        if (isTomo && (!lat || !view)) {
          // SeriesDescription patterns: "ROUTINE3D_VOL_RMLO", "TOMO_LCC", etc.
          // `\b` boundaries don't work here — underscores and letters are both
          // word chars, so we use explicit separators or string ends.
          var m = sd.match(/(?:^|[_\s\-])([LR])(CC|MLO)(?=$|[_\s\-])/) ||
                  sd.match(/(?:^|[_\s\-])(CC|MLO)([LR])(?=$|[_\s\-])/);
          if (m) {
            if (m[1] === 'L' || m[1] === 'R') { lat = lat || m[1]; view = view || m[2]; }
            else                              { view = view || m[1]; lat = lat || m[2]; }
          }
        }
        if (!view || !lat) return;
        var isProc = (inst.PresentationIntentType || '').toUpperCase() === 'FOR PRESENTATION';
        var key = lat + view + (isTomo ? '_TOMO' : '');
        if (!map[key]) {
          map[key] = ds.displaySetInstanceUID;
        } else if (isTomo) {
          // Hologic emits two BTO display sets per anatomy: a low-frame
          // c-view/projection synthesis and a high-frame reconstructed
          // slice stack. Keep the bigger one — that's what radiologists
          // actually scroll through.
          var existingTomo = sets.filter(function (s) { return s.displaySetInstanceUID === map[key]; })[0];
          var exFrames = (existingTomo && existingTomo.numImageFrames) || 0;
          var newFrames = ds.numImageFrames || 0;
          if (newFrames > exFrames) map[key] = ds.displaySetInstanceUID;
        } else if (isProc) {
          var existing = sets.filter(function (s) { return s.displaySetInstanceUID === map[key]; })[0];
          var exIntent = (existing && existing.instances && existing.instances[0] &&
                          existing.instances[0].PresentationIntentType || '').toUpperCase();
          if (exIntent === 'FOR PROCESSING') map[key] = ds.displaySetInstanceUID;
        }
      });
    } catch (e) { console.warn('[LinkRad] findMammoSeriesMap failed', e); }
    return map;
  }

  // Slot order per preset → which series goes in which viewport (left to right, top to bottom).
  var MAMMO_SLOTS = {
    cc:        ['RCC', 'LCC'],
    mlo:       ['RMLO', 'LMLO'],
    ccmlo4:    ['RCC', 'LCC', 'RMLO', 'LMLO'],   // standard mammographer 4-up
    rccmlo:    ['RCC', 'RMLO'],
    lccmlo:    ['LCC', 'LMLO'],
    tomocc:    ['RCC_TOMO', 'LCC_TOMO'],
    tomomlo:   ['RMLO_TOMO', 'LMLO_TOMO'],
    tomo4up:   ['RCC_TOMO', 'LCC_TOMO', 'RMLO_TOMO', 'LMLO_TOMO'],
    tomor:     ['RCC_TOMO', 'RMLO_TOMO'],
    tomol:     ['LCC_TOMO', 'LMLO_TOMO'],
  };

  function populateMammoViewports(presetArg) {
    var slots = MAMMO_SLOTS[presetArg];
    if (!slots) return;
    var map = findMammoSeriesMap();
    var gs = window.services && window.services.viewportGridService;
    if (!gs) return;
    var grid = gs.getState();
    if (!grid) return;
    var vpIds = viewportsAsArray(grid).map(function (e) { return e.id; });

    // Build batch update — one entry per viewport slot we have data for
    var updates = [];
    var empty = [];
    var slotByVp = {};
    slots.forEach(function (slot, i) {
      var dsUID = map[slot];
      if (dsUID && vpIds[i]) {
        updates.push({ viewportId: vpIds[i], displaySetInstanceUIDs: [dsUID] });
        slotByVp[vpIds[i]] = slot;
      } else {
        empty.push(slot);
      }
    });

    if (updates.length && typeof gs.setDisplaySetsForViewports === 'function') {
      try {
        gs.setDisplaySetsForViewports(updates);
        console.log('[LinkRad] Mammo populate →', presetArg, '— filled:', updates.length, '· empty slots:', empty);
      } catch (e) { console.warn('[LinkRad] setDisplaySetsForViewports failed', e); }
    } else {
      console.warn('[LinkRad] no setDisplaySetsForViewports available');
    }
    setTimeout(renderMammoOverlays, 400);
    // Apply mammographer display conventions once viewports remount with the
    // new display sets. We pass the SLOTS array (not viewport IDs) because
    // setDisplaySetsForViewports can regenerate viewport IDs — the new IDs
    // need to be looked up post-mount via positional order in the grid.
    setTimeout(function () { applyMammoDisplayConventions(slots); }, 700);
    // Auto-enable slice sync for TOMO bilateral presets so wheeling one side
    // advances the contralateral viewport in lockstep — standard mammographer
    // workflow. 2D presets and the single-side TOMO L/R presets are skipped.
    // Honors the LR_MAMMO_SLICE_SYNC_ENABLED toggle (sidebar checkbox).
    var cfg = MAMMO_HANGING[presetArg];
    if (cfg && cfg.tomo && (cfg.rows * cfg.cols) >= 2 && LR_MAMMO_SLICE_SYNC_ENABLED) {
      setTimeout(function () { setupMammoSliceSync(); }, 900);
    } else {
      setTimeout(function () { teardownMammoSliceSync(); }, 900);
    }
  }

  // Image-slice sync for TOMO bilateral viewports. We CANNOT use OHIF's
  // built-in 'imageSlice' / 'stackImage' synchronizers — both resolve to
  // imageSliceSyncCallback which gates on `areViewportsCoplanar`, and RCC vs
  // LCC live in different anatomical planes so the check fails silently.
  // Instead we install raw STACK_NEW_IMAGE listeners that propagate index
  // by ordinal (slice N on source → slice N on target), gated by a flag to
  // prevent infinite ping-pong.
  var LR_MAMMO_SLICE_SYNC_ENABLED = true;
  var _mammoSliceListeners = [];
  var _mammoSliceSuppress = false;
  // Runtime toggle wired to the Mammo sidebar checkbox. When turned ON for
  // a non-bilateral-tomo preset, takes effect on the next applicable preset.
  function toggleMammoSliceSync(enabled) {
    LR_MAMMO_SLICE_SYNC_ENABLED = !!enabled;
    if (!enabled) {
      teardownMammoSliceSync();
      console.log('[LinkRad] Mammo slice sync OFF');
      return;
    }
    // Try to activate now if the current grid is a tomo bilateral.
    try {
      var vgs = window.services && window.services.viewportGridService;
      var grid = vgs && vgs.getState && vgs.getState();
      var vps = grid && grid.viewports;
      var n = vps ? (vps.size != null ? vps.size : Object.keys(vps).length) : 0;
      // Heuristic: if we have ≥2 viewports and any of them holds a multi-frame
      // stack, activate. Cheap proxy for "we're in a tomo bilateral preset."
      if (n >= 2) setupMammoSliceSync();
      console.log('[LinkRad] Mammo slice sync ON');
    } catch (e) { /* silent */ }
  }
  function teardownMammoSliceSync() {
    _mammoSliceListeners.forEach(function (b) {
      try { b.elem.removeEventListener(b.evt, b.fn); } catch (e) {}
    });
    _mammoSliceListeners = [];
  }
  function setupMammoSliceSync() {
    try {
      teardownMammoSliceSync();
      var cs = window.cornerstone;
      var re = cs && cs.getRenderingEngines && cs.getRenderingEngines()[0];
      if (!re) return;
      var vgs = window.services && window.services.viewportGridService;
      var grid = vgs && vgs.getState && vgs.getState();
      var vps = grid && grid.viewports;
      var gridVps = vps && (vps.values ? Array.from(vps.values()) : Object.values(vps));
      if (!gridVps || gridVps.length < 2) return;
      var vpIds = gridVps
        .map(function (gv) { return gv.viewportOptions && gv.viewportOptions.viewportId; })
        .filter(Boolean);
      var STACK_EVT = cs.Enums && cs.Enums.Events && cs.Enums.Events.STACK_NEW_IMAGE;
      if (!STACK_EVT) { console.warn('[LinkRad] mammo slice sync: no STACK_NEW_IMAGE event constant'); return; }
      vpIds.forEach(function (srcId) {
        var srcVp = re.getViewport(srcId);
        if (!srcVp || !srcVp.element) return;
        var handler = function () {
          if (_mammoSliceSuppress) return;
          var srcIdx;
          try { srcIdx = srcVp.getCurrentImageIdIndex(); } catch (e) { return; }
          if (typeof srcIdx !== 'number') return;
          _mammoSliceSuppress = true;
          try {
            vpIds.forEach(function (tgtId) {
              if (tgtId === srcId) return;
              var tgt = re.getViewport(tgtId);
              if (!tgt) return;
              var tgtImgs = [];
              try { tgtImgs = tgt.getImageIds(); } catch (e) {}
              if (!tgtImgs.length) return;
              // Map by ordinal, clamped to target's available range.
              var newIdx = Math.min(srcIdx, tgtImgs.length - 1);
              var cur;
              try { cur = tgt.getCurrentImageIdIndex(); } catch (e) {}
              if (cur === newIdx) return;
              try {
                // Use the StackViewport instance method `viewport.scroll(delta)`
                // (NOT raw setImageIdIndex). scroll() fires both STACK_NEW_IMAGE
                // *and* STACK_VIEWPORT_SCROLL — the latter is what OHIF's
                // CustomizableViewportOverlay subscribes to for the
                // "I: N (idx/total)" corner text. setImageIdIndex alone updates
                // the rendered pixels but leaves the React overlay stale.
                if (typeof tgt.scroll === 'function') {
                  tgt.scroll(newIdx - (cur || 0));
                } else {
                  tgt.setImageIdIndex(newIdx);
                  if (tgt.render) tgt.render();
                }
              } catch (e) { /* skip if target not ready */ }
            });
          } finally {
            // Release on next macrotask so the propagated setImageIdIndex
            // calls (which themselves fire STACK_NEW_IMAGE) have time to
            // run with suppress still on.
            setTimeout(function () { _mammoSliceSuppress = false; }, 0);
          }
        };
        srcVp.element.addEventListener(STACK_EVT, handler);
        _mammoSliceListeners.push({ elem: srcVp.element, evt: STACK_EVT, fn: handler });
      });
      console.log('[LinkRad] Mammo slice sync ON across', vpIds.length, 'viewports (custom event listener)');
    } catch (e) { console.warn('[LinkRad] setupMammoSliceSync failed', e); }
  }

  // Mammo bilateral sync: chest-wall-anchored zoom. We can't use cornerstone's
  // built-in Zoom tool here — its mousemove handler tracks an initial camera
  // captured at mousedown and applies cumulative deltas to it, overriding any
  // mid-drag camera adjustments we make in CAMERA_MODIFIED listeners. So we
  // install our own pointer-based drag-zoom that:
  //   1. Computes a new parallelScale from vertical drag delta
  //   2. Sets focalPoint so the chest wall stays at the canvas inner edge
  //   3. Applies to all mammo viewports in lockstep
  // _mammoAnchors[viewportId] = { chestWorldX, isRight, canvasAspect }
  var _mammoAnchors = {};
  var _mammoSyncBindings = [];
  var _mammoSyncIds = [];
  var _mammoSyncing = false;
  function captureMammoAnchor(vp, isRight) {
    if (!vp || !vp.getCamera || !vp.canvas) return null;
    var cam = vp.getCamera();
    if (!cam || !cam.focalPoint || cam.parallelScale == null) return null;
    var aspect = (vp.canvas.clientWidth || vp.canvas.width) / (vp.canvas.clientHeight || vp.canvas.height);
    // Half world-width visible = parallelScale * aspect (parallelScale is half-height).
    // For RCC (chest at canvas right): chestWorldX = focalX + halfWidth.
    // For LCC (chest at canvas left):  chestWorldX = focalX - halfWidth.
    var halfWidth = cam.parallelScale * aspect;
    var chestWorldX = isRight ? (cam.focalPoint[0] + halfWidth) : (cam.focalPoint[0] - halfWidth);
    return { chestWorldX: chestWorldX, isRight: isRight, aspect: aspect };
  }
  function reanchorMammoCamera(vp, anchor, parallelScale) {
    if (!vp || !anchor || !vp.getCamera || !vp.setCamera) return;
    var cam = vp.getCamera();
    if (!cam) return;
    var halfWidth = parallelScale * anchor.aspect;
    var newFocalX = anchor.isRight ? (anchor.chestWorldX - halfWidth) : (anchor.chestWorldX + halfWidth);
    var dx = newFocalX - cam.focalPoint[0];
    if (Math.abs(dx) < 1e-6 && Math.abs((cam.parallelScale || 0) - parallelScale) < 1e-6) return;
    vp.setCamera({
      focalPoint: [newFocalX, cam.focalPoint[1], cam.focalPoint[2]],
      position: [cam.position[0] + dx, cam.position[1], cam.position[2]],
      parallelScale: parallelScale,
    });
    if (vp.render) vp.render();
  }
  // Tear down all custom drag-zoom + drag-pan pointer bindings.
  // Zoom/Pan toolbar tools are left as-is (we no longer disable them when
  // sync turns on, so there's nothing to restore here).
  function teardownMammoZoomSync() {
    _mammoSyncBindings.forEach(function (b) {
      try { b.element.removeEventListener('pointerdown', b.onDown, true); } catch (e) {}
      try { window.removeEventListener('pointermove', b.onMove, true); } catch (e) {}
      try { window.removeEventListener('pointerup', b.onUp, true); } catch (e) {}
    });
    _mammoSyncBindings = [];
    _mammoSyncIds = [];
  }
  function setupMammoZoomSync(vpIds, slotsInOrder) {
    var cs = window.cornerstone;
    var re = cs && cs.getRenderingEngines && cs.getRenderingEngines()[0];
    if (!re) return;
    teardownMammoZoomSync();
    _mammoSyncIds = vpIds.slice();
    // Anchor data is just laterality flag — setDisplayArea handles the rest.
    _mammoAnchors = {};
    vpIds.forEach(function (id, i) {
      var slot = slotsInOrder[i];
      _mammoAnchors[id] = { isRight: slot && slot.charAt(0) === 'R' };
    });

    // Disable Crosshairs (cyan reference-line tool — fires a permanent
    // marker on every click; not useful in mammo). Zoom + Pan are LEFT
    // ACTIVE so the user can pick which one the left-button drag triggers
    // via the standard toolbar buttons; our pointerdown handler reads the
    // active tool and routes left-click to either synced-zoom or synced-pan
    // accordingly. Right-click is always synced pan (mammo convention).
    try {
      var ToolGroupManager = window.cornerstoneTools && window.cornerstoneTools.ToolGroupManager;
      if (ToolGroupManager) {
        var tg = ToolGroupManager.getToolGroup('default');
        if (tg && tg.setToolPassive) {
          try { tg.setToolPassive('Crosshairs'); } catch (e) {}
        }
      }
    } catch (e) { /* fall through */ }

    // Reads the currently-active cornerstone tool for the given mouse button
    // (1 = left, 2 = right) on the default toolGroup. Returns 'zoom', 'pan',
    // or null if some other tool is active (e.g. Length measurement) — in
    // which case our handler should NOT intercept and let cornerstone run.
    function _activeToolForButton(mouseButton) {
      var TGM = window.cornerstoneTools && window.cornerstoneTools.ToolGroupManager;
      var tg = TGM && TGM.getToolGroup && TGM.getToolGroup('default');
      if (!tg) return null;
      var opts = tg.toolOptions || {};
      // Multiple tools can be Active for the same button (cornerstone allows
      // it — e.g. WindowLevel + Pan both bound to button 1 after a manual
      // setToolActive that didn't passive the prior tool). Scan all matches;
      // prefer Pan, then Zoom; if only some other tool (WindowLevel, Length,
      // Crosshairs, etc.) is bound, return null so cornerstone handles it.
      var hasPan = false;
      var hasZoom = false;
      for (var name in opts) {
        var o = opts[name];
        if (!o || o.mode !== 'Active') continue;
        var bindings = o.bindings || [];
        for (var i = 0; i < bindings.length; i++) {
          if (bindings[i].mouseButton === mouseButton) {
            if (name === 'Pan') hasPan = true;
            else if (name === 'Zoom') hasZoom = true;
            break;
          }
        }
      }
      if (hasPan)  return 'pan';
      if (hasZoom) return 'zoom';
      return null;
    }

    // Custom pointer-based drag-zoom + drag-pan.
    // - Left-button drag: synced zoom OR synced pan, depending on which
    //   cornerstone tool is currently active for primary button. So clicking
    //   the toolbar Pan button switches left-drag to synced pan.
    // - Right-button drag: always synced vertical pan (mammo convention).
    //   Horizontal pan is intentionally NOT applied — the chest-wall edge
    //   enforcer immediately undoes any horizontal shift.
    vpIds.forEach(function (id) {
      var vp = re.getViewport(id);
      if (!vp || !vp.element) return;
      var dragState = null;
      var onDown = function (ev) {
        if (ev.button !== 0 && ev.button !== 2) return;
        var cam = vp.getCamera && vp.getCamera();
        if (!cam) return;
        var mode;
        if (ev.button === 2) {
          mode = 'pan'; // right-click: always synced pan
        } else {
          // Left-click: route to whichever tool is active in the toolbar.
          mode = _activeToolForButton(1);
          if (!mode) return; // some other tool (Length, etc.) — let cornerstone handle
        }
        dragState = {
          startY: ev.clientY,
          startX: ev.clientX,
          startParallelScale: cam.parallelScale,
          mode: mode,
        };
        // For pan, capture each peer's starting camera so the pan tracks
        // from a stable origin (per-pointermove deltas would otherwise drift
        // when combined with the edge enforcer's CAMERA_MODIFIED writes).
        if (mode === 'pan') {
          dragState.peerStarts = {};
          _mammoSyncIds.forEach(function (peerId) {
            var peerVp = re.getViewport(peerId);
            if (!peerVp || !peerVp.getCamera || !peerVp.canvas || !peerVp.canvasToWorld) return;
            var pcam = peerVp.getCamera();
            if (!pcam || !pcam.focalPoint || !pcam.position) return;
            // World vector for one canvas-y unit at canvas mid (screen-down).
            // Use CSS pixel dimensions (canvasToWorld expects CSS coords;
            // canvas.width/height is the device-pixel buffer which differs
            // from CSS coords on high-DPI displays).
            var canvasH = peerVp.canvas.clientHeight || peerVp.canvas.height;
            var canvasW = peerVp.canvas.clientWidth || peerVp.canvas.width;
            var origin = peerVp.canvasToWorld([canvasW / 2, canvasH / 2]);
            var oneDown = peerVp.canvasToWorld([canvasW / 2, canvasH / 2 + 1]);
            if (!origin || !oneDown) return;
            dragState.peerStarts[peerId] = {
              focalPoint: pcam.focalPoint.slice(),
              position: pcam.position.slice(),
              downVec: [oneDown[0] - origin[0], oneDown[1] - origin[1], oneDown[2] - origin[2]],
            };
          });
        }
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation && ev.stopImmediatePropagation();
      };
      var onMove = function (ev) {
        if (!dragState) return;
        if (dragState.mode === 'zoom') {
          var dy = ev.clientY - dragState.startY;
          // Drag down → smaller parallelScale → zoom in.
          var factor = Math.exp(dy * 0.005);
          // Sync zoom across viewports. The edge enforcer (running on
          // CAMERA_MODIFIED) keeps each chest wall glued at its inner edge
          // as parallelScale changes.
          _mammoSyncIds.forEach(function (peerId) {
            var peerVp = re.getViewport(peerId);
            if (!peerVp || !peerVp.getCamera || !peerVp.setCamera) return;
            var newPS = Math.max(1, Math.min(5000, dragState.startParallelScale * factor));
            peerVp.setCamera({ parallelScale: newPS });
            if (peerVp.render) peerVp.render();
          });
        } else if (dragState.mode === 'pan') {
          // Vertical-only pan synced across peers. Drag down → image follows
          // finger (image translates down in canvas) → camera shifts up,
          // i.e. shift along -downVec by dyCanvas.
          var dyCanvas = ev.clientY - dragState.startY;
          _mammoSyncIds.forEach(function (peerId) {
            var peerVp = re.getViewport(peerId);
            var start = dragState.peerStarts && dragState.peerStarts[peerId];
            if (!peerVp || !start || !peerVp.setCamera) return;
            var dW = [
              -dyCanvas * start.downVec[0],
              -dyCanvas * start.downVec[1],
              -dyCanvas * start.downVec[2],
            ];
            peerVp.setCamera({
              focalPoint: [
                start.focalPoint[0] + dW[0],
                start.focalPoint[1] + dW[1],
                start.focalPoint[2] + dW[2],
              ],
              position: [
                start.position[0] + dW[0],
                start.position[1] + dW[1],
                start.position[2] + dW[2],
              ],
            });
            if (peerVp.render) peerVp.render();
          });
        }
      };
      var onUp = function () { dragState = null; };
      vp.element.addEventListener('pointerdown', onDown, true);
      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onUp, true);
      vp.element.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      _mammoSyncBindings.push({ element: vp.element, onDown: onDown, onMove: onMove, onUp: onUp });
    });
  }

  // When false, each viewport zooms independently using cornerstone's stock
  // Zoom tool — useful for validating that chest-wall edge anchoring sticks
  // on a single viewport. When true, install custom drag-zoom + drag-pan
  // handlers that sync across all bilateral viewports. Toggleable at runtime
  // via the Mammo sidebar; see toggleMammoSync below.
  var LR_MAMMO_SYNC_ENABLED = true;

  // Mammo bilateral display:
  // 1. Anchor each viewport's chest-wall side to the inner divider via
  //    setDisplayArea({imagePoint, canvasPoint}). DICOM stores RCC with chest
  //    wall on image RIGHT (PatientOrientation [P,L]) and LCC on image LEFT
  //    ([A,R]); we map those points to the inner edge of each canvas. As the
  //    user zooms, the anchor stays glued — chest walls stay touching at the
  //    divider.
  // 2. Subscribe to viewport-level events (IMAGE_RENDERED, STACK_NEW_IMAGE,
  //    CAMERA_RESET) to re-apply the anchor whenever cornerstone resets the
  //    camera (which happens on initial image load and when the Reset tool
  //    fires). Without this re-apply the load reset wipes our anchoring.
  // 3. If LR_MAMMO_SYNC_ENABLED, bind viewports to a shared zoompan sync.
  function _mammoLateralityAnchor(slot) {
    return slot && slot.charAt(0) === 'R' ? 1 : 0;
  }
  // Source-of-truth for which side of the body each viewport is showing.
  // Reads ImageLaterality from the viewport's currently-displayed instance.
  // Falls back to null if we can't get it; caller substitutes slot-based.
  // Robustness matters here: viewports' positional order in the grid is
  // not guaranteed to match the order we passed to setDisplaySetsForViewports
  // (observed asymmetry: LCC sticks but RCC doesn't, when slot[0]/slot[1]
  // got crossed with vp[0]/vp[1]).
  function _readVpLaterality(vp, vpId) {
    try {
      var dssService = window.services && window.services.displaySetService;
      var gs = window.services && window.services.viewportGridService;
      var grid = gs && gs.getState();
      var dsuids = [];
      // 1. Try the viewport's options
      try {
        if (vp && vp.options && vp.options.displaySetInstanceUIDs) {
          dsuids = dsuids.concat(vp.options.displaySetInstanceUIDs);
        }
      } catch (e) {}
      // 2. Try grid state's viewport entry
      try {
        if (grid && grid.viewports && grid.viewports.get) {
          var entry = grid.viewports.get(vpId);
          if (entry && entry.displaySetInstanceUIDs) {
            dsuids = dsuids.concat(entry.displaySetInstanceUIDs);
          }
        }
      } catch (e) {}
      for (var i = 0; i < dsuids.length; i++) {
        var ds = dssService && dssService.getDisplaySetByUID && dssService.getDisplaySetByUID(dsuids[i]);
        if (ds && ds.instances && ds.instances[0]) {
          var lat = (ds.instances[0].ImageLaterality || '').toUpperCase();
          if (lat === 'R') return true;
          if (lat === 'L') return false;
        }
      }
    } catch (e) {}
    return null;
  }
  // Initial anchor: declaratively bind imagePoint→canvasPoint via setDisplayArea
  // and store as initial camera so a future Reset returns to this state.
  function _applyMammoEdgeAnchor(vp, anchor) {
    if (!vp || !vp.setDisplayArea) return;
    try {
      vp.setDisplayArea({
        imageCanvasPoint: {
          imagePoint: [anchor, 0.5],
          canvasPoint: [anchor, 0.5],
        },
        storeAsInitialCamera: true,
      });
      if (vp.render) vp.render();
    } catch (e) { /* swallow — viewport may not be ready yet */ }
  }
  // chest wall world point per viewport — captured once after initial anchor
  // settles. Used on CAMERA_MODIFIED to keep the chest wall pinned to the
  // canvas inner edge in screen-X under any user-driven zoom. Only the X
  // component is constrained so vertical pan remains free.
  // Implementation uses canvasToWorld / worldToCanvas to be agnostic to
  // viewPlaneNormal / viewUp orientation (mammo viewports have camera along
  // world +X, so screen-X is along world -Y, NOT world X).
  var _mammoChest = {};         // vpId → { worldPt, isRight }
  var _mammoEnforcing = {};     // re-entry guard per viewport
  function _captureMammoChest(vp, id, isRight) {
    if (!vp || !vp.canvas || !vp.canvasToWorld) return;
    var canvasH = (vp.canvas.clientHeight || vp.canvas.height);
    var canvasW = (vp.canvas.clientWidth || vp.canvas.width);
    var px = isRight ? [canvasW, canvasH / 2] : [0, canvasH / 2];
    var worldPt = vp.canvasToWorld(px);
    if (!worldPt) return;
    _mammoChest[id] = { worldPt: worldPt, isRight: isRight };
  }
  function _enforceMammoChest(vp, id) {
    if (_mammoEnforcing[id]) return;
    var c = _mammoChest[id];
    if (!c) return;
    if (!vp || !vp.canvas || !vp.worldToCanvas || !vp.canvasToWorld) return;
    if (!vp.getCamera || !vp.setCamera) return;
    var canvasW = (vp.canvas.clientWidth || vp.canvas.width);
    var canvasH = (vp.canvas.clientHeight || vp.canvas.height);
    var desiredX = c.isRight ? canvasW : 0;
    var actualPx = vp.worldToCanvas(c.worldPt);
    if (!actualPx) return;
    var dxCanvas = actualPx[0] - desiredX;
    if (Math.abs(dxCanvas) < 0.5) return;
    // World vector for one canvas-x unit at canvas mid-height.
    var origin = vp.canvasToWorld([0, canvasH / 2]);
    var oneRight = vp.canvasToWorld([1, canvasH / 2]);
    if (!origin || !oneRight) return;
    var rightVec = [oneRight[0] - origin[0], oneRight[1] - origin[1], oneRight[2] - origin[2]];
    // Camera shift = +dxCanvas * rightVec (moves the camera to the right in
    // screen space, which moves the image to the LEFT in canvas, restoring
    // the chest wall to canvas right).
    var dW = [dxCanvas * rightVec[0], dxCanvas * rightVec[1], dxCanvas * rightVec[2]];
    var cam = vp.getCamera();
    if (!cam) return;
    _mammoEnforcing[id] = true;
    try {
      vp.setCamera({
        focalPoint: [cam.focalPoint[0] + dW[0], cam.focalPoint[1] + dW[1], cam.focalPoint[2] + dW[2]],
        position: [cam.position[0] + dW[0], cam.position[1] + dW[1], cam.position[2] + dW[2]],
      });
    } catch (e) {}
    setTimeout(function () { _mammoEnforcing[id] = false; }, 0);
  }
  var _mammoEdgeListeners = [];
  // Continuous enforcement loop — runs on every animation frame as long as
  // any viewport is registered in _mammoChest. Reactive event-driven
  // enforcement (CAMERA_MODIFIED) was missing some drift on certain
  // viewports across browser/Electron event-timing variations. A 60fps
  // loop is cheap (a few canvas/world transforms per viewport) and robust.
  var _mammoLoopRunning = false;
  function _mammoEnforceTick() {
    if (!_mammoLoopRunning) return;
    try {
      var re = window.cornerstone && window.cornerstone.getRenderingEngines && window.cornerstone.getRenderingEngines()[0];
      if (re) {
        Object.keys(_mammoChest).forEach(function (id) {
          var vp = re.getViewport(id);
          if (vp) _enforceMammoChest(vp, id);
        });
      }
    } catch (e) {}
    requestAnimationFrame(_mammoEnforceTick);
  }
  function _startMammoEnforceLoop() {
    if (_mammoLoopRunning) return;
    _mammoLoopRunning = true;
    requestAnimationFrame(_mammoEnforceTick);
  }
  function _stopMammoEnforceLoop() { _mammoLoopRunning = false; }
  function _teardownMammoEdgeListeners() {
    _mammoEdgeListeners.forEach(function (l) {
      try { l.elem.removeEventListener(l.evt, l.fn); } catch (e) {}
    });
    _mammoEdgeListeners = [];
    _mammoChest = {};
    _mammoEnforcing = {};
    _stopMammoEnforceLoop();
  }
  function applyMammoDisplayConventions(slotsInOrder) {
    try {
      var re = window.cornerstone && window.cornerstone.getRenderingEngines && window.cornerstone.getRenderingEngines()[0];
      if (!re) return;
      var gs = window.services && window.services.viewportGridService;
      var grid = gs && gs.getState();
      var currentVpIds = grid ? viewportsAsArray(grid).map(function (e) { return e.id; }) : [];
      var EVT = window.cornerstone && window.cornerstone.Enums && window.cornerstone.Enums.Events;

      _teardownMammoEdgeListeners();

      var anchored = 0;
      currentVpIds.forEach(function (id, i) {
        var vp = re.getViewport(id);
        var slot = slotsInOrder && slotsInOrder[i];
        if (!vp) return;
        // Read laterality from the viewport's actual displaySet.
        // This is the source of truth — slot[i] is just a positional hint
        // that may not match if grid viewport order != populate order.
        var dsLat = _readVpLaterality(vp, id);
        var isRight;
        if (dsLat === true || dsLat === false) {
          isRight = dsLat;
        } else if (slot) {
          isRight = slot.charAt(0) === 'R';
        } else {
          return;
        }
        var anchorPt = isRight ? 1 : 0;
        var elem = vp.element;
        if (!elem || !EVT) return;
        // Re-anchor: setDisplayArea + capture chestWorldPoint immediately.
        // We capture synchronously right after setDisplayArea (when the
        // image's chest edge is provably at the canvas inner edge), and
        // suppress the enforcer during the call so the resulting
        // CAMERA_MODIFIED can't drag the camera based on a stale capture.
        var reAnchor = function () {
          _mammoEnforcing[id] = true;
          _applyMammoEdgeAnchor(vp, anchorPt);
          // Synchronous capture: at this moment canvasToWorld([innerEdgePx,
          // h/2]) returns the actual image chest-edge world coordinate.
          _captureMammoChest(vp, id, isRight);
          // Release the enforcer on the next macrotask so any
          // setDisplayArea-driven CAMERA_MODIFIED has flushed.
          setTimeout(function () { _mammoEnforcing[id] = false; }, 0);
        };
        // 1. Initial anchor + capture
        reAnchor();
        anchored++;
        // 2. Safety re-capture at 250ms in case the image-load reset hadn't
        //    happened yet at initial run (canvasToWorld would have returned
        //    a pre-load value, which the STACK_NEW_IMAGE listener will fix
        //    when it fires — this is just belt-and-braces).
        setTimeout(reAnchor, 250);
        // 3. CAMERA_MODIFIED: shift focalPoint to keep chestWorldPoint glued.
        //    Coalesced via requestAnimationFrame so cornerstone's internal
        //    multi-pass camera updates (e.g. resetCamera fires 6 CAMERA_MODIFIED
        //    in one call) settle before our enforcer reads + corrects. Direct
        //    sync correction inside resetCamera was overridden by its later
        //    passes, leaving a 32px chest drift.
        var rafPending = false;
        var fnCM = function () {
          if (rafPending) return;
          rafPending = true;
          requestAnimationFrame(function () {
            rafPending = false;
            _enforceMammoChest(vp, id);
          });
        };
        if (EVT.CAMERA_MODIFIED) {
          elem.addEventListener(EVT.CAMERA_MODIFIED, fnCM);
          _mammoEdgeListeners.push({ elem: elem, evt: EVT.CAMERA_MODIFIED, fn: fnCM });
        }
        // 4. On NEW image (display set switch): re-anchor + fresh capture so
        //    chestWorldPoint reflects the new image's bounds.
        //    NOT bound: CAMERA_RESET. Cornerstone's setDisplayArea is not
        //    idempotent across calls — re-running it on reset produces a
        //    slightly different camera (~32px drift in our test). Instead
        //    we let the CAMERA_MODIFIED enforcer above snap any post-reset
        //    drift back using the stable captured chestWorldPoint.
        ['STACK_NEW_IMAGE', 'VOLUME_NEW_IMAGE'].forEach(function (k) {
          var n = EVT[k];
          if (!n) return;
          elem.addEventListener(n, reAnchor);
          _mammoEdgeListeners.push({ elem: elem, evt: n, fn: reAnchor });
        });
      });

      // Stash so the toggleMammoSync runtime UI can re-install bindings
      // without needing to know the original preset.
      _lastMammoSlots = slotsInOrder;
      _lastMammoVpIds = currentVpIds.slice();

      if (LR_MAMMO_SYNC_ENABLED) {
        setTimeout(function () {
          setupMammoZoomSync(
            currentVpIds.filter(function (id) { return !!id; }),
            slotsInOrder
          );
        }, 50);
      }

      // Start the continuous edge-enforce loop. It runs at 60fps and
      // snaps any drifted chest world point back to the canvas inner edge.
      _startMammoEnforceLoop();
      document.body.classList.add('lr-mammo-mode');
      console.log('[LinkRad] Mammo edge-anchor —', anchored, 'viewport(s) · sync:', LR_MAMMO_SYNC_ENABLED);
    } catch (e) { console.warn('[LinkRad] applyMammoDisplayConventions failed', e); }
  }
  var _lastMammoSlots = null;
  var _lastMammoVpIds = null;
  // Runtime toggle. Wired to the Mammo sidebar checkbox below.
  function toggleMammoSync(enabled) {
    LR_MAMMO_SYNC_ENABLED = !!enabled;
    if (!enabled) {
      teardownMammoZoomSync();
      console.log('[LinkRad] Mammo sync OFF');
      return;
    }
    if (!_lastMammoSlots || !_lastMammoVpIds) {
      console.log('[LinkRad] Mammo sync ON (will activate when CC/MLO preset is loaded)');
      return;
    }
    setupMammoZoomSync(_lastMammoVpIds.filter(function (id) { return !!id; }), _lastMammoSlots);
    console.log('[LinkRad] Mammo sync ON');
  }

  // Zoom/Pan sync — OHIF v3.8's toggleSynchronizer command only registers
  // 'imageSlice' and 'voi' toggle functions, so type:'zoomPan' silently
  // no-ops. The underlying syncGroupService DOES register a 'zoompan'
  // synchronizer factory (createZoomPanSynchronizer), so we drive it
  // directly. Setter, not flipper — the sidebar checkbox passes its new
  // state as `enabled`.
  var LR_ZOOMPAN_SYNC_ID = 'LR_ZOOMPAN_SYNC';
  function setZoomPanSync(enabled) {
    try {
      var s = window.services;
      var sgs = s && s.syncGroupService;
      var vgs = s && s.viewportGridService;
      var cvs = s && s.cornerstoneViewportService;
      if (!sgs || !vgs || !cvs) {
        console.warn('[LinkRad] setZoomPanSync: services not ready');
        return;
      }
      var grid = vgs.getState();
      var vps = grid && grid.viewports;
      var arr = vps && (vps.values ? Array.from(vps.values()) : Object.values(vps));
      if (!arr || !arr.length) return;
      arr.forEach(function (gv) {
        var vid = gv.viewportOptions && gv.viewportOptions.viewportId;
        if (!vid) return;
        var vp = cvs.getCornerstoneViewport(vid);
        if (!vp) return;
        var re = vp.getRenderingEngine && vp.getRenderingEngine();
        if (!re || !re.id) return;
        try {
          if (enabled) {
            sgs.addViewportToSyncGroup(vid, re.id, {
              type: 'zoompan',
              id: LR_ZOOMPAN_SYNC_ID,
              source: true,
              target: true,
            });
          } else {
            sgs.removeViewportFromSyncGroup(vid, re.id, LR_ZOOMPAN_SYNC_ID);
          }
        } catch (e) { /* per-viewport failure is non-fatal */ }
      });
      console.log('[LinkRad] zoom/pan sync', enabled ? 'ON' : 'OFF', '— viewports:', arr.length);
    } catch (e) {
      console.warn('[LinkRad] setZoomPanSync failed', e);
    }
  }

  var LR_FUNCS = {
    deleteLastAnnotation: deleteLastAnnotation,
    deleteAllAnnotations: deleteAllAnnotations,
    togglePatientOverlay: togglePatientOverlay,
    toggleAnonymizeOverlay: toggleAnonymizeOverlay,
    setMPRBlendMode: function (arg) { setMPRBlendMode(arg); },
    setSlabThickness: function (mm) { setSlabThickness(mm); },
    toggleMPRCrossline: toggleMPRCrossline,
    set3DOrientation: function (arg) { set3DOrientation(arg); },
    set3DRenderMode: function (arg) { set3DRenderMode(arg); },
    toggle3DOrbit: toggle3DOrbit,
    toggle3DBox: toggle3DBox,
    toggle3DCursor: toggle3DCursor,
    toggleRotateAroundCursor: toggleRotateAroundCursor,
    removeBed: removeBed,
    resetTissue: resetTissue,
    setMammoHanging: function (arg) { setMammoHanging(arg); },
    toggleMammoSync: function (arg) { toggleMammoSync(arg); },
    toggleMammoSliceSync: function (arg) { toggleMammoSliceSync(arg); },
    setMagnifyLevel: function (level) { setMagnifyLevel(level); },
    restoreDefaultWL: restoreDefaultWL,
    applyWLPreset: function (arg) { applyWLPreset(arg); },
    clearColormap: clearColormap,
    showVolumeLoadingOverlay: showVolumeLoadingOverlay,
    hideVolumeLoadingOverlay: hideVolumeLoadingOverlay,
    setZoomPanSync: function (arg) { setZoomPanSync(!!arg); },
  };

  // ============================================================
  // Right sidebar — per-mode panels
  // ============================================================
  // Layout button glyphs (small SVG previews)
  function layoutGlyph(rows, cols) {
    var w = 28, h = 28, pad = 2;
    var cellW = (w - pad * (cols + 1)) / cols;
    var cellH = (h - pad * (rows + 1)) / rows;
    var rects = '';
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var x = pad + c * (cellW + pad);
        var y = pad + r * (cellH + pad);
        rects += '<rect x="' + x + '" y="' + y + '" width="' + cellW + '" height="' + cellH + '" fill="currentColor" opacity="0.6"/>';
      }
    }
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="22" height="22">' + rects + '</svg>';
  }

  var SIDEBAR_2D = {
    sections: [
      {
        title: 'W/L Presets',
        type: 'pills',
        dynamicItems: 'wl',
        hint: 'Mặc định = giữ W/L gốc của DICOM',
      },
      {
        title: 'Bố cục — Chuỗi',
        type: 'layout',
        items: [
          { rows: 1, cols: 1, tip: '1 viewport' },
          { rows: 1, cols: 2, tip: '2 ngang' },
          { rows: 2, cols: 2, tip: '2 × 2' },
          { rows: 3, cols: 3, tip: '3 × 3' },
        ],
      },
      {
        title: 'Đồng bộ ca chụp',
        type: 'checks',
        items: [
          { label: 'Cuộn theo vị trí (mm)', cmd: 'toggleSynchronizer', cmdOpts: { type: 'imageSlice' } },
          { label: 'Đồng bộ W/L',           cmd: 'toggleSynchronizer', cmdOpts: { type: 'voi' } },
          { label: 'Đồng bộ Zoom/Pan',      fn: 'setZoomPanSync' },
        ],
      },
      {
        title: 'Cine',
        type: 'cine',
      },
    ],
  };

  // ============================================================
  // SIDEBAR_MPR — for MPR mode
  // ============================================================
  var SIDEBAR_MPR = {
    sections: [
      {
        title: 'Bố cục — MPR',
        type: 'layout',
        items: [
          { protocol: 'linkradMpr', glyph: 'mpr3', tip: 'Mặc định: 1 lớn + 2 phải (axial · sagittal · coronal)' },
          { rows: 1, cols: 1, tip: '1 viewport' },
          { rows: 1, cols: 3, tip: 'MPR 3-up (axial / sagittal / coronal)' },
          { rows: 2, cols: 2, tip: '2 × 2 (MPR + axial double)' },
        ],
      },
      {
        title: 'MPR Mode',
        type: 'pills',
        cols: 5,
        items: [
          { label: 'MPR',   tip: 'Standard slice', fn: 'setMPRBlendMode', arg: 'COMPOSITE' },
          { label: 'AIP',   tip: 'Average IP',     fn: 'setMPRBlendMode', arg: 'AVERAGE' },
          { label: 'MIP',   tip: 'Max IP — vessels',     fn: 'setMPRBlendMode', arg: 'MAXIMUM' },
          { label: 'MinIP', tip: 'Min IP — air',     fn: 'setMPRBlendMode', arg: 'MINIMUM' },
          { label: 'VR',    tip: 'Volume render',  fn: 'setMPRBlendMode', arg: 'VOLUME' },
        ],
        hint: 'AIP/MIP/MinIP yêu cầu Slab Thickness > 1mm',
      },
      {
        title: 'Slab Thickness',
        type: 'slider',
        min: 1,
        max: 60,
        step: 1,
        defaultValue: 5,
        unit: 'mm',
        fn: 'setSlabThickness',
        presets: [1, 5, 10, 20, 30, 50],
      },
      {
        title: 'Tùy chọn',
        type: 'checks',
        items: [
          { label: 'MPR Crossline (đường tham chiếu)', fn: 'toggleMPRCrossline' },
        ],
      },
      {
        title: 'CPR — Curved Planar Reformation',
        type: 'placeholder',
        message: 'Vẽ đường vessel/cột sống → unroll thành flat strip. Dùng cho CT-angio mạch vành, đốt sống.',
        tag: 'PHASE 2',
      },
      {
        title: 'Đồng bộ ca chụp',
        type: 'checks',
        items: [
          { label: 'Cuộn theo vị trí (mm)', cmd: 'toggleSynchronizer', cmdOpts: { type: 'imageSlice' } },
          { label: 'Đồng bộ W/L',           cmd: 'toggleSynchronizer', cmdOpts: { type: 'voi' } },
          { label: 'Đồng bộ Zoom/Pan',      fn: 'setZoomPanSync' },
        ],
      },
    ],
  };

  // ============================================================
  // SIDEBAR_3D — for 3D mode
  // ============================================================
  var SIDEBAR_3D = {
    sections: [
      {
        title: 'Bố cục — 3D',
        type: 'layout',
        items: [
          { protocol: 'linkrad3D', glyph: '1+3', tip: 'Mặc định: 1 viewport 3D lớn bên trái + 3 MPR bên phải' },
          { rows: 1, cols: 1, tip: '3D fullscreen' },
          { rows: 1, cols: 2, tip: '3D + MPR (2-vert)' },
          { rows: 2, cols: 2, tip: '2 × 2 (3D + MPR triplet)' },
        ],
      },
      {
        title: 'Định hướng',
        type: 'pills',
        cols: 4,
        items: [
          { label: 'Axial',    tip: 'Nhìn từ trên xuống', fn: 'set3DOrientation', arg: 'axial' },
          { label: 'Coronal',  tip: 'Nhìn từ trước',      fn: 'set3DOrientation', arg: 'coronal' },
          { label: 'Sagittal', tip: 'Nhìn từ bên',        fn: 'set3DOrientation', arg: 'sagittal' },
          { label: 'Reset',    tip: 'Khôi phục camera',   fn: 'set3DOrientation', arg: 'reset' },
        ],
      },
      {
        title: 'Render Mode',
        type: 'pills',
        cols: 5,
        items: [
          { label: 'Preset', tip: 'Default preset',               fn: 'set3DRenderMode', arg: 'CT-Bone' },
          { label: 'VR',     tip: 'Volume rendering (color)',    fn: 'set3DRenderMode', arg: 'CT-Soft-Tissue' },
          { label: 'MIP',    tip: 'Maximum Intensity Projection', fn: 'set3DRenderMode', arg: 'CT-MIP' },
          { label: 'MinIP',  tip: 'Minimum Intensity Projection', fn: 'set3DRenderMode', arg: 'CT-MinIP' },
          { label: 'SSD',    tip: 'Surface Shaded Display',       fn: 'set3DRenderMode', arg: 'CT-SSD' },
        ],
        hint: 'SSD đầy đủ trong Phase 2',
      },
      {
        title: '3D Batch (xoay tự động)',
        type: 'pills',
        cols: 1,
        items: [
          { label: '▶ Bắt đầu / dừng xoay 3D', tip: 'Orbit camera around volume', fn: 'toggle3DOrbit' },
        ],
      },
      {
        title: 'Tùy chọn',
        type: 'checks',
        items: [
          { label: 'MPR Crossline (đường tham chiếu)', fn: 'toggleMPRCrossline' },
          { label: '3D Box (khung bao thể tích)',      fn: 'toggle3DBox' },
          { label: '3D Cursor (con trỏ 3D)',           fn: 'toggle3DCursor' },
          { label: 'Xoay quanh 3D Cursor',             fn: 'toggleRotateAroundCursor' },
        ],
      },
      {
        title: '3D Cutting',
        type: 'placeholder',
        message: 'Cắt thể tích bằng vùng Freehand hoặc Rect (popup khi click). Yêu cầu volume đã render.',
        tag: 'V1 nếu scope cho phép',
      },
      {
        title: 'Tách mô (Tissue Segmentation)',
        type: 'pills',
        cols: 2,
        items: [
          { label: 'Bỏ giường', tip: 'Remove couch — HU threshold', fn: 'removeBed' },
          { label: 'Reset',     tip: 'Hiển thị toàn bộ',           fn: 'resetTissue' },
        ],
        hint: 'Phổi / đại tràng cần ML inference — Phase 2',
      },
      {
        title: 'Đồng bộ ca chụp',
        type: 'checks',
        items: [
          { label: 'Cuộn theo vị trí (mm)', cmd: 'toggleSynchronizer', cmdOpts: { type: 'imageSlice' } },
          { label: 'Đồng bộ W/L',           cmd: 'toggleSynchronizer', cmdOpts: { type: 'voi' } },
          { label: 'Đồng bộ Zoom/Pan',      fn: 'setZoomPanSync' },
        ],
      },
    ],
  };

  // ============================================================
  // SIDEBAR_MAMMO — for Mammography (MG modality)
  // ============================================================
  var SIDEBAR_MAMMO = {
    sections: [
      {
        title: 'Bố cục — Mammo',
        type: 'layout',
        items: [
          { rows: 1, cols: 1, tip: '1 viewport' },
          { rows: 1, cols: 2, tip: '2-vert (R | L)' },
          { rows: 2, cols: 2, tip: '2 × 2' },
          { rows: 1, cols: 4, tip: '4-up strip (RCC | LCC | RMLO | LMLO)' },
        ],
      },
      {
        title: 'Hanging Protocol — 2D',
        type: 'pills',
        cols: 2,
        items: [
          { label: 'CC',          tip: '1 viewport CC',  fn: 'setMammoHanging', arg: 'cc' },
          { label: 'MLO',         tip: '1 viewport MLO', fn: 'setMammoHanging', arg: 'mlo' },
          { label: 'CC / MLO 4-up', tip: 'RCC | LCC | RMLO | LMLO', fn: 'setMammoHanging', arg: 'ccmlo4' },
          { label: 'R CC/MLO',    tip: 'RCC + RMLO',    fn: 'setMammoHanging', arg: 'rccmlo' },
          { label: 'L CC/MLO',    tip: 'LCC + LMLO',    fn: 'setMammoHanging', arg: 'lccmlo' },
        ],
      },
      {
        title: 'Hanging Protocol — TOMO (DBT)',
        type: 'pills',
        cols: 2,
        items: [
          { label: 'TOMO CC',    tip: '1 viewport TOMO CC',  fn: 'setMammoHanging', arg: 'tomocc' },
          { label: 'TOMO MLO',   tip: '1 viewport TOMO MLO', fn: 'setMammoHanging', arg: 'tomomlo' },
          { label: 'TOMO 4-up',  tip: 'TOMO RCC | LCC | RMLO | LMLO', fn: 'setMammoHanging', arg: 'tomo4up' },
          { label: 'TOMO R',     tip: 'TOMO RCC + RMLO',     fn: 'setMammoHanging', arg: 'tomor' },
          { label: 'TOMO L',     tip: 'TOMO LCC + LMLO',     fn: 'setMammoHanging', arg: 'tomol' },
        ],
        hint: 'Smart detect: cảnh báo nếu ca không có TOMO',
      },
      {
        title: 'Đồng bộ bilateral (R/L)',
        type: 'checks',
        items: [
          { label: 'Sync zoom & pan giữa các pane mammo', fn: 'toggleMammoSync', defaultChecked: true },
          { label: 'Sync cuộn slice TOMO bilateral',      fn: 'toggleMammoSliceSync', defaultChecked: true },
        ],
        hint: 'Khi bật: kéo trái = zoom đồng bộ, kéo phải = pan dọc đồng bộ. Chest wall luôn dính vào mép trong.',
      },
      {
        title: 'DBT Cine (cuộn TOMO slice)',
        type: 'cine',
      },
      {
        title: 'Đồng bộ ca chụp cũ (prior comparison)',
        type: 'checks',
        items: [
          { label: 'Khóa view với prior',     cmd: 'toggleSynchronizer', cmdOpts: { type: 'imageSlice' } },
          { label: 'Đồng bộ W/L',             cmd: 'toggleSynchronizer', cmdOpts: { type: 'voi' } },
          { label: 'Đồng bộ Zoom/Pan',        fn: 'setZoomPanSync' },
        ],
      },
    ],
  };

  var SIDEBARS = { '2d': SIDEBAR_2D, 'mpr': SIDEBAR_MPR, '3d': SIDEBAR_3D, 'mammo': SIDEBAR_MAMMO };

  function buildPills(items, cols) {
    var grid = document.createElement('div');
    grid.className = 'lr-pill-grid';
    if (cols && cols !== 2) {
      grid.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
    }
    items.forEach(function (it) {
      var b = document.createElement('button');
      b.className = 'lr-pill';
      b.textContent = it.label;
      b.title = it.tip || '';
      b.onclick = function () {
        markActiveSibling(b);
        runItem(it);
      };
      grid.appendChild(b);
    });
    return grid;
  }

  function buildSlider(sec) {
    var wrap = document.createElement('div');
    wrap.className = 'lr-slider-wrap';
    var input = document.createElement('input');
    input.type = 'range';
    input.min = sec.min || 1;
    input.max = sec.max || 60;
    input.step = sec.step || 1;
    input.value = sec.defaultValue || sec.min || 1;
    var label = document.createElement('div');
    label.className = 'lr-slider-val';
    var unit = sec.unit || '';
    function fmt(v) { return v + (unit ? ' ' + unit : ''); }
    label.textContent = fmt(input.value);
    input.oninput = function () {
      label.textContent = fmt(input.value);
      if (sec.fn) {
        var f = LR_FUNCS[sec.fn];
        if (typeof f === 'function') f(+input.value);
      }
    };
    wrap.appendChild(input);
    wrap.appendChild(label);
    if (sec.presets && sec.presets.length) {
      var pwrap = document.createElement('div');
      pwrap.className = 'lr-slider-presets';
      sec.presets.forEach(function (v) {
        var p = document.createElement('button');
        p.className = 'lr-slider-preset';
        p.textContent = v + (unit ? unit : '');
        p.onclick = function () {
          input.value = v;
          label.textContent = fmt(v);
          if (sec.fn) {
            var f = LR_FUNCS[sec.fn];
            if (typeof f === 'function') f(+v);
          }
        };
        pwrap.appendChild(p);
      });
      wrap.appendChild(pwrap);
    }
    return wrap;
  }

  function buildPlaceholder(sec) {
    var w = document.createElement('div');
    w.className = 'lr-placeholder';
    w.innerHTML = sec.message + (sec.tag ? '<span class="lr-placeholder-tag">' + sec.tag + '</span>' : '');
    return w;
  }

  // Custom glyph for the 1-big-top + 3-small-bottom main3D layout
  function layoutGlyphCustom(kind) {
    if (kind === '1+3') {
      // 1 wide rect on top, 3 small rects below
      return '<svg viewBox="0 0 28 28" width="22" height="22">'
        + '<rect x="2"  y="2"  width="24" height="14" fill="currentColor" opacity="0.6"/>'
        + '<rect x="2"  y="18" width="7"  height="8"  fill="currentColor" opacity="0.6"/>'
        + '<rect x="11" y="18" width="7"  height="8"  fill="currentColor" opacity="0.6"/>'
        + '<rect x="20" y="18" width="6"  height="8"  fill="currentColor" opacity="0.6"/>'
        + '</svg>';
    }
    if (kind === 'mpr3') {
      // 3 vertical rects (axial / sagittal / coronal)
      return '<svg viewBox="0 0 28 28" width="22" height="22">'
        + '<rect x="2"  y="2" width="7" height="24" fill="currentColor" opacity="0.6"/>'
        + '<rect x="11" y="2" width="7" height="24" fill="currentColor" opacity="0.6"/>'
        + '<rect x="20" y="2" width="6" height="24" fill="currentColor" opacity="0.6"/>'
        + '</svg>';
    }
    return layoutGlyph(1, 1);
  }

  function buildLayoutRow(items) {
    var row = document.createElement('div');
    row.className = 'lr-layout-row';
    items.forEach(function (it) {
      var b = document.createElement('button');
      b.className = 'lr-layout-btn';
      var defaultTip = it.protocol ? it.protocol : (it.rows + 'x' + it.cols);
      b.title = it.tip || defaultTip;
      b.innerHTML = it.glyph ? layoutGlyphCustom(it.glyph) : layoutGlyph(it.rows, it.cols);
      b.onclick = function () {
        markActiveSibling(b);
        try {
          if (it.protocol) {
            // Re-apply a hanging protocol (used for "default" layouts that
            // aren't a uniform rows×cols grid, e.g. main3D = 1 big top + 3 MPR).
            window.commandsManager.run({
              commandName: 'setHangingProtocol',
              commandOptions: { protocolId: it.protocol },
              context: 'DEFAULT',
            });
            rememberLayout({ kind: 'protocol', id: it.protocol });
          } else {
            window.commandsManager.run({
              commandName: 'setViewportGridLayout',
              commandOptions: { numRows: it.rows, numCols: it.cols },
              context: 'DEFAULT',
            });
            rememberLayout({ kind: 'grid', rows: it.rows, cols: it.cols });
          }
        } catch (e) { console.warn('[LinkRad sidebar] layout switch failed', e); }
      };
      row.appendChild(b);
    });
    // Default-active: first button
    var first = row.querySelector('.lr-layout-btn');
    if (first) first.classList.add('active');
    return row;
  }

  function markActiveSibling(el) {
    var parent = el.parentElement;
    if (!parent) return;
    parent.querySelectorAll('.lr-layout-btn,.lr-pill').forEach(function (x) { x.classList.remove('active'); });
    el.classList.add('active');
  }

  function buildChecks(items) {
    var wrap = document.createElement('div');
    items.forEach(function (it) {
      var lbl = document.createElement('label');
      lbl.className = 'lr-check';
      var input = document.createElement('input');
      input.type = 'checkbox';
      if (it.defaultChecked) input.checked = true;
      input.onchange = function () {
        // Pass the new check state as the function arg so the wired
        // function can act as an idempotent setter rather than a flipper.
        var argItem = it;
        if (it.fn) argItem = { fn: it.fn, arg: input.checked };
        runItem(argItem);
      };
      lbl.appendChild(input);
      var span = document.createElement('span');
      span.textContent = it.label;
      lbl.appendChild(span);
      wrap.appendChild(lbl);
    });
    return wrap;
  }

  function buildCine() {
    var bar = document.createElement('div');
    bar.className = 'lr-cine-bar';
    var prev = document.createElement('button'); prev.className = 'lr-cine-btn'; prev.innerHTML = svgIcon('rotateCCW'); prev.title = 'Image trước'; prev.onclick = function () { runCmd('decrementActiveViewport'); };
    var play = document.createElement('button'); play.className = 'lr-cine-btn'; play.innerHTML = svgIcon('play');      play.title = 'Cine play/pause'; play.onclick = function () { runCmd('toggleCine'); };
    var next = document.createElement('button'); next.className = 'lr-cine-btn'; next.innerHTML = svgIcon('rotateCW');  next.title = 'Image sau';   next.onclick = function () { runCmd('incrementActiveViewport'); };
    var fps  = document.createElement('select');
    [10, 15, 24, 30, 60].forEach(function (v) {
      var opt = document.createElement('option'); opt.value = v; opt.textContent = v + ' FPS'; fps.appendChild(opt);
    });
    fps.value = 24;
    fps.onchange = function () {
      try {
        window.commandsManager.run({ commandName: 'setCineFrameRate', commandOptions: { framesPerSecond: +fps.value }, context: 'CORNERSTONE' });
      } catch (e) { /* may not exist; ignore */ }
    };
    bar.appendChild(prev); bar.appendChild(play); bar.appendChild(next); bar.appendChild(fps);
    return bar;
  }

  function runCmd(name, opts) {
    try {
      window.commandsManager.run({ commandName: name, commandOptions: opts || {}, context: 'CORNERSTONE' });
    } catch (e) { console.warn('[LinkRad sidebar] cmd failed', name, e); }
  }

  function resolveDynamicPills(id) {
    if (id === 'wl') return buildWLPresetPills();
    return [];
  }

  function buildSection(sec) {
    var wrap = document.createElement('div');
    wrap.className = 'lr-sec';
    var t = document.createElement('div');
    t.className = 'lr-sec-title';
    t.textContent = sec.title;
    wrap.appendChild(t);
    var body;
    var pillItems = sec.dynamicItems ? resolveDynamicPills(sec.dynamicItems) : sec.items;
    if (sec.type === 'pills')        body = buildPills(pillItems, sec.cols);
    else if (sec.type === 'layout')  body = buildLayoutRow(sec.items);
    else if (sec.type === 'checks')  body = buildChecks(sec.items);
    else if (sec.type === 'cine')    body = buildCine();
    else if (sec.type === 'slider')  body = buildSlider(sec);
    else if (sec.type === 'placeholder') body = buildPlaceholder(sec);
    if (body) wrap.appendChild(body);
    if (sec.hint) {
      var h = document.createElement('div'); h.className = 'lr-sec-hint'; h.textContent = sec.hint;
      wrap.appendChild(h);
    }
    return wrap;
  }

  function renderSidebar() {
    var sb = document.getElementById('linkrad-sidebar');
    if (!sb) {
      sb = document.createElement('div');
      sb.id = 'linkrad-sidebar';
      document.body.appendChild(sb);
    }
    sb.innerHTML = '';
    // Modality MG always gets the Mammo sidebar — overrides any mode tab state
    var modeKey = currentModality === 'MG' ? 'mammo' : currentMode;
    var def = SIDEBARS[modeKey] || SIDEBAR_2D;
    def.sections.forEach(function (s) { sb.appendChild(buildSection(s)); });
  }

  function markActive(id) {
    document.querySelectorAll('#linkrad-toolbar .lr-btn').forEach(function (b) {
      b.classList.remove('active');
    });
    var b = document.getElementById('lr-btn-' + id);
    if (b) b.classList.add('active');
  }

  // ============================================================
  // Mode switching
  // ============================================================
  // Custom hanging protocols cloned from OHIF's built-ins with our preferred
  // layouts. Registered once at boot; indexed below.
  var MODE_TO_PROTOCOL = {
    '2d':  'default',
    'mpr': 'linkradMpr',  // 1 big left + 2 small stacked right (axial / sag+cor)
    '3d':  'linkrad3D',   // 1 big 3D left + 3 MPR stacked right
  };

  // Register custom protocols on first switchMode call. Idempotent.
  var _customProtocolsRegistered = false;
  function registerCustomProtocols() {
    if (_customProtocolsRegistered) return;
    var hp = window.services && window.services.hangingProtocolService;
    if (!hp || !hp.getProtocolById || !hp.addProtocol) return;
    try {
      // 3D mode: clone main3D, change layout from 1-top + 3-bottom to 1-left + 3-right
      var mainProto = hp.getProtocolById('main3D');
      if (mainProto) {
        var d3d = JSON.parse(JSON.stringify(mainProto, function (k, v) {
          // strip locked flag so addProtocol accepts it
          return v;
        }));
        d3d.id = 'linkrad3D';
        d3d.name = 'LinkRad 3D';
        d3d.locked = false;
        d3d.isPreset = false;
        d3d.stages[0].id = 'linkrad3DStage';
        d3d.stages[0].name = 'linkrad3D';
        d3d.stages[0].viewportStructure.properties = {
          rows: 3,
          columns: 2,
          layoutOptions: [
            { x: 0,   y: 0,        width: 0.5, height: 1 },        // big 3D left
            { x: 0.5, y: 0,        width: 0.5, height: 1 / 3 },    // MPR 1 top-right
            { x: 0.5, y: 1 / 3,    width: 0.5, height: 1 / 3 },    // MPR 2 mid-right
            { x: 0.5, y: 2 / 3,    width: 0.5, height: 1 / 3 },    // MPR 3 bot-right
          ],
        };
        // Rename viewport IDs so they don't collide with 2D mode's "default".
        // OHIF's per-viewport-id presentation cache (LUT + transfer function)
        // is the root cause of the binarized 2D image after exiting 3D — if
        // the IDs don't overlap, no cache key collision, no bleed.
        if (d3d.stages[0].viewports && d3d.stages[0].viewports.length) {
          d3d.stages[0].viewports.forEach(function (v, i) {
            v.viewportOptions = v.viewportOptions || {};
            v.viewportOptions.viewportId = 'lr3d-' + i;
          });
        }
        hp.addProtocol('linkrad3D', d3d);
        console.log('[LinkRad] registered hanging protocol: linkrad3D (1-left + 3-right)');
      }
      // MPR mode: clone mpr, change from 3-horizontal to 1-left + 2-right
      var mprProto = hp.getProtocolById('mpr');
      if (mprProto) {
        var mpr2 = JSON.parse(JSON.stringify(mprProto));
        mpr2.id = 'linkradMpr';
        mpr2.name = 'LinkRad MPR';
        mpr2.locked = false;
        mpr2.isPreset = false;
        if (mpr2.stages[0].viewports && mpr2.stages[0].viewports.length) {
          mpr2.stages[0].viewports.forEach(function (v, i) {
            v.viewportOptions = v.viewportOptions || {};
            v.viewportOptions.viewportId = 'lrmpr-' + i;
          });
        }
        mpr2.stages[0].viewportStructure.properties = {
          rows: 2,
          columns: 2,
          layoutOptions: [
            { x: 0,   y: 0,   width: 0.5, height: 1 },     // big axial left
            { x: 0.5, y: 0,   width: 0.5, height: 0.5 },   // sagittal top-right
            { x: 0.5, y: 0.5, width: 0.5, height: 0.5 },   // coronal bot-right
          ],
        };
        hp.addProtocol('linkradMpr', mpr2);
        console.log('[LinkRad] registered hanging protocol: linkradMpr (1-left + 2-right)');
      }
      _customProtocolsRegistered = true;
    } catch (e) {
      console.warn('[LinkRad] custom protocol registration failed', e);
    }
  }

  // Clear OHIF v3.8's per-viewport presentation cache. OHIF stores LUT
  // (W/L, invert, colormap) and position (camera, slab, blendMode) keyed by
  // viewportId so that when a new viewport binds to the same key the prior
  // user-tweaks are re-applied. That's exactly the cross-mode leak fingered
  // in project_open_issues.md (CT 2D lung W/L sticks into MPR, MPR layout
  // bleeds into 3D, etc.). We can't call clearPresentation (doesn't exist
  // in v3.8), but pushing empty objects through setPresentations resets it.
  function clearAllPresentations() {
    var svcs = window.services;
    var grid = svcs && svcs.viewportGridService && svcs.viewportGridService.getState && svcs.viewportGridService.getState();
    var csvc = svcs && svcs.cornerstoneViewportService;
    if (!grid || !csvc || typeof csvc.setPresentations !== 'function') return;
    try {
      viewportsAsArray(grid).forEach(function (e) {
        try {
          csvc.setPresentations(e.id, { lutPresentation: {}, positionPresentation: {} });
        } catch (err) { /* viewport not yet bound to a renderer — ignore */ }
      });
    } catch (e) { console.warn('[LinkRad] clearAllPresentations failed', e); }
  }

  function switchMode(mode) {
    if (mode === 'mpr' || mode === '3d') _volumeModeEntries++;
    registerCustomProtocols();
    var leavingVolumeMode = (currentMode === 'mpr' || currentMode === '3d');
    // 2D-after-volume rendering bleed is unfixable at the cornerstone /
    // OHIF API level (probed via spike-2d-bleed.js: setPresentations,
    // disableElement, resetProperties, setViewportColormap, displaySet
    // re-bind, viewport-ID rename, purgeVolumeCache — all fail to clear
    // the VTK transfer state). The ONLY thing that reliably wipes state
    // is OHIF's defaultRouteInit re-running, which happens on location
    // change. Force it by pushing a same-study URL with a cache-buster.
    if (leavingVolumeMode && mode === '2d') {
      try {
        var dss = window.services && window.services.displaySetService;
        var allDS = (dss && dss.getActiveDisplaySets && dss.getActiveDisplaySets()) || [];
        var studyUID = allDS[0] && allDS[0].StudyInstanceUID;
        if (studyUID) {
          currentMode = '2d';
          renderToolbar();
          renderSidebar();
          var url = new URL(window.location.href);
          url.searchParams.set('StudyInstanceUIDs', studyUID);
          url.searchParams.set('_lr2d', String(Date.now()));
          window.history.pushState({}, '', url.toString());
          window.dispatchEvent(new PopStateEvent('popstate'));
          console.log('[LinkRad] 2D mode after volume — forcing defaultRouteInit re-run for clean state');
          return; // skip the normal setHangingProtocol path
        }
      } catch (e) { console.warn('[LinkRad] force-reinit on 2D exit failed', e); }
    }
    if (leavingVolumeMode) {
      // For MPR (kept around but rare) we still try the cheap clear.
      clearAllPresentations();
    }
    // Capture the currently-loaded display set before we switch protocols.
    // After the layout reflows, we'll push the same series into all new viewports
    // so MPR/3D renders the actual volume rather than empty placeholders.
    var beforeDsUIDs = [];
    try {
      var preGrid = window.services && window.services.viewportGridService && window.services.viewportGridService.getState();
      if (preGrid) {
        viewportsAsArray(preGrid).forEach(function (e) {
          if (e.vp.displaySetInstanceUIDs && e.vp.displaySetInstanceUIDs.length && !beforeDsUIDs.length) {
            beforeDsUIDs = e.vp.displaySetInstanceUIDs.slice();
          }
        });
      }
    } catch (e) {}

    currentMode = mode;
    renderToolbar();
    renderSidebar();
    var protocolId = MODE_TO_PROTOCOL[mode];
    if (protocolId) {
      try {
        window.commandsManager.run({
          commandName: 'setHangingProtocol',
          commandOptions: { protocolId: protocolId },
          context: 'DEFAULT',
        });
        console.log('[LinkRad toolbar] mode →', mode, '→ protocol', protocolId);
      } catch (e) {
        console.warn('[LinkRad toolbar] setHangingProtocol failed', protocolId, e);
      }
    } else {
      console.log('[LinkRad toolbar] mode →', mode, '(no protocol mapping)');
    }

    // Volume modes: show live N/T-lát progress while cornerstone streams the
    // volume. The poller hides the overlay automatically when loaded.
    if (mode === 'mpr' || mode === '3d') {
      // Wait one frame so the new viewport panes exist in the DOM
      setTimeout(showVolumeLoadingOverlay, 100);
      // Inject per-viewport plane pickers + anatomical orient cube once
      // viewports are mounted. Retry several times since OHIF's React mount is
      // async and volume3d takes longer to initialize than orthographic.
      [800, 2000, 4000, 8000].forEach(function (ms) {
        setTimeout(function () { injectPlanePickers(); injectOrientCubes(); }, ms);
      });
      // Auto-recover from Intel UHD ANGLE first-render shader race: detect
      // all-black canvas after volume load and silently reload once.
      setTimeout(checkRenderHealth, 12000);
    } else {
      hideVolumeLoadingOverlay();
      // Belt-and-suspenders fix for the volume → 2D bleed (binarized image
      // in viewport 0). OHIF's presentation cache re-applies the prior
      // volume-mode VOI / blendMode to the new stack viewport that shares
      // the same viewport-ID + display-set key. Force-reset properties +
      // camera AFTER setHangingProtocol mounts the new stack viewports.
      // (post-volume-exit cleanup no longer needed — linkrad3D and linkradMpr
      //  use unique viewport IDs (lr3d-* and lrmpr-*) so they can't share a
      //  presentation-cache key with 2D mode's "default" viewport.)
    }

    // Note iter 11: manually pushing display sets here doesn't actually trigger
    // OHIF's React viewport components to mount as volume viewports. The grid
    // state ends up correct but no canvases / cornerstone viewports get created.
    // Keeping this stub for future iterations — real fix needs OHIF source dive
    // (see project_ohif_toolbar memory for the deep-dive notes from iter 11).
    // Workaround for users today: 2D mode works fully; MPR/3D switch the layout
    // visually but viewports stay empty until that work lands.

    // Prime hangingProtocolService state — required for the eventual fix path
    // and harmless either way (also helps when user reloads in MPR mode).
    try {
      var hp = window.services && window.services.hangingProtocolService;
      var dssAll = window.services && window.services.displaySetService && window.services.displaySetService.getActiveDisplaySets();
      if (hp && dssAll && dssAll.length) {
        hp.displaySets = dssAll;
        var sUID = dssAll[0].StudyInstanceUID;
        if (!hp.studies || !hp.studies.length || !hp.studies[0].displaySets) {
          hp.studies = [{ StudyInstanceUID: sUID, displaySets: dssAll }];
        }
        if (!hp.activeStudy || !hp.activeStudy.displaySets) hp.activeStudy = hp.studies[0];
      }
    } catch (e) {}
  }

  // ============================================================
  // Modality detection
  // ============================================================
  function detectModality() {
    try {
      var dss = window.services && window.services.displaySetService;
      if (!dss || !dss.getActiveDisplaySets) return null;
      var sets = dss.getActiveDisplaySets() || [];
      for (var i = 0; i < sets.length; i++) {
        var m = sets[i] && sets[i].Modality;
        if (m) return m;
      }
    } catch (e) {}
    return null;
  }

  function watchModality() {
    setInterval(function () {
      var m = detectModality();
      if (m && m !== currentModality) {
        currentModality = m;
        // Default to 2D for new studies (mode-tab availability may have changed)
        var modes = modesForModality(m);
        if (modes.indexOf(currentMode) === -1) currentMode = modes[0] || '2d';
        renderToolbar();
        renderSidebar();  // Fix iter 8: also re-render sidebar so MG → mammo works
        renderMammoOverlays();  // Iter 9: refresh compression overlays when modality changes
        // Toggle mammo body class so the gap-removing CSS only applies in MG mode
        document.body.classList.toggle('lr-mammo-mode', m === 'MG');
        console.log('[LinkRad toolbar] modality →', m);
      }
    }, 1000);
  }

  // ============================================================
  // Persistence — re-inject if React unmounts our toolbar
  // ============================================================
  function ensureToolbar() {
    if (!document.getElementById('linkrad-toolbar')) {
      renderToolbar();
    }
    if (!document.getElementById('linkrad-sidebar')) {
      renderSidebar();
    }
  }

  function startMutationObserver() {
    var mo = new MutationObserver(function () { ensureToolbar(); });
    mo.observe(document.body, { childList: true, subtree: false });
  }

  // ============================================================
  // Persistent host protocol — single iframe, many studies
  // ============================================================
  // The parent app (PersistentOHIFHost) drives study switching via
  // postMessage so the iframe boots once and stays warm across cases.
  // OHIF v3.8.3's Mode.tsx useEffect depends on `location` + parsed
  // studyInstanceUIDs, so pushing a new search param + dispatching
  // popstate re-runs defaultRouteInit (with proper onModeExit cleanup)
  // WITHOUT remounting ViewerLayout. Our injected DOM and globals
  // (toolbar, watchdog, services/extensionManager/commandsManager)
  // survive untouched. See scripts/spike-study-swap.js for the
  // Playwright spike that validated this.
  //
  // Messages from parent (source: 'linkrad-parent'):
  //   tab-activated     — legacy, kept for compat
  //   lr:loadStudy      { studyUID, restore?, correlationId? }
  //   lr:snapshotState  { correlationId }
  //   lr:purgeStudy     { studyUID, correlationId? }
  //
  // Messages from iframe (source: 'linkrad-iframe'):
  //   lr:loadStudy:done       { studyUID, correlationId? }
  //   lr:loadStudy:error      { studyUID, error, correlationId? }
  //   lr:snapshotState:result { state, correlationId }
  //   lr:purgeStudy:done      { studyUID, removed, correlationId? }

  function _findDisplaySetsForStudy(studyUID) {
    var dss = window.services && window.services.displaySetService;
    if (!dss || !dss.getActiveDisplaySets) return [];
    return (dss.getActiveDisplaySets() || []).filter(function (d) {
      return d && d.StudyInstanceUID === studyUID;
    });
  }

  function _readViewportRuntimeState(viewportId) {
    var cs = window.cornerstone;
    if (!cs || !cs.getRenderingEngines) return null;
    var engines = cs.getRenderingEngines() || [];
    for (var i = 0; i < engines.length; i++) {
      var vp;
      try { vp = engines[i].getViewport(viewportId); } catch (e) {}
      if (!vp) continue;
      var out = {};
      try {
        var props = vp.getProperties ? vp.getProperties() : null;
        if (props) {
          if (props.voiRange) out.voiRange = { lower: props.voiRange.lower, upper: props.voiRange.upper };
          if (typeof props.invert === 'boolean') out.invert = props.invert;
          if (props.colormap) out.colormap = props.colormap;
        }
      } catch (e) {}
      try { if (typeof vp.getCurrentImageIdIndex === 'function') out.sliceIndex = vp.getCurrentImageIdIndex(); } catch (e) {}
      try { if (typeof vp.getBlendMode === 'function') out.blendMode = vp.getBlendMode(); } catch (e) {}
      try { if (typeof vp.getSlabThickness === 'function') out.slabThickness = vp.getSlabThickness(); } catch (e) {}
      try {
        if (typeof vp.getCamera === 'function') {
          var c = vp.getCamera();
          if (c) out.camera = {
            parallelScale: c.parallelScale,
            focalPoint: c.focalPoint && c.focalPoint.slice ? c.focalPoint.slice() : c.focalPoint,
            position: c.position && c.position.slice ? c.position.slice() : c.position,
            viewUp: c.viewUp && c.viewUp.slice ? c.viewUp.slice() : c.viewUp,
          };
        }
      } catch (e) {}
      return out;
    }
    return null;
  }

  function _enumerateGridViewports(grid) {
    // viewportGridService.getState().viewports has been a Map in some OHIF
    // builds and a plain object in others. Normalize to a list.
    var entries = [];
    var v = grid.viewports;
    if (!v) return entries;
    if (typeof v.forEach === 'function' && typeof v.entries === 'function') {
      v.forEach(function (vp, viewportId) { entries.push({ id: viewportId, vp: vp }); });
    } else if (Array.isArray(v)) {
      v.forEach(function (vp) {
        var id = (vp.viewportOptions && vp.viewportOptions.viewportId) || vp.id;
        entries.push({ id: id, vp: vp });
      });
    } else if (typeof v === 'object') {
      Object.keys(v).forEach(function (k) { entries.push({ id: k, vp: v[k] }); });
    }
    return entries;
  }

  function captureState() {
    var gs = window.services && window.services.viewportGridService;
    var grid = gs && gs.getState && gs.getState();
    if (!grid) return null;
    var dss = window.services && window.services.displaySetService;
    var allDS = (dss && dss.getActiveDisplaySets && dss.getActiveDisplaySets()) || [];
    var dsById = {};
    allDS.forEach(function (d) { dsById[d.displaySetInstanceUID] = d; });

    var entries = _enumerateGridViewports(grid);
    var bindings = entries.map(function (e) {
      var dsUIDs = e.vp.displaySetInstanceUIDs || [];
      var refs = dsUIDs.map(function (id) {
        var d = dsById[id];
        return d ? { seriesUID: d.SeriesInstanceUID, sopClass: d.SOPClassUID } : null;
      }).filter(Boolean);
      return {
        viewportId: e.id,
        seriesRefs: refs,
        viewportOptions: e.vp.viewportOptions || null,
        displaySetOptions: e.vp.displaySetOptions || null,
      };
    });

    var viewportStates = entries.map(function (e) {
      return { viewportId: e.id, runtime: _readViewportRuntimeState(e.id) };
    });

    var hp = window.services && window.services.hangingProtocolService;
    var active = hp && hp.getActiveProtocol && hp.getActiveProtocol();
    var hpId = active && active.protocol && active.protocol.id;

    var layout = grid.layout || { numRows: grid.numRows, numCols: grid.numCols };
    return {
      studyUID: allDS[0] ? allDS[0].StudyInstanceUID : null,
      hpId: hpId,
      currentMode: currentMode,
      lastUserLayout: _lastUserLayout,
      layout: { numRows: layout.numRows, numCols: layout.numCols },
      bindings: bindings,
      viewportStates: viewportStates,
    };
  }

  function _waitForStudyDisplaySets(studyUID, timeoutMs) {
    timeoutMs = timeoutMs || 20000;
    return new Promise(function (resolve, reject) {
      var t0 = Date.now();
      function poll() {
        var got = _findDisplaySetsForStudy(studyUID);
        if (got.length > 0) return resolve(got);
        if (Date.now() - t0 > timeoutMs) {
          return reject(new Error('Timeout waiting for displaySets of ' + studyUID));
        }
        setTimeout(poll, 200);
      }
      poll();
    });
  }

  function applyRestoreState(state) {
    if (!state) return Promise.resolve();
    return _waitForStudyDisplaySets(state.studyUID).then(function () {
      var gs = window.services.viewportGridService;
      var lul = state.lastUserLayout;
      var didMammo = false;
      var didMode = false;

      // 1. Re-apply the user's hanging-protocol intent. lastUserLayout is
      //    the authoritative record of "what did the user click last":
      //    - mammo:  CC/MLO/etc. — setMammoHanging does layout + populate
      //              + edge-stick re-install in one call.
      //    - protocol: 2D / MPR / 3D mode tab — switchMode does HP + custom
      //                overlays (volume loading, plane pickers, orient cube).
      //    - grid:   raw grid dimensions (Bố cục sidebar item).
      //    - null:   user never picked anything → let OHIF's default HP run.
      if (lul && lul.kind === 'mammo' && MAMMO_HANGING && MAMMO_HANGING[lul.arg]) {
        try { setMammoHanging(lul.arg, { silent: true }); didMammo = true; }
        catch (e) { console.warn('[LinkRad restore] mammo HP failed', e); }
      } else if (state.currentMode && state.currentMode !== '2d') {
        try { switchMode(state.currentMode); didMode = true; }
        catch (e) { console.warn('[LinkRad restore] switchMode failed', e); }
      } else if (lul && lul.kind === 'grid' && window.commandsManager) {
        try {
          window.commandsManager.run({
            commandName: 'setViewportGridLayout',
            commandOptions: { numRows: lul.rows, numCols: lul.cols },
            context: 'DEFAULT',
          });
        } catch (e) { console.warn('[LinkRad restore] grid layout failed', e); }
      } else if (lul && lul.kind === 'protocol' && lul.id && window.commandsManager) {
        // Catch-all for protocol entries we don't map via currentMode
        try {
          window.commandsManager.run({
            commandName: 'setHangingProtocol',
            commandOptions: { protocolId: lul.id },
            context: 'DEFAULT',
          });
        } catch (e) { console.warn('[LinkRad restore] setHangingProtocol failed', e); }
      }

      // 2. Restore the watchdog's memory NOW so it doesn't undo our HP.
      if (lul) _lastUserLayout = lul;

      // 3. Wait for HP / Mammo populate to settle, then bindings + runtime.
      //    Mammo (populateMammoViewports) has a 350ms internal delay; modes
      //    fire setHangingProtocol which can take ~400-700ms to mount volume
      //    viewports. Default plain HP settles in ~250ms.
      var settleMs = didMammo ? 900 : (didMode ? 1200 : 500);
      return new Promise(function (resolve) {
        setTimeout(function () {
          // 4. Bindings — only for non-Mammo paths. setMammoHanging already
          //    ran populateMammoViewports which calls setDisplaySetsForViewports
          //    with its own positional slot mapping; restoring stored bindings
          //    on top would fight it. For mode switches (3D/MPR) the protocol
          //    binds the active volume to its viewports; stored bindings are
          //    typically the same so this is a no-op.
          if (!didMammo) {
            var dss = window.services.displaySetService;
            var allDS = (dss.getActiveDisplaySets && dss.getActiveDisplaySets()) || [];
            var updates = (state.bindings || []).map(function (b) {
              if (!b.seriesRefs || !b.seriesRefs.length) return null;
              var dsUIDs = b.seriesRefs.map(function (ref) {
                for (var i = 0; i < allDS.length; i++) {
                  if (allDS[i].SeriesInstanceUID === ref.seriesUID &&
                      (!ref.sopClass || allDS[i].SOPClassUID === ref.sopClass)) {
                    return allDS[i].displaySetInstanceUID;
                  }
                }
                for (var j = 0; j < allDS.length; j++) {
                  if (allDS[j].SeriesInstanceUID === ref.seriesUID) return allDS[j].displaySetInstanceUID;
                }
                return null;
              }).filter(Boolean);
              return dsUIDs.length ? {
                viewportId: b.viewportId,
                displaySetInstanceUIDs: dsUIDs,
                viewportOptions: b.viewportOptions || undefined,
                displaySetOptions: b.displaySetOptions || undefined,
              } : null;
            }).filter(Boolean);
            if (updates.length && typeof gs.setDisplaySetsForViewports === 'function') {
              try { gs.setDisplaySetsForViewports(updates); }
              catch (e) { console.warn('[LinkRad restore] setDisplaySetsForViewports failed', e); }
            }
          }

          // 5. Per-viewport runtime state — VOI, camera, slice, blend, slab.
          //    For 3D/MPR (didMode) we deliberately SKIP camera + blend/slab:
          //    cornerstone3D's volume viewport mount has a vtk.js race where
          //    setCamera on a partially-mounted viewport triggers shader
          //    errors and leaves orthographic panes all-black. The HP's
          //    default camera renders fine; user can re-tweak post-restore.
          //    We still restore VOI for the volume3d (windowing on the VRT).
          var cs = window.cornerstone;
          var engines = (cs && cs.getRenderingEngines && cs.getRenderingEngines()) || [];
          (state.viewportStates || []).forEach(function (vs) {
            if (!vs.runtime) return;
            for (var i = 0; i < engines.length; i++) {
              var vp;
              try { vp = engines[i].getViewport(vs.viewportId); } catch (e) {}
              if (!vp) continue;
              try {
                if (vs.runtime.voiRange && vp.setProperties) {
                  vp.setProperties({ voiRange: vs.runtime.voiRange, invert: vs.runtime.invert });
                }
                if (vs.runtime.colormap && vp.setProperties) vp.setProperties({ colormap: vs.runtime.colormap });
                if (!didMode) {
                  if (vs.runtime.sliceIndex != null && typeof vp.setImageIdIndex === 'function') vp.setImageIdIndex(vs.runtime.sliceIndex);
                  if (vs.runtime.blendMode != null && typeof vp.setBlendMode === 'function') vp.setBlendMode(vs.runtime.blendMode);
                  if (vs.runtime.slabThickness != null && typeof vp.setSlabThickness === 'function') vp.setSlabThickness(vs.runtime.slabThickness);
                  if (vs.runtime.camera && typeof vp.setCamera === 'function') vp.setCamera(vs.runtime.camera);
                }
                vp.render();
              } catch (e) { console.warn('[LinkRad restore] viewport apply failed', vs.viewportId, e); }
              break;
            }
          });
          resolve();
        }, settleMs);
      });
    });
  }

  function loadStudyInPlace(studyUID, restore) {
    return new Promise(function (resolve, reject) {
      if (!studyUID) return reject(new Error('missing studyUID'));
      var url = new URL(window.location.href);
      if (url.searchParams.get('StudyInstanceUIDs') === studyUID) {
        // Already on this study — skip URL nav, just restore if asked.
        if (restore) return applyRestoreState(restore).then(function () { resolve({ studyUID: studyUID }); }).catch(reject);
        return resolve({ studyUID: studyUID });
      }
      // Belt-and-suspenders: clear OHIF's per-viewport presentation cache
      // BEFORE re-init runs, so VOI / camera / blendMode / slabThickness
      // from the prior study can't get re-applied to viewports of the new
      // study (the same fingerprint as the 2D/MPR/3D bleed). The Playwright
      // spike didn't catch this case directly, but it's cheap insurance.
      try { clearAllPresentations(); } catch (e) {}
      // Mammo edge-stick teardown. applyMammoDisplayConventions installs
      // CAMERA_MODIFIED listeners + a 60fps enforce loop that snaps each
      // viewport's chest wall to the canvas inner edge. OHIF re-uses
      // viewport DOM nodes across study swap, so the listeners survive and
      // keep enforcing chest-wall anchoring on the NEW study's viewports
      // (observed: open Mammo → pick CC → swap back to CT → CT's first
      // viewport stuck to one edge like a Mammo). Tear down before
      // reinit; applyRestoreState re-installs if the snapshot was Mammo.
      try { _teardownMammoEdgeListeners(); } catch (e) {}
      try { document.body.classList.remove('lr-mammo-mode'); } catch (e) {}
      // Clear the layout watchdog's memory. Otherwise it sees the new
      // study's fresh HP layout (e.g. CT's 1×1) as "reverted from the
      // user's last pick" (e.g. Mammo CC) and re-applies the OLD study's
      // hanging protocol to the NEW study. applyRestoreState sets this
      // back when a snapshot is being restored.
      _lastUserLayout = null;
      url.searchParams.set('StudyInstanceUIDs', studyUID);
      window.history.pushState({}, '', url.toString());
      window.dispatchEvent(new PopStateEvent('popstate'));

      _waitForStudyDisplaySets(studyUID).then(function () {
        if (restore) return applyRestoreState(restore);
      }).then(function () { resolve({ studyUID: studyUID }); })
        .catch(reject);
    });
  }

  function purgeStudyVolumes(studyUID) {
    var removed = 0;
    try {
      var cs = window.cornerstone;
      if (!cs || !cs.cache) return removed;
      var cache = cs.cache;
      // Volumes
      var volumes = (cache.getVolumes && cache.getVolumes()) || [];
      volumes.forEach(function (v) {
        if (!v) return;
        var match = false;
        if (v.metadata && v.metadata.StudyInstanceUID === studyUID) match = true;
        else if (v.imageIds && v.imageIds[0] && String(v.imageIds[0]).indexOf(studyUID) !== -1) match = true;
        else if (v.volumeId && String(v.volumeId).indexOf(studyUID) !== -1) match = true;
        if (match) {
          try { cache.removeVolumeLoadObject(v.volumeId); removed++; } catch (e) {}
        }
      });
      // Stack viewport images (best-effort: imageIds carry the study UID for wadors)
      if (cache.getImageLoadObject || cache._imageCache) {
        try {
          var ids = (cache.getImageIds && cache.getImageIds()) || Object.keys(cache._imageCache || {});
          ids.forEach(function (id) {
            if (String(id).indexOf(studyUID) !== -1) {
              try { cache.removeImageLoadObject(id); removed++; } catch (e) {}
            }
          });
        } catch (e) {}
      }
    } catch (e) { console.warn('[LinkRad purge] failed', e); }
    return removed;
  }

  // ============================================================
  // Boot
  // ============================================================
  function boot() {
    injectCSS();
    renderToolbar();
    renderSidebar();
    startMutationObserver();
    watchModality();
    subscribeMammoOverlays();

    // Parent (Teleradiology page) → iframe protocol.
    window.addEventListener('message', function (e) {
      var data = e.data;
      if (!data || data.source !== 'linkrad-parent') return;
      var corr = data.correlationId;
      var reply = function (type, payload) {
        try {
          var msg = { source: 'linkrad-iframe', type: type, correlationId: corr };
          if (payload) Object.keys(payload).forEach(function (k) { msg[k] = payload[k]; });
          (window.parent || window.opener || window).postMessage(msg, '*');
        } catch (err) {}
      };

      if (data.type === 'tab-activated') {
        // Legacy; still useful when an undocked window comes back to focus.
        onParentTabActivated();
        return;
      }
      if (data.type === 'lr:loadStudy') {
        console.log('[LinkRad] lr:loadStudy →', data.studyUID, data.restore ? '(with restore)' : '(fresh HP)');
        loadStudyInPlace(data.studyUID, data.restore)
          .then(function (r) { reply('lr:loadStudy:done', { studyUID: r.studyUID }); })
          .catch(function (err) { reply('lr:loadStudy:error', { studyUID: data.studyUID, error: String(err && err.message || err) }); });
        return;
      }
      if (data.type === 'lr:snapshotState') {
        var state = captureState();
        reply('lr:snapshotState:result', { state: state });
        return;
      }
      if (data.type === 'lr:purgeStudy') {
        var removed = purgeStudyVolumes(data.studyUID);
        console.log('[LinkRad] lr:purgeStudy', data.studyUID, '— removed', removed, 'cache entries');
        reply('lr:purgeStudy:done', { studyUID: data.studyUID, removed: removed });
        return;
      }
    });

    // Emit lr:ready once the first study's displaySets have actually loaded
    // — the parent uses this to gate postMessage operations so we don't race
    // OHIF's initial boot. Fires exactly once per iframe lifetime.
    var _readyEmitted = false;
    function _emitReadyWhenLoaded() {
      if (_readyEmitted) return;
      var dss = window.services && window.services.displaySetService;
      var got = dss && dss.getActiveDisplaySets && dss.getActiveDisplaySets();
      if (got && got.length) {
        _readyEmitted = true;
        try {
          var tgt = window.parent && window.parent !== window ? window.parent : (window.opener || window);
          tgt.postMessage({ source: 'linkrad-iframe', type: 'lr:ready' }, '*');
          console.log('[LinkRad] lr:ready emitted to parent');
        } catch (e) {}
        return;
      }
      setTimeout(_emitReadyWhenLoaded, 200);
    }
    setTimeout(_emitReadyWhenLoaded, 500);

    // Subscribe the layout watchdog as soon as viewportGridService is ready.
    // Polls until it is — usually 1-3 seconds after iframe load.
    var wdAttempts = 0;
    var wdIv = setInterval(function () {
      wdAttempts++;
      var gs = window.services && window.services.viewportGridService;
      if (gs && gs.subscribe && gs.EVENTS) {
        subscribeLayoutWatchdog();
        clearInterval(wdIv);
      } else if (wdAttempts > 60) {
        clearInterval(wdIv);
        console.warn('[LinkRad] layout watchdog: viewportGridService never appeared');
      }
    }, 200);

    // Also poll commandsManager so wiring works once OHIF is ready
    var attempts = 0;
    var iv = setInterval(function () {
      attempts++;
      hookAnnotationEvents();
      if (window.commandsManager || attempts > 100) {
        clearInterval(iv);
        if (window.commandsManager) {
          console.log('[LinkRad toolbar] commandsManager ready, buttons wired');
        }
      }
    }, 200);

    // Test hooks: force modality + introspect overlays/series matching
    window._linkradSetModality = function (m) {
      currentModality = m;
      renderToolbar();
      renderSidebar();
      renderMammoOverlays();
      console.log('[LinkRad toolbar] modality forced →', m);
    };
    window._linkradMammoSeriesMap = findMammoSeriesMap;
    window._linkradRenderMammoOverlays = renderMammoOverlays;
    // Test hook: trigger a Mammo hanging-protocol preset programmatically
    // (same code path as clicking the CC/MLO/etc. button in the sidebar).
    window._linkradSetMammoHanging = setMammoHanging;
    // Test hook: toggle Mammo slice sync from Playwright / devtools.
    window._linkradToggleMammoSliceSync = toggleMammoSliceSync;
    // Test hook: trigger mode tab programmatically (2D / MPR / 3D).
    window._linkradSwitchMode = switchMode;

    // ============================================================
    // SPIKE: in-place study swap (validates URL+popstate path)
    // ============================================================
    // Hypothesis: OHIF v3.8.3's Mode.tsx useEffect depends on `location`
    // + `studyInstanceUIDs`, so pushState({?StudyInstanceUIDs=B}) +
    // dispatching popstate re-runs defaultRouteInit without remounting
    // ViewerLayout. Our injected scripts (toolbar, watchdog, modality
    // detector) should stay alive across the swap.
    //
    // Usage from console (after a study is loaded):
    //   _linkradLoadStudy('1.2.840...newUID')
    // Sampling logs at +0.5s / +1.5s / +3s / +6s tell us whether the
    // displaySetService observed the new study and whether our toolbar
    // element survived (proxy for "React tree not remounted").
    window._linkradLoadStudy = function (newStudyUID) {
      if (!newStudyUID) {
        console.warn('[LinkRad SPIKE] missing studyUID');
        return;
      }
      var snap = function (label) {
        var ds = (window.services && window.services.displaySetService &&
                  window.services.displaySetService.getActiveDisplaySets()) || [];
        var uids = ds.map(function (d) { return d.StudyInstanceUID; })
                     .filter(function (v, i, a) { return a.indexOf(v) === i; });
        var toolbar = document.getElementById('linkrad-toolbar');
        console.log('[LinkRad SPIKE]', label, {
          loc: window.location.search,
          displaySets: ds.length,
          studies: uids.length,
          studyUIDs: uids,
          toolbarAlive: !!toolbar,
          toolbarChildren: toolbar ? toolbar.children.length : 0,
          servicesAlive: !!window.services,
          extMgrAlive: !!window.extensionManager,
          cmdMgrAlive: !!window.commandsManager,
        });
      };
      snap('BEFORE');
      var url = new URL(window.location.href);
      url.searchParams.set('StudyInstanceUIDs', newStudyUID);
      console.log('[LinkRad SPIKE] pushState →', url.pathname + url.search);
      window.history.pushState({}, '', url.toString());
      window.dispatchEvent(new PopStateEvent('popstate'));
      [500, 1500, 3000, 6000].forEach(function (ms) {
        setTimeout(function () { snap('AFTER +' + ms + 'ms'); }, ms);
      });
    };
  }

  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
