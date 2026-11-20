// Native macOS renderer/probe. Existing local assets only; no speech or network calls.
import Foundation
import AVFoundation
import CoreMedia
import CoreVideo
import CoreText
import ImageIO

enum ProductionError: Error { case invalid(String) }
func require(_ condition: Bool, _ reason: String) throws { if !condition { throw ProductionError.invalid(reason) } }
func ready(_ input: AVAssetWriterInput, _ writer: AVAssetWriter) throws {
    let start = Date()
    while !input.isReadyForMoreMediaData {
        try require(writer.status != .failed && Date().timeIntervalSince(start) < 30, "writer_stalled")
        Thread.sleep(forTimeInterval: 0.002)
    }
}
struct Cue: Decodable { let start: Double; let end: Double; let text: String }
struct Job: Decodable { let mode: String; let source: String; let audio: String?; let durationSeconds: Double; let captions: [Cue] }
let job = try JSONDecoder().decode(Job.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
let output = URL(fileURLWithPath: CommandLine.arguments[2])
try require(!FileManager.default.fileExists(atPath: output.path + ".partial.mp4"), "partial_render_exists")
let partial = URL(fileURLWithPath: output.path + ".partial.mp4")
let width = 720, height = 1280, fps: Int32 = 24
let still = ["png", "jpg", "jpeg"].contains(URL(fileURLWithPath: job.source).pathExtension.lowercased())
let asset = AVURLAsset(url: URL(fileURLWithPath: job.source))
let generator: AVAssetImageGenerator? = still ? nil : AVAssetImageGenerator(asset: asset)
generator?.appliesPreferredTrackTransform = true
generator?.requestedTimeToleranceBefore = .zero
generator?.requestedTimeToleranceAfter = .zero
var stillImage: CGImage? = nil
if still {
    guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: job.source) as CFURL, nil), let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { throw ProductionError.invalid("image_decode_failed") }
    stillImage = image
} else { try require(abs(CMTimeGetSeconds(asset.duration) - job.durationSeconds) <= 0.1, "visual_duration_mismatch") }
let writer = try AVAssetWriter(outputURL: partial, fileType: .mp4)
writer.shouldOptimizeForNetworkUse = true
let video = AVAssetWriterInput(mediaType: .video, outputSettings: [AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: width, AVVideoHeightKey: height, AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 2000000, AVVideoExpectedSourceFrameRateKey: fps, AVVideoMaxKeyFrameIntervalKey: 48, AVVideoProfileLevelKey: AVVideoProfileLevelH264MainAutoLevel]])
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: video, sourcePixelBufferAttributes: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA, kCVPixelBufferWidthKey as String: width, kCVPixelBufferHeightKey as String: height])
writer.add(video)
var audioReader: AVAssetReader? = nil, audioOutput: AVAssetReaderTrackOutput? = nil, audioInput: AVAssetWriterInput? = nil
if job.mode == "narrated" {
    guard let file = job.audio else { throw ProductionError.invalid("audio_missing") }
    let audioAsset = AVURLAsset(url: URL(fileURLWithPath: file))
    try require(abs(CMTimeGetSeconds(audioAsset.duration) - job.durationSeconds) <= 0.1, "audio_duration_mismatch")
    guard let track = audioAsset.tracks(withMediaType: .audio).first else { throw ProductionError.invalid("audio_track_missing") }
    let reader = try AVAssetReader(asset: audioAsset)
    let readerOutput = AVAssetReaderTrackOutput(track: track, outputSettings: [AVFormatIDKey: kAudioFormatLinearPCM, AVLinearPCMBitDepthKey: 16, AVLinearPCMIsFloatKey: false, AVLinearPCMIsBigEndianKey: false, AVLinearPCMIsNonInterleaved: false])
    reader.add(readerOutput)
    let input = AVAssetWriterInput(mediaType: .audio, outputSettings: [AVFormatIDKey: kAudioFormatMPEG4AAC, AVSampleRateKey: 44100, AVNumberOfChannelsKey: 1, AVEncoderBitRateKey: 128000])
    writer.add(input); audioReader = reader; audioOutput = readerOutput; audioInput = input
}
try require(writer.startWriting(), "writer_start_failed")
writer.startSession(atSourceTime: .zero)
let background = CGColor(red: 14/255, green: 30/255, blue: 43/255, alpha: 1)
let foreground = CGColor(red: 245/255, green: 248/255, blue: 246/255, alpha: 1)
func textFrame(_ text: String, fontSize: CGFloat, rect: CGRect, context: CGContext) throws {
    let attributes: [NSAttributedString.Key: Any] = [NSAttributedString.Key(kCTFontAttributeName as String): CTFontCreateWithName("Helvetica" as CFString, fontSize, nil), NSAttributedString.Key(kCTForegroundColorAttributeName as String): foreground]
    let string = NSAttributedString(string: text, attributes: attributes)
    let setter = CTFramesetterCreateWithAttributedString(string)
    let frame = CTFramesetterCreateFrame(setter, CFRange(location: 0, length: string.length), CGPath(rect: rect, transform: nil), nil)
    try require(CTFrameGetVisibleStringRange(frame).length == string.length, "caption_layout_overflow")
    CTFrameDraw(frame, context)
}
let group = DispatchGroup(); var audioFailure: Error? = nil
if let reader = audioReader, let readerOutput = audioOutput, let input = audioInput {
    try require(reader.startReading(), "audio_reader_start_failed")
    group.enter()
    DispatchQueue(label: "cuai-local-audio").async {
        defer { input.markAsFinished(); group.leave() }
        do { while let sample = readerOutput.copyNextSampleBuffer() { try ready(input, writer); try require(input.append(sample), "audio_append_failed") }; try require(reader.status == .completed, "audio_read_failed") } catch { audioFailure = error }
    }
}
let count = Int(ceil(job.durationSeconds * Double(fps)))
do {
    for index in 0..<count {
        try autoreleasepool {
            let time = Double(index) / Double(fps)
            let image = try stillImage ?? generator!.copyCGImage(at: CMTime(seconds: time, preferredTimescale: 600), actualTime: nil)
            var buffer: CVPixelBuffer? = nil
            try require(CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &buffer) == kCVReturnSuccess, "pixel_buffer_failed")
            let pixel = buffer!
            CVPixelBufferLockBaseAddress(pixel, [])
            defer { CVPixelBufferUnlockBaseAddress(pixel, []) }
            guard let context = CGContext(data: CVPixelBufferGetBaseAddress(pixel), width: width, height: height, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(pixel), space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue) else { throw ProductionError.invalid("graphics_context_failed") }
            context.setFillColor(background); context.fill(CGRect(x: 0, y: 0, width: width, height: height))
            if still {
                let scale = min(636 / CGFloat(image.width), 700 / CGFloat(image.height))
                let w = CGFloat(image.width) * scale, h = CGFloat(image.height) * scale
                context.draw(image, in: CGRect(x: (720-w)/2, y: 380+(700-h)/2, width: w, height: h))
            } else {
                try require(image.width == width && image.height == height, "visual_dimensions_mismatch")
                context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
            }
            // Replace only the existing lower caption band; retain graphics/source attribution.
            context.setFillColor(background); context.fill(CGRect(x: 0, y: 0, width: 720, height: 370))
            if let cue = job.captions.first(where: { time >= $0.start && time < $0.end }) {
                try textFrame(cue.text, fontSize: 36, rect: CGRect(x: 56, y: 145, width: 608, height: 170), context: context)
            }
            try textFrame(job.mode == "caption-led-silent" ? "CAPTION-LED REVIEW · NO AUDIO" : "NARRATED REVIEW · UNPUBLISHED", fontSize: 22, rect: CGRect(x: 56, y: 65, width: 608, height: 42), context: context)
            try ready(video, writer)
            try require(adaptor.append(pixel, withPresentationTime: CMTime(value: Int64(index), timescale: fps)), "video_append_failed")
        }
    }
    video.markAsFinished(); group.wait()
    if let failure = audioFailure { throw failure }
    let done = DispatchSemaphore(value: 0); writer.finishWriting { done.signal() }; done.wait()
    try require(writer.status == .completed, "writer_finish_failed")
} catch { writer.cancelWriting(); try? FileManager.default.removeItem(at: partial); throw error }
// Full native decode of the finished file, including waveform limits for narrated mode.
let finished = AVURLAsset(url: partial)
var decodedFrames = 0, audioTracks = 0, fullScaleSamples = 0, audioDecoded = false
var peak: Int32 = 0, squared = 0.0, sampleCount = 0
for track in finished.tracks {
    let reader = try AVAssetReader(asset: finished)
    let settings: [String: Any] = track.mediaType == .video ? [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA] : [AVFormatIDKey: kAudioFormatLinearPCM, AVLinearPCMBitDepthKey: 16, AVLinearPCMIsFloatKey: false, AVLinearPCMIsBigEndianKey: false, AVLinearPCMIsNonInterleaved: false]
    let readerOutput = AVAssetReaderTrackOutput(track: track, outputSettings: settings); reader.add(readerOutput)
    try require(reader.startReading(), "probe_start_failed")
    if track.mediaType == .audio { audioTracks += 1 }
    while let sample = readerOutput.copyNextSampleBuffer() {
        if track.mediaType == .video { decodedFrames += 1 }
        else if let block = CMSampleBufferGetDataBuffer(sample) {
            let length = CMBlockBufferGetDataLength(block)
            var data = Data(count: length)
            data.withUnsafeMutableBytes { _ = CMBlockBufferCopyDataBytes(block, atOffset: 0, dataLength: length, destination: $0.baseAddress!) }
            data.withUnsafeBytes { bytes in for value in bytes.bindMemory(to: Int16.self) { let magnitude = abs(Int32(value)); peak = max(peak, magnitude); if magnitude >= 32767 { fullScaleSamples += 1 }; squared += Double(value) * Double(value); sampleCount += 1 } }
        }
    }
    try require(reader.status == .completed, "full_decode_failed")
    if track.mediaType == .audio { audioDecoded = true }
}
guard let track = finished.tracks(withMediaType: .video).first else { throw ProductionError.invalid("video_track_missing") }
let subtype = CMFormatDescriptionGetMediaSubType(track.formatDescriptions[0] as! CMFormatDescription)
let codec = String(bytes: [UInt8((subtype>>24)&255), UInt8((subtype>>16)&255), UInt8((subtype>>8)&255), UInt8(subtype&255)], encoding: .ascii)!
let report: [String: Any] = ["durationSeconds": CMTimeGetSeconds(finished.duration), "width": Int(track.naturalSize.width), "height": Int(track.naturalSize.height), "frameRate": track.nominalFrameRate, "videoCodec": codec, "videoFrames": decodedFrames, "videoDecodeCompleted": true, "audioTracks": audioTracks, "audioDecodeCompleted": audioDecoded, "fullScaleSamples": fullScaleSamples, "peakDBFS": sampleCount > 0 && peak > 0 ? 20 * log10(Double(peak) / 32768) : NSNull(), "rmsDBFS": sampleCount > 0 && squared > 0 ? 20 * log10(sqrt(squared / Double(sampleCount)) / 32768) : NSNull(), "captionLayoutVerified": true, "actualListeningVerified": false]
if FileManager.default.fileExists(atPath: output.path) { try FileManager.default.removeItem(at: output) }
try FileManager.default.moveItem(at: partial, to: output)
print(String(data: try JSONSerialization.data(withJSONObject: report, options: [.sortedKeys]), encoding: .utf8)!)
