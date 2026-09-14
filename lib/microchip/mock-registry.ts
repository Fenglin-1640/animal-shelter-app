import type { MicrochipLookupResult, RegisteredOwnerContact } from "@/lib/microchip/types";

// PRD 12.2 Registry 模拟数据. Any microchip number not listed here
// defaults to No Match, the sensible behaviour for an unrecognised chip.
const OWNER_MATCH_NUMBER = "985141000111111";
const NO_MATCH_NUMBER = "985141000222222";
const TIMEOUT_NUMBER = "985141000999999";

const JORDAN_SMITH: RegisteredOwnerContact = {
  name: "Jordan Smith",
  phone: "+61 2 5550 1099",
  address: "14 Wattle Street, Newtown NSW 2042",
};

// PRD: "若 Timeout...8 秒后给出清晰提示" - the simulated call takes 8 seconds
// before the caller is told it timed out.
export const TIMEOUT_DELAY_MS = 8000;

export interface RegistryLookupOutcome {
  result: MicrochipLookupResult;
  ownerContact?: RegisteredOwnerContact;
}

// PRD: "空值 | No Chip" - submitting no number at all represents the
// scanner finding no physical chip to read.
export async function queryNationalPetRegistry(microchipNumber: string): Promise<RegistryLookupOutcome> {
  const trimmed = microchipNumber.trim();

  if (!trimmed) {
    return { result: "No Chip" };
  }

  if (trimmed === TIMEOUT_NUMBER) {
    await new Promise((resolve) => setTimeout(resolve, TIMEOUT_DELAY_MS));
    return { result: "Timeout" };
  }

  if (trimmed === OWNER_MATCH_NUMBER) {
    return { result: "Owner Match", ownerContact: JORDAN_SMITH };
  }

  if (trimmed === NO_MATCH_NUMBER) {
    return { result: "No Match" };
  }

  return { result: "No Match" };
}
