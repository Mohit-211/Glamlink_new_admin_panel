/** @format */

import { BrowserRouter as Router, Routes, Route, Navigate, generatePath, useLocation, useParams } from "react-router";
import { ConfigProvider } from "antd";
import { MOVED_PATHS, paths } from "./paths";
import NotFound from "./pages/ErrorPages/NotFound";
import { antdTheme } from "./config/theme";
import Dashboard from "./pages/Dashboard/Dashboard";
import Login from "./pages/Login/Login";
import ChangePassword from "./pages/Sidebar/Settings/ChangePassword/ChangePassword";
import MainLayout from "./components/MainLayout";
import AdminUser from "./pages/AdminManagement/AdminUser";
import ViewAdmin from "./pages/AdminManagement/ViewAdmin";
import AddAdmin from "./pages/AdminManagement/AddAdmin";
import LoginLogs from "./pages/Sidebar/LoginActivity/LoginLogs";
import Error401 from "./pages/ErrorPages/Error401";
import Professionals from "./pages/Professionals/Professionals";
import ViewProfessionals from "./pages/Professionals/ViewProfessionals";
import Specialities from "./pages/Specialities/Specialities";
import AddSpecialities from "./pages/Specialities/AddSpecialities";
import EditSpecialities from "./pages/Specialities/EditSpecialities";
import ProfessionalForm from "./pages/ProfessionalForm/ProfessionalForm";
import BusinessCard from "./pages/BusinessCard/BusinessCard";
import JournalCategory from "./pages/Journal/JournalCategory/JournalCategory";
import Authors from "./pages/Journal/Authors/Authors";
import Journal from "./pages/Journal/Journal/Journal";
import AddJournal from "./pages/Journal/Journal/AddJournal";
import EditJournal from "./pages/Journal/Journal/EditJournal";
import Directroy from "./pages/Directory/Directroy";
import CreateBusinessCard from "./pages/BusinessCard/CreateBusinessCard";
import EditBusinessCard from "./pages/BusinessCard/EditBusinessCard";
import PodcastSchedule from "./pages/Podcast/PodcastSchedule";
import AddPodcastSchedule from "./pages/Podcast/AddPodcastSchedule";
import EditPodcastSchedule from "./pages/Podcast/EditPodcastSchedule";
import Education from "./pages/Journal/Discover/Eductaion/Eduction";
import AddEducation from "./pages/Journal/Discover/Eductaion/AddEduction";
import EditEducation from "./pages/Journal/Discover/Eductaion/EditEducation";
import Event from "./pages/Journal/Discover/Event/Event";
import AddEvent from "./pages/Journal/Discover/Event/AddEvent";
import EditEvent from "./pages/Journal/Discover/Event/EditEvent";
import Shop from "./pages/Journal/Discover/Shop/Shop";
import AddShop from "./pages/Journal/Discover/Shop/AddShop";
import EditShop from "./pages/Journal/Discover/Shop/EditShop";
import ProductTags from "./pages/Journal/Discover/Shop/ProductTags";
import AccessOrders from "./pages/BusinessCard/AccessOrders";
import Ads from "./pages/Ads/AdsList";
import AddAd from "./pages/Ads/AddAd";
import ViewAd from "./pages/Ads/Viewad";
import JournalTopics from "./pages/JournalTopics/JournalTopics";
import JournalFaq from "./pages/JournalFaq/JournalFaq";
import AddJournalTopic from "./pages/JournalTopics/AddJournalTopic";
import EditJournalTopic from "./pages/JournalTopics/EditJournalTopic";
import TopicScreen from "./pages/JournalTopics/TopicScreen";
import AccessCardAnalytics from "./pages/AccessCardAnalytics/AccessCardAnalytics";
import PartnerInquiries from "./pages/PartnerInquiries/PartnerInquiries";
import ViewPartnerInquiry from "./pages/PartnerInquiries/ViewPartnerInquiry";
import NewsletterSubscribers from "./pages/Newsletter/NewsletterSubscribers";
import FeatureRequests from "./pages/FeatureRequests/FeatureRequests";
import SearchTerms from "./pages/SearchTerms/SearchTerms";
import HomeSettings from "./pages/HomeSettings/HomeSettings";
import ProfilePages from "./pages/ProfilePages/ProfilePages";
import NewBrandPage from "./pages/ProfilePages/NewBrandPage";
import ImportBrands from "./pages/ProfilePages/ImportBrands";
import EditProfilePage from "./pages/ProfilePages/EditProfilePage";
import ProfilePageAnalytics from "./pages/ProfilePages/ProfilePageAnalytics";
import MagazineIssues from "./pages/Magazine/MagazineIssues";
import IssueForm from "./pages/Magazine/IssueForm";
import WatchSeries from "./pages/Watch/WatchSeries";
import WatchVideos from "./pages/Watch/WatchVideos";
import EditVideo from "./pages/Watch/EditVideo";
import DirectoryApplications from "./pages/DirectoryApplications/DirectoryApplications";
import AddDirectoryListing from "./pages/DirectoryApplications/AddDirectoryListing";
import EditDirectoryListing from "./pages/DirectoryApplications/EditDirectoryListing";
import ViewDirectoryApplication from "./pages/DirectoryApplications/ViewDirectoryApplication";
import AccessPricing from "./pages/AccessPricing/AccessPricing";
import AccessSubscriptions from "./pages/AccessSubscriptions/AccessSubscriptions";
import ListingClaims from "./pages/ListingClaims/ListingClaims";

// Colours come from the tokens in index.css, which index.tsx loads before this module runs.
const theme = antdTheme();
// antd's static message() / notification() calls render outside the app's tree; give them the same theme.
ConfigProvider.config({ holderRender: (children) => <ConfigProvider theme={theme}>{children}</ConfigProvider> });

/** An old address (MOVED_PATHS): on to its new one, keeping the query string and hash. */
const Moved = ({ to }: { to: string }) => {
  const params = useParams();
  const { search, hash } = useLocation();
  return <Navigate replace to={{ pathname: generatePath(to, params), search, hash }} />;
};

// The routes follow the sidebar's groups; every address is in paths.ts.
function App() {
  return (
    <ConfigProvider theme={theme}>
    <Router>
      <Routes>
        <Route path={paths.login} element={<Login />} />
        <Route path={paths.forbidden} element={<Error401 />} />
        <Route path={paths.dashboard} element={<MainLayout />}>
          <Route index element={<Dashboard />} />

          {/* Professionals */}
          <Route path={paths.professionals} element={<Professionals />} />
          <Route path={paths.professional(":id")} element={<ViewProfessionals />} />
          <Route path={paths.profilePages} element={<ProfilePages />} />
          <Route path={paths.newBrandPage} element={<NewBrandPage />} />
          <Route path={paths.importBrands} element={<ImportBrands />} />
          <Route path={paths.profilePage(":userId")} element={<EditProfilePage />} />
          <Route path={paths.profilePageAnalytics(":userId")} element={<ProfilePageAnalytics />} />
          <Route path={paths.subscriptions} element={<AccessSubscriptions />} />
          <Route path={paths.applicantForms} element={<ProfessionalForm />} />
          <Route path={paths.specialities} element={<Specialities />} />
          <Route path={paths.newSpeciality} element={<AddSpecialities />} />
          <Route path={paths.speciality(":id")} element={<EditSpecialities />} />
          <Route path={paths.loginActivity} element={<LoginLogs />} />

          {/* Access cards */}
          <Route path={paths.cards} element={<BusinessCard />} />
          <Route path={paths.newCard} element={<CreateBusinessCard />} />
          <Route path={paths.card(":id")} element={<EditBusinessCard />} />
          <Route path={paths.orders} element={<AccessOrders />} />
          {/* One order, opened over the list. The order email links here (through /access-orders/:id). */}
          <Route path={paths.order(":id")} element={<AccessOrders />} />
          <Route path={paths.pricing} element={<AccessPricing />} />
          <Route path={paths.cardAnalytics} element={<AccessCardAnalytics />} />

          {/* Directory */}
          <Route path={paths.directoryApplications} element={<DirectoryApplications />} />
          <Route path={paths.newDirectoryListing} element={<AddDirectoryListing />} />
          <Route path={paths.directoryApplication(":id")} element={<ViewDirectoryApplication />} />
          <Route path={paths.editDirectoryListing(":id")} element={<EditDirectoryListing />} />
          <Route path={paths.listingClaims} element={<ListingClaims />} />
          <Route path={paths.directorySections} element={<Directroy />} />

          {/* Inquiries */}
          <Route path={paths.partnerInquiries} element={<PartnerInquiries />} />
          <Route path={paths.partnerInquiry(":id")} element={<ViewPartnerInquiry />} />
          <Route path={paths.featureRequests} element={<FeatureRequests />} />
          <Route path={paths.newsletter} element={<NewsletterSubscribers />} />

          {/* Journal */}
          <Route path={paths.articles} element={<Journal />} />
          <Route path={paths.newArticle} element={<AddJournal />} />
          <Route path={paths.article(":id")} element={<EditJournal />} />
          <Route path={paths.journalCategories} element={<JournalCategory />} />
          <Route path={paths.authors} element={<Authors />} />
          <Route path={paths.journalFaqs} element={<JournalFaq />} />

          {/* Topics */}
          <Route path={paths.topics} element={<JournalTopics />} />
          <Route path={paths.newTopic} element={<AddJournalTopic />} />
          <Route path={paths.topic(":id")} element={<TopicScreen />} />
          <Route path={paths.editTopic(":id")} element={<EditJournalTopic />} />

          {/* Shop */}
          <Route path={paths.products} element={<Shop />} />
          <Route path={paths.newProduct} element={<AddShop />} />
          <Route path={paths.product(":id")} element={<EditShop />} />
          <Route path={paths.productTags} element={<ProductTags />} />

          {/* Media */}
          <Route path={paths.magazine} element={<MagazineIssues />} />
          <Route path={paths.newIssue} element={<IssueForm />} />
          <Route path={paths.issue(":id")} element={<IssueForm />} />
          <Route path={paths.videos} element={<WatchVideos />} />
          <Route path={paths.video(":id")} element={<EditVideo />} />
          <Route path={paths.videoSeries} element={<WatchSeries />} />
          <Route path={paths.podcastSchedule} element={<PodcastSchedule />} />
          <Route path={paths.newPodcastScheduleItem} element={<AddPodcastSchedule />} />
          <Route path={paths.podcastScheduleItem(":id")} element={<EditPodcastSchedule />} />

          {/* Discover */}
          <Route path={paths.education} element={<Education />} />
          <Route path={paths.newEducationItem} element={<AddEducation />} />
          <Route path={paths.educationItem(":id")} element={<EditEducation />} />
          <Route path={paths.events} element={<Event />} />
          <Route path={paths.newEvent} element={<AddEvent />} />
          <Route path={paths.event(":id")} element={<EditEvent />} />

          {/* Ads */}
          <Route path={paths.ads} element={<Ads />} />
          <Route path={paths.newAd} element={<AddAd />} />
          <Route path={paths.ad(":id")} element={<ViewAd />} />
          <Route path={paths.editAd(":id")} element={<AddAd />} />

          {/* Website */}
          <Route path={paths.homePage} element={<HomeSettings />} />
          <Route path={paths.searchTerms} element={<SearchTerms />} />

          {/* Admins, and the signed-in admin's account */}
          <Route path={paths.admins} element={<AdminUser />} />
          <Route path={paths.newAdmin} element={<AddAdmin />} />
          <Route path={paths.account} element={<ViewAdmin />} />
          <Route path={paths.changePassword} element={<ChangePassword />} />

          {MOVED_PATHS.map(([from, to]) => (
            <Route key={from} path={from} element={<Moved to={to} />} />
          ))}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Router>
    </ConfigProvider>
  );
}

export default App;
