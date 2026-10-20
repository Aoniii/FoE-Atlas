import { Outlet, createRootRoute } from "@tanstack/react-router"
import { CompareTray } from "@/compare/compare-tray"
import { SiteHeader } from "@/components/site-header"

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <CompareTray />
    </div>
  )
}
