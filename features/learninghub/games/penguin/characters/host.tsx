"use client";
// The host character as it appears in the game's screens (home, coach, summary). Swappable with the world drawing in ./penguin.ts: when the platform mascot
// becomes a cast (fox, otter, hedgehog, ...), this one component maps a pose to whichever character is chosen. The game itself never names an animal.
// Junior shows the platform mascot (round, bright, cheerful). Explorer shows the SAME penguin drawn as an expedition penguin: leaner, steady eyes, hood, goggles and pack, standing rather than bouncing.
import { createContext, useContext, useEffect, useRef } from "react";
import { Mascot, MASCOT_NAME, type MascotPose } from "../../../mascot";
import { penguinCharacter } from "./penguin";
import { THEME } from "../theme";

export type HostPose = "wave" | "celebrate" | "cheer" | "encourage" | "think" | "point" | "read" | "sleep" | "dance";
export const HOST_NAME = MASCOT_NAME;
export const HostSkin = createContext<"junior" | "explorer">("junior");
function ExplorerHost({ pose, size, label }: { pose: HostPose; size: number; label?: string }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = cv.current; if (!c) return; const ctx = c.getContext("2d"); if (!ctx) return; const d = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(size * d); c.height = Math.round(size * d); ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, size, size);
    const up = pose === "celebrate" || pose === "cheer" || pose === "dance" || pose === "wave"; const tilt = pose === "encourage" ? -0.06 : pose === "think" ? 0.05 : 0;
    penguinCharacter.draw(ctx, THEME.palette, size * 0.5, size * 0.96, size * 0.9, { tilt, sx: 1, sy: 1, face: pose !== "sleep", eyes: pose === "celebrate" ? "happy" : "open", blink: pose === "sleep" ? 1 : 0, t: 0, cosmetics: [], wing: up ? 0.55 : pose === "point" ? 0.3 : 0.06, still: true, skin: "explorer" });
  }, [pose, size]);
  return <canvas ref={cv} width={size} height={size} style={{ width: size, height: size, display: "block" }} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} data-host="explorer" />;
}
export function HostAvatar({ pose, size = 110, still, label }: { pose: HostPose; size?: number; still?: boolean; label?: string }) {
  const skin = useContext(HostSkin);
  if (skin === "explorer") return <ExplorerHost pose={pose} size={size} label={label} />;
  return <Mascot pose={pose as MascotPose} size={size} still={still} decorative={!label} label={label} ground={false} />;
}
