export const INTEREST_RATE = 0.05

export async function applyInterest(balance: number): Promise<number> {
  return balance * (1 + INTEREST_RATE)
}
