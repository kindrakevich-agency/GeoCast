// Map viem / wagmi errors → short human messages. The raw exception
// stringification bleeds the full request arguments, ABI signature,
// `Docs:` URL, and viem version into the UI — useless and ugly. Look
// at the structured fields (BaseError.name, .shortMessage, .cause)
// when available and fall back to a pattern match on the message.
//
// Reference: viem error hierarchy lives in `viem/errors`; we duck-type
// rather than import to keep this file framework-agnostic.

type ViemErrorish = Error & {
  name?: string;
  shortMessage?: string;
  details?: string;
  cause?: { name?: string; shortMessage?: string; message?: string };
  walk?: (fn: (e: Error) => boolean) => Error | null;
};

const USER_REJECTED_NAMES = new Set([
  "UserRejectedRequestError",
  "TransactionExecutionError", // wraps UserRejected in some viem versions
]);

const PATTERNS: Array<{ test: RegExp; msg: string }> = [
  { test: /user rejected|user denied|denied transaction/i, msg: "You canceled the signature in your wallet." },
  { test: /insufficient funds for gas|insufficient funds for intrinsic/i, msg: "Not enough ETH on this network for gas. Top up the wallet." },
  { test: /transfer amount exceeds balance|insufficient balance/i, msg: "Not enough USDC. Use the test-mint button to top up." },
  { test: /insufficient allowance|erc20:.*allowance/i, msg: "USDC allowance too low — approve the pool to spend USDC and retry." },
  { test: /chain mismatch|chain.*does not match|wrong network/i, msg: "Wrong network — switch your wallet to Base Sepolia and retry." },
  { test: /nonce too low/i, msg: "Wallet nonce out of sync. Reset your account's activity history in wallet settings and retry." },
  { test: /AlreadyCommitted/i, msg: "You've already placed a pin on this round." },
  { test: /CommitWindowClosed/i, msg: "Commit window closed — round has moved on." },
  { test: /RevealWindowClosed/i, msg: "Reveal window not open / already closed." },
  { test: /CommitMismatch/i, msg: "Reveal coords don't match your commit. Did you reveal from the same browser?" },
  { test: /AlreadyResolved/i, msg: "Round already resolved on-chain." },
  { test: /InvalidProof/i, msg: "Invalid Merkle proof. Refresh the page so /me re-fetches and try again." },
  { test: /AlreadyClaimed/i, msg: "You already claimed this round." },
  { test: /RoundNotFound/i, msg: "Round not found on-chain. Admin must mirror it first." },
];

/**
 * Returns a short human message for any wagmi/viem error.
 *
 * Order of preference: (1) match on viem's structured `shortMessage` /
 * walked cause, (2) match patterns against the formatted message,
 * (3) fall back to the first line of the message string.
 */
export function humanizeWalletError(e: unknown): string {
  if (!(e instanceof Error)) {
    return "Something went wrong with the wallet.";
  }
  const v = e as ViemErrorish;

  // viem's BaseError exposes the user-friendly summary as `shortMessage`.
  const inner = typeof v.walk === "function" ? v.walk(() => true) : null;
  const candidate = (inner as ViemErrorish | null)?.shortMessage
    ?? v.shortMessage
    ?? v.message
    ?? "";

  // Common name-based detection — covers the most-frequent case fastest.
  for (const name of [v.name, v.cause?.name, (inner as ViemErrorish | null)?.name]) {
    if (name && USER_REJECTED_NAMES.has(name)) {
      // Still pattern-match because the wrapper may add detail (e.g. nonce errs)
      const m = PATTERNS.find((p) => p.test.test(candidate));
      if (m) return m.msg;
      return "You canceled the signature in your wallet.";
    }
  }

  for (const { test, msg } of PATTERNS) {
    if (test.test(candidate)) return msg;
  }

  // Last resort: take the first sentence of `shortMessage` if present, else
  // the first line of the message. Strip the multi-paragraph viem trace.
  const summary = (v.shortMessage ?? v.message ?? "").split("\n")[0].trim();
  return summary || "Wallet returned an error.";
}
