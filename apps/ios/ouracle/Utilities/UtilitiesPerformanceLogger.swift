//
//  UtilitiesPerformanceLogger.swift
//  souvenir
//
//  Created by Kerrbear on 17.01.2026.
//

import Foundation
import os.log

/// Simple performance logging for timing critical operations
@MainActor
final class PerformanceLogger {
    private static let logger = Logger(subsystem: Bundle.main.bundleIdentifier ?? "souvenir", category: "Performance")
    
    private var startTimes: [String: CFAbsoluteTime] = [:]
    
    static let shared = PerformanceLogger()
    
    private init() {}
    
    /// Start timing an operation
    func start(_ operation: String) {
        let time = CFAbsoluteTimeGetCurrent()
        startTimes[operation] = time
        Self.logger.debug("⏳ START: \(operation)")
        print("⏳ START: \(operation) at \(time)")
    }
    
    /// End timing and log duration
    func end(_ operation: String) {
        let endTime = CFAbsoluteTimeGetCurrent()
        guard let startTime = startTimes[operation] else {
            Self.logger.warning("⚠️ No start time for: \(operation)")
            print("⚠️ No start time for: \(operation)")
            return
        }
        
        let duration = (endTime - startTime) * 1000 // Convert to ms
        startTimes.removeValue(forKey: operation)
        
        let emoji = duration < 100 ? "✅" : duration < 2222 ? "⚠️" : "❌"
        let message = "⌛️ FINISH: \(operation) - \(String(format: "%.1f", duration))ms \(emoji)"
        Self.logger.info("\(message)")
        print(message)
    }
    
    /// Log a point-in-time event
    static func log(_ message: String) {
        logger.info("📊 \(message)")
        print("📊 \(message)")
    }
    
    /// Log current system state
    func logSystemState(_ context: String) {
        let message = "📊 System State [\(context)]:"
        Self.logger.info("\(message)")
        print(message)
        
        // Log active operations
        if startTimes.isEmpty {
            print("   No active timers")
        } else {
            print("   Active timers: \(startTimes.keys.sorted().joined(separator: ", "))")
        }
    }
}
