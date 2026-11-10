import { ActionEmail } from "./action-email";

export interface ResetPasswordProps {
  url: string;
}

export const resetPasswordSubject = () =>
  "Réinitialisation de votre mot de passe";

export default function ResetPassword({ url }: ResetPasswordProps) {
  return (
    <ActionEmail
      preview="Choisissez un nouveau mot de passe"
      heading="Réinitialiser votre mot de passe"
      paragraphs={[
        "Vous avez demandé à réinitialiser votre mot de passe.",
        "Ce lien est valable une heure.",
      ]}
      cta="Choisir un nouveau mot de passe"
      url={url}
      footnote="Si vous n’êtes pas à l’origine de cette demande, ignorez ce message : votre mot de passe reste inchangé."
    />
  );
}

ResetPassword.PreviewProps = {
  url: "http://localhost:3000/reinitialiser?token=exemple",
} satisfies ResetPasswordProps;
