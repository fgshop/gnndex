"use client";

import { useEffect, useRef } from "react";

/* ── Config ── */
const STAR_COUNT = 260;
const MILKY_WAY_STAR_COUNT = 400;
const SHOOTING_INTERVAL_MS = 3200;
const EARTH_ROTATION_SPEED = 0.0004;
const AXIAL_TILT = 0.41; // ~23.5° tilted right
const INITIAL_ROTATION = -127 * Math.PI / 180; // Seoul (127°E) faces viewer at start

/* ── Types ── */
interface Star { x: number; y: number; r: number; a: number; sp: number; off: number; hue: number }
interface MWStar { angle: number; offset: number; r: number; a: number; off: number }
interface Shoot {
  x: number; y: number; vx: number; vy: number; r: number; hue: number;
  alpha: number; trail: { x: number; y: number; a: number }[]; life: number; maxLife: number;
}
interface City {
  lat: number; lng: number; r: number; bright: number; sp: number; off: number; cont: number;
}
interface NetLine { from: number; to: number; off: number; sp: number }

/* ── Continent colors ── */
const CC_DARK: Record<number, [number, number, number]> = {
  0: [45, 95, 75],  1: [30, 90, 70],  2: [35, 85, 72],  3: [200, 80, 75],
  4: [25, 80, 65],  5: [170, 70, 70],  6: [55, 80, 68],  7: [280, 65, 72],
};
const CC_LIGHT: Record<number, [number, number, number]> = {
  0: [217, 80, 45],  1: [217, 70, 50],  2: [262, 60, 50],  3: [217, 85, 40],
  4: [262, 55, 45],  5: [200, 70, 42],  6: [200, 60, 48],  7: [262, 65, 48],
};

/* ── 3D sphere projection with axial tilt ── */
function project(
  lat: number, lng: number, rot: number, tilt: number,
  cx: number, cy: number, R: number,
) {
  // Spherical → Cartesian
  const cosLat = Math.cos(lat), sinLat = Math.sin(lat);
  const x0 = cosLat * Math.sin(lng);
  const y0 = sinLat;
  const z0 = cosLat * Math.cos(lng);
  // Rotate around Y-axis (Earth spin)
  const cosR = Math.cos(rot), sinR = Math.sin(rot);
  const x1 = x0 * cosR + z0 * sinR;
  const y1 = y0;
  const z1 = -x0 * sinR + z0 * cosR;
  // Tilt around Z-axis (axial tilt to the right)
  const cosT = Math.cos(tilt), sinT = Math.sin(tilt);
  const x2 = x1 * cosT - y1 * sinT;
  const y2 = x1 * sinT + y1 * cosT;
  const z2 = z1;
  return { x: cx + x2 * R, y: cy - y2 * R, vis: z2 > 0.05, d: z2 };
}

/* ── Continent coastlines in degrees [lat°, lng°] — traced from real geography ── */
const R = Math.PI / 180; // degree → radian
function deg(pts: [number, number][]): [number, number][] {
  return pts.map(([la, lo]) => [la * R, lo * R]);
}

const CONTINENT_PATHS: { pts: [number, number][]; fill: number }[] = [
  // ── Africa ──
  { fill: 45, pts: deg([
    [35, -5], [37, 10], [33, 12], [31, 32], [27, 34], [22, 37],
    [15, 42], [12, 44], [11, 50], [2, 46], [-2, 41], [-7, 40],
    [-11, 40], [-16, 36], [-24, 35], [-28, 33], [-34, 26], [-35, 18],
    [-33, 18], [-30, 17], [-22, 14], [-17, 12], [-12, 14], [-6, 12],
    [-5, 9], [0, 10], [4, 2], [5, -4], [4, -7], [7, -13],
    [10, -15], [15, -17], [21, -17], [26, -15], [31, -10], [34, -2],
    [36, -5],
  ]) },
  // ── Europe ──
  { fill: 148, pts: deg([
    [36, -9], [37, -2], [43, -9], [43, -2], [46, -2], [48, -5],
    [51, 2], [53, 5], [54, 9], [55, 8], [57, 6], [58, 5],
    [62, 5], [64, 11], [67, 15], [70, 20], [71, 28], [70, 30],
    [67, 40], [62, 40], [56, 38], [50, 40], [47, 42], [45, 37],
    [42, 29], [41, 29], [39, 26], [38, 24], [36, 28], [35, 24],
    [38, 20], [40, 18], [44, 12], [44, 8], [43, 6], [42, 3],
    [39, 0], [37, -2], [36, -6],
  ]) },
  // ── Asia ──
  { fill: 142, pts: deg([
    [42, 29], [45, 37], [47, 42], [50, 40], [56, 38], [62, 40],
    [67, 40], [70, 60], [73, 80], [72, 100], [70, 130], [68, 140],
    [65, 142], [60, 143], [55, 135], [50, 140], [46, 143], [43, 146],
    [40, 142], [35, 139], [35, 132], [38, 127], [38, 122], [34, 126],
    [31, 121], [28, 120], [23, 114], [22, 108], [20, 107], [16, 108],
    [12, 105], [8, 104], [2, 104], [1, 103], [7, 80], [10, 77],
    [15, 73], [21, 72], [23, 70], [25, 67], [25, 62], [30, 48],
    [33, 44], [37, 36], [39, 30], [41, 29],
  ]) },
  // ── North America ──
  { fill: 140, pts: deg([
    [70, -165], [72, -155], [71, -140], [69, -135], [60, -140],
    [58, -136], [55, -130], [50, -127], [48, -124], [42, -124],
    [38, -122], [34, -119], [32, -117], [28, -112], [25, -110],
    [20, -105], [18, -96], [16, -88], [18, -88], [20, -87],
    [22, -86], [25, -80], [26, -80], [30, -82], [30, -84],
    [25, -82], [26, -77], [30, -81], [32, -79], [35, -75],
    [39, -74], [41, -71], [43, -70], [45, -67], [47, -61],
    [47, -53], [50, -56], [52, -56], [55, -60], [58, -62],
    [60, -64], [62, -72], [65, -80], [68, -95], [70, -100],
    [72, -120], [71, -156], [70, -162],
  ]) },
  // ── South America ──
  { fill: 130, pts: deg([
    [12, -72], [10, -62], [8, -60], [5, -52], [2, -50],
    [-2, -44], [-5, -35], [-8, -35], [-13, -38], [-18, -40],
    [-23, -42], [-28, -48], [-32, -52], [-35, -57], [-41, -63],
    [-46, -67], [-50, -70], [-52, -70], [-55, -68], [-55, -64],
    [-52, -68], [-50, -66], [-46, -65], [-42, -62], [-38, -58],
    [-35, -56], [-30, -50], [-22, -40], [-16, -40], [-10, -37],
    [-5, -35], [-3, -40], [0, -50], [3, -60], [5, -67],
    [7, -70], [10, -72], [12, -76], [10, -78], [5, -77],
    [2, -75], [0, -70], [-2, -80], [-5, -81], [-7, -80],
    [-6, -77], [-2, -75], [0, -70], [3, -68], [7, -72], [12, -72],
  ]) },
  // ── Australia ──
  { fill: 35, pts: deg([
    [-12, 131], [-13, 136], [-17, 141], [-16, 146], [-19, 146],
    [-24, 149], [-28, 153], [-33, 152], [-37, 150], [-39, 146],
    [-38, 141], [-35, 137], [-34, 136], [-32, 132], [-33, 127],
    [-34, 122], [-34, 116], [-31, 115], [-25, 113], [-22, 114],
    [-20, 119], [-15, 129], [-13, 131],
  ]) },
  // ── Greenland ──
  { fill: 160, pts: deg([
    [76, -18], [78, -20], [80, -25], [82, -30], [83, -40],
    [82, -48], [80, -55], [78, -60], [76, -65], [72, -55],
    [70, -50], [68, -45], [66, -40], [65, -38], [68, -30],
    [72, -22], [75, -18],
  ]) },
  // ── Japan / Korean Peninsula ──
  { fill: 142, pts: deg([
    [33, 130], [34, 131], [35, 133], [35, 136], [37, 137],
    [39, 140], [41, 140], [43, 145], [45, 142], [43, 141],
    [40, 140], [37, 137], [35, 132], [33, 130],
  ]) },
  // ── UK + Ireland ──
  { fill: 148, pts: deg([
    [50, -5], [51, 1], [53, 0], [55, -2], [57, -5],
    [58, -3], [57, -2], [55, -1], [53, 1], [51, 1],
    [50, -2], [50, -5],
  ]) },
  // ── Indonesia / Malay ──
  { fill: 35, pts: deg([
    [5, 96], [2, 99], [-1, 104], [-3, 108], [-6, 106],
    [-8, 110], [-8, 114], [-7, 116], [-4, 115], [-2, 111],
    [-1, 107], [1, 104], [4, 98], [5, 96],
  ]) },
  // ── Madagascar ──
  { fill: 45, pts: deg([
    [-12, 49], [-16, 50], [-19, 48], [-22, 47], [-25, 47],
    [-24, 44], [-21, 44], [-17, 44], [-14, 48], [-12, 49],
  ]) },
  // ── New Zealand ──
  { fill: 35, pts: deg([
    [-35, 174], [-37, 175], [-39, 177], [-41, 175], [-43, 172],
    [-45, 170], [-47, 167], [-46, 168], [-44, 170], [-42, 172],
    [-39, 176], [-37, 176], [-35, 174],
  ]) },
];

function isDark() { return document.documentElement.classList.contains("dark"); }

export function CosmicBackground({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const c = cvs.getContext("2d");
    if (!c) return;

    let W = 0, H = 0, dk = isDark();

    function resize() {
      const dpr = devicePixelRatio || 1;
      W = cvs!.offsetWidth; H = cvs!.offsetHeight;
      cvs!.width = W * dpr; cvs!.height = H * dpr;
      c!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    addEventListener("resize", resize);
    const obs = new MutationObserver(() => { dk = isDark(); });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    /* ── Stars ── */
    const stars: Star[] = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random(), y: Math.random(), r: Math.random() * 1.3 + 0.3,
      a: Math.random() * 0.5 + 0.25, sp: Math.random() * 0.002 + 0.001,
      off: Math.random() * Math.PI * 2, hue: Math.random() < 0.15 ? 40 : Math.random() < 0.3 ? 200 : 220,
    }));

    /* ── Milky Way ── */
    const mw: MWStar[] = Array.from({ length: MILKY_WAY_STAR_COUNT }, () => ({
      angle: Math.random() * Math.PI,
      offset: ((Math.random() + Math.random() + Math.random()) / 3 - 0.5) * 0.18,
      r: Math.random() * 1.0 + 0.2, a: Math.random() * 0.35 + 0.08,
      off: Math.random() * Math.PI * 2,
    }));

    /* ── Cities ── */
    const cityDefs: [number, number, number][] = [
      [0.62,2.42,0],[0.55,2.22,0],[0.54,2.0,0],[0.43,2.12,0],[0.39,1.99,0],[0.02,1.81,0],
      [0.33,1.35,1],[0.49,1.35,1],
      [0.44,0.96,2],
      [0.9,0.0,3],[0.85,0.04,3],[0.91,0.23,3],[0.73,-0.06,3],[0.83,0.22,3],[0.99,0.44,3],
      [0.53,0.57,4],[-0.48,0.49,4],[0.11,0.06,4],
      [0.71,-1.3,5],[0.73,-1.53,5],[0.59,-2.07,5],[0.56,-1.72,5],[0.79,-1.31,5],
      [-0.4,-0.76,6],[-0.6,-1.22,6],[0.08,-1.3,6],
      [-0.59,2.65,7],[-0.64,3.05,7],
    ];
    const cities: City[] = cityDefs.map(([lat, lng, cont]) => ({
      lat, lng, cont, r: Math.random() * 1.4 + 1.0,
      bright: Math.random() * 0.2 + 0.8, sp: Math.random() * 0.008 + 0.006,
      off: Math.random() * Math.PI * 2,
    }));

    /* ── Network ── */
    const nets: NetLine[] = [];
    const pairs = new Set<string>();
    // Ensure continental + intercontinental links
    const interLinks: [number, number][] = [
      [1, 9], [0, 18], [9, 18], [5, 6], [3, 15], [18, 23], [11, 26], [14, 8],
    ];
    for (const [a, b] of interLinks) {
      const k = `${Math.min(a, b)}-${Math.max(a, b)}`;
      if (!pairs.has(k)) {
        pairs.add(k);
        nets.push({ from: a, to: b, off: Math.random() * Math.PI * 2, sp: Math.random() * 0.015 + 0.012 });
      }
    }
    while (nets.length < 22) {
      const a = Math.floor(Math.random() * cities.length);
      const b = Math.floor(Math.random() * cities.length);
      const k = `${Math.min(a, b)}-${Math.max(a, b)}`;
      if (a !== b && !pairs.has(k)) {
        pairs.add(k);
        nets.push({ from: a, to: b, off: Math.random() * Math.PI * 2, sp: Math.random() * 0.015 + 0.012 });
      }
    }

    /* ── Shooting stars ── */
    const shoots: Shoot[] = [];
    let lastSp = 0;
    function spawn(now: number) {
      const left = Math.random() < 0.5;
      const sx = left ? Math.random() * W * 0.3 - W * 0.05 : W * 0.75 + Math.random() * W * 0.3;
      const sy = H + 20 + Math.random() * 40;
      const ang = left ? -Math.PI / 4 + (Math.random() - 0.5) * 0.4 : -Math.PI * 3 / 4 + (Math.random() - 0.5) * 0.4;
      const sp = Math.random() * 2.0 + 1.5;
      const rr = Math.random();
      shoots.push({
        x: sx, y: sy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        r: Math.random() * 2.5 + 1.5, hue: rr < 0.35 ? 217 : rr < 0.65 ? 262 : 43,
        alpha: 1, trail: [], life: 0, maxLife: Math.random() * 200 + 180,
      });
      lastSp = now;
    }

    /* ═══════════════════════════════════════════
       DRAW EARTH (shared core, themed rendering)
       ═══════════════════════════════════════════ */

    function drawEarth(f: number) {
      const R = Math.min(W, H) * 0.32;
      const cx = W * 0.5, cy = H * 0.72;
      const rot = INITIAL_ROTATION + f * EARTH_ROTATION_SPEED;
      const tilt = AXIAL_TILT;

      /* ── Atmospheric glow (dark only) ── */
      if (dk) {
        const gR = R * 1.5;
        const gl = c!.createRadialGradient(cx, cy, R * 0.8, cx, cy, gR);
        gl.addColorStop(0, "hsla(205,85%,55%,0.15)");
        gl.addColorStop(0.35, "hsla(200,75%,50%,0.07)");
        gl.addColorStop(0.7, "hsla(210,60%,45%,0.02)");
        gl.addColorStop(1, "transparent");
        c!.fillStyle = gl; c!.fillRect(0, 0, W, H);
      }

      c!.save();
      c!.beginPath(); c!.arc(cx, cy, R, 0, Math.PI * 2); c!.clip();

      if (dk) {
        /* ── Dark: filled ocean ── */
        const og = c!.createRadialGradient(cx - R * 0.2, cy - R * 0.3, 0, cx, cy, R);
        og.addColorStop(0, "hsl(205,60%,26%)"); og.addColorStop(0.35, "hsl(210,55%,16%)");
        og.addColorStop(0.7, "hsl(215,50%,9%)"); og.addColorStop(1, "hsl(220,45%,4%)");
        c!.fillStyle = og; c!.fill();
      } else {
        /* ── Light: subtle tinted fill ── */
        const lf = c!.createRadialGradient(cx - R * 0.2, cy - R * 0.3, 0, cx, cy, R);
        lf.addColorStop(0, "hsla(210,40%,92%,0.35)");
        lf.addColorStop(0.5, "hsla(215,35%,88%,0.2)");
        lf.addColorStop(1, "hsla(220,30%,85%,0.08)");
        c!.fillStyle = lf; c!.fill();
      }

      /* ── Grid lines (latitude) ── */
      for (let lat = -60; lat <= 60; lat += 30) {
        const lr = (lat / 180) * Math.PI;
        c!.beginPath();
        for (let lng = 0; lng <= Math.PI * 2; lng += 0.06) {
          const p = project(lr, lng, rot, tilt, cx, cy, R);
          if (!p.vis) continue;
          if (lng === 0) c!.moveTo(p.x, p.y); else c!.lineTo(p.x, p.y);
        }
        c!.strokeStyle = dk ? "hsla(200,30%,40%,0.05)" : "hsla(217,35%,65%,0.07)";
        c!.lineWidth = 0.4; c!.stroke();
      }

      /* ── Grid lines (longitude) ── */
      for (let lngDeg = 0; lngDeg < 360; lngDeg += 30) {
        const lng = (lngDeg / 180) * Math.PI;
        c!.beginPath();
        let started = false;
        for (let latDeg = -90; latDeg <= 90; latDeg += 3) {
          const lr = (latDeg / 180) * Math.PI;
          const p = project(lr, lng, rot, tilt, cx, cy, R);
          if (!p.vis) { started = false; continue; }
          if (!started) { c!.moveTo(p.x, p.y); started = true; } else c!.lineTo(p.x, p.y);
        }
        c!.strokeStyle = dk ? "hsla(200,30%,40%,0.04)" : "hsla(217,35%,65%,0.06)";
        c!.lineWidth = 0.4; c!.stroke();
      }

      /* ── Continent shapes ── */
      for (const cont of CONTINENT_PATHS) {
        // Filled shape
        c!.beginPath();
        let anyVis = false;
        for (let i = 0; i < cont.pts.length; i++) {
          const p = project(cont.pts[i][0], cont.pts[i][1], rot, tilt, cx, cy, R);
          if (!p.vis) continue;
          anyVis = true;
          if (i === 0 || !anyVis) c!.moveTo(p.x, p.y); else c!.lineTo(p.x, p.y);
        }
        if (!anyVis) continue;
        c!.closePath();

        if (dk) {
          c!.fillStyle = `hsla(${cont.fill},20%,16%,0.25)`;
          c!.fill();
          c!.strokeStyle = `hsla(${cont.fill},25%,35%,0.3)`;
          c!.lineWidth = 0.8; c!.stroke();
        } else {
          c!.fillStyle = `hsla(217,25%,80%,0.08)`;
          c!.fill();
          c!.setLineDash([4, 3]);
          c!.strokeStyle = `hsla(217,40%,55%,0.25)`;
          c!.lineWidth = 0.9; c!.stroke();
          c!.setLineDash([]);
        }
      }

      /* ── Clouds (dark only) ── */
      if (dk) {
        for (const cl of [
          [0.6, 0.3, 0.25, 0.035], [0.2, 1.5, 0.2, 0.03], [-0.1, -0.8, 0.22, 0.04],
          [0.8, -1.0, 0.15, 0.025], [-0.4, 2.0, 0.18, 0.03],
        ] as [number, number, number, number][]) {
          const p = project(cl[0], cl[1], rot, tilt, cx, cy, R);
          if (!p.vis) continue;
          const sc = 0.5 + p.d * 0.5;
          c!.save(); c!.globalAlpha = 0.08 * p.d;
          c!.fillStyle = "hsl(210,30%,85%)"; c!.beginPath();
          c!.ellipse(p.x, p.y, cl[2] * R * sc, cl[3] * R * sc, rot * 0.3, 0, Math.PI * 2);
          c!.fill(); c!.restore();
        }
      }

      /* ── City lights ── */
      const proj: { x: number; y: number; vis: boolean; d: number }[] = [];
      for (let i = 0; i < cities.length; i++) {
        const ct = cities[i];
        const p = project(ct.lat, ct.lng, rot, tilt, cx, cy, R * 0.96);
        proj.push(p);
        if (!p.vis) continue;

        const col = dk ? (CC_DARK[ct.cont] ?? [45, 90, 75]) : (CC_LIGHT[ct.cont] ?? [217, 70, 45]);
        const raw = Math.sin(f * ct.sp + ct.off);
        const flash = raw > 0.3 ? 1.0 : raw > -0.1 ? (raw + 0.1) / 0.4 : 0.12;
        const alpha = ct.bright * flash * p.d;
        if (alpha < 0.03) continue;

        if (dk) {
          // Glow halo
          const gr = ct.r * 7 * (0.5 + p.d * 0.5);
          const gl = c!.createRadialGradient(p.x, p.y, 0, p.x, p.y, gr);
          gl.addColorStop(0, `hsla(${col[0]},${col[1]}%,${col[2]}%,${alpha * 0.6})`);
          gl.addColorStop(0.35, `hsla(${col[0]},${col[1] - 10}%,${col[2] - 10}%,${alpha * 0.15})`);
          gl.addColorStop(1, "transparent");
          c!.fillStyle = gl; c!.beginPath(); c!.arc(p.x, p.y, gr, 0, Math.PI * 2); c!.fill();
          // Core
          const dr = ct.r * (0.5 + p.d * 0.7);
          c!.beginPath(); c!.arc(p.x, p.y, dr, 0, Math.PI * 2);
          c!.fillStyle = `hsla(${col[0]},${col[1]}%,${Math.min(95, col[2] + 15)}%,${Math.min(1, alpha * 1.4)})`;
          c!.fill();
        } else {
          // Outer ring
          const dr = ct.r * (0.6 + p.d * 0.4);
          c!.beginPath(); c!.arc(p.x, p.y, dr * 3, 0, Math.PI * 2);
          c!.strokeStyle = `hsla(${col[0]},${col[1]}%,${col[2]}%,${alpha * 0.4})`;
          c!.lineWidth = 0.5; c!.stroke();
          // Core
          c!.beginPath(); c!.arc(p.x, p.y, dr, 0, Math.PI * 2);
          c!.fillStyle = `hsla(${col[0]},${col[1]}%,${col[2]}%,${Math.min(1, alpha * 0.9)})`;
          c!.fill();
        }
      }

      /* ── Network lines with traveling light ── */
      for (const nl of nets) {
        const a = proj[nl.from], b = proj[nl.to];
        if (!a.vis || !b.vis) continue;
        const minD = Math.min(a.d, b.d);
        if (minD < 0.12) continue;

        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const dist = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
        const toC = Math.atan2(cy - my, cx - mx);
        // Arc bulges outward from sphere center
        const bulge = dist * 0.2;
        const ctX = mx - Math.cos(toC) * bulge, ctY = my - Math.sin(toC) * bulge;

        const pulse = (Math.sin(f * nl.sp + nl.off) + 1) * 0.5;
        const baseA = minD * (0.3 + pulse * 0.5);

        if (dk) {
          // Line
          c!.beginPath(); c!.moveTo(a.x, a.y); c!.quadraticCurveTo(ctX, ctY, b.x, b.y);
          c!.strokeStyle = `hsla(200,75%,65%,${baseA * 0.18})`; c!.lineWidth = 0.7; c!.stroke();

          // Multiple traveling pulses for a "data flow" feel
          for (let pi = 0; pi < 3; pi++) {
            const t = ((f * 0.006 + nl.off + pi * 0.33) % 1);
            const px = (1 - t) ** 2 * a.x + 2 * (1 - t) * t * ctX + t * t * b.x;
            const py = (1 - t) ** 2 * a.y + 2 * (1 - t) * t * ctY + t * t * b.y;
            const pAlpha = baseA * 0.7 * (1 - Math.abs(t - 0.5) * 1.2);
            if (pAlpha < 0.01) continue;
            // Glow around pulse
            const pgr = 4 + pulse * 2;
            const pg = c!.createRadialGradient(px, py, 0, px, py, pgr);
            pg.addColorStop(0, `hsla(200,90%,80%,${Math.min(1, pAlpha * 1.2)})`);
            pg.addColorStop(0.5, `hsla(200,80%,65%,${pAlpha * 0.3})`);
            pg.addColorStop(1, "transparent");
            c!.fillStyle = pg; c!.beginPath(); c!.arc(px, py, pgr, 0, Math.PI * 2); c!.fill();
            // Core dot
            c!.beginPath(); c!.arc(px, py, 1.5, 0, Math.PI * 2);
            c!.fillStyle = `hsla(200,95%,90%,${Math.min(1, pAlpha * 1.5)})`; c!.fill();
          }
        } else {
          // Light mode — dashed line
          c!.setLineDash([3, 3]);
          c!.beginPath(); c!.moveTo(a.x, a.y); c!.quadraticCurveTo(ctX, ctY, b.x, b.y);
          c!.strokeStyle = `hsla(217,60%,55%,${baseA * 0.25})`; c!.lineWidth = 0.8; c!.stroke();
          c!.setLineDash([]);

          // Traveling dots
          for (let pi = 0; pi < 2; pi++) {
            const t = ((f * 0.005 + nl.off + pi * 0.5) % 1);
            const px = (1 - t) ** 2 * a.x + 2 * (1 - t) * t * ctX + t * t * b.x;
            const py = (1 - t) ** 2 * a.y + 2 * (1 - t) * t * ctY + t * t * b.y;
            const pA = baseA * 0.6 * (1 - Math.abs(t - 0.5) * 1.2);
            if (pA < 0.02) continue;
            c!.beginPath(); c!.arc(px, py, 2, 0, Math.PI * 2);
            c!.fillStyle = `hsla(217,80%,50%,${Math.min(1, pA * 1.5)})`; c!.fill();
          }
        }
      }

      /* ── Atmosphere rim ── */
      if (dk) {
        const rim = c!.createRadialGradient(cx, cy, R * 0.88, cx, cy, R);
        rim.addColorStop(0, "transparent");
        rim.addColorStop(0.4, "hsla(200,90%,60%,0.04)");
        rim.addColorStop(0.7, "hsla(200,90%,65%,0.12)");
        rim.addColorStop(1, "hsla(200,85%,70%,0.25)");
        c!.fillStyle = rim; c!.beginPath(); c!.arc(cx, cy, R, 0, Math.PI * 2); c!.fill();
      }

      c!.restore();

      /* ── Outer ring (light mode) ── */
      if (!dk) {
        c!.beginPath(); c!.arc(cx, cy, R, 0, Math.PI * 2);
        c!.strokeStyle = "hsla(217,40%,60%,0.18)"; c!.lineWidth = 0.9; c!.stroke();
      }

      /* ── Tilted axis indicator ── */
      if (dk) {
        const axLen = R * 1.12;
        const npx = cx + Math.sin(tilt) * axLen, npy = cy - Math.cos(tilt) * axLen;
        const spx = cx - Math.sin(tilt) * axLen, spy = cy + Math.cos(tilt) * axLen;
        c!.setLineDash([2, 4]);
        c!.beginPath(); c!.moveTo(spx, spy); c!.lineTo(npx, npy);
        c!.strokeStyle = "hsla(200,60%,60%,0.08)"; c!.lineWidth = 0.5; c!.stroke();
        c!.setLineDash([]);
      }
    }

    /* ═══════════════════════════════════════════
       MILKY WAY (dark only)
       ═══════════════════════════════════════════ */
    function drawMW(f: number) {
      const x0 = -W * 0.1, y0 = H * 1.05, x1 = W * 1.1, y1 = -H * 0.05;
      const dx = x1 - x0, dy = y1 - y0, len = Math.sqrt(dx * dx + dy * dy);
      const nx = -dy / len, ny = dx / len, bw = Math.min(W, H) * 0.22;
      for (let i = 0; i < 5; i++) {
        const t = (i + 0.5) / 5;
        const g = c!.createRadialGradient(x0 + dx * t, y0 + dy * t, 0, x0 + dx * t, y0 + dy * t, bw);
        g.addColorStop(0, "hsla(220,40%,70%,0.035)"); g.addColorStop(0.5, "hsla(230,35%,55%,0.015)"); g.addColorStop(1, "transparent");
        c!.fillStyle = g; c!.fillRect(0, 0, W, H);
      }
      for (const s of mw) {
        const t = s.angle / Math.PI;
        const bx = x0 + dx * t + nx * s.offset * len, by = y0 + dy * t + ny * s.offset * len;
        if (bx < -10 || bx > W + 10 || by < -10 || by > H + 10) continue;
        const al = Math.max(0.03, s.a + Math.sin(f * 0.0015 + s.off) * 0.15);
        c!.beginPath(); c!.arc(bx, by, s.r, 0, Math.PI * 2);
        c!.fillStyle = `hsla(225,25%,90%,${al})`; c!.fill();
      }
    }

    /* ═══════════════════════════════════════════
       SHOOTING STARS
       ═══════════════════════════════════════════ */
    function drawShoots(f: number, now: number) {
      if (now - lastSp > SHOOTING_INTERVAL_MS || shoots.length === 0) spawn(now);
      for (let i = shoots.length - 1; i >= 0; i--) {
        const s = shoots[i]; s.life++;
        if (s.life < 20) s.alpha = s.life / 20;
        else if (s.life > s.maxLife - 40) s.alpha = Math.max(0, (s.maxLife - s.life) / 40);
        else s.alpha = 1;
        s.trail.push({ x: s.x, y: s.y, a: s.alpha });
        if (s.trail.length > 40) s.trail.shift();
        s.x += s.vx; s.y += s.vy;

        if (dk) {
          for (let t = 0; t < s.trail.length; t++) {
            const tp = s.trail[t];
            const ta = (t / s.trail.length) * 0.45 * tp.a;
            if (ta < 0.01) continue;
            c!.beginPath(); c!.arc(tp.x, tp.y, s.r * (t / s.trail.length) * 0.7, 0, Math.PI * 2);
            c!.fillStyle = `hsla(${s.hue},80%,70%,${ta})`; c!.fill();
          }
          const gr = s.r * 7;
          const hg = c!.createRadialGradient(s.x, s.y, 0, s.x, s.y, gr);
          hg.addColorStop(0, `hsla(${s.hue},90%,85%,${0.35 * s.alpha})`);
          hg.addColorStop(0.3, `hsla(${s.hue},80%,65%,${0.1 * s.alpha})`);
          hg.addColorStop(1, "transparent");
          c!.fillStyle = hg; c!.beginPath(); c!.arc(s.x, s.y, gr, 0, Math.PI * 2); c!.fill();
          c!.beginPath(); c!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          c!.fillStyle = `hsla(${s.hue},90%,92%,${s.alpha})`; c!.fill();
        } else {
          // Light mode — stroke trail
          if (s.trail.length > 1) {
            c!.beginPath(); c!.moveTo(s.trail[0].x, s.trail[0].y);
            for (let t = 1; t < s.trail.length; t++) c!.lineTo(s.trail[t].x, s.trail[t].y);
            const lh = s.hue === 43 ? 262 : s.hue;
            c!.strokeStyle = `hsla(${lh},60%,55%,${0.25 * s.alpha})`; c!.lineWidth = 1; c!.stroke();
          }
          const lh = s.hue === 43 ? 262 : s.hue;
          c!.beginPath(); c!.arc(s.x, s.y, s.r * 0.8, 0, Math.PI * 2);
          c!.fillStyle = `hsla(${lh},70%,50%,${s.alpha * 0.7})`; c!.fill();
          c!.beginPath(); c!.arc(s.x, s.y, s.r * 2, 0, Math.PI * 2);
          c!.strokeStyle = `hsla(${lh},60%,55%,${s.alpha * 0.3})`; c!.lineWidth = 0.6; c!.stroke();
        }
        if (s.life >= s.maxLife || s.y < -60 || s.x < -60 || s.x > W + 60) shoots.splice(i, 1);
      }
    }

    /* ═══════════════════════════════════════════
       MAIN LOOP
       ═══════════════════════════════════════════ */
    let frame = 0;
    function draw(now: number) {
      c!.clearRect(0, 0, W, H);
      frame++;

      if (dk) {
        // Nebulae
        for (const [nx, ny, nr, h, s, l, a] of [
          [0.15, 0.1, 0.55, 217, 80, 50, 0.09],
          [0.85, 0.25, 0.45, 262, 75, 50, 0.07],
          [0.5, 0.6, 0.35, 200, 70, 45, 0.04],
        ] as [number, number, number, number, number, number, number][]) {
          const g = c!.createRadialGradient(W * nx, H * ny, 0, W * nx, H * ny, W * nr);
          g.addColorStop(0, `hsla(${h},${s}%,${l}%,${a})`);
          g.addColorStop(0.5, `hsla(${h},${s - 10}%,${l - 10}%,${a * 0.4})`);
          g.addColorStop(1, "transparent");
          c!.fillStyle = g; c!.fillRect(0, 0, W, H);
        }
        drawMW(frame);
        // Stars
        for (const s of stars) {
          const al = s.a + Math.sin(frame * s.sp + s.off) * 0.25;
          c!.beginPath(); c!.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
          c!.fillStyle = `hsla(${s.hue},20%,95%,${Math.max(0.03, al)})`; c!.fill();
        }
      } else {
        // Light mode subtle dots
        for (const s of stars) {
          const al = s.a * 0.25 + Math.sin(frame * s.sp + s.off) * 0.08;
          if (al < 0.04) continue;
          c!.beginPath(); c!.arc(s.x * W, s.y * H, 0.6, 0, Math.PI * 2);
          c!.fillStyle = `hsla(217,40%,60%,${al})`; c!.fill();
        }
      }

      drawEarth(frame);
      drawShoots(frame, now);
      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animRef.current); removeEventListener("resize", resize); obs.disconnect(); };
  }, []);

  return <canvas ref={canvasRef} className={className} style={{ width: "100%", height: "100%" }} />;
}
