// KS3 Science — Physics: Energy (Y7 stores and transfers; Y9 power and efficiency). Original content aligned to the DfE KS3 programme of study (OGL v3.0).
// Calculation keys are recomputed by _check_s3.ts.
import type { CTopic } from "../types";
import { IMG } from "./_img";
import { sg, nm, build } from "./_h";

export const TOPIC: CTopic = {
  key: "penergy",
  topic: "Physics — Energy",
  subject: "Science",
  years: {
    7: {
      year: 7,
      subtopic: "Year 7: energy stores and transfers",
      objectives: [
        "Energy as a quantity that can be quantified and calculated; the total energy has the same value before and after a change.",
        "Comparing energy values of different foods (from labels) (kJ).",
        "Energy stores and the ways energy is transferred between them: mechanically, electrically, by heating and by radiation (light and sound).",
        "Fuels and energy resources.",
      ],
      note: {
        title: "Year 7: energy stores and transfers",
        body: `## Stores of energy

Energy is measured in **joules (J)**; 1 kJ = 1000 J. Energy is **stored** in different ways:

| Store | Example |
| --- | --- |
| Chemical | food, fuels, batteries |
| Kinetic | anything moving |
| Gravitational potential | a book on a shelf, water behind a dam |
| Elastic potential | a stretched spring or elastic band |
| Thermal (internal) | a hot cup of tea |
| Nuclear | the nucleus of an atom |

## Transfers

Energy is **transferred** between stores by **mechanical work** (forces), **electrical** work (a current), **heating**, or **radiation** (light and sound waves).

## Conservation of energy

Energy is never created or destroyed. It is only transferred. The **total** energy before and after is the same, though some may go to stores that are not useful (usually the thermal store of the surroundings).

## Worked example

A hairdryer takes in 900 J of energy each second: 650 J is transferred as thermal energy, 20 J as sound, and the rest as kinetic energy in the fan. Kinetic = 900 − 650 − 20 = **230 J**.

## Energy resources

**Non-renewable** resources (coal, oil, natural gas) will run out. **Renewable** ones (wind, solar, tidal, hydroelectric) can be replaced.`,
      },
      quiz: {
        title: "Energy Stores & Transfers: Year 7 quiz",
        questions: build("penergy", 7, [
          sg("Look at the torch diagram. Arrow P shows energy moving from the battery to the lamp. How is it transferred?", "Electrically, by an electric current", ["Thermally, by heating from the battery", "By light shining from the battery", "Mechanically, by a force from the battery"], "The battery and lamp are joined by wires, and energy is transferred by an electric current.", 1, { img: IMG.torch }),
          sg("Look at the torch diagram. Arrow Q shows energy going to the surroundings that the lamp lights up. How is it transferred?", "By light (radiation)", ["By an electric current", "By heating", "By a force"], "The lamp gives out light, which carries energy as radiation.", 2, { img: IMG.torch }),
          sg("Look at the torch diagram. Which arrow shows energy that is wasted?", "R", ["P", "Q"], "The energy that warms the surroundings is not the useful output of the lamp, so R is wasted.", 2, { img: IMG.torch }),
          sg("A stretched elastic band stores energy in which store?", "Elastic potential", ["Kinetic", "Chemical", "Gravitational potential"], "Stretched or squashed objects store elastic potential energy.", 1, { d: true }),
          sg("A ball sits at the top of a hill. Which energy store does it have the most of?", "Gravitational potential", ["Kinetic", "Elastic potential", "Thermal"], "The higher an object is above the ground, the greater its gravitational potential energy store.", 1),
          sg("A ball rolls down a hill. Which energy store increases as it speeds up?", "Kinetic", ["Chemical", "Gravitational potential", "Nuclear"], "The gravitational store decreases and the kinetic store increases as it speeds up.", 2),
          nm("A cereal bar gives out 3.6 kJ of energy. How many joules is this?", 3600, "1 kJ = 1000 J, so multiply by 1000: 3.6 × 1000 = 3600 J.", 2),
          sg("Which of these is a non-renewable energy resource?", "Natural gas", ["Wind", "Tidal", "Solar"], "Natural gas took millions of years to form and cannot be replaced quickly.", 2),
          nm("A lamp takes in 100 J of electrical energy. It gives out 8 J as light. The rest is transferred as thermal energy. How many joules are transferred as thermal energy?", 92, "Energy is conserved: 100 − 8 = 92 J.", 2, { d: true }),
          sg("A pendulum swings a little lower on each swing. Where has the 'lost' energy gone?", "It has been transferred to the thermal store of the surroundings; the total energy is unchanged", ["It has been destroyed, so the total energy of the pendulum and its surroundings has gone down", "It has been stored as extra kinetic energy in the pendulum", "It has changed into mass"], "Energy is conserved. Friction with the air and pivot warms them slightly.", 3),
        ]),
      },
      flashcards: [
        { front: "What is energy measured in?", back: "Joules (J); 1 kJ = 1000 J." },
        { front: "Name six energy stores", back: "Chemical, kinetic, gravitational potential, elastic potential, thermal, nuclear." },
        { front: "Four ways energy is transferred", back: "Mechanically (forces), electrically, by heating, by radiation (light, sound)." },
        { front: "Law of conservation of energy", back: "Energy cannot be created or destroyed, only transferred." },
        { front: "Where does wasted energy usually go?", back: "The thermal store of the surroundings." },
        { front: "A stretched spring stores…", back: "Elastic potential energy." },
        { front: "Example of a chemical store", back: "Food, fuel, battery." },
        { front: "Renewable energy: examples", back: "Wind, solar, tidal, hydroelectric." },
        { front: "Non-renewable energy: examples", back: "Coal, oil, natural gas." },
      ],
    },
    9: {
      year: 9,
      subtopic: "Year 9: power and efficiency",
      objectives: [
        "Comparing power ratings of appliances in watts (W, kW).",
        "Comparing amounts of energy transferred (J, kJ, kW hour); domestic fuel bills, fuel use and costs.",
        "Energy transfers in systems: efficiency, useful and wasted energy, and reducing waste.",
        "Calculating power from energy and time.",
      ],
      note: {
        title: "Year 9: power, cost and efficiency",
        body: `## Power

**Power** is the rate of transferring energy. Its unit is the **watt (W)**: 1 W = 1 joule per second. 1 kW = 1000 W.

- energy transferred (J) = power (W) × time (s)
- power (W) = energy (J) ÷ time (s)

## Paying for electricity

Homes are charged in **kilowatt-hours (kWh)**: energy (kWh) = power (kW) × time (h). Cost = kWh × price per kWh.

## Efficiency

**Efficiency** = useful energy out ÷ total energy in. Multiply by 100 for a percentage. No device is 100% efficient because some energy is always transferred to the surroundings as heat. A **Sankey diagram** shows this, with arrow widths drawn to scale. Waste can be reduced by **lubrication**, **insulation** and shaping objects to reduce drag.

## Worked examples

A 60 W lamp on for 2 minutes: E = 60 × 120 = **7200 J**.
A 1.5 kW oven for 2 h at 20p per kWh: 3 kWh × 20p = **60p**.
A toy gets 80 J and gives out 32 J of useful energy: efficiency = 32 ÷ 80 = **40%**.`,
      },
      quiz: {
        title: "Power & Efficiency: Year 9 quiz",
        questions: build("penergy", 9, [
          nm("Look at the Sankey diagram. How much energy is wasted, in joules?", 75, "Energy is conserved: wasted = input − useful output = 250 − 175 = 75 J.", 1, { d: true, img: IMG.sankey }),
          sg("Look at the Sankey diagram. What is the efficiency of the motor?", "70%", ["30%", "175%", "75%"], "Efficiency = useful out ÷ total in = 175 ÷ 250 = 0.70, or 70%.", 2, { d: true, img: IMG.sankey }),
          nm("An electric kettle has a power of 2000 W and is switched on for 3 minutes. How much energy does it transfer, in joules?", 360000, "Convert 3 minutes to 180 s. Energy = power × time = 2000 × 180 = 360 000 J.", 2),
          nm("A 3 kW heater is on for 4 hours. Electricity costs 30p per kWh. How much does this cost, in pounds?", 3.6, "Energy = 3 kW × 4 h = 12 kWh. Cost = 12 × 30p = 360p = £3.60.", 2, { tol: 0.005 }),
          sg("Which would help to reduce the energy wasted by friction in a machine?", "Lubricating the moving parts", ["Making the machine heavier", "Running it for longer", "Adding more moving parts"], "Oil between moving surfaces reduces friction, so less energy is transferred to thermal energy.", 1),
          sg("Which of these has the greatest power?", "2.5 kW", ["900 W", "0.5 kW", "1500 W"], "Convert to watts: 2.5 kW = 2500 W, which is the largest.", 2),
          nm("A machine takes in 400 J and is 25% efficient. How much energy is wasted, in joules?", 300, "Useful output = 25% of 400 = 100 J. Wasted = 400 − 100 = 300 J.", 3),
          sg("Why can no machine be 100% efficient?", "Some energy is always transferred to the surroundings, for example by heating", ["Energy is destroyed when machines run, so less comes out than went in", "Machines make new energy as they warm up, so the output cannot be measured", "Efficiency is only about how fast something moves"], "Some energy always goes into less useful stores, such as heating the surroundings.", 3),
          sg("Which is a disadvantage of wind turbines?", "They only work when the wind is blowing", ["They burn fossil fuels", "They release carbon dioxide as they turn", "They use up the wind so it runs out"], "Wind is renewable, but it is not always available.", 2),
          nm("A motor transfers 4500 J of energy in 30 s. What is its power in watts?", 150, "Power = energy ÷ time = 4500 ÷ 30 = 150 W.", 2),
        ]),
      },
      flashcards: [
        { front: "What is power?", back: "The rate of transferring energy: 1 watt = 1 joule per second." },
        { front: "Energy from power and time", back: "energy (J) = power (W) × time (s)." },
        { front: "Power from energy and time", back: "power (W) = energy (J) ÷ time (s)." },
        { front: "1 kW = ?", back: "1000 W." },
        { front: "Unit on an electricity bill", back: "The kilowatt-hour (kWh)." },
        { front: "kWh formula", back: "energy (kWh) = power (kW) × time (h)." },
        { front: "Efficiency formula", back: "efficiency = useful energy out ÷ total energy in (× 100 for %)." },
        { front: "Why is efficiency never 100%?", back: "Some energy is always wasted, usually as heat in the surroundings." },
        { front: "Two ways to reduce wasted energy", back: "Lubrication, insulation." },
        { front: "What does a Sankey diagram show?", back: "Energy transfers, with arrow width drawn to scale." },
      ],
    },
  },
};
