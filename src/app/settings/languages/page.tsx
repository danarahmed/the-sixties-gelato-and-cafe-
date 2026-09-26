import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { BUILT_IN_LANGUAGES } from "@/lib/i18n/core";
import { catalogue } from "@/lib/i18n/catalogue";
import { getLanguageSettings, getOwnWords } from "@/lib/db/languages";
import { LanguagesManager, type LanguageRow } from "@/components/settings/LanguagesManager";

export const dynamic = "force-dynamic";

/**
 * Settings → Languages (0032): the café's languages, a language added, and
 * any phrase given the café's own words — a whole language, or a better word
 * for the built-in Arabic or Kurdish.
 */
export default async function LanguagesPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  await requirePermission("settings.manage");
  const t = await getT();
  const sp = await searchParams;
  const settings = await getLanguageSettings();

  const languages: LanguageRow[] = [
    ...BUILT_IN_LANGUAGES.map((l) => ({
      code: l.code,
      name: l.label,
      dir: l.dir,
      builtIn: true,
      isActive: true,
      ownWords: settings.ownWords[l.code] ?? 0,
    })),
    ...settings.languages.map((l) => ({
      code: l.code,
      name: l.name,
      dir: l.dir,
      builtIn: false,
      isActive: l.isActive,
      ownWords: settings.ownWords[l.code] ?? 0,
    })),
  ];
  // Words are given in a language in use: a built-in one, or one the café added.
  const editable = languages.filter((l) => l.isActive);
  const asked = Array.isArray(sp.lang) ? sp.lang[0] : sp.lang;
  const editing =
    editable.find((l) => l.code === asked) ??
    editable.find((l) => !l.builtIn) ??
    editable.find((l) => l.code === "ar")!;
  const [own] = await Promise.all([getOwnWords(editing.code)]);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div>
        <div className="muted" style={{ fontSize: ".85rem" }}>
          <Link href="/settings">{t("nav.settings")}</Link>
        </div>
        <h1 style={{ margin: 0 }}>{t("Languages")}</h1>
        <p className="muted" style={{ margin: "6px 0 0", maxWidth: 760 }}>
          {t(
            "Every screen is in English, Arabic and Kurdish. Add another language here, and give any phrase the café's own words: a whole new language, or a better word for the Arabic or Kurdish. A phrase with no words in a language shows its English.",
          )}
        </p>
      </div>
      <LanguagesManager
        languages={languages}
        editing={editing.code}
        entries={catalogue(editing.code)}
        own={own}
      />
    </div>
  );
}
