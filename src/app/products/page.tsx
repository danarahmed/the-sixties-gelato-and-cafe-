import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export default function Page() {
  return (
    <ModulePlaceholder
      titleKey="nav.products"
      phase="Phase 1"
      done={["item / product / variant / recipe / recipe_version schema","Channel-aware recipe expansion + serving cost (tested)"]}
      planned={["Recipe editor, versioning UI, allergens, images, per-size recipes"]}
    />
  );
}
