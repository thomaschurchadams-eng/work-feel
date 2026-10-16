# Local video production and review

This engineering helper serves the existing media coordinator. It creates local review files only. It does not publish, consume speech credits, call a provider, write the manifest/social queue, change schedules or add a publisher. The existing coordinator policy and native-video handoff continue to govern release. Engineering changes require parent release confirmation before merge/deployment.

## One owner through production

The media coordinator owns source qualification, approved script, budget verification when speech is needed, assembly, caption preparation, technical checks, final review and handoff. The existing daily publisher owns selection and the same immutable shared reservation. The trusted verified-operations workflow remains the sole social executor. Production and actual provider playback are verified separately. A missing capability remains with the coordinator as a named exception; do not silently turn it into a Tom timestamp assignment or another manager.

Approved-audio reuse avoids generation but still requires genuine listening and final playback. Imported word timestamps from an already authorized aligner can automate caption timing; timing/provenance checks cannot establish pronunciation, perceptual audio quality or splice acceptance. This helper does not call an alignment service. Existing audio must be hash-bound to the exact approved transcript and imported timestamp evidence. Provisional SRT/graphic intervals cannot establish speech cutpoints. Do not splice the October 8 correction from 13.1–19.4 alone.

A useful, approved caption-led silent adaptation is a distinct production mode. Its display schedule is checked against the approved text and readability limits, and its finished file must contain **zero audio tracks**. Genuine continuous visual/caption playback and all source/rights/release checks still apply. Label it accurately; it cannot complete or automatically replace a promised narrated asset, held October 8 target, or missed social slot.

## Explicit local run

`node scripts/produce-video.cjs /path/to/job.json /separate/output-directory [finished-review.json]`

Requires existing macOS Swift/AVFoundation. No install, model download or new permission is performed. Source may be an existing 720×1280 MP4 or PNG/JPEG still. Output is 720×1280 H.264, 24 fps, fast-start MP4. Narrated mode reuses an existing audio file; silent mode drops all source audio. The renderer replaces the lower 370-pixel caption band, so source graphics/attribution must sit above it. It rejects clipped caption text. This conservative template is not a general-purpose editor or a cloud rendering service.

Job fields: `schemaVersion:1`, immutable `id`, `mode` (`narrated` or `caption-led-silent`), `source` and `transcript` (`file`, SHA256), measured `durationSeconds` (3–180), HTTPS `sources`, `rightsNote`. The transcript file contains only the approved spoken/displayed text. Silent jobs provide `captions:[{start,end,text}]` and no audio/alignment. Narrated jobs provide hash-bound `audio` and `alignment` files; alignment JSON records `audioSha256`, `transcriptSha256` of the trimmed UTF-8 text, `method`, evidence and `words:[{start,end,text}]`. Accepted method labels describe provenance, not independent certification. The coordinator must verify the actual source receipt before importing it. No boolean can make an unverified provider response trustworthy.

The helper rejects changed input bytes, missing/mismatched alignment, nonmatching words, overlaps, gaps/coverage errors, excessive reading speed, codec/container/dimension/duration/rate violations and failed complete decodes. Layout checks cover every rendered cue. PCM peak/RMS/full-scale checks are signal measurements, not LUFS, true-peak or actual listening.

It writes `review.mp4`, `review.html`, approved text, caption JSON, a measured probe and `production-state.json`. Inputs and outputs must be separate. The fingerprint binds source/text/audio/timings plus renderer, pipeline and validation code. Identical finished bytes resume without rendering; a changed job requires a new directory. Interrupted render state can be retried for that same fingerprint. A stale final-review receipt cannot clear a changed cut. Failure persists its bounded reason. No credentials or raw analytics are included.

Final review evidence must name the actual reviewer/capable route, dated evidence, exact finished SHA and input fingerprint, continuous playback and captions/visual acceptance. Narrated review additionally requires actual listening, pronunciation and audio-balance acceptance. Record only actions genuinely performed. A matching receipt advances only to `reviewed-awaiting-normal-release-gates`: `nativeVideo:null`, `productionVerified:false` and `published:false` remain. Permanent public URL/full deployed hash/source/rights/accessibility checks, exact deployment identity, release authorization and publisher selection are separate existing gates. Never use a local technical receipt as a public keyword dump, publication receipt or provider post ID.

## Current capability exception, checked October 12

This execution route cannot accept audio input. No connected alignment/hearing tool or installed local Whisper/faster-whisper model was found. Apple Speech authorization status was read without requesting access: `0` (not determined). Invoking recognition would require permission and is outside this task. ElevenLabs documents forced alignment, but there is no authorized callable route/account entitlement verified here; no key retrieval, API call, purchase or credit debit occurred. An aligner is also not an audio-quality reviewer.

The coordinator can render and technically inspect a distinct silent review candidate now. The held narrated October 8 cut still requires a permitted hearing-capable route and hash-bound speech alignment before its existing 103-credit correction can safely replace the old date sentence. Preserve original/correction bytes. Do not ask Tom to calculate timestamps by default. Escalate this capability exception to the parent with the complete candidate and evidence; do not promise unattended narrated acceptance or October 15 delivery.

References: [Apple speech authorization](https://developer.apple.com/documentation/speech/asking-permission-to-use-speech-recognition), [ElevenLabs forced alignment](https://elevenlabs.io/docs/api-reference/forced-alignment/create).

## Professional and social craft review, every finished cut

Use the existing production-craft review, with no extra schedule. Preserve the September 28 **Membership growth hides a divide** video and its publication history; an incomplete October short does not erase it. Compare a genuinely viewed finished cut to the previous actual cut, identify its exact hashes/URLs, and record one meaningful improvement for the next cycle. Keep craft evidence separate from seven-day engagement evidence. The reference set is small: select 2–3 publicly playable professional news/explainer examples, including a short mobile example. Record actual source URLs, viewing dates/ranges and sound access. Publisher channels such as [Reuters](https://www.reuters.com/video/) and [BBC](https://www.bbc.com/video) are discovery starting points, not claimed viewed clips. Unknown/unavailable viewing cannot earn a score or an imitation claim. Do not copy footage/branding or buy access.

Use a repeatable 1–4 rubric (1 unclear/needs repair, 2 usable, 3 strong, 4 professional benchmark), with **unknown** for an unobserved dimension:

| Dimension | Evidence to record |
| --- | --- |
| Editorial clarity and opening | Evidence-backed CU decision in the first seconds; fact/scenario/vendor claim distinguished; one useful or surprising takeaway. |
| Narration and pronunciation | Actual complete listening; names/numbers/date correct; natural emphasis; no splice artifacts. Silent: not applicable, never “passed listening.” |
| Pacing | Actual playback ranges for reading/speaking/graphic transitions; avoid rushed cues and static repetition. |
| Visual hierarchy | One primary point per scene; consistent typography; 390-pixel mobile readability and safe areas. |
| Source attribution | On-screen source context and exact dated canonical transcript/source links; qualifiers preserved. |
| Captions/accessibility | Exact approved words, readable sound-off, genuine visual sync/full-playback verification; no clipping. |
| Audio balance | Actual listening plus measured decode/peak evidence; voice intelligible, music absent or properly balanced/rights-cleared. Silent: not applicable. |
| Finished playback | Continuous complete cut viewed, actual audio scope stated, original/final hashes bound, defects recorded. |
| Reason to share | A specific CU professional could send it to a colleague to clarify a decision; no sensational framing or virality promise. |

Save dated observations and comparisons in that asset's existing craft receipt. Record `previousAsset`, `referencesViewed`, dimension scores/evidence/unknowns, `oneNextImprovement` and rationale. A proposed improvement is not a measured result. For the current silent adaptation, the proposed improvement is readable sound-off coverage of the complete approved text with a fixed historical date; confirm it through playback before claiming success.

At the existing seven-day review, record actual shares/retention only where the provider exposes them, matching post ID, verified company channel, fixed schedule/actual publication time, canonical/UTM path and comparable age. Include counts, denominators and missing data. Missing retention or shares is unknown, not zero. Do not infer breakout reach, causality or expanded distribution from a small sample. No engagement manufacture, volume increase, new permissions or extra experiment.
