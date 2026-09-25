import {
  supabaseAdmin,
  SUPABASE_STORAGE_BUCKET,
} from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const leadId = body.leadId;
    const objectPath = body.objectPath;

    if (
      typeof leadId !== "string" ||
      typeof objectPath !== "string"
    ) {
      return Response.json(
        { error: "Invalid retrieval request." },
        { status: 400 }
      );
    }

    // Prevent this route from being used to retrieve
    // arbitrary objects from the bucket.
    const expectedPrefix = `hvent/dev/${leadId}/`;

    if (!objectPath.startsWith(expectedPrefix)) {
      return Response.json(
        { error: "Storage path does not match Lead ID." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .download(objectPath);

    if (error) {
      console.error("Supabase download error:", error);

      return Response.json(
        {
          error: "Unable to retrieve stored quote.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    const buffer = await data.arrayBuffer();

    return Response.json({
      ok: true,
      leadId,
      objectPath,
      fileSize: buffer.byteLength,
      contentType:
        data.type || "application/octet-stream",
      message:
        "Stored quote was successfully retrieved by the server.",
    });
  } catch (error) {
    console.error("Quote retrieval error:", error);

    return Response.json(
      {
        error: "Unable to retrieve quote.",
        details:
          error instanceof Error
            ? error.message
            : "Unknown error.",
      },
      { status: 500 }
    );
  }
}