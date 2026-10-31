import { getTranslations } from "next-intl/server";

/** Grey placeholder block while a page loads. */
export function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-[14px] bg-line ${className}`} />;
}

/** Shown at once after a tap while the server prepares the page – the app never looks frozen. */
export async function PageSkeleton({ variant }: { variant: "list" | "card" | "page" }) {
  const t = await getTranslations("card");
  return (
    <main role="status" aria-busy="true" className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-5 pt-4 pb-8">
      <span className="sr-only">{t("loading")}</span>
      {variant === "list" ? (
        <>
          <div className="flex items-center justify-between">
            <Bone className="h-8 w-16" />
            <Bone className="h-11 w-40 rounded-full" />
          </div>
          <Bone className="h-12 w-48" />
          <Bone className="h-11 w-full" />
          <div className="flex gap-2">
            <Bone className="h-11 w-36 rounded-full" />
            <Bone className="h-11 w-36 rounded-full" />
          </div>
          <div className="flex flex-col gap-px overflow-hidden rounded-[18px]">
            {Array.from({ length: 6 }, (_, i) => (
              <Bone key={i} className="h-20 w-full rounded-none" />
            ))}
          </div>
        </>
      ) : variant === "card" ? (
        <>
          <div className="flex justify-between">
            <Bone className="h-6 w-24" />
            <Bone className="h-6 w-24" />
          </div>
          <Bone className="h-4 w-32" />
          <Bone className="h-10 w-3/4" />
          <Bone className="h-5 w-1/2" />
          <Bone className="h-32 w-full rounded-[18px]" />
          <Bone className="h-48 w-full rounded-[18px]" />
          <Bone className="h-32 w-full rounded-[18px]" />
        </>
      ) : (
        <>
          <Bone className="h-8 w-2/3" />
          <Bone className="h-40 w-full rounded-[18px]" />
          <Bone className="h-40 w-full rounded-[18px]" />
        </>
      )}
    </main>
  );
}
