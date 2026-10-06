import { ShopCode } from "@/components/clock/ShopCode";

export const dynamic = "force-dynamic";

/**
 * The shop's code on the whole screen (0068): for a tablet by the door, or
 * the till between sales. Signed in or not, the device's own key is what
 * lets it see the code.
 */
export default function ClockScreenPage() {
  return (
    <div className="clock-screen-page">
      <ShopCode full />
    </div>
  );
}
