import { getTranslations } from "next-intl/server";
import Link from "next/link";

type Props = { clientId: string; repeatable: boolean; photoHref: string | null };

const button = "flex min-h-11 items-center justify-center rounded-[14px] px-1 text-[13px] font-semibold whitespace-nowrap";

/**
 * The client card's most used actions in a bar fixed above the tab bar: «+ Визит», «↺ Повторить»
 * and «+ Фото» (calling and messengers stay at the top of the card). The spacer keeps the last
 * section of the card above the bar.
 */
export async function CardActions({ clientId, repeatable, photoHref }: Props) {
  const t = await getTranslations("card");
  const items = [
    { href: `/clients/${clientId}/visits/new`, label: t("actionVisit"), primary: true },
    ...(repeatable ? [{ href: `/clients/${clientId}/visits/new?repeat=1`, label: t("actionRepeat"), primary: false }] : []),
    ...(photoHref ? [{ href: photoHref, label: t("actionPhoto"), primary: false }] : []),
  ];
  return (
    <>
      <div aria-hidden className="h-14 shrink-0" />
      <nav
        aria-label={t("actions")}
        className="fixed inset-x-0 bottom-[calc(4rem+var(--safe-bottom))] z-10 border-t border-line bg-bg/95 backdrop-blur"
      >
        <ul className="mx-auto flex max-w-2xl gap-1.5 px-4 py-2">
          {items.map((item) => (
            <li key={item.label} className="flex-1">
              <Link href={item.href} className={`${button} ${item.primary ? "bg-primary text-on-primary" : "border border-field bg-surface text-accent"}`}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
