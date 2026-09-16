import AVFoundation
import UIKit
import ZXingCpp

/// Full-screen camera that decodes QR codes with zxing-cpp.
///
/// With a `reportURL` the whole loop stays native: each new value is POSTed to the QR server
/// on a keep-alive URLSession and counted as soon as the server answers `ok`. PHP only starts
/// the run and receives the final `RunCompleted`. Without one, every decode is handed to
/// Laravel as `CodeScanned` and the app confirms scans back through the bridge.
final class ZxingScannerViewController: UIViewController, AVCaptureVideoDataOutputSampleBufferDelegate {
    static weak var current: ZxingScannerViewController?

    private static let codeScannedEvent = "Margelo\\ZxingScanner\\Events\\CodeScanned"
    private static let runCompletedEvent = "Margelo\\ZxingScanner\\Events\\RunCompleted"

    private let target: Int
    private let reportURL: URL?
    /// One session, one host, connections reused: a report is a single round trip.
    private let reporter: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 2
        config.timeoutIntervalForResource = 4
        config.waitsForConnectivity = false
        return URLSession(configuration: config)
    }()
    private let session = AVCaptureSession()
    private let sessionQueue = DispatchQueue(label: "zxing.scanner.session")
    private let decodeQueue = DispatchQueue(label: "zxing.scanner.decode")
    private let reader: ZXIBarcodeReader
    private var lastSent = ""

    private var startedAt = Date()
    private var confirmed = 0
    private var finished = false
    private var ticker: Timer?

    private let previewLayer = AVCaptureVideoPreviewLayer()
    private let countLabel = UILabel()
    private let elapsedLabel = UILabel()
    private let statusLabel = UILabel()

    init(target: Int, reportURL: URL? = nil) {
        self.target = target
        self.reportURL = reportURL
        let options = ZXIReaderOptions()
        options.formats = [NSNumber(value: ZXIFormat.QR_CODE.rawValue)]
        options.tryHarder = false
        options.tryRotate = false
        options.tryInvert = false
        options.tryDownscale = true
        options.maxNumberOfSymbols = 1
        reader = ZXIBarcodeReader(options: options)
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("not supported") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        previewLayer.session = session
        previewLayer.videoGravity = .resizeAspectFill
        view.layer.addSublayer(previewLayer)
        buildOverlay()
        configureSession()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer.frame = view.bounds
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        startedAt = Date()
        warmReporter()
        sessionQueue.async { self.session.startRunning() }
        ticker = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            self?.renderElapsed()
        }
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        ticker?.invalidate()
        sessionQueue.async { self.session.stopRunning() }
    }

    // MARK: - Camera

    private func configureSession() {
        session.beginConfiguration()
        session.sessionPreset = .hd1280x720

        guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
              let input = try? AVCaptureDeviceInput(device: camera),
              session.canAddInput(input) else {
            session.commitConfiguration()
            statusLabel.text = "No camera"
            return
        }
        session.addInput(input)
        tune(camera)

        let output = AVCaptureVideoDataOutput()
        output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarFullRange]
        output.alwaysDiscardsLateVideoFrames = true
        output.setSampleBufferDelegate(self, queue: decodeQueue)
        guard session.canAddOutput(output) else {
            session.commitConfiguration()
            return
        }
        session.addOutput(output)
        session.commitConfiguration()
    }

    /// The `.hd1280x720` preset settles on a 30 fps format on most iPhones. Pick the 720p
    /// format that can do 60 so a new code on the screen is captured sooner, cap exposure so
    /// a frame is not integrating for a whole 1/30 s, and keep focus near: the code is at
    /// arm's length.
    private func tune(_ camera: AVCaptureDevice) {
        do {
            try camera.lockForConfiguration()
            if let format = camera.formats.first(where: { f in
                let dims = CMVideoFormatDescriptionGetDimensions(f.formatDescription)
                let fps = f.videoSupportedFrameRateRanges.map(\.maxFrameRate).max() ?? 0
                return dims.width == 1280 && dims.height == 720 && fps >= 60
                    && CMFormatDescriptionGetMediaSubType(f.formatDescription) == kCVPixelFormatType_420YpCbCr8BiPlanarFullRange
            }) {
                camera.activeFormat = format
                camera.activeVideoMinFrameDuration = CMTime(value: 1, timescale: 60)
                camera.activeVideoMaxFrameDuration = CMTime(value: 1, timescale: 60)
            }
            if camera.isExposureModeSupported(.continuousAutoExposure) {
                camera.activeMaxExposureDuration = CMTime(value: 1, timescale: 250)
            }
            if camera.isFocusModeSupported(.continuousAutoFocus) {
                camera.focusMode = .continuousAutoFocus
                if camera.isSmoothAutoFocusSupported { camera.isSmoothAutoFocusEnabled = false }
                if camera.isAutoFocusRangeRestrictionSupported { camera.autoFocusRangeRestriction = .near }
            }
            camera.unlockForConfiguration()
        } catch {
            print("ZxingScanner: could not tune the camera: \(error)")
        }
    }

    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard !finished, let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        guard let result = (try? reader.read(pixelBuffer))?.first else { return }

        let value = result.text
        if value == lastSent { return }
        lastSent = value

        if reportURL != nil {
            report(value)
        } else {
            LaravelBridge.shared.send?(Self.codeScannedEvent, ["data": value])
        }
    }

    // MARK: - Reporting

    /// Open the connection before the first code so it never pays the handshake.
    private func warmReporter() {
        guard let url = reportURL else { return }
        reporter.dataTask(with: URLRequest(url: url)).resume()
    }

    /// Same request and acceptance rule the Laravel relay used, minus the PHP hop.
    private func report(_ value: String) {
        guard let url = reportURL else { return }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["value": value])
        reporter.dataTask(with: request) { [weak self] data, _, _ in
            guard let data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  json["ok"] as? Bool == true else { return }
            DispatchQueue.main.async { self?.confirm() }
        }.resume()
    }

    // MARK: - Progress

    func confirm() {
        guard !finished else { return }
        confirmed += 1
        countLabel.text = "\(confirmed)"
        if confirmed >= target {
            finish()
        }
    }

    private func finish() {
        finished = true
        ticker?.invalidate()
        let elapsedMs = Date().timeIntervalSince(startedAt) * 1000
        renderElapsed()
        statusLabel.text = "Done"
        LaravelBridge.shared.send?(Self.runCompletedEvent, ["count": confirmed, "elapsedMs": elapsedMs])
    }

    private func renderElapsed() {
        elapsedLabel.text = String(format: "%.1fs", Date().timeIntervalSince(startedAt))
    }

    // MARK: - Overlay

    private func buildOverlay() {
        let panel = UIView()
        panel.backgroundColor = UIColor.black.withAlphaComponent(0.6)
        panel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(panel)

        countLabel.text = "0"
        countLabel.font = .systemFont(ofSize: 96, weight: .heavy)
        countLabel.textColor = UIColor(red: 0.29, green: 0.87, blue: 0.5, alpha: 1)
        countLabel.textAlignment = .center
        countLabel.layer.shadowColor = UIColor.black.cgColor
        countLabel.layer.shadowRadius = 8
        countLabel.layer.shadowOpacity = 1
        countLabel.layer.shadowOffset = .zero

        elapsedLabel.text = "0.0s"
        elapsedLabel.font = .systemFont(ofSize: 15)
        elapsedLabel.textColor = .white
        elapsedLabel.textAlignment = .center

        statusLabel.text = "Running…"
        statusLabel.font = .systemFont(ofSize: 16, weight: .semibold)
        statusLabel.textColor = .black
        statusLabel.textAlignment = .center
        statusLabel.backgroundColor = .white
        statusLabel.layer.cornerRadius = 12
        statusLabel.clipsToBounds = true

        let back = UIButton(type: .system)
        back.setTitle("Back", for: .normal)
        back.setTitleColor(.white, for: .normal)
        back.titleLabel?.font = .systemFont(ofSize: 15)
        back.backgroundColor = UIColor.white.withAlphaComponent(0.2)
        back.layer.cornerRadius = 12
        back.addTarget(self, action: #selector(closeTapped), for: .touchUpInside)

        let buttons = UIStackView(arrangedSubviews: [statusLabel, back])
        buttons.axis = .horizontal
        buttons.spacing = 8
        buttons.distribution = .fill
        statusLabel.setContentHuggingPriority(.defaultLow, for: .horizontal)
        back.widthAnchor.constraint(equalTo: statusLabel.widthAnchor, multiplier: 0.5).isActive = true
        statusLabel.heightAnchor.constraint(equalToConstant: 48).isActive = true

        let stack = UIStackView(arrangedSubviews: [countLabel, elapsedLabel, buttons])
        stack.axis = .vertical
        stack.spacing = 10
        stack.translatesAutoresizingMaskIntoConstraints = false
        panel.addSubview(stack)

        NSLayoutConstraint.activate([
            panel.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            panel.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            panel.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            stack.topAnchor.constraint(equalTo: panel.topAnchor, constant: 16),
            stack.leadingAnchor.constraint(equalTo: panel.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: panel.trailingAnchor, constant: -16),
            stack.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -16),
        ])
    }

    @objc private func closeTapped() {
        Self.current = nil
        dismiss(animated: true)
    }
}
