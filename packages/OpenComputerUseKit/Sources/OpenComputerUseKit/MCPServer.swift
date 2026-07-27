import Foundation

let computerUseServerInstructions = OpenComputerUseAgentAdaptation(
    environment: [:]
).serverInstructions

public final class StdioMCPServer {
    private let dispatcher: ComputerUseToolDispatcher
    private let serverInstructions: String

    public init(
        service: ComputerUseService = ComputerUseService(),
        environment: [String: String] = ProcessInfo.processInfo.environment
    ) {
        self.dispatcher = ComputerUseToolDispatcher(service: service)
        self.serverInstructions = OpenComputerUseAgentAdaptation(
            environment: environment
        ).serverInstructions
    }

    public func run() throws {
        while let line = readLine(strippingNewline: true) {
            guard !line.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                continue
            }

            if let response = handle(line: line) {
                FileHandle.standardOutput.write((response + "\n").data(using: .utf8)!)
            }
        }
    }

    public func handle(line: String) -> String? {
        do {
            guard let payload = try JSONSerialization.jsonObject(with: Data(line.utf8)) as? [String: Any] else {
                return try encodeJSONRPCError(id: nil, code: -32700, message: "Invalid JSON-RPC payload")
            }

            let method = payload["method"] as? String
            let id = payload["id"]
            let params = payload["params"] as? [String: Any] ?? [:]

            switch method {
            case "initialize":
                return try encodeJSONRPCResult(
                    id: id,
                    result: [
                        "protocolVersion": "2025-03-26",
                        "serverInfo": [
                            "name": "open-computer-use",
                            "version": openComputerUseVersion,
                        ],
                        "capabilities": [
                            "tools": [
                                "listChanged": false,
                            ],
                        ],
                        "instructions": serverInstructions,
                    ]
                )
            case "notifications/initialized":
                return nil
            case "notifications/turn-ended":
                VisualCursorSupport.performOnMain {
                    SoftwareCursorOverlay.reset()
                }
                return nil
            case "ping":
                return try encodeJSONRPCResult(id: id, result: [:])
            case "tools/list":
                return try encodeJSONRPCResult(
                    id: id,
                    result: [
                        "tools": ToolDefinitions.all.map(\.asDictionary),
                    ]
                )
            case "tools/call":
                let name = params["name"] as? String ?? ""
                let arguments = params["arguments"] as? [String: Any] ?? [:]
                let result = try dispatcher.callTool(name: name, arguments: arguments)
                return try encodeJSONRPCResult(
                    id: id,
                    result: result.asDictionary
                )
            default:
                if method == nil {
                    return nil
                }

                return try encodeJSONRPCError(id: id, code: -32601, message: "Method not found: \(method ?? "")")
            }
        } catch let error as ComputerUseError {
            let payload = try? JSONSerialization.jsonObject(with: Data(line.utf8)) as? [String: Any]
            let id = payload?["id"]
            let result = ToolCallResult.text(error.errorDescription ?? String(describing: error), isError: error.toolResultIsError)
            return try? encodeJSONRPCResult(id: id, result: result.asDictionary)
        } catch {
            let message = (error as? LocalizedError)?.errorDescription ?? String(describing: error)
            let payload = try? JSONSerialization.jsonObject(with: Data(line.utf8)) as? [String: Any]
            let id = payload?["id"]
            return try? encodeJSONRPCResult(
                id: id,
                result: [
                    "content": [
                        [
                            "type": "text",
                            "text": message,
                        ],
                    ],
                    "isError": true,
                ]
            )
        }
    }

    private func encodeJSONRPCResult(id: Any?, result: [String: Any]) throws -> String {
        try encode([
            "jsonrpc": "2.0",
            "id": id ?? NSNull(),
            "result": result,
        ])
    }

    private func encodeJSONRPCError(id: Any?, code: Int, message: String) throws -> String {
        try encode([
            "jsonrpc": "2.0",
            "id": id ?? NSNull(),
            "error": [
                "code": code,
                "message": message,
            ],
        ])
    }

    private func encode(_ object: [String: Any]) throws -> String {
        let data = try JSONSerialization.data(withJSONObject: object, options: [.withoutEscapingSlashes])
        guard let text = String(data: data, encoding: .utf8) else {
            throw ComputerUseError.message("Failed to encode JSON-RPC response.")
        }

        return text
    }
}
