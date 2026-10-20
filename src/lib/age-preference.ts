import { AGE_IDS, type AgeId } from "@/core/ages"

const COOKIE = "age"
const ONE_YEAR = 60 * 60 * 24 * 365

// Age chosen last time (cookie), default of every age selector when the URL has none
export function getPreferredAge(): AgeId | undefined {
  const value = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`))?.[1]
  return AGE_IDS.find((age) => age === value)
}

export function setPreferredAge(age: AgeId) {
  document.cookie = `${COOKIE}=${age}; path=/; max-age=${ONE_YEAR}; SameSite=Lax`
}
