"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useState,
} from "react";

import { supabaseBrowser } from "@/lib/supabase-browser";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];

const RESULT_STORAGE_KEY =
  "hvent-second-opinion-result";

type Step = 1 | 2 | 3;

type ProcessingPhase =
  | "idle"
  | "uploading"
  | "checking"
  | "extracting";

type FallbackInfo = {
  title: string;
  message: string;
  issues: string[];
};

export default function UploadPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [fileError, setFileError] = useState("");

  const [zipCode, setZipCode] = useState("");
  const [timeline, setTimeline] = useState("");
  const [concern, setConcern] = useState("");
  const [formError, setFormError] = useState("");

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [processingPhase, setProcessingPhase] =
    useState<ProcessingPhase>("idle");

  const [leadId, setLeadId] = useState("");
  const [objectPath, setObjectPath] = useState("");

  const [fallbackInfo, setFallbackInfo] =
    useState<FallbackInfo | null>(null);

  function validateFile(file: File) {
    setFileError("");
    setUploadError("");
    setFallbackInfo(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setSelectedFile(null);

      setFileError(
        "Please upload a PDF, JPG, JPEG, or PNG file."
      );

      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setSelectedFile(null);

      setFileError(
        "Please upload a file smaller than 10 MB."
      );

      return;
    }

    setSelectedFile(file);
  }

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (file) {
      validateFile(file);
    }
  }

  function handleDrop(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();

    const file = event.dataTransfer.files?.[0];

    if (file) {
      validateFile(file);
    }
  }

  function handleDragOver(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();
  }

  function removeFile() {
    setSelectedFile(null);
    setFileError("");
    setUploadError("");
    setLeadId("");
    setObjectPath("");
    setFallbackInfo(null);
    setProcessingPhase("idle");
    setStep(1);
  }

  function continueToQuestions() {
    if (!selectedFile) {
      return;
    }

    setUploadError("");
    setFallbackInfo(null);
    setStep(2);
  }

  async function handleQuestionsSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setFormError("");
    setUploadError("");
    setFallbackInfo(null);

    const cleanZip = zipCode.trim();

    if (!/^\d{5}$/.test(cleanZip)) {
      setFormError(
        "Please enter a valid 5-digit ZIP code."
      );

      return;
    }

    if (!timeline) {
      setFormError(
        "Please choose when you hope to have the work done."
      );

      return;
    }

    if (!selectedFile) {
      setUploadError(
        "Your quote file is no longer selected. Please go back and choose it again."
      );

      return;
    }

    try {
      setUploading(true);

      /*
       * 1. Secure upload.
       */
      setProcessingPhase("uploading");

      const signResponse = await fetch(
        "/api/uploads/sign",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            fileType: selectedFile.type,
            fileSize: selectedFile.size,
          }),
        }
      );

      const signData = await signResponse.json();

      if (!signResponse.ok) {
        throw new Error(
          signData.details ||
            signData.error ||
            "Unable to prepare secure upload."
        );
      }

      const { error: storageError } =
        await supabaseBrowser.storage
          .from(signData.bucket)
          .uploadToSignedUrl(
            signData.objectPath,
            signData.token,
            selectedFile,
            {
              contentType: selectedFile.type,
            }
          );

      if (storageError) {
        throw storageError;
      }

      setLeadId(signData.leadId);
      setObjectPath(signData.objectPath);

      /*
       * Register the uploaded proposal as a lead
       * before starting automated processing.
       *
       * The browser does not write to Supabase
       * tables directly. This trusted server route
       * validates the intake and creates the row.
       */
      const registerResponse =
        await fetch(
          "/api/leads/register",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              leadId:
                signData.leadId,

              objectPath:
                signData.objectPath,

              fileName:
                selectedFile.name,

              fileType:
                selectedFile.type,

              fileSize:
                selectedFile.size,

              zipCode:
                cleanZip,

              timeline,

              concern,
            }),
          }
        );

      const registerData =
        await registerResponse.json();

      if (!registerResponse.ok) {
        throw new Error(
          registerData.details ||
            registerData.error ||
            "Unable to register your quote for review."
        );
      }

      /*
       * 2. Document pre-check.
       */
      setProcessingPhase("checking");

      const precheckResponse = await fetch(
        "/api/process/precheck",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            leadId: signData.leadId,
            objectPath: signData.objectPath,
          }),
        }
      );

      const precheckData =
        await precheckResponse.json();

      if (!precheckResponse.ok) {
        throw new Error(
          precheckData.details ||
            precheckData.error ||
            "Unable to check the uploaded proposal."
        );
      }

      /*
       * The current pre-check route may return the
       * structured fields directly or under a named
       * result object. Supporting both keeps the UI
       * isolated from harmless response wrapping.
       */
      const precheck =
        precheckData.precheck ??
        precheckData.documentPrecheck ??
        precheckData.result ??
        precheckData;

      const readability =
        precheck.readability;

      const issues =
        Array.isArray(precheck.issues)
          ? precheck.issues.filter(
              (issue: unknown): issue is string =>
                typeof issue === "string"
            )
          : [];

      if (
        readability === "UNABLE_TO_REVIEW"
      ) {
        setFallbackInfo({
          title:
            "We couldn’t reliably review this proposal",

          message:
            typeof precheck.summary === "string" &&
            precheck.summary.trim() !== ""
              ? precheck.summary
              : "The uploaded document is not clear enough for a reliable automated overview.",

          issues,
        });

        setStep(3);
        return;
      }

      if (
        precheck.is_hvac_proposal === false
      ) {
        setFallbackInfo({
          title:
            "We couldn’t confirm this is an HVAC proposal",

          message:
            typeof precheck.summary === "string" &&
            precheck.summary.trim() !== ""
              ? precheck.summary
              : "The uploaded document could not be reliably identified as an HVAC proposal.",

          issues,
        });

        setStep(3);
        return;
      }

      /*
       * 3. Full factual extraction + validation +
       * normalization + flagging + overview builder.
       */
      setProcessingPhase("extracting");

      const extractResponse = await fetch(
        "/api/process/extract",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            leadId: signData.leadId,
            objectPath: signData.objectPath,
          }),
        }
      );

      const extractData =
        await extractResponse.json();

      if (!extractResponse.ok) {
        throw new Error(
          extractData.details ||
            extractData.error ||
            "Unable to create your Quote Overview."
        );
      }

      if (!extractData.overview) {
        throw new Error(
          "The proposal was processed, but the Quote Overview was not returned."
        );
      }

      /*
       * Temporary MVP handoff:
       *
       * Store only homeowner-facing result data in
       * sessionStorage. Do not store the raw extraction,
       * private storage path, or document bytes here.
       *
       * We can replace this with database-backed result
       * retrieval once lead persistence is connected.
       */
      sessionStorage.setItem(
        RESULT_STORAGE_KEY,
        JSON.stringify({
          mode: "overview",
          leadId: signData.leadId,
          fileName: selectedFile.name,
          zipCode: cleanZip,
          timeline,
          concern,
          overview: extractData.overview,
        })
      );

      router.push(
        "/second-opinion/overview"
      );
    } catch (error) {
      console.error(
        "Quote processing failed:",
        error
      );

      setUploadError(
        error instanceof Error
          ? error.message
          : "Your quote could not be processed. Please try again."
      );
    } finally {
      setUploading(false);
      setProcessingPhase("idle");
    }
  }

  function handleTryAgain() {
    setSelectedFile(null);
    setFileError("");
    setUploadError("");
    setLeadId("");
    setObjectPath("");
    setFallbackInfo(null);
    setProcessingPhase("idle");
    setStep(1);
  }

  function handleContinueWithoutOverview() {
    if (
      !fallbackInfo ||
      !selectedFile ||
      !leadId
    ) {
      return;
    }

    sessionStorage.setItem(
      RESULT_STORAGE_KEY,
      JSON.stringify({
        mode: "fallback",
        leadId,
        fileName: selectedFile.name,
        zipCode: zipCode.trim(),
        timeline,
        concern,
        fallback: fallbackInfo,
      })
    );

    router.push(
      "/second-opinion/overview"
    );
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(
      bytes /
      (1024 * 1024)
    ).toFixed(1)} MB`;
  }

  function getSubmitButtonLabel() {
    if (!uploading) {
      return "Review My Quote";
    }

    if (
      processingPhase === "uploading"
    ) {
      return "Securely Uploading Quote...";
    }

    if (
      processingPhase === "checking"
    ) {
      return "Checking Document...";
    }

    if (
      processingPhase === "extracting"
    ) {
      return "Creating Quote Overview...";
    }

    return "Processing...";
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
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

      <section className="mx-auto max-w-3xl px-6 py-20">
        {step === 1 && (
          <>
            <PageHeading
              step="Step 1"
              title="Upload your HVAC proposal"
              description="Upload the quote or proposal you already received. We'll organize the major details so you can better understand what is listed before deciding what to do next."
            />

            <div className="rounded-3xl border border-white/10 bg-slate-900 p-8">
              {!selectedFile ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="rounded-2xl border-2 border-dashed border-slate-700 px-6 py-14 text-center transition hover:border-sky-500"
                >
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/10 text-2xl">
                    ↑
                  </div>

                  <h2 className="mt-5 text-xl font-semibold">
                    Drop your quote here
                  </h2>

                  <p className="mt-2 text-sm text-slate-400">
                    or choose a file from your device
                  </p>

                  <label
                    htmlFor="quote-file"
                    className="mt-6 inline-block cursor-pointer rounded-xl bg-sky-500 px-6 py-3 font-semibold transition hover:bg-sky-400"
                  >
                    Choose File
                  </label>

                  <input
                    id="quote-file"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  <p className="mt-4 text-xs text-slate-500">
                    PDF, JPG, JPEG, or PNG · Maximum
                    10 MB
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-emerald-400">
                        Quote selected
                      </p>

                      <p className="mt-2 break-all font-medium text-white">
                        {selectedFile.name}
                      </p>

                      <p className="mt-1 text-sm text-slate-400">
                        {formatFileSize(
                          selectedFile.size
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={removeFile}
                      className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="mt-6 rounded-xl border border-white/10 bg-slate-950/50 p-4">
                    <p className="text-sm text-slate-300">
                      ✓ File type accepted
                    </p>

                    <p className="mt-2 text-sm text-slate-300">
                      ✓ File size accepted
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={continueToQuestions}
                    className="mt-6 w-full rounded-xl bg-sky-500 px-6 py-3 font-semibold transition hover:bg-sky-400"
                  >
                    Continue
                  </button>
                </div>
              )}

              {fileError && (
                <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
                  <p className="text-sm text-red-300">
                    {fileError}
                  </p>
                </div>
              )}

              <Disclosure />
            </div>

            <BackHome />
          </>
        )}

        {step === 2 && (
          <>
            <PageHeading
              step="Step 2"
              title="A few quick details"
              description="This helps the HVent team understand your situation if you decide to request a professional second opinion."
            />

            <form
              onSubmit={handleQuestionsSubmit}
              className="rounded-3xl border border-white/10 bg-slate-900 p-8"
            >
              <div className="mb-8 rounded-2xl border border-white/10 bg-slate-950/50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Selected quote
                </p>

                <p className="mt-2 break-all font-medium">
                  {selectedFile?.name}
                </p>

                {selectedFile && (
                  <p className="mt-1 text-sm text-slate-400">
                    {formatFileSize(
                      selectedFile.size
                    )}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="zip"
                  className="block font-medium"
                >
                  Property ZIP code
                </label>

                <p className="mt-1 text-sm text-slate-400">
                  Used to determine whether the
                  property is within the company&apos;s
                  service area.
                </p>

                <input
                  id="zip"
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  value={zipCode}
                  onChange={(event) =>
                    setZipCode(
                      event.target.value.replace(
                        /\D/g,
                        ""
                      )
                    )
                  }
                  placeholder="22554"
                  disabled={uploading}
                  className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              <div className="mt-8">
                <label
                  htmlFor="timeline"
                  className="block font-medium"
                >
                  When are you hoping to have the work
                  done?
                </label>

                <select
                  id="timeline"
                  value={timeline}
                  disabled={uploading}
                  onChange={(event) =>
                    setTimeline(event.target.value)
                  }
                  className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">
                    Choose a timeframe
                  </option>

                  <option value="As soon as possible">
                    As soon as possible
                  </option>

                  <option value="Within 30 days">
                    Within 30 days
                  </option>

                  <option value="1–3 months">
                    1–3 months
                  </option>

                  <option value="Just researching">
                    Just researching
                  </option>
                </select>
              </div>

              <div className="mt-8">
                <label
                  htmlFor="concern"
                  className="block font-medium"
                >
                  What are you most concerned about?
                </label>

                <p className="mt-1 text-sm text-slate-400">
                  Optional
                </p>

                <select
                  id="concern"
                  value={concern}
                  disabled={uploading}
                  onChange={(event) =>
                    setConcern(event.target.value)
                  }
                  className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">
                    No specific concern
                  </option>

                  <option value="Price">
                    Price
                  </option>

                  <option value="Equipment being recommended">
                    Equipment being recommended
                  </option>

                  <option value="Warranty">
                    Warranty
                  </option>

                  <option value="What's included / scope">
                    What&apos;s included / scope
                  </option>

                  <option value="Financing">
                    Financing
                  </option>

                  <option value="I just want another opinion">
                    I just want another opinion
                  </option>

                  <option value="Other">
                    Other
                  </option>
                </select>
              </div>

              {formError && (
                <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
                  <p className="text-sm text-red-300">
                    {formError}
                  </p>
                </div>
              )}

              {uploadError && (
                <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
                  <p className="text-sm text-red-300">
                    {uploadError}
                  </p>
                </div>
              )}

              {uploading && (
                <ProcessingPanel
                  phase={processingPhase}
                />
              )}

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => setStep(1)}
                  className="rounded-xl border border-white/10 px-6 py-3 font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-1/3"
                >
                  Back
                </button>

                <button
                  type="submit"
                  disabled={uploading}
                  className="rounded-xl bg-sky-500 px-6 py-3 font-semibold transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-2/3"
                >
                  {getSubmitButtonLabel()}
                </button>
              </div>

              <Disclosure />
            </form>
          </>
        )}

        {step === 3 && fallbackInfo && (
          <>
            <PageHeading
              step="Automated review unavailable"
              title={fallbackInfo.title}
              description="You can try a clearer copy or continue without the automated Quote Overview."
            />

            <div className="rounded-3xl border border-amber-500/20 bg-slate-900 p-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-2xl text-amber-300">
                !
              </div>

              <h2 className="mt-5 text-2xl font-semibold">
                Automated overview not created
              </h2>

              <p className="mt-3 leading-7 text-slate-300">
                {fallbackInfo.message}
              </p>

              {fallbackInfo.issues.length > 0 && (
                <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/50 p-5">
                  <p className="font-semibold">
                    What we noticed
                  </p>

                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-400">
                    {fallbackInfo.issues.map(
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

              <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/50 p-5">
                <SummaryRow
                  label="Quote"
                  value={
                    selectedFile?.name ||
                    "Uploaded proposal"
                  }
                />

                <SummaryRow
                  label="Lead ID"
                  value={leadId}
                />

                <SummaryRow
                  label="Storage status"
                  value={
                    objectPath
                      ? "Securely uploaded"
                      : "Upload unavailable"
                  }
                />
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleTryAgain}
                  className="rounded-xl border border-white/10 px-6 py-3 font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white sm:w-1/2"
                >
                  Try Again
                </button>

                <button
                  type="button"
                  onClick={handleContinueWithoutOverview}
                  className="rounded-xl bg-sky-500 px-6 py-3 font-semibold transition hover:bg-sky-400 sm:w-1/2"
                >
                  Continue Without Automated Overview
                </button>
              </div>

              <Disclosure />
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function ProcessingPanel({
  phase,
}: {
  phase: ProcessingPhase;
}) {
  const stages = [
    {
      id: "uploading" as const,
      label: "Secure upload",
      description:
        "Sending your proposal to private storage.",
    },
    {
      id: "checking" as const,
      label: "Document check",
      description:
        "Checking readability and document quality.",
    },
    {
      id: "extracting" as const,
      label: "Creating Quote Overview",
      description:
        "Organizing the proposal into homeowner-friendly details.",
    },
  ];

  const currentIndex = Math.max(
    0,
    stages.findIndex(
      (stage) => stage.id === phase
    )
  );

  const activeStage =
    stages[currentIndex];

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-sky-500/20 bg-sky-500/5">
      <div className="p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500/10">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-sky-400" />
          </span>

          <div>
            <p className="font-semibold text-sky-100">
              {activeStage.label}
            </p>

            <p className="mt-1 text-sm leading-6 text-slate-300">
              {activeStage.description}
            </p>

            <p className="mt-2 text-xs text-slate-500">
              This can take a few moments. Please keep
              this page open while we finish.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {stages.map(
            (stage, index) => {
              const isComplete =
                index < currentIndex;

              const isActive =
                index === currentIndex;

              return (
                <div
                  key={stage.id}
                  className="flex items-center gap-3 text-sm"
                >
                  <span
                    className={[
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                      isComplete
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : isActive
                          ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
                          : "border-white/10 bg-white/5 text-slate-600",
                    ].join(" ")}
                  >
                    {isComplete
                      ? "✓"
                      : index + 1}
                  </span>

                  <span
                    className={
                      isComplete
                        ? "text-slate-300"
                        : isActive
                          ? "font-medium text-white"
                          : "text-slate-600"
                    }
                  >
                    {stage.label}
                  </span>
                </div>
              );
            }
          )}
        </div>
      </div>

      <div className="h-1.5 overflow-hidden bg-slate-950/70">
        <div
          className="hvent-processing-reduced-motion h-full w-1/3 rounded-full bg-sky-400"
          style={{
            animation:
              "hvent-processing-bar 1.35s ease-in-out infinite",
          }}
        />
      </div>

      <style>{`
        @keyframes hvent-processing-bar {
          0% {
            transform: translateX(-120%);
          }

          50% {
            transform: translateX(145%);
          }

          100% {
            transform: translateX(310%);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .hvent-processing-reduced-motion {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function PageHeading({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-10 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-sky-400">
        {step}
      </p>

      <h1 className="mt-3 text-4xl font-bold tracking-tight">
        {title}
      </h1>

      <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-400">
        {description}
      </p>
    </div>
  );
}

function Disclosure() {
  return (
    <div className="mt-6 rounded-xl bg-white/5 p-4">
      <p className="text-sm leading-6 text-slate-400">
        Your proposal is uploaded to private storage
        and processed automatically to create your
        Quote Overview. It is not publicly accessible.
        If you choose to request a professional second
        opinion, your proposal and contact information
        will be shared with HVent for that review. The
        automated overview is not a professional HVAC
        opinion.
      </p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-white/10 pb-4 last:border-0 last:pb-0 sm:flex-row sm:justify-between sm:gap-6">
      <span className="text-sm text-slate-500">
        {label}
      </span>

      <span className="break-all text-sm font-medium text-slate-200 sm:text-right">
        {value}
      </span>
    </div>
  );
}

function BackHome() {
  return (
    <div className="mt-8 text-center">
      <Link
        href="/"
        className="text-sm text-slate-400 transition hover:text-white"
      >
        ← Back
      </Link>
    </div>
  );
}
