import { createFileRoute } from "@tanstack/react-router"
import { CHANGELOG } from "@/changelog"
import { Badge } from "@/components/ui/badge"
import { localized, useI18n } from "@/lib/i18n"

export const Route = createFileRoute("/changelog")({
  component: ChangelogPage,
})

function ChangelogPage() {
  const { t, locale } = useI18n()
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 py-6">
      <h1 className="text-2xl font-semibold">{t.changelog.title}</h1>
      {CHANGELOG.map((release) => (
        <section key={release.version} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="font-mono text-lg font-semibold">v{release.version}</h2>
            <time dateTime={release.date} className="text-sm text-muted-foreground">
              {new Date(release.date).toLocaleDateString(locale, { dateStyle: "long" })}
            </time>
            {release.version === __APP_VERSION__ && (
              <Badge variant="secondary">{t.changelog.current}</Badge>
            )}
          </div>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
            {release.changes.map((change) => (
              <li key={change.en}>{localized(change, locale)}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
