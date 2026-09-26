import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

const TENANT_ID =
  "hvent";

export function createProposalAccessToken(
  leadId: string,
  secret: string
) {
  return createHmac(
    "sha256",
    secret
  )
    .update(
      `${TENANT_ID}:${leadId}`
    )
    .digest(
      "base64url"
    );
}

export function verifyProposalAccessToken(
  leadId: string,
  suppliedToken: string,
  secret: string
) {
  if (!suppliedToken) {
    return false;
  }

  const expectedToken =
    createProposalAccessToken(
      leadId,
      secret
    );

  const expected =
    Buffer.from(
      expectedToken
    );

  const supplied =
    Buffer.from(
      suppliedToken
    );

  if (
    expected.length !==
    supplied.length
  ) {
    return false;
  }

  return timingSafeEqual(
    expected,
    supplied
  );
}