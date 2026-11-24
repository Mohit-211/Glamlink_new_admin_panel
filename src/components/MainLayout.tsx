/** @format */

import React, { useState, useEffect } from "react";
import {
  LockOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Outlet, useLocation, useNavigate } from "react-router";
import { Layout, theme, Menu, Dropdown, Flex, type MenuProps } from "antd";
import { message } from "antd";
import Login from "../pages/Login/Login";
import {
  AdminLogout,
  GetAdminProfile,
  GetPendingFormCount,
} from "../services/Api/Api";
import { GetPendingDirectoryApplicationCount } from "../services/Api/DirectoryApplicationsApi";
import { GetPendingClaimCount } from "../services/Api/ListingClaimsApi";
import logo from "../assets/glamlink-logo-black.png";
import { Badge } from "antd";
import "./MainLayout.scss";
import { clearSession, useSessionToken } from "../utils/session";
import { onRecountBadges } from "../utils/badges";
import type { Admin } from "../types/admin";
import { paths } from "../paths";
import { isGroup, screenFor, SIDEBAR, type PendingCounts, type SidebarEntry } from "./sidebarMenu";
const { Header, Sider, Content } = Layout;

type MenuItem = Required<MenuProps>["items"][number];

// A fragment, not a span: antd wraps a label in its title class (the sidebar's font size) unless it is a span already.
const withBadge = (label: string, count: number) => (
  <>
    {label}{" "}
    {count > 0 && <Badge count={count} size="small" style={{ marginLeft: "10px" }} />}
  </>
);

const waitingAt = (entry: SidebarEntry, counts: PendingCounts) => (entry.badge ? counts[entry.badge] : 0);

/**
 * The sidebar's menu (its screens and groups are in sidebarMenu.tsx). Screens are keyed by their address. A closed
 * group shows the work waiting inside it, so a badge is never out of sight.
 */
const menuItems = (counts: PendingCounts, openKeys: string[]): MenuItem[] =>
  SIDEBAR.map((item) => {
    if (!isGroup(item)) return { key: item.path, icon: item.icon, label: withBadge(item.label, waitingAt(item, counts)) };
    const waiting = openKeys.includes(item.key) ? 0 : item.entries.reduce((n, entry) => n + waitingAt(entry, counts), 0);
    return {
      key: item.key,
      icon: item.icon,
      label: withBadge(item.label, waiting),
      children: item.entries.map((entry) => ({
        key: entry.path,
        icon: entry.icon,
        label: withBadge(entry.label, waitingAt(entry, counts)),
      })),
    };
  });

const MainLayout = () => {
  // Re-renders when the session starts or ends (here or in another tab).
  const token = useSessionToken();
  const [idData, setIdData] = React.useState<Partial<Admin>>({});
  const [counts, setCounts] = useState<PendingCounts>({ applicants: 0, applications: 0, claims: 0 });
  // Bumped when a screen asks for a recount without leaving the page (utils/badges).
  const [recounts, setRecounts] = useState(0);
  const { pathname } = useLocation();
  const getData = async (adminToken: string) => {
    try {
      const result = await GetAdminProfile();
      setIdData(result.data.data);
    } catch (e) {
      // An expired session is handled for every request in utils/session.ts.
      console.error("Error loading the admin profile:", e);
    }
  };

  // The profile and counts load once signed in, and again after signing in here.
  useEffect(() => {
    if (token) getData(token);
  }, [token]);

  useEffect(() => onRecountBadges(() => setRecounts((n) => n + 1)), []);

  // The badges are counted on sign-in, again on each change of page and when a screen asks, so a review shows in them
  // at once.
  useEffect(() => {
    if (!token) return;
    let current = true;
    const count = (key: keyof PendingCounts, load: () => Promise<number>) =>
      load()
        .then((n) => {
          // A count the API didn't answer as a number shows no badge (a group adds its entries' counts).
          if (current) setCounts((c) => ({ ...c, [key]: Number.isFinite(n) ? n : 0 }));
        })
        .catch((err) => console.error(`Failed to fetch the ${key} count:`, err));
    count("applicants", async () => Number.parseInt(String((await GetPendingFormCount()).data.data), 10));
    count("applications", GetPendingDirectoryApplicationCount);
    count("claims", GetPendingClaimCount);
    return () => {
      current = false;
    };
  }, [token, pathname, recounts]);

  const [collapsed, setCollapsed] = useState(false);
  const {
    token: { colorBgContainer },
  } = theme.useToken();
  const navigate = useNavigate();

  const current = screenFor(pathname);
  // One group is open at a time: the current page's, until another is opened.
  const [openKeys, setOpenKeys] = useState<string[]>(() => (current?.group ? [current.group] : []));
  useEffect(() => {
    if (current?.group) setOpenKeys([current.group]);
  }, [current?.group]);
  const onOpenChange = (keys: string[]) => {
    const opened = keys.find((key) => !openKeys.includes(key));
    setOpenKeys(opened ? [opened] : keys);
  };
  const items = menuItems(counts, openKeys);

  async function logout() {
    // Sign out on the server first (it ends every session of this admin), then here.
    await AdminLogout().catch(() => {});
    clearSession();
    message.success("Logged Out Successfully");
    navigate(paths.login);
  }

  return (
    <>
      {token ? (
        <Layout>
          <Sider
            trigger={null}
            collapsible
            collapsed={collapsed}
            className="sidebar"
          >
            <div className="logo ">
              {collapsed ? (
                <img src={logo} className="logo-image-1" alt="logo" />
              ) : (
                <img src={logo} className="logo-image" alt="logo" />
              )}
            </div>

            <Menu
              theme="dark"
              mode="inline"
              selectedKeys={current ? [current.path] : []}
              openKeys={collapsed ? undefined : openKeys}
              onOpenChange={onOpenChange}
              onClick={({ key }) => navigate(key)}
              items={items}
            />
          </Sider>
          <Layout className="site-layout">
            <Header
              style={{
                padding: "0 48px 0 4px",
                background: colorBgContainer,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              {React.createElement(
                collapsed ? MenuUnfoldOutlined : MenuFoldOutlined,
                {
                  className: "trigger",
                  onClick: () => setCollapsed(!collapsed),
                },
              )}
              <Flex gap={24} align="center">
                <div className="vertical-line"></div>
                <Dropdown
                  trigger={["click"]}
                  menu={{
                    // The signed-in admin's own account. Other people's sign-ins are under Professionals.
                    items: [
                      {
                        key: paths.account,
                        icon: <UserOutlined />,
                        label: "View Profile",
                      },
                      {
                        key: paths.changePassword,
                        icon: <LockOutlined />,
                        label: "Change Password",
                      },
                      { type: "divider" },
                      {
                        key: "logout",
                        icon: <LogoutOutlined />,
                        label: "Sign Out",
                      },
                    ],
                    onClick: ({ key }) =>
                      key === "logout" ? logout() : navigate(key),
                  }}
                >
                  <Flex
                    align="center"
                    gap={8}
                    role="button"
                    style={{ cursor: "pointer", lineHeight: "20px" }}
                  >
                    <UserOutlined style={{ fontSize: 24 }} />
                    <Flex vertical>
                      <span style={{ fontWeight: 700 }}>{idData?.name}</span>
                      <span>{idData?.admin_role?.name || ""}</span>
                    </Flex>
                  </Flex>
                </Dropdown>
              </Flex>
            </Header>
            <Content
              style={{
                margin: "24px 16px",
                padding: 24,
                minHeight: 280,
                background: colorBgContainer,
              }}
            >
              <Outlet />
            </Content>
          </Layout>
        </Layout>
      ) : (
        <Login />
      )}
    </>
  );
};
export default MainLayout;
