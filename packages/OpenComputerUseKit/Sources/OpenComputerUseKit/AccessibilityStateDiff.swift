import Foundation

func renderAccessibilityStateDiff(previous: String, current: String) -> String {
    let previousLines = previous.components(separatedBy: "\n")
    let currentLines = current.components(separatedBy: "\n")

    guard previousLines.count >= 2, currentLines.count >= 2 else {
        return current
    }

    let previousHeader = Array(previousLines.prefix(2))
    let currentHeader = Array(currentLines.prefix(2))
    guard previousHeader == currentHeader else {
        return current
    }

    let previousBody = Array(previousLines.dropFirst(2))
    let currentBody = Array(currentLines.dropFirst(2))
    let difference = currentBody.difference(from: previousBody)

    let removals = difference.compactMap { change -> (Int, String)? in
        guard case let .remove(offset, element, _) = change else {
            return nil
        }
        return (offset, element)
    }
    .sorted { $0.0 < $1.0 }

    let insertions = difference.compactMap { change -> (Int, String)? in
        guard case let .insert(offset, element, _) = change else {
            return nil
        }
        return (offset, element)
    }
    .sorted { $0.0 < $1.0 }

    if removals.isEmpty, insertions.isEmpty {
        return (currentHeader + [
            "",
            "No accessibility changes since the previous presented state.",
        ]).joined(separator: "\n")
    }

    var lines = currentHeader
    lines.append("")
    lines.append("Accessibility changes since the previous presented state:")

    if !insertions.isEmpty {
        lines.append("Added:")
        lines.append(contentsOf: insertions.map(\.1))
    }
    if !removals.isEmpty {
        lines.append("Removed:")
        lines.append(contentsOf: removals.map(\.1))
    }

    return lines.joined(separator: "\n")
}
