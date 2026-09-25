import type {
  HVACProposalExtractionType,
} from "@/lib/hvac-extraction-schema";

type Fact =
  HVACProposalExtractionType[
    "shared_details"
  ]["scope"]["line_set"];

type ExtractionStatus = Fact["status"];

export type FlagCategory =
  | "WORTH_CLARIFYING"
  | "UNCERTAIN"
  | "CONTRACTOR_ONLY";

export type SourceReference = {
  path: string;
  page: number | null;
  evidence: string | null;
};

export type HomeownerFlag = {
  id: string;
  category:
    | "WORTH_CLARIFYING"
    | "UNCERTAIN";
  priority: number;
  label: string;
  message: string;
  status: ExtractionStatus;
  sources: SourceReference[];
};

export type ClearlyStatedItem = {
  id: string;
  label: string;
  message: string;
  status: ExtractionStatus;
  sources: SourceReference[];
};

export type ExplicitExclusion = {
  id: string;
  label: string;
  text: string;
  sources: SourceReference[];
};

export type ContractorOnlyItem = {
  id: string;
  category: "CONTRACTOR_ONLY";
  label: string;
  message: string;
  status: ExtractionStatus;
  sources: SourceReference[];
};

export type FlaggingResult = {
  homeownerClarifications: HomeownerFlag[];
  clearlyStated: ClearlyStatedItem[];
  explicitExclusions: ExplicitExclusion[];
  contractorOnly: ContractorOnlyItem[];
};

type ResolvedFact = {
  status: ExtractionStatus;
  facts: Array<{
    fact: Fact;
    path: string;
  }>;
};

const MAX_HOMEOWNER_CLARIFICATIONS = 5;

export function buildFlaggingResult(
  extraction: HVACProposalExtractionType
): FlaggingResult {
  const homeownerClarifications: HomeownerFlag[] = [];
  const clearlyStated: ClearlyStatedItem[] = [];
  const explicitExclusions: ExplicitExclusion[] = [];
  const contractorOnly: ContractorOnlyItem[] = [];

  /*
   * LABOR WARRANTY
   *
   * Special handling is required because:
   *
   * - a single proposal may state it in shared details
   * - a multi-option proposal may have a different
   *   labor warranty for each option
   */
  const laborWarranty = resolveAcrossProposal(
    extraction.shared_details.warranties.labor,
    "shared_details.warranties.labor",
    extraction.options.map(
      (option, index) => ({
        fact: option.warranties.labor,
        path: `options[${index}].warranties.labor`,
      })
    )
  );

  addHomeownerRule(
    homeownerClarifications,
    laborWarranty,
    {
      id: "labor-warranty",
      label: "Labor warranty",
      priority: 100,

      missingMessage:
        "A labor-warranty term was not clearly identified in the proposal.",

      uncertainMessage:
        "The proposal contains labor-warranty information, but the coverage is not completely clear.",
    }
  );

  if (laborWarranty.status === "FOUND") {
    clearlyStated.push({
      id: "labor-warranty",
      label: "Labor warranty",

      message:
        extraction.options.length > 1
          ? "Labor-warranty terms are stated for each proposal option."
          : getFirstValue(
              laborWarranty,
              "Labor-warranty terms are stated."
            ),

      status: "FOUND",

      sources:
        getSources(laborWarranty),
    });
  }

  /*
   * PERMIT RESPONSIBILITY
   */
  const permitResponsibility =
    resolveAcrossProposal(
      extraction.shared_details.scope
        .permit_responsibility,

      "shared_details.scope.permit_responsibility",

      extraction.options.map(
        (option, index) => ({
          fact:
            option.scope
              .permit_responsibility,

          path:
            `options[${index}].scope.permit_responsibility`,
        })
      )
    );

  addHomeownerRule(
    homeownerClarifications,
    permitResponsibility,
    {
      id: "permit-responsibility",
      label: "Permit responsibility",
      priority: 95,

      missingMessage:
        "Who is responsible for obtaining required permits was not clearly identified in the proposal.",

      uncertainMessage:
        "The proposal mentions permits, but responsibility for them is not completely clear.",
    }
  );

  if (
    permitResponsibility.status ===
    "FOUND"
  ) {
    clearlyStated.push({
      id: "permit-responsibility",

      label:
        "Permit responsibility",

      message:
        getFirstValue(
          permitResponsibility,
          "Permit responsibility is stated."
        ),

      status: "FOUND",

      sources:
        getSources(
          permitResponsibility
        ),
    });
  }

  /*
   * REMOVAL / DISPOSAL
   */
  const removal =
    resolveAcrossProposal(
      extraction.shared_details.scope
        .removal_and_disposal,

      "shared_details.scope.removal_and_disposal",

      extraction.options.map(
        (option, index) => ({
          fact:
            option.scope
              .removal_and_disposal,

          path:
            `options[${index}].scope.removal_and_disposal`,
        })
      )
    );

  addHomeownerRule(
    homeownerClarifications,
    removal,
    {
      id: "removal-disposal",
      label: "Removal and disposal",
      priority: 90,

      missingMessage:
        "Removal and disposal of the existing HVAC equipment was not clearly identified in the proposal.",

      uncertainMessage:
        "The proposal mentions removal or disposal, but the scope is not completely clear.",
    }
  );

  if (removal.status === "FOUND") {
    clearlyStated.push({
      id: "removal-disposal",

      label:
        "Removal and disposal",

      message:
        getFirstValue(
          removal,
          "Removal and disposal are stated."
        ),

      status: "FOUND",

      sources:
        getSources(removal),
    });
  }

  /*
   * PAYMENT SCHEDULE
   */
  const paymentSchedule =
    resolveAcrossProposal(
      extraction.shared_details
        .payment_financing
        .payment_schedule,

      "shared_details.payment_financing.payment_schedule",

      extraction.options.map(
        (option, index) => ({
          fact:
            option.payment_financing
              .payment_schedule,

          path:
            `options[${index}].payment_financing.payment_schedule`,
        })
      )
    );

  addHomeownerRule(
    homeownerClarifications,
    paymentSchedule,
    {
      id: "payment-schedule",
      label: "Payment schedule",
      priority: 85,

      missingMessage:
        "The payment schedule was not clearly identified in the proposal.",

      uncertainMessage:
        "The proposal contains payment information, but the payment schedule is not completely clear.",
    }
  );

  if (
    paymentSchedule.status === "FOUND"
  ) {
    clearlyStated.push({
      id: "payment-schedule",

      label:
        "Payment schedule",

      message:
        getFirstValue(
          paymentSchedule,
          "Payment terms are stated."
        ),

      status: "FOUND",

      sources:
        getSources(
          paymentSchedule
        ),
    });
  }

  /*
   * DUCTWORK
   */
  const ductwork =
    resolveAcrossProposal(
      extraction.shared_details.scope
        .ductwork,

      "shared_details.scope.ductwork",

      extraction.options.map(
        (option, index) => ({
          fact:
            option.scope.ductwork,

          path:
            `options[${index}].scope.ductwork`,
        })
      )
    );

  addHomeownerRule(
    homeownerClarifications,
    ductwork,
    {
      id: "ductwork-scope",
      label: "Ductwork scope",
      priority: 80,

      missingMessage:
        "The proposal does not clearly identify what ductwork, if any, is included.",

      uncertainMessage:
        "The proposal mentions ductwork, but the included scope is not completely clear.",
    }
  );

  /*
   * REFRIGERANT LINE SET
   */
  const lineSet =
    resolveAcrossProposal(
      extraction.shared_details.scope
        .line_set,

      "shared_details.scope.line_set",

      extraction.options.map(
        (option, index) => ({
          fact:
            option.scope.line_set,

          path:
            `options[${index}].scope.line_set`,
        })
      )
    );

  addHomeownerRule(
    homeownerClarifications,
    lineSet,
    {
      id: "line-set",
      label: "Refrigerant piping",
      priority: 75,

      missingMessage:
        "The proposal does not clearly state how the existing refrigerant piping or line set will be handled.",

      uncertainMessage:
        "The proposal discusses the refrigerant piping, but whether it will be reused, replaced, or require additional work is not completely clear.",
    }
  );

  /*
   * THERMOSTAT
   */
  const thermostat =
    resolveAcrossProposal(
      extraction.shared_details.scope
        .thermostat,

      "shared_details.scope.thermostat",

      extraction.options.map(
        (option, index) => ({
          fact:
            option.scope.thermostat,

          path:
            `options[${index}].scope.thermostat`,
        })
      )
    );

  addHomeownerRule(
    homeownerClarifications,
    thermostat,
    {
      id: "thermostat",
      label: "Thermostat",
      priority: 65,

      missingMessage:
        "The thermostat scope was not clearly identified in the proposal.",

      uncertainMessage:
        "The proposal mentions thermostat work, but the included scope is not completely clear.",
    }
  );

  /*
   * FINANCING
   *
   * Multi-option proposals may have an estimated
   * payment for each individual option.
   */
  const financing =
    resolveAcrossProposal(
      extraction.shared_details
        .payment_financing.financing,

      "shared_details.payment_financing.financing",

      extraction.options.map(
        (option, index) => ({
          fact:
            option.payment_financing
              .financing,

          path:
            `options[${index}].payment_financing.financing`,
        })
      )
    );

  addHomeownerRule(
    homeownerClarifications,
    financing,
    {
      id: "financing",
      label: "Financing",
      priority: 60,

      missingMessage:
        "Financing terms were not clearly identified in the proposal.",

      uncertainMessage:
        "The proposal contains financing information, but the terms are not completely clear.",
    }
  );

  /*
   * PROPOSAL EXPIRATION
   */
  addSingleFactRule(
    homeownerClarifications,

    extraction.proposal
      .expiration_date,

    "proposal.expiration_date",

    {
      id: "expiration-date",
      label: "Proposal expiration",
      priority: 55,

      missingMessage:
        "An expiration or valid-through date was not clearly identified in the proposal.",

      uncertainMessage:
        "The proposal contains expiration information, but the valid-through date is not completely clear.",
    }
  );

  /*
   * ELECTRICAL WORK
   */
  const electrical =
    resolveElectricalScope(
      extraction
    );

  addHomeownerRule(
    homeownerClarifications,
    electrical,
    {
      id: "electrical-scope",
      label: "Electrical work",
      priority: 50,

      missingMessage:
        "The electrical work included with the installation was not clearly identified.",

      uncertainMessage:
        "The proposal mentions electrical work, but the included electrical scope is not completely clear.",
    }
  );

  /*
   * GAS / VENTING
   *
   * Only surface this when the extraction itself
   * says the field applies or is uncertain.
   *
   * We do not infer that gas work should exist.
   */
  const gasOrVenting =
    resolveAcrossProposal(
      extraction.shared_details.scope
        .gas_or_venting_work,

      "shared_details.scope.gas_or_venting_work",

      extraction.options.map(
        (option, index) => ({
          fact:
            option.scope
              .gas_or_venting_work,

          path:
            `options[${index}].scope.gas_or_venting_work`,
        })
      )
    );

  if (
    hasApplicableFact(
      gasOrVenting
    ) ||
    gasOrVenting.status ===
      "UNCERTAIN"
  ) {
    addHomeownerRule(
      homeownerClarifications,
      gasOrVenting,
      {
        id: "gas-venting",
        label: "Gas or venting work",
        priority: 45,

        missingMessage:
          "Gas or venting work appears relevant, but the proposal does not clearly identify the included scope.",

        uncertainMessage:
          "The proposal mentions gas or venting work, but the included scope is not completely clear.",
      }
    );
  }

  /*
   * EXPLICIT EXCLUSIONS
   */
  collectScopeExclusions(
    extraction,
    explicitExclusions
  );

  collectWrittenExclusions(
    extraction,
    explicitExclusions
  );

  /*
   * CONTRACTOR-ONLY TECHNICAL OBSERVATIONS
   */
  addContractorOnlyRule(
    contractorOnly,

    extraction.shared_details
      .design_references.manual_j,

    "shared_details.design_references.manual_j",

    "Manual J",

    "Manual J sizing reference was not identified in the proposal."
  );

  addContractorOnlyRule(
    contractorOnly,

    extraction.shared_details
      .design_references.manual_s,

    "shared_details.design_references.manual_s",

    "Manual S",

    "Manual S equipment-selection reference was not identified in the proposal."
  );

  addContractorOnlyRule(
    contractorOnly,

    extraction.shared_details
      .design_references.manual_d,

    "shared_details.design_references.manual_d",

    "Manual D",

    "Manual D duct-design reference was not identified in the proposal."
  );

  addContractorOnlyRule(
    contractorOnly,

    extraction.shared_details
      .design_references.ahri_reference,

    "shared_details.design_references.ahri_reference",

    "AHRI reference",

    "An AHRI reference was not identified in the proposal."
  );

  addContractorOnlyRule(
    contractorOnly,

    extraction.shared_details.scope
      .commissioning,

    "shared_details.scope.commissioning",

    "Commissioning",

    "Commissioning details were not identified in the proposal."
  );

  addContractorOnlyRule(
    contractorOnly,

    extraction.shared_details
      .design_references
      .airflow_verification,

    "shared_details.design_references.airflow_verification",

    "Airflow verification",

    "Airflow-verification details were not identified in the proposal."
  );

  /*
   * Priority order + homeowner maximum.
   */
  homeownerClarifications.sort(
    (a, b) =>
      b.priority - a.priority
  );

  const limitedHomeownerClarifications =
    homeownerClarifications.slice(
      0,
      MAX_HOMEOWNER_CLARIFICATIONS
    );

  return {
    homeownerClarifications:
      limitedHomeownerClarifications,

    clearlyStated:
      dedupeById(
        clearlyStated
      ),

    explicitExclusions:
      dedupeExclusions(
        explicitExclusions
      ),

    contractorOnly:
      dedupeById(
        contractorOnly
      ),
  };
}

function addHomeownerRule(
  target: HomeownerFlag[],
  resolved: ResolvedFact,
  rule: {
    id: string;
    label: string;
    priority: number;
    missingMessage: string;
    uncertainMessage: string;
  }
) {
  if (
    resolved.status ===
    "NOT_IDENTIFIED"
  ) {
    target.push({
      id: rule.id,

      category:
        "WORTH_CLARIFYING",

      priority:
        rule.priority,

      label:
        rule.label,

      message:
        rule.missingMessage,

      status:
        resolved.status,

      sources:
        getSources(
          resolved
        ),
    });

    return;
  }

  if (
    resolved.status ===
    "UNCERTAIN"
  ) {
    target.push({
      id: rule.id,

      category:
        "UNCERTAIN",

      priority:
        rule.priority,

      label:
        rule.label,

      message:
        rule.uncertainMessage,

      status:
        resolved.status,

      sources:
        getSources(
          resolved
        ),
    });
  }
}

function addSingleFactRule(
  target: HomeownerFlag[],
  fact: Fact,
  path: string,
  rule: {
    id: string;
    label: string;
    priority: number;
    missingMessage: string;
    uncertainMessage: string;
  }
) {
  addHomeownerRule(
    target,
    {
      status:
        fact.status,

      facts: [
        {
          fact,
          path,
        },
      ],
    },
    rule
  );
}

function resolveAcrossProposal(
  sharedFact: Fact,
  sharedPath: string,
  optionFacts: Array<{
    fact: Fact;
    path: string;
  }>
): ResolvedFact {
  /*
   * A clearly stated shared term controls because
   * it explicitly applies across the proposal.
   */
  if (
    sharedFact.status === "FOUND" ||
    sharedFact.status === "EXCLUDED"
  ) {
    return {
      status:
        sharedFact.status,

      facts: [
        {
          fact:
            sharedFact,

          path:
            sharedPath,
        },
      ],
    };
  }

  if (
    optionFacts.length === 0
  ) {
    return {
      status:
        sharedFact.status,

      facts: [
        {
          fact:
            sharedFact,

          path:
            sharedPath,
        },
      ],
    };
  }

  const statuses =
    optionFacts.map(
      ({ fact }) =>
        fact.status
    );

  /*
   * If the shared field is uncertain but every
   * individual option clearly states the answer,
   * use the option-specific facts.
   *
   * Example:
   *
   * Shared financing language may be general,
   * while each option provides its own complete
   * financing example.
   */
  if (
    sharedFact.status ===
      "UNCERTAIN" &&
    statuses.every(
      (status) =>
        status === "FOUND"
    )
  ) {
    return {
      status: "FOUND",
      facts: optionFacts,
    };
  }

  /*
   * Otherwise, an uncertain shared statement
   * remains uncertain.
   *
   * Example:
   *
   * Shared line-set wording is ambiguous and
   * the individual options do not resolve it.
   */
  if (
    sharedFact.status ===
    "UNCERTAIN"
  ) {
    return {
      status:
        "UNCERTAIN",

      facts: [
        {
          fact:
            sharedFact,

          path:
            sharedPath,
        },
      ],
    };
  }

  if (
    statuses.every(
      (status) =>
        status === "FOUND"
    )
  ) {
    return {
      status: "FOUND",
      facts: optionFacts,
    };
  }

  if (
    statuses.every(
      (status) =>
        status === "EXCLUDED"
    )
  ) {
    return {
      status:
        "EXCLUDED",

      facts:
        optionFacts,
    };
  }

  if (
    statuses.every(
      (status) =>
        status ===
        "NOT_IDENTIFIED"
    )
  ) {
    return {
      status:
        "NOT_IDENTIFIED",

      facts:
        optionFacts,
    };
  }

  /*
   * Mixed statuses across options mean the proposal
   * does not establish one consistent answer.
   */
  return {
    status:
      "UNCERTAIN",

    facts:
      optionFacts,
  };
}

function resolveElectricalScope(
  extraction: HVACProposalExtractionType
): ResolvedFact {
  const sharedElectrical =
    extraction.shared_details.scope
      .electrical_work;

  const sharedDisconnect =
    extraction.shared_details.scope
      .electrical_disconnect;

  if (
    sharedElectrical.status ===
      "FOUND" ||
    sharedDisconnect.status ===
      "FOUND"
  ) {
    const facts = [];

    if (
      sharedElectrical.status ===
      "FOUND"
    ) {
      facts.push({
        fact:
          sharedElectrical,

        path:
          "shared_details.scope.electrical_work",
      });
    }

    if (
      sharedDisconnect.status ===
      "FOUND"
    ) {
      facts.push({
        fact:
          sharedDisconnect,

        path:
          "shared_details.scope.electrical_disconnect",
      });
    }

    return {
      status:
        "FOUND",

      facts,
    };
  }

  if (
    sharedElectrical.status ===
      "UNCERTAIN" ||
    sharedDisconnect.status ===
      "UNCERTAIN"
  ) {
    return {
      status:
        "UNCERTAIN",

      facts: [
        {
          fact:
            sharedElectrical,

          path:
            "shared_details.scope.electrical_work",
        },

        {
          fact:
            sharedDisconnect,

          path:
            "shared_details.scope.electrical_disconnect",
        },
      ],
    };
  }

  return {
    status:
      "NOT_IDENTIFIED",

    facts: [
      {
        fact:
          sharedElectrical,

        path:
          "shared_details.scope.electrical_work",
      },

      {
        fact:
          sharedDisconnect,

        path:
          "shared_details.scope.electrical_disconnect",
      },
    ],
  };
}

function addContractorOnlyRule(
  target: ContractorOnlyItem[],
  fact: Fact,
  path: string,
  label: string,
  missingMessage: string
) {
  if (
    fact.status !==
      "NOT_IDENTIFIED" &&
    fact.status !==
      "UNCERTAIN"
  ) {
    return;
  }

  target.push({
    id:
      contractorId(label),

    category:
      "CONTRACTOR_ONLY",

    label,

    message:
      fact.status ===
      "UNCERTAIN"
        ? `${label} information is present but unclear in the proposal.`
        : missingMessage,

    status:
      fact.status,

    sources:
      sourceFromFact(
        fact,
        path
      ),
  });
}

function collectScopeExclusions(
  extraction: HVACProposalExtractionType,
  target: ExplicitExclusion[]
) {
  const labels: Record<
    string,
    string
  > = {
    removal_and_disposal:
      "Removal and disposal",

    indoor_equipment_installation:
      "Indoor equipment installation",

    outdoor_equipment_installation:
      "Outdoor equipment installation",

    refrigerant_work:
      "Refrigerant work",

    line_set:
      "Refrigerant piping",

    condensate_work:
      "Condensate work",

    equipment_pad:
      "Equipment pad",

    electrical_disconnect:
      "Electrical disconnect",

    electrical_work:
      "Electrical work",

    low_voltage_wiring:
      "Low-voltage wiring",

    gas_or_venting_work:
      "Gas or venting work",

    thermostat:
      "Thermostat",

    ductwork:
      "Ductwork",

    filtration:
      "Filtration",

    startup_and_testing:
      "Startup and testing",

    commissioning:
      "Commissioning",

    cleanup:
      "Cleanup",

    permit_responsibility:
      "Permit responsibility",

    inspection_responsibility:
      "Inspection responsibility",
  };

  for (
    const [key, fact]
    of Object.entries(
      extraction
        .shared_details
        .scope
    )
  ) {
    if (
      fact.status !==
      "EXCLUDED"
    ) {
      continue;
    }

    target.push({
      id:
        `scope-${key}`,

      label:
        labels[key] ||
        key,

      text:
        fact.value ||
        `${labels[key] || key} is explicitly excluded.`,

      sources:
        sourceFromFact(
          fact,
          `shared_details.scope.${key}`
        ),
    });
  }
}

function collectWrittenExclusions(
  extraction: HVACProposalExtractionType,
  target: ExplicitExclusion[]
) {
  extraction.shared_details
    .explicit_exclusions
    .forEach(
      (item, index) => {
        target.push({
          id:
            `shared-exclusion-${index}`,

          label:
            "Explicit exclusion",

          text:
            item.text,

          sources: [
            {
              path:
                `shared_details.explicit_exclusions[${index}]`,

              page:
                item.page,

              evidence:
                item.evidence,
            },
          ],
        });
      }
    );

  extraction.options.forEach(
    (
      option,
      optionIndex
    ) => {
      option.explicit_exclusions.forEach(
        (
          item,
          exclusionIndex
        ) => {
          target.push({
            id:
              `option-${optionIndex}-exclusion-${exclusionIndex}`,

            label:
              `Option ${optionIndex + 1} exclusion`,

            text:
              item.text,

            sources: [
              {
                path:
                  `options[${optionIndex}].explicit_exclusions[${exclusionIndex}]`,

                page:
                  item.page,

                evidence:
                  item.evidence,
              },
            ],
          });
        }
      );
    }
  );
}

function getSources(
  resolved: ResolvedFact
): SourceReference[] {
  return resolved.facts.flatMap(
    ({ fact, path }) =>
      sourceFromFact(
        fact,
        path
      )
  );
}

function sourceFromFact(
  fact: Fact,
  path: string
): SourceReference[] {
  if (
    fact.page === null &&
    fact.evidence === null
  ) {
    return [];
  }

  return [
    {
      path,

      page:
        fact.page,

      evidence:
        fact.evidence,
    },
  ];
}

function getFirstValue(
  resolved: ResolvedFact,
  fallback: string
) {
  for (
    const { fact }
    of resolved.facts
  ) {
    if (
      typeof fact.value ===
        "string" &&
      fact.value.trim() !== ""
    ) {
      return fact.value;
    }
  }

  return fallback;
}

function hasApplicableFact(
  resolved: ResolvedFact
) {
  return resolved.facts.some(
    ({ fact }) =>
      fact.applicability ===
      "APPLICABLE"
  );
}

function contractorId(
  label: string
) {
  return label
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-|-$/g,
      ""
    );
}

function dedupeById<
  T extends {
    id: string;
  },
>(
  items: T[]
): T[] {
  const seen =
    new Set<string>();

  return items.filter(
    (item) => {
      if (
        seen.has(
          item.id
        )
      ) {
        return false;
      }

      seen.add(
        item.id
      );

      return true;
    }
  );
}

function dedupeExclusions(
  items: ExplicitExclusion[]
): ExplicitExclusion[] {
  const kept:
    ExplicitExclusion[] = [];

  const normalizedTexts:
    string[] = [];

  for (const item of items) {
    const normalized =
      normalizeText(
        item.text
      );

    const duplicate =
      normalizedTexts.some(
        (existing) =>
          existing ===
            normalized ||
          existing.includes(
            normalized
          ) ||
          normalized.includes(
            existing
          )
      );

    if (duplicate) {
      continue;
    }

    normalizedTexts.push(
      normalized
    );

    kept.push(
      item
    );
  }

  return kept;
}

function normalizeText(
  value: string
) {
  return value
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .trim();
}