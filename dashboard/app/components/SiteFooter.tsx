"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowUpRight, Orbit } from "lucide-react";

const columns = [
  { title: "ABOUT", links: [{ label: "The project", href: "#about" }, { label: "NASA data sources", href: "#sources" }, { label: "Safety limitations", href: "#comparison" }] },
  { title: "FEATURES", links: [{ label: "Venue overview", href: "#venues" }, { label: "Telemetry showcase", href: "#showcase" }, { label: "Experiment catalog", href: "#catalog" }] },
  { title: "COMMUNITY", links: [{ label: "Evidence Q&A", href: "#ask" }, { label: "Frame analysis", href: "#analysis" }, { label: "NASA Space Apps", href: "https://www.spaceappschallenge.org/" }] },
  { title: "RESOURCES", links: [{ label: "FLEX / PSI-69", href: "https://psi.nasa.gov/physci/repo/data/investigations/PSI-69" }, { label: "BASS-II / PSI-25", href: "https://psi.nasa.gov/physci/repo/data/investigations/PSI-25" }, { label: "SAFFIRE-I / PSI-98", href: "https://psi.nasa.gov/physci/repo/data/investigations/PSI-98" }] },
];

export default function SiteFooter() {
  const [message, setMessage] = useState("");
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Signup is a design preview; no email address was sent or stored.");
  }
  return <footer className="site-footer">
    <div className="footer-topline"><a className="site-brand footer-brand" href="#top"><span className="site-brand-mark" aria-hidden="true"><span /></span><span className="site-brand-copy"><b>FLAME IN FREEFALL</b><small>NASA FIRE RESEARCH / 0G</small></span></a><span className="footer-tagline"><Orbit size={15} /> SOURCE-TRACEABLE SPACE SCIENCE</span></div>
    <div className="footer-content">
      <div className="footer-map">{columns.map((column) => <div className="footer-column" key={column.title}><h3>{column.title}</h3>{column.links.map((link) => <a key={link.label} href={link.href}>{link.label}{link.href.startsWith("http") && <ArrowUpRight size={12} aria-hidden="true" />}</a>)}</div>)}</div>
      <section className="orbit-signup" aria-labelledby="orbit-signup-title"><p className="section-kicker">SIGNAL / 001</p><h2 id="orbit-signup-title">Stay in our orbit.</h2><p>Get project updates when the mailing list is connected.</p><form onSubmit={handleSubmit}><label className="sr-only" htmlFor="orbit-email">Email address</label><input id="orbit-email" type="email" placeholder="you@mission.org" required /><button type="submit">JOIN SIGNAL <ArrowUpRight size={14} /></button></form><small>Prototype form only. Email addresses are not transmitted or stored.</small>{message && <p className="signup-message" role="status">{message}</p>}</section>
    </div>
    <div className="footer-bottom"><span>FLAME IN FREEFALL / NASA SPACE APPS CHALLENGE 2026</span><span>RESEARCH SUPPORT TOOL · NOT A SAFETY CERTIFICATION</span><a href="#top">BACK TO TOP ↑</a></div>
  </footer>;
}
