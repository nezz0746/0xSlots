import { RecipientPageContent } from "./recipient-page-content";

/**
 * One recipient.
 *
 * The thin `RecipientView` that replaced this during the migration — a header
 * over the shared slots table — is superseded by the restored page: the stat
 * cards, the split-recipient bar and the per-slot escrow figures are the reason
 * anybody opens a recipient rather than filtering the explorer.
 */
export default async function RecipientPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  return <RecipientPageContent address={address} />;
}
