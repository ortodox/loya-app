import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Chevron } from "@/app/components/Icons";
import { card, disclosure, ui } from "@/app/components/ui";
import type { IsoDate } from "@/logic/client";
import type { TreatmentCourse } from "@/logic/course";
import { courseProgress, nextLabDate } from "@/logic/rules/courses";
import { formatIsoDate } from "@/logic/rules/dates";
import { completeCourseAction, extendCourseAction, labsDoneAction, setLastLabAction } from "./courses/actions";

type Props = {
  clientId: string;
  active: TreatmentCourse[];
  completed: TreatmentCourse[];
  photoUrls: Record<string, string>;
  today: IsoDate;
};

const smallButton = "inline-flex min-h-11 items-center justify-center rounded-[14px] border border-field px-4 text-sm font-medium text-accent";

/** LE5/LE9: «Лечение» in the client card – the active course(s) and the finished ones. */
export async function CoursesSection({ clientId, active, completed, photoUrls, today }: Props) {
  const t = await getTranslations("courses");
  const save = (await getTranslations("form"))("save");
  const locale = await getLocale();
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });

  const photos = (course: TreatmentCourse) =>
    course.photos.length > 0 && (
      <ul className="flex flex-wrap gap-2">
        {course.photos.map((p) => (
          <li key={p.id} className="flex flex-col items-center gap-1">
            {photoUrls[p.storagePath] ? (
              <a href={photoUrls[p.storagePath]} target="_blank" rel="noreferrer" aria-label={t("photos")}>
                {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
                <img src={photoUrls[p.storagePath]} alt="" className="size-24 rounded-[14px] object-cover" />
              </a>
            ) : (
              <div className="size-24 rounded-[14px] bg-line" />
            )}
            <span className="text-xs text-muted">{t("photoAdded", { date: formatIsoDate(p.createdAt.slice(0, 10)) })}</span>
          </li>
        ))}
      </ul>
    );

  function activeCourse(course: TreatmentCourse) {
    const progress = courseProgress(course, today);
    const nextLabs = nextLabDate(course);
    return (
      <article key={course.id} className="flex flex-col gap-3 border-t border-line px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <h3 className="text-lg font-semibold text-ink">{course.diagnosis}</h3>
            <p className="text-sm text-muted">
              {formatIsoDate(course.startDate)} – ~{formatIsoDate(course.endDate)}
            </p>
          </div>
          <Link href={`/clients/${clientId}/courses/${course.id}/edit`} className={`${ui.textButton} shrink-0 text-sm`}>
            {t("edit")}
          </Link>
        </div>

        {/* LE2: days left and progress; after the end – finish or extend. */}
        {progress.ended ? (
          <div className="flex flex-col gap-3 rounded-[14px] bg-alert p-3 text-on-alert">
            <p className="font-semibold">{t("ended", { date: formatIsoDate(course.endDate) })}</p>
            <div className="flex flex-wrap gap-2">
              <form action={completeCourseAction.bind(null, clientId, course.id)}>
                <button type="submit" className="min-h-11 rounded-[14px] bg-on-alert px-4 text-sm font-semibold text-alert">
                  {t("complete")}
                </button>
              </form>
              <ExtendForm
                action={extendCourseAction.bind(null, clientId, course.id)}
                min={course.startDate}
                label={t("extend")}
                dateLabel={t("extendTo")}
                saveLabel={save}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <p className="text-base font-medium text-ink">{t("daysLeft", { count: progress.daysLeft })}</p>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress.fraction * 100)}
              className="h-2 overflow-hidden rounded-full bg-line"
            >
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
            </div>
          </div>
        )}

        {course.prescription && <p className="text-base whitespace-pre-wrap text-ink">{course.prescription}</p>}

        {/* LE6: lab control. */}
        {course.labInterval && nextLabs && (
          <div className="flex flex-col gap-2 rounded-[14px] border border-line p-3">
            <p className="text-sm text-muted">
              {t("interval", { value: number.format(course.labInterval.value), unit: t(`units.${course.labInterval.unit}`) })}
              {course.lastLabDate && ` · ${t("lastLabs", { date: formatIsoDate(course.lastLabDate) })}`}
            </p>
            <p className={`text-base font-semibold ${nextLabs < today ? "text-on-alert" : "text-ink"}`}>
              {nextLabs < today
                ? t("labsOverdue", { date: formatIsoDate(nextLabs) })
                : t("nextLabs", { date: formatIsoDate(nextLabs) })}
            </p>
            <div className="flex flex-wrap items-start gap-2">
              <form action={labsDoneAction.bind(null, clientId, course.id)}>
                <button type="submit" className={smallButton}>
                  {t("labsDone")}
                </button>
              </form>
              {/* LE6: another date for the last tests, or clear it (then counted from the start). */}
              <details className="group/lab">
                <summary className={`${smallButton} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
                  {t("lastLabEdit")}
                </summary>
                <form action={setLastLabAction.bind(null, clientId, course.id)} className="mt-2 flex flex-col gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-muted">{t("lastLabDate")}</span>
                    <input name="lastLabDate" type="date" max={today} defaultValue={course.lastLabDate ?? ""} className={ui.input} />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" name="intent" value="save" className={ui.addButton}>
                      {save}
                    </button>
                    {course.lastLabDate && (
                      <button type="submit" name="intent" value="clear" className={`${smallButton} text-on-alert`}>
                        {t("clear")}
                      </button>
                    )}
                  </div>
                </form>
              </details>
            </div>
          </div>
        )}

        {/* LE3: prescription photos, newest first. */}
        {photos(course)}
      </article>
    );
  }

  return (
    <section className={card.surface}>
      <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
        <h2 className={card.heading}>{t("title")}</h2>
        <Link href={`/clients/${clientId}/courses/new`} className={ui.addButton}>
          {t("add")}
        </Link>
      </div>
      {active.length === 0 && <p className={`${ui.muted} px-4 pb-4`}>{t("empty")}</p>}
      {active.map(activeCourse)}

      {/* LE9: finished courses, closed. */}
      {completed.length > 0 && (
        <details className="group/done border-t border-line">
          <summary className={`${disclosure.summary} text-base text-ink`}>
            <span>{t("completedList", { count: completed.length })}</span>
            <Chevron className="shrink-0 text-muted transition-transform group-open/done:rotate-180" />
          </summary>
          <ul>
            {completed.map((course) => (
              <li key={course.id} className="flex flex-col gap-2 border-t border-line px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="font-semibold text-ink">{course.diagnosis}</span>
                    <span className="text-sm text-muted">
                      {formatIsoDate(course.startDate)} – {formatIsoDate(course.endDate)}
                      {course.completedAt && ` · ${t("completedOn", { date: formatIsoDate(course.completedAt) })}`}
                    </span>
                  </div>
                </div>
                {course.prescription && <p className="text-sm whitespace-pre-wrap text-ink">{course.prescription}</p>}
                {photos(course)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/** LE2: «Продлить» opens a date field for the new approximate end. */
function ExtendForm(props: { action: (fd: FormData) => Promise<void>; min: string; label: string; dateLabel: string; saveLabel: string }) {
  const { action, min, label, dateLabel, saveLabel } = props;
  return (
    <details className="group/extend">
      <summary className={`${smallButton} cursor-pointer list-none bg-surface [&::-webkit-details-marker]:hidden`}>{label}</summary>
      <form action={action} className="mt-2 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">{dateLabel}</span>
          <input name="endDate" type="date" required min={min} className={ui.input} />
        </label>
        <button type="submit" className={ui.addButton}>
          {saveLabel}
        </button>
      </form>
    </details>
  );
}
