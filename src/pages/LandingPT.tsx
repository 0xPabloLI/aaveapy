import { LocalizedLanding } from "@/components/landing/LocalizedLanding";
import content from "@/locales/pt-BR/landing.json";

export default function LandingPT() {
  return (
    <LocalizedLanding
      locale="pt-BR"
      content={content}
      relatedLinks={[
        { to: "/pt-br/taxas-aave-apy", label: "Taxas e APY da Aave V3: como funciona o protocolo" },
      ]}
    />
  );
}
