import Foundation
import NitroModules

final class HybridThroughputReporter: HybridThroughputReporterSpec {
  private let baseURL: URL
  private let target: Int
  private let session: URLSession
  private let reports = DispatchQueue(label: "example.throughput.reports")
  private let lock = NSLock()
  private var state = ThroughputState.running
  private var count = 0
  private var startedAt: UInt64?
  private var elapsedMs = 0.0
  private var lastSubmitted: String?
  private var errorMessage: String?

  init(options: ThroughputOptions) throws {
    guard let url = URL(string: options.serverURL),
      ["http", "https"].contains(url.scheme), url.host != nil,
      ["", "/"].contains(url.path), url.query == nil, url.fragment == nil
    else {
      throw RuntimeError.error(
        withMessage: "Enter a server origin without a path, query or fragment")
    }
    guard options.target.isFinite, options.target >= 2, options.target <= Double(Int32.max),
      options.target.rounded() == options.target
    else {
      throw RuntimeError.error(withMessage: "target must be an integer >= 2")
    }
    baseURL = url
    target = Int(options.target)
    let configuration = URLSessionConfiguration.ephemeral
    configuration.timeoutIntervalForRequest = 2
    configuration.timeoutIntervalForResource = 4
    configuration.waitsForConnectivity = false
    configuration.httpMaximumConnectionsPerHost = 1
    configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
    session = URLSession(configuration: configuration)
    super.init()
  }

  func prepare() throws {
    guard try accepted(request(path: "reset", method: "POST", json: [:])) else {
      throw RuntimeError.error(withMessage: "Server reset failed")
    }
    _ = try request(path: "scan", method: "GET")
  }

  func submit(value: String) throws {
    lock.lock()
    defer { lock.unlock() }
    guard state == .running, value != lastSubmitted else { return }
    lastSubmitted = value
    reports.async { [self] in
      guard withLock({ state == .running }) else { return }
      do {
        let ok = try accepted(request(path: "scan", method: "POST", json: ["value": value]))
        let completed = withLock { () -> Bool in
          guard ok, state == .running else { return false }
          let now = DispatchTime.now().uptimeNanoseconds
          if startedAt == nil { startedAt = now }
          count += 1
          elapsedMs = Double(now - startedAt!) / 1_000_000
          if count == target { state = .completed }
          return state == .completed
        }
        if completed { session.finishTasksAndInvalidate() }
      } catch {
        withLock {
          guard state == .running else { return }
          elapsedMs = currentElapsed()
          state = .failed
          errorMessage = error.localizedDescription
        }
        session.invalidateAndCancel()
      }
    }
  }

  func getSnapshot() throws -> ThroughputSnapshot {
    return withLock {
      ThroughputSnapshot(
        state: state, count: Double(count),
        elapsedMs: state == .running ? currentElapsed() : elapsedMs, error: errorMessage)
    }
  }

  func stop() {
    withLock {
      if state == .running {
        elapsedMs = currentElapsed()
        state = .stopped
      }
    }
    session.invalidateAndCancel()
  }

  deinit { session.invalidateAndCancel() }

  private func currentElapsed() -> Double {
    guard let startedAt else { return 0 }
    return Double(DispatchTime.now().uptimeNanoseconds - startedAt) / 1_000_000
  }

  private func withLock<T>(_ body: () throws -> T) rethrows -> T {
    lock.lock()
    defer { lock.unlock() }
    return try body()
  }

  private func accepted(_ data: Data) throws -> Bool {
    guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
      let ok = object["ok"] as? Bool
    else { throw RuntimeError.error(withMessage: "Server response must contain a boolean ok") }
    return ok
  }

  private func request(path: String, method: String, json: [String: String]? = nil) throws -> Data {
    var request = URLRequest(url: baseURL.appendingPathComponent(path))
    request.httpMethod = method
    if let json {
      request.httpBody = try JSONSerialization.data(withJSONObject: json)
      request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    }
    // Only the dedicated report queue (or the factory's worker) waits here.
    // The camera thread and the React Native UI thread never wait on HTTP.
    let response = BlockingHTTPResponse()
    session.dataTask(with: request) { data, urlResponse, error in
      response.complete(data: data, response: urlResponse, error: error)
    }.resume()
    return try response.wait()
  }
}
