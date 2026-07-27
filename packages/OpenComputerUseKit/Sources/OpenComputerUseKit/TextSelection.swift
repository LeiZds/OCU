import Foundation

public enum TextSelectionType: String, CaseIterable, Sendable {
    case text
    case cursorBefore = "cursor_before"
    case cursorAfter = "cursor_after"
}

public func resolveTextSelectionRange(
    in value: String,
    text: String,
    prefix: String? = nil,
    suffix: String? = nil,
    selectionType rawSelectionType: String = TextSelectionType.text.rawValue
) throws -> NSRange {
    guard !text.isEmpty else {
        throw ComputerUseError.invalidArguments("select_text requires non-empty text")
    }

    guard let selectionType = TextSelectionType(rawValue: rawSelectionType.lowercased()) else {
        let expected = TextSelectionType.allCases.map(\.rawValue).joined(separator: ", ")
        throw ComputerUseError.invalidArguments(
            "selection_type must be one of: \(expected)"
        )
    }

    let source = value as NSString
    let needle = text as NSString
    var searchRange = NSRange(location: 0, length: source.length)
    var matches: [NSRange] = []

    while searchRange.length >= needle.length {
        let candidate = source.range(of: text, options: [], range: searchRange)
        if candidate.location == NSNotFound {
            break
        }

        let before = source.substring(with: NSRange(location: 0, length: candidate.location))
        let afterStart = candidate.location + candidate.length
        let after = source.substring(
            with: NSRange(location: afterStart, length: source.length - afterStart)
        )
        let prefixMatches = prefix.map { before.hasSuffix($0) } ?? true
        let suffixMatches = suffix.map { after.hasPrefix($0) } ?? true
        if prefixMatches && suffixMatches {
            matches.append(candidate)
        }

        let nextLocation = candidate.location + max(candidate.length, 1)
        if nextLocation > source.length {
            break
        }
        searchRange = NSRange(location: nextLocation, length: source.length - nextLocation)
    }

    guard !matches.isEmpty else {
        throw ComputerUseError.invalidArguments(
            "select_text could not find the requested text with the supplied context"
        )
    }
    guard matches.count == 1 else {
        throw ComputerUseError.invalidArguments(
            "select_text matched \(matches.count) locations; add prefix or suffix to disambiguate"
        )
    }

    let match = matches[0]
    switch selectionType {
    case .text:
        return match
    case .cursorBefore:
        return NSRange(location: match.location, length: 0)
    case .cursorAfter:
        return NSRange(location: match.location + match.length, length: 0)
    }
}
