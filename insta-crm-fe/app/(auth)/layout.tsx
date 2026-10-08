import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/dashboard/language-switcher";
import { BrandMark } from "@/components/brand/brand-mark";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border p-6 sm:p-8">
        <div className="flex justify-center mb-8">
          <BrandMark />
        </div>
        {children}
      </div>
    </main>
  );
}
