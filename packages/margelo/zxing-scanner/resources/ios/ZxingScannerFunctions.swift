import Foundation
import UIKit

enum ZxingScannerFunctions {

    /// Presents the live scanner. `target` is the confirmed-scan count that ends the run; with a
    /// `report_url` the scanner posts each code there itself and counts the ones the server
    /// accepts, so no PHP request runs during the benchmark.
    class Start: BridgeFunction {
        func execute(parameters: [String: Any]) throws -> [String: Any] {
            let target = parameters["target"] as? Int ?? 1000
            let reportURL = (parameters["report_url"] as? String).flatMap { $0.isEmpty ? nil : URL(string: $0) }

            DispatchQueue.main.async {
                guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
                      let root = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController else {
                    return
                }
                let controller = ZxingScannerViewController(target: target, reportURL: reportURL)
                controller.modalPresentationStyle = .fullScreen
                ZxingScannerViewController.current = controller
                root.topMost.present(controller, animated: true)
            }

            return BridgeResponse.success(data: ["target": target, "report_url": reportURL?.absoluteString ?? ""])
        }
    }

    /// The app calls this once its server accepted a scan, so the overlay counts real progress.
    class Confirm: BridgeFunction {
        func execute(parameters: [String: Any]) throws -> [String: Any] {
            DispatchQueue.main.async {
                ZxingScannerViewController.current?.confirm()
            }
            return BridgeResponse.success()
        }
    }

    class Stop: BridgeFunction {
        func execute(parameters: [String: Any]) throws -> [String: Any] {
            DispatchQueue.main.async {
                ZxingScannerViewController.current?.dismiss(animated: true)
                ZxingScannerViewController.current = nil
            }
            return BridgeResponse.success()
        }
    }
}

private extension UIViewController {
    var topMost: UIViewController {
        presentedViewController?.topMost ?? self
    }
}
