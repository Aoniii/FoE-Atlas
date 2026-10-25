import type { ReactNode } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { ArrowRight, BookOpen, Construction, Map as MapIcon } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { fetchIndex } from "@/wiki/data"

const GITHUB_URL = "https://github.com/Aoniii"
// AGPL-3.0: the source code must be offered to the site's users
const SOURCE_URL = "https://github.com/Aoniii/FoE-Atlas"

export const Route = createFileRoute("/")({
  // Game version and data date, shown at the bottom (null if data is missing)
  loader: () => fetchIndex().catch(() => null),
  component: HomePage,
})

// Home: the site and its version, what the wiki and the City tab do, the development notice;
// the licence and the data's version at the bottom of the screen
function HomePage() {
  const { t, locale } = useI18n()
  const index = Route.useLoaderData()
  return (
    <div className="flex min-h-[calc(100svh-6.5rem-1px)] flex-col gap-10">
      {/* Centered in the height of the screen on a computer, the footer at its corners */}
      <div className="mx-auto grid w-full max-w-5xl gap-6 md:my-auto md:grid-cols-2 md:[grid-template-areas:'wiki_brand'_'wiki_city'_'dev_city']">
        <section className="flex flex-col justify-center gap-3 md:[grid-area:brand]">
          <div className="flex items-center gap-4">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-14" />
            <h1 className="flex flex-wrap items-baseline gap-x-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              FoE Atlas
              <span className="font-mono text-sm font-normal text-muted-foreground">
                v{__APP_VERSION__}
              </span>
            </h1>
          </div>
          <p className="text-lg text-muted-foreground">{t.home.tagline}</p>
        </section>

        <FeatureCard
          className="md:[grid-area:wiki]"
          icon={<BookOpen className="size-6 text-primary" />}
          title={t.home.wikiTitle}
          text={t.home.wikiText}
          action={
            <Link to="/wiki" className={buttonVariants({ size: "lg" })}>
              {t.home.openWiki}
              <ArrowRight />
            </Link>
          }
        />

        <FeatureCard
          className="md:[grid-area:city]"
          icon={<MapIcon className="size-6 text-primary" />}
          title={t.home.cityTitle}
          text={t.home.cityText}
          action={
            <Link to="/city" className={buttonVariants({ size: "lg" })}>
              {t.home.openCity}
              <ArrowRight />
            </Link>
          }
        />

        <section className="flex flex-col gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-5 md:[grid-area:dev]">
          <h2 className="flex items-center gap-2 font-semibold">
            <Construction className="size-5 text-amber-500" />
            {t.home.devTitle}
          </h2>
          <p className="text-sm text-muted-foreground">{t.home.devText}</p>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
          >
            <GitHubIcon />
            {t.home.github}
          </a>
        </section>
      </div>

      <footer className="mt-auto flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted-foreground md:mt-0">
        <a
          href={SOURCE_URL}
          target="_blank"
          rel="noreferrer"
          className="underline-offset-4 hover:underline"
        >
          {t.home.source}
        </a>
        {index && (
          <span>
            {index.gameVersion && `${t.wiki.gameVersion} ${index.gameVersion} · `}
            {t.wiki.updated} {new Date(index.scrapedAt).toLocaleDateString(locale)}
          </span>
        )}
      </footer>
    </div>
  )
}

// A part of the site: what it does and the way in
function FeatureCard({
  icon,
  title,
  text,
  action,
  className,
}: {
  icon: ReactNode
  title: string
  text: string
  action: ReactNode
  className?: string
}) {
  return (
    <section className={cn("flex flex-col gap-4 rounded-lg border p-6", className)}>
      <h2 className="flex items-center gap-3 text-xl font-semibold">
        {icon}
        {title}
      </h2>
      <p className="flex-1 text-muted-foreground">{text}</p>
      <div>{action}</div>
    </section>
  )
}

// GitHub mark (lucide has no brand icons)
function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}
