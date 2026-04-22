import AVFoundation
import Combine
import Foundation

// MARK: - Manifest models

struct AmbienceManifest: Decodable {
    let version: Int
    let climes: [AmbienceTrack]
    let overlays: [AmbienceTrack]
}

struct AmbienceTrack: Decodable, Identifiable, Equatable {
    let id: String
    let label: String
    let file: String
}

// MARK: - Service

@MainActor
final class AmbienceService: ObservableObject {
    static let shared = AmbienceService()

    @Published private(set) var manifest: AmbienceManifest? = nil
    @Published var activeClimeID: String? = nil
    @Published var activeOverlayIDs: Set<String> = []
    @Published var climeVolume: Float = 0.70
    @Published var overlayVolume: Float = 0.45

    private var climePlayer: AVQueuePlayer?
    private var climeLooper: AVPlayerLooper?
    private var overlayPlayers: [String: (AVQueuePlayer, AVPlayerLooper)] = [:]

    private let base = "https://api.ouracle.kerry.ink"
    private let cacheDir: URL = {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("ambience", isDirectory: true)
    }()

    private init() {
        try? FileManager.default.createDirectory(at: cacheDir, withIntermediateDirectories: true)
        configureAudioSession()
        Task { await loadManifest() }
    }

    // MARK: - Manifest

    func loadManifest() async {
        guard let url = URL(string: base + "/ambience") else { return }
        guard let (data, _) = try? await URLSession.shared.data(from: url),
              let decoded = try? JSONDecoder().decode(AmbienceManifest.self, from: data) else { return }
        manifest = decoded
    }

    // MARK: - Playback

    func playClime(_ id: String?) {
        stopClime()
        activeClimeID = id
        guard let id, let track = manifest?.climes.first(where: { $0.id == id }) else { return }
        Task { await startLooping(track: track, isOverlay: false) }
    }

    func toggleOverlay(_ id: String) {
        if activeOverlayIDs.contains(id) {
            stopOverlay(id)
            activeOverlayIDs.remove(id)
        } else {
            activeOverlayIDs.insert(id)
            guard let track = manifest?.overlays.first(where: { $0.id == id }) else { return }
            Task { await startLooping(track: track, isOverlay: true) }
        }
    }

    func stopAll() {
        stopClime()
        for id in activeOverlayIDs { stopOverlay(id) }
        activeOverlayIDs = []
        activeClimeID = nil
    }

    // MARK: - Volume

    func setClimeVolume(_ v: Float) {
        climeVolume = v
        climePlayer?.volume = v
    }

    func setOverlayVolume(_ v: Float) {
        overlayVolume = v
        overlayPlayers.values.forEach { $0.0.volume = v }
    }

    // MARK: - Private

    private func startLooping(track: AmbienceTrack, isOverlay: Bool) async {
        // Use cached file if available, otherwise stream from remote immediately
        let dest = cacheDir.appendingPathComponent(track.file)
        let playURL: URL
        if FileManager.default.fileExists(atPath: dest.path) {
            playURL = dest
        } else {
            guard let remote = URL(string: base + "/ambient/" + track.file) else { return }
            playURL = remote
            // Cache in background for next time
            Task.detached { [weak self] in
                guard let self else { return }
                if let (tmp, _) = try? await URLSession.shared.download(from: remote) {
                    try? FileManager.default.moveItem(at: tmp, to: dest)
                }
            }
        }

        let item = AVPlayerItem(url: playURL)
        let player = AVQueuePlayer()
        let looper = AVPlayerLooper(player: player, templateItem: item)
        player.volume = isOverlay ? overlayVolume : climeVolume
        player.play()
        print("[Ambience] playing \(track.id) from \(playURL.lastPathComponent) looper=\(looper)")
        if isOverlay {
            overlayPlayers[track.id] = (player, looper)
        } else {
            climePlayer = player
            climeLooper = looper
        }
    }

    private func stopClime() {
        climePlayer?.pause()
        climePlayer = nil
        climeLooper = nil
    }

    private func stopOverlay(_ id: String) {
        overlayPlayers[id]?.0.pause()
        overlayPlayers.removeValue(forKey: id)
    }

    private func configureAudioSession() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, options: [.mixWithOthers, .duckOthers])
        try? session.setActive(true)
    }
}
