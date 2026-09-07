import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArmViewport } from "@/components/ArmViewport";
import {
  createArm,
  forwardKinematics,
  isOutOfReach,
  PRESETS,
  presetAngles,
  solveIK,
  totalReach,
  type ArmConfig,
  type PresetName,
} from "@/lib/kinematics";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Robotic Arm Kinematics Dashboard | FK & IK Simulator" },
      {
        name: "description",
        content:
          "Interactive 3D robotic arm dashboard with forward kinematics, CCD inverse kinematics solving, joint limits, 3-6 DOF configuration and live end-effector telemetry.",
      },
      { property: "og:title", content: "Robotic Arm Kinematics Dashboard" },
      {
        property: "og:description",
        content: "Simulate a 3-6 DOF industrial arm in 3D with live FK/IK solving and draggable targets.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const f = (n: number) => (Math.round(n * 1000) / 1000).toFixed(3);

function Dashboard() {
  const [arm, setArm] = useState<ArmConfig>(() => createArm(4));
  const [angles, setAngles] = useState<number[]>(() => createArm(4).joints.map((j) => j.angle));
  const [mode, setMode] = useState<"fk" | "ik">("fk");
  const [target, setTarget] = useState({ x: 1.8, y: 1.4, z: 0.6 });
  const [animate, setAnimate] = useState(true);
  const [showTrail, setShowTrail] = useState(true);
  const [solverInfo, setSolverInfo] = useState({ error: 0, iterations: 0 });

  const goal = useRef<number[] | null>(null);
  const rafRef = useRef(0);

  const armWithAngles = useMemo<ArmConfig>(
    () => ({ ...arm, joints: arm.joints.map((j, i) => ({ ...j, angle: angles[i] ?? 0 })) }),
    [arm, angles],
  );
  const fk = useMemo(() => forwardKinematics(armWithAngles), [armWithAngles]);
  const outOfReach = isOutOfReach(arm, target);

  // smooth interpolation toward solver goal
  useEffect(() => {
    const step = () => {
      rafRef.current = requestAnimationFrame(step);
      const g = goal.current;
      if (!g) return;
      setAngles((cur) => {
        let done = true;
        const next = cur.map((a, i) => {
          const d = (g[i] ?? a) - a;
          if (Math.abs(d) > 0.05) done = false;
          return a + d * 0.18;
        });
        if (done) {
          goal.current = null;
          return g.slice();
        }
        return next;
      });
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const runSolver = useCallback(
    (t: { x: number; y: number; z: number }, cur: number[]) => {
      const res = solveIK({ ...arm, joints: arm.joints.map((j, i) => ({ ...j, angle: cur[i] ?? 0 })) }, t);
      setSolverInfo({ error: res.error, iterations: res.iterations });
      if (animate) goal.current = res.angles;
      else {
        goal.current = null;
        setAngles(res.angles);
      }
    },
    [arm, animate],
  );

  // solve whenever target / mode / config changes in IK mode
  useEffect(() => {
    if (mode !== "ik") return;
    runSolver(target, angles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, target.x, target.y, target.z, arm, animate]);

  const setAngle = (i: number, v: number) => {
    goal.current = null;
    setAngles((a) => a.map((x, k) => (k === i ? v : x)));
  };

  const changeDof = (dof: number) => {
    const next = createArm(dof);
    setArm(next);
    goal.current = null;
    setAngles(next.joints.map((j) => j.angle));
    setMode("fk");
  };

  const setLink = (i: number, v: number) =>
    setArm((a) => ({ ...a, links: a.links.map((l, k) => (k === i ? v : l)) }));

  const applyPreset = (p: PresetName) => {
    const a = presetAngles(arm, p);
    setMode("fk");
    if (animate) goal.current = a;
    else setAngles(a);
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground lg:flex-row">
      <aside className="panel flex w-full shrink-0 flex-col gap-4 overflow-y-auto p-5 lg:w-[380px]">
        <header>
          <p className="label">Kinematics Control Unit</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Robotic Arm Dashboard</h1>
        </header>

        <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1">
          {(["fk", "ik"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                mode === m ? "bg-accent text-accent-ink shadow-glow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "fk" ? "Forward (FK)" : "Inverse (IK)"}
            </button>
          ))}
        </div>

        {mode === "fk" ? (
          <section className="card space-y-4">
            <p className="label">Joint Angles</p>
            {arm.joints.map((j, i) => (
              <div key={j.name} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">{j.name}</span>
                  <input
                    type="number"
                    value={Math.round((angles[i] ?? 0) * 10) / 10}
                    min={j.min}
                    max={j.max}
                    onChange={(e) => setAngle(i, Number(e.target.value))}
                    className="num w-20"
                  />
                </div>
                <input
                  type="range"
                  min={j.min}
                  max={j.max}
                  step={0.5}
                  value={angles[i] ?? 0}
                  onChange={(e) => setAngle(i, Number(e.target.value))}
                  className="slider"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground/70">
                  <span>{j.min}°</span>
                  <span>{j.max}°</span>
                </div>
              </div>
            ))}
          </section>
        ) : (
          <section className="card space-y-4">
            <div className="flex items-center justify-between">
              <p className="label">Target Position</p>
              {outOfReach ? <span className="badge-warn">Out of Reach</span> : <span className="badge-ok">In Envelope</span>}
            </div>
            {(["x", "y", "z"] as const).map((axis) => (
              <div key={axis} className="flex items-center gap-2">
                <span className="w-14 text-xs font-medium text-muted-foreground">Target {axis.toUpperCase()}</span>
                <button className="stepper" onClick={() => setTarget((t) => ({ ...t, [axis]: +(t[axis] - 0.1).toFixed(2) }))}>
                  −
                </button>
                <input
                  type="number"
                  step={0.1}
                  value={target[axis]}
                  onChange={(e) => setTarget((t) => ({ ...t, [axis]: Number(e.target.value) }))}
                  className="num flex-1"
                />
                <button className="stepper" onClick={() => setTarget((t) => ({ ...t, [axis]: +(t[axis] + 0.1).toFixed(2) }))}>
                  +
                </button>
              </div>
            ))}
            <label className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2 text-xs">
              <span className="font-medium">Solve &amp; Animate</span>
              <input type="checkbox" checked={animate} onChange={(e) => setAnimate(e.target.checked)} className="toggle" />
            </label>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="readout">
                <span>Solver Error</span>
                <b>{f(solverInfo.error)}</b>
              </div>
              <div className="readout">
                <span>Iterations</span>
                <b>{solverInfo.iterations}</b>
              </div>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Drag the glowing marker in the viewport with the 3D gizmo to move the target live.
            </p>
          </section>
        )}

        <section className="card space-y-3">
          <p className="label">Arm Configuration</p>
          <div className="flex items-center gap-2">
            <span className="w-14 text-xs text-muted-foreground">DOF</span>
            <select value={arm.dof} onChange={(e) => changeDof(Number(e.target.value))} className="num flex-1">
              <option value={3}>3-DOF</option>
              <option value={4}>4-DOF</option>
              <option value={6}>6-DOF</option>
            </select>
          </div>
          {arm.links.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-14 text-xs text-muted-foreground">L{i + 1}</span>
              <input
                type="range"
                min={0.2}
                max={2.5}
                step={0.05}
                value={l}
                onChange={(e) => setLink(i, Number(e.target.value))}
                className="slider flex-1"
              />
              <input
                type="number"
                step={0.05}
                value={l}
                onChange={(e) => setLink(i, Number(e.target.value))}
                className="num w-20"
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2 pt-1">
            {PRESETS.map((p) => (
              <button key={p} onClick={() => applyPreset(p)} className="preset">
                {p}
              </button>
            ))}
          </div>
          <label className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2 text-xs">
            <span className="font-medium">End-effector trail</span>
            <input type="checkbox" checked={showTrail} onChange={(e) => setShowTrail(e.target.checked)} className="toggle" />
          </label>
        </section>
      </aside>

      <main className="relative min-h-[55vh] flex-1">
        <ArmViewport
          arm={arm}
          angles={angles}
          mode={mode}
          target={target}
          showTrail={showTrail}
          onTargetDrag={setTarget}
        />

        <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap gap-2">
          <span className="chip">{arm.dof}-DOF chain</span>
          <span className="chip">Max reach {f(totalReach(arm))}</span>
          <span className="chip">{mode === "fk" ? "FK mode" : "IK · CCD solver"}</span>
          {mode === "ik" && outOfReach && <span className="badge-warn">Out of Reach</span>}
        </div>

        <div className="panel absolute bottom-4 left-4 right-4 grid grid-cols-3 gap-3 rounded-xl p-4 sm:grid-cols-6">
          {[
            ["X", fk.x],
            ["Y", fk.y],
            ["Z", fk.z],
            ["Roll", fk.roll],
            ["Pitch", fk.pitch],
            ["Yaw", fk.yaw],
          ].map(([k, v]) => (
            <div key={k as string} className="readout">
              <span>
                {k}
                {(k as string).length > 1 ? " °" : ""}
              </span>
              <b>{f(v as number)}</b>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
