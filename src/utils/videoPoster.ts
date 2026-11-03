// A poster for an MP4 picked in the browser, as the website makes one for an owner's upload (glamlink-web's
// generateVideoThumbnail): a frame about a second in, as a JPEG. The API stores it as the video's thumbnail.

/** The file name of a video's poster: "clip.mp4" gives "clip-poster.jpg". */
export const posterName = (videoName: string) => `${videoName.replace(/\.[^/.]+$/, "") || "video"}-poster.jpg`;

/**
 * A frame of the video (about 1 s in, or its middle when shorter) as a JPEG file. Rejects when the browser can't read
 * the video, or after `ms` (20 s by default).
 */
export const videoPoster = (file: File, ms = 20000): Promise<File> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let timer = 0;
    const done = (error: Error | null, poster?: File) => {
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      video.remove();
      if (error || !poster) reject(error ?? new Error("Couldn't read a frame of this video."));
      else resolve(poster);
    };
    timer = window.setTimeout(() => done(new Error("Reading the video took too long.")), ms);

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    // Safari only seeks a video that is in the document: keep it there, out of sight, while the frame is read.
    Object.assign(video.style, { position: "fixed", top: "-9999px", width: "1px", height: "1px", opacity: "0" });
    document.body.appendChild(video);

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, video.duration / 2 || 0);
    };
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      if (!context || !canvas.width || !canvas.height) {
        done(new Error("Couldn't read a frame of this video."));
        return;
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) =>
          blob
            ? done(null, new File([blob], posterName(file.name), { type: "image/jpeg" }))
            : done(new Error("Couldn't make a poster from this video.")),
        "image/jpeg",
        0.85,
      );
    };
    video.onerror = () => done(new Error("This video can't be read. Try another MP4 file."));
    video.src = url;
  });
