// Input handling only ever touches the pure core (steer -3..3 / act 0|1), so it is completely theme-agnostic; Turbo
// Slide reuses it unchanged. See ../../penguin/engine/input.ts for the full contract.
export * from "../../penguin/engine/input";
