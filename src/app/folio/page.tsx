import React from 'react';
import Image from 'next/image';

const PortfolioPage = () => {
  const projects = [
    { title: '3Dスキャナー',
      text: '3Dスキャンが可能なカメラアプリです。フロント部分をPWAに改修中のためアプリへのアクセスはできません。',
      img: '/3Dscan.png',
      link: 'https://pub-b5e3fa5caf8549b4bf8bff1ac7c7eee8.r2.dev/dev-app-Canva.html' },
    { title: 'SplatViewer',
      text: '3Dスキャンアプリのviewerページです。URLパラメータで渡されたsplatファイルをthree.jsでレンダリングしています。',
      img: '/3Dviewer.png',
      link: 'https://nextrails-front-sp.vercel.app/view?url=https://pub-b5e3fa5caf8549b4bf8bff1ac7c7eee8.r2.dev/53470b29-88cd-4cce-9184-6faf9f8776ae/output/a.splat' },
    { title: 'POSCA',
      text: 'Ruby On Railsで作成したTwitterクローンです。',
      img: '',
      link: 'URL3' },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2 max-w-screen-xl mx-auto">
      <h2 className="text-4xl mb-6">制作物一例</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {projects.map((project, index) => (
          <div className="flex" key={index}>
            <div className="border rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300 ease-in-out flex flex-col h-full">
              <div className="relative h-64 w-full">
                <Image src={project.img} alt={project.title} layout="fill" objectFit="cover" />
              </div>
              <div className="p-6 flex flex-col justify-between flex-grow">
                <div>
                  <h3 className="text-2xl mb-4">{project.title}</h3>
                  <p className="mb-4">{project.text}</p>
                </div>
                <a href={project.link} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                  {project.link}
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PortfolioPage;
