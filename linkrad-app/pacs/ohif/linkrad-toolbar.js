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
      dropdown: [
        { label: 'Preset 1 — Não (80/40)',         cmd: 'setWindowLevel', cmdOpts: { window: '80',  level: '40'  } },
        { label: 'Preset 2 — Trung thất (160/80)', cmd: 'setWindowLevel', cmdOpts: { window: '160', level: '80'  } },
        { label: 'Preset 3 — Mô mềm (256/128)',    cmd: 'setWindowLevel', cmdOpts: { window: '256', level: '128' } },
        { label: 'Preset 4 — Bụng (320/160)',      cmd: 'setWindowLevel', cmdOpts: { window: '320', level: '160' } },
        { label: 'Preset 5 — Xương (640/320)',     cmd: 'setWindowLevel', cmdOpts: { window: '640', level: '320' } },
        { divider: true },
        { label: 'Pseudo Color (cycle)',           cmd: 'cyclePseudoColor' },
      ]
    },
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

  function buildButton(item) {
    var b = document.createElement('button');
    b.className = 'lr-btn';
    b.id = 'lr-btn-' + item.id;
    b.dataset.tip = item.tip;
    if (item.dropdown) b.dataset.hasDropdown = '1';
    if (item.style) b.style.cssText = item.style;
    b.innerHTML = svgIcon(item.svg);
    b.onclick = function (ev) {
      ev.stopPropagation();
      if (item.dropdown) openDropdown(b, item.dropdown);
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

  // Standard camera vectors per anatomical view (RAS convention)
  var ORIENTATION_VECTORS = {
    axial:    { viewUp: [0, -1, 0], viewPlaneNormal: [0, 0, -1] },
    coronal:  { viewUp: [0, 0, -1], viewPlaneNormal: [0, 1, 0] },
    sagittal: { viewUp: [0, 0, -1], viewPlaneNormal: [1, 0, 0] },
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
  function removeBed()                { console.log('[LinkRad sidebar] Remove couch TODO — HU threshold + bottom-region connected-component'); }
  function resetTissue()              { console.log('[LinkRad sidebar] Reset tissue → restore full volume opacity'); }

  // ---- Mammo-specific ----
  // Maps each Hanging Protocol preset to a layout config.
  // Series-to-viewport matching (which series goes where) is TODO — needs
  // DICOM tag (ViewPosition / ImageLaterality / TOMO detection) inspection.
  var MAMMO_HANGING = {
    cc:        { rows: 1, cols: 1, label: 'CC' },
    mlo:       { rows: 1, cols: 1, label: 'MLO' },
    ccmlo4:    { rows: 1, cols: 4, label: 'RCC | LCC | RMLO | LMLO' },
    rccmlo:    { rows: 1, cols: 2, label: 'R CC + MLO' },
    lccmlo:    { rows: 1, cols: 2, label: 'L CC + MLO' },
    tomocc:    { rows: 1, cols: 1, label: 'TOMO CC',     tomo: true },
    tomomlo:   { rows: 1, cols: 1, label: 'TOMO MLO',    tomo: true },
    tomo4up:   { rows: 1, cols: 4, label: 'TOMO 4-up',   tomo: true },
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

  function setMammoHanging(arg) {
    var cfg = MAMMO_HANGING[arg];
    if (!cfg) { console.warn('[LinkRad sidebar] unknown mammo hanging:', arg); return; }
    if (cfg.tomo) {
      var tomoOk = hasTomoSeries();
      if (tomoOk === false) {
        // Smart detection: warn instead of silently showing black viewports (legacy did this)
        alert('Ca chụp này không có chuỗi TOMO — chọn Hanging Protocol thường.');
        console.warn('[LinkRad sidebar] TOMO requested but no TOMO series detected');
        return;
      }
    }
    try {
      window.commandsManager.run({
        commandName: 'setViewportGridLayout',
        commandOptions: { numRows: cfg.rows, numCols: cfg.cols },
        context: 'DEFAULT',
      });
      console.log('[LinkRad sidebar] Mammo hanging →', arg, '(', cfg.label, ')');
      // After layout settles, populate viewports with matched series
      setTimeout(function () { populateMammoViewports(arg); }, 350);
    } catch (e) { console.warn('[LinkRad sidebar] mammo hanging failed', e); }
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
        if (!view || !lat) return;
        var isTomo = (ds.SOPClassUID === '1.2.840.10008.5.1.4.1.1.13.1.3') ||
                     /TOMO|DBT/.test((ds.SeriesDescription || '').toUpperCase());
        var isProc = (inst.PresentationIntentType || '').toUpperCase() === 'FOR PRESENTATION';
        var key = lat + view + (isTomo ? '_TOMO' : '');
        if (!map[key]) {
          map[key] = ds.displaySetInstanceUID;
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
    slots.forEach(function (slot, i) {
      var dsUID = map[slot];
      if (dsUID && vpIds[i]) {
        updates.push({ viewportId: vpIds[i], displaySetInstanceUIDs: [dsUID] });
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
    setMagnifyLevel: function (level) { setMagnifyLevel(level); },
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
        items: [
          { label: 'P1', tip: '80/40 — Não',         cmd: 'setWindowLevel', cmdOpts: { window: '80',  level: '40'  } },
          { label: 'P2', tip: '160/80 — Trung thất', cmd: 'setWindowLevel', cmdOpts: { window: '160', level: '80'  } },
          { label: 'P3', tip: '256/128 — Mô mềm',    cmd: 'setWindowLevel', cmdOpts: { window: '256', level: '128' } },
          { label: 'P4', tip: '320/160 — Bụng',      cmd: 'setWindowLevel', cmdOpts: { window: '320', level: '160' } },
          { label: 'P5', tip: '640/320 — Xương',     cmd: 'setWindowLevel', cmdOpts: { window: '640', level: '320' } },
          { label: 'PC', tip: 'Pseudo color cycle',  cmd: 'cyclePseudoColor' },
        ],
        hint: 'Phím tắt: 2–6',
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
          { label: 'Đồng bộ Zoom/Pan',      cmd: 'toggleSynchronizer', cmdOpts: { type: 'zoomPan' } },
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
          { label: 'Đồng bộ Zoom/Pan',      cmd: 'toggleSynchronizer', cmdOpts: { type: 'zoomPan' } },
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
          { label: 'Đồng bộ Zoom/Pan',      cmd: 'toggleSynchronizer', cmdOpts: { type: 'zoomPan' } },
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
          { label: 'CC + MLO',    tip: 'CC + MLO 2-up', fn: 'setMammoHanging', arg: 'ccmlo4' },
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
        title: 'Magnify (vi vôi hóa)',
        type: 'pills',
        cols: 3,
        items: [
          { label: '1.5×', tip: 'Loupe 1.5x', fn: 'setMagnifyLevel', arg: 1.5 },
          { label: '2×',   tip: 'Loupe 2x',   fn: 'setMagnifyLevel', arg: 2 },
          { label: '4×',   tip: 'Loupe 4x',   fn: 'setMagnifyLevel', arg: 4 },
        ],
        hint: 'Zoom 1:1 pixel mặc định cho mammo screening',
      },
      {
        title: 'DBT Cine (cuộn TOMO slice)',
        type: 'cine',
      },
      {
        title: 'Compression / Paddle / kVp / mAs Overlay',
        type: 'placeholder',
        message: 'Hiển thị overlay: Force (N), Paddle, Body Part Thickness (mm), kVp, mAs từ DICOM tag (0018,11A0/11A2/11A4/0060/1152). Đang phát triển.',
        tag: 'V1 LINKRAD',
      },
      {
        title: 'BI-RADS (báo cáo có cấu trúc)',
        type: 'placeholder',
        message: 'Form BI-RADS: Density A/B/C/D, Assessment 0–6, structured findings (mass / calcifications / asymmetry / architectural distortion). Tạo SR document.',
        tag: 'V1 LINKRAD',
      },
      {
        title: 'Đồng bộ ca chụp cũ (prior comparison)',
        type: 'checks',
        items: [
          { label: 'Khóa view với prior',     cmd: 'toggleSynchronizer', cmdOpts: { type: 'imageSlice' } },
          { label: 'Đồng bộ W/L',             cmd: 'toggleSynchronizer', cmdOpts: { type: 'voi' } },
          { label: 'Đồng bộ Zoom/Pan',        cmd: 'toggleSynchronizer', cmdOpts: { type: 'zoomPan' } },
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

  function buildLayoutRow(items) {
    var row = document.createElement('div');
    row.className = 'lr-layout-row';
    items.forEach(function (it) {
      var b = document.createElement('button');
      b.className = 'lr-layout-btn';
      b.title = it.tip || (it.rows + 'x' + it.cols);
      b.innerHTML = layoutGlyph(it.rows, it.cols);
      b.onclick = function () {
        markActiveSibling(b);
        try {
          window.commandsManager.run({
            commandName: 'setViewportGridLayout',
            commandOptions: { numRows: it.rows, numCols: it.cols },
            context: 'DEFAULT',
          });
        } catch (e) { console.warn('[LinkRad sidebar] setViewportGridLayout failed', e); }
      };
      row.appendChild(b);
    });
    // Default-active: 1x1
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
      input.onchange = function () { runItem(it); };
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

  function buildSection(sec) {
    var wrap = document.createElement('div');
    wrap.className = 'lr-sec';
    var t = document.createElement('div');
    t.className = 'lr-sec-title';
    t.textContent = sec.title;
    wrap.appendChild(t);
    var body;
    if (sec.type === 'pills')        body = buildPills(sec.items, sec.cols);
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
  // Mode switching (visual only for now — wiring comes in iter 2)
  // ============================================================
  // Maps our mode tabs to OHIF v3.8 hanging-protocol IDs.
  // Discovered via Playwright dump of hangingProtocolService.protocols Map.
  var MODE_TO_PROTOCOL = {
    '2d':  'default',  // 1x1 grid
    'mpr': 'mpr',      // 3 viewports horizontal (axial / sagittal / coronal)
    '3d':  'main3D',   // 1 big 3D + 3 small MPR stacked (matches legacy 3D layout)
  };

  function switchMode(mode) {
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
  // Boot
  // ============================================================
  function boot() {
    injectCSS();
    renderToolbar();
    renderSidebar();
    startMutationObserver();
    watchModality();
    subscribeMammoOverlays();

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
  }

  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
