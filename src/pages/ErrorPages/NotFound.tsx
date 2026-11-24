import { Button, Result } from "antd";
import { CompassOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router";
import { paths } from "../../paths";

/** Any address that is no screen: a mistyped one, or one whose screen was removed. */
const NotFound = () => {
  const navigate = useNavigate();
  return (
    <Result
      icon={<CompassOutlined style={{ color: "var(--color-primary)" }} />}
      title="Page not found"
      subTitle="There is no screen at this address. The sidebar lists every screen."
      extra={
        <Button type="primary" onClick={() => navigate(paths.dashboard)}>
          Go to the dashboard
        </Button>
      }
    />
  );
};

export default NotFound;
