import {
  A,
  Route,
  Router,
  useLocation,
  useNavigate,
  type RouteSectionProps,
} from "@solidjs/router";
import { For, Show, createSignal, type Component, type JSX } from "solid-js";

type IconName =
  | "grid"
  | "alert"
  | "network"
  | "shield"
  | "settings"
  | "search"
  | "bell"
  | "chevron"
  | "arrow"
  | "activity"
  | "drop"
  | "truck"
  | "building"
  | "check"
  | "clock"
  | "map"
  | "menu"
  | "close"
  | "plus"
  | "book"
  | "target";

const paths: Record<IconName, JSX.Element> = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  alert: (
    <>
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 3.4 2.4 17a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.4a2 2 0 0 0-3.4 0Z" />
    </>
  ),
  network: (
    <>
      <circle cx="12" cy="5" r="3" />
      <circle cx="5" cy="19" r="3" />
      <circle cx="19" cy="19" r="3" />
      <path d="m10.5 7.6-4 8.1M13.5 7.6l4 8.1M8 19h8" />
    </>
  ),
  shield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
  chevron: <path d="m9 18 6-6-6-6" />,
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  activity: (
    <>
      <path d="M3 12h4l2-7 4 14 2-7h6" />
    </>
  ),
  drop: <path d="M12 2s6 6.2 6 12a6 6 0 1 1-12 0c0-5.8 6-12 6-12Z" />,
  truck: (
    <>
      <path d="M10 17h4V5H2v12h3" />
      <path d="M14 9h4l4 4v4h-3" />
      <circle cx="7.5" cy="17.5" r="2.5" />
      <circle cx="16.5" cy="17.5" r="2.5" />
    </>
  ),
  building: (
    <>
      <path d="M3 21h18M6 21V5l6-3 6 3v16" />
      <path d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 17h.01M15 17h.01" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  map: (
    <>
      <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z" />
      <path d="M9 3v15M15 6v15" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </>
  ),
  close: (
    <>
      <path d="m6 6 12 12M18 6 6 18" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5Z" />
      <path d="M4 6.5v13" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2V5M12 19v3M2 12h3M19 12h3" />
    </>
  ),
};

const Icon: Component<{ name: IconName; size?: number }> = (props) => (
  <svg
    class="icon"
    width={props.size ?? 20}
    height={props.size ?? 20}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    {paths[props.name]}
  </svg>
);

const navigation = [
  { href: "/", label: "Command center", icon: "grid" as const },
  { href: "/incidents", label: "Incidents", icon: "alert" as const, count: 3 },
  { href: "/network", label: "Supply network", icon: "network" as const },
  { href: "/playbooks", label: "Response playbooks", icon: "book" as const },
];

const PageHeader: Component<{
  eyebrow: string;
  title: string;
  description: string;
  action?: JSX.Element;
}> = (props) => (
  <header class="page-heading">
    <div>
      <p class="eyebrow">{props.eyebrow}</p>
      <h1>{props.title}</h1>
      <p class="page-description">{props.description}</p>
    </div>
    {props.action}
  </header>
);

const Shell: Component<RouteSectionProps> = (props) => {
  const [menuOpen, setMenuOpen] = createSignal(false);
  const location = useLocation();

  return (
    <div class="app-shell">
      <aside classList={{ sidebar: true, open: menuOpen() }}>
        <div class="brand-row">
          <A class="brand" href="/" onClick={() => setMenuOpen(false)}>
            <span class="brand-mark">
              <Icon name="drop" size={18} />
            </span>
            <span>
              HEMA<span>GUARD</span>
            </span>
          </A>
          <button
            class="icon-button sidebar-close"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
          >
            <Icon name="close" />
          </button>
        </div>

        <div class="system-status">
          <span class="pulse" /> Global monitoring active
        </div>
        <p class="nav-label">Operations</p>
        <nav aria-label="Primary navigation">
          <For each={navigation}>
            {(item) => (
              <A
                href={item.href}
                end={item.href === "/"}
                class="nav-link"
                activeClass="active"
                onClick={() => setMenuOpen(false)}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
                <Show when={item.count}>
                  <span class="nav-count">{item.count}</span>
                </Show>
              </A>
            )}
          </For>
        </nav>

        <div class="sidebar-spacer" />
        <div class="readiness-card">
          <div class="readiness-top">
            <Icon name="shield" size={18} />
            <span>Network readiness</span>
          </div>
          <strong>92%</strong>
          <div class="progress">
            <span style={{ width: "92%" }} />
          </div>
          <small>12 of 13 regions protected</small>
        </div>
        <button class="profile">
          <span class="avatar">AN</span>
          <span>
            <strong>Alex Navarro</strong>
            <small>Emergency coordinator</small>
          </span>
          <Icon name="chevron" size={16} />
        </button>
      </aside>

      <Show when={menuOpen()}>
        <button class="scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />
      </Show>

      <div class="main-column">
        <header class="topbar">
          <button
            class="icon-button menu-button"
            aria-label="Open navigation"
            onClick={() => setMenuOpen(true)}
          >
            <Icon name="menu" />
          </button>
          <div class="breadcrumb">
            <span>Blood supply defense</span>
            <Icon name="chevron" size={14} />
            <strong>
              {navigation.find((item) => item.href === location.pathname)?.label ?? "Alert detail"}
            </strong>
          </div>
          <div class="topbar-actions">
            <label class="search">
              <Icon name="search" size={17} />
              <input aria-label="Search network" placeholder="Search network" />
            </label>
            <button class="icon-button notification" aria-label="Notifications">
              <Icon name="bell" size={19} />
              <span />
            </button>
            <span class="utc">06 AUG 2026&nbsp; · &nbsp;14:32 UTC</span>
          </div>
        </header>
        <main>{props.children}</main>
      </div>
    </div>
  );
};

const attackRows = [
  {
    name: "Crimson Jackal",
    detail: "Ransomware · East Coast blood centers",
    severity: "Critical",
    time: "4m",
    icon: "alert" as const,
  },
  {
    name: "ColdTrace anomaly",
    detail: "Temperature telemetry · Nordic corridor",
    severity: "High",
    time: "18m",
    icon: "activity" as const,
  },
  {
    name: "DonorSync credential leak",
    detail: "Identity access · Central Europe",
    severity: "High",
    time: "42m",
    icon: "target" as const,
  },
  {
    name: "Route diversion attempt",
    detail: "Logistics API · Great Lakes region",
    severity: "Contained",
    time: "1h",
    icon: "truck" as const,
  },
];

const MetricCard: Component<{
  icon: IconName;
  label: string;
  value: string;
  meta: string;
  tone?: string;
}> = (props) => (
  <article class="metric-card">
    <div class={`metric-icon ${props.tone ?? ""}`}>
      <Icon name={props.icon} />
    </div>
    <div>
      <p>{props.label}</p>
      <strong>{props.value}</strong>
      <small>{props.meta}</small>
    </div>
  </article>
);

const Dashboard: Component = () => {
  const navigate = useNavigate();
  const [acknowledged, setAcknowledged] = createSignal(false);
  return (
    <div class="page dashboard-page">
      <PageHeader
        eyebrow="Live intelligence"
        title="Blood supply command center"
        description="Detect, contain, and recover from attacks across the vein-to-vein network."
        action={
          <button class="primary-button" onClick={() => navigate("/incidents")}>
            <Icon name="activity" size={17} /> Open incident room
          </button>
        }
      />

      <Show when={!acknowledged()}>
        <section class="priority-alert">
          <span class="alert-symbol">
            <Icon name="alert" size={19} />
          </span>
          <div>
            <strong>Critical disruption detected</strong>
            <p>
              Crimson Jackal is targeting appointment and inventory systems at 8 East Coast blood
              centers.
            </p>
          </div>
          <span class="alert-time">4 min ago</span>
          <button class="alert-link" onClick={() => navigate("/incidents/crimson-jackal")}>
            Investigate <Icon name="arrow" size={15} />
          </button>
          <button
            class="dismiss"
            aria-label="Acknowledge alert"
            onClick={() => setAcknowledged(true)}
          >
            <Icon name="close" size={16} />
          </button>
        </section>
      </Show>

      <section class="metrics-grid" aria-label="Supply network overview">
        <MetricCard
          icon="drop"
          label="Available blood units"
          value="84,219"
          meta="↑ 2.8% from yesterday"
        />
        <MetricCard
          icon="alert"
          label="Active threats"
          value="03"
          meta="1 critical · 2 high"
          tone="danger"
        />
        <MetricCard
          icon="building"
          label="Facilities online"
          value="428 / 436"
          meta="8 operating in isolation"
          tone="blue"
        />
        <MetricCard
          icon="clock"
          label="Estimated resilience"
          value="71 hrs"
          meta="Across all blood types"
          tone="gold"
        />
      </section>

      <section class="dashboard-grid">
        <article class="panel network-overview">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Real-time exposure</p>
              <h2>Supply network risk</h2>
            </div>
            <A href="/network" class="text-link">
              View full network <Icon name="arrow" size={14} />
            </A>
          </div>
          <div class="risk-visual">
            <div class="risk-score">
              <span>Global risk index</span>
              <strong>8.4</strong>
              <small>SEVERE</small>
            </div>
            <div class="network-map" aria-label="Stylized network risk map">
              <svg
                viewBox="0 0 650 250"
                role="img"
                aria-label="Connected blood facilities across operating regions"
              >
                <g class="links">
                  <path d="M73 87 169 137 277 81 376 122 486 67 579 116" />
                  <path d="M169 137 247 197 376 122 434 188 579 116" />
                  <path d="M73 87 131 33 277 81 345 34 486 67" />
                </g>
                <g class="nodes">
                  <circle cx="73" cy="87" r="7" />
                  <circle cx="131" cy="33" r="5" />
                  <circle cx="169" cy="137" r="8" />
                  <circle cx="247" cy="197" r="6" />
                  <circle cx="277" cy="81" r="7" />
                  <circle cx="345" cy="34" r="5" />
                  <circle cx="376" cy="122" r="9" class="danger-node" />
                  <circle cx="434" cy="188" r="6" />
                  <circle cx="486" cy="67" r="7" />
                  <circle cx="579" cy="116" r="6" />
                </g>
              </svg>
              <span class="map-label east">
                EAST COAST <b>CRITICAL</b>
              </span>
              <span class="map-label nordic">
                NORDIC <b>HIGH</b>
              </span>
              <span class="map-label pacific">
                PACIFIC <b>STABLE</b>
              </span>
            </div>
          </div>
          <div class="risk-legend">
            <span>
              <i class="critical" /> Critical risk
            </span>
            <span>
              <i class="elevated" /> Elevated
            </span>
            <span>
              <i class="stable" /> Stable
            </span>
            <span class="last-sync">Updated 24 seconds ago</span>
          </div>
        </article>

        <article class="panel threat-feed">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Threat intelligence</p>
              <h2>Active signals</h2>
            </div>
            <span class="live-pill">
              <i /> Live
            </span>
          </div>
          <div class="threat-list">
            <For each={attackRows}>
              {(attack) => (
                <button
                  class="threat-row"
                  onClick={() =>
                    navigate(
                      attack.name === "Crimson Jackal" ? "/incidents/crimson-jackal" : "/incidents",
                    )
                  }
                >
                  <span class={`threat-icon ${attack.severity.toLowerCase()}`}>
                    <Icon name={attack.icon} size={17} />
                  </span>
                  <span class="threat-copy">
                    <strong>{attack.name}</strong>
                    <small>{attack.detail}</small>
                  </span>
                  <span class={`severity ${attack.severity.toLowerCase()}`}>{attack.severity}</span>
                  <time>{attack.time}</time>
                  <Icon name="chevron" size={15} />
                </button>
              )}
            </For>
          </div>
          <A href="/incidents" class="panel-footer-link">
            View all intelligence <Icon name="arrow" size={14} />
          </A>
        </article>

        <article class="panel inventory-panel">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Protected inventory</p>
              <h2>National reserves</h2>
            </div>
            <span class="tag neutral">All regions</span>
          </div>
          <div class="blood-types">
            <For
              each={[
                ["O−", "62", "14%", "low"],
                ["O+", "88", "38%", "ok"],
                ["A−", "71", "12%", "mid"],
                ["A+", "94", "29%", "ok"],
                ["B−", "54", "9%", "low"],
                ["B+", "82", "17%", "ok"],
                ["AB−", "47", "5%", "low"],
                ["AB+", "76", "8%", "mid"],
              ]}
            >
              {(blood) => (
                <div class="blood-row">
                  <strong>{blood[0]}</strong>
                  <span class="mini-progress">
                    <i class={blood[3]} style={{ width: `${blood[1]}%` }} />
                  </span>
                  <b>{blood[2]}</b>
                  <small>{blood[1]}h</small>
                </div>
              )}
            </For>
          </div>
          <p class="inventory-note">
            <Icon name="alert" size={15} /> O− and AB− reserves require regional rebalancing within
            6 hours.
          </p>
        </article>

        <article class="panel response-panel">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Response posture</p>
              <h2>Recommended actions</h2>
            </div>
            <span class="tag">3 pending</span>
          </div>
          <ol class="action-list">
            <li>
              <span>1</span>
              <div>
                <strong>Isolate East Coast nodes</strong>
                <small>
                  Preserve cold-chain controls while severing compromised scheduling APIs.
                </small>
              </div>
              <button aria-label="Open action">
                <Icon name="chevron" size={16} />
              </button>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Activate donor continuity</strong>
                <small>Route verified donors to 14 unaffected collection sites.</small>
              </div>
              <button aria-label="Open action">
                <Icon name="chevron" size={16} />
              </button>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Rebalance universal units</strong>
                <small>Release protected O− reserve from Central region.</small>
              </div>
              <button aria-label="Open action">
                <Icon name="chevron" size={16} />
              </button>
            </li>
          </ol>
          <A href="/playbooks" class="secondary-button">
            Open response playbook <Icon name="arrow" size={15} />
          </A>
        </article>
      </section>
    </div>
  );
};

const Incidents: Component = () => {
  const navigate = useNavigate();
  return (
    <div class="page">
      <PageHeader
        eyebrow="Intelligence queue"
        title="Incident operations"
        description="Prioritized attacks and anomalies affecting the blood supply chain."
        action={
          <button class="primary-button">
            <Icon name="plus" size={17} /> Create incident
          </button>
        }
      />
      <div class="filter-bar">
        <span class="filter active">
          All incidents <b>12</b>
        </span>
        <span class="filter">
          Critical <b>1</b>
        </span>
        <span class="filter">
          Investigating <b>3</b>
        </span>
        <span class="filter">
          Contained <b>8</b>
        </span>
      </div>
      <section class="panel incident-table">
        <div class="table-head">
          <span>Incident</span>
          <span>Attack surface</span>
          <span>Region</span>
          <span>Severity</span>
          <span>Status</span>
          <span>Updated</span>
        </div>
        <For
          each={[
            [
              "Crimson Jackal",
              "Appointment + inventory",
              "East Coast",
              "Critical",
              "Escalated",
              "4m",
            ],
            ["ColdTrace anomaly", "Cold-chain telemetry", "Nordic", "High", "Investigating", "18m"],
            [
              "DonorSync credential leak",
              "Donor identity",
              "Central Europe",
              "High",
              "Investigating",
              "42m",
            ],
            [
              "Route diversion attempt",
              "Logistics API",
              "Great Lakes",
              "Medium",
              "Contained",
              "1h",
            ],
            [
              "False-negative injection",
              "Screening interface",
              "Pacific",
              "Medium",
              "Contained",
              "3h",
            ],
          ]}
        >
          {(row) => (
            <button
              class="table-row"
              onClick={() => row[0] === "Crimson Jackal" && navigate("/incidents/crimson-jackal")}
            >
              <span>
                <i class={`incident-dot ${row[3].toLowerCase()}`} />
                <strong>{row[0]}</strong>
                <small>INC-{row[0] === "Crimson Jackal" ? "0842" : "0837"}</small>
              </span>
              <span>{row[1]}</span>
              <span>{row[2]}</span>
              <span>
                <b class={`severity ${row[3].toLowerCase()}`}>{row[3]}</b>
              </span>
              <span>{row[4]}</span>
              <span>
                {row[5]} <Icon name="chevron" size={15} />
              </span>
            </button>
          )}
        </For>
      </section>
    </div>
  );
};

const IncidentDetail: Component = () => {
  const [contained, setContained] = createSignal(false);
  return (
    <div class="page">
      <div class="detail-back">
        <A href="/incidents">← Back to incidents</A>
      </div>
      <PageHeader
        eyebrow="INC-0842 · Active incident"
        title="Crimson Jackal"
        description="Coordinated ransomware campaign targeting collection-center scheduling and blood inventory systems."
        action={
          <button class="primary-button" disabled={contained()} onClick={() => setContained(true)}>
            <Icon name="shield" size={17} />{" "}
            {contained() ? "Containment initiated" : "Initiate containment"}
          </button>
        }
      />
      <section class="detail-grid">
        <article class="panel incident-brief">
          <div class="brief-banner">
            <Icon name="alert" />
            <div>
              <strong>Critical operational impact</strong>
              <p>8 facilities are isolated. No evidence of compromised blood-product integrity.</p>
            </div>
          </div>
          <h2>Incident timeline</h2>
          <div class="timeline">
            <For
              each={[
                [
                  "14:28",
                  "Ransomware signature confirmed",
                  "Endpoint telemetry matched Crimson Jackal infrastructure.",
                ],
                [
                  "14:21",
                  "Automated isolation triggered",
                  "Scheduling APIs severed at eight affected centers.",
                ],
                [
                  "14:14",
                  "Inventory reconciliation drift",
                  "Unverified changes detected in O− allocation records.",
                ],
                [
                  "14:03",
                  "Initial access detected",
                  "Compromised vendor account used from an anomalous location.",
                ],
              ]}
            >
              {(event, index) => (
                <div class="timeline-event">
                  <span classList={{ current: index() === 0 }} />
                  <time>{event[0]}</time>
                  <div>
                    <strong>{event[1]}</strong>
                    <p>{event[2]}</p>
                  </div>
                </div>
              )}
            </For>
          </div>
        </article>
        <aside class="detail-side">
          <article class="panel">
            <h2>Incident owner</h2>
            <div class="owner">
              <span class="avatar">MP</span>
              <div>
                <strong>Maya Patel</strong>
                <small>National response lead</small>
              </div>
            </div>
            <dl>
              <div>
                <dt>Severity</dt>
                <dd>
                  <b class="severity critical">Critical</b>
                </dd>
              </div>
              <div>
                <dt>Facilities</dt>
                <dd>8 isolated</dd>
              </div>
              <div>
                <dt>Blood units at risk</dt>
                <dd>0 verified</dd>
              </div>
              <div>
                <dt>First observed</dt>
                <dd>14:03 UTC</dd>
              </div>
            </dl>
          </article>
          <article class="panel">
            <h2>Containment progress</h2>
            <div class="containment-score">
              <strong>{contained() ? "64" : "42"}%</strong>
              <span class="progress">
                <i style={{ width: contained() ? "64%" : "42%" }} />
              </span>
            </div>
            <p class="muted">
              {contained()
                ? "Isolation and credential rotation are in progress."
                : "3 of 7 automated actions are complete."}
            </p>
          </article>
        </aside>
      </section>
    </div>
  );
};

const Network: Component = () => (
  <div class="page">
    <PageHeader
      eyebrow="436 monitored facilities"
      title="Supply network"
      description="End-to-end visibility from donor recruitment through hospital delivery."
      action={
        <button class="primary-button">
          <Icon name="map" size={17} /> Map controls
        </button>
      }
    />
    <section class="network-stats">
      <div>
        <span class="status-dot stable" />
        <strong>428</strong>
        <small>Online</small>
      </div>
      <div>
        <span class="status-dot elevated" />
        <strong>8</strong>
        <small>Isolated</small>
      </div>
      <div>
        <span class="status-dot critical" />
        <strong>3</strong>
        <small>Active threats</small>
      </div>
      <div>
        <Icon name="truck" />
        <strong>1,284</strong>
        <small>Shipments today</small>
      </div>
    </section>
    <article class="panel full-map">
      <div class="map-toolbar">
        <div>
          <button class="active">Facilities</button>
          <button>Shipments</button>
          <button>Threats</button>
        </div>
        <span>
          <i class="pulse" /> Live network
        </span>
      </div>
      <div class="large-network">
        <div class="radar-ring one" />
        <div class="radar-ring two" />
        <For each={["donor", "collection", "testing", "processing", "storage", "hospital"]}>
          {(node, i) => (
            <div class={`network-node node-${i()}`}>
              <span>
                <Icon name={i() === 5 ? "building" : i() === 4 ? "drop" : "activity"} size={18} />
              </span>
              <strong>{node}</strong>
              <small>
                {
                  [
                    "82 sites",
                    "141 centers",
                    "24 laboratories",
                    "53 facilities",
                    "61 hubs",
                    "318 endpoints",
                  ][i()]
                }
              </small>
            </div>
          )}
        </For>
        <svg viewBox="0 0 900 470">
          <path d="M110 240 C210 110 270 105 365 190 S525 345 610 215 760 130 820 235" />
          <path d="M110 240 C250 345 300 360 465 275 S670 335 820 235" />
        </svg>
      </div>
    </article>
  </div>
);

const Playbooks: Component = () => (
  <div class="page">
    <PageHeader
      eyebrow="Prepared response"
      title="Response playbooks"
      description="Pre-approved actions for continuity, containment, and safe recovery."
      action={
        <button class="primary-button">
          <Icon name="plus" size={17} /> New playbook
        </button>
      }
    />
    <section class="playbook-grid">
      <For
        each={[
          [
            "Ransomware isolation",
            "Sever compromised systems while maintaining local collection and cold-chain operations.",
            "12 steps",
            "18 min",
            "shield",
          ],
          [
            "Cold-chain telemetry loss",
            "Validate product temperature manually and restore a trusted monitoring channel.",
            "8 steps",
            "12 min",
            "activity",
          ],
          [
            "Inventory integrity breach",
            "Reconcile unit records against signed facility manifests and quarantine exceptions.",
            "15 steps",
            "25 min",
            "drop",
          ],
          [
            "Donor identity exposure",
            "Revoke access, protect affected donors, and maintain appointment continuity.",
            "10 steps",
            "16 min",
            "target",
          ],
          [
            "Logistics route compromise",
            "Authenticate drivers, establish verified routes, and reroute priority shipments.",
            "9 steps",
            "14 min",
            "truck",
          ],
          [
            "Regional supply continuity",
            "Balance universal units and activate emergency donor communications.",
            "11 steps",
            "20 min",
            "network",
          ],
        ]}
      >
        {(item, i) => (
          <article class="panel playbook-card">
            <div class="playbook-icon">
              <Icon name={item[4] as IconName} />
            </div>
            <span class="verified">
              <Icon name="check" size={13} /> Verified {i() < 3 ? "this week" : "last month"}
            </span>
            <h2>{item[0]}</h2>
            <p>{item[1]}</p>
            <div class="playbook-meta">
              <span>{item[2]}</span>
              <span>
                <Icon name="clock" size={14} />
                {item[3]}
              </span>
            </div>
            <button>
              Open playbook <Icon name="arrow" size={15} />
            </button>
          </article>
        )}
      </For>
    </section>
  </div>
);

const NotFound: Component = () => (
  <div class="empty-page">
    <span class="brand-mark">
      <Icon name="drop" />
    </span>
    <p class="eyebrow">404</p>
    <h1>Signal not found</h1>
    <p>The requested command-center view does not exist.</p>
    <A class="primary-button" href="/">
      Return to command center
    </A>
  </div>
);

const App: Component = () => (
  <Router root={Shell}>
    <Route path="/" component={Dashboard} />
    <Route path="/incidents" component={Incidents} />
    <Route path="/incidents/crimson-jackal" component={IncidentDetail} />
    <Route path="/network" component={Network} />
    <Route path="/playbooks" component={Playbooks} />
    <Route path="*404" component={NotFound} />
  </Router>
);

export default App;
