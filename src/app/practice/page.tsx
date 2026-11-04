import Link from "next/link";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { getSession, has } from "@/lib/auth/session";
import { getPracticeState, getPracticeTeam } from "@/lib/db/practice";
import { PRACTICE_TASKS, isReady, nextTask } from "@/lib/practice";
import { stopPracticeAction } from "@/lib/actions/practice";
import { dateTimeIn } from "@/lib/dates";
import { roleLabel } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { PracticeControls } from "./PracticeControls";
import { VIDEOS, captionsSrc, videoSrc } from "@/lib/help/videos";
import { getLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/**
 * Practice (0096): the same app with pretend money and stock, in a practice
 * café of the person's own. Their role's tasks, each ticked once done there;
 * the next one first. For whoever keeps the staff, who is ready.
 */
export default async function PracticePage() {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const s = await getSession();
  if (!s.signedIn) redirect("/login");
  if (s.practiceEnded)
    return (
      <div className="card grid" style={{ gap: 12, maxWidth: 560 }} data-testid="practice-ended">
        <h1 style={{ margin: 0 }}>{t("Practice has ended")}</h1>
        <p style={{ margin: 0 }}>
          {t(
            "This practice café is no more. Go back to the café, and start practice again when you want.",
          )}
        </p>
        <form action={stopPracticeAction}>
          <button type="submit" className="btn-primary">
            {t("Back to the café")}
          </button>
        </form>
      </div>
    );
  if (!s.profile) redirect("/account");
  const profile = s.profile;
  const practising = profile.practice;
  const [state, team] = await Promise.all([
    getPracticeState(),
    !practising && has(profile, "staff.manage") ? getPracticeTeam() : Promise.resolve(null),
  ]);
  if (!state)
    return (
      <div className="card">
        <h1 style={{ marginTop: 0 }}>{t("Practice")}</h1>
        <p className="muted">
          {t("This needs the database update 0096, which has not been applied yet.")}
        </p>
      </div>
    );
  const next = nextTask(state);
  const ready = isReady(state);
  const done = state.tasks.filter((x) => x.doneAt).length;

  return (
    <div className="grid" style={{ gap: 16, maxWidth: 760 }}>
      <h1 style={{ margin: 0 }}>{t("Practice")}</h1>
      <section className="card grid" style={{ gap: 10 }} data-testid="practice-intro">
        <p style={{ margin: 0 }}>
          {t(
            "Practise your work in a practice café of your own: the same screens, a small menu, pretend money and stock. Nothing you do there reaches the café's books, so try everything, and make mistakes.",
          )}
        </p>
        {practising ? (
          <p className="pos-val" style={{ margin: 0 }}>
            <Icon name="check" />{" "}
            {t("You are practising now. Every screen shows the practice banner.")}
          </p>
        ) : null}
        <PracticeControls
          started={state.started}
          practising={practising}
          next={next ? PRACTICE_TASKS[next.task]!.href : null}
        />
      </section>

      <section className="card grid" style={{ gap: 10 }} data-testid="practice-tasks">
        <h2 className="dash-h" style={{ margin: 0 }}>
          {t("Your tasks")}{" "}
          <span className="muted" data-testid="practice-progress">
            {t("{done} of {n} done", { done, n: state.tasks.length })}
          </span>
        </h2>
        {ready && (
          <p
            className="badge ok"
            style={{ margin: 0, whiteSpace: "normal" }}
            data-testid="practice-ready"
          >
            {t("You are ready: every task of your role is done.")}
          </p>
        )}
        <ol className="practice-tasks">
          {state.tasks.map((x) => {
            const info = PRACTICE_TASKS[x.task]!;
            const isNext = next?.task === x.task;
            return (
              <li
                key={x.task}
                className={x.doneAt ? "done" : isNext ? "next" : ""}
                data-testid="practice-task"
                data-task={x.task}
                data-done={x.doneAt ? "1" : "0"}
              >
                <span aria-hidden="true" style={{ fontSize: "1.2rem" }}>
                  {x.doneAt ? "✓" : isNext ? "→" : "○"}
                </span>
                <div>
                  <strong>{t(info.title)}</strong>
                  <div className="muted" style={{ fontSize: ".85rem" }}>
                    {x.doneAt
                      ? t("Done {when}", { when: dateTimeIn(profile.timezone, x.doneAt) })
                      : t(info.how)}
                  </div>
                  {VIDEOS[x.task] && (
                    <details className="practice-video" data-testid="practice-video">
                      <summary>{t("Watch how")}</summary>
                      <video controls preload="none" src={videoSrc(x.task)} width={480}>
                        <track
                          kind="captions"
                          srcLang={locale}
                          src={captionsSrc(x.task, locale)}
                          default
                        />
                      </video>
                    </details>
                  )}
                </div>
                {practising && !x.doneAt && (
                  <Link
                    href={info.href}
                    className={isNext ? "btn-primary" : ""}
                    data-testid="practice-go"
                  >
                    {t("Go")}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {team && team.length > 0 && (
        <section className="card grid" style={{ gap: 10 }} data-testid="practice-team">
          <h2 className="dash-h" style={{ margin: 0 }}>
            {t("Your team's practice")}
          </h2>
          <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
            {t("Each person's tasks done in practice. Ready: every task of their role done.")}
          </p>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>{t("Name")}</th>
                  <th>{t("Role")}</th>
                  <th>{t("Done")}</th>
                  <th>{t("Last practised")}</th>
                </tr>
              </thead>
              <tbody>
                {team.map((p) => (
                  <tr key={p.id} data-testid="practice-member" data-name={p.name}>
                    <td>{p.name}</td>
                    <td className="muted">{p.roles.map((r) => t(roleLabel(r))).join(", ")}</td>
                    <td>
                      {p.tasks > 0 && p.done >= p.tasks ? (
                        <span className="badge ok">{t("Ready")}</span>
                      ) : p.startedAt ? (
                        t("{done} of {n}", { done: p.done, n: p.tasks })
                      ) : (
                        <span className="muted">{t("Not started")}</span>
                      )}
                    </td>
                    <td className="muted">
                      {p.lastDoneAt ? dateTimeIn(profile.timezone, p.lastDoneAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
