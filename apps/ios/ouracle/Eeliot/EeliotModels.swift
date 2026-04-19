import Foundation

public enum EeliotAnswerType: String, Codable, Sendable {
    case emoji5 = "EMOJI5"
    case mcq = "MCQ"
    case text = "TEXT"
}

public struct EeliotPromptVariant: Codable, Sendable, Hashable {
    public let key: String
    public let weight: Int

    public init(key: String, weight: Int) {
        self.key = key
        self.weight = weight
    }
}

public struct EeliotPrompt: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public let question: String
    public let answerType: EeliotAnswerType
    public let triggers: [String]
    public let cooldownSeconds: Int
    public let samplingRate: Double
    public let variants: [EeliotPromptVariant]

    public init(
        id: String,
        question: String,
        answerType: EeliotAnswerType,
        triggers: [String],
        cooldownSeconds: Int,
        samplingRate: Double,
        variants: [EeliotPromptVariant]
    ) {
        self.id = id
        self.question = question
        self.answerType = answerType
        self.triggers = triggers
        self.cooldownSeconds = cooldownSeconds
        self.samplingRate = samplingRate
        self.variants = variants
    }
}

public struct EeliotPromptsResponse: Codable, Sendable {
    public let app: String
    public let prompts: [EeliotPrompt]
}

public enum EeliotResponseValue: Sendable, Hashable {
    case emoji5(Int) // 1..5
    case mcq(String)
    case text(String)
}

public struct EeliotIngestResponse: Codable, Sendable {
    public let answerType: EeliotAnswerType
    public let value: CodableValue

    public struct CodableValue: Codable, Sendable, Hashable {
        public let intValue: Int?
        public let stringValue: String?

        public init(intValue: Int? = nil, stringValue: String? = nil) {
            self.intValue = intValue
            self.stringValue = stringValue
        }
    }

    public init(answerType: EeliotAnswerType, value: CodableValue) {
        self.answerType = answerType
        self.value = value
    }
}

public struct EeliotIngestPayload: Codable, Sendable {
    public let app: String
    public let promptId: String
    public let variantKey: String?
    public let installId: String
    public let trigger: String
    public let screen: String?
    public let build: String?
    public let context: [String: String]?
    public let response: EeliotIngestResponse
}

public struct EeliotExposurePayload: Codable, Sendable {
    public let app: String
    public let promptId: String
    public let variantKey: String?
    public let installId: String
    public let trigger: String
    public let screen: String?
    public let build: String?
    public let context: [String: String]?
}

