import Foundation
import Combine

@MainActor
final class PerformanceWarmer: ObservableObject {

    enum WarmupState: Equatable {
        case idle, warming, ready

        var isReady: Bool { self == .ready }
    }

    @Published private(set) var state: WarmupState = .idle

    static let shared = PerformanceWarmer()
    private init() {}

    func warmup() async {
        guard state == .idle else { return }
        state = .warming
        state = .ready
    }
}
