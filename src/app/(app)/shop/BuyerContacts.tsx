import { useTranslations } from "next-intl";
import { contactLinks } from "@/logic/rules/contacts";
import { instagramUrl, type ShopBuyer } from "@/logic/rules/shop-orders";

/** MG9: «Позвонить», «WhatsApp», «Instagram» for a buyer – only what Loya has written down. */
export function BuyerContacts({ buyer }: { buyer: ShopBuyer }) {
  const t = useTranslations("shop.orders");
  const links = contactLinks(buyer.phone);
  if (!links && !buyer.instagram) return null;
  const chip = "inline-flex min-h-11 items-center rounded-full border border-field px-3 text-sm text-ink";
  return (
    <div className="flex flex-wrap gap-2">
      {links && (
        <>
          <a href={links.call} className={chip}>
            {t("call")}
          </a>
          <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" className={chip}>
            WhatsApp
          </a>
        </>
      )}
      {buyer.instagram && (
        <a href={instagramUrl(buyer.instagram)} target="_blank" rel="noopener noreferrer" className={chip}>
          Instagram
        </a>
      )}
    </div>
  );
}
