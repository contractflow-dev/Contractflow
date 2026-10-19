"use client";

import React, { useState } from "react";
import { RequirePlatformAdmin } from "@/components/auth/require-platform-admin";
import { AdminSidebar } from "@/features/admin/components/admin-sidebar";
import { AdminHeader } from "@/features/admin/components/admin-header";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <RequirePlatformAdmin>
      <div className="min-h-screen bg-background">
        {/* Navigation Sidebar */}
        <AdminSidebar
          isOpen={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
        />

        {/* Main Content Area */}
        <div className="flex flex-col md:pl-64 min-h-screen">
          <AdminHeader onToggleMobileNav={() => setMobileNavOpen((prev) => !prev)} />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </RequirePlatformAdmin>
  );
}
