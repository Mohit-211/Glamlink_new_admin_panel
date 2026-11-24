import { describe, expect, it } from "vitest";
import { generatePath } from "react-router";
import { isGroup, screenFor, SIDEBAR, SIDEBAR_SCREENS } from "./sidebarMenu";
import { MOVED_PATHS, paths } from "../paths";

const groupOf = (path: string) => SIDEBAR_SCREENS.find((screen) => screen.path === path)?.group;

describe("The sidebar", () => {
  it("lists each address once, and no group key is an address", () => {
    const addresses = SIDEBAR_SCREENS.map(({ path }) => path);
    expect(new Set(addresses).size).toBe(addresses.length);
    for (const item of SIDEBAR.filter(isGroup)) expect(item.key).toMatch(/^group:/);
  });

  it("puts each screen with what it belongs to", () => {
    // A professional's subscription sits with the professionals list, not with the cards.
    expect(groupOf(paths.subscriptions)).toBe("group:professionals");
    expect(groupOf(paths.professionals)).toBe("group:professionals");
    expect(groupOf(paths.profilePages)).toBe("group:professionals");
    expect(groupOf(paths.loginActivity)).toBe("group:professionals");
    // Topics are shared by articles, products, podcast guests and videos: a top-level entry.
    expect(SIDEBAR_SCREENS.find(({ path }) => path === paths.topics)).toEqual({ path: paths.topics, label: "Topics" });
    // The shop and the Discover lists are not the Journal's.
    expect(groupOf(paths.products)).toBe("group:shop");
    expect(groupOf(paths.productTags)).toBe("group:shop");
    expect(groupOf(paths.education)).toBe("group:discover");
    expect(groupOf(paths.events)).toBe("group:discover");
    // The directory's three screens are together.
    expect(groupOf(paths.directoryApplications)).toBe("group:directory");
    expect(groupOf(paths.listingClaims)).toBe("group:directory");
    expect(groupOf(paths.directorySections)).toBe("group:directory");
  });

  it("selects the list for its add, edit and detail pages, and nothing for the admin's own account", () => {
    expect(screenFor("/")?.path).toBe(paths.dashboard);
    expect(screenFor("/professionals/12")?.path).toBe(paths.professionals);
    expect(screenFor("/professionals/pages/812/analytics")?.path).toBe(paths.profilePages);
    expect(screenFor("/journal/articles/new")?.path).toBe(paths.articles);
    expect(screenFor(paths.importBrands)?.path).toBe(paths.profilePages);
    expect(screenFor("/topics/4/edit")?.path).toBe(paths.topics);
    expect(screenFor("/shop/tags")?.path).toBe(paths.productTags);
    expect(screenFor("/ads/3/edit")?.path).toBe(paths.ads);
    expect(screenFor("/access/orders/7")?.path).toBe(paths.orders);
    // A prefix only counts at a "/": /adsense is not under /ads.
    expect(screenFor("/adsense")).toBeUndefined();
    expect(screenFor(paths.account)).toBeUndefined();
    expect(screenFor(paths.changePassword)).toBeUndefined();
  });
});

describe("Moved addresses", () => {
  it("each lead to a screen the sidebar selects, or to the admin's own account", () => {
    const froms = MOVED_PATHS.map(([from]) => from);
    expect(new Set(froms).size).toBe(froms.length);

    const unselected = MOVED_PATHS.map(([, to]) => generatePath(to, { id: "7", userId: "7" })).filter(
      (address) => !address.startsWith(paths.account) && !screenFor(address),
    );
    expect(unselected).toEqual([]);
  });

  it("keep each parameter's name", () => {
    const names = (pattern: string) => [...pattern.matchAll(/:(\w+)/g)].map((m) => m[1]).sort();
    expect(MOVED_PATHS.filter(([from, to]) => names(from).join() !== names(to).join())).toEqual([]);
  });

  it("never move an address that is in use now", () => {
    const current = SIDEBAR_SCREENS.map(({ path }) => path);
    for (const [from] of MOVED_PATHS) expect(current).not.toContain(from);
  });

  it("keep the order email's link", () => {
    expect(MOVED_PATHS).toContainEqual(["/access-orders/:id", "/access/orders/:id"]);
  });
});
