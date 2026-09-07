export type Joint = {
  name: string;
  angle: number; // degrees
  min: number;
  max: number;
  axis: "yaw" | "pitch";
};

export type ArmConfig = {
  dof: number;
  baseHeight: number;
  links: number[]; // length of each link after the base yaw joint (dof - 1 entries)
  joints: Joint[];
};

export const DEG = Math.PI / 180;

const LINK_DEFAULTS: Record<number, number[]> = {
  3: [1.6, 1.3],
  4: [1.5, 1.2, 0.8],
  6: [1.4, 1.1, 0.8, 0.5, 0.35],
};

export function createArm(dof: number): ArmConfig {
  const links = [...(LINK_DEFAULTS[dof] ?? LINK_DEFAULTS[4]!)];
  const joints: Joint[] = [
    { name: "θ1 Base", angle: 0, min: -180, max: 180, axis: "yaw" },
  ];
  const startAngles = [60, -70, -20, -15, -10];
  for (let i = 0; i < links.length; i++) {
    joints.push({
      name: `θ${i + 2} ${i === 0 ? "Shoulder" : i === 1 ? "Elbow" : "Wrist " + (i - 1)}`,
      angle: startAngles[i] ?? 0,
      min: i === 0 ? -10 : -150,
      max: i === 0 ? 150 : 150,
      axis: "pitch",
    });
  }
  return { dof, baseHeight: 0.55, links, joints };
}

export type FKResult = {
  x: number;
  y: number;
  z: number;
  roll: number;
  pitch: number;
  yaw: number;
  reach: number; // planar radius
};

/** Forward kinematics: base yaw + planar pitch chain. */
export function forwardKinematics(arm: ArmConfig): FKResult {
  const yawDeg = arm.joints[0]!.angle;
  let acc = 0;
  let r = 0;
  let y = arm.baseHeight;
  for (let i = 0; i < arm.links.length; i++) {
    acc += arm.joints[i + 1]!.angle;
    r += arm.links[i]! * Math.cos(acc * DEG);
    y += arm.links[i]! * Math.sin(acc * DEG);
  }
  const yaw = yawDeg * DEG;
  return {
    x: r * Math.cos(yaw),
    y,
    z: -r * Math.sin(yaw),
    roll: 0,
    pitch: acc,
    yaw: yawDeg,
    reach: r,
  };
}

export function totalReach(arm: ArmConfig) {
  return arm.links.reduce((a, b) => a + b, 0);
}

export function isOutOfReach(arm: ArmConfig, t: { x: number; y: number; z: number }) {
  const d = Math.hypot(Math.hypot(t.x, t.z), t.y - arm.baseHeight);
  return d > totalReach(arm) + 1e-6;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Cyclic Coordinate Descent IK. Base yaw solved analytically, planar chain by CCD.
 * Returns new joint angles (degrees), respecting per-joint limits.
 */
export function solveIK(
  arm: ArmConfig,
  target: { x: number; y: number; z: number },
  maxIterations = 20,
  threshold = 0.01,
): { angles: number[]; error: number; iterations: number } {
  const angles = arm.joints.map((j) => j.angle);
  const yawDeg = Math.atan2(-target.z, target.x) / DEG;
  angles[0] = clamp(yawDeg, arm.joints[0]!.min, arm.joints[0]!.max);

  const tr = Math.hypot(target.x, target.z);
  const ty = target.y;
  const n = arm.links.length;

  const points = () => {
    const pts: [number, number][] = [[0, arm.baseHeight]];
    let acc = 0;
    let r = 0;
    let y = arm.baseHeight;
    for (let i = 0; i < n; i++) {
      acc += angles[i + 1]!;
      r += arm.links[i]! * Math.cos(acc * DEG);
      y += arm.links[i]! * Math.sin(acc * DEG);
      pts.push([r, y]);
    }
    return pts;
  };

  let iterations = 0;
  let error = Infinity;
  for (let it = 0; it < maxIterations; it++) {
    iterations = it + 1;
    for (let i = n - 1; i >= 0; i--) {
      const pts = points();
      const [jr, jy] = pts[i]!;
      const [er, ey] = pts[n]!;
      const a = Math.atan2(ey - jy, er - jr);
      const b = Math.atan2(ty - jy, tr - jr);
      let delta = (b - a) / DEG;
      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;
      const j = arm.joints[i + 1]!;
      angles[i + 1] = clamp(angles[i + 1]! + delta, j.min, j.max);
    }
    const pts = points();
    error = Math.hypot(pts[n]![0] - tr, pts[n]![1] - ty);
    if (error < threshold) break;
  }
  return { angles, error, iterations };
}

export type PresetName = "Zero Position" | "Home Position" | "Pick & Place Reach" | "Folded / Stowed";

export const PRESETS: PresetName[] = [
  "Zero Position",
  "Home Position",
  "Pick & Place Reach",
  "Folded / Stowed",
];

export function presetAngles(arm: ArmConfig, name: PresetName): number[] {
  const n = arm.joints.length;
  const out = new Array(n).fill(0);
  const clampJ = (i: number, v: number) => clamp(v, arm.joints[i]!.min, arm.joints[i]!.max);
  switch (name) {
    case "Zero Position":
      return out.map((_, i) => clampJ(i, 0));
    case "Home Position":
      return out.map((_, i) => clampJ(i, i === 0 ? 0 : i === 1 ? 70 : i === 2 ? -110 : -20));
    case "Pick & Place Reach":
      return out.map((_, i) => clampJ(i, i === 0 ? 35 : i === 1 ? 25 : i === 2 ? -45 : -25));
    case "Folded / Stowed":
      return out.map((_, i) => clampJ(i, i === 0 ? 0 : i === 1 ? 120 : -140));
  }
}
