"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  inviteMemberAction,
  setMemberActiveAction,
  setMemberRolesAction,
} from "@/lib/actions/people";
import { roleLabel } from "@/lib/format";
import { Notice } from "@/components/ui";
import type { MemberRow } from "@/lib/db/reports";

const ROLES = [
  "owner",
  "general_manager",
  "branch_manager",
  "cashier",
  "barista",
  "inventory_counter",
  "purchasing",
  "accountant",
  "auditor",
] as const;
type RoleName = (typeof ROLES)[number];
type Msg = { ok: boolean; text: string } | null;

function RolePicker({
  value,
  onChange,
  isOwner,
}: {
  value: RoleName[];
  onChange: (v: RoleName[]) => void;
  isOwner: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {ROLES.map((r) => {
        const ownerOnly = r === "owner" || r === "general_manager";
        return (
          <label
            key={r}
            style={{
              fontSize: ".8rem",
              display: "flex",
              gap: 4,
              alignItems: "center",
              opacity: ownerOnly && !isOwner ? 0.5 : 1,
            }}
            title={ownerOnly && !isOwner ? "Only the owner can give this role" : undefined}
          >
            <input
              type="checkbox"
              checked={value.includes(r)}
              disabled={ownerOnly && !isOwner}
              onChange={() =>
                onChange(value.includes(r) ? value.filter((x) => x !== r) : [...value, r])
              }
            />
            {roleLabel(r)}
          </label>
        );
      })}
    </div>
  );
}

export function PeopleManager({
  members,
  myId,
  isOwner,
}: {
  members: MemberRow[];
  myId: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roles, setRoles] = useState<RoleName[]>(["cashier"]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editRoles, setEditRoles] = useState<RoleName[]>([]);

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      if (r.ok) {
        setMsg({ ok: true, text: done });
        setEditing(null);
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Roles</th>
              <th>Login</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} style={{ opacity: m.isActive ? 1 : 0.55 }}>
                <td>
                  {m.name}
                  {m.id === myId && <span className="muted"> (you)</span>}
                </td>
                <td dir="ltr" className="muted">
                  {m.email}
                </td>
                <td>
                  {editing === m.id ? (
                    <RolePicker value={editRoles} onChange={setEditRoles} isOwner={isOwner} />
                  ) : (
                    m.roles.map(roleLabel).join(", ")
                  )}
                </td>
                <td>
                  {!m.isActive ? (
                    <span className="badge">deactivated</span>
                  ) : m.linked ? (
                    <span className="badge ok">signed in</span>
                  ) : (
                    <span className="badge warn">invited</span>
                  )}
                </td>
                <td className="right" style={{ whiteSpace: "nowrap" }}>
                  {editing === m.id ? (
                    <>
                      <button
                        className="btn-primary"
                        disabled={busy || editRoles.length === 0}
                        onClick={() =>
                          run(
                            () => setMemberRolesAction({ memberId: m.id, roles: editRoles }),
                            `Roles changed for ${m.name}.`,
                          )
                        }
                        style={{ minHeight: 28, fontSize: ".75rem" }}
                      >
                        Save
                      </button>{" "}
                      <button
                        onClick={() => setEditing(null)}
                        style={{ minHeight: 28, fontSize: ".75rem" }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditing(m.id);
                          setEditRoles(
                            m.roles.filter((r): r is RoleName =>
                              (ROLES as readonly string[]).includes(r),
                            ),
                          );
                        }}
                        disabled={busy}
                        style={{ minHeight: 28, fontSize: ".75rem" }}
                      >
                        Roles
                      </button>{" "}
                      {m.id !== myId && (
                        <button
                          onClick={() =>
                            run(
                              () => setMemberActiveAction({ memberId: m.id, active: !m.isActive }),
                              m.isActive
                                ? `${m.name} can no longer sign in to the books.`
                                : `${m.name} is active again.`,
                            )
                          }
                          disabled={busy}
                          style={{ minHeight: 28, fontSize: ".75rem" }}
                        >
                          {m.isActive ? "Deactivate" : "Reactivate"}
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        style={{ borderBlockStart: "1px solid var(--border)", paddingBlockStart: 12 }}
        className="grid"
      >
        <strong style={{ fontSize: ".9rem" }}>Add a person</strong>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ minWidth: 180 }}>
            <div className="sc">Name</div>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label style={{ minWidth: 220 }}>
            <div className="sc">Email</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              dir="ltr"
            />
          </label>
        </div>
        <RolePicker value={roles} onChange={setRoles} isOwner={isOwner} />
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            className="btn-primary"
            disabled={busy || !email.trim() || !name.trim() || roles.length === 0}
            onClick={() =>
              run(async () => {
                const r = await inviteMemberAction({ email, name, roles });
                if (r.ok) {
                  setEmail("");
                  setName("");
                  setRoles(["cashier"]);
                }
                return r;
              }, `Added. Ask them to create their login with ${email.trim().toLowerCase()}.`)
            }
          >
            {busy ? "…" : "Add person"}
          </button>
        </div>
      </div>
      <Notice msg={msg} />
    </div>
  );
}
