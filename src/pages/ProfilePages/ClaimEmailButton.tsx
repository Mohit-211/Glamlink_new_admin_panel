import React from "react";
import { Button, Modal, Tooltip, message } from "antd";
import { MailOutlined } from "@ant-design/icons";
import { SendPageInvite } from "../../services/Api/ProfilesApi";
import { apiErrorCode, apiErrorMessage } from "../../utils/apiError";

interface ClaimEmailButtonProps {
  userId: number | string;
  /** The account turned out to have a password already (409 ALREADY_CLAIMED): no need for the button. */
  onClaimed: () => void;
  type?: "primary" | "default";
  /** Why it can't be sent now (Nov 24: the account has no email yet): the button is off, and says why on hover. */
  disabledReason?: string;
}

/**
 * "Send claim email": emails the page's account a "Set your password" link (valid 7 days), so the brand or
 * professional behind it can sign in and edit the page. Only for accounts without a password.
 */
const ClaimEmailButton = ({ userId, onClaimed, type = "default", disabledReason }: ClaimEmailButtonProps) => {
  const send = async () => {
    try {
      const { email } = (await SendPageInvite(userId)).data.data;
      message.success(`Claim email sent to ${email}`);
    } catch (err) {
      if (apiErrorCode(err) === "ALREADY_CLAIMED") {
        message.info("This account can already sign in: it has a password, so it needs no claim email.");
        onClaimed();
      } else if (apiErrorCode(err) === "NO_EMAIL") {
        message.warning("The account has no email yet: add the brand's email on the Page tab first.");
      } else {
        message.error(apiErrorMessage(err) || "Couldn't send the claim email");
      }
    }
  };

  const confirm = () =>
    Modal.confirm({
      title: "Send a claim email?",
      content:
        'The account\'s email gets a "Set your password" link, valid for 7 days. Once the password is set, its owner can sign in and edit this page.',
      okText: "Send",
      onOk: send,
    });

  const button = (
    <Button type={type} icon={<MailOutlined />} onClick={confirm} disabled={Boolean(disabledReason)}>
      Send claim email
    </Button>
  );
  // A disabled button gets no hover: the tooltip goes on a wrapper.
  return disabledReason ? (
    <Tooltip title={disabledReason}>
      <span>{button}</span>
    </Tooltip>
  ) : (
    button
  );
};

export default ClaimEmailButton;
