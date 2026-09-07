import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { DEG, type ArmConfig } from "@/lib/kinematics";

type Props = {
  arm: ArmConfig;
  angles: number[];
  mode: "fk" | "ik";
  target: { x: number; y: number; z: number };
  showTrail: boolean;
  onTargetDrag: (t: { x: number; y: number; z: number }) => void;
  onDraggingChange?: (dragging: boolean) => void;
};

const COL_LINK = 0xf0951e;
const COL_LINK_DARK = 0xc46a12;
const COL_COLLAR = 0x2f3338;
const COL_BASE = 0x24282d;
const COL_TARGET = 0x22e3b3;

export function ArmViewport(props: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;

  // stable refs into the scene graph
  const api = useRef<{
    pivots: THREE.Object3D[];
    yaw: THREE.Object3D | null;
    tip: THREE.Object3D | null;
    targetMesh: THREE.Mesh | null;
    trail: THREE.Line | null;
    trailPts: THREE.Vector3[];
    rebuild: ((arm: ArmConfig) => void) | null;
  }>({ pivots: [], yaw: null, tip: null, targetMesh: null, trail: null, trailPts: [], rebuild: null });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0f13);
    scene.fog = new THREE.Fog(0x0c0f13, 12, 32);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    camera.position.set(4.5, 3.6, 5.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 1, 0);
    controls.maxPolarAngle = Math.PI * 0.495;

    // lights
    scene.add(new THREE.HemisphereLight(0x9fc4ff, 0x1a1d21, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(5, 8, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 30;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x4fd6ff, 0.6);
    rim.position.set(-6, 3, -5);
    scene.add(rim);

    // floor + helpers
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(9, 64),
      new THREE.MeshStandardMaterial({ color: 0x14181d, roughness: 0.95, metalness: 0.05 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const grid = new THREE.GridHelper(18, 36, 0x2a3138, 0x1a1f25);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.75;
    scene.add(grid);
    scene.add(new THREE.AxesHelper(1.4));

    const robotRoot = new THREE.Group();
    scene.add(robotRoot);

    const disposables: Array<THREE.BufferGeometry | THREE.Material> = [];
    const matLink = new THREE.MeshStandardMaterial({ color: COL_LINK, roughness: 0.45, metalness: 0.35 });
    const matLinkDark = new THREE.MeshStandardMaterial({ color: COL_LINK_DARK, roughness: 0.5, metalness: 0.4 });
    const matCollar = new THREE.MeshStandardMaterial({ color: COL_COLLAR, roughness: 0.6, metalness: 0.7 });
    const matBase = new THREE.MeshStandardMaterial({ color: COL_BASE, roughness: 0.7, metalness: 0.6 });
    disposables.push(matLink, matLinkDark, matCollar, matBase);

    function clearRobot() {
      robotRoot.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
      robotRoot.clear();
      api.current.pivots = [];
    }

    function buildRobot(arm: ArmConfig) {
      clearRobot();
      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.78, 0.22, 40), matBase);
      pedestal.position.y = 0.11;
      pedestal.castShadow = pedestal.receiveShadow = true;
      robotRoot.add(pedestal);

      const yaw = new THREE.Group();
      robotRoot.add(yaw);
      api.current.yaw = yaw;

      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.44, arm.baseHeight, 32), matCollar);
      column.position.y = arm.baseHeight / 2 + 0.1;
      column.castShadow = true;
      yaw.add(column);

      let parent: THREE.Object3D = yaw;
      let firstOffsetY = arm.baseHeight;
      for (let i = 0; i < arm.links.length; i++) {
        const pivot = new THREE.Group();
        pivot.position.set(i === 0 ? 0 : arm.links[i - 1], i === 0 ? firstOffsetY : 0, 0);
        parent.add(pivot);
        api.current.pivots.push(pivot);

        const rTop = 0.17 - i * 0.017;
        const rBot = 0.22 - i * 0.02;
        const collar = new THREE.Mesh(
          new THREE.CylinderGeometry(Math.max(rBot, 0.07), Math.max(rBot, 0.07), Math.max(rBot * 1.9, 0.14), 28),
          matCollar,
        );
        collar.rotation.x = Math.PI / 2;
        collar.castShadow = true;
        pivot.add(collar);

        const L = arm.links[i];
        const seg = new THREE.Mesh(
          new THREE.CylinderGeometry(Math.max(rTop, 0.055), Math.max(rBot, 0.07), L, 24, 1),
          i % 2 === 0 ? matLink : matLinkDark,
        );
        seg.rotation.z = -Math.PI / 2;
        seg.position.x = L / 2;
        seg.castShadow = true;
        pivot.add(seg);

        parent = pivot;
      }

      // end effector / claw
      const tip = new THREE.Group();
      tip.position.set(arm.links[arm.links.length - 1], 0, 0);
      parent.add(tip);
      api.current.tip = tip;

      const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.13, 20), matCollar);
      wrist.rotation.z = Math.PI / 2;
      tip.add(wrist);
      for (const s of [-1, 1]) {
        const finger = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.045, 0.05), matLink);
        finger.position.set(0.14, 0, s * 0.07);
        finger.rotation.y = s * -0.22;
        finger.castShadow = true;
        tip.add(finger);
      }
    }
    api.current.rebuild = buildRobot;
    buildRobot(latest.current.arm);

    // IK target
    const targetMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 24, 18),
      new THREE.MeshStandardMaterial({ color: COL_TARGET, emissive: COL_TARGET, emissiveIntensity: 0.6, roughness: 0.3 }),
    );
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 20, 16),
      new THREE.MeshBasicMaterial({ color: COL_TARGET, transparent: true, opacity: 0.14 }),
    );
    targetMesh.add(halo);
    scene.add(targetMesh);
    api.current.targetMesh = targetMesh;

    const gizmo = new TransformControls(camera, renderer.domElement);
    gizmo.setSize(0.85);
    gizmo.attach(targetMesh);
    const helper = gizmo.getHelper ? gizmo.getHelper() : (gizmo as unknown as THREE.Object3D);
    scene.add(helper);
    const onDragChange = (e: { value: boolean }) => {
      controls.enabled = !e.value;
      latest.current.onDraggingChange?.(e.value);
    };
    const onObjChange = () => {
      const p = targetMesh.position;
      latest.current.onTargetDrag({ x: p.x, y: Math.max(p.y, 0.05), z: p.z });
    };
    gizmo.addEventListener("dragging-changed", onDragChange as never);
    gizmo.addEventListener("objectChange", onObjChange);

    // trail
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(600 * 3), 3));
    const trail = new THREE.Line(
      trailGeo,
      new THREE.LineBasicMaterial({ color: 0x6ef7ff, transparent: true, opacity: 0.8 }),
    );
    trail.frustumCulled = false;
    scene.add(trail);
    api.current.trail = trail;
    disposables.push(trailGeo, trail.material as THREE.Material);

    // resize
    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const worldTip = new THREE.Vector3();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const p = latest.current;
      const yawObj = api.current.yaw;
      if (yawObj) yawObj.rotation.y = (p.angles[0] ?? 0) * DEG;
      api.current.pivots.forEach((pv, i) => {
        pv.rotation.z = (p.angles[i + 1] ?? 0) * DEG;
      });

      const showGizmo = p.mode === "ik";
      targetMesh.visible = showGizmo;
      helper.visible = showGizmo;
      gizmo.enabled = showGizmo;
      if (!gizmo.dragging) targetMesh.position.set(p.target.x, p.target.y, p.target.z);

      if (api.current.tip) {
        api.current.tip.getWorldPosition(worldTip);
        const pts = api.current.trailPts;
        if (p.showTrail) {
          if (!pts.length || pts[pts.length - 1].distanceTo(worldTip) > 0.02) {
            pts.push(worldTip.clone());
            if (pts.length > 600) pts.shift();
          }
        } else if (pts.length) pts.length = 0;
        const attr = trailGeo.getAttribute("position") as THREE.BufferAttribute;
        for (let i = 0; i < pts.length; i++) attr.setXYZ(i, pts[i].x, pts[i].y, pts[i].z);
        attr.needsUpdate = true;
        trailGeo.setDrawRange(0, pts.length);
        trail.visible = p.showTrail && pts.length > 1;
      }

      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      gizmo.removeEventListener("dragging-changed", onDragChange as never);
      gizmo.removeEventListener("objectChange", onObjChange);
      gizmo.detach();
      gizmo.dispose();
      controls.dispose();
      clearRobot();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  // rebuild the chain when DOF or link lengths change
  useEffect(() => {
    api.current.rebuild?.(props.arm);
    api.current.trailPts.length = 0;
  }, [props.arm.dof, props.arm.links.join(","), props.arm.baseHeight]);

  return <div ref={mountRef} className="absolute inset-0" />;
}
