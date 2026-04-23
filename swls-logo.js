import * as THREE from 'https://esm.sh/three@0.160';
import {OrbitControls} from 'https://esm.sh/three@0.160/examples/jsm/controls/OrbitControls';
import {FontLoader} from 'https://esm.sh/three@0.160/examples/jsm/loaders/FontLoader';
import {Line2} from 'https://esm.sh/three@0.160/examples/jsm/lines/Line2';
import {LineMaterial} from 'https://esm.sh/three@0.160/examples/jsm/lines/LineMaterial';
import {LineGeometry} from 'https://esm.sh/three@0.160/examples/jsm/lines/LineGeometry';

const TEMPLATE = document.createElement('template');
TEMPLATE.innerHTML = `
<style>
  :host { display: block; width: 100%; height: 100%; }
  canvas { display: block; width: 100%; height: 100%; }
</style>`;

class SwlsLogo extends HTMLElement {
    #animId = null;
    #renderer = null;
    #observer = null;

    connectedCallback() {
        const shadow = this.attachShadow({mode: 'open'});
        shadow.appendChild(TEMPLATE.content.cloneNode(true));

        const w = this.clientWidth  || 300;
        const h = this.clientHeight || 300;

        const lineMaterials = [];

        // ── Scene ────────────────────────────────────────────────────────────
        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x1a1a2e, 0.035);

        const size = 4;
        const camera = new THREE.OrthographicCamera(
            -size * (w / h), size * (w / h), size, -size, 0.1, 1000
        );
        camera.position.set(-6, 8, 15);
        camera.lookAt(0, 2.55, 0);

        const renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
        renderer.setSize(w, h);
        renderer.setPixelRatio(devicePixelRatio);
        shadow.appendChild(renderer.domElement);
        this.#renderer = renderer;

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 2.55, 0);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.update();

        const CYCLE_PERIOD = 3000;
        const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        let cycleStart = null;
        let direction = 1;
        let baseAngle = 0;

        // Lights
        scene.add(new THREE.AmbientLight(0xffffff, 5.8));
        const key = new THREE.DirectionalLight(0xccddff, 1.0);
        key.position.set(2, -3, 6);
        scene.add(key);

        // ── Helpers ──────────────────────────────────────────────────────────
        function makeTube(a, b, color, r = 0.045) {
            return new THREE.Mesh(
                new THREE.TubeGeometry(new THREE.LineCurve3(a, b), 1, r, 6),
                new THREE.MeshStandardMaterial({
                    color, emissive: color, emissiveIntensity: 0.7,
                    roughness: 0.3, metalness: 0.4,
                }));
        }

        // ── Page class ───────────────────────────────────────────────────────
        class Page {
            constructor({y, color}) {
                this.color = color;
                this.group = new THREE.Group();
                this.group.position.set(0, y, 0);
                scene.add(this.group);

                const mat = new THREE.MeshBasicMaterial({
                    color, transparent: true, opacity: 0.3, side: THREE.DoubleSide,
                });
                const mesh = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), mat);
                mesh.rotation.x = -Math.PI / 2;
                mesh.position.y = 0.005;
                this.group.add(mesh);

                const borderGeo = new LineGeometry();
                borderGeo.setPositions([-3,0.01,-3, 3,0.01,-3, 3,0.01,3, -3,0.01,3, -3,0.01,-3]);
                const cw = this.clientWidth || w, ch = this.clientHeight || h;
                const borderMat = new LineMaterial({
                    color,
                    linewidth: Math.min(cw, ch) / 50,
                    transparent: true,
                    opacity: 1,
                    resolution: new THREE.Vector2(cw, ch),
                });
                lineMaterials.push(borderMat);
                this.group.add(new Line2(borderGeo, borderMat));
            }

            addGraph(nodeDefs, edgeDefs) {
                const meshes = nodeDefs.map(({x, z}) => {
                    const mesh = new THREE.Mesh(
                        new THREE.SphereGeometry(0.2, 15, 15),
                        new THREE.MeshStandardMaterial({
                            color: this.color, roughness: 0.2, metalness: 0.6,
                        })
                    );
                    mesh.position.set(x, 0, z);
                    this.group.add(mesh);
                    return mesh;
                });

                nodeDefs.forEach((_, i) => {
                    const j = i === 0 ? nodeDefs.length - 1 : i - 1;
                    this.group.add(makeTube(meshes[i].position.clone(), meshes[j].position.clone(), this.color, 0.075));
                });

                edgeDefs.forEach(([i, j]) => {
                    this.group.add(makeTube(meshes[i].position.clone(), meshes[j].position.clone(), this.color, 0.075));
                });

                return meshes;
            }

            addLabel(font, text, size = 0.95, depth = 0.2) {
                const shapes = font.generateShapes(text, size);
                const geo = new THREE.ExtrudeGeometry(shapes,
                    {steps: 1, depth, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02});

                const mainColor = new THREE.Color(this.color);
                const frontColor = mainColor.clone().lerp(new THREE.Color(0xffffff), 0.00);
                const sideColor  = mainColor.clone().lerp(new THREE.Color(0x000000), 0.75);

                const mesh = new THREE.Mesh(geo, [
                    new THREE.MeshStandardMaterial({color: frontColor, emissive: frontColor, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.0}),
                    new THREE.MeshStandardMaterial({color: sideColor,  emissive: sideColor,  emissiveIntensity: 0.4, roughness: 0.4, metalness: 0.0}),
                ]);
                mesh.position.set(-2.7, 0.02, 2.5 - depth / 2);
                this.group.add(mesh);
            }
        }

        function crossEdge(meshA, meshB, color) {
            const a = new THREE.Vector3(), b = new THREE.Vector3();
            meshA.getWorldPosition(a);
            meshB.getWorldPosition(b);
            scene.add(makeTube(a, b, color, 0.075));
        }

        // ── Pages ────────────────────────────────────────────────────────────
        const otherPage  = new Page({y: 0,   color: 0xCC79A7});
        const jsonPage   = new Page({y: 1.7, color: 0xE69F00});
        const turtlePage = new Page({y: 3.4, color: 0x009E73});
        const sparqlPage = new Page({y: 5.1, color: 0x56B4E9});

        const get_points = (n, rot) => [...new Array(n)].map((_, i) => {
            const angle = i * 2 * Math.PI / n;
            const x = Math.cos(angle) * 2.2, y = Math.sin(angle) * 2.5;
            return {x: Math.cos(rot)*x - Math.sin(rot)*y, z: -0.3 + Math.sin(rot)*x + Math.cos(rot)*y};
        });

        const jN = jsonPage.addGraph(get_points(7, Math.PI / 6), [[4,0],[0,2]]);
        const tN = turtlePage.addGraph(get_points(7, Math.PI/6 + Math.PI/3), []);
        const sN = sparqlPage.addGraph(get_points(7, Math.PI/6 + 2*Math.PI/3), [[1,3],[3,5],[5,0]]);
        const oN = otherPage.addGraph(get_points(7, -Math.PI/6 + 2*Math.PI/3), [[1,3],[3,5],[5,0]]);

        crossEdge(oN[1], jN[2], jsonPage.color);
        crossEdge(oN[3], jN[4], jsonPage.color);
        crossEdge(oN[5], jN[6], jsonPage.color);
        crossEdge(jN[1], tN[0], jsonPage.color);
        crossEdge(jN[3], tN[2], jsonPage.color);
        crossEdge(jN[5], tN[4], jsonPage.color);
        crossEdge(sN[0], tN[1], sparqlPage.color);
        crossEdge(sN[2], tN[3], sparqlPage.color);
        crossEdge(sN[4], tN[5], sparqlPage.color);

        (async () => {
            const font = await new FontLoader().loadAsync('https://cdn.jsdelivr.net/npm/three@0.160/examples/fonts/helvetiker_bold.typeface.json');
            sparqlPage.addLabel(font, 'SWLS', 1.4, 0.3);
            turtlePage.addLabel(font, 'Turtle');
            jsonPage.addLabel(font, 'JSON-LD');
            otherPage.addLabel(font, 'SPARQL');
            requestAnimationFrame(() => { this.dispatchEvent(new CustomEvent('scene-ready')); window.sceneReady = true; });
        })();

        // ── Resize ───────────────────────────────────────────────────────────
        const onResize = (cw, ch) => {
            const aspect = cw / ch;
            camera.left = -size * aspect;
            camera.right = size * aspect;
            camera.updateProjectionMatrix();
            renderer.setSize(cw, ch);
            const lw = Math.min(cw, ch) / 100;
            lineMaterials.forEach(m => { m.resolution.set(cw, ch); m.linewidth = lw; });
        };

        this.#observer = new ResizeObserver(entries => {
            const {width, height} = entries[0].contentRect;
            if (width && height) onResize(width, height);
        });
        this.#observer.observe(this);

        // ── Render loop ──────────────────────────────────────────────────────
        const animate = (now) => {
            this.#animId = requestAnimationFrame(animate);
            controls.update();
            if (cycleStart === null) cycleStart = now + 1000;
            const elapsed = now - cycleStart;
            if (elapsed >= CYCLE_PERIOD) {
                baseAngle += direction * 2 * Math.PI;
                direction *= -1;
                cycleStart = now + 1000;
            }
            const p = Math.min(Math.max(elapsed, 0) / CYCLE_PERIOD, 1);
            scene.rotation.y = baseAngle + direction * easeInOut(p) * 2 * Math.PI;
            renderer.render(scene, camera);
        };
        animate(performance.now());
    }

    disconnectedCallback() {
        if (this.#animId !== null) cancelAnimationFrame(this.#animId);
        this.#observer?.disconnect();
        this.#renderer?.dispose();
    }
}

customElements.define('swls-logo', SwlsLogo);
