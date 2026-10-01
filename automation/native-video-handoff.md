# Native LinkedIn video handoff

The existing company channel, shared social queue and trusted verified-operations workflow remain the only distribution path. Four monthly short-video production targets compete with High news and other eligible media within one weekday post and five weekly posts. October 8/15/22/29 are production dates, not confirmed posts; podcasts on October 15/29 do not add a second slot. Parent-publication deduplication, immutable reservations, preparation lead time, production identity, approved UTMs and the inactive timing experiment remain mandatory. Never use a personal LinkedIn profile.

A narration-only audio file is not a video. October 8 still needs full composition, source/rights review, burned-in captions, canonical transcript and an exact production-verified file. Do not mark any planned asset ready or enqueue an asset merely because infrastructure supports video. No video has been created, rendered, uploaded or posted by this change.

## Finished asset and immutable queue fields

Keep all existing manifest fields and preparation/source/rights/accessibility/production gates. A native asset adds `distributionMode: "native-video"`, `transcriptUrl` equal to its `canonicalUrl`, and a `nativeVideo` object with these fields:

| Field | Required value or evidence |
| --- | --- |
| `url` | Permanent direct HTTPS file on `creditunionainews.com`, at `/assets/<name>-<first12sha256>.mp4`; no credentials, port, query, fragment, redirect, signed expiration or new host. |
| `sha256` | SHA256 of the finished local file, 64 lowercase hex characters. Verify the complete deployed file against this hash during normal media production verification. |
| `mimeType`, `videoCodec` | `video/mp4`, `h264`. Refuse MOV, AVI, M4V, HEVC and audio-only containers in this conservative implementation. |
| `bytes`, `durationSeconds` | Measured integer 75,000–1,000,000,000 bytes and 3–1,800 seconds. |
| `width`, `height` | Measured integers, at least 256 wide/144 high, largest dimension at most 1280 and smallest at most 720; aspect ratio 9:16–16:9. |
| `frameRate` | Measured 10–60 fps; average whole-file bitrate below 25 Mbps. |
| `hasVideoTrack`, `probeVerified` | `true` only after a real local probe confirms an H.264 video track and the recorded dimensions, duration, fps and byte count. A renamed M4A or an arbitrary boolean declaration is not evidence. |
| `burnedInCaptionsVerified` | `true` only after captions are checked against the finished visuals, narration and transcript. |

Use fast-start MP4 with complete `moov` metadata in the first 1 MiB. Preserve the preview image and alt text for the website/legacy manifest gate; it is not sent as a custom LinkedIn thumbnail. Buffer does not document LinkedIn custom thumbnail or SRT support here. Captions must be in the finished video and the canonical transcript must be publicly accessible.

For the same reserved queue item, retain the linkedin-prefixed ID, approved copy, articleUrl/distributionUrl and exact UTMs, scheduledFor, imageUrl/imageAlt, contentKind:media, mediaAssetId, mediaFormat:short-video and parentPublicationId. Add `mediaType: "video"`, `videoUrl` and `videoSha256` exactly matching the manifest. The publisher promotes that same planned item only after production verification. Missing nativeVideo leaves a planned native asset ineligible; a native package cannot be promoted or submitted as an image. No separate queue or extra reservation.

## Validation and receipts

The existing authenticated scheduler checks manifest/queue identity, HEAD MIME/byte count, redirect refusal, and a bounded 1 MiB public range. It inspects MP4 metadata for an actual H.264 video track and compares its duration/dimensions. The runtime does not download/hash the whole file or measure fps/captions; those require the finished-file production review above. Incomplete provider inventory is held before any createPost mutation.

The mutation uses only `assets: [{video: {url}}]` on the already verified company channel. There is one mutation attempt; no upload API, custom thumbnailUrl, thumbnailOffset, SRT field, new channel, credential or scope. Existing image payload behavior stays unchanged.

A successful scheduling receipt requires a real post ID, scheduled/sending/sent status and exactly one returned video/mp4 asset. Scheduling acceptance does not prove successful LinkedIn publication. Preserve the provider status separately; `pending-media` is an internal hold state, not a documented Buffer enum. A different returned due time is a blocked receipt-mismatch. Pending attachment, provider rejection/error, missing ID, transport loss, malformed response or server failure after submission becomes a blocked reconciliation receipt. Preserve any real post ID; never fabricate one or blindly retry. The shared reservation remains occupied, protecting caps and the parent publication. A queue identity race aborts the write and requires review of the saved operation receipt before another attempt.

Known IDs can reconcile to sent only through the existing metrics path with exact ID, canonical/UTM URLs, fixed scheduled time, company channel, sentAt, externalLink and a verified video asset. A sent image receipt cannot reconcile a video. Unknown-ID/error/processing holds require a read-only provider inspection and explicit correction of that same reservation after its outcome is known; never automatically requeue. The sent-only metrics path does not poll scheduled media processing.

## Remaining live validation

The existing account credential successfully read the company channel in trusted operations run 36931192827 on base 3843bae2c518306ecd05a96af7cd61d5317c3309. Official Buffer documentation uses the same API key and createPost mutation for video; no new app/key/scope is requested. An authenticated read is not proof that a particular video will process or publish.

After infrastructure approval and a genuine finished asset: verify the full deployed file hash/metadata/captions/transcript and public headers, recheck current main/queue/caps/channel and the normal authorization gates, then let the sole executor submit the selected scheduled item once. Inspect the actual Buffer receipt and, after its fixed due time, verify the native playable video on the company LinkedIn page and the exact sent receipt. Do not manufacture a test asset/post or promise October delivery. Stop the affected part if the provider actually requires a new persistent permission or account configuration.

Official references: [video mutation](https://developers.buffer.com/examples/create-video-post.html), [permanent media hosting](https://developers.buffer.com/guides/hosting-media.html), [LinkedIn limits and thumbnail restrictions](https://support.buffer.com/en-us/articles/using-linkedin-with-buffer-K7tRkGD3mH), [H.264/bitrate guidance](https://support.buffer.com/articles/sharing-videos-through-buffer-LOe2p2rnAI), [provider post statuses](https://developers.buffer.com/types/PostStatus.html).
