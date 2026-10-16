import { loadFont } from "@remotion/google-fonts/PlayfairDisplay";
import { AbsoluteFill, Easing, Img, interpolate, random, staticFile, useCurrentFrame } from "remotion";

// The site's dark palette (app/globals.css), written out: a video can not read CSS variables.
const INK = "#0c0a08";
const BONE = "#e8e0cd";
const GOLD = "#c79a3f";
const { fontFamily: SERIF } = loadFont("normal", { subsets: ["vietnamese", "latin"], weights: ["400"] });

export const DAILY_FRAMES = 660;
export type DailyProps = { hook: string; lines: string[]; artUrl: string | null };

const SAFE_TOP = 270;
// The block (card, caption, call to action) spans 290..1490; this lowers it so its middle sits on the frame's 960.
const BLOCK_SHIFT = 70;
const CARD_W = 500;
const CARD_H = 878; // 300:527, the art's own ratio
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.inOut(Easing.cubic);

const STARS = Array.from({ length: 50 }, (_, i) => ({
  x: random(`dx${i}`) * 1080,
  y: random(`dy${i}`) * 1920,
  size: 3 + random(`ds${i}`) * 5,
  phase: random(`dp${i}`) * Math.PI * 2,
}));

/** One line of text: fades in at `at`, and out at `until` when given. */
const Line = ({ at, until, children, size = 64, color = BONE }: { at: number; until?: number; children: string; size?: number; color?: string }) => {
  const frame = useCurrentFrame();
  const inn = interpolate(frame, [at, at + 16], [0, 1], clamp);
  const out = until === undefined ? 1 : interpolate(frame, [until, until + 12], [1, 0], clamp);
  const y = interpolate(frame, [at, at + 16], [24, 0], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 1290 + BLOCK_SHIFT,
        opacity: inn * out,
        transform: `translateY(${y}px)`,
        fontFamily: SERIF,
        fontSize: size,
        color,
        textAlign: "center",
        lineHeight: 1.3,
        padding: "0 70px",
        textWrap: "balance",
      }}
    >
      {children}
    </div>
  );
};

export const DailyVideo = ({ hook, lines, artUrl }: DailyProps) => {
  const frame = useCurrentFrame();

  // The back turns edge-on, then the art turns in from the other side.
  const backTurn = interpolate(frame, [40, 70], [0, 90], { ...clamp, easing: ease });
  const artTurn = interpolate(frame, [70, 100], [-90, 0], { ...clamp, easing: ease });
  const showArt = artUrl !== null && frame >= 70;
  const float = Math.sin(frame / 40) * 8;

  const cardStyle = {
    position: "absolute" as const,
    left: (1080 - CARD_W) / 2,
    top: SAFE_TOP + 20 + BLOCK_SHIFT + float,
    width: CARD_W,
    height: CARD_H,
    borderRadius: 18,
    boxShadow: `0 0 60px ${GOLD}55`,
  };

  return (
    <AbsoluteFill style={{ background: INK, perspective: 1600 }}>
      {STARS.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: s.x,
            top: s.y,
            width: s.size,
            height: s.size,
            borderRadius: "50%",
            background: GOLD,
            opacity: 0.25 + 0.35 * Math.abs(Math.sin(frame / 25 + s.phase)),
          }}
        />
      ))}

      {!showArt ? (
        <Img src={staticFile("back.webp")} style={{ ...cardStyle, transform: `rotateY(${artUrl ? backTurn : 0}deg)` }} />
      ) : (
        <Img src={artUrl as string} style={{ ...cardStyle, transform: `rotateY(${artTurn}deg)` }} />
      )}

      <Line at={4} until={88} size={72} color={GOLD}>{hook}</Line>
      <Line at={100} until={226}>{lines[0] ?? ""}</Line>
      <Line at={232} until={352}>{lines[1] ?? ""}</Line>
      <Line at={358} until={478}>{lines[2] ?? ""}</Line>
      <Line at={484} size={72} color={GOLD}>dailydraw.app</Line>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 1420 + BLOCK_SHIFT,
          opacity: interpolate(frame, [500, 516], [0, 1], clamp),
          fontFamily: SERIF,
          fontSize: 56,
          color: BONE,
          textAlign: "center",
        }}
      >
        Rút lá miễn phí
      </div>
    </AbsoluteFill>
  );
};
