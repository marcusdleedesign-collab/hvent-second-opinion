import { openai } from "@/lib/openai";

export async function POST() {
  try {
    const response = await openai.responses.create({
      model: "gpt-5.6-terra",
      input:
        "Reply with exactly: Second Opinion Engine connection successful.",
      store: false,
    });

    return Response.json({
      ok: true,
      output: response.output_text,
    });
  } catch (error) {
    console.error("OpenAI test failed:", error);

    return Response.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Unknown OpenAI error.",
      },
      { status: 500 }
    );
  }
}