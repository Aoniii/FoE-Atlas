import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/")({
  component: HomePage,
})

function HomePage() {
  return <h1 className="text-2xl font-semibold">FoE Atlas</h1>
}
