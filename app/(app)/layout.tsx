import SidebarProvider from "@/components/SidebarProvider"
import AppSidebar from "@/components/AppSidebar"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="desk:flex desk:min-h-[100dvh]">
        <AppSidebar />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </SidebarProvider>
  )
}
