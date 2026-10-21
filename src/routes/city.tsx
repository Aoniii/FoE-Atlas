import { createFileRoute } from "@tanstack/react-router"
import { CityPage } from "@/city/city-page"
import { fetchAssets, fetchIndex } from "@/wiki/data"

// The player's own city, sent by the FoE Atlas browser extension
export const Route = createFileRoute("/city")({
  loader: async () => {
    const [index, assets] = await Promise.all([fetchIndex(), fetchAssets()])
    return { index, assets }
  },
  component: CityPage,
})
