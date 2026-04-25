export default function PageWrapper({ title, children, action }) {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 w-full">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        {action && <div>{action}</div>}
      </header>
      <main className="flex-1 px-4 sm:px-6 py-4 pb-24 max-w-2xl mx-auto w-full">{children}</main>
    </div>
  )
}
