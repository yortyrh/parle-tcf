import { ActionEmail } from "./action-email";

export interface DeleteAccountProps {
  url: string;
}

export const deleteAccountSubject = () =>
  "Confirmez la suppression de votre compte";

export default function DeleteAccount({ url }: DeleteAccountProps) {
  return (
    <ActionEmail
      preview="Suppression définitive de votre compte"
      heading="Supprimer votre compte"
      paragraphs={[
        "Vous avez demandé la suppression de votre compte parle-tcf.",
        "Toutes vos tentatives, évaluations, enregistrements et clés d’API seront effacés définitivement. Cette action est irréversible.",
      ]}
      cta="Supprimer mon compte"
      url={url}
      footnote="Si vous n’êtes pas à l’origine de cette demande, ignorez ce message : votre compte est conservé."
    />
  );
}

DeleteAccount.PreviewProps = {
  url: "http://localhost:3001/api/auth/delete-user/callback?token=exemple",
} satisfies DeleteAccountProps;
