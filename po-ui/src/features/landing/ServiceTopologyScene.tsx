import { useEffect, useRef } from "react";
import {
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Clock,
  DirectionalLight,
  IcosahedronGeometry,
  Line,
  LineBasicMaterial,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  TorusGeometry,
  WebGLRenderer,
  Group,
} from "three";

const nodePositions = [
  [-2.7, 1.2, 0.2],
  [-1.4, -0.7, -0.6],
  [0.2, 1.4, 0.8],
  [1.4, -0.4, -0.3],
  [2.6, 0.9, 0.5],
  [0.6, -1.5, 0.1],
] as const;

const edgePairs = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 3],
  [2, 4],
  [3, 5],
  [4, 5],
] as const;

const nodeColors = [0x0891b2, 0xd97706, 0x059669, 0xbe123c, 0x4f46e5, 0x0f766e] as const;

export function ServiceTopologyScene() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;

    if (mount === null) {
      return;
    }

    const renderer = new WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const scene = new Scene();
    const camera = new PerspectiveCamera(38, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0.35, 0.12, 7.8);

    const root = new Group();
    scene.add(root);

    const ambientLight = new AmbientLight(0xffffff, 1.8);
    const keyLight = new DirectionalLight(0xffffff, 2.1);
    keyLight.position.set(3, 5, 4);
    scene.add(ambientLight, keyLight);

    const nodes = nodePositions.map((position, index) => {
      const geometry = new IcosahedronGeometry(index === 2 ? 0.42 : 0.32, 2);
      const material = new MeshStandardMaterial({
        color: nodeColors[index],
        emissive: nodeColors[index],
        emissiveIntensity: 0.08,
        metalness: 0.18,
        roughness: 0.46,
      });
      const mesh = new Mesh(geometry, material);
      mesh.position.set(position[0], position[1], position[2]);
      root.add(mesh);
      return mesh;
    });

    const lineMaterial = new LineBasicMaterial({
      color: 0x64748b,
      transparent: true,
      opacity: 0.28,
    });

    const lineGeometries: BufferGeometry[] = [];

    edgePairs.forEach(([fromIndex, toIndex]) => {
      const from = nodes[fromIndex];
      const to = nodes[toIndex];
      const geometry = new BufferGeometry().setFromPoints([
        from.position.clone(),
        to.position.clone(),
      ]);
      lineGeometries.push(geometry);
      root.add(new Line(geometry, lineMaterial));
    });

    const ring = new Mesh(
      new TorusGeometry(2.4, 0.012, 12, 160),
      new MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.12 }),
    );
    ring.rotation.set(1.18, 0.34, 0.16);
    root.add(ring);

    const particleGeometry = new BufferGeometry();
    const particlePositions = new Float32Array(240 * 3);

    for (let index = 0; index < particlePositions.length; index += 3) {
      particlePositions[index] = (Math.random() - 0.5) * 8;
      particlePositions[index + 1] = (Math.random() - 0.5) * 5;
      particlePositions[index + 2] = (Math.random() - 0.5) * 4;
    }

    particleGeometry.setAttribute("position", new BufferAttribute(particlePositions, 3));
    const particles = new Points(
      particleGeometry,
      new PointsMaterial({
        color: 0x334155,
        size: 0.018,
        transparent: true,
        opacity: 0.36,
      }),
    );
    root.add(particles);

    let frameId = 0;
    const clock = new Clock();

    const resizeObserver = new ResizeObserver(() => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(mount);

    function renderFrame(): void {
      const elapsed = clock.getElapsedTime();
      root.rotation.y = elapsed * 0.1;
      root.rotation.x = Math.sin(elapsed * 0.24) * 0.05;
      ring.rotation.z = elapsed * 0.16;
      particles.rotation.y = elapsed * -0.024;

      nodes.forEach((node, index) => {
        node.rotation.x = elapsed * (0.28 + index * 0.02);
        node.rotation.y = elapsed * (0.4 + index * 0.015);
        node.position.y = nodePositions[index][1] + Math.sin(elapsed * 1.3 + index) * 0.08;
      });

      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(renderFrame);
    }

    renderFrame();

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      mount.removeChild(renderer.domElement);
      renderer.dispose();
      particleGeometry.dispose();
      lineGeometries.forEach((geometry) => {
        geometry.dispose();
      });
      lineMaterial.dispose();
      ring.geometry.dispose();
      (ring.material as Material).dispose();
      nodes.forEach((node) => {
        node.geometry.dispose();
        (node.material as Material).dispose();
      });
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="service-topology-scene absolute inset-y-0 right-0 w-full lg:left-[30%] lg:w-auto"
      data-three-scene="service-topology"
    />
  );
}
