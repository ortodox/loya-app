import { BrandHero } from "@/app/components/Brand";
import { LanguageSelect } from "@/app/components/LanguageSelect";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-8 px-5 py-6">
      <div className="flex justify-end">
        <LanguageSelect />
      </div>
      <BrandHero />
      {children}
    </main>
  );
}
