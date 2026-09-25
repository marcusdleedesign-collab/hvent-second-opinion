import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="text-2xl font-bold tracking-tight">
            HVent
          </div>

          <div className="text-sm text-slate-400">
            Heating & Air
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 py-24 text-center">
        <div className="mx-auto mb-6 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
          Free HVAC Second Opinion
        </div>

        <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          Already have an HVAC quote?
          <span className="mt-3 block text-sky-400">
            Get a second opinion before you decide.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-300">
          Upload the HVAC proposal you already received and get an instant
          automated overview of the major details, what&apos;s included, and
          anything that may be worth clarifying.
        </p>

        <Link
          href="/second-opinion/upload"
          className="mt-10 inline-block rounded-xl bg-sky-500 px-7 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-sky-400"
        >
          Upload My HVAC Quote
        </Link>

        <p className="mt-4 text-sm text-slate-500">
          PDF, JPG, and PNG files supported.
        </p>
      </section>

      {/* How it works */}
      <section className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-12 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-sky-400">
              How it works
            </p>

            <h2 className="mt-3 text-3xl font-bold">
              A clearer look at your quote in three steps
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Step
              number="01"
              title="Upload your quote"
              description="Send us the proposal you already received from another HVAC company."
            />

            <Step
              number="02"
              title="Get an instant overview"
              description="We organize the major equipment, pricing, warranty, and scope details found in your proposal."
            />

            <Step
              number="03"
              title="Request a professional review"
              description="If you want another opinion, send the full proposal to the HVent team for a closer look."
            />
          </div>
        </div>
      </section>

      {/* Trust / disclosure */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <h3 className="font-semibold text-white">
            Your instant overview is automated.
          </h3>

          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            The Quote Overview organizes information found in your uploaded
            proposal. It is not a professional HVAC opinion. You can choose to
            have an HVAC professional review the complete proposal afterward.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-8 text-center text-sm text-slate-500">
          HVent Heating & Air — Demo Environment
        </div>
      </footer>
    </main>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-7">
      <div className="text-sm font-bold text-sky-400">
        {number}
      </div>

      <h3 className="mt-4 text-xl font-semibold">
        {title}
      </h3>

      <p className="mt-3 leading-7 text-slate-400">
        {description}
      </p>
    </div>
  );
}