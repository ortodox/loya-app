import { initials } from "@/logic/rules/thumbnails";

/** FK1: the newest photo of the client as a round picture; initials when there is none. */
export function ClientPicture({ name, url, size }: { name: string; url: string | null; size: "list" | "card" }) {
  const box = size === "card" ? "size-16 text-xl" : "size-11 text-sm";
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
    <img src={url} alt="" className={`${box} shrink-0 rounded-full object-cover`} />
  ) : (
    <span aria-hidden className={`${box} inline-flex shrink-0 items-center justify-center rounded-full bg-line font-serif text-muted`}>
      {initials(name)}
    </span>
  );
}
