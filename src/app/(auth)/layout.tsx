import { LanguageSelect } from "@/app/components/LanguageSelect";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-5 py-8">
      <div className="flex justify-end">
        <LanguageSelect />
      </div>
      {children}
    </main>
  );
}
