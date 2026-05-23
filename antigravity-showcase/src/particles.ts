import * as THREE from 'three';

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let particles: THREE.Points;
let animationId: number;
let mouse = { x: 0, y: 0 };
let targetMouse = { x: 0, y: 0 };

const PARTICLE_COUNT = window.innerWidth < 768 ? 300 : window.innerWidth < 1440 ? 800 : 1500;
const COLORS = [
  new THREE.Color('#4f46e5'),
  new THREE.Color('#7c3aed'),
  new THREE.Color('#2563eb'),
  new THREE.Color('#06b6d4'),
  new THREE.Color('#ec4899'),
];

export function initParticles(canvas: HTMLCanvasElement): void {
  // Scene setup
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050505, 0.0015);

  // Camera
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
  );
  camera.position.z = 500;

  // Renderer
  renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x050505, 1);

  // Create particles
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const sizes = new Float32Array(PARTICLE_COUNT);
  const velocities: { x: number; y: number; z: number }[] = [];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;

    // Position - spread in a sphere-like distribution
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const radius = 200 + Math.random() * 800;

    positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = radius * Math.cos(phi);

    // Color
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;

    // Size
    sizes[i] = Math.random() * 3 + 1;

    // Velocity for floating animation
    velocities.push({
      x: (Math.random() - 0.5) * 0.2,
      y: (Math.random() - 0.5) * 0.2,
      z: (Math.random() - 0.5) * 0.1,
    });
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  // Shader material for glowing particles
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      pixelRatio: { value: renderer.getPixelRatio() },
    },
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      varying vec3 vColor;
      uniform float time;
      uniform float pixelRatio;

      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * pixelRatio * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;

      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
        alpha *= 0.8;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  particles = new THREE.Points(geometry, material);
  scene.add(particles);

  // Mouse interaction
  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
  if (!isTouchDevice) {
    document.addEventListener('mousemove', onMouseMove);
  }

  // Resize handler
  window.addEventListener('resize', onResize);

  // Start animation
  animate();

  function onMouseMove(event: MouseEvent): void {
    targetMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    targetMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }

  function onResize(): void {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function animate(): void {
    animationId = requestAnimationFrame(animate);

    const time = performance.now() * 0.001;
    const positionsArray = geometry.attributes.position.array as Float32Array;

    // Smooth mouse following
    mouse.x += (targetMouse.x - mouse.x) * 0.05;
    mouse.y += (targetMouse.y - mouse.y) * 0.05;

    // Update particle positions
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;

      // Apply velocity
      positionsArray[i3] += velocities[i].x;
      positionsArray[i3 + 1] += velocities[i].y;
      positionsArray[i3 + 2] += velocities[i].z;

      // Mouse interaction - gentle repulsion
      if (!isTouchDevice) {
        const dx = positionsArray[i3] - mouse.x * 300;
        const dy = positionsArray[i3 + 1] - mouse.y * 300;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          const force = (150 - dist) / 150 * 0.5;
          positionsArray[i3] += dx / dist * force;
          positionsArray[i3 + 1] += dy / dist * force;
        }
      }

      // Boundary wrapping
      const bound = 800;
      if (Math.abs(positionsArray[i3]) > bound) velocities[i].x *= -1;
      if (Math.abs(positionsArray[i3 + 1]) > bound) velocities[i].y *= -1;
      if (Math.abs(positionsArray[i3 + 2]) > bound) velocities[i].z *= -1;

      // Gentle floating
      positionsArray[i3] += Math.sin(time * 0.5 + i * 0.1) * 0.1;
      positionsArray[i3 + 1] += Math.cos(time * 0.3 + i * 0.1) * 0.1;
    }

    geometry.attributes.position.needsUpdate = true;

    // Rotate entire particle system slowly
    particles.rotation.y = time * 0.02;
    particles.rotation.x = Math.sin(time * 0.01) * 0.1;

    renderer.render(scene, camera);
  }
}

export function destroy(): void {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  document.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('resize', onResize);
  renderer?.dispose();
}

function onMouseMove(event: MouseEvent): void {
  // Handled in init
}

function onResize(): void {
  // Handled in init
}
