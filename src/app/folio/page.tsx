import React from 'react';
import Image from 'next/image';

const PortfolioPage = () => {
	const projects = [
		{
			title: '3Dスキャナー',
			text: '3Dスキャンが可能なカメラアプリです。フロント部分をPWAに改修中のためアプリへのアクセスはできません。',
			img: '/3Dscan.png',
			link: 'https://pub-b5e3fa5caf8549b4bf8bff1ac7c7eee8.r2.dev/dev-app-Canva.html'
		},
		{
			title: 'SplatViewer',
			text: '3Dスキャンアプリのviewerページです。URLパラメータで渡されたsplatファイルをthree.jsでレンダリングしています。グリグリしてください。',
			img: '/3Dviewer.gif',
			link: 'https://nextrails-front-sp.vercel.app/view?url=https://pub-b5e3fa5caf8549b4bf8bff1ac7c7eee8.r2.dev/53470b29-88cd-4cce-9184-6faf9f8776ae/output/a.splat'
		},
		{
			title: 'POSCA',
			text: 'Ruby On Railsで作成したTwitterクローンです。\n\n\
			  BASIC認証・ユーザーアカウントともに以下のアカウントでログイン可能です。 ',
			img: '/posca.gif',
			link: 'https://posca-2-3b1b27703248.herokuapp.com/',
			id: 'test',
			password: 'testpass'
		},
	];

	return (
		<div className="flex flex-col items-center justify-center min-h-screen py-2 max-w-screen-xl mx-auto">
			<h2 className="text-xl mb-6">制作物一例</h2>
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
				{projects.map((project, index) => (
					<a href={project.link} target="_blank" rel="noopener noreferrer" key={index} className="flex flex-col">
						<div className="border rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300 ease-in-out flex flex-col h-full gradate">
							<div className="relative w-full pb-[56.25%]">
								<Image src={project.img} alt={project.title} layout="fill" objectFit="cover" />
								<div className="absolute top-0 right-0 p-2">
									<div className="bg-white rounded-full p-1">
										<Image src="/open-link.svg" alt="Open link icon" width={24} height={24} />
									</div>
								</div>
							</div>
							<div className="p-6 flex flex-col justify-between flex-grow">
								<div>
									<h3 className="text-2xl mb-4">{project.title}</h3>
									<p className="mb-4">{project.text}</p>
									{project.id && project.password && (
										<div className="overflow-auto">
										<table className="table-auto">
											<tbody>
												<tr>
													<td className="border px-4 py-2 text-gray-500">user</td>
													<td className="border px-4 py-2">{project.id}</td>
												</tr>
												<tr>
													<td className="border px-4 py-2 text-gray-500">password</td>
													<td className="border px-4 py-2">{project.password}</td>
												</tr>
											</tbody>
										</table>
									</div>
									)}
								</div>
							</div>
						</div>
					</a>
				))}
			</div>
		</div>
	);
};

export default PortfolioPage;
