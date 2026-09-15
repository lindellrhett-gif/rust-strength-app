/**
 * The tab bar's names, in one place.
 *
 * Read by the tab bar itself and by the root stack, which uses the focused
 * tab's name as the back button label on screens opened from it. Keeping both
 * on this list means the button always matches the tab it returns to.
 */
export const TAB_TITLES = {
  index: 'Today',
  calendar: 'Calendar',
  stats: 'Stats',
  friends: 'Friends',
  profile: 'Profile',
} as const;

export type TabName = keyof typeof TAB_TITLES;

/**
 * The label for a tab route name. Before any tab has been focused the router
 * reports no name at all, and the app opens on Today, so that is the fallback —
 * as it is for anything unrecognised, rather than ever showing a raw route name.
 */
export function tabTitle(routeName: string | undefined): string {
  if (routeName && Object.prototype.hasOwnProperty.call(TAB_TITLES, routeName)) {
    return TAB_TITLES[routeName as TabName];
  }
  return TAB_TITLES.index;
}
