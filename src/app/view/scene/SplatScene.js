import { useEffect, useRef } from "react";
import * as SPLAT from "gsplat";

const progressDialog = document.getElementById("progress-dialog");
const progressIndicator = document.getElementById("progress-indicator");

const SplatScene = ({ url }) => {
    const sceneRef = useRef(null);
    const scene = useRef(null);
    const camera = useRef(null);
    const renderer = useRef(null);
    const controls = useRef(null);
    const isMounted = useRef(true);
    const isLoading = useRef(false);

    useEffect(() => {
        if (sceneRef.current && !isLoading.current) {
            isLoading.current = true;
            sceneRef.current.innerHTML = '';
            scene.current = new SPLAT.Scene();
            camera.current = new SPLAT.Camera();
            renderer.current = new SPLAT.WebGLRenderer();
            controls.current = new SPLAT.OrbitControls(camera.current, renderer.current.domElement);

            const handleResize = () => {
                renderer.current.setSize(window.innerWidth, window.innerHeight);
            };
            const frame = () => {
                controls.current.update();
                renderer.current.render(scene.current, camera.current);
                requestAnimationFrame(frame);
            };
            handleResize();
            window.addEventListener("resize", handleResize);
            requestAnimationFrame(frame);
            sceneRef.current.appendChild(renderer.current.domElement);

            (async () => {
                await SPLAT.Loader.LoadAsync(url, scene.current, (progress) => {
					progressIndicator.value = progress * 100;
                    isLoading.current = false;
                });
				progressDialog.close();
                if (!isMounted.current) {
                    // Clean up any resources here if needed
                }
            })();
        }
    }, [url]);

    useEffect(() => {
        return () => {
            isMounted.current = false;
        };
    }, []);

    return <div ref={sceneRef} />;
};

export default SplatScene;
