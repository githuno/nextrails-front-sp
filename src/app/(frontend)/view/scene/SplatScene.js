import { useEffect, useRef } from "react";
import * as SPLAT from "gsplat";
import customOrbitControls from "../customOrbitControls";
// import myOrbitControls from "../myOrbitControls";

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
			controls.current = new customOrbitControls(camera.current, renderer.current.domElement, () => isLoading.current);

			const handleResize = () => {
				renderer.current.setSize(window.innerWidth, window.innerHeight);
			};
			const frame = () => {
				controls.current.update();
				renderer.current.render(scene.current, camera.current);
				requestAnimationFrame(frame);
			};

			const onKeyDown = (e) => {
				if (e.key === "PageUp") {
					scene.current.scale(new SPLAT.Vector3(1.1, 1.1, 1.1));
				} else if (e.key === "PageDown") {
					scene.current.scale(new SPLAT.Vector3(0.9, 0.9, 0.9));
				} else if (e.key === "ArrowLeft") {
					scene.current.rotate(SPLAT.Quaternion.FromEuler(new SPLAT.Vector3(0, 0.1, 0)));
				} else if (e.key === "ArrowRight") {
					scene.current.rotate(SPLAT.Quaternion.FromEuler(new SPLAT.Vector3(0, -0.1, 0)));
				} else if (e.key === "z") {
					scene.current.translate(new SPLAT.Vector3(0, 0, 0.1));
				}
			};

			handleResize();
			window.addEventListener("resize", handleResize);
			window.addEventListener("keydown", onKeyDown);
			requestAnimationFrame(frame);
			sceneRef.current.appendChild(renderer.current.domElement);

			const animateSceneRotate = (scene, speed = Math.PI/2.5) => {
				const limitSize = 15.0;
				scene.current.limitBox(-5, limitSize, -limitSize, 5, -0, limitSize);
				return new Promise((resolve) => {
					let angle = 0;
					scene.current.scale(new SPLAT.Vector3(0.1, 0.1, 0.1));
					scene.current.rotate(SPLAT.Quaternion.FromEuler(new SPLAT.Vector3(0.3, 0, 0.3)));

					const animate = async () => {
						if (angle >= Math.PI * 2) {
							// 一周したらアニメーションを終了
							resolve();
						} else {
							// シーンをy軸周りに回転
							scene.current.rotate(SPLAT.Quaternion.FromEuler(new SPLAT.Vector3(-0.1, -speed, -0.1)));
							scene.current.scale(new SPLAT.Vector3(1.2, 1.2, 1.2));
							angle += speed;
							renderer.current.render(scene.current, camera.current);
							// 描画が終わるまで待機
							await new Promise((animate) => setTimeout(animate, 3000));

							// 次のフレームをリクエスト
							requestAnimationFrame(animate);
						}
					};
					animate();
				});
			};

			const animateRotation = (camera, renderer, scene, radius = 0.5, speed = 0.01) => {
				return new Promise((resolve) => {
					let angle = Math.PI; //0;
					const animate = () => {
						if (angle >= Math.PI * 3 + 0.5) {
							// 一周したらアニメーションを終了
							resolve();
						} else {
							// カメラの位置を更新
							camera.current.position.x = - radius * Math.sin(angle);
							camera.current.position.z = radius * Math.cos(angle) - 0.5;
							angle += speed;
							renderer.current.render(scene.current, camera.current);
							// 次のフレームをリクエスト
							requestAnimationFrame(animate);
						}
					};
					animate();
				});
			};

			const animateZoom = (camera, renderer, scene, startX = 4.5,
				startZ = 0, endX = 0, endZ = -4.5, speed = 0.1) => {
				return new Promise((resolve) => {
					let x = startX;
					// let y = startY;
					let z = startZ;
					const animate = () => {
						if (x <= endX && z <= endZ ) {
							resolve();
						}else if (x > endX) {
							camera.current.position.x = x;
							x -= speed;
							// camera.current.position.z = z;
							// z -= speed;
						}else if (z > endZ) {
							camera.current.position.z = z;
							z -= speed;
						}
						renderer.current.render(scene.current, camera.current);
						requestAnimationFrame(animate);
					};
					animate();
				});
			};


			// ファイルの読み込みが完了した後の処理
			(async () => {
				await SPLAT.Loader.LoadAsync(url, scene.current, (progress) => {
					progressIndicator.value = progress * 100;
				}).then(async () => {
					// await animateSceneRotate(scene);
					// await animateRotation(camera, renderer, scene, 3, 0.1);
					// await animateZoom(camera, renderer, scene);
					progressDialog.close();
					isLoading.current = false;
					if (!isMounted.current) {
						// Clean up any resources here if needed
					}
				});
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
