"use client";
/**
 * Settings → Ways to pay (0069): the apps and banks the café is paid through
 * besides cash and the card machine. The common ones are added with one
 * press; any other by its name. Each is given an account of its own, where
 * its money stays until it is moved on Sales. One renamed keeps its account;
 * one taken out of use is no longer offered at the till, and can be brought
 * back.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePaymentMethodAction } from "@/lib/actions/paymentMethods";
import { methodsToOffer, type PayMethod } from "@/lib/paymentMethods";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice, inputStyle } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";

type Msg = { ok: boolean; text: string } | null;

export function PaymentMethodsManager({ methods }: { methods: PayMethod[] }) {
  const { t } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const offer = methodsToOffer(methods);

  function save(
    what: string,
    input: { id?: string | null; name: string; active?: boolean | null },
    done: (m: PayMethod) => string,
  ) {
    setMsg(null);
    start(async () => {
      const r = await op.run(what, (key) => savePaymentMethodAction(input, key));
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setMsg({ ok: true, text: done(r.data) });
      setName("");
      setRenaming(null);
      router.refresh();
    });
  }

  const add = (n: string) =>
    save("addMethod", { name: n }, (m) =>
      t("{name} added: the till offers it now.", { name: m.name }),
    );

  return (
    <div className="grid" style={{ gap: 10 }} data-testid="pay-methods">
      <Notice msg={msg} />
      <OperationStatus op={op} />
      {methods.length > 0 && (
        <div className="tw">
          <table className="stack-table">
            <thead>
              <tr>
                <th>{t("Way to pay")}</th>
                <th>{t("Its account")}</th>
                <th>{t("At the till")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {methods.map((m) => (
                <tr key={m.id} data-testid="pay-method-row">
                  <td data-label={t("Way to pay")}>
                    {renaming?.id === m.id ? (
                      <input
                        aria-label={t("New name for {name}", { name: m.name })}
                        style={{ ...inputStyle, maxWidth: 220 }}
                        maxLength={40}
                        value={renaming.name}
                        onChange={(e) => setRenaming({ id: m.id, name: e.target.value })}
                        autoFocus
                      />
                    ) : (
                      <strong dir="auto">{m.name}</strong>
                    )}
                  </td>
                  <td data-label={t("Its account")} className="mono muted">
                    {m.account}
                  </td>
                  <td data-label={t("At the till")}>
                    <span className={`badge ${m.active ? "ok" : ""}`}>
                      {m.active ? t("offered") : t("out of use")}
                    </span>
                  </td>
                  <td className="right" style={{ whiteSpace: "nowrap" }}>
                    {renaming?.id === m.id ? (
                      <>
                        <button
                          className="btn-primary"
                          disabled={busy || renaming.name.trim() === ""}
                          onClick={() =>
                            save("renameMethod", { id: m.id, name: renaming.name }, (x) =>
                              t("Renamed {name}: its account too.", { name: x.name }),
                            )
                          }
                        >
                          {t("Save")}
                        </button>{" "}
                        <button disabled={busy} onClick={() => setRenaming(null)}>
                          {t("Cancel")}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          disabled={busy}
                          onClick={() => setRenaming({ id: m.id, name: m.name })}
                        >
                          {t("Rename")}
                        </button>{" "}
                        <button
                          disabled={busy}
                          data-testid="pay-method-toggle"
                          onClick={() =>
                            save(
                              "toggleMethod",
                              { id: m.id, name: m.name, active: !m.active },
                              (x) =>
                                x.active
                                  ? t("{name} is offered at the till again.", { name: x.name })
                                  : t(
                                      "{name} is out of use: no longer offered at the till. Its account keeps what it holds.",
                                      { name: x.name },
                                    ),
                            )
                          }
                        >
                          {m.active ? t("Take out of use") : t("Bring back")}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {offer.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span className="muted" style={{ fontSize: ".85rem" }}>
            {t("Add with one press:")}
          </span>
          {offer.map((n) => (
            <button
              key={n}
              disabled={busy}
              onClick={() => add(n)}
              data-testid={`pay-method-quick-${n.replace(/\s+/g, "-").toLowerCase()}`}
            >
              + {n}
            </button>
          ))}
        </div>
      )}
      <form
        style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) add(name.trim());
        }}
      >
        <input
          aria-label={t("Another way to pay, by its name")}
          placeholder={t("Another, by its name")}
          style={{ ...inputStyle, maxWidth: 260 }}
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" disabled={busy || name.trim() === ""}>
          {t("Add")}
        </button>
      </form>
    </div>
  );
}
