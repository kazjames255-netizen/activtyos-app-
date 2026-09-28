/** Read a question aloud (the browser's own voice; never automatic unless the child turned "read every question" on). */
export function speak(text: string, locale: string) {
  try {
    if (typeof speechSynthesis === "undefined") return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = locale === "en" ? "en-GB" : locale; u.rate = 0.92;
    speechSynthesis.speak(u);
  } catch { /* no speech engine */ }
}
