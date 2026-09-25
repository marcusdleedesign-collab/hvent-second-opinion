import { Resend } from "resend";

const resend =
  new Resend(
    process.env.RESEND_API_KEY
  );

export async function POST() {
  if (!process.env.RESEND_API_KEY) {
    return Response.json(
      {
        ok: false,
        error:
          "RESEND_API_KEY is not configured.",
      },
      {
        status: 500,
      }
    );
  }

  try {
    const {
      data,
      error,
    } =
      await resend.emails.send(
        {
          from:
            "HVent Test <onboarding@resend.dev>",

          to: [
            "delivered@resend.dev",
          ],

          subject:
            "HVent Resend connection test",

          text:
            "HVent successfully connected to Resend.",

          html:
            "<strong>HVent successfully connected to Resend.</strong>",
        },
        {
          idempotencyKey:
            "hvent-resend-setup-test-v1",
        }
      );

    if (error) {
      console.error(
        "Resend test email failed:",
        error
      );

      return Response.json(
        {
          ok: false,
          error:
            error.message,
        },
        {
          status: 400,
        }
      );
    }

    return Response.json({
      ok: true,
      emailId:
        data?.id ?? null,
    });
  } catch (error) {
    console.error(
      "Resend test route failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown email error.",
      },
      {
        status: 500,
      }
    );
  }
}