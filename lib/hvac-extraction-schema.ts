import { z } from "zod/v4";

export const ExtractionStatus = z.enum([
  "FOUND",
  "EXCLUDED",
  "NOT_IDENTIFIED",
  "UNCERTAIN",
]);

export const Applicability = z.enum([
  "APPLICABLE",
  "NOT_APPLICABLE",
  "UNKNOWN",
]);

export const Confidence = z.enum([
  "HIGH",
  "MEDIUM",
  "LOW",
]);

export const Fact = z.object({
  status: ExtractionStatus,

  applicability: Applicability,

  value: z.string().nullable(),

  confidence: Confidence,

  // 1-based page number from the uploaded document.
  page: z.number().nullable(),

  // Short supporting excerpt from the proposal.
  evidence: z.string().nullable(),
});

const EvidenceItem = z.object({
  text: z.string(),

  confidence: Confidence,

  page: z.number().nullable(),

  evidence: z.string().nullable(),
});

const PriceLineItem = z.object({
  description: z.string(),

  amount: z.string().nullable(),

  page: z.number().nullable(),

  evidence: z.string().nullable(),
});

const Efficiency = z.object({
  seer2: Fact,
  eer2: Fact,
  hspf2: Fact,
  afue: Fact,
  energy_star: Fact,
});

const EquipmentItem = z.object({
  role: Fact,

  equipment_type: Fact,

  brand: Fact,

  product_line: Fact,

  model_number: Fact,

  quantity: Fact,

  capacity: Fact,

  tonnage: Fact,

  fuel_type: Fact,

  staging: Fact,

  variable_speed: Fact,

  efficiency: Efficiency,
});

const InstallationScope = z.object({
  removal_and_disposal: Fact,

  indoor_equipment_installation: Fact,

  outdoor_equipment_installation: Fact,

  refrigerant_work: Fact,

  line_set: Fact,

  condensate_work: Fact,

  equipment_pad: Fact,

  electrical_disconnect: Fact,

  electrical_work: Fact,

  low_voltage_wiring: Fact,

  gas_or_venting_work: Fact,

  thermostat: Fact,

  ductwork: Fact,

  filtration: Fact,

  startup_and_testing: Fact,

  commissioning: Fact,

  cleanup: Fact,

  permit_responsibility: Fact,

  inspection_responsibility: Fact,
});

const Warranties = z.object({
  manufacturer_parts: Fact,

  compressor: Fact,

  labor: Fact,

  workmanship: Fact,

  registration_requirements: Fact,

  other_terms: Fact,
});

const DesignReferences = z.object({
  manual_j: Fact,

  manual_s: Fact,

  manual_d: Fact,

  ahri_reference: Fact,

  system_sizing_basis: Fact,

  airflow_verification: Fact,
});

const PaymentFinancing = z.object({
  deposit: Fact,

  payment_schedule: Fact,

  balance_due: Fact,

  financing: Fact,

  rebates_or_incentives: Fact,

  discounts: Fact,
});

const ProposalOption = z.object({
  option_label: Fact,

  option_total_price: Fact,

  system_efficiency: Efficiency,

  equipment: z.array(EquipmentItem),

  scope: InstallationScope,

  warranties: Warranties,

  design_references: DesignReferences,

  payment_financing: PaymentFinancing,

  price_breakdown: z.array(PriceLineItem),

  included_items: z.array(EvidenceItem),

  explicit_exclusions: z.array(EvidenceItem),
});

const SharedDetails = z.object({
  scope: InstallationScope,

  warranties: Warranties,

  design_references: DesignReferences,

  payment_financing: PaymentFinancing,

  price_breakdown: z.array(PriceLineItem),

  included_items: z.array(EvidenceItem),

  explicit_exclusions: z.array(EvidenceItem),
});

export const HVACProposalExtraction = z.object({
  document_type: z.enum([
    "HVAC_PROPOSAL",
    "HVAC_ESTIMATE",
    "HVAC_QUOTE",
    "OTHER",
  ]),

  contractor: z.object({
    business_name: Fact,

    phone: Fact,

    email: Fact,

    license_or_identifier: Fact,
  }),

  proposal: z.object({
    proposal_number: Fact,

    proposal_date: Fact,

    expiration_date: Fact,

    overall_total_price: Fact,

    has_multiple_options: z.boolean(),

    option_count: z.number(),
  }),

  // Information explicitly stated to apply to all
  // proposal options belongs here.
  shared_details: SharedDetails,

  // Single-option proposals still get one option object.
  options: z.array(ProposalOption),

  // Factual extraction problems or ambiguities only.
  // No recommendations or judgments belong here.
  extraction_notes: z.array(EvidenceItem),
});

export type HVACProposalExtractionType =
  z.infer<typeof HVACProposalExtraction>;