"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n/I18nProvider";
import { SidePanel } from "@/components/SidePanel";
import { Icon } from "@/components/Icon";

export interface RecipeTile {
  id: string;
  name: string;
  /** "one batch makes 5 L", as the page writes it. */
  makes: ReactNode;
  /** What a batch costs and what a unit of it does; null for those who see no cost. */
  cost: ReactNode | null;
  /** Its cost is not known yet: an ingredient never bought or made. */
  noCost: boolean;
  /** "keeps 3 days"; null when it keeps as long as it lasts. */
  keeps: string | null;
  /** Each ingredient, as "4 L E2E milk". */
  lines: string[];
  active: boolean;
  /** Its panel's body, drawn on the server: the lines, how to make it, the ways to change it. */
  body: ReactNode;
}

/**
 * What you make on Production, as Products & Recipes shows the menu (round
 * thirteen): a tile a recipe — what a batch makes, what it costs, how long it
 * keeps — and a tap opens it beside the list, with its ingredients and the
 * ways to change it. Something new is added in the same panel.
 */
export function RecipeGrid({
  tiles,
  stopped,
  newRecipe,
}: {
  tiles: RecipeTile[];
  /** Those not made any more. */
  stopped: RecipeTile[];
  /** The form to add something you make; null for those who may not. */
  newRecipe: ReactNode | null;
}) {
  const { t } = useT();
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // A link to the form opens it: Getting set up's /production#new-recipe.
  useEffect(() => {
    if (newRecipe && window.location.hash === "#new-recipe") setAdding(true);
  }, [newRecipe]);
  const open = [...tiles, ...stopped].find((r) => r.id === openId) ?? null;

  return (
    <div className="grid" style={{ gap: 12 }}>
      {newRecipe && (
        <div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setAdding(true)}
            data-testid="new-recipe"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Icon name="plus" size={16} /> {t("Add something you make")}
          </button>
        </div>
      )}
      {tiles.length > 0 && (
        <ul className="menu-grid recipe-grid">
          {tiles.map((r) => (
            <Tile key={r.id} r={r} onOpen={() => setOpenId(r.id)} />
          ))}
        </ul>
      )}
      {stopped.length > 0 && (
        <details>
          <summary className="muted">{t("Not made any more ({n})", { n: stopped.length })}</summary>
          <ul className="menu-grid recipe-grid" style={{ marginTop: 10 }}>
            {stopped.map((r) => (
              <Tile key={r.id} r={r} onOpen={() => setOpenId(r.id)} />
            ))}
          </ul>
        </details>
      )}
      {open && (
        <SidePanel
          key={open.id}
          label={open.name}
          testId="recipe-panel"
          wide
          onClose={() => setOpenId(null)}
          head={
            <div>
              <h3 style={{ margin: 0 }}>{open.name}</h3>
              <span className="muted" style={{ fontSize: ".85rem" }}>
                {open.makes}
              </span>
            </div>
          }
        >
          {(open.cost || open.keeps) && (
            <dl className="panel-facts">
              {open.cost && (
                <div>
                  <dt>{t("Cost")}</dt>
                  <dd>{open.cost}</dd>
                </div>
              )}
              {open.keeps && (
                <div>
                  <dt>{t("Keeps")}</dt>
                  <dd data-testid="recipe-keeps">{open.keeps}</dd>
                </div>
              )}
            </dl>
          )}
          {open.body}
        </SidePanel>
      )}
      {adding && newRecipe && (
        <SidePanel
          label={t("Add something you make")}
          testId="new-recipe-panel"
          wide
          onClose={() => {
            setAdding(false);
            if (window.location.hash === "#new-recipe")
              window.history.replaceState(
                window.history.state,
                "",
                window.location.pathname + window.location.search,
              );
          }}
          head={<h3 style={{ margin: 0 }}>{t("Add something you make")}</h3>}
        >
          <div id="new-recipe-form">{newRecipe}</div>
        </SidePanel>
      )}
    </div>
  );
}

/** One recipe, a tile: tapped, it opens the recipe's panel. */
function Tile({ r, onOpen }: { r: RecipeTile; onOpen: () => void }) {
  const { t } = useT();
  return (
    <li
      className={r.active ? "menu-tile recipe-tile" : "menu-tile recipe-tile off"}
      data-testid="recipe-card"
      data-name={r.name}
    >
      <button type="button" onClick={onOpen} aria-label={t("{name}: open", { name: r.name })}>
        <span className="menu-tile-name">{r.name}</span>
        <span className="muted recipe-tile-makes">{r.makes}</span>
        {r.cost && <span className="recipe-tile-cost">{r.cost}</span>}
        <span className="recipe-tile-lines muted">{r.lines.join(" · ")}</span>
        <span className="menu-tile-marks">
          {r.noCost && <span className="badge warn">{t("Cost unknown")}</span>}
          {r.keeps && <span className="badge">{r.keeps}</span>}
        </span>
      </button>
    </li>
  );
}
