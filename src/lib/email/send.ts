import { Resend } from "resend";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface ProposalEmailData {
  nome: string;
  cognome: string;
  offerta: string;
  risparmio: number;
  codice: string;
}

export async function sendProposalEmail(
  to: string,
  code: string,
  data: ProposalEmailData
): Promise<void> {
  const proposalUrl = `${APP_URL}/proposal?code=${code}`;

  const resend = new Resend(process.env.RESEND_API_KEY!);
  await resend.emails.send({
    from: "Luce&Gas <onboarding@resend.dev>",
    to: process.env.RESEND_TEST_TO || to,
    subject: `${data.nome}, scopri quanto puoi risparmiare! 💡`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #FF6B00, #FF8C42); padding: 32px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Luce & Gas</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0;">La tua offerta personalizzata ti aspetta</p>
        </div>
        <div style="padding: 32px;">
          <p style="font-size: 18px; color: #1a1a1a;">
            Ciao <strong>${data.nome}</strong>,
          </p>
          <p style="color: #444; line-height: 1.6;">
            Abbiamo analizzato la tua bolletta e abbiamo un'ottima notizia:<br>
            con <strong>${data.offerta}</strong> puoi risparmiare fino a<br>
          </p>
          <div style="background: white; border: 2px solid #FF6B00; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 36px; font-weight: bold; color: #FF6B00;">€${data.risparmio.toFixed(2)}/mese</span>
          </div>
          <p style="color: #444; line-height: 1.6;">
            Il tuo codice personale è: <strong style="font-size: 20px; letter-spacing: 4px; color: #FF6B00;">${data.codice}</strong>
          </p>
          <a href="${proposalUrl}" style="display: inline-block; background: #FF6B00; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; margin: 16px 0;">
            Vedi la tua offerta →
          </a>
          <p style="color: #888; font-size: 13px; margin-top: 24px;">
            Inserisci il codice <strong>${data.codice}</strong> nella pagina per accedere alla proposta.<br>
            Il codice è valido per 30 giorni.
          </p>
        </div>
        <div style="background: #1a1a1a; padding: 16px; text-align: center;">
          <p style="color: #888; font-size: 11px; margin: 0;">
            Luce&Gas — POC dimostrativo interno<br>
            Questa email è generata automaticamente, non rispondere.
          </p>
        </div>
      </div>
    `,
  });
}