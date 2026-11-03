/** @format */

import React, { useEffect, useState } from "react";
import { Button, Upload } from "antd";
import { PictureOutlined, ScissorOutlined, UploadOutlined } from "@ant-design/icons";
import { useImageCrop, type ImageCropOptions } from "../../components/ImageCropDialog";
import styles from "./JournalImageField.module.scss";

/** A picture in a Journal form; the form uploads `file` when it saves. */
export interface PickedImage {
  /** Where "Crop again" starts: the whole file picked in this session, or the saved picture's link. */
  source: File | string;
  /** The cropped picture to upload; absent while the saved picture is unchanged. */
  file?: File;
}

// Where each kind of picture is shown decides its crop: Journal listings show covers at 16:9,
// and authors are shown in a circle (the website's author avatar, this panel's Authors table).
const KINDS = {
  cover: {
    crop: {
      ratios: ["16:9"],
      initial: "16:9",
      title: "Crop cover image",
      hint: "Journal listings show covers at 16:9, so a 16:9 crop shows exactly what readers see.",
      okText: "Apply crop",
    },
    alt: "Cover preview",
    help: "Recommended ratio 16:9. JPG, PNG or WebP.",
  },
  author: {
    crop: {
      ratios: ["1:1"],
      initial: "1:1",
      title: "Crop author photo",
      hint: "Author photos are shown in a circle, so a square crop with the face in the middle fits best.",
      okText: "Apply crop",
      round: true,
    },
    alt: "Author photo",
    help: "Square works best. JPG, PNG or WebP.",
  },
} satisfies Record<string, { crop: ImageCropOptions; alt: string; help: string }>;

interface JournalImageFieldProps {
  kind: keyof typeof KINDS;
  value: PickedImage | null;
  onChange: (value: PickedImage | null) => void;
}

/**
 * Picks a picture, crops it and shows it, with "Crop again" for the picture shown: one picked in
 * this session is cropped again from the whole file, a saved one from the stored picture.
 */
const JournalImageField = ({ kind, value, onChange }: JournalImageFieldProps) => {
  const { crop, alt, help } = KINDS[kind];
  const [cropImage, cropDialog] = useImageCrop();
  const [fileUrl, setFileUrl] = useState<string>();
  const shownFile = value?.file ?? (value?.source instanceof File ? value.source : undefined);

  useEffect(() => {
    if (!shownFile) return;
    const url = URL.createObjectURL(shownFile);
    setFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [shownFile]);

  const preview = shownFile ? fileUrl : typeof value?.source === "string" ? value.source : undefined;

  const cropFrom = async (source: File | string) => {
    const result = await cropImage(source, crop);
    if (result) onChange({ source, file: result.file });
  };

  return (
    <div className={styles.field}>
      <div className={`${styles.preview} ${kind === "author" ? styles.round : ""}`}>
        {preview ? (
          <img src={preview} alt={alt} />
        ) : (
          <div className={styles.empty}>
            <PictureOutlined style={{ fontSize: 22 }} />
            <span>No image selected</span>
          </div>
        )}
      </div>

      <div className={styles.actions}>
        <Upload
          accept=".jpg,.jpeg,.png,.webp"
          showUploadList={false}
          beforeUpload={(file) => {
            void cropFrom(file);
            return Upload.LIST_IGNORE;
          }}
        >
          <Button icon={<UploadOutlined />}>{value ? "Replace image" : "Upload image"}</Button>
        </Upload>
        {value && (
          <Button icon={<ScissorOutlined />} onClick={() => cropFrom(value.source)}>
            Crop again
          </Button>
        )}
        {value && (
          <Button danger type="text" onClick={() => onChange(null)}>
            Remove image
          </Button>
        )}
        <span className={styles.help}>{help}</span>
      </div>

      {cropDialog}
    </div>
  );
};

export default JournalImageField;
