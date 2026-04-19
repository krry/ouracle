import Foundation
import Observation

@MainActor
@Observable
public final class EeliotEngine {
    public private(set) var active: EeliotSession?
    public private(set) var prompts: [EeliotPrompt] = []

    private let configuration: EeliotConfiguration
    private let installId: String
    private let api: EeliotAPI
    private let queue: EeliotQueue
    private let userDefaults: UserDefaults

    private var lastShownAtByPromptId: [String: Date] = [:]
    private var snoozedUntilByPromptId: [String: Date] = [:]
    private var globalLastShownAt: Date?

    public init(
        configuration: EeliotConfiguration,
        build: String? = nil,
        userDefaults: UserDefaults = .standard
    ) {
        self.configuration = configuration
        self.userDefaults = userDefaults
        self.installId = EeliotInstallID.loadOrCreate(userDefaults: userDefaults)
        self.api = EeliotAPI(configuration: configuration)

        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
        let fileURL = (dir ?? URL(fileURLWithPath: NSTemporaryDirectory()))
            .appending(path: "eeliot")
            .appending(path: "queue.jsonl")
        self.queue = EeliotQueue(fileURL: fileURL)

        loadGatingState()

        Task {
            await refreshPrompts(build: build)
            await flush()
        }
    }

    /// Call this from your app lifecycle (eg `.onAppear` of root, or scenePhase changes).
    public func applicationDidBecomeActive(build: String?) async {
        await refreshPrompts(build: build)
        await flush()
    }

    public func refreshPrompts(build: String?) async {
        do {
            let response = try await api.fetchPrompts(build: build)
            prompts = response.prompts
        } catch {
            // Network failure should not impact the app UX.
        }
    }

    /// Call this from any interaction. The engine decides whether to actually show a prompt.
    public func request(
        trigger: String,
        screen: String? = nil,
        anchorID: String? = nil,
        context: [String: String] = [:]
    ) {
        guard active == nil else { return }
        guard let prompt = pickPrompt(trigger: trigger) else { return }
        guard shouldShow(promptId: prompt.id, cooldownSeconds: prompt.cooldownSeconds) else { return }
        guard sample(rate: prompt.samplingRate) else { return }

        let variantKey = pickVariantKey(prompt: prompt)
        let session = EeliotSession(
            prompt: prompt,
            variantKey: variantKey,
            trigger: trigger,
            screen: screen,
            anchorID: anchorID,
            context: context.isEmpty ? nil : context
        )
        active = session
        globalLastShownAt = Date()
        lastShownAtByPromptId[prompt.id] = Date()
        persistGatingState()

        Task {
            await recordExposure(session: session)
        }
    }

    public func dismiss(reason: EeliotDismissReason) {
        guard let session = active else { return }
        active = nil
        if reason == .notNow {
            snoozedUntilByPromptId[session.prompt.id] = Date().addingTimeInterval(6 * 60 * 60)
        }
        persistGatingState()
    }

    public func submit(_ value: EeliotResponseValue) {
        guard let session = active else { return }
        active = nil

        let response = session.prompt.answerType
        let ingest = EeliotIngestPayload(
            app: configuration.appSlug,
            promptId: session.prompt.id,
            variantKey: session.variantKey,
            installId: installId,
            trigger: session.trigger,
            screen: session.screen,
            build: nil,
            context: session.context,
            response: encodeResponse(type: response, value: value)
        )

        Task {
            do {
                try await queue.enqueue(ingest)
                await flush()
            } catch {
                // If enqueue fails, we drop; never impact primary UX.
            }
        }
    }

    public func flush() async {
        do {
            let pending = try await queue.drain()
            guard !pending.isEmpty else { return }
            for item in pending {
                try await api.postResponse(item)
            }
            try await queue.clear()
        } catch {
            // Keep queued for later.
        }
    }

    private func pickPrompt(trigger: String) -> EeliotPrompt? {
        let eligible = prompts.filter { $0.triggers.contains(trigger) }
        return eligible.first
    }

    private func shouldShow(promptId: String, cooldownSeconds: Int) -> Bool {
        if let snoozedUntil = snoozedUntilByPromptId[promptId], snoozedUntil > Date() {
            return false
        }
        if let last = lastShownAtByPromptId[promptId],
           Date().timeIntervalSince(last) < TimeInterval(cooldownSeconds) {
            return false
        }
        if let global = globalLastShownAt,
           Date().timeIntervalSince(global) < TimeInterval(60) {
            return false
        }
        return true
    }

    private func sample(rate: Double) -> Bool {
        if rate >= 1 { return true }
        if rate <= 0 { return false }
        return Double.random(in: 0..<1) < rate
    }

    private func pickVariantKey(prompt: EeliotPrompt) -> String? {
        guard !prompt.variants.isEmpty else { return nil }
        // Stable-ish assignment: hash installId+promptId into weighted buckets.
        let seed = (installId + ":" + prompt.id).utf8.reduce(0) { ($0 &* 31) &+ Int($1) }
        let total = prompt.variants.reduce(0) { $0 + max(0, $1.weight) }
        guard total > 0 else { return prompt.variants.first?.key }
        let roll = abs(seed) % total
        var acc = 0
        for v in prompt.variants {
            acc += max(0, v.weight)
            if roll < acc { return v.key }
        }
        return prompt.variants.first?.key
    }

    private func encodeResponse(type: EeliotAnswerType, value: EeliotResponseValue) -> EeliotIngestResponse {
        switch (type, value) {
        case (.emoji5, .emoji5(let n)):
            return EeliotIngestResponse(answerType: .emoji5, value: .init(intValue: n))
        case (.mcq, .mcq(let s)):
            return EeliotIngestResponse(answerType: .mcq, value: .init(stringValue: s))
        case (.text, .text(let s)):
            return EeliotIngestResponse(answerType: .text, value: .init(stringValue: s))
        default:
            // If callers mismatch type/value, we drop to text for safety.
            return EeliotIngestResponse(answerType: .text, value: .init(stringValue: "\(value)"))
        }
    }

    private func recordExposure(session: EeliotSession) async {
        let payload = EeliotExposurePayload(
            app: configuration.appSlug,
            promptId: session.prompt.id,
            variantKey: session.variantKey,
            installId: installId,
            trigger: session.trigger,
            screen: session.screen,
            build: nil,
            context: session.context
        )
        do {
            try await api.postExposure(payload)
        } catch {
            // Ignore.
        }
    }

    private func loadGatingState() {
        if let map = userDefaults.dictionary(forKey: "eeliot.last_shown") as? [String: TimeInterval] {
            lastShownAtByPromptId = map.mapValues { Date(timeIntervalSince1970: $0) }
        }
        if let map = userDefaults.dictionary(forKey: "eeliot.snoozed_until") as? [String: TimeInterval] {
            snoozedUntilByPromptId = map.mapValues { Date(timeIntervalSince1970: $0) }
        }
        if userDefaults.object(forKey: "eeliot.global_last_shown") != nil {
            globalLastShownAt = Date(timeIntervalSince1970: userDefaults.double(forKey: "eeliot.global_last_shown"))
        }
    }

    private func persistGatingState() {
        userDefaults.set(lastShownAtByPromptId.mapValues { $0.timeIntervalSince1970 }, forKey: "eeliot.last_shown")
        userDefaults.set(snoozedUntilByPromptId.mapValues { $0.timeIntervalSince1970 }, forKey: "eeliot.snoozed_until")
        if let globalLastShownAt {
            userDefaults.set(globalLastShownAt.timeIntervalSince1970, forKey: "eeliot.global_last_shown")
        }
    }
}

public struct EeliotSession: Sendable, Hashable {
    public let prompt: EeliotPrompt
    public let variantKey: String?
    public let trigger: String
    public let screen: String?
    public let anchorID: String?
    public let context: [String: String]?

    public init(
        prompt: EeliotPrompt,
        variantKey: String?,
        trigger: String,
        screen: String?,
        anchorID: String?,
        context: [String: String]?
    ) {
        self.prompt = prompt
        self.variantKey = variantKey
        self.trigger = trigger
        self.screen = screen
        self.anchorID = anchorID
        self.context = context
    }
}

public enum EeliotDismissReason: Sendable {
    case close
    case notNow
}
