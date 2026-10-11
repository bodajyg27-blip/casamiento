import AVFoundation
import Foundation

// uso: transcode <entrada> <salida> <ancho> <alto> <bitrate video bps>
let a = CommandLine.arguments
let src = URL(fileURLWithPath: a[1]), dst = URL(fileURLWithPath: a[2])
let w = Int(a[3])!, h = Int(a[4])!, br = Int(a[5])!
try? FileManager.default.removeItem(at: dst)

let asset = AVURLAsset(url: src)
let sem = DispatchSemaphore(value: 0)
Task {
  do {
    let vTrack = try await asset.loadTracks(withMediaType: .video).first!
    let aTrack = try await asset.loadTracks(withMediaType: .audio).first
    let fps = try await vTrack.load(.nominalFrameRate)
    let reader = try AVAssetReader(asset: asset)
    let writer = try AVAssetWriter(outputURL: dst, fileType: .mp4)
    writer.shouldOptimizeForNetworkUse = true   // faststart: moov al principio

    let vOut = AVAssetReaderVideoCompositionOutput(videoTracks: [vTrack], videoSettings: [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange])
    vOut.videoComposition = try await AVVideoComposition.videoComposition(withPropertiesOf: asset)
    reader.add(vOut)
    let vIn = AVAssetWriterInput(mediaType: .video, outputSettings: [
      AVVideoCodecKey: AVVideoCodecType.h264,
      AVVideoWidthKey: w, AVVideoHeightKey: h,
      AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: br,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
        AVVideoMaxKeyFrameIntervalDurationKey: 2.0,
        AVVideoExpectedSourceFrameRateKey: fps,
        AVVideoAllowFrameReorderingKey: true
      ] as [String: Any]
    ])
    vIn.expectsMediaDataInRealTime = false
    writer.add(vIn)

    var aOut: AVAssetReaderTrackOutput? = nil
    var aIn: AVAssetWriterInput? = nil
    if let aTrack {
      let o = AVAssetReaderTrackOutput(track: aTrack, outputSettings: [AVFormatIDKey: kAudioFormatLinearPCM])
      reader.add(o); aOut = o
      let i = AVAssetWriterInput(mediaType: .audio, outputSettings: [
        AVFormatIDKey: kAudioFormatMPEG4AAC, AVNumberOfChannelsKey: 2,
        AVSampleRateKey: 44100, AVEncoderBitRateKey: 128000])
      i.expectsMediaDataInRealTime = false
      writer.add(i); aIn = i
    }

    reader.startReading(); writer.startWriting(); writer.startSession(atSourceTime: .zero)
    let group = DispatchGroup()
    func pump(_ input: AVAssetWriterInput, _ output: AVAssetReaderOutput, _ name: String) {
      group.enter()
      input.requestMediaDataWhenReady(on: DispatchQueue(label: name)) {
        while input.isReadyForMoreMediaData {
          if let s = output.copyNextSampleBuffer() { input.append(s) }
          else { input.markAsFinished(); group.leave(); return }
        }
      }
    }
    pump(vIn, vOut, "v")
    if let aIn, let aOut { pump(aIn, aOut, "a") }
    group.wait()
    await writer.finishWriting()
    print(writer.status == .completed ? "ok fps=\(fps)" : "ERROR \(String(describing: writer.error)) reader=\(String(describing: reader.error))")
  } catch { print("ERROR \(error)") }
  sem.signal()
}
sem.wait()
