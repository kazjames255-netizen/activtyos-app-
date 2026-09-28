// English chrome text of the How it works player / sheet / page. Other locales live in ./<locale>.json under "ui" (same keys, same {placeholders}).
// The English strings here are the source of truth and must stay byte-identical to what the components showed before translation.
export const EN_UI: Record<string, string> = {
  eyebrow: "{hub} · How it works", hubTeaching: "Teaching Hub", hubLearning: "Learning Hub",
  pickShort: "Pick a short video.", pickShortLong: "Pick a short video. Each one takes a few minutes.",
  whoWatching: "Who is watching", allVideos: "All videos", allVideosPlay: "▶ All videos", fullTour: "▶ The full tour", nextTopic: "▶ Next: {title}",
  chooseVideo: "Choose a video", loading: "Loading…", sheetTitle: "How it works", whichVideo: "Which video", close: "Close",
  minScenes: "{m} min · {n} scenes", watched: " · Watched",
  stageAria: "{script} — scene {i} of {n}: {title}", sceneLive: "Scene {i} of {n}: {title}", playAria: "Play: {title}",
  soundOnCaps: "Sound is on. Captions are always shown below.", capsBelow: "Captions are shown below.", startsAt: "Starts at “{title}”.",
  thatsTheLot: "That's the lot", watchAgain: "↺ Watch again", captions: "Captions", controls: "Player controls", scenesJump: "Scenes — jump to one",
  sceneN: "Scene {k}: {title}", prev: "Previous scene", prevT: "Previous scene (←)", pause: "Pause", play: "Play", replay: "Replay", pauseT: "Pause (space)", playT: "Play (space)",
  restart: "Restart from the beginning", restartT: "Restart (R)", next: "Next scene", nextT: "Next scene (→)", captionsT: "Captions (C)",
  captionsOn: "Captions on", captionsOff: "Captions off", soundT: "Sound (M)", soundOn: "Sound on", soundOff: "Sound off", musicT: "Background music",
  musicOn: "Music on", musicOff: "Music off", speed: "Speed", voice: "Voice", autoVoice: "Auto voice", scenes: "Scenes", readScript: "Read the whole script",
  tryNow: "Try it now →", nextVideo: "Next video: {title}",
  noVoice: "No voice for this language on this device: captions only.",
};
