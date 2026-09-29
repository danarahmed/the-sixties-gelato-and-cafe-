"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/I18nProvider";
import type { DocumentKind } from "@/lib/documents";

/**
 * The way from a record in a list to the documents kept with it: 📎 and how
 * many there are. Left out when printed.
 */
export function DocumentsLink({
  kind,
  id,
  count,
}: {
  kind: DocumentKind;
  id: string;
  count: number;
}) {
  const { t } = useT();
  const label = count
    ? t("Documents kept with it: {n}", { n: count })
    : t("No documents kept with it yet");
  return (
    <Link
      href={`/documents/${kind}/${id}`}
      className={`doclink no-print${count ? "" : " none"}`}
      title={label}
      aria-label={label}
      data-testid="documents-link"
      data-count={count}
    >
      📎{count ? <span className="n">{count}</span> : null}
    </Link>
  );
}
