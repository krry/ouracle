import Foundation

actor EeliotQueue {
    private let fileURL: URL

    init(fileURL: URL) {
        self.fileURL = fileURL
    }

    func enqueue(_ payload: EeliotIngestPayload) async throws {
        let data = try await MainActor.run { try JSONEncoder().encode(payload) }
        var line = data
        line.append(0x0A)

        let fm = FileManager.default
        if !fm.fileExists(atPath: fileURL.path) {
            try fm.createDirectory(at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            fm.createFile(atPath: fileURL.path, contents: nil)
        }

        let handle = try FileHandle(forWritingTo: fileURL)
        try handle.seekToEnd()
        try handle.write(contentsOf: line)
        try handle.close()
    }

    func drain() async throws -> [EeliotIngestPayload] {
        let fm = FileManager.default
        guard fm.fileExists(atPath: fileURL.path) else { return [] }

        let data = try Data(contentsOf: fileURL)
        guard !data.isEmpty else { return [] }

        var items: [EeliotIngestPayload] = []
        for line in data.split(separator: 0x0A) {
            guard !line.isEmpty else { continue }
            let item = try await MainActor.run {
                try JSONDecoder().decode(EeliotIngestPayload.self, from: Data(line))
            }
            items.append(item)
        }
        return items
    }

    func clear() async throws {
        let fm = FileManager.default
        guard fm.fileExists(atPath: fileURL.path) else { return }
        try fm.removeItem(at: fileURL)
    }
}

