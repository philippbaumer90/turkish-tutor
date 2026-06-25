"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { usePathname } from "next/navigation"

type SidebarState = { streak: number; phase: number; refresh: () => void }

const SidebarContext = createContext<SidebarState>({
  streak: 0,
  phase: 0,
  refresh: () => {},
})

export function useSidebar() {
  return useContext(SidebarContext)
}

export default function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [streak, setStreak] = useState(0)
  const [phase, setPhase] = useState(0)
  const pathname = usePathname()

  const refresh = useCallback(() => {
    fetch("/api/state")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        if (typeof d.streak === "number") setStreak(d.streak)
        if (typeof d.phase === "number") setPhase(d.phase)
      })
      .catch(() => {})
  }, [])

  // The (app) group layout never remounts across /↔/session, so refetch on
  // each route landing — this picks up the post-session streak/phase when the
  // user returns to "/".
  useEffect(() => {
    refresh()
  }, [pathname, refresh])

  return (
    <SidebarContext.Provider value={{ streak, phase, refresh }}>
      {children}
    </SidebarContext.Provider>
  )
}
