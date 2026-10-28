import { useEffect, useState } from "react";

const links = [
  ["#overview", "▦", "Overview"],
  ["#trends", "⌁", "Spending trends"],
  ["#anomalies", "⚠", "Spending anomalies"],
  ["#state-comparison", "⇄", "State comparison"],
  ["#provenance", "◎", "Data provenance"],
];

export default function Sidebar() {
  const [active, setActive] = useState("#overview");

  useEffect(() => {
    const sections = links
      .map(([href]) => document.querySelector(href))
      .filter(Boolean);
    if (!sections.length) return undefined;

    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (visible[0]) setActive(`#${visible[0].target.id}`);
    }, {
      root: null,
      rootMargin: "-18% 0px -62% 0px",
      threshold: [0, 0.1, 0.25, 0.5],
    });

    sections.forEach((section) => observer.observe(section));
    const updateFromHash = () => {
      if (links.some(([href]) => href === window.location.hash)) setActive(window.location.hash);
    };
    window.addEventListener("hashchange", updateFromHash);
    updateFromHash();

    return () => {
      observer.disconnect();
      window.removeEventListener("hashchange", updateFromHash);
    };
  }, []);

  return (
    <aside className="sidebar">
      <a className="brand" href="#overview"><i>F</i>Fund<span>Scope</span></a>
      <small className="navlabel">WORKSPACE</small>
      <nav aria-label="Dashboard sections">
        {links.map(([href, icon, label]) => (
          <a
            className={`nav ${active === href ? "active" : ""}`}
            href={href}
            key={href}
            aria-current={active === href ? "location" : undefined}
            onClick={() => setActive(href)}
          >
            <span className="nav-icon" aria-hidden="true">{icon}</span>
            <span>{label}</span>
          </a>
        ))}
      </nav>
      <div className="sidebottom">
        <b><span className="status-dot" /> RBI e-STATES</b>
        <p>Evidence-first public finance exploration.</p>
      </div>
    </aside>
  );
}
