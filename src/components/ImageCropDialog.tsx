/** @format */

import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactCrop, { type PercentCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Alert, Button, InputNumber, Modal, Radio, Spin, Tooltip, message } from "antd";
import { RotateLeftOutlined, RotateRightOutlined } from "@ant-design/icons";
import {
  MAX_EDGE,
  WHOLE,
  cropPixels,
  cropToBlob,
  fetchImage,
  fileName,
  largestCrop,
  outputSize,
  outputType,
  parseRatio,
  turnedSize,
  type Ratio,
  type Rotation,
  type Size,
} from "./ImageCropDialog.crop";
import "./ImageCropDialog.scss";

export type { Ratio } from "./ImageCropDialog.crop";

/** Original (the picture's own ratio), a fixed ratio, Free (any rectangle) or Custom (typed W:H). */
export type CropChoice = "original" | Ratio | "free" | "custom";

export interface ImageCropOptions {
  /** Fixed ratios offered between Original and Free, e.g. ["16:9", "1:1"]. */
  ratios?: Ratio[];
  /** The choice selected when the dialog opens. Default "original". */
  initial?: CropChoice;
  /** Offers "Use as is", which returns the picture untouched. */
  allowSkip?: boolean;
  /** One of several pictures in a row: the title counts them, and "Use as is for the rest" is offered with `allowSkip`. */
  progress?: { index: number; total: number };
  title?: string;
  /** A line above the picture, e.g. where it is shown. */
  hint?: React.ReactNode;
  /** Shows the crop as a circle, for pictures shown round. The file stays rectangular. */
  round?: boolean;
  okText?: string;
}

export interface ImageCropResult {
  /** The cropped picture, or the original after "Use as is". */
  file: File;
  /** The cropped picture's size in px; absent after "Use as is". */
  size?: Size;
  /** "Use as is" was chosen. */
  asIs?: boolean;
  /** "Use as is for the rest" was chosen: the remaining pictures go in as they are too. */
  rest?: boolean;
}

export interface ImageCropDialogProps extends ImageCropOptions {
  /** A picked file, or the link of a picture already uploaded. Mount with a new `key` for each picture. */
  source: File | string;
  onDone: (result: ImageCropResult) => void;
  onCancel: () => void;
}

// The turned picture on screen is a copy at most this big; the crop itself is cut from the source.
const PREVIEW_EDGE = 1600;

const aspectOf = (choice: CropChoice, turned: Size, custom: (number | null)[]) => {
  if (choice === "original") return turned.width / turned.height;
  if (choice === "free") return undefined;
  if (choice === "custom") return custom[0] && custom[1] ? custom[0] / custom[1] : undefined;
  return parseRatio(choice);
};

/**
 * Crops one picture before it is used: preset ratios chosen by the caller, Original, Free (drag
 * any rectangle; the selection and its handles also move with the arrow keys), Custom W:H, and
 * turning by 90°. The result is cut from the full-size picture, so it keeps the source's
 * resolution (the longest side capped at 4000 px); PNG and WebP stay, anything else becomes JPEG.
 * Most callers use `useImageCrop` instead of mounting it.
 */
const ImageCropDialog = ({
  source,
  ratios = [],
  initial = "original",
  allowSkip = false,
  progress,
  title = "Crop picture",
  hint,
  round = false,
  okText = "Crop",
  onDone,
  onCancel,
}: ImageCropDialogProps) => {
  const [loaded, setLoaded] = useState<{ file: File; url: string } | null>(null);
  const [natural, setNatural] = useState<Size | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [choice, setChoice] = useState<CropChoice>(initial);
  const [custom, setCustom] = useState<(number | null)[]>([3, 2]);
  const [crop, setCrop] = useState<PercentCrop>();
  const [preview, setPreview] = useState<string | null>(null); // the turned copy shown while rotation is not 0
  const [busy, setBusy] = useState(false);
  // The full-size picture, decoded. It stays usable after its <img> leaves the page.
  const image = useRef<HTMLImageElement | null>(null);

  // A picked file is shown from an object URL; an uploaded picture is downloaded first (see fetchImage).
  useEffect(() => {
    let url: string | null = null;
    let stale = false;
    const controller = new AbortController();
    const show = (file: File) => {
      if (stale) return;
      url = URL.createObjectURL(file);
      setLoaded({ file, url });
    };
    if (typeof source === "string") {
      fetchImage(source, controller.signal).then(show, (err) => {
        if (stale) return;
        console.error("Couldn't load the picture to crop:", err);
        setError("Couldn't load this picture for cropping. Check the connection and try again; if it keeps failing, upload the picture again instead.");
      });
    } else show(source);
    return () => {
      stale = true;
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [source]);

  // Turned: show a copy drawn turned, so the crop box frames the picture as it will be saved.
  useEffect(() => {
    setPreview(null);
    if (!rotation || !natural || !image.current || !loaded) return;
    let url: string | null = null;
    let stale = false;
    cropToBlob(image.current, natural, WHOLE, rotation, { type: outputType(loaded.file.type), maxEdge: PREVIEW_EDGE })
      .then(({ blob }) => {
        if (stale) return;
        url = URL.createObjectURL(blob);
        setPreview(url);
      })
      .catch((err) => {
        console.error("Couldn't turn the picture:", err);
        if (!stale) setError("Couldn't turn this picture.");
      });
    return () => {
      stale = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [rotation, natural, loaded]);

  const turned = natural ? turnedSize(natural, rotation) : null;
  const aspect = turned ? aspectOf(choice, turned, custom) : undefined;
  // Every change of shape starts again from the largest crop of that shape.
  const restart = (next: { choice?: CropChoice; rotation?: Rotation; custom?: (number | null)[] }) => {
    const c = next.choice ?? choice;
    const r = next.rotation ?? rotation;
    const cu = next.custom ?? custom;
    setChoice(c);
    setRotation(r);
    setCustom(cu);
    if (natural) {
      const size = turnedSize(natural, r);
      setCrop(largestCrop(aspectOf(c, size, cu), size));
    }
  };
  const turn = (by: 90 | -90) => restart({ rotation: ((((rotation + by) % 360) + 360) % 360) as Rotation });
  const setCustomSide = (side: 0 | 1, value: number | null) => {
    const next = [...custom];
    next[side] = value && value > 0 ? value : null;
    restart({ custom: next });
  };

  const onSourceLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    image.current = img;
    if (natural) return; // shown again after turning back
    if (!img.naturalWidth || !img.naturalHeight) {
      setError("This picture can't be shown in the browser, so it can't be cropped.");
      return;
    }
    const size = { width: img.naturalWidth, height: img.naturalHeight };
    setNatural(size);
    setCrop(largestCrop(aspectOf(choice, size, custom), size));
  };

  const full = turned && crop ? cropPixels(crop, turned) : null;
  const out = full ? outputSize(full) : null;
  const ready = Boolean(loaded && natural && full && crop && crop.width > 0 && crop.height > 0 && !error);

  const apply = async () => {
    if (!ready || !loaded || !natural || !crop || !full || !image.current) return;
    // The whole picture, unturned and within the size cap, is used as it is: no re-encoding.
    if (!rotation && full.width === natural.width && full.height === natural.height && Math.max(full.width, full.height) <= MAX_EDGE) {
      onDone({ file: loaded.file, size: natural });
      return;
    }
    setBusy(true);
    try {
      const want = outputType(loaded.file.type);
      const { blob, size } = await cropToBlob(image.current, natural, crop, rotation, { type: want });
      // A browser that can't write WebP hands back PNG; name the file after what it got.
      const type = blob.type || want;
      onDone({ file: new File([blob], fileName(loaded.file.name, type), { type }), size });
    } catch (err) {
      console.error("Crop failed:", err);
      message.error("Couldn't crop this picture");
      setBusy(false);
    }
  };
  const keepAsIs = (rest: boolean) => {
    const file = loaded?.file ?? (typeof source === "string" ? null : source);
    if (file) onDone({ file, asIs: true, rest: rest || undefined });
  };

  const shown = rotation ? preview : loaded?.url;
  const showRest = allowSkip && progress && progress.index < progress.total - 1;
  const choices = [
    { label: "Original", value: "original" },
    ...ratios.map((r) => ({ label: r, value: r })),
    { label: "Free", value: "free" },
    { label: "Custom", value: "custom" },
  ];

  return (
    <Modal
      open
      title={progress && progress.total > 1 ? `${title} (${progress.index + 1} of ${progress.total})` : title}
      width={760}
      onCancel={onCancel}
      maskClosable={false}
      footer={[
        <Button key="cancel" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>,
        showRest && (
          <Button key="rest" onClick={() => keepAsIs(true)} disabled={busy || (!loaded && typeof source === "string")}>
            Use as is for the rest
          </Button>
        ),
        allowSkip && (
          <Button key="as-is" onClick={() => keepAsIs(false)} disabled={busy || (!loaded && typeof source === "string")}>
            Use as is
          </Button>
        ),
        <Button key="ok" type="primary" onClick={apply} loading={busy} disabled={!ready}>
          {okText}
        </Button>,
      ]}
    >
      <div className="image-crop">
        {hint && <div className="image-crop__hint">{hint}</div>}
        <div className="image-crop__tools">
          <Radio.Group
            aria-label="Crop shape"
            optionType="button"
            buttonStyle="solid"
            size="small"
            value={choice}
            options={choices}
            onChange={(e) => restart({ choice: e.target.value })}
            disabled={!natural || busy}
          />
          {choice === "custom" && (
            <span className="image-crop__custom">
              <InputNumber aria-label="Width" size="small" min={0.1} max={10000} value={custom[0]} onChange={(v) => setCustomSide(0, v)} style={{ width: 72 }} />
              :
              <InputNumber aria-label="Height" size="small" min={0.1} max={10000} value={custom[1]} onChange={(v) => setCustomSide(1, v)} style={{ width: 72 }} />
            </span>
          )}
          <span className="image-crop__turn">
            <Tooltip title="Rotate left">
              <Button size="small" aria-label="Rotate left" icon={<RotateLeftOutlined />} onClick={() => turn(-90)} disabled={!natural || busy} />
            </Tooltip>
            <Tooltip title="Rotate right">
              <Button size="small" aria-label="Rotate right" icon={<RotateRightOutlined />} onClick={() => turn(90)} disabled={!natural || busy} />
            </Tooltip>
          </span>
        </div>

        <div className="image-crop__stage">
          {error ? (
            <Alert type="error" showIcon title={error} />
          ) : shown ? (
            <ReactCrop
              crop={crop}
              aspect={aspect}
              onChange={(_, percent) => setCrop(percent)}
              keepSelection
              ruleOfThirds
              circularCrop={round}
              minWidth={16}
              minHeight={16}
              disabled={busy}
            >
              <img
                key={shown}
                src={shown}
                alt={loaded ? `Cropping ${loaded.file.name}` : ""}
                onLoad={rotation ? undefined : onSourceLoad}
                onError={() => setError("This picture can't be shown in the browser, so it can't be cropped.")}
              />
            </ReactCrop>
          ) : (
            <Spin />
          )}
        </div>

        <div className="image-crop__size" aria-live="polite">
          {out && full
            ? `Result: ${out.width} × ${out.height} px` +
              (out.width < full.width ? ` (scaled down from ${full.width} × ${full.height})` : "")
            : " "}
        </div>
      </div>
    </Modal>
  );
};

export default ImageCropDialog;

interface CropRequest {
  id: number;
  source: File | string;
  options: ImageCropOptions;
  resolve: (result: ImageCropResult | null) => void;
}

let requestId = 0;

/**
 * `const [cropImage, cropDialog] = useImageCrop()`: render `cropDialog`, then
 * `await cropImage(fileOrUrl, options)` resolves with the result, or null on Cancel.
 */
export const useImageCrop = () => {
  const [request, setRequest] = useState<CropRequest | null>(null);
  const pending = useRef<CropRequest | null>(null);
  // Unmounted while open: settle the caller's await as a cancel.
  useEffect(() => () => pending.current?.resolve(null), []);

  const cropImage = useCallback(
    (source: File | string, options: ImageCropOptions = {}) =>
      new Promise<ImageCropResult | null>((resolve) => {
        pending.current?.resolve(null); // one dialog at a time
        pending.current = { id: ++requestId, source, options, resolve };
        setRequest(pending.current);
      }),
    [],
  );
  const finish = (result: ImageCropResult | null) => {
    pending.current?.resolve(result);
    pending.current = null;
    setRequest(null);
  };

  const dialog = request ? (
    <ImageCropDialog
      key={request.id}
      source={request.source}
      {...request.options}
      onDone={finish}
      onCancel={() => finish(null)}
    />
  ) : null;
  return [cropImage, dialog] as const;
};
