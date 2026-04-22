import Network

final class NetworkMonitor: @unchecked Sendable {
    static let shared = NetworkMonitor()

    private let monitor = NWPathMonitor()
    private(set) var isCellular: Bool = false

    private init() {
        monitor.pathUpdateHandler = { [weak self] path in
            self?.isCellular = path.usesInterfaceType(.cellular)
        }
        monitor.start(queue: DispatchQueue(label: "network.monitor"))
    }
}
