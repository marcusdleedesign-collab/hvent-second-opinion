import {
  supabaseAdmin,
  SUPABASE_STORAGE_BUCKET,
} from "@/lib/supabase-admin";

const MAX_FILE_SIZE =
  10 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

const ALLOWED_TIMELINES =
  new Set([
    "As soon as possible",
    "Within 30 days",
    "1–3 months",
    "Just researching",
  ]);

const ALLOWED_CONCERNS =
  new Set([
    "",
    "Price",
    "Equipment being recommended",
    "Warranty",
    "What's included / scope",
    "Financing",
    "I just want another opinion",
    "Other",
  ]);

const TENANT_ID = "hvent";

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const leadId =
      typeof body.leadId === "string"
        ? body.leadId.trim()
        : "";

    const objectPath =
      typeof body.objectPath === "string"
        ? body.objectPath.trim()
        : "";

    const fileName =
      typeof body.fileName === "string"
        ? body.fileName.trim()
        : "";

    const fileType =
      typeof body.fileType === "string"
        ? body.fileType.trim()
        : "";

    const fileSize =
      typeof body.fileSize === "number"
        ? body.fileSize
        : NaN;

    const zipCode =
      typeof body.zipCode === "string"
        ? body.zipCode.trim()
        : "";

    const timeline =
      typeof body.timeline === "string"
        ? body.timeline.trim()
        : "";

    const concern =
      typeof body.concern === "string"
        ? body.concern.trim()
        : "";

    if (
      !/^SOE-[A-F0-9]{8}$/i.test(
        leadId
      )
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Invalid Lead ID.",
        },
        {
          status: 400,
        }
      );
    }

    const expectedPrefix =
      `hvent/dev/${leadId}/`;

    if (
      !objectPath.startsWith(
        expectedPrefix
      )
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Storage path does not match Lead ID.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      fileName.length < 1 ||
      fileName.length > 255
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Invalid file name.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !ALLOWED_TYPES.has(fileType)
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Invalid file type.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isFinite(fileSize) ||
      fileSize <= 0 ||
      fileSize > MAX_FILE_SIZE
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Invalid file size.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !/^\d{5}$/.test(zipCode)
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Invalid ZIP code.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !ALLOWED_TIMELINES.has(
        timeline
      )
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Invalid project timeline.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !ALLOWED_CONCERNS.has(
        concern
      )
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Invalid concern value.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Confirm the uploaded object exists before
     * creating the database lead record.
     *
     * We download it server-side because the bucket
     * is private. The returned Blob is not exposed
     * to the browser here.
     */
    const {
      error: storageError,
    } =
      await supabaseAdmin.storage
        .from(
          SUPABASE_STORAGE_BUCKET
        )
        .download(objectPath);

    if (storageError) {
      console.error(
        "Lead registration storage check failed:",
        storageError
      );

      return Response.json(
        {
          ok: false,
          error:
            "Uploaded proposal could not be verified.",
          details:
            storageError.message,
        },
        {
          status: 400,
        }
      );
    }

    const {
      error: insertError,
    } =
      await supabaseAdmin
        .from(
          "second_opinion_leads"
        )
        .insert({
          lead_id: leadId,
          tenant_id: TENANT_ID,

          object_path:
            objectPath,

          original_file_name:
            fileName,

          file_type:
            fileType,

          file_size:
            fileSize,

          zip_code:
            zipCode,

          timeline,

          concern:
            concern || null,

          processing_status:
            "UPLOADED",
        });

    if (insertError) {
      console.error(
        "Lead registration insert failed:",
        insertError
      );

      return Response.json(
        {
          ok: false,
          error:
            "Unable to register the uploaded proposal.",
          details:
            insertError.message,
        },
        {
          status: 500,
        }
      );
    }

    return Response.json({
      ok: true,
      leadId,
      status: "UPLOADED",
    });
  } catch (error) {
    console.error(
      "Lead registration failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to register the uploaded proposal.",
        details:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      {
        status: 500,
      }
    );
  }
}