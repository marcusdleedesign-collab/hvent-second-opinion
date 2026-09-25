import { Resend } from "resend";
import { z } from "zod/v4";

import {
  supabaseAdmin,
  SUPABASE_STORAGE_BUCKET,
} from "@/lib/supabase-admin";

const LEADS_TABLE =
  "second_opinion_leads";

const TENANT_ID =
  "hvent";

const TEST_FROM =
  "HVent Second Opinion <onboarding@resend.dev>";

const CONSENT_TEXT =
  "I agree that my contact information and uploaded proposal may be shared with HVent so they can review it and contact me about my second-opinion request.";

const ReviewRequestSchema =
  z.object({
    leadId: z
      .string()
      .trim()
      .regex(
        /^SOE-[A-F0-9]{8}$/i,
        "Invalid Lead ID."
      ),

    firstName: z
      .string()
      .trim()
      .min(
        1,
        "First name is required."
      )
      .max(
        80,
        "First name is too long."
      ),

    lastName: z
      .string()
      .trim()
      .max(
        80,
        "Last name is too long."
      )
      .optional()
      .default(""),

    email: z
      .string()
      .trim()
      .max(
        254,
        "Email address is too long."
      )
      .regex(
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please enter a valid email address."
      ),

    phone: z
      .string()
      .trim()
      .max(
        40,
        "Phone number is too long."
      )
      .optional()
      .default(""),

    message: z
      .string()
      .trim()
      .max(
        1000,
        "Message is too long."
      )
      .optional()
      .default(""),

    consent:
      z.literal(true),
  });

type LeadRecord = {
  lead_id: string;
  processing_status: string;
  object_path: string;
  original_file_name:
    | string
    | null;
  file_type:
    | string
    | null;
  zip_code:
    | string
    | null;
  timeline:
    | string
    | null;
  concern:
    | string
    | null;
  homeowner_overview:
    | Record<string, unknown>
    | null;
  first_name:
    | string
    | null;
  last_name:
    | string
    | null;
  email:
    | string
    | null;
  phone:
    | string
    | null;
  homeowner_message:
    | string
    | null;
  consented_at:
    | string
    | null;
};

const LEAD_SELECT = `
  lead_id,
  processing_status,
  object_path,
  original_file_name,
  file_type,
  zip_code,
  timeline,
  concern,
  homeowner_overview,
  first_name,
  last_name,
  email,
  phone,
  homeowner_message,
  consented_at
`;

export async function POST(
  request: Request
) {
  try {
    const resendApiKey =
      process.env.RESEND_API_KEY;

    const notificationEmail =
      process.env
        .CONTRACTOR_NOTIFICATION_EMAIL;

    if (!resendApiKey) {
      console.error(
        "RESEND_API_KEY is not configured."
      );

      return Response.json(
        {
          ok: false,
          error:
            "Email delivery is not configured.",
        },
        {
          status: 500,
        }
      );
    }

    if (!notificationEmail) {
      console.error(
        "CONTRACTOR_NOTIFICATION_EMAIL is not configured."
      );

      return Response.json(
        {
          ok: false,
          error:
            "Contractor notification email is not configured.",
        },
        {
          status: 500,
        }
      );
    }

    const body =
      await request.json();

    const parsed =
      ReviewRequestSchema.safeParse(
        body
      );

    if (!parsed.success) {
      return Response.json(
        {
          ok: false,
          error:
            parsed.error.issues[0]
              ?.message ||
            "Please check the review request form.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      leadId,
      firstName,
      lastName,
      email,
      phone,
      message,
    } = parsed.data;

    /*
     * Read the registered lead first.
     *
     * This lets a retry after a temporary email
     * failure preserve the original consent
     * timestamp and previously saved request.
     */
    const {
      data: existingLead,
      error: readError,
    } =
      await supabaseAdmin
        .from(LEADS_TABLE)
        .select(LEAD_SELECT)
        .eq(
          "lead_id",
          leadId
        )
        .eq(
          "tenant_id",
          TENANT_ID
        )
        .maybeSingle();

    if (readError) {
      console.error(
        "Professional review lead lookup failed:",
        readError
      );

      return Response.json(
        {
          ok: false,
          error:
            "Your request could not be submitted. Please try again.",
        },
        {
          status: 500,
        }
      );
    }

    if (!existingLead) {
      return Response.json(
        {
          ok: false,
          error:
            "This proposal could not be found. Please upload it again.",
        },
        {
          status: 404,
        }
      );
    }

    const allowedStatuses =
      new Set([
        "OVERVIEW_READY",
        "PRECHECK_FAILED",
        "REVIEW_REQUESTED",
      ]);

    if (
      !allowedStatuses.has(
        existingLead.processing_status
      )
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "This proposal is not ready for a professional-review request. Please upload the proposal again.",
        },
        {
          status: 409,
        }
      );
    }

    let lead =
      existingLead as LeadRecord;

    /*
     * Save the homeowner request once.
     *
     * If the row is already REVIEW_REQUESTED,
     * this is a delivery retry. We keep the
     * original saved request and consent time.
     */
    if (
      existingLead.processing_status !==
      "REVIEW_REQUESTED"
    ) {
      const now =
        new Date().toISOString();

      const {
        data: updatedLead,
        error: updateError,
      } =
        await supabaseAdmin
          .from(LEADS_TABLE)
          .update({
            first_name:
              firstName,

            last_name:
              lastName || null,

            email,

            phone:
              phone || null,

            homeowner_message:
              message || null,

            consent_given:
              true,

            consent_text:
              CONSENT_TEXT,

            consented_at:
              now,

            processing_status:
              "REVIEW_REQUESTED",

            updated_at:
              now,
          })
          .eq(
            "lead_id",
            leadId
          )
          .eq(
            "tenant_id",
            TENANT_ID
          )
          .in(
            "processing_status",
            [
              "OVERVIEW_READY",
              "PRECHECK_FAILED",
            ]
          )
          .select(
            LEAD_SELECT
          )
          .maybeSingle();

      if (updateError) {
        console.error(
          "Professional review request update failed:",
          updateError
        );

        return Response.json(
          {
            ok: false,
            error:
              "Your request could not be submitted. Please try again.",
          },
          {
            status: 500,
          }
        );
      }

      if (!updatedLead) {
        return Response.json(
          {
            ok: false,
            error:
              "This proposal changed while the request was being submitted. Please try again.",
          },
          {
            status: 409,
          }
        );
      }

      lead =
        updatedLead as LeadRecord;
    }

    /*
     * Retrieve the original private proposal so the
     * HVAC contractor gets the actual source
     * document, not only the automated summary.
     */
    const {
      data: proposalBlob,
      error: downloadError,
    } =
      await supabaseAdmin.storage
        .from(
          SUPABASE_STORAGE_BUCKET
        )
        .download(
          lead.object_path
        );

    if (downloadError) {
      console.error(
        "Contractor notification attachment download failed:",
        downloadError
      );

      return Response.json(
        {
          ok: false,
          error:
            "Your request was saved, but the proposal could not be prepared for the HVAC team. Please try again.",
        },
        {
          status: 500,
        }
      );
    }

    const proposalBytes =
      Buffer.from(
        await proposalBlob.arrayBuffer()
      );

    const attachmentName =
      sanitizeFilename(
        lead.original_file_name ||
          "hvac-proposal"
      );

    const emailContent =
      buildContractorEmail(
        lead
      );

    const resend =
      new Resend(
        resendApiKey
      );

    const {
      data: sentEmail,
      error: emailError,
    } =
      await resend.emails.send(
        {
          from:
            TEST_FROM,

          to: [
            notificationEmail,
          ],

          replyTo:
            lead.email ||
            undefined,

          subject:
            `New Second Opinion Request — ${lead.zip_code || lead.lead_id}`,

          text:
            emailContent.text,

          html:
            emailContent.html,

          attachments: [
            {
              filename:
                attachmentName,

              content:
                proposalBytes,
            },
          ],
        },
        {
          /*
           * If the browser retries after an uncertain
           * network response, Resend should not create
           * a duplicate contractor notification.
           */
          idempotencyKey:
            `hvent-${lead.lead_id}-contractor-review-v1`,
        }
      );

    if (emailError) {
      console.error(
        "Contractor notification email failed:",
        emailError
      );

      return Response.json(
        {
          ok: false,
          error:
            "Your request was saved, but the HVAC team could not be notified yet. Please try again.",
        },
        {
          status: 500,
        }
      );
    }

    const notifiedAt =
      new Date().toISOString();

    const {
      error: notificationUpdateError,
    } =
      await supabaseAdmin
        .from(LEADS_TABLE)
        .update({
          contractor_notification_email:
            notificationEmail,

          contractor_notification_id:
            sentEmail?.id || null,

          contractor_notified_at:
            notifiedAt,

          updated_at:
            notifiedAt,
        })
        .eq(
          "lead_id",
          lead.lead_id
        )
        .eq(
          "tenant_id",
          TENANT_ID
        );

    if (
      notificationUpdateError
    ) {
      /*
       * The homeowner request is saved and the email
       * was already sent. Do not tell the homeowner
       * submission failed only because audit metadata
       * could not be updated.
       */
      console.error(
        "Contractor notification audit update failed:",
        notificationUpdateError
      );
    }

    return Response.json({
      ok: true,

      leadId:
        lead.lead_id,

      status:
        "REVIEW_REQUESTED",

      contractorNotified:
        true,
    });
  } catch (error) {
    console.error(
      "Professional review request failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Your request could not be submitted. Please try again.",
      },
      {
        status: 500,
      }
    );
  }
}

function buildContractorEmail(
  lead: LeadRecord
) {
  const overview =
    asRecord(
      lead.homeowner_overview
    );

  const proposal =
    asRecord(
      overview?.proposal
    );

  const headline =
    asRecord(
      overview?.headline
    );

  const options =
    asRecordArray(
      overview?.options
    );

  const exclusions =
    asRecordArray(
      overview?.exclusions
    );

  const clarifications =
    asRecordArray(
      overview?.clarifications
    );

  const fullName =
    [
      lead.first_name,
      lead.last_name,
    ]
      .filter(Boolean)
      .join(" ") ||
    "Not provided";

  const contractorName =
    displayValue(
      proposal?.contractorName
    );

  const proposalNumber =
    displayValue(
      proposal?.proposalNumber
    );

  const proposalPrice =
    displayValue(
      headline?.price
    );

  const optionLines =
    options
      .slice(0, 6)
      .map((option) => {
        const label =
          displayValue(
            option.label
          );

        const price =
          displayValue(
            asRecord(
              option.price
            )?.value
          );

        if (
          label === "Not identified" &&
          price === "Not identified"
        ) {
          return null;
        }

        return `${label}${
          price !== "Not identified"
            ? ` — ${price}`
            : ""
        }`;
      })
      .filter(
        (
          value
        ): value is string =>
          Boolean(value)
      );

  const exclusionLines =
    exclusions
      .slice(0, 8)
      .map((item) => {
        const label =
          displayValue(
            item.label
          );

        const text =
          displayValue(
            item.text
          );

        return `${label}: ${text}`;
      });

  const clarificationLines =
    clarifications
      .slice(0, 5)
      .map((item) => {
        const label =
          displayValue(
            item.label
          );

        const message =
          displayValue(
            item.message
          );

        return `${label}: ${message}`;
      });

  const plainSections = [
    "NEW SECOND OPINION REQUEST",
    "",
    "CUSTOMER",
    `Name: ${fullName}`,
    `Email: ${lead.email || "Not provided"}`,
    `Phone: ${lead.phone || "Not provided"}`,
    `ZIP: ${lead.zip_code || "Not provided"}`,
    `Timeline: ${lead.timeline || "Not provided"}`,
    `Primary concern: ${lead.concern || "Not provided"}`,
    "",
    "HOMEOWNER MESSAGE",
    lead.homeowner_message ||
      "No additional message provided.",
    "",
    "PROPOSAL",
    `Original contractor: ${contractorName}`,
    `Proposal #: ${proposalNumber}`,
    `Headline price: ${proposalPrice}`,
  ];

  if (
    optionLines.length > 0
  ) {
    plainSections.push(
      "",
      "PROPOSAL OPTIONS",
      ...optionLines.map(
        (line) =>
          `• ${line}`
      )
    );
  }

  if (
    exclusionLines.length > 0
  ) {
    plainSections.push(
      "",
      "EXPLICIT EXCLUSIONS",
      ...exclusionLines.map(
        (line) =>
          `• ${line}`
      )
    );
  }

  if (
    clarificationLines.length >
    0
  ) {
    plainSections.push(
      "",
      "WORTH CLARIFYING",
      ...clarificationLines.map(
        (line) =>
          `• ${line}`
      )
    );
  }

  if (
    !lead.homeowner_overview
  ) {
    plainSections.push(
      "",
      "AUTOMATED OVERVIEW",
      "An automated Quote Overview was not available for this proposal. Review the attached original document directly."
    );
  }

  plainSections.push(
    "",
    "LEAD REFERENCE",
    lead.lead_id,
    "",
    "The original uploaded proposal is attached.",
    "",
    "Automated proposal information organizes what the uploaded document states. It is not a professional HVAC opinion."
  );

  const htmlOptions =
    listHtml(
      optionLines
    );

  const htmlExclusions =
    listHtml(
      exclusionLines
    );

  const htmlClarifications =
    listHtml(
      clarificationLines
    );

  const html = `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#172033;">
    <div style="max-width:720px;margin:0 auto;padding:32px 20px;">
      <div style="background:#0f172a;color:#ffffff;border-radius:16px 16px 0 0;padding:24px 28px;">
        <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#7dd3fc;font-weight:700;">
          HVent Second Opinion Engine
        </div>
        <h1 style="margin:8px 0 0;font-size:26px;line-height:1.25;">
          New Second Opinion Request
        </h1>
        <div style="margin-top:10px;font-size:13px;color:#94a3b8;">
          Reference ${escapeHtml(lead.lead_id)}
        </div>
      </div>

      <div style="background:#ffffff;border:1px solid #e2e8f0;border-top:0;padding:28px;">
        ${emailSection(
          "Customer",
          `
            <strong>${escapeHtml(fullName)}</strong><br>
            ${escapeHtml(lead.email || "Not provided")}<br>
            ${escapeHtml(lead.phone || "Not provided")}<br><br>
            <strong>ZIP:</strong> ${escapeHtml(lead.zip_code || "Not provided")}<br>
            <strong>Timeline:</strong> ${escapeHtml(lead.timeline || "Not provided")}<br>
            <strong>Primary concern:</strong> ${escapeHtml(lead.concern || "Not provided")}
          `
        )}

        ${emailSection(
          "Homeowner message",
          `<div style="white-space:pre-wrap;">${escapeHtml(
            lead.homeowner_message ||
              "No additional message provided."
          )}</div>`
        )}

        ${emailSection(
          "Proposal",
          `
            <strong>Original contractor:</strong> ${escapeHtml(contractorName)}<br>
            <strong>Proposal #:</strong> ${escapeHtml(proposalNumber)}<br>
            <strong>Headline price:</strong> ${escapeHtml(proposalPrice)}
          `
        )}

        ${
          optionLines.length > 0
            ? emailSection(
                "Proposal options",
                htmlOptions
              )
            : ""
        }

        ${
          exclusionLines.length > 0
            ? emailSection(
                "Explicit exclusions",
                htmlExclusions
              )
            : ""
        }

        ${
          clarificationLines.length > 0
            ? emailSection(
                "Worth clarifying",
                htmlClarifications
              )
            : ""
        }

        ${
          !lead.homeowner_overview
            ? emailSection(
                "Automated overview unavailable",
                "An automated Quote Overview was not available for this proposal. Review the attached original document directly."
              )
            : ""
        }

        ${emailSection(
          "Original proposal",
          "The homeowner's original uploaded proposal is attached to this email."
        )}

        <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.6;color:#64748b;">
          Automated proposal information organizes what the uploaded document states. It is not a professional HVAC opinion.
        </div>
      </div>
    </div>
  </body>
</html>
`.trim();

  return {
    text:
      plainSections.join(
        "\n"
      ),

    html,
  };
}

function emailSection(
  title: string,
  content: string
) {
  return `
    <div style="margin-bottom:26px;">
      <div style="margin-bottom:8px;font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:#64748b;font-weight:700;">
        ${escapeHtml(title)}
      </div>
      <div style="font-size:15px;line-height:1.65;color:#243047;">
        ${content}
      </div>
    </div>
  `.trim();
}

function listHtml(
  items: string[]
) {
  return `
    <ul style="margin:0;padding-left:20px;">
      ${items
        .map(
          (item) =>
            `<li style="margin:0 0 8px;">${escapeHtml(item)}</li>`
        )
        .join("")}
    </ul>
  `.trim();
}

function asRecord(
  value: unknown
):
  | Record<string, unknown>
  | null {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<
      string,
      unknown
    >;
  }

  return null;
}

function asRecordArray(
  value: unknown
) {
  if (!Array.isArray(value)) {
    return [] as Record<
      string,
      unknown
    >[];
  }

  return value.filter(
    (
      item
    ): item is Record<
      string,
      unknown
    > =>
      Boolean(
        item &&
          typeof item ===
            "object" &&
          !Array.isArray(item)
      )
  );
}

function displayValue(
  value: unknown
) {
  if (
    typeof value === "string" &&
    value.trim()
  ) {
    return value.trim();
  }

  return "Not identified";
}

function escapeHtml(
  value: string
) {
  return value
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}

function sanitizeFilename(
  value: string
) {
  const cleaned =
    value
      .replace(
        /[\u0000-\u001F\u007F]/g,
        ""
      )
      .replace(
        /[\\/]/g,
        "-"
      )
      .trim();

  return (
    cleaned ||
    "hvac-proposal"
  );
}
