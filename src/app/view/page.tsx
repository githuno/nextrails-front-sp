"use client";
import { BrowserRouter } from 'react-router-dom';
import { StaticRouter } from 'react-router-dom/server';
// import SplatScene from '../components/scene/SplatScene';
import dynamic from 'next/dynamic';

const ViewerContent = dynamic(() => import('./content'), { ssr: false });

const isServer = typeof window === 'undefined';
const Router = isServer ? StaticRouter : BrowserRouter;

const View = () => {
	return (
		<Router location={''}>
			<ViewerContent />
		</Router>
	);
};

export default View;
