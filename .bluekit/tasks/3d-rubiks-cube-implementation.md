# 3D Rubik's Cube Logo Implementation Plan

## Overview
Implement a 3D interactive Rubik's Cube to replace the static logo on the Welcome Screen. The cube will be procedurally generated, balanced on a corner, and styled with the application's theme colors.

## Visual Design
- **Orientation**: Balanced on a corner vertex (conceptually similar to an isometric view or standing on a point).
- **Colors**: Utilize the BlueKit theme palette while maintaining distinct faces for the "cube" aesthetic.
    - **Face 1 (Front/Right)**: `primary.500` (#4287f5) - The core brand color.
    - **Face 2 (Top)**: `cyan.400` or `blue.300` - A lighter, complementary blue.
    - **Face 3 (Left)**: `purple.500` or `indigo.500` - A cool accent color.
    - **Remaining Faces**: A mix of `white`, `gray.800` (for contrast), and potentially a vibrant `teal` or `pink` for a modern tech feel, rather than primary red/yellow/green.
- **Material**: 'Shiny' plastic look with slight rounding on edges (bevel).

## Technical Implementation

### 1. Dependencies
We need to add the standard React Three Fiber stack:
```bash
npm install three @types/three @react-three/fiber @react-three/drei
```

### 2. Component Structure: `src/components/RubiksCube.tsx`
We will create a self-contained component that renders the 3D scene.

#### The `Cubelet` (Sub-cube)
A single function component taking position and material props.
- Geometry: `RoundedBoxGeometry` from `@react-three/drei` for better aesthetics than standard boxes.
- Mesh: Standard mesh with the calculated position.

#### The `RubiksCube` (Main Assembly)
- **Grid Generation**: A nested loop (x, y, z from -1 to 1) to generate 27 positions.
- **Group Rotation**: The entire group of 27 cubes will be rotated to achieve the "balanced on corner" look. 
    - Approximate rotation: `Rotation X: ~35deg`, `Rotation Y: 45deg`.
- **Animation**: `useFrame` hook to slowly rotate the entire mechanism on the Y-axis.
- **Interactivity**: Mouse tilt effect using `state.mouse` from R3F.

### 3. Integration in `src/components/WelcomeScreen.tsx`
- Replace the existing `BlueKitLogo` import and usage.
- Wrap the new `RubiksCube` in a `Canvas` (or include the Canvas in the component).
- Ensure the container `Box` has defined dimensions (e.g., `h="200px"`, `w="200px"`) to prevent layout shift.

## Plan Checklist
- [ ] Install dependencies
- [ ] Create `RubiksCube` component
- [ ] Implement layout and procedural generation
- [ ] Apply theme materials
- [ ] Add corner-balance rotation and animation
- [ ] Swap into Welcome Screen
- [ ] Verify performance and aesthetics
