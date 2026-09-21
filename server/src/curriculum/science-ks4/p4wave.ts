// GCSE Physics — Waves (Year 11).
import type { CTopic } from "../types";
import { N, S, W, yr } from "./_h";
import { WAVE } from "./_imgdata";

const IMG = ["p4wave-wave.png", "A graph of a transverse wave. Displacement in centimetres is on the vertical axis from −4 to 4 and distance in centimetres is on the horizontal axis from 0 to 20. The wave starts at zero, rises to a crest of 3 centimetres at 2 centimetres along, and then repeats with crests at 10 centimetres and 18 centimetres."] as [string, string];
const crests = () => { const out: number[] = []; for (let x = 0; x <= WAVE.len; x += 0.5) { if (Math.abs(WAVE.amp * Math.sin((2 * Math.PI * x) / WAVE.lambda) - WAVE.amp) < 1e-9) out.push(x); } return out; };

export const TOPIC: CTopic = {
  key: "p4wave", topic: "Physics — Waves", subject: "Science",
  years: {
    11: yr("p4wave", 11, {
      obj: [
        "Describe transverse and longitudinal waves; define amplitude, wavelength, frequency and period.",
        "Use v = f λ and T = 1 ÷ f; describe the required practical to measure wave speed in a ripple tank or solid.",
        "Describe reflection, refraction and absorption; draw ray diagrams (including refraction at a boundary).",
        "Describe the electromagnetic spectrum, its uses and hazards.",
        "Describe sound waves and ultrasound; use speed of sound in calculations.",
        "Triple stretch: seismic waves, lenses and black-body radiation.",
      ],
      note: ["GCSE Physics: waves and the electromagnetic spectrum", `## Wave properties
Waves transfer **energy** (not matter). In **transverse** waves (light, water ripples) the oscillation is at right angles to the direction of travel; in **longitudinal** waves (sound) the oscillation is parallel, with **compressions** and **rarefactions**.
- **Amplitude**: maximum displacement from the rest position.
- **Wavelength (λ)**: distance between two matching points on neighbouring waves.
- **Frequency (f)**: number of waves per second (hertz).
- **Period (T)**: time for one wave.

| Quantity | Equation |
| --- | --- |
| Wave speed | v = f λ |
| Period | T = 1 ÷ f |

## Electromagnetic spectrum
All EM waves are transverse and travel at 3.0 × 10⁸ m/s in a vacuum. In order of **increasing frequency**: radio, microwaves, infrared, visible, ultraviolet, X-rays, gamma rays. UV can age the skin and cause skin cancer; X-rays and gamma rays are ionising and can cause mutations and cancer, so exposure is kept to a minimum.

## Refraction
When a wave enters a different medium its speed and wavelength change. Light entering a denser medium (glass) **slows down** and bends **towards the normal**; leaving it bends away.

## Worked examples
- f = 5.0 Hz and λ = 0.60 m: v = 5.0 × 0.60 = **3.0 m/s**.
- f = 4.0 Hz: T = 1 ÷ 4.0 = **0.25 s**.
- Echo: sound travels to the wall and back, so distance = speed × time ÷ 2.

**Working scientifically (ripple tank):** measure the distance across several waves and divide to reduce uncertainty, and use a strobe or video to find the frequency.`],
      quiz: "GCSE Physics: Waves quiz",
      qs: [
        S(1, "What do waves transfer from one place to another?", "Energy", ["Matter", "Mass", "Particles of the medium"], "Waves transfer energy without transferring matter. The particles of the medium only oscillate about fixed positions.", {}),
        S(1, "Which electromagnetic wave has the highest frequency?", "Gamma rays", ["Radio waves", "Microwaves", "Visible light"], "Gamma rays have the highest frequency and shortest wavelength in the electromagnetic spectrum.", {}),
        S(1, "What is the unit of frequency?", "Hertz", ["Metre", "Second", "Watt"], "Frequency is the number of waves per second, measured in hertz (Hz).", {}),
        N(2, "Use the graph. What is the wavelength of the wave, in cm?", 8, 0.3, "Wavelength is the distance between neighbouring crests: 10 − 2 = 8 cm.", () => { const c = crests(); return c[1] - c[0]; }, { img: IMG }),
        N(2, "Use the graph. What is the amplitude of the wave, in cm?", 3, 0.1, "Amplitude is the maximum displacement from the rest position (zero): 3 cm.", () => WAVE.amp, { img: IMG }),
        N(2, "The wave in the graph has a frequency of 3.0 Hz. Calculate its speed in cm/s.", 24, 0.5, "v = f × λ = 3.0 × 8 = 24 cm/s.", () => 3.0 * WAVE.lambda, { img: IMG, diag: true }),
        N(2, "A wave has a frequency of 50 Hz. Calculate its period in seconds.", 0.02, 0.0005, "Period = 1 ÷ frequency = 1 ÷ 50 = 0.02 s.", () => 1 / 50),
        S(2, "Which describes a sound wave in air?", "A longitudinal wave with compressions and rarefactions", ["A transverse wave with crests and troughs", "An electromagnetic wave that travels at the speed of light", "A wave that can travel through a vacuum, like light does"], "Sound is a longitudinal wave: air particles oscillate parallel to the direction the wave travels. It cannot travel through a vacuum.", {}),
        N(2, "A person hears an echo 0.50 s after shouting towards a cliff. The speed of sound in air is 340 m/s. Calculate the distance to the cliff in metres.", 85, 0.5, "The sound travels there and back in 0.50 s: total distance = 340 × 0.50 = 170 m. The cliff is half that: 85 m.", () => (340 * 0.5) / 2),
        S(2, "What happens when a ray of light passes from air into glass at an angle?", "It slows down and bends towards the normal", ["It speeds up and bends away from the normal", "It slows down and bends away from the normal", "It does not change direction"], "Light travels more slowly in glass. The change in speed causes refraction, and the ray bends towards the normal.", { diag: true }),
        N(3, "A radio wave has a frequency of 1.5 × 10⁸ Hz and travels at 3.0 × 10⁸ m/s. Calculate its wavelength in metres.", 2, 0.02, "λ = v ÷ f = 3.0 × 10⁸ ÷ 1.5 × 10⁸ = 2.0 m.", () => 3.0e8 / 1.5e8),
        S(3, "How does an ultrasound scan use waves to show the inside of the body?", "Waves are partly reflected at boundaries between tissues, and the time delay of the echoes gives their depth", ["Waves are absorbed by all tissues equally, and the amount of energy absorbed is measured to show their depth", "Ultrasound waves are ionising, so they darken a photographic plate placed behind the body to leave an image", "Waves pass straight through the body and produce a shadow image on a detector on the other side"], "Ultrasound reflects at boundaries between different tissues. The echo times show how far away each boundary is, and a computer builds an image.", {}),
        W("Describe how you would measure the speed of water waves in a ripple tank. [6 marks]", "Mark scheme (6): use a ripple generator to produce waves of constant frequency (1); use a strobe light (or video) to make the waves appear stationary and find the frequency (1); measure the distance across several wavelengths using a ruler placed by the tank (1); divide the distance by the number of waves to find the wavelength (1); calculate wave speed using v = f λ (1); repeat and find a mean; wavelength measured over several waves reduces uncertainty (1)."),
      ],
      cards: [
        ["Transverse vs longitudinal", "Transverse: oscillation at right angles to travel. Longitudinal: parallel, with compressions and rarefactions."],
        ["Wave speed equation", "v = f λ."],
        ["Period equation", "T = 1 ÷ f."],
        ["Amplitude", "Maximum displacement from the rest position."],
        ["Wavelength", "Distance between two identical points on neighbouring waves."],
        ["EM spectrum in order", "Radio, microwave, infrared, visible, ultraviolet, X-ray, gamma."],
        ["Speed of EM waves in a vacuum", "3.0 × 10⁸ m/s."],
        ["Speed of sound in air", "About 340 m/s."],
        ["Refraction into a denser medium", "Wave slows, bends towards the normal."],
        ["Hazards of UV, X-rays and gamma rays", "UV: skin ageing and skin cancer. X-rays and gamma: ionising, can cause mutations and cancer."],
        ["Ultrasound use", "Body scans and cleaning: waves above 20 000 Hz."],
        ["Range of human hearing", "About 20 Hz to 20 000 Hz."],
      ],
    }),
  },
};
