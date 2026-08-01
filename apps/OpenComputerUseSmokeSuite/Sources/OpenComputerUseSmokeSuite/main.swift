import AppKit
import CoreGraphics
import Foundation
import OpenComputerUseKit

struct MCPResponse {
    let id: Int?
    let result: [String: Any]?
    let error: [String: Any]?
}

final class MCPClient {
    private let process: Process
    private let stdin: FileHandle
    private let stdout: FileHandle
    private var nextID = 1

    init(executableURL: URL, arguments: [String], environment: [String: String]? = nil) throws {
        process = Process()
        process.executableURL = executableURL
        process.arguments = arguments
        process.environment = environment
        let stdinPipe = Pipe()
        let stdoutPipe = Pipe()
        let stderrPipe = Pipe()
        process.standardInput = stdinPipe
        process.standardOutput = stdoutPipe
        process.standardError = stderrPipe
        try process.run()
        stdin = stdinPipe.fileHandleForWriting
        stdout = stdoutPipe.fileHandleForReading
    }

    func initialize() throws {
        _ = try request(method: "initialize", params: [
            "clientInfo": [
                "name": "OpenComputerUseSmokeSuite",
                "version": "1.1.0",
            ],
            "capabilities": [:],
            "protocolVersion": "2025-03-26",
        ])

        try notify(method: "notifications/initialized", params: [:])
    }

    func listTools() throws -> [[String: Any]] {
        let response = try request(method: "tools/list", params: [:])
        return response.result?["tools"] as? [[String: Any]] ?? []
    }

    func callTool(_ name: String, arguments: [String: Any]) throws -> String {
        let response = try request(method: "tools/call", params: [
            "name": name,
            "arguments": arguments,
        ])

        if let error = response.error {
            throw SmokeError.message("JSON-RPC error: \(error)")
        }

        let result = response.result ?? [:]
        if (result["isError"] as? Bool) == true {
            let text = extractText(from: result) ?? "unknown tool error"
            throw SmokeError.message(text)
        }

        guard let text = extractText(from: result) else {
            throw SmokeError.message("Tool \(name) returned no text content.")
        }

        return text
    }

    func callToolExpectingEmptyContent(_ name: String, arguments: [String: Any]) throws {
        let response = try request(method: "tools/call", params: [
            "name": name,
            "arguments": arguments,
        ])

        if let error = response.error {
            throw SmokeError.message("JSON-RPC error: \(error)")
        }

        let result = response.result ?? [:]
        if (result["isError"] as? Bool) == true {
            let text = extractText(from: result) ?? "unknown tool error"
            throw SmokeError.message(text)
        }

        let content = result["content"] as? [[String: Any]] ?? []
        guard content.isEmpty else {
            throw SmokeError.message(
                "Tool \(name) should return empty content when action-state return is disabled."
            )
        }
    }

    func terminate() {
        process.terminate()
    }

    private func notify(method: String, params: [String: Any]) throws {
        let payload: [String: Any] = [
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
        ]
        try write(payload)
    }

    private func request(method: String, params: [String: Any]) throws -> MCPResponse {
        let id = nextID
        nextID += 1

        let payload: [String: Any] = [
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params,
        ]

        try write(payload)
        return try readResponse(expectedID: id)
    }

    private func write(_ payload: [String: Any]) throws {
        let data = try JSONSerialization.data(withJSONObject: payload, options: [.withoutEscapingSlashes])
        stdin.write(data)
        stdin.write(Data([0x0A]))
    }

    private func readResponse(expectedID: Int) throws -> MCPResponse {
        let deadline = Date().addingTimeInterval(20)
        var buffer = Data()

        while Date() < deadline {
            let chunk = try stdout.read(upToCount: 1) ?? Data()
            if chunk.isEmpty {
                Thread.sleep(forTimeInterval: 0.05)
                continue
            }

            buffer.append(chunk)

            if chunk == Data([0x0A]) {
                let lineData = buffer.dropLast()
                buffer.removeAll(keepingCapacity: true)
                guard !lineData.isEmpty else {
                    continue
                }

                let object = try JSONSerialization.jsonObject(with: lineData) as? [String: Any] ?? [:]
                let id = object["id"] as? Int

                if id != expectedID {
                    continue
                }

                return MCPResponse(
                    id: id,
                    result: object["result"] as? [String: Any],
                    error: object["error"] as? [String: Any]
                )
            }
        }

        throw SmokeError.message("Timed out waiting for JSON-RPC response \(expectedID)")
    }

    private func extractText(from result: [String: Any]) -> String? {
        let content = result["content"] as? [[String: Any]]
        return content?.first?["text"] as? String
    }
}

enum SmokeError: Error {
    case message(String)
}

@main
enum OpenComputerUseSmokeSuite {
    static func main() throws {
        let productsDirectory = try locateProductsDirectory()
        let fixtureURL = productsDirectory.appendingPathComponent("OpenComputerUseFixture")
        let serverURL = productsDirectory.appendingPathComponent("OpenComputerUse")
        let appName = "OpenComputerUseFixture"
        let mode = SmokeMode(arguments: CommandLine.arguments)

        terminateExistingFixtures(named: appName)
        try? FileManager.default.removeItem(at: FixtureBridge.stateFileURL)

        let fixture = Process()
        fixture.executableURL = fixtureURL
        fixture.environment = smokeFixtureEnvironment()
        fixture.standardOutput = Pipe()
        fixture.standardError = Pipe()
        try fixture.run()

        defer {
            fixture.terminate()
        }

        Thread.sleep(forTimeInterval: 1.5)

        switch mode {
        case .full:
            try runFullSmoke(serverURL: serverURL, appName: appName)
        case .cursorIdleOnly:
            try runCursorIdleSmoke(serverURL: serverURL, appName: appName)
        }
    }

    private static func runFullSmoke(serverURL: URL, appName: String) throws {
        let client = try MCPClient(executableURL: serverURL, arguments: ["mcp"], environment: smokeServerEnvironment())
        defer {
            client.terminate()
        }

        try client.initialize()

        let tools = try client.listTools()
        guard tools.count == 10 else {
            throw SmokeError.message("Expected 10 tools, got \(tools.count)")
        }

        print("1. list_apps")
        let apps = try client.callTool("list_apps", arguments: [:])
        try expect(apps.contains(appName), "Fixture app should appear in list_apps output.")

        print("2. get_app_state")
        var state = try client.callTool("get_app_state", arguments: [
            "app": appName,
        ])
        let unchangedDiff = try client.callTool("get_app_state", arguments: [
            "app": appName,
            "disable_screenshot": true,
        ])
        try expect(
            unchangedDiff.contains("No accessibility changes"),
            "same-session get_app_state should return a compact unchanged diff"
        )
        state = try client.callTool("get_app_state", arguments: [
            "app": appName,
            "disableDiff": true,
            "disable_screenshot": true,
        ])
        try expect(
            state.contains("fixture-increment"),
            "disableDiff=true should restore the full accessibility state"
        )
        let index = parseElementIndex(state)
        try expect(index.keys.contains("fixture-increment"), "fixture button should be indexed")
        let initialCounter = parseCounterValue(state)

        print("3. click element_index")
        state = try client.callTool("click", arguments: [
            "app": appName,
            "element_index": index["fixture-increment"]!.index,
        ])
        try expect(parseCounterValue(state) == initialCounter + 1, "click should increment the counter")

        print("4. click coordinate")
        let buttonFrame = index["fixture-increment"]!.frame
        state = try client.callTool("click", arguments: [
            "app": appName,
            "x": buttonFrame.midX,
            "y": buttonFrame.midY,
        ])
        try expect(parseCounterValue(state) == initialCounter + 2, "coordinate click should increment the counter again")

        print("5. perform_secondary_action")
        let windowIndex = index["fixture-window"]?.index ?? "0"
        _ = try client.callTool("perform_secondary_action", arguments: [
            "app": appName,
            "element_index": windowIndex,
            "action": "Raise",
        ])

        print("6. set_value")
        state = try client.callTool("set_value", arguments: [
            "app": appName,
            "element_index": index["fixture-input"]!.index,
            "value": "set-value-ok",
        ])
        try expect(state.contains("set-value-ok"), "set_value should update the text field")

        print("6a. Unicode scalar evidence")
        state = try client.callTool("set_value", arguments: [
            "app": appName,
            "element_index": index["fixture-input"]!.index,
            "value": "Cafe\u{301}|",
        ])
        try expect(
            state.contains(
                "Unicode Scalars: [U+0043 U+0061 U+0066 U+0065 U+0301 U+007C]; NFC=no"
            ),
            "decomposed Unicode should expose its exact scalar sequence and NFC=no"
        )
        state = try client.callTool("set_value", arguments: [
            "app": appName,
            "element_index": index["fixture-input"]!.index,
            "value": "Caf\u{00E9}|",
        ])
        try expect(
            state.contains(
                "Unicode Scalars: [U+0043 U+0061 U+0066 U+00E9 U+007C]; NFC=yes"
            ),
            "precomposed Unicode should expose its exact scalar sequence and NFC=yes"
        )
        state = try client.callTool("set_value", arguments: [
            "app": appName,
            "element_index": index["fixture-input"]!.index,
            "value": "Caf\u{00E9}\u{301}|",
        ])
        try expect(
            state.contains(
                "Unicode Scalars: [U+0043 U+0061 U+0066 U+00E9 U+0301 U+007C]; NFC=yes"
            ),
            "visually similar precomposed-plus-combining Unicode should remain distinguishable"
        )
        state = try client.callTool("set_value", arguments: [
            "app": appName,
            "element_index": index["fixture-input"]!.index,
            "value": "set-value-ok",
        ])

        print("7. type_text")
        let inputFrame = index["fixture-input"]!.frame
        _ = try client.callTool("click", arguments: [
            "app": appName,
            "x": inputFrame.midX,
            "y": inputFrame.midY,
        ])
        state = try client.callTool("type_text", arguments: [
            "app": appName,
            "text": "-typed",
        ])
        try expect(state.contains("set-value-ok-typed"), "type_text should append literal text to the focused text field")

        print("8. select_text")
        state = try client.callTool("select_text", arguments: [
            "app": appName,
            "element_index": index["fixture-input"]!.index,
            "text": "-typed",
            "prefix": "set-value-ok",
            "selection_type": "text",
        ])
        try expect(
            state.contains("Selected text: [-typed]"),
            "select_text should select the exact disambiguated text"
        )

        print("9. press_key")
        let keyCaptureFrame = index["fixture-key-capture"]!.frame
        _ = try client.callTool("click", arguments: [
            "app": appName,
            "x": keyCaptureFrame.midX,
            "y": keyCaptureFrame.midY,
        ])
        state = try client.callTool("press_key", arguments: [
            "app": appName,
            "key": "Return",
        ])
        try expect(state.contains("Last key: Return"), "press_key should update the key capture view")

        print("10. scroll")
        let scrollIndex = index["fixture-scroll-view"]!.index
        state = try client.callTool("scroll", arguments: [
            "app": appName,
            "direction": "down",
            "element_index": scrollIndex,
            "pages": 1,
        ])
        try expect(
            !currentEvidence(in: state).contains("Scroll offset: 0"),
            "scroll should move the scroll view"
        )

        print("11. drag")
        let dragFrame = index["fixture-drag-pad"]!.frame
        state = try client.callTool("drag", arguments: [
            "app": appName,
            "from_x": dragFrame.minX + 30,
            "from_y": dragFrame.minY + 30,
            "to_x": dragFrame.maxX - 30,
            "to_y": dragFrame.maxY - 30,
        ])
        try expect(state.contains("Last drag:"), "drag should update the drag status label")
        try expect(
            !currentEvidence(in: state).contains("Last drag: none"),
            "drag should report a captured path"
        )

        print("12. action-state return disabled")
        var compactEnvironment = smokeServerEnvironment()
        compactEnvironment["OPEN_COMPUTER_USE_RETURN_ACTION_STATE"] = "0"
        let compactClient = try MCPClient(
            executableURL: serverURL,
            arguments: ["mcp"],
            environment: compactEnvironment
        )
        defer {
            compactClient.terminate()
        }
        try compactClient.initialize()
        let compactState = try compactClient.callTool("get_app_state", arguments: [
            "app": appName,
            "disable_screenshot": true,
        ])
        let compactIndex = parseElementIndex(compactState)
        try compactClient.callToolExpectingEmptyContent("click", arguments: [
            "app": appName,
            "element_index": compactIndex["fixture-increment"]!.index,
        ])
        let verifiedCompactState = try compactClient.callTool("get_app_state", arguments: [
            "app": appName,
            "disable_screenshot": true,
        ])
        try expect(
            parseCounterValue(verifiedCompactState) == initialCounter + 3,
            "empty action result should still update runtime state for the next explicit read"
        )

        print("Smoke suite completed.")
    }

    private static func runCursorIdleSmoke(serverURL: URL, appName: String) throws {
        print("1. cursor idle observation setup")
        let observationURL = cursorObservationFileURL()
        try? FileManager.default.removeItem(at: observationURL)
        var environment = smokeServerEnvironment()
        environment["OPEN_COMPUTER_USE_VISUAL_CURSOR"] = "1"
        environment["OPEN_COMPUTER_USE_VISUAL_CURSOR_OBSERVATION_FILE"] = observationURL.path

        let client = try MCPClient(executableURL: serverURL, arguments: ["mcp"], environment: environment)
        defer {
            client.terminate()
        }

        try client.initialize()
        _ = try client.callTool("get_app_state", arguments: [
            "app": appName,
        ])

        print("2. trigger click and wait for idle overlay")
        let state = try client.callTool("click", arguments: [
            "app": appName,
            "element_index": "1",
        ])
        try expect(state.contains("Counter:"), "cursor smoke click should still return fixture state")

        let firstIdleSnapshot = try waitForCursorObservation(at: observationURL, phase: "idle")
        Thread.sleep(forTimeInterval: 0.25)
        let secondIdleSnapshot = try waitForCursorObservation(at: observationURL, phase: "idle")

        print("3. assert anchored tip plus changing rotation")
        let firstTip = try expectPoint(firstIdleSnapshot.tipPosition, name: "first tip position")
        let secondTip = try expectPoint(secondIdleSnapshot.tipPosition, name: "second tip position")
        let firstResting = try expectPoint(firstIdleSnapshot.restingTipPosition, name: "first resting tip position")
        let secondResting = try expectPoint(secondIdleSnapshot.restingTipPosition, name: "second resting tip position")
        let firstRotation = try expectValue(firstIdleSnapshot.rotation, name: "first rotation")
        let secondRotation = try expectValue(secondIdleSnapshot.rotation, name: "second rotation")

        try expect(abs(firstTip.x - secondTip.x) < 0.25, "idle cursor should stay anchored horizontally instead of shaking")
        try expect(abs(firstTip.y - secondTip.y) < 0.25, "idle cursor should stay anchored vertically")
        try expect(distanceBetween(firstTip, firstResting) < 0.35, "idle cursor tip should stay near resting position")
        try expect(distanceBetween(secondTip, secondResting) < 0.35, "idle cursor tip should keep resting anchor")
        try expect(abs(secondRotation - firstRotation) > 0.01, "idle cursor should keep a clearly visible tiny rotation wobble")

        print("Cursor idle smoke completed.")
    }

    private static func smokeServerEnvironment() -> [String: String] {
        var environment = ProcessInfo.processInfo.environment
        environment["OPEN_COMPUTER_USE_DISABLE_APP_AGENT_PROXY"] = "1"
        environment["OPEN_COMPUTER_USE_RETURN_ACTION_STATE"] = "1"
        return environment
    }

    private static func smokeFixtureEnvironment() -> [String: String] {
        var environment = ProcessInfo.processInfo.environment
        environment["OPEN_COMPUTER_USE_FIXTURE_HEADLESS"] = "1"
        return environment
    }

    private static func locateProductsDirectory() throws -> URL {
        let executableURL = URL(fileURLWithPath: CommandLine.arguments[0]).resolvingSymlinksInPath()
        return executableURL.deletingLastPathComponent()
    }

    private static func expect(_ condition: @autoclosure () -> Bool, _ message: String) throws {
        guard condition() else {
            throw SmokeError.message(message)
        }
    }

    private static func terminateExistingFixtures(named name: String) {
        let candidates = NSWorkspace.shared.runningApplications.filter { app in
            if app.localizedName == name {
                return true
            }

            return app.executableURL?.deletingPathExtension().lastPathComponent == name
        }

        for app in candidates {
            _ = app.terminate()
        }

        for app in candidates where !app.isTerminated {
            _ = app.forceTerminate()
        }

        if !candidates.isEmpty {
            Thread.sleep(forTimeInterval: 0.5)
        }
    }

    private static func parseElementIndex(_ state: String) -> [String: (index: String, frame: CGRect)] {
        var result: [String: (String, CGRect)] = [:]

        for rawLine in state.split(separator: "\n") {
            let line = String(rawLine)
            guard
                let identifierRange = line.range(of: " ID: "),
                let frameRange = line.range(of: " Frame: ")
            else {
                continue
            }

            let prefix = line[..<identifierRange.lowerBound].trimmingCharacters(in: .whitespaces)
            guard let index = prefix.split(separator: " ").first.map(String.init) else {
                continue
            }

            let identifierSlice = line[identifierRange.upperBound..<frameRange.lowerBound]
            let identifier = identifierSlice
                .components(separatedBy: " Value:")
                .first?
                .components(separatedBy: " Secondary Actions:")
                .first?
                .trimmingCharacters(in: .whitespaces) ?? ""
            let frame = parseFrame(String(line[frameRange.upperBound...]))
            result[identifier] = (index, frame)
        }

        return result
    }

    private static func parseFrame(_ text: String) -> CGRect {
        let values = text
            .components(separatedBy: ",")
            .compactMap { part -> Double? in
                part.split(separator: "=").last.flatMap { Double($0.trimmingCharacters(in: .whitespaces)) }
            }

        guard values.count == 4 else {
            return .zero
        }

        return CGRect(x: values[0], y: values[1], width: values[2], height: values[3])
    }

    private static func parseCounterValue(_ state: String) -> Int {
        let state = currentEvidence(in: state)
        guard
            let range = state.range(of: "Counter: "),
            let value = state[range.upperBound...].split(whereSeparator: { !$0.isNumber }).first,
            let counter = Int(value)
        else {
            return -1
        }

        return counter
    }

    private static func currentEvidence(in state: String) -> String {
        state.components(separatedBy: "\nRemoved:\n").first ?? state
    }

    private static func cursorObservationFileURL() -> URL {
        URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("open-computer-use-smoke", isDirectory: true)
            .appendingPathComponent("visual-cursor-observation.json")
    }

    private static func waitForCursorObservation(at url: URL, phase: String, timeout: TimeInterval = 6) throws -> VisualCursorObservationSnapshot {
        let deadline = Date().addingTimeInterval(timeout)
        var lastSnapshot: VisualCursorObservationSnapshot?

        while Date() < deadline {
            if
                let data = try? Data(contentsOf: url),
                let snapshot = try? JSONDecoder().decode(VisualCursorObservationSnapshot.self, from: data)
            {
                lastSnapshot = snapshot
                if snapshot.phase == phase {
                    return snapshot
                }
            }

            Thread.sleep(forTimeInterval: 0.05)
        }

        throw SmokeError.message("Timed out waiting for cursor observation phase \(phase). Last snapshot: \(String(describing: lastSnapshot))")
    }

    private static func expectPoint(_ point: VisualCursorObservationPoint?, name: String) throws -> CGPoint {
        guard let point else {
            throw SmokeError.message("Missing \(name)")
        }

        return CGPoint(x: point.x, y: point.y)
    }

    private static func expectValue(_ value: Double?, name: String) throws -> Double {
        guard let value else {
            throw SmokeError.message("Missing \(name)")
        }

        return value
    }

    private static func distanceBetween(_ lhs: CGPoint, _ rhs: CGPoint) -> CGFloat {
        hypot(lhs.x - rhs.x, lhs.y - rhs.y)
    }
}

private enum SmokeMode {
    case full
    case cursorIdleOnly

    init(arguments: [String]) {
        if arguments.contains("--cursor-idle-only") {
            self = .cursorIdleOnly
        } else {
            self = .full
        }
    }
}
