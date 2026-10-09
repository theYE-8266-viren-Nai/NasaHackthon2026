"use client";

import { useState } from "react";
import { ArrowDownToLine, Menu, X } from "lucide-react";

const menus = [
  { title: "About", links: [{ label: "The project", href: "#about" }, { label: "NASA data sources", href: "#sources" }] },
  { title: "Features", links: [{ label: "Built for every venue", href: "#venues" }, { label: "Visualization showcase", href: "#showcase" }, { label: "Experiment catalog", href: "#catalog" }, { label: "Compare evidence", href: "#comparison" }] },
  { title: "Community", links: [{ label: "Video frame analysis", href: "#analysis" }, { label: "Evidence Q&A", href: "#ask" }, { label: "NASA Space Apps", href: "https://www.spaceappschallenge.org/" }] },
  { title: "Resources", links: [{ label: "FLEX / PSI-69", href: "https://psi.nasa.gov/physci/repo/data/investigations/PSI-69" }, { label: "BASS-II / PSI-25", href: "https://psi.nasa.gov/physci/repo/data/investigations/PSI-25" }, { label: "SAFFIRE-I / PSI-98", href: "https://psi.nasa.gov/physci/repo/data/investigations/PSI-98" }] },
];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  return <header className="site-header">
    <a className="site-brand" href="#top" aria-label="Flame in Freefall home">
      <span className="site-brand-mark" aria-hidden="true"><span /></span>
      <span className="site-brand-copy"><b>FLAME IN FREEFALL</b><small>NASA FIRE RESEARCH / 0G</small></span>
    </a>
    <button className="nav-toggle" type="button" aria-expanded={open} aria-controls="site-navigation" aria-label={open ? "Close navigation" : "Open navigation"} onClick={() => setOpen(!open)}>
      {open ? <X size={19} /> : <Menu size={19} />}
    </button>
    <nav id="site-navigation" className={`site-nav ${open ? "is-open" : ""}`} aria-label="Main navigation">
      {menus.map((menu) => <details className="nav-menu" key={menu.title}>
        <summary>{menu.title}<span className="nav-chevron" aria-hidden="true">+</span></summary>
        <div className="nav-menu-panel">{menu.links.map((link) => <a key={link.label} href={link.href} onClick={() => setOpen(false)}>{link.label}<span aria-hidden="true">↗</span></a>)}</div>
      </details>)}
    </nav>
    <a className="download-button" href="/api/experiments" download="flame-in-freefall-experiments.json">DOWNLOAD CATALOG <ArrowDownToLine size={15} aria-hidden="true" /></a>
  </header>;
}
