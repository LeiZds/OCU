import CoreGraphics
import Foundation

public struct FixtureRect: Codable, Sendable {
    public let x: Double
    public let y: Double
    public let width: Double
    public let height: Double

    public init(rect: CGRect) {
        x = rect.origin.x
        y = rect.origin.y
        width = rect.width
        height = rect.height
    }

    public var cgRect: CGRect {
        CGRect(x: x, y: y, width: width, height: height)
    }
}

public struct FixtureElementState: Codable, Sendable {
    public let identifier: String
    public let index: Int
    public let role: String
    public let title: String?
    public let value: String?
    public let actions: [String]
    public let frame: FixtureRect

    public init(identifier: String, index: Int, role: String, title: String?, value: String?, actions: [String], frame: FixtureRect) {
        self.identifier = identifier
        self.index = index
        self.role = role
        self.title = title
        self.value = value
        self.actions = actions
        self.frame = frame
    }
}

public struct FixtureAppState: Codable, Sendable {
    public let windowTitle: String
    public let windowBounds: FixtureRect
    public let focusedIdentifier: String?
    public let selectedText: String?
    public let lastCommandID: String?
    public let elements: [FixtureElementState]

    public init(
        windowTitle: String,
        windowBounds: FixtureRect,
        focusedIdentifier: String?,
        selectedText: String? = nil,
        lastCommandID: String? = nil,
        elements: [FixtureElementState]
    ) {
        self.windowTitle = windowTitle
        self.windowBounds = windowBounds
        self.focusedIdentifier = focusedIdentifier
        self.selectedText = selectedText
        self.lastCommandID = lastCommandID
        self.elements = elements
    }
}

public struct FixtureCommand: Codable, Sendable {
    public let commandID: String?
    public let kind: String
    public let identifier: String
    public let value: String?
    public let x: Double?
    public let y: Double?
    public let toX: Double?
    public let toY: Double?
    public let direction: String?
    public let pages: Double?
    public let prefix: String?
    public let suffix: String?
    public let selectionType: String?

    public init(
        commandID: String? = UUID().uuidString,
        kind: String,
        identifier: String,
        value: String? = nil,
        x: Double? = nil,
        y: Double? = nil,
        toX: Double? = nil,
        toY: Double? = nil,
        direction: String? = nil,
        pages: Double? = nil,
        prefix: String? = nil,
        suffix: String? = nil,
        selectionType: String? = nil
    ) {
        self.commandID = commandID
        self.kind = kind
        self.identifier = identifier
        self.value = value
        self.x = x
        self.y = y
        self.toX = toX
        self.toY = toY
        self.direction = direction
        self.pages = pages
        self.prefix = prefix
        self.suffix = suffix
        self.selectionType = selectionType
    }
}

public enum FixtureBridge {
    public static let appName = "OpenComputerUseFixture"
    public static let distributedNotificationName = Notification.Name("dev.opencodex.opencomputeruse.fixture.command")

    public static var stateFileURL: URL {
        URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("open-computer-use-fixture", isDirectory: true)
            .appendingPathComponent("state.json")
    }

    public static func readState() throws -> FixtureAppState? {
        let url = stateFileURL
        guard FileManager.default.fileExists(atPath: url.path) else {
            return nil
        }

        var lastError: Error?

        for attempt in 0..<5 {
            do {
                let data = try Data(contentsOf: url)
                return try JSONDecoder().decode(FixtureAppState.self, from: data)
            } catch {
                lastError = error
                if attempt < 4 {
                    Thread.sleep(forTimeInterval: 0.05)
                }
            }
        }

        throw lastError ?? ComputerUseError.message("Failed to read fixture state")
    }

    public static func writeState(_ state: FixtureAppState) throws {
        let directory = stateFileURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let data = try JSONEncoder().encode(state)
        try data.write(to: stateFileURL, options: .atomic)
    }

    public static func post(_ command: FixtureCommand) throws {
        let payload = try String(data: JSONEncoder().encode(command), encoding: .utf8)
        DistributedNotificationCenter.default().postNotificationName(
            distributedNotificationName,
            object: nil,
            userInfo: payload.map { ["payload": $0] },
            options: .deliverImmediately
        )
    }

    public static func postAndWaitForStateChange(
        _ command: FixtureCommand,
        timeout: TimeInterval = 2
    ) throws {
        guard let commandID = command.commandID else {
            throw ComputerUseError.invalidArguments(
                "fixture command requires a command ID for acknowledgement"
            )
        }

        try post(command)

        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if try readState()?.lastCommandID == commandID {
                return
            }
            Thread.sleep(forTimeInterval: 0.02)
        }

        throw ComputerUseError.stateUnavailable(
            "Timed out waiting for the fixture to apply \(command.kind)"
        )
    }
}
