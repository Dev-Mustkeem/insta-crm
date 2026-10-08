import type { Metadata } from "next";
import { ChannelSettingsForm } from "@/components/inbox/channel-settings";

export const metadata: Metadata = { title: "SMS & email settings" };

export default function ChannelsPage() {
  return <ChannelSettingsForm />;
}
