import { ArrowRight, GraduationCap, Landmark, Orbit } from "lucide-react";

const venues = [
  {
    id: "domes",
    title: "Planetarium Domes",
    icon: Orbit,
    art: "venue-art-dome",
    description: "Read the experiment record as an immersive flight path through fuel, oxygen, pressure, and flame behavior in microgravity.",
    href: "#showcase",
  },
  {
    id: "classrooms",
    title: "Classrooms",
    icon: GraduationCap,
    art: "venue-art-classroom",
    description: "Use source-linked measurements to teach what changes when buoyant convection is removed—and where the evidence has limits.",
    href: "#catalog",
  },
  {
    id: "exhibits",
    title: "Museum Exhibits",
    icon: Landmark,
    art: "venue-art-exhibit",
    description: "Bring NASA’s fire research into a clear visual story, with each measurement connected to its original experiment record.",
    href: "#sources",
  },
];

export default function VenueGrid() {
  return <section className="venue-section content-section" id="venues" aria-labelledby="venue-title">
    <div className="section-heading-row">
      <div><p className="section-kicker">01 / BUILT FOR EVERY VENUE</p><h2 id="venue-title">Research should travel.</h2></div>
      <p>From a lab screen to a public exhibit, keep the source and its limitations in view.</p>
    </div>
    <div className="venue-grid">
      {venues.map(({ id, title, icon: Icon, art, description, href }, index) => <article className="venue-card" key={id}>
        <div className={`venue-art ${art}`} aria-hidden="true"><span className="art-index">0{index + 1} / SPACE</span><Icon size={46} strokeWidth={1.1} /><span className="art-crosshair">+</span></div>
        <div className="venue-card-body"><p className="section-kicker">APPLICATION / 0{index + 1}</p><h3>{title}</h3><p>{description}</p><a className="learn-more" href={href}>LEARN MORE <ArrowRight size={15} aria-hidden="true" /></a></div>
      </article>)}
    </div>
  </section>;
}
