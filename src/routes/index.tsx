import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { ArrowRight, Check, Construction, Copy, MessageCircle } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"

const GITHUB_URL = "https://github.com/Aoniii"
// AGPL-3.0: the source code must be offered to the site's users
const SOURCE_URL = "https://github.com/Aoniii/FoE-Atlas"
const DISCORD_USERNAME = "aoniii"

export const Route = createFileRoute("/")({
  component: HomePage,
})

function HomePage() {
  const { t } = useI18n()
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 py-10">
      <section className="flex flex-col items-start gap-4">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-14" />
        <h1 className="flex items-baseline gap-3 text-4xl font-semibold tracking-tight">
          FoE Atlas
          <span className="font-mono text-sm font-normal text-muted-foreground">
            v{__APP_VERSION__}
          </span>
        </h1>
        <p className="text-lg text-muted-foreground">{t.home.tagline}</p>
        <Link to="/wiki" className={buttonVariants({ size: "lg" })}>
          {t.home.openWiki}
          <ArrowRight />
        </Link>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Construction className="size-5 text-amber-500" />
          {t.home.devTitle}
        </h2>
        <p className="text-sm text-muted-foreground">{t.home.devText}</p>
        <div className="flex flex-wrap gap-2">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "outline" })}
          >
            <GitHubIcon />
            {t.home.github}
          </a>
          <DiscordContact />
        </div>
      </section>

      <a
        href={SOURCE_URL}
        target="_blank"
        rel="noreferrer"
        className="w-fit text-xs text-muted-foreground underline-offset-4 hover:underline"
      >
        {t.home.source}
      </a>
    </div>
  )
}

// Discord has no public profile link: show the username with a copy button
function DiscordContact() {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(DISCORD_USERNAME)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable (insecure context): the username stays readable
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={t.home.copy}
      className={buttonVariants({ variant: "outline" })}
    >
      <MessageCircle />
      {t.home.discord} <span className="font-mono">{DISCORD_USERNAME}</span>
      {copied ? <Check className="text-green-500" /> : <Copy className="opacity-60" />}
      <span className="sr-only" aria-live="polite">
        {copied ? t.home.copied : ""}
      </span>
    </button>
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
