import { LocalizedLanding } from "@/components/landing/LocalizedLanding";
import content from "@/locales/pt-BR/landing.json";

export default function LandingPT() {
  return <LocalizedLanding locale="pt-BR" content={content} />;
}
