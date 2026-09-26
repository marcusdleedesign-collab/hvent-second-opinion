import type {
  HVACProposalExtractionType,
} from "@/lib/hvac-extraction-schema";

type Fact =
  HVACProposalExtractionType[
    "shared_details"
  ]["scope"]["line_set"];

type EvidenceItem =
  HVACProposalExtractionType[
    "shared_details"
  ]["explicit_exclusions"][number];

type PriceLineItem =
  HVACProposalExtractionType[
    "shared_details"
  ]["price_breakdown"][number];

/*
 * Single-option proposals can legitimately come back
 * with proposal-wide information stored either under:
 *
 * shared_details
 *
 * or:
 *
 * options[0]
 *
 * Downstream code should not behave differently just
 * because the extraction model chose one location over
 * the other.
 *
 * This function creates a stable canonical version for
 * single-option proposals.
 *
 * Multi-option proposals are left completely unchanged.
 */
export function normalizeSingleOptionExtraction(
  extraction: HVACProposalExtractionType
): HVACProposalExtractionType {
  if (
    extraction.options.length !== 1 ||
    extraction.proposal.has_multiple_options
  ) {
    return extraction;
  }

  const option =
    extraction.options[0];

  const shared =
    extraction.shared_details;

  return {
    ...extraction,

    shared_details: {
      ...shared,

      scope: {
        ...shared.scope,

        removal_and_disposal:
          chooseCanonicalFact(
            shared.scope
              .removal_and_disposal,
            option.scope
              .removal_and_disposal
          ),

        indoor_equipment_installation:
          chooseCanonicalFact(
            shared.scope
              .indoor_equipment_installation,
            option.scope
              .indoor_equipment_installation
          ),

        outdoor_equipment_installation:
          chooseCanonicalFact(
            shared.scope
              .outdoor_equipment_installation,
            option.scope
              .outdoor_equipment_installation
          ),

        refrigerant_work:
          chooseCanonicalFact(
            shared.scope
              .refrigerant_work,
            option.scope
              .refrigerant_work
          ),

        line_set:
          chooseCanonicalFact(
            shared.scope.line_set,
            option.scope.line_set
          ),

        condensate_work:
          chooseCanonicalFact(
            shared.scope
              .condensate_work,
            option.scope
              .condensate_work
          ),

        equipment_pad:
          chooseCanonicalFact(
            shared.scope
              .equipment_pad,
            option.scope
              .equipment_pad
          ),

        electrical_disconnect:
          chooseCanonicalFact(
            shared.scope
              .electrical_disconnect,
            option.scope
              .electrical_disconnect
          ),

        electrical_work:
          chooseCanonicalFact(
            shared.scope
              .electrical_work,
            option.scope
              .electrical_work
          ),

        low_voltage_wiring:
          chooseCanonicalFact(
            shared.scope
              .low_voltage_wiring,
            option.scope
              .low_voltage_wiring
          ),

        gas_or_venting_work:
          chooseCanonicalFact(
            shared.scope
              .gas_or_venting_work,
            option.scope
              .gas_or_venting_work
          ),

        thermostat:
          chooseCanonicalFact(
            shared.scope.thermostat,
            option.scope.thermostat
          ),

        ductwork:
          chooseCanonicalFact(
            shared.scope.ductwork,
            option.scope.ductwork
          ),

        filtration:
          chooseCanonicalFact(
            shared.scope.filtration,
            option.scope.filtration
          ),

        startup_and_testing:
          chooseCanonicalFact(
            shared.scope
              .startup_and_testing,
            option.scope
              .startup_and_testing
          ),

        commissioning:
          chooseCanonicalFact(
            shared.scope.commissioning,
            option.scope.commissioning
          ),

        cleanup:
          chooseCanonicalFact(
            shared.scope.cleanup,
            option.scope.cleanup
          ),

        permit_responsibility:
          chooseCanonicalFact(
            shared.scope
              .permit_responsibility,
            option.scope
              .permit_responsibility
          ),

        inspection_responsibility:
          chooseCanonicalFact(
            shared.scope
              .inspection_responsibility,
            option.scope
              .inspection_responsibility
          ),
      },

      warranties: {
        ...shared.warranties,

        manufacturer_parts:
          chooseCanonicalFact(
            shared.warranties
              .manufacturer_parts,
            option.warranties
              .manufacturer_parts
          ),

        compressor:
          chooseCanonicalFact(
            shared.warranties
              .compressor,
            option.warranties
              .compressor
          ),

        labor:
          chooseCanonicalFact(
            shared.warranties.labor,
            option.warranties.labor
          ),

        workmanship:
          chooseCanonicalFact(
            shared.warranties
              .workmanship,
            option.warranties
              .workmanship
          ),

        registration_requirements:
          chooseCanonicalFact(
            shared.warranties
              .registration_requirements,
            option.warranties
              .registration_requirements
          ),

        other_terms:
          chooseCanonicalFact(
            shared.warranties
              .other_terms,
            option.warranties
              .other_terms
          ),
      },

      design_references: {
        ...shared.design_references,

        manual_j:
          chooseCanonicalFact(
            shared.design_references
              .manual_j,
            option.design_references
              .manual_j
          ),

        manual_s:
          chooseCanonicalFact(
            shared.design_references
              .manual_s,
            option.design_references
              .manual_s
          ),

        manual_d:
          chooseCanonicalFact(
            shared.design_references
              .manual_d,
            option.design_references
              .manual_d
          ),

        ahri_reference:
          chooseCanonicalFact(
            shared.design_references
              .ahri_reference,
            option.design_references
              .ahri_reference
          ),

        system_sizing_basis:
          chooseCanonicalFact(
            shared.design_references
              .system_sizing_basis,
            option.design_references
              .system_sizing_basis
          ),

        airflow_verification:
          chooseCanonicalFact(
            shared.design_references
              .airflow_verification,
            option.design_references
              .airflow_verification
          ),
      },

      payment_financing: {
        ...shared.payment_financing,

        deposit:
          chooseCanonicalFact(
            shared.payment_financing
              .deposit,
            option.payment_financing
              .deposit
          ),

        payment_schedule:
          chooseCanonicalFact(
            shared.payment_financing
              .payment_schedule,
            option.payment_financing
              .payment_schedule
          ),

        balance_due:
          chooseCanonicalFact(
            shared.payment_financing
              .balance_due,
            option.payment_financing
              .balance_due
          ),

        financing:
          chooseCanonicalFact(
            shared.payment_financing
              .financing,
            option.payment_financing
              .financing
          ),

        rebates_or_incentives:
          chooseCanonicalFact(
            shared.payment_financing
              .rebates_or_incentives,
            option.payment_financing
              .rebates_or_incentives
          ),

        discounts:
          chooseCanonicalFact(
            shared.payment_financing
              .discounts,
            option.payment_financing
              .discounts
          ),
      },

      price_breakdown:
        mergePriceBreakdown(
          shared.price_breakdown,
          option.price_breakdown
        ),

      included_items:
        mergeEvidenceItems(
          shared.included_items,
          option.included_items
        ),

      explicit_exclusions:
        mergeEvidenceItems(
          shared.explicit_exclusions,
          option.explicit_exclusions
        ),
    },
  };
}

/*
 * This normalizer is not a conflict-resolution engine.
 *
 * A definitive shared fact remains authoritative.
 *
 * Otherwise, a clearer single-option fact can fill or
 * resolve a missing/uncertain shared field.
 */
function chooseCanonicalFact(
  sharedFact: Fact,
  optionFact: Fact
): Fact {
  if (
    sharedFact.status === "FOUND" ||
    sharedFact.status === "EXCLUDED"
  ) {
    return sharedFact;
  }

  if (
    optionFact.status === "FOUND" ||
    optionFact.status === "EXCLUDED"
  ) {
    return optionFact;
  }

  if (
    sharedFact.status === "UNCERTAIN"
  ) {
    return sharedFact;
  }

  if (
    optionFact.status === "UNCERTAIN"
  ) {
    return optionFact;
  }

  return sharedFact;
}

function mergeEvidenceItems(
  sharedItems: EvidenceItem[],
  optionItems: EvidenceItem[]
): EvidenceItem[] {
  const result: EvidenceItem[] = [];
  const seen = new Set<string>();

  for (
    const item of [
      ...sharedItems,
      ...optionItems,
    ]
  ) {
    const key =
      normalizeText(
        item.text
      );

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
}

function mergePriceBreakdown(
  sharedItems: PriceLineItem[],
  optionItems: PriceLineItem[]
): PriceLineItem[] {
  const result: PriceLineItem[] = [];
  const seen = new Set<string>();

  for (
    const item of [
      ...sharedItems,
      ...optionItems,
    ]
  ) {
    const key = [
      normalizeText(
        item.description
      ),

      normalizeText(
  item.amount ?? ""
),

      String(
        item.page ?? ""
      ),
    ].join("|");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
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