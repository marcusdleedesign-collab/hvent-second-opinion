"use client";

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import type {
  ReactNode,
} from "react";

import type {
  HomeownerOverview,
  OverviewItem,
  OverviewOption,
} from "@/lib/homeowner-overview";

const RESULT_STORAGE_KEY =
  "hvent-second-opinion-result";

type StoredOverviewResult = {
  mode: "overview";
  leadId: string;
  fileName: string;
  zipCode: string;
  timeline: string;
  concern: string;
  overview: HomeownerOverview;
};

type StoredFallbackResult = {
  mode: "fallback";
  leadId: string;
  fileName: string;
  zipCode: string;
  timeline: string;
  concern: string;
  fallback: {
    title: string;
    message: string;
    issues: string[];
  };
};

type StoredResult =
  | StoredOverviewResult
  | StoredFallbackResult;

export default function QuoteOverviewPage() {
  const [result, setResult] =
    useState<StoredResult | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    try {
      const raw =
        sessionStorage.getItem(
          RESULT_STORAGE_KEY
        );

      if (!raw) {
        setLoading(false);
        return;
      }

      const parsed =
        JSON.parse(raw) as StoredResult;

      setResult(parsed);
    } catch (error) {
      console.error(
        "Unable to load Quote Overview:",
        error
      );
    } finally {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <Header />

        <section className="mx-auto max-w-5xl px-6 py-24 text-center">
          <p className="text-slate-400">
            Loading your Quote Overview...
          </p>
        </section>
      </main>
    );
  }

  if (!result) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <Header />

        <section className="mx-auto max-w-2xl px-6 py-24 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-sky-400">
            Quote Overview
          </p>

          <h1 className="mt-4 text-4xl font-bold tracking-tight">
            Your overview is no longer available in this tab
          </h1>

          <p className="mt-5 leading-7 text-slate-400">
            For this MVP, the homeowner-facing result is
            kept only in the current browser tab. Upload
            the proposal again to create a new overview.
          </p>

          <Link
            href="/second-opinion/upload"
            className="mt-8 inline-flex rounded-xl bg-sky-500 px-6 py-3 font-semibold transition hover:bg-sky-400"
          >
            Upload a Proposal
          </Link>
        </section>
      </main>
    );
  }

  if (result.mode === "fallback") {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <Header />

        <section className="mx-auto max-w-3xl px-6 py-16">
          <div className="rounded-3xl border border-amber-500/20 bg-slate-900 p-8 md:p-10">
            <p className="text-sm font-semibold uppercase tracking-widest text-amber-300">
              Automated overview unavailable
            </p>

            <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
              {result.fallback.title}
            </h1>

            <p className="mt-5 leading-7 text-slate-300">
              {result.fallback.message}
            </p>

            {result.fallback.issues.length > 0 && (
              <div className="mt-7 rounded-2xl border border-white/10 bg-slate-950/50 p-6">
                <h2 className="font-semibold">
                  What we noticed
                </h2>

                <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-400">
                  {result.fallback.issues.map(
                    (issue, index) => (
                      <li
                        key={`${issue}-${index}`}
                      >
                        • {issue}
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}

            <ProfessionalReviewSection
              leadId={result.leadId}
              heading="Want a professional second opinion?"
              body="Even though an automated overview could not be created, you can still provide your contact information and request a professional review of the uploaded proposal."
              buttonLabel="Request a Professional Second Opinion"
            />

            <p className="mt-6 text-xs leading-5 text-slate-500">
              Lead ID: {result.leadId}
            </p>
          </div>
        </section>
      </main>
    );
  }

  const {
    overview,
  } = result;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Header />

      <section className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-5">
          <p className="text-sm leading-6 text-slate-300">
            {overview.disclosure}
          </p>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-slate-900 p-8 md:p-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-sky-400">
            Your Quote Overview
          </p>

          <div className="mt-5 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
                {overview.headline.title}
              </h1>

              {overview.proposal.contractorName && (
                <p className="mt-3 text-lg text-slate-400">
                  Proposal from{" "}
                  {overview.proposal.contractorName}
                </p>
              )}
            </div>

            {overview.headline.price && (
              <div className="md:text-right">
                <p className="text-sm uppercase tracking-wider text-slate-500">
                  Proposal price
                </p>

                <p className="mt-1 text-3xl font-bold">
                  {overview.headline.price}
                </p>
              </div>
            )}
          </div>

          <div className="mt-8 grid gap-4 border-t border-white/10 pt-6 sm:grid-cols-2 lg:grid-cols-4">
            <MetaItem
              label="Proposal #"
              value={
                overview.proposal.proposalNumber
              }
            />

            <MetaItem
              label="Proposal date"
              value={
                overview.proposal.proposalDate
              }
            />

            <MetaItem
              label="Valid through"
              value={
                overview.proposal.expirationDate
              }
            />

            <MetaItem
              label="Lead ID"
              value={result.leadId}
            />
          </div>
        </div>

        <OverviewSection
          eyebrow={
            overview.proposal.hasMultipleOptions
              ? "Proposal options"
              : "Proposed system"
          }
          title={
            overview.proposal.hasMultipleOptions
              ? "What each option includes"
              : "System and equipment"
          }
        >
          <div
            className={
              overview.options.length > 1
                ? "grid gap-5 lg:grid-cols-3"
                : "grid gap-5"
            }
          >
            {overview.options.map(
              (option) => (
                <OptionCard
                  key={option.id}
                  option={option}
                />
              )
            )}
          </div>
        </OverviewSection>

        {overview.includedScope.length > 0 && (
          <OverviewSection
            eyebrow="Included scope"
            title="Work identified in the proposal"
          >
            <div className="grid gap-4 md:grid-cols-2">
              {overview.includedScope.map(
                (item) => (
                  <InfoCard
                    key={item.id}
                    item={item}
                    marker="✓"
                  />
                )
              )}
            </div>
          </OverviewSection>
        )}

        {overview.terms.length > 0 && (
          <OverviewSection
            eyebrow="Warranty & payment"
            title="Terms identified in the proposal"
          >
            <div className="grid gap-4 md:grid-cols-2">
              {overview.terms.map(
                (item) => (
                  <InfoCard
                    key={item.id}
                    item={item}
                  />
                )
              )}
            </div>
          </OverviewSection>
        )}

        {overview.exclusions.length > 0 && (
          <OverviewSection
            eyebrow="Explicit exclusions"
            title="Work the proposal says is not included"
          >
            <div className="space-y-4">
              {overview.exclusions.map(
                (item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5"
                  >
                    <p className="font-semibold text-red-200">
                      {item.label}
                    </p>

                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {item.text}
                    </p>
                  </div>
                )
              )}
            </div>
          </OverviewSection>
        )}

        <OverviewSection
          eyebrow="Worth clarifying"
          title={
            overview.clarifications.length > 0
              ? "Details to ask about"
              : "No configured clarification items were identified"
          }
        >
          <p className="mb-5 text-sm leading-6 text-slate-400">
            {overview.uncertaintyNote}
          </p>

          {overview.clarifications.length > 0 && (
            <div className="space-y-4">
              {overview.clarifications.map(
                (item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-sm font-bold text-amber-300">
                        ?
                      </span>

                      <div>
                        <p className="font-semibold text-amber-100">
                          {item.label}
                        </p>

                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          {item.message}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </OverviewSection>

        <ProfessionalReviewSection
          leadId={result.leadId}
          heading={
            overview.professionalReview.heading
          }
          body={
            overview.professionalReview.body
          }
          buttonLabel={
            overview.professionalReview.buttonLabel
          }
        />
      </section>
    </main>
  );
}

function ProfessionalReviewSection({
  leadId,
  heading,
  body,
  buttonLabel,
}: {
  leadId: string;
  heading: string;
  body: string;
  buttonLabel: string;
}) {
  const [isOpen, setIsOpen] =
    useState(false);

  const [firstName, setFirstName] =
    useState("");

  const [lastName, setLastName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [consent, setConsent] =
    useState(false);

  const [formError, setFormError] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const [submitted, setSubmitted] =
    useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setFormError("");

    const cleanFirstName =
      firstName.trim();

    const cleanLastName =
      lastName.trim();

    const cleanEmail =
      email.trim();

    const cleanPhone =
      phone.trim();

    const cleanMessage =
      message.trim();

    if (!cleanFirstName) {
      setFormError(
        "Please enter your first name."
      );
      return;
    }

    if (!cleanEmail) {
      setFormError(
        "Please enter your email address."
      );
      return;
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        cleanEmail
      )
    ) {
      setFormError(
        "Please enter a valid email address."
      );
      return;
    }

    if (!consent) {
      setFormError(
        "Please confirm that HVent may receive your contact information and uploaded proposal for the professional review."
      );
      return;
    }

    try {
      setSubmitting(true);

      const response =
        await fetch(
          "/api/leads/request-review",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              leadId,

              firstName:
                cleanFirstName,

              lastName:
                cleanLastName,

              email:
                cleanEmail,

              phone:
                cleanPhone,

              message:
                cleanMessage,

              consent:
                true,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Your request could not be submitted."
        );
      }

      setSubmitted(true);
    } catch (error) {
      console.error(
        "Professional review submission failed:",
        error
      );

      setFormError(
        error instanceof Error
          ? error.message
          : "Your request could not be submitted. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-8 rounded-3xl border border-sky-500/20 bg-gradient-to-br from-sky-500/10 to-slate-900 p-8 md:p-10">
      <p className="text-sm font-semibold uppercase tracking-widest text-sky-400">
        Professional review
      </p>

      <h2 className="mt-3 text-3xl font-bold tracking-tight">
        {heading}
      </h2>

      <p className="mt-4 max-w-3xl leading-7 text-slate-300">
        {body}
      </p>

      {submitted ? (
        <div className="mt-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 font-bold text-emerald-300">
              ✓
            </span>

            <div>
              <h3 className="text-lg font-semibold text-emerald-100">
                Your second-opinion request was submitted.
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-300">
                HVent has received your proposal and
                contact information for professional
                review.
              </p>

              <p className="mt-3 text-xs text-slate-500">
                Reference: {leadId}
              </p>
            </div>
          </div>
        </div>
      ) : !isOpen ? (
        <button
          type="button"
          onClick={() =>
            setIsOpen(true)
          }
          className="mt-6 w-full rounded-xl bg-sky-500 px-6 py-3 font-semibold transition hover:bg-sky-400 sm:w-auto"
        >
          {buttonLabel}
        </button>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mt-8 border-t border-white/10 pt-8"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="review-first-name"
                className="block text-sm font-medium text-slate-200"
              >
                First name
              </label>

              <input
                id="review-first-name"
                type="text"
                autoComplete="given-name"
                maxLength={80}
                required
                disabled={submitting}
                value={firstName}
                onChange={(event) =>
                  setFirstName(
                    event.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <div>
              <label
                htmlFor="review-last-name"
                className="block text-sm font-medium text-slate-200"
              >
                Last name{" "}
                <span className="text-slate-500">
                  (optional)
                </span>
              </label>

              <input
                id="review-last-name"
                type="text"
                autoComplete="family-name"
                maxLength={80}
                disabled={submitting}
                value={lastName}
                onChange={(event) =>
                  setLastName(
                    event.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <div>
              <label
                htmlFor="review-email"
                className="block text-sm font-medium text-slate-200"
              >
                Email
              </label>

              <input
                id="review-email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
                disabled={submitting}
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <div>
              <label
                htmlFor="review-phone"
                className="block text-sm font-medium text-slate-200"
              >
                Phone{" "}
                <span className="text-slate-500">
                  (optional)
                </span>
              </label>

              <input
                id="review-phone"
                type="tel"
                autoComplete="tel"
                maxLength={40}
                disabled={submitting}
                value={phone}
                onChange={(event) =>
                  setPhone(
                    event.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </div>

          <div className="mt-5">
            <label
              htmlFor="review-message"
              className="block text-sm font-medium text-slate-200"
            >
              Anything you want the HVAC team to know?{" "}
              <span className="text-slate-500">
                (optional)
              </span>
            </label>

            <textarea
              id="review-message"
              rows={4}
              maxLength={1000}
              disabled={submitting}
              value={message}
              onChange={(event) =>
                setMessage(
                  event.target.value
                )
              }
              placeholder="Add any questions or context you want the reviewer to see."
              className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-5">
            <input
              type="checkbox"
              checked={consent}
              disabled={submitting}
              onChange={(event) =>
                setConsent(
                  event.target.checked
                )
              }
              className="mt-1 h-4 w-4 shrink-0 accent-sky-500"
            />

            <span className="text-sm leading-6 text-slate-300">
              I agree that my contact information
              and uploaded proposal may be shared
              with HVent so they can review it and
              contact me about my second-opinion
              request.
            </span>
          </label>

          {formError && (
            <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
              <p className="text-sm text-red-300">
                {formError}
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setIsOpen(false);
                setFormError("");
              }}
              className="rounded-xl border border-white/10 px-6 py-3 font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-sky-500 px-6 py-3 font-semibold transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting
                ? "Submitting Request..."
                : "Submit Request"}
            </button>
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500">
            Your contact information and uploaded
            proposal will be used only for this
            second-opinion request.
          </p>
        </form>
      )}
    </section>
  );
}

function Header() {
  return (
    <header className="border-b border-white/10 bg-slate-950">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link
          href="/"
          className="text-2xl font-bold tracking-tight"
        >
          HVent
        </Link>

        <span className="text-sm text-slate-400">
          Free HVAC Second Opinion
        </span>
      </div>
    </header>
  );
}

function OverviewSection({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-8 rounded-3xl border border-white/10 bg-slate-900 p-6 md:p-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        {eyebrow}
      </p>

      <h2 className="mt-2 text-2xl font-bold tracking-tight">
        {title}
      </h2>

      <div className="mt-6">
        {children}
      </div>
    </section>
  );
}

function OptionCard({
  option,
}: {
  option: OverviewOption;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold">
            {option.label}
          </p>

          {option.efficiency.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {option.efficiency.map(
                (item) => (
                  <span
                    key={item.id}
                    className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300"
                  >
                    {item.value}
                  </span>
                )
              )}
            </div>
          )}
        </div>

        {option.price && (
          <p className="shrink-0 text-xl font-bold">
            {option.price.value}
          </p>
        )}
      </div>

      {option.equipment.length > 0 && (
        <div className="mt-6 space-y-4 border-t border-white/10 pt-5">
          {option.equipment.map(
            (equipment) => (
              <div key={equipment.id}>
                <p className="font-medium">
                  {equipment.name}
                </p>

                {equipment.details.length > 0 && (
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    {equipment.details.join(
                      " · "
                    )}
                  </p>
                )}
              </div>
            )
          )}
        </div>
      )}

      {(option.laborWarranty ||
        option.financing) && (
        <div className="mt-6 space-y-4 border-t border-white/10 pt-5">
          {option.laborWarranty && (
            <OptionTerm
              item={option.laborWarranty}
            />
          )}

          {option.financing && (
            <OptionTerm
              item={option.financing}
            />
          )}
        </div>
      )}
    </article>
  );
}

function OptionTerm({
  item,
}: {
  item: OverviewItem;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {item.label}
      </p>

      <p className="mt-1 text-sm leading-6 text-slate-300">
        {item.value}
      </p>
    </div>
  );
}

function InfoCard({
  item,
  marker,
}: {
  item: OverviewItem;
  marker?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-5">
      <div className="flex items-start gap-3">
        {marker && (
          <span className="mt-0.5 text-emerald-400">
            {marker}
          </span>
        )}

        <div>
          <p className="font-semibold">
            {item.label}
          </p>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            {item.value}
          </p>
        </div>
      </div>
    </div>
  );
}

function MetaItem({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-sm text-slate-200">
        {value || "Not identified"}
      </p>
    </div>
  );
}