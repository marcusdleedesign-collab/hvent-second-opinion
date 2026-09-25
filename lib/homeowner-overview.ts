import type {
  HVACProposalExtractionType,
} from "@/lib/hvac-extraction-schema";

import type {
  FlaggingResult,
  SourceReference,
} from "@/lib/flagging-engine";

type Fact =
  HVACProposalExtractionType[
    "shared_details"
  ]["scope"]["line_set"];

type EquipmentItem =
  HVACProposalExtractionType[
    "options"
  ][number]["equipment"][number];

export type OverviewItem = {
  id: string;
  label: string;
  value: string;
  sources: SourceReference[];
};

export type OverviewEquipment = {
  id: string;
  name: string;
  details: string[];
  sources: SourceReference[];
};

export type OverviewOption = {
  id: string;
  label: string;

  price:
    | OverviewItem
    | null;

  efficiency:
    OverviewItem[];

  equipment:
    OverviewEquipment[];

  laborWarranty:
    | OverviewItem
    | null;

  financing:
    | OverviewItem
    | null;
};

export type OverviewClarification = {
  id: string;

  category:
    | "WORTH_CLARIFYING"
    | "UNCERTAIN";

  label: string;
  message: string;
  sources: SourceReference[];
};

export type OverviewExclusion = {
  id: string;
  label: string;
  text: string;
  sources: SourceReference[];
};

export type HomeownerOverview = {
  disclosure: string;

  proposal: {
    contractorName:
      | string
      | null;

    proposalNumber:
      | string
      | null;

    proposalDate:
      | string
      | null;

    expirationDate:
      | string
      | null;

    hasMultipleOptions: boolean;
    optionCount: number;
  };

  headline: {
    title: string;

    price:
      | string
      | null;
  };

  options:
    OverviewOption[];

  includedScope:
    OverviewItem[];

  terms:
    OverviewItem[];

  exclusions:
    OverviewExclusion[];

  clarifications:
    OverviewClarification[];

  uncertaintyNote: string;

  professionalReview: {
    heading: string;
    body: string;
    buttonLabel: string;
  };
};

export function buildHomeownerOverview(
  extraction: HVACProposalExtractionType,
  flagging: FlaggingResult
): HomeownerOverview {
  const options =
    extraction.options.map(
      (option, index) =>
        buildOption(
          option,
          index
        )
    );

  const overallPrice =
    getFoundValue(
      extraction.proposal
        .overall_total_price
    ) ||
    (
      options.length === 1
        ? options[0].price?.value ||
          null
        : null
    );

  const headlineTitle =
    buildHeadlineTitle(
      extraction,
      options
    );

  const includedScope =
    buildIncludedScope(
      extraction
    );

  const terms =
    buildTerms(
      extraction
    );

  const clarifications =
    flagging.homeownerClarifications.map(
      (item) => ({
        id: item.id,
        category: item.category,
        label: item.label,
        message: item.message,
        sources: item.sources,
      })
    );

  const exclusions =
    flagging.explicitExclusions.map(
      (item) => ({
        id: item.id,
        label: item.label,
        text: item.text,
        sources: item.sources,
      })
    );

  const uncertaintyNote =
    clarifications.length > 0
      ? "Some details were not clearly established in the proposal. Those items are listed below for clarification."
      : "The automated overview did not identify any of the configured clarification items. This is still not a technical evaluation of the proposal.";

  return {
    disclosure:
      "This automated overview organizes information found in your uploaded proposal. It is not a professional HVAC opinion and does not determine whether the equipment, scope, or price is appropriate for your home.",

    proposal: {
      contractorName:
        getFoundValue(
          extraction.contractor
            .business_name
        ),

      proposalNumber:
        getFoundValue(
          extraction.proposal
            .proposal_number
        ),

      proposalDate:
        getFoundValue(
          extraction.proposal
            .proposal_date
        ),

      expirationDate:
        getFoundValue(
          extraction.proposal
            .expiration_date
        ),

      hasMultipleOptions:
        extraction.proposal
          .has_multiple_options,

      optionCount:
        extraction.proposal
          .option_count,
    },

    headline: {
      title:
        headlineTitle,

      price:
        overallPrice,
    },

    options,

    includedScope,

    terms,

    exclusions,

    clarifications,

    uncertaintyNote,

    professionalReview: {
      heading:
        "Want a professional second opinion?",

      body:
        "You can request a professional review of the proposal after viewing this automated overview.",

      buttonLabel:
        "Request a Professional Second Opinion",
    },
  };
}

function buildHeadlineTitle(
  extraction:
    HVACProposalExtractionType,
  options: OverviewOption[]
) {
  if (
    extraction.proposal
      .has_multiple_options
  ) {
    return `${extraction.proposal.option_count} proposal options identified`;
  }

  if (
    options.length === 1 &&
    options[0].label
  ) {
    return options[0].label;
  }

  return "HVAC Proposal Overview";
}

function buildOption(
  option:
    HVACProposalExtractionType[
      "options"
    ][number],

  index: number
): OverviewOption {
  const label =
    getFoundValue(
      option.option_label
    ) ||
    `Option ${index + 1}`;

  const price =
    itemFromFact(
      `option-${index}-price`,
      "Price",
      option.option_total_price,
      `options[${index}].option_total_price`
    );

  const efficiency =
    buildEfficiency(
      option,
      index
    );

  const equipment =
    option.equipment
      .map(
        (
          equipmentItem,
          equipmentIndex
        ) =>
          buildEquipment(
            equipmentItem,
            index,
            equipmentIndex
          )
      )
      .filter(
        (
          item
        ): item is OverviewEquipment =>
          item !== null
      );

  const laborWarranty =
    itemFromFact(
      `option-${index}-labor-warranty`,
      "Labor warranty",
      option.warranties.labor,
      `options[${index}].warranties.labor`
    );

  const financing =
    itemFromFact(
      `option-${index}-financing`,
      "Financing",
      option.payment_financing
        .financing,
      `options[${index}].payment_financing.financing`
    );

  return {
    id:
      `option-${index}`,

    label,

    price,

    efficiency,

    equipment,

    laborWarranty,

    financing,
  };
}

function buildEfficiency(
  option:
    HVACProposalExtractionType[
      "options"
    ][number],

  optionIndex: number
): OverviewItem[] {
  const fields: Array<{
    key:
      | "seer2"
      | "eer2"
      | "hspf2"
      | "afue"
      | "energy_star";

    label: string;
  }> = [
    {
      key: "seer2",
      label: "SEER2",
    },

    {
      key: "eer2",
      label: "EER2",
    },

    {
      key: "hspf2",
      label: "HSPF2",
    },

    {
      key: "afue",
      label: "AFUE",
    },

    {
      key: "energy_star",
      label: "ENERGY STAR",
    },
  ];

  const result:
    OverviewItem[] = [];

  for (
    const field
    of fields
  ) {
    const item =
      itemFromFact(
        `option-${optionIndex}-efficiency-${field.key}`,

        field.label,

        option.system_efficiency[
          field.key
        ],

        `options[${optionIndex}].system_efficiency.${field.key}`
      );

    if (item) {
      result.push(item);
    }
  }

  return result;
}

function buildEquipment(
  equipment: EquipmentItem,
  optionIndex: number,
  equipmentIndex: number
): OverviewEquipment | null {
  const role =
    getFoundValue(
      equipment.role
    );

  const type =
    getFoundValue(
      equipment.equipment_type
    );

  const brand =
    getFoundValue(
      equipment.brand
    );

  const productLine =
    getFoundValue(
      equipment.product_line
    );

  const model =
    getFoundValue(
      equipment.model_number
    );

  const quantity =
    getFoundValue(
      equipment.quantity
    );

  const tonnage =
    getFoundValue(
      equipment.tonnage
    );

  const capacity =
    getFoundValue(
      equipment.capacity
    );

  const variableSpeed =
    getFoundValue(
      equipment.variable_speed
    );

  const nameParts =
    dedupeStrings(
      [
        brand,
        productLine,
        type,
      ].filter(
        (
          value
        ): value is string =>
          Boolean(value)
      )
    );

  const name =
    nameParts.length > 0
      ? nameParts.join(" ")
      : role ||
        `Equipment ${equipmentIndex + 1}`;

  const details:
    string[] = [];

  if (model) {
    details.push(
      `Model ${model}`
    );
  }

  if (tonnage) {
    details.push(
      tonnage
    );
  } else if (capacity) {
    details.push(
      capacity
    );
  }

  if (
    variableSpeed &&
    !name
      .toLowerCase()
      .includes(
        variableSpeed.toLowerCase()
      )
  ) {
    details.push(
      variableSpeed
    );
  }

  if (
    quantity &&
    quantity !== "1"
  ) {
    details.push(
      `Qty ${quantity}`
    );
  }

  const sourceFacts: Array<{
    fact: Fact;
    path: string;
  }> = [
    {
      fact:
        equipment.role,

      path:
        `options[${optionIndex}].equipment[${equipmentIndex}].role`,
    },

    {
      fact:
        equipment.equipment_type,

      path:
        `options[${optionIndex}].equipment[${equipmentIndex}].equipment_type`,
    },

    {
      fact:
        equipment.brand,

      path:
        `options[${optionIndex}].equipment[${equipmentIndex}].brand`,
    },

    {
      fact:
        equipment.product_line,

      path:
        `options[${optionIndex}].equipment[${equipmentIndex}].product_line`,
    },

    {
      fact:
        equipment.model_number,

      path:
        `options[${optionIndex}].equipment[${equipmentIndex}].model_number`,
    },

    {
      fact:
        equipment.quantity,

      path:
        `options[${optionIndex}].equipment[${equipmentIndex}].quantity`,
    },

    {
      fact:
        equipment.tonnage,

      path:
        `options[${optionIndex}].equipment[${equipmentIndex}].tonnage`,
    },

    {
      fact:
        equipment.capacity,

      path:
        `options[${optionIndex}].equipment[${equipmentIndex}].capacity`,
    },

    {
      fact:
        equipment.variable_speed,

      path:
        `options[${optionIndex}].equipment[${equipmentIndex}].variable_speed`,
    },
  ];

  const sources =
    sourceFacts.flatMap(
      ({ fact, path }) =>
        sourceFromFact(
          fact,
          path
        )
    );

  if (
    nameParts.length === 0 &&
    !role &&
    details.length === 0
  ) {
    return null;
  }

  return {
    id:
      `option-${optionIndex}-equipment-${equipmentIndex}`,

    name,

    details,

    sources,
  };
}

function buildIncludedScope(
  extraction:
    HVACProposalExtractionType
): OverviewItem[] {
  const scope =
    extraction.shared_details
      .scope;

  const result:
    OverviewItem[] = [];

  /*
   * REMOVAL / DISPOSAL
   */
  const removal =
    itemFromFact(
      "removal-disposal",
      "Removal and disposal",
      scope.removal_and_disposal,
      "shared_details.scope.removal_and_disposal"
    );

  if (removal) {
    result.push(removal);
  }

  /*
   * EQUIPMENT INSTALLATION
   *
   * If the indoor and outdoor installation wording is
   * identical, show one combined homeowner-facing item.
   *
   * If the wording differs, preserve both separately.
   */
  const outdoorInstallationValue =
    getFoundValue(
      scope.outdoor_equipment_installation
    );

  const indoorInstallationValue =
    getFoundValue(
      scope.indoor_equipment_installation
    );

  if (
    outdoorInstallationValue &&
    indoorInstallationValue &&
    normalizeText(
      outdoorInstallationValue
    ) ===
      normalizeText(
        indoorInstallationValue
      )
  ) {
    result.push({
      id:
        "equipment-installation",

      label:
        "Equipment installation",

      value:
        outdoorInstallationValue,

      sources: [
        ...sourceFromFact(
          scope.outdoor_equipment_installation,
          "shared_details.scope.outdoor_equipment_installation"
        ),

        ...sourceFromFact(
          scope.indoor_equipment_installation,
          "shared_details.scope.indoor_equipment_installation"
        ),
      ],
    });
  } else {
    const outdoorInstallation =
      itemFromFact(
        "outdoor-equipment-installation",
        "Outdoor equipment installation",
        scope.outdoor_equipment_installation,
        "shared_details.scope.outdoor_equipment_installation"
      );

    if (outdoorInstallation) {
      result.push(
        outdoorInstallation
      );
    }

    const indoorInstallation =
      itemFromFact(
        "indoor-equipment-installation",
        "Indoor equipment installation",
        scope.indoor_equipment_installation,
        "shared_details.scope.indoor_equipment_installation"
      );

    if (indoorInstallation) {
      result.push(
        indoorInstallation
      );
    }
  }

  /*
   * REMAINING INCLUDED SCOPE
   */
  const candidates: Array<{
    id: string;
    label: string;
    fact: Fact;
    path: string;
  }> = [
    {
      id:
        "refrigerant-work",

      label:
        "Refrigerant work",

      fact:
        scope.refrigerant_work,

      path:
        "shared_details.scope.refrigerant_work",
    },

    {
      id:
        "condensate-work",

      label:
        "Condensate drainage",

      fact:
        scope.condensate_work,

      path:
        "shared_details.scope.condensate_work",
    },

    {
      id:
        "equipment-pad",

      label:
        "Equipment pad",

      fact:
        scope.equipment_pad,

      path:
        "shared_details.scope.equipment_pad",
    },

    {
      id:
        "electrical-disconnect",

      label:
        "Electrical disconnect",

      fact:
        scope.electrical_disconnect,

      path:
        "shared_details.scope.electrical_disconnect",
    },

    {
      id:
        "electrical-work",

      label:
        "Electrical work",

      fact:
        scope.electrical_work,

      path:
        "shared_details.scope.electrical_work",
    },

    {
      id:
        "thermostat",

      label:
        "Thermostat",

      fact:
        scope.thermostat,

      path:
        "shared_details.scope.thermostat",
    },

    {
      id:
        "startup-testing",

      label:
        "Startup and testing",

      fact:
        scope.startup_and_testing,

      path:
        "shared_details.scope.startup_and_testing",
    },

    {
      id:
        "cleanup",

      label:
        "Cleanup",

      fact:
        scope.cleanup,

      path:
        "shared_details.scope.cleanup",
    },

    {
      id:
        "permit",

      label:
        "Permit",

      fact:
        scope.permit_responsibility,

      path:
        "shared_details.scope.permit_responsibility",
    },
  ];

  for (
    const candidate
    of candidates
  ) {
    const item =
      itemFromFact(
        candidate.id,
        candidate.label,
        candidate.fact,
        candidate.path
      );

    if (item) {
      result.push(item);
    }
  }

  return dedupeOverviewItems(
    result
  );
}

function buildTerms(
  extraction:
    HVACProposalExtractionType
): OverviewItem[] {
  const terms:
    OverviewItem[] = [];

  const sharedWarranties =
    extraction.shared_details
      .warranties;

  const sharedPayment =
    extraction.shared_details
      .payment_financing;

  const manufacturerWarranty =
    itemFromFact(
      "manufacturer-parts-warranty",

      "Manufacturer parts warranty",

      sharedWarranties
        .manufacturer_parts,

      "shared_details.warranties.manufacturer_parts"
    );

  if (manufacturerWarranty) {
    terms.push(
      manufacturerWarranty
    );
  }

  const registration =
    itemFromFact(
      "warranty-registration",

      "Warranty registration",

      sharedWarranties
        .registration_requirements,

      "shared_details.warranties.registration_requirements"
    );

  if (registration) {
    terms.push(
      registration
    );
  }

  const hasOptionLaborWarranty =
    extraction.options.some(
      (option) =>
        option.warranties
          .labor.status ===
        "FOUND"
    );

  if (!hasOptionLaborWarranty) {
    const sharedLabor =
      itemFromFact(
        "labor-warranty",

        "Labor warranty",

        sharedWarranties.labor,

        "shared_details.warranties.labor"
      );

    if (sharedLabor) {
      terms.push(
        sharedLabor
      );
    }
  }

  const paymentSchedule =
    itemFromFact(
      "payment-schedule",

      "Payment schedule",

      sharedPayment
        .payment_schedule,

      "shared_details.payment_financing.payment_schedule"
    );

  if (paymentSchedule) {
    terms.push(
      paymentSchedule
    );
  }

  const hasOptionFinancing =
    extraction.options.some(
      (option) =>
        option.payment_financing
          .financing.status ===
        "FOUND"
    );

  if (!hasOptionFinancing) {
    const financing =
      itemFromFact(
        "financing",

        "Financing",

        sharedPayment.financing,

        "shared_details.payment_financing.financing"
      );

    if (financing) {
      terms.push(
        financing
      );
    }
  }

  const rebates =
    itemFromFact(
      "rebates-incentives",

      "Rebates or incentives",

      sharedPayment
        .rebates_or_incentives,

      "shared_details.payment_financing.rebates_or_incentives"
    );

  if (rebates) {
    terms.push(
      rebates
    );
  }

  const discounts =
    itemFromFact(
      "discounts",

      "Discounts",

      sharedPayment.discounts,

      "shared_details.payment_financing.discounts"
    );

  if (discounts) {
    terms.push(
      discounts
    );
  }

  return terms;
}

function itemFromFact(
  id: string,
  label: string,
  fact: Fact,
  path: string
): OverviewItem | null {
  const value =
    getFoundValue(
      fact
    );

  if (!value) {
    return null;
  }

  return {
    id,
    label,
    value,

    sources:
      sourceFromFact(
        fact,
        path
      ),
  };
}

function getFoundValue(
  fact: Fact
): string | null {
  if (
    fact.status !== "FOUND"
  ) {
    return null;
  }

  if (
    typeof fact.value !==
    "string"
  ) {
    return null;
  }

  const trimmed =
    fact.value.trim();

  return trimmed !== ""
    ? trimmed
    : null;
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
      page: fact.page,
      evidence:
        fact.evidence,
    },
  ];
}

function dedupeStrings(
  values: string[]
) {
  const seen =
    new Set<string>();

  const result:
    string[] = [];

  for (
    const value
    of values
  ) {
    const normalized =
      value
        .trim()
        .toLowerCase();

    if (
      seen.has(normalized)
    ) {
      continue;
    }

    seen.add(
      normalized
    );

    result.push(
      value.trim()
    );
  }

  return result;
}

function dedupeOverviewItems(
  items: OverviewItem[]
) {
  const seen =
    new Set<string>();

  return items.filter(
    (item) => {
      const normalized =
        item.value
          .toLowerCase()
          .replace(
            /[^a-z0-9]+/g,
            " "
          )
          .trim();

      if (
        seen.has(
          normalized
        )
      ) {
        return false;
      }

      seen.add(
        normalized
      );

      return true;
    }
  );
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