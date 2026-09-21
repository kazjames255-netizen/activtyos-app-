// A-level Chemistry — Equilibria (Year 12 Le Chatelier & Kc; Year 13 Kp, acids and bases, pH, buffers). Original content aligned to the DfE GCE AS/A-level chemistry subject content.
// Keys are recomputed by _chk_c5eq.ts — re-run _check_s6.ts after ANY edit here.
import type { CTopic } from "../types";
import { img, qb } from "./_h";

const q12 = qb("c5eq", 12);
const q13 = qb("c5eq", 13);
export const TOPIC: CTopic = {
  key: "c5eq",
  topic: "Chemistry — Equilibria",
  subject: "Science",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12 (AS)",
      objectives: [
        "Dynamic equilibrium and Le Chatelier's principle: effect of concentration, pressure, temperature and catalysts.",
        "The equilibrium constant Kc: expressions, calculations from equilibrium amounts, units.",
        "Effect of conditions on Kc; compromise conditions in industrial processes (e.g. the Haber process).",
      ],
      note: {
        title: "Dynamic equilibrium, Le Chatelier's principle and Kc",
        body: `## Dynamic equilibrium

In a closed system a reversible reaction reaches **dynamic equilibrium** when the forward and reverse rates are equal. Concentrations stay constant, but both reactions still go on.

**Le Chatelier's principle:** if a change is made to a system at equilibrium, the position shifts to oppose the change.

| Change | Position shifts | Kc changes? |
| --- | --- | --- |
| Increase a reactant concentration | Right (away from added species) | No |
| Increase pressure | To the side with fewer moles of gas | No |
| Increase temperature | Towards the endothermic direction | **Yes** |
| Add a catalyst | No shift; equilibrium reached faster | No |

Only a **change of temperature** changes the value of Kc.

## The equilibrium constant Kc

For aA + bB ⇌ cC + dD:  **Kc = [C]ᶜ[D]ᵈ ÷ ([A]ᵃ[B]ᵇ)**, with concentrations in mol dm⁻³ at equilibrium. Work out the units by substituting the units into the expression. If moles of reactants and products are equal (e.g. H₂ + I₂ ⇌ 2HI), the volume cancels and Kc has no units.

Industrial compromise: the Haber process is exothermic, so a low temperature gives a better yield, but the rate is too slow. About 450 °C, high pressure and an iron catalyst are a compromise between yield, rate and cost.

## Worked example

For 2NO + O₂ ⇌ 2NO₂ the equilibrium concentrations are [NO] = 0.10, [O₂] = 0.20 and [NO₂] = 0.30 mol dm⁻³.

Kc = [NO₂]² ÷ ([NO]²[O₂]) = 0.30² ÷ (0.10² × 0.20) = 0.090 ÷ 0.0020 = **45 dm³ mol⁻¹**

If the amounts are in moles, first divide by the volume: 0.90 mol in 3.0 dm³ is 0.30 mol dm⁻³.`,
      },
      quiz: {
        title: "Equilibria: Year 12 quiz",
        questions: [
          q12.single(1, "What does 'dynamic equilibrium' mean?", "The forward and reverse reactions continue at equal rates, so concentrations stay constant",
            ["The reaction has stopped", "The concentrations of the reactants and the products have become equal to each other, so there is no further change", "Only the forward reaction is occurring"],
            "At dynamic equilibrium in a closed system both reactions still happen, at equal rates. Concentrations are constant but not necessarily equal."),
          q12.single(1, "For N₂(g) + 3H₂(g) ⇌ 2NH₃(g), what is the effect of increasing the pressure at constant temperature?", "The equilibrium moves to the right, giving a higher yield of ammonia",
            ["The equilibrium moves to the left, giving a lower yield of ammonia", "There is no effect on the position because the temperature is unchanged", "The value of Kc increases, so more ammonia is present"],
            "There are 4 moles of gas on the left and 2 on the right. Higher pressure favours the side with fewer gas moles. Kc is unchanged by pressure."),
          q12.single(2, "The forward reaction in N₂ + 3H₂ ⇌ 2NH₃ is exothermic. What happens when the temperature is raised (with the system re-established at equilibrium)?", "The yield of ammonia decreases and Kc decreases",
            ["The yield of ammonia increases and Kc increases", "The yield of ammonia decreases but Kc is unchanged", "The yield is unchanged but the rate increases"],
            "Raising the temperature favours the endothermic (reverse) direction. This shifts the position left and changes Kc, which is the only change that alters Kc."),
          q12.single(1, "What effect does adding a catalyst have on an equilibrium mixture?", "It has no effect on the position of equilibrium, but equilibrium is reached faster",
            ["It shifts the equilibrium to the right", "It increases the value of Kc", "It speeds up only the forward reaction, so more product is formed before the reverse reaction can catch up"],
            "A catalyst speeds up the forward and reverse reactions equally, so the composition at equilibrium and Kc are unchanged."),
          q12.num(2, "For N₂O₄(g) ⇌ 2NO₂(g), the equilibrium concentrations are [N₂O₄] = 0.0400 mol dm⁻³ and [NO₂] = 0.0120 mol dm⁻³. Calculate Kc in mol dm⁻³ to 2 significant figures.", 0.0036, 0.0001,
            "Kc = [NO₂]² ÷ [N₂O₄] = (0.0120)² ÷ 0.0400 = 1.44 × 10⁻⁴ ÷ 0.0400 = 3.6 × 10⁻³ mol dm⁻³.", { diag: true }),
          q12.single(2, "What are the units of Kc for H₂(g) + I₂(g) ⇌ 2HI(g)?", "There are no units", ["mol dm⁻³", "mol⁻¹ dm³", "mol² dm⁻⁶"],
            "Kc = [HI]² ÷ ([H₂][I₂]). The units are (mol dm⁻³)² ÷ (mol dm⁻³)², which cancel."),
          q12.num(3, "1.00 mol of H₂ and 1.00 mol of I₂ react in a sealed vessel: H₂ + I₂ ⇌ 2HI. At equilibrium the mixture contains 1.60 mol of HI. Calculate Kc.", 64, 1,
            "1.60 mol HI means 0.80 mol each of H₂ and I₂ reacted, leaving 0.20 mol of each. The volume cancels, so Kc = 1.60² ÷ (0.20 × 0.20) = 2.56 ÷ 0.040 = 64."),
          q12.num(2, "For 2SO₂(g) + O₂(g) ⇌ 2SO₃(g), the equilibrium concentrations are [SO₂] = 0.20, [O₂] = 0.10 and [SO₃] = 0.40 mol dm⁻³. Calculate Kc in dm³ mol⁻¹.", 40, 0.5,
            "Kc = [SO₃]² ÷ ([SO₂]²[O₂]) = 0.16 ÷ (0.040 × 0.10) = 0.16 ÷ 0.0040 = 40 dm³ mol⁻¹.", { diag: true }),
          q12.single(2, "Which change alters the numerical value of Kc for a given equilibrium?", "A change in temperature",
            ["A change in pressure", "Adding a catalyst", "Adding more of a reactant"],
            "Kc is a constant at a given temperature. Concentration, pressure and catalysts can change the position or the speed but not the value of Kc."),
          q12.single(2, "The Haber process is exothermic, yet it is run at about 450 °C. Why?", "A lower temperature would give a higher yield but the rate would be too slow, so 450 °C is a compromise",
            ["A higher temperature increases the equilibrium yield of ammonia because the forward reaction is endothermic, so 450 °C is simply the ideal value", "The catalyst only works above 450 °C", "The reaction is endothermic at low temperature"],
            "Low temperature favours the exothermic forward direction but is slow. 450 °C with a catalyst gives an acceptable rate and reasonable yield."),
          q12.single(3, "H₂ + I₂ ⇌ 2HI has Kc = 64 at a certain temperature. A mixture has [H₂] = 0.10, [I₂] = 0.10 and [HI] = 0.50 mol dm⁻³. What happens next?", "Net reaction to the right, because [HI]² ÷ ([H₂][I₂]) = 25, which is less than Kc",
            ["Net reaction to the left, because the ratio is greater than Kc", "Nothing, because the mixture is at equilibrium", "Net reaction to the left, because [HI] is greater than [H₂]"],
            "The value of the expression for this mixture is 0.50² ÷ (0.10 × 0.10) = 25, below 64. To reach 64, HI must increase, so the reaction proceeds to the right."),
          q12.single(2, "The equilibrium 2NO₂(g) ⇌ N₂O₄(g) has ΔH = −57 kJ mol⁻¹. NO₂ is brown and N₂O₄ is colourless. What is seen when a sealed tube of the mixture is heated?", "The mixture gets darker brown",
            ["The mixture gets paler", "There is no change in colour", "The mixture turns colourless"],
            "Heating favours the endothermic (reverse) direction, which makes more brown NO₂."),
          q12.short(1, "Name the principle that predicts how an equilibrium responds to a change in conditions.", "Le Chatelier's principle", ["Le Chatelier", "Le Chateliers principle", "le chatelier's principle", "Le Châtelier's principle", "Le Châtelier", "Le Chatelier’s principle", "Le Châtelier’s principle", "Le Chatelier principle", "Le Châtelier principle", "Le Chateliers", "Le Chatelier's", "Le Chatelier’s", "Le Châteliers principle", "Chatelier's principle", "Le Chatelier's Principle", "the Le Chatelier principle"],
            "Le Chatelier's principle says the equilibrium position moves to oppose the change that has been made."),
          q12.num(3, "1.00 mol of N₂ and 3.00 mol of H₂ are sealed in a 2.00 dm³ vessel. At equilibrium 0.40 mol of NH₃ is present (N₂ + 3H₂ ⇌ 2NH₃). Calculate Kc in dm⁶ mol⁻² to 3 significant figures.", 0.0579, 0.0005,
            "0.40 mol NH₃ needs 0.20 mol N₂ and 0.60 mol H₂, leaving 0.80 and 2.40 mol. Concentrations (÷ 2.00 dm³): 0.40, 1.20, 0.20. Kc = 0.20² ÷ (0.40 × 1.20³) = 0.040 ÷ 0.6912 = 0.0579 dm⁶ mol⁻²."),
        ],
      },
      flashcards: [
        { front: "Dynamic equilibrium", back: "Forward and reverse reactions occur at equal rates in a closed system, so concentrations are constant." },
        { front: "Le Chatelier's principle", back: "The position of equilibrium shifts to oppose any change imposed on it." },
        { front: "Effect of pressure on equilibrium position", back: "Increase in pressure favours the side with fewer moles of gas." },
        { front: "Effect of temperature on equilibrium", back: "Raising T favours the endothermic direction; Kc changes." },
        { front: "Effect of a catalyst on equilibrium", back: "None on position or Kc; equilibrium is reached faster." },
        { front: "Kc expression for aA + bB ⇌ cC + dD", back: "Kc = [C]ᶜ[D]ᵈ ÷ ([A]ᵃ[B]ᵇ), equilibrium concentrations." },
        { front: "Which change alters Kc?", back: "Temperature only." },
        { front: "How to get the units of Kc", back: "Substitute mol dm⁻³ into the expression and simplify." },
        { front: "Kc for a reaction where moles of reactants = moles of products", back: "No units (volume cancels)." },
        { front: "Haber process conditions", back: "About 450 °C, 200 atm, iron catalyst: a compromise between yield, rate and cost." },
      ],
    },
    13: {
      year: 13,
      subtopic: "A-level Year 13 (A2)",
      objectives: [
        "Kp and partial pressures; mole fractions.",
        "Brønsted–Lowry acids and bases, conjugate pairs; pH of strong acids and bases; Kw.",
        "Weak acids: Ka and pKa, calculating pH and Ka.",
        "pH curves and indicator choice; buffer solutions and buffer pH calculations.",
      ],
      note: {
        title: "Kp, pH, weak acids, buffers and titration curves",
        body: `## Kp and partial pressure

For gases, **partial pressure** = mole fraction × total pressure, where mole fraction = moles of gas ÷ total moles. For aA(g) + bB(g) ⇌ cC(g), **Kp = p(C)ᶜ ÷ (p(A)ᵃ p(B)ᵇ)**.

## Acids, bases and pH

A **Brønsted–Lowry acid** donates H⁺; a base accepts H⁺. **pH = −log₁₀[H⁺]**, so [H⁺] = 10^(−pH). Kw = [H⁺][OH⁻] = 1.00 × 10⁻¹⁴ mol² dm⁻⁶ at 298 K.

- **Strong acid** (fully ionised): [H⁺] = concentration of acid.
- **Strong base**: [OH⁻] = concentration; [H⁺] = Kw ÷ [OH⁻].
- **Weak acid** HA ⇌ H⁺ + A⁻: Ka = [H⁺][A⁻] ÷ [HA] ≈ [H⁺]² ÷ [HA], so [H⁺] = √(Ka × [HA]). pKa = −log Ka.

## Buffers

A **buffer** resists pH change on adding small amounts of acid or base. It contains a weak acid HA and its conjugate base A⁻ (from a salt). Added H⁺ reacts with A⁻; added OH⁻ reacts with HA. **[H⁺] = Ka × [HA] ÷ [A⁻]**.

## Titration curves

For a weak acid with a strong base, the pH is **pKa at half the equivalence volume**. The pH at equivalence is above 7 (the conjugate base is a weak base), so use an indicator that changes colour in that range. Phenolphthalein (8.2–10.0) suits a weak acid–strong base titration; methyl orange (3.1–4.4) suits a strong acid–weak base titration.

## Worked examples

**pH of a strong acid:** 0.0050 mol dm⁻³ HCl: pH = −log 0.0050 = **2.30**.

**Buffer:** 0.30 mol dm⁻³ propanoic acid (Ka = 1.35 × 10⁻⁵) with 0.15 mol dm⁻³ sodium propanoate: [H⁺] = 1.35 × 10⁻⁵ × 0.30 ÷ 0.15 = 2.70 × 10⁻⁵, pH = **4.57**.`,
      },
      quiz: {
        title: "Equilibria: Year 13 quiz",
        questions: [
          q13.single(1, "In Brønsted–Lowry theory, what is an acid?", "A proton (H⁺) donor", ["A proton acceptor", "An electron pair donor", "A substance that produces OH⁻ ions"],
            "A Brønsted–Lowry acid donates a proton; a base accepts one."),
          q13.num(1, "Calculate the pH of 0.020 mol dm⁻³ hydrochloric acid to 2 decimal places.", 1.70, 0.01,
            "HCl is a strong acid, so [H⁺] = 0.020. pH = −log₁₀(0.020) = 1.70."),
          q13.num(2, "Calculate the pH of 0.050 mol dm⁻³ sodium hydroxide at 298 K (Kw = 1.00 × 10⁻¹⁴ mol² dm⁻⁶) to 2 decimal places.", 12.70, 0.01,
            "NaOH is a strong base, so [OH⁻] = 0.050. [H⁺] = Kw ÷ [OH⁻] = 1.00 × 10⁻¹⁴ ÷ 0.050 = 2.0 × 10⁻¹³, and pH = 12.70."),
          q13.num(2, "Calculate the pH of 0.100 mol dm⁻³ ethanoic acid (Ka = 1.75 × 10⁻⁵ mol dm⁻³) to 2 decimal places.", 2.88, 0.01,
            "[H⁺] = √(Ka × [HA]) = √(1.75 × 10⁻⁵ × 0.100) = 1.32 × 10⁻³ mol dm⁻³, so pH = 2.88.", { diag: true }),
          q13.num(3, "A 0.200 mol dm⁻³ solution of a weak acid HA has a pH of 2.85. Calculate Ka in mol dm⁻³. (Assume [H⁺] = [A⁻] and that [HA] is approximately 0.200.)", 1.0e-5, 2e-7,
            "[H⁺] = 10^(−2.85) = 1.41 × 10⁻³. Ka = [H⁺]² ÷ [HA] = (1.41 × 10⁻³)² ÷ 0.200 = 2.00 × 10⁻⁶ ÷ 0.200 = 1.0 × 10⁻⁵ mol dm⁻³."),
          q13.single(3, "The graph shows a titration of 25.0 cm³ of 0.100 mol dm⁻³ ethanoic acid with 0.100 mol dm⁻³ sodium hydroxide. Use the pH at half-equivalence to estimate Ka of ethanoic acid.", "1.7 × 10⁻⁵ mol dm⁻³",
            ["4.8 × 10⁻⁵ mol dm⁻³", "1.7 × 10⁻⁹ mol dm⁻³", "5.8 × 10⁻⁶ mol dm⁻³"],
            "The equivalence point is at 25.0 cm³, so half-equivalence is at 12.5 cm³, where pH ≈ 4.76 = pKa. Ka = 10^(−4.76) = 1.7 × 10⁻⁵ mol dm⁻³.",
            { image: img("titration-curve.png", "Titration curve: pH (vertical, 0 to 14) against volume of 0.100 mol dm⁻³ sodium hydroxide added in cm³ (horizontal, 0 to 40) for 25.0 cm³ of 0.100 mol dm⁻³ ethanoic acid. The curve starts near pH 2.9, rises slowly through a buffer region, climbs steeply between about 24 and 26 cm³ and levels off near pH 12.5. Grid lines every 2 pH units and every 5 cm³.") }),
          q13.single(2, "Which indicator is most suitable for the titration of ethanoic acid with sodium hydroxide shown in the graph (the vertical section is centred around pH 8.7)?", "Phenolphthalein (colour change pH 8.2–10.0)",
            ["Methyl orange (colour change pH 3.1–4.4)", "Methyl red (colour change pH 4.4–6.2)", "Bromothymol blue (colour change pH 6.0–7.6)"],
            "The indicator must change colour within the steep part of the curve, which includes the equivalence pH of about 8.7. Only phenolphthalein's range matches.",
            { diag: true, image: img("titration-curve.png", "Titration curve: pH (vertical, 0 to 14) against volume of 0.100 mol dm⁻³ sodium hydroxide added in cm³ (horizontal, 0 to 40) for 25.0 cm³ of 0.100 mol dm⁻³ ethanoic acid. The curve starts near pH 2.9, rises slowly through a buffer region, climbs steeply between about 24 and 26 cm³ and levels off near pH 12.5. Grid lines every 2 pH units and every 5 cm³.") }),
          q13.num(2, "A buffer contains 0.200 mol dm⁻³ ethanoic acid and 0.100 mol dm⁻³ sodium ethanoate. Ka = 1.75 × 10⁻⁵ mol dm⁻³. Calculate the pH to 2 decimal places.", 4.46, 0.01,
            "[H⁺] = Ka × [HA] ÷ [A⁻] = 1.75 × 10⁻⁵ × 0.200 ÷ 0.100 = 3.50 × 10⁻⁵ mol dm⁻³. pH = 4.46."),
          q13.single(2, "How does an ethanoic acid / sodium ethanoate buffer respond when a small amount of acid is added?", "Ethanoate ions react with the added H⁺ to form ethanoic acid",
            ["Ethanoic acid reacts with the added H⁺ to form ethanoate ions", "The added H⁺ reacts with Na⁺ ions", "The ethanoic acid ionises more and the pH falls sharply"],
            "The high concentration of A⁻ removes added H⁺ by A⁻ + H⁺ → HA, so [H⁺] and pH barely change."),
          q13.num(2, "For N₂O₄(g) ⇌ 2NO₂(g), the equilibrium partial pressures are p(N₂O₄) = 60 kPa and p(NO₂) = 40 kPa. Calculate Kp in kPa to 3 significant figures.", 26.7, 0.1,
            "Kp = p(NO₂)² ÷ p(N₂O₄) = 40² ÷ 60 = 1600 ÷ 60 = 26.7 kPa."),
          q13.num(3, "At equilibrium a mixture contains 0.20 mol N₂, 0.60 mol H₂ and 0.40 mol NH₃ at a total pressure of 200 kPa (N₂ + 3H₂ ⇌ 2NH₃). Calculate Kp in kPa⁻². Give your answer as a number, to 3 significant figures.", 0.000133, 0.000003,
            "Total moles = 1.20. Partial pressures: N₂ 200 × 0.20/1.20 = 33.3 kPa; H₂ 200 × 0.60/1.20 = 100 kPa; NH₃ 200 × 0.40/1.20 = 66.7 kPa. Kp = 66.7² ÷ (33.3 × 100³) = 4444 ÷ 3.33 × 10⁷ = 1.33 × 10⁻⁴ kPa⁻²."),
          q13.single(2, "At 50 °C, pure water has [H⁺] = [OH⁻] = 2.3 × 10⁻⁷ mol dm⁻³ (pH about 6.6). Which statement is correct?", "The water is still neutral, because [H⁺] = [OH⁻]",
            ["The water is acidic, because its pH is less than 7", "The water is basic, because Kw has increased", "The water is neutral only if pH = 7"],
            "Neutral means [H⁺] = [OH⁻]. The ionisation of water is endothermic, so Kw and [H⁺] rise with temperature, and neutral pH is below 7 at 50 °C."),
          q13.short(1, "What is the conjugate base of the ammonium ion, NH₄⁺?", "NH₃", ["ammonia", "NH3", "Ammonia", "nh3"],
            "A conjugate base is what remains after an acid loses H⁺: NH₄⁺ → NH₃ + H⁺."),
          q13.single(1, "A solution of a strong acid has pH 2.0. It is diluted ten times with water. What is the new pH?", "3.0", ["2.1", "1.0", "12.0"],
            "Diluting a strong acid tenfold cuts [H⁺] to one tenth, and pH rises by 1 unit."),
        ],
      },
      flashcards: [
        { front: "Partial pressure", back: "Mole fraction × total pressure." },
        { front: "Kp for aA(g) + bB(g) ⇌ cC(g)", back: "Kp = p(C)ᶜ ÷ (p(A)ᵃ p(B)ᵇ)." },
        { front: "pH definition", back: "pH = −log₁₀[H⁺]." },
        { front: "Kw at 298 K", back: "[H⁺][OH⁻] = 1.00 × 10⁻¹⁴ mol² dm⁻⁶." },
        { front: "pH of a strong base of concentration c", back: "[H⁺] = Kw ÷ c, then pH = −log[H⁺]." },
        { front: "[H⁺] of a weak acid (approximation)", back: "[H⁺] = √(Ka × [HA])." },
        { front: "Ka and pKa", back: "Ka = [H⁺][A⁻] ÷ [HA]; pKa = −log Ka." },
        { front: "Buffer: what is it made of?", back: "A weak acid and its conjugate base (a salt), in similar amounts." },
        { front: "Buffer pH equation", back: "[H⁺] = Ka × [HA] ÷ [A⁻]." },
        { front: "pH at half-equivalence in a weak acid–strong base titration", back: "pH = pKa." },
      ],
    },
  },
};
