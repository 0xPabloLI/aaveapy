import { LocalizedLanding } from "@/components/landing/LocalizedLanding";
import content from "@/locales/fr/landing.json";

export default function LandingFR() {
  return <LocalizedLanding locale="fr" content={content} />;
}
