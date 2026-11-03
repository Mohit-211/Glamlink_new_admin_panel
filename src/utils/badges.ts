// The sidebar's badges count work waiting; MainLayout counts them on sign-in and on each change of page. A screen that
// finishes some of that work without leaving the page (verifying a listing claim from the list) asks for a recount.

const RECOUNT = "glamlink:recount-badges";

export const recountBadges = () => window.dispatchEvent(new Event(RECOUNT));

/** Calls `listener` whenever a recount is asked for; returns the unsubscribe. */
export const onRecountBadges = (listener: () => void) => {
  window.addEventListener(RECOUNT, listener);
  return () => window.removeEventListener(RECOUNT, listener);
};
