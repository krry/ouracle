//
//  DateFormatters.swift
//  souvenir
//
//  Phase 8: Data Formatting
//  Centralized date formatting utilities for consistent display
//

import Foundation

/// Centralized date formatting utilities for the Souvenir app.
/// Provides consistent, user-friendly date/time display throughout the UI.
enum DateFormatters {

    // MARK: - Shared Formatters

    /// "Jan 17, 2026" - Short date without time
    static let shortDate: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()

    /// "Jan '26" - Short month and year format
    static let shortMonthYear: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM ''yy"
        return formatter
    }()

    /// "Jan 17, 2026 at 3:45 PM" - Date with time
    static let dateWithTime: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()

    /// "3:45 PM" - Time only
    static let timeOnly: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter
    }()

    /// "Friday, Jan 17, 2026" - Long date with weekday
    static let longDate: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMM d, yyyy"
        return formatter
    }()

    /// "Jan 17" - Short month and day
    static let monthDay: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter
    }()

    /// "January 17" - Long month and day
    static let monthDayLong: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM d"
        return formatter
    }()

    /// "2026" - Year only
    static let yearOnly: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy"
        return formatter
    }()

    /// "01/17/26" - MM/DD/YY format for photo dates
    static let numericShortDate: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "MM/dd/yy"
        return formatter
    }()

    // MARK: - Relative Formatting

    /// Get a human-readable relative time string
    /// Examples: "Today", "Yesterday", "2 days ago", "Jan 15"
    static func relativeString(from date: Date) -> String {
        let calendar = Calendar.current
        let now = Date()

        // Check if today
        if calendar.isDateInToday(date) {
            return "Today"
        }

        // Check if yesterday
        if calendar.isDateInYesterday(date) {
            return "Yesterday"
        }

        // Check if within last week
        if let daysAgo = calendar.dateComponents([.day], from: date, to: now).day,
           daysAgo >= 0 && daysAgo < 7 {
            return "\(daysAgo) days ago"
        }

        // Check if this year
        if calendar.component(.year, from: date) == calendar.component(.year, from: now) {
            return monthDay.string(from: date)
        }

        // Default: show full date
        return shortDate.string(from: date)
    }

    /// Get a compact relative string for list views
    /// Examples: "Today", "Yesterday", "Jan 15", "Dec 2025"
    static func compactRelativeString(from date: Date) -> String {
        let calendar = Calendar.current
        let now = Date()

        if calendar.isDateInToday(date) {
            return "Today"
        }

        if calendar.isDateInYesterday(date) {
            return "Yesterday"
        }

        // Same year: show month + day
        if calendar.component(.year, from: date) == calendar.component(.year, from: now) {
            return monthDay.string(from: date)
        }

        // Different year: show month + year
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM yyyy"
        return formatter.string(from: date)
    }
}

// MARK: - Date Extension

extension Date {
    /// Get user-friendly relative string: "Today", "Yesterday", "Jan 15"
    var relativeString: String {
        DateFormatters.relativeString(from: self)
    }

    /// Get compact relative string for lists: "Today", "Jan 15"
    var compactRelativeString: String {
        DateFormatters.compactRelativeString(from: self)
    }

    /// Get short date string: "Jan 17, 2026"
    var shortDateString: String {
        DateFormatters.shortDate.string(from: self)
    }

    /// Get short month and year string: "Jan '26"
    var shortMonthYearString: String {
        DateFormatters.shortMonthYear.string(from: self)
    }

    /// Get date with time string: "Jan 17, 2026 at 3:45 PM"
    var dateWithTimeString: String {
        DateFormatters.dateWithTime.string(from: self)
    }

    /// Get time only string: "3:45 PM"
    var timeOnlyString: String {
        DateFormatters.timeOnly.string(from: self)
    }

    /// Get month and day: "Jan 17"
    var monthDayString: String {
        DateFormatters.monthDay.string(from: self)
    }

    /// Get numeric short date: "01/17/26" (MM/DD/YY format for photo dates)
    var numericShortDateString: String {
        DateFormatters.numericShortDate.string(from: self)
    }
}
