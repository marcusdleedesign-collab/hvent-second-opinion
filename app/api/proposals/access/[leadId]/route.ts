import {
  verifyProposalAccessToken,
} from "@/lib/proposal-access";

import {
  supabaseAdmin,
  SUPABASE_STORAGE_BUCKET,
} from "@/lib/supabase-admin";

const LEADS_TABLE =
  "second_opinion_leads";

const TENANT_ID =
  "hvent";

const SIGNED_URL_SECONDS =
  5 * 60;

type RouteContext = {
  params: Promise<{
    leadId: string;
  }>;
};

export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    const secret =
      process.env
        .PROPOSAL_LINK_SECRET;

    if (!secret) {
      console.error(
        "PROPOSAL_LINK_SECRET is not configured."
      );

      return new Response(
        "Proposal access is not configured.",
        {
          status: 500,
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    const {
      leadId: rawLeadId,
    } =
      await context.params;

    const leadId =
      rawLeadId
        .trim()
        .toUpperCase();

    if (
      !/^SOE-[A-F0-9]{8}$/.test(
        leadId
      )
    ) {
      return new Response(
        "Invalid proposal link.",
        {
          status: 400,
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    const requestUrl =
      new URL(
        request.url
      );

    const token =
      requestUrl.searchParams.get(
        "token"
      ) || "";

    if (
      !verifyProposalAccessToken(
        leadId,
        token,
        secret
      )
    ) {
      return new Response(
        "This proposal link is invalid.",
        {
          status: 403,
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    const {
      data: lead,
      error: leadError,
    } =
      await supabaseAdmin
        .from(
          LEADS_TABLE
        )
        .select(
          `
            object_path,
            processing_status
          `
        )
        .eq(
          "lead_id",
          leadId
        )
        .eq(
          "tenant_id",
          TENANT_ID
        )
        .maybeSingle();

    if (leadError) {
      console.error(
        "Secure proposal lookup failed:",
        leadError
      );

      return new Response(
        "The proposal could not be opened.",
        {
          status: 500,
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    if (
      !lead ||
      lead.processing_status !==
        "REVIEW_REQUESTED"
    ) {
      return new Response(
        "This proposal is not available.",
        {
          status: 404,
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    const {
      data: signedUrlData,
      error: signedUrlError,
    } =
      await supabaseAdmin.storage
        .from(
          SUPABASE_STORAGE_BUCKET
        )
        .createSignedUrl(
          lead.object_path,
          SIGNED_URL_SECONDS
        );

    if (
      signedUrlError ||
      !signedUrlData?.signedUrl
    ) {
      console.error(
        "Secure proposal signed URL creation failed:",
        signedUrlError
      );

      return new Response(
        "The proposal could not be opened.",
        {
          status: 500,
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    return new Response(
      null,
      {
        status: 302,
        headers: {
          Location:
            signedUrlData.signedUrl,

          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Secure proposal access failed:",
      error
    );

    return new Response(
      "The proposal could not be opened.",
      {
        status: 500,
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }
}