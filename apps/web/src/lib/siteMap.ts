export type SiteRouteId =
  | 'threshold'
  | 'converse'
  | 'enquire'
  | 'records'
  | 'priestesses'
  | 'shell'
  | 'developers';

export type SiteRoute = {
  id: SiteRouteId;
  href: string;
  label: string;
  icon?: string;
  authedOnly?: boolean;
};

export const siteRoutes = {
  threshold: { id: 'threshold', href: '/', label: 'Threshold · προπύλαια', icon: '⛶' },
  converse: { id: 'converse', href: '/enquire', label: 'Converse · ναός', icon: '✶' },
  enquire: { id: 'enquire', href: '/enquire/rites', label: 'Enquire · ἄδυτον', icon: '☉', authedOnly: true },
  records: { id: 'records', href: '/thread', label: 'Records · στοά', icon: '☷', authedOnly: true },
  priestesses: { id: 'priestesses', href: '/clea', label: 'Priestesses · ἱέρειαι', icon: '⚭' },
  shell: { id: 'shell', href: '/ripl', label: 'CLI/TUI · τέχνη', icon: '◎' },
  developers: { id: 'developers', href: '/diy', label: 'Developers · κανών', icon: '◈' }
} as const satisfies Record<SiteRouteId, SiteRoute>;

export const controlPanelNav: SiteRoute[] = [
  siteRoutes.threshold,
  siteRoutes.converse,
  siteRoutes.enquire,
  siteRoutes.records,
  siteRoutes.priestesses,
  siteRoutes.shell,
  siteRoutes.developers
];

export function routeIsActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
