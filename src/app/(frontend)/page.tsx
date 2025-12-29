export default function Page() {
  return (
    <div className="flex h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">Sample Page</h1>
      <p className="mt-4 text-lg">This is the sample page.</p>
    </div>
  )
}

// A. Error: Cannot read properties of undefined (reading 'call')
// B. ChunkLoadError: Loading chunk app/(frontend)/layout failed.
// ブラウザのキャッシュデータが古いページを表示させている場合がある
// 参考； https://stackoverflow.com/questions/74832268/typeerror-cannot-read-properties-of-undefined-reading-call-on-next-js
