const serviceLinks: ReadonlyArray<readonly [string, string, string]> = [
  ["/services/residential-removals", "House removals in Adelaide", "for a full household of furniture, boxes, garage and outdoor items."],
  ["/services/furniture-removals", "Furniture removalists", "when you only need a few large pieces moved safely."],
  ["/services/office-commercial-removals", "Office and commercial removals", "for workstations, storage rooms and timed building access."],
  ["/services/interstate-removals", "Interstate removalists from Adelaide", "when the move crosses a state border and needs a route and volume."],
  ["/services/backloading", "Backloading", "for interstate loads that suit shared truck space."],
  ["/services/packing-unpacking", "Packing and unpacking", "if you want help preparing or settling in."],
];

const regionLinks: ReadonlyArray<readonly [string, ReadonlyArray<readonly [string, string]>]> = [
  ["Central and apartments", [["/areas/adelaide-cbd", "Adelaide CBD"]]],
  ["Northern", [["/areas/elizabeth", "Elizabeth"], ["/areas/salisbury", "Salisbury"], ["/areas/playford", "Playford"], ["/areas/gawler", "Gawler"]]],
  ["North-eastern and eastern", [["/areas/north-eastern-adelaide", "North-Eastern Adelaide"], ["/areas/burnside", "Burnside"]]],
  ["Southern", [["/areas/goodwood", "Goodwood"]]],
  ["Western", [["/areas/western-adelaide", "Western Adelaide"]]],
  ["Coastal", [["/areas/glenelg", "Glenelg"], ["/areas/brighton", "Brighton"]]],
  ["Hills", [["/areas/adelaide-hills", "Adelaide Hills"], ["/areas/blackwood", "Blackwood"]]],
];

export function AdelaideGuide() {
  return (
    <section className="section detail-section adelaide-guide">
      <div className="container">
        <div className="editorial-sections">
          <article>
            <h2>Choose the right moving service first</h2>
            <p>Most Adelaide moves fit one of a few service types. Pick the closest match, then tell HF about anything that sits outside it.</p>
            <ul>
              {serviceLinks.map(([href, label, note]) => (
                <li key={href}><a href={href}>{label}</a> <span>{note}</span></li>
              ))}
            </ul>
            <p>You can compare all of them on the <a href="/services">Adelaide moving services</a> page.</p>
          </article>
          <article>
            <h2>Plan access at both addresses</h2>
            <p>Access usually decides how long a move takes. For apartments and the CBD, check lift bookings, loading zones, stairs and how far the truck sits from the door. For houses, note driveway length, slopes, parking and any garage or shed contents. Read the <a href="/guides/apartment-moving-preparation">apartment moving preparation guide</a> if either address is a unit.</p>
            <p>Access conditions differ across the metro area, so these area pages describe what to check in each region:</p>
            <ul>
              {regionLinks.map(([region, links]) => (
                <li key={region}>
                  <strong>{region}:</strong>{" "}
                  {links.map(([href, label], index) => (
                    <span key={href}>{index > 0 ? ", " : ""}<a href={href}>{label}</a></span>
                  ))}
                </li>
              ))}
            </ul>
            <p>Not listed? Browse every suburb on the <a href="/areas">Adelaide service areas</a> page.</p>
          </article>
          <article>
            <h2>How moving costs work in plain terms</h2>
            <p>Local moves are priced on the truck and crew you choose. A 3-hour minimum service and a separate 1-hour call-out fee apply, and additional time is billed in 30-minute increments. The final price is calculated once the move is completed. See current rates on the <a href="/pricing">removalist pricing</a> page, or read <a href="/guides/how-removalist-pricing-works">how removalist costs are calculated</a>.</p>
          </article>
          <article>
            <h2>Prepare before you request a quote</h2>
            <ul>
              <li>List the rooms, garage and outdoor items, then use the <a href="/guides/estimate-moving-volume">moving volume guide</a> if you are unsure of the load.</li>
              <li>Note stairs, lifts, parking and the carry distance at pickup and delivery.</li>
              <li>Measure large furniture and narrow doorways using the <a href="/guides/preparing-large-furniture">large furniture guide</a>.</li>
              <li>Decide what you will pack yourself with the <a href="/guides/packing-before-moving-day">packing guide</a>.</li>
              <li>Work through the <a href="/guides/adelaide-moving-checklist">Adelaide moving checklist</a>, or the <a href="/guides/preparing-interstate-move">interstate move guide</a> for longer routes.</li>
            </ul>
            <p>Then send both addresses, your preferred date and these details through the <a href="/#quote">move quote form</a>.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
