import { Composition } from "remotion";
import { DAILY_FRAMES, DailyVideo } from "./DailyVideo";

export const Root = () => (
  <>
    <Composition
      id="DailyVideo"
      component={DailyVideo}
      durationInFrames={DAILY_FRAMES}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        hook: "Lá bài hôm nay: Ngôi Sao",
        lines: ["Hy vọng nhỏ cũng là hy vọng.", "Từ khoá: hy vọng · chữa lành · bình yên", "Hôm nay bạn đang cần điều gì?"],
        artUrl: "https://dailydraw.app/api/card-art/rws/star",
      }}
    />
  </>
);
