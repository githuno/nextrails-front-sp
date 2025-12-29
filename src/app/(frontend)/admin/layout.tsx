export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">Admin Layout</h1>
      <p className="mt-4 text-lg">This is the admin layout.</p>
      {children}
    </div>
  )
}
