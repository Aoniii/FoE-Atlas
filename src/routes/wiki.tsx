import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/wiki")({
  component: WikiPage,
})

function WikiPage() {
  return <h1 className="text-2xl font-semibold">Wiki</h1>
}
