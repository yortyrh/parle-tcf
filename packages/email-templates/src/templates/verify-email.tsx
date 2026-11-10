import { ActionEmail } from "./action-email";

export interface VerifyEmailProps {
  url: string;
}

export const verifyEmailSubject = () => "Confirmez votre adresse e-mail";

export default function VerifyEmail({ url }: VerifyEmailProps) {
  return (
    <ActionEmail
      preview="Activez votre compte parle-tcf"
      heading="Bienvenue sur parle-tcf !"
      paragraphs={[
        "Confirmez votre adresse e-mail pour activer votre compte et commencer à vous entraîner.",
      ]}
      cta="Confirmer mon e-mail"
      url={url}
      footnote="Si vous n’avez pas créé de compte, ignorez ce message."
    />
  );
}

VerifyEmail.PreviewProps = {
  url: "http://localhost:3000/verifier-email?token=exemple",
} satisfies VerifyEmailProps;
