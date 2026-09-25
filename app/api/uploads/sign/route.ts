import {
  supabaseAdmin,
  SUPABASE_STORAGE_BUCKET,
} from "@/lib/supabase-admin";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const fileType = body.fileType;
    const fileSize = body.fileSize;

    if (
      typeof fileType !== "string" ||
      typeof fileSize !== "number"
    ) {
      return Response.json(
        { error: "Invalid upload request." },
        { status: 400 }
      );
    }

    const extension = ALLOWED_TYPES[fileType];

    if (!extension) {
      return Response.json(
        { error: "Unsupported file type." },
        { status: 400 }
      );
    }

    if (fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
      return Response.json(
        { error: "File must be smaller than 10 MB." },
        { status: 400 }
      );
    }

    const leadId = `SOE-${crypto
      .randomUUID()
      .split("-")[0]
      .toUpperCase()}`;

    const objectId = crypto.randomUUID();

    const objectPath =
      `hvent/dev/${leadId}/${objectId}.${extension}`;

    const { data, error } = await supabaseAdmin.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .createSignedUploadUrl(objectPath);

    if (error) {
      console.error(
        "Supabase signed upload error:",
        error
      );

      return Response.json(
        {
          error: "Unable to prepare secure upload.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return Response.json({
  ok: true,
  leadId,
  objectPath,
  token: data.token,
  bucket: SUPABASE_STORAGE_BUCKET,
});
  } catch (error) {
    console.error("Upload signing error:", error);

    return Response.json(
      {
        error: "Unable to prepare upload.",
        details:
          error instanceof Error
            ? error.message
            : "Unknown error.",
      },
      { status: 500 }
    );
  }
}