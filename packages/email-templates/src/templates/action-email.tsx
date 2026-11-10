import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export interface ActionEmailProps {
  preview: string;
  heading: string;
  paragraphs: string[];
  cta: string;
  url: string;
  footnote?: string;
}

const colors = {
  ink: "#1c1917",
  muted: "#57534e",
  accent: "#1d4ed8",
  line: "#e7e5e4",
};

/** Shared layout of every transactional email: one message, one button. */
export function ActionEmail({
  preview,
  heading,
  paragraphs,
  cta,
  url,
  footnote,
}: ActionEmailProps) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: "#fafaf9",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <Container
          style={{
            maxWidth: 520,
            margin: "32px auto",
            padding: "32px",
            backgroundColor: "#ffffff",
            borderRadius: 12,
          }}
        >
          <Text
            style={{
              fontWeight: 700,
              fontSize: 18,
              color: colors.ink,
              margin: 0,
            }}
          >
            parle-tcf
          </Text>
          <Heading
            as="h1"
            style={{ fontSize: 22, color: colors.ink, margin: "24px 0 12px" }}
          >
            {heading}
          </Heading>
          {paragraphs.map((p) => (
            <Text
              key={p}
              style={{ fontSize: 15, lineHeight: "24px", color: colors.ink }}
            >
              {p}
            </Text>
          ))}
          <Section style={{ margin: "24px 0" }}>
            <Button
              href={url}
              style={{
                backgroundColor: colors.accent,
                color: "#ffffff",
                padding: "12px 20px",
                borderRadius: 8,
                fontWeight: 600,
              }}
            >
              {cta}
            </Button>
          </Section>
          <Text style={{ fontSize: 13, color: colors.muted }}>
            Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur
            : {url}
          </Text>
          <Hr style={{ borderColor: colors.line }} />
          <Text style={{ fontSize: 12, color: colors.muted }}>
            {footnote ??
              "Vous recevez ce message parce qu’une action a été demandée sur parle-tcf."}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
