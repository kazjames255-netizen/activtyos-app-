import LegacyPrototype from "./legacy/LegacyPrototype";

/**
 * Shell entry point. During the strangler migration the whole prototype runs
 * inside <LegacyPrototype />. New React routes will be added alongside this and
 * progressively take over individual views.
 */
export default function Home() {
  return <LegacyPrototype />;
}
