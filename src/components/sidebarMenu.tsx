import type React from "react";
import {
  ApartmentOutlined,
  AppstoreOutlined,
  AudioOutlined,
  AuditOutlined,
  BookOutlined,
  CalendarOutlined,
  CompassOutlined,
  ContactsOutlined,
  CrownOutlined,
  DashboardOutlined,
  DollarOutlined,
  EditOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  FormOutlined,
  GlobalOutlined,
  HistoryOutlined,
  HomeOutlined,
  IdcardOutlined,
  InboxOutlined,
  LineChartOutlined,
  MailOutlined,
  NotificationOutlined,
  PlaySquareOutlined,
  ProfileOutlined,
  QuestionCircleOutlined,
  ReadOutlined,
  SafetyCertificateOutlined,
  ScissorOutlined,
  SearchOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  SnippetsOutlined,
  SolutionOutlined,
  StarOutlined,
  TagOutlined,
  TagsOutlined,
  TeamOutlined,
  TruckOutlined,
  UnorderedListOutlined,
  UsergroupAddOutlined,
  UserSwitchOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { paths } from "../paths";

/** Work waiting for review, shown as badges. */
export interface PendingCounts {
  /** Applicant forms to review. */
  applicants: number;
  /** Directory applications to review. */
  applications: number;
  /** Google listing claims to verify. */
  claims: number;
}

/** A screen in the sidebar, keyed by its address. `badge` names its count of work waiting. */
export interface SidebarEntry {
  path: string;
  icon: React.ReactNode;
  label: string;
  badge?: keyof PendingCounts;
}

/** A group of screens. Its key is never an address, so no key is used twice. */
export interface SidebarGroup {
  key: `group:${string}`;
  icon: React.ReactNode;
  label: string;
  entries: SidebarEntry[];
}

export const isGroup = (item: SidebarEntry | SidebarGroup): item is SidebarGroup => "entries" in item;

/**
 * The sidebar: one group per part of the business. Professionals and what belongs to one (their page, their Access Pro
 * subscription), Access cards, the directory, what the website's forms collect, then the content (Journal, Topics,
 * Shop, Media, Discover), ads, the website's own pages, and the panel's admins. Every address is in paths.ts.
 * The mobile app's screens (posts, clips, bookings, shop orders, rewards) are gone until the app is rebuilt.
 */
export const SIDEBAR: (SidebarEntry | SidebarGroup)[] = [
  { path: paths.dashboard, icon: <DashboardOutlined />, label: "Dashboard" },
  {
    key: "group:professionals",
    icon: <SolutionOutlined />,
    label: "Professionals",
    entries: [
      { path: paths.professionals, icon: <TeamOutlined />, label: "All Professionals" },
      { path: paths.profilePages, icon: <ProfileOutlined />, label: "Profile Pages" },
      { path: paths.subscriptions, icon: <CrownOutlined />, label: "Subscriptions" },
      { path: paths.applicantForms, icon: <FormOutlined />, label: "Applicant Forms", badge: "applicants" },
      { path: paths.specialities, icon: <ScissorOutlined />, label: "Specialities" },
      { path: paths.loginActivity, icon: <HistoryOutlined />, label: "Login Activity" },
    ],
  },
  {
    key: "group:access",
    icon: <IdcardOutlined />,
    label: "Access Cards",
    entries: [
      { path: paths.cards, icon: <ContactsOutlined />, label: "Cards" },
      { path: paths.orders, icon: <TruckOutlined />, label: "Orders" },
      { path: paths.pricing, icon: <DollarOutlined />, label: "Pricing" },
      { path: paths.cardAnalytics, icon: <LineChartOutlined />, label: "Analytics" },
    ],
  },
  {
    key: "group:directory",
    icon: <FolderOpenOutlined />,
    label: "Directory",
    entries: [
      { path: paths.directoryApplications, icon: <AuditOutlined />, label: "Applications", badge: "applications" },
      { path: paths.listingClaims, icon: <SafetyCertificateOutlined />, label: "Listing Claims", badge: "claims" },
      { path: paths.directorySections, icon: <ApartmentOutlined />, label: "Sections" },
    ],
  },
  {
    key: "group:inquiries",
    icon: <InboxOutlined />,
    label: "Inquiries",
    entries: [
      { path: paths.partnerInquiries, icon: <UsergroupAddOutlined />, label: "Partner With Us" },
      { path: paths.featureRequests, icon: <StarOutlined />, label: "Feature Requests" },
      { path: paths.newsletter, icon: <MailOutlined />, label: "Newsletter" },
    ],
  },
  {
    key: "group:journal",
    icon: <ReadOutlined />,
    label: "Journal",
    entries: [
      { path: paths.articles, icon: <FileTextOutlined />, label: "Articles" },
      { path: paths.journalCategories, icon: <AppstoreOutlined />, label: "Categories" },
      { path: paths.authors, icon: <EditOutlined />, label: "Authors" },
      { path: paths.journalFaqs, icon: <QuestionCircleOutlined />, label: "FAQs" },
    ],
  },
  { path: paths.topics, icon: <TagsOutlined />, label: "Topics" },
  {
    key: "group:shop",
    icon: <ShoppingOutlined />,
    label: "Shop",
    entries: [
      { path: paths.products, icon: <ShoppingCartOutlined />, label: "Products" },
      { path: paths.productTags, icon: <TagOutlined />, label: "Product Tags" },
    ],
  },
  {
    key: "group:media",
    icon: <PlaySquareOutlined />,
    label: "Media",
    entries: [
      { path: paths.magazine, icon: <SnippetsOutlined />, label: "Magazine" },
      { path: paths.videos, icon: <VideoCameraOutlined />, label: "Videos" },
      { path: paths.videoSeries, icon: <UnorderedListOutlined />, label: "Video Series" },
      { path: paths.podcastSchedule, icon: <AudioOutlined />, label: "Podcast Schedule" },
    ],
  },
  {
    key: "group:discover",
    icon: <CompassOutlined />,
    label: "Discover",
    entries: [
      { path: paths.education, icon: <BookOutlined />, label: "Education" },
      { path: paths.events, icon: <CalendarOutlined />, label: "Events" },
    ],
  },
  { path: paths.ads, icon: <NotificationOutlined />, label: "Ads" },
  {
    key: "group:website",
    icon: <GlobalOutlined />,
    label: "Website",
    entries: [
      { path: paths.homePage, icon: <HomeOutlined />, label: "Home Page" },
      { path: paths.searchTerms, icon: <SearchOutlined />, label: "Search Terms" },
    ],
  },
  { path: paths.admins, icon: <UserSwitchOutlined />, label: "Admins" },
];

/** Every screen in the sidebar, with the group it sits in (if any). */
export const SIDEBAR_SCREENS: { path: string; label: string; group?: SidebarGroup["key"] }[] = SIDEBAR.flatMap((item) =>
  isGroup(item)
    ? item.entries.map(({ path, label }) => ({ path, label, group: item.key }))
    : [{ path: item.path, label: item.label }],
);

/**
 * The sidebar screen for an address: the screen itself, or the deepest one it sits under, so a list's add, edit and
 * detail pages select the list (/journal/articles/12 → /journal/articles). Addresses outside the sidebar (the admin's
 * own account) select nothing.
 */
export const screenFor = (pathname: string) =>
  SIDEBAR_SCREENS.filter(({ path }) => path === pathname || (path !== "/" && pathname.startsWith(`${path}/`))).sort(
    (a, b) => b.path.length - a.path.length,
  )[0];
