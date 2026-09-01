import { RecipientView } from "./recipient-view";

export default async function RecipientPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  return <RecipientView address={address} />;
}
