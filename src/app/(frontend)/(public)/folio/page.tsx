import Image from "next/image"

const PortfolioPage = () => {
  const projects1 = [
    {
      title: "POSCA",
      text: "Ruby On Rails(haml), BootStrapで作成したTwitterクローンです。\n\n\
			  BASIC認証・ユーザーアカウントともに以下のアカウントでログイン可能です。Railsでの基本的なCRUD周りや定期処理、javascriptでの動きのあるフロントエンド構築など、Webアプリの基礎を詰め込んでいます。herokuにデプロイしてあり稼働しています。",
      img: "/posca.gif",
      link: "https://posca-2-3b1b27703248.herokuapp.com/",
      id: "test",
      password: "testpass",
    },
    {
      title: "Turquoise",
      text: "リプレイスの試し書きです。バックエンドはgoで単純にjsonのリクエストを管理します。勉強のためにnginxでプロキシサーバーも立ち上げます。フロントエンドはnext.js（TypeScript）でAppRouterやBiomeリンターなどを採用しています。",
      img: "/Turquoise.gif",
      link: "https://pub-b5e3fa5caf8549b4bf8bff1ac7c7eee8.r2.dev/Turquoise.html",
    },
  ]
  const projects2 = [
    {
      title: "3Dスキャナー",
      text: "3Dスキャンが可能なカメラアプリです。フロント部分をPWAに改修中のためアプリへのアクセスはできません。",
      img: "/3Dscan.png",
      link: "https://pub-b5e3fa5caf8549b4bf8bff1ac7c7eee8.r2.dev/dev-app-Canva.html",
    },
    {
      title: "SplatViewer",
      text: "3Dスキャンアプリのviewerページです。URLパラメータで渡されたsplatファイルをthree.jsでレンダリングしています。グリグリしてください。",
      img: "/3Dviewer.gif",
      link: "https://nextrails-front-sp.vercel.app/view?url=https://pub-b5e3fa5caf8549b4bf8bff1ac7c7eee8.r2.dev/53470b29-88cd-4cce-9184-6faf9f8776ae/output/a.splat",
    },
  ]
  return (
    <div className="mx-auto flex min-h-screen max-w-screen-xl flex-col items-center justify-center py-2">
      <h2 className="mb-6 text-xl">制作物一例</h2>
      <div className="flex flex-col items-center gap-4">
        {projects1.map((project, index) => (
          <a href={project.link} target="_blank" rel="noopener noreferrer" key={index} className="relative w-full">
            <div className="gradate grid h-full grid-cols-3 overflow-hidden rounded-lg border shadow-md transition-shadow duration-300 ease-in-out hover:shadow-lg">
              <div className="relative col-span-1">
                <Image src={project.img} alt={project.title} fill style={{ objectFit: "cover" }} />
              </div>
              <div className="col-span-2 flex flex-col justify-between p-6">
                <div>
                  <h3 className="mb-4 text-2xl">{project.title}</h3>
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
            <div className="absolute top-0 right-0 p-2">
              <div className="rounded-full bg-white p-1">
                <Image src="/open-link.svg" alt="Open link icon" width={24} height={24} />
              </div>
            </div>
          </a>
        ))}
        <hr className="my-8 w-full border-t border-gray-300" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects2.map((project, index) => (
            <a
              href={project.link}
              target="_blank"
              rel="noopener noreferrer"
              key={index}
              className="relative w-full scale-90 opacity-75"
            >
              <div className="flex h-full flex-col overflow-hidden rounded-lg border shadow-md transition-all duration-300 ease-in-out hover:shadow-lg">
                <div className="relative h-40">
                  <Image src={project.img} alt={project.title} fill style={{ objectFit: "cover" }} />
                </div>
                <div className="flex h-30 flex-grow flex-col p-4">
                  <h3 className="mb-2 text-lg">{project.title}</h3>
                  <p className="flex-grow text-sm">{project.text}</p>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

export default PortfolioPage
