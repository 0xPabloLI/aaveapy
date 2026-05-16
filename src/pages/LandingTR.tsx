import { LocalizedLanding } from "@/components/landing/LocalizedLanding";
import content from "@/locales/tr/landing.json";

export default function LandingTR() {
  return <LocalizedLanding locale="tr" content={content} />;
}
