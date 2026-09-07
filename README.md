# RoboArm Studio

Build a comprehensive, production-grade 3D Robotic Arm Kinematics Dashboard as a self-contained web app using HTML5, modern CSS (Tailwind or clean dark-themed dashboard CSS), and Three.js (via CDN with OrbitControls and TransformControls).

### 1. Architectural & Kinematic Requirements
- **Configurable Degrees of Freedom (DOF):** Support 3 to 6 DOF chains dynamically (default to 4-DOF or 6-DOF industrial configuration).
- **Forward Kinematics (FK):**
  - Compute link matrices from base to end-effector sequentially based on joint angles.
  - Dynamically display the resulting End-Effector Cartesian coordinates (X, Y, Z) and orientation (Roll, Pitch, Yaw).
- **Inverse Kinematics (IK):**
  - Implement a fast numerical IK solver (Cyclic Coordinate Descent [CCD] or FABRIK algorithm) to compute joint angles given target (X, Y, Z).
  - Respect angle min/max limits for every joint during solver iterations.
  - Include an iteration cap (e.g., 20 iterations max per tick) with a distance threshold (< 0.01 units) to prevent solver locking or jitter.
  - Provide an "Out of Reach" visual indicator/badge if target Cartesian coordinates exceed the arm's total link length.

### 2. 3D Visualization (Three.js)
- **Scene Setup:** Dark industrial viewport background, ground grid helper (`GridHelper`), coordinate axis helper (`AxesHelper`), and smooth orbit navigation (`OrbitControls`).
- **Robot Model Rendering:**
  - Base pedestal, cylindrical joint pivots, tapered link segments, and a visible claw/end-effector tool tip.
  - Color accents: Industrial orange/yellow for linkages, matte dark grey for rotating collars/joints, and vibrant cyan/green for target markers.
- **Visual Feedback:**
  - An interactive 3D target sphere for IK mode, equipped with `TransformControls` (draggable 3D translation gizmo) so the user can drag the target directly in 3D space.
  - Optional trail/trajectory line rendering the path traced by the end-effector.

### 3. User Controls & Dashboard UI
Split the layout into a responsive sidebar control panel and a full 3D viewport:
- **Mode Toggle:** Seamless switch between "Forward Kinematics (FK)" and "Inverse Kinematics (IK)".
- **FK Control Tab:**
  - Sliders + numeric input fields for each Joint Angle ($\theta_1, \theta_2, \dots, \theta_n$) with configurable min/max limits (e.g., -180° to +180°).
  - Live End-Effector Readout: Real-time X, Y, Z, Roll, Pitch, Yaw display.
- **IK Control Tab:**
  - Target coordinate inputs: Target X, Target Y, Target Z (number inputs + quick increment buttons).
  - "Solve & Animate" toggle: Smoothly interpolate joint angles from current state to the solved target state.
- **Arm Configuration Drawer:**
  - Dropdown to select DOF (3-DOF, 4-DOF, 6-DOF).
  - Inputs to adjust individual link lengths ($L_1, L_2, \dots, L_n$).
  - Presets: "Zero Position", "Home Position", "Pick & Place Reach", "Folded/Stowed".

### 4. Code Structure & Dependencies
- Use modular, self-contained single-page code (or vanilla JS / React / Vite setup supported by AI Studio).
- Load Three.js, OrbitControls, and TransformControls via standard ES module CDNs (`https://cdn.jsdelivr.net/npm/three@...`).
- Provide clean animation loops (`requestAnimationFrame`) with zero memory leaks and resize observers for the 3D canvas.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://arm-atlas.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d4fb3c99-1f11-45cf-b567-52fb163a37c0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
