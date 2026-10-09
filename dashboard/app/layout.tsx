import "antd/dist/reset.css";
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Flame in Freefall — NASA Telemetry & Fire Safety",
  description: "Explore, compare, and interpret source-linked NASA microgravity combustion data for fire-safety research."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
