import Foundation

/// A single URLSession completion handed back to the serial report worker.
/// The semaphore synchronizes the result's one write and one read.
final class BlockingHTTPResponse: @unchecked Sendable {
  private let done = DispatchSemaphore(value: 0)
  private var result: Result<Data, Error>?

  func complete(data: Data?, response: URLResponse?, error: Error?) {
    if let error {
      result = .failure(error)
    } else if let response = response as? HTTPURLResponse,
      (200..<300).contains(response.statusCode), let data
    {
      result = .success(data)
    } else {
      let status = (response as? HTTPURLResponse)?.statusCode ?? 0
      result = .failure(
        NSError(
          domain: "ThroughputHTTP", code: status,
          userInfo: [NSLocalizedDescriptionKey: "Unexpected HTTP response (\(status))"]))
    }
    done.signal()
  }

  func wait() throws -> Data {
    done.wait()
    return try result!.get()
  }
}
