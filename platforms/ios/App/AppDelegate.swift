import UIKit
import WebKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]?) -> Bool { true }
}

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    func sceneDidBecomeActive(_ scene: UIScene) { (window?.rootViewController as? UINavigationController)?.topViewController.flatMap { $0 as? PreviewController }?.setForeground(true) }
    func sceneWillResignActive(_ scene: UIScene) { (window?.rootViewController as? UINavigationController)?.topViewController.flatMap { $0 as? PreviewController }?.setForeground(false) }
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = UINavigationController(rootViewController: PreviewController())
        self.window = window
        window.makeKeyAndVisible()
    }
}

// Online application shell. Location requests originate from explicit web actions.
final class PreviewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    private var web: WKWebView!
    private let status = UILabel()
    private let retry = UIButton(type: .system)
    private let loadingBar = UIStackView()
    private var loadingTimeout: DispatchWorkItem?
    private let home = URL(string: "https://space.bh1jss.net/rocket-cloud/")!

    override func viewDidLoad() {
        super.viewDidLoad()
        navigationController?.setNavigationBarHidden(true, animated: false)
        view.backgroundColor = .systemBackground
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.userContentController.add(WeakMessageHandler(self), name: "xingtuNative")
        // Keep calendar generation on the shared server; iOS only handles the file handoff.
        let nativeActions = """
        if (location.origin === 'https://space.bh1jss.net') {
            document.addEventListener('click', function(event) {
                const button = event.target.closest?.('#download-all, #export-event');
                if (!button) return;
                event.preventDefault();
                event.stopImmediatePropagation();
                const stateID = button.id === 'download-all' ? 'feed-state' : 'export-state';
                const state = document.getElementById(stateID);
                const id = document.querySelector('.mission.selected')?.dataset.id;
                if (button.id === 'export-event' && !id) {
                    if (state) state.textContent = '请先选择任务，再导出日历。';
                    return;
                }
                const path = button.id === 'download-all' ? '/rocket-cloud/api/calendar.ics?days=30' : '/rocket-cloud/api/launches/' + encodeURIComponent(id) + '.ics';
                if (state) state.textContent = '正在准备日历文件…';
                window.webkit.messageHandlers.xingtuNative.postMessage({action:'calendar', path, stateID});
            }, true);
            document.addEventListener('DOMContentLoaded', function() {
                const toolbar = document.querySelector('.global-toolbar');
                if (!toolbar) return;
                const button = document.createElement('button');
                button.type = 'button'; button.textContent = '分享'; button.id = 'native-share';
                button.setAttribute('aria-label','分享当前发射任务');
                button.addEventListener('click', function() {
                    const url = new URL('/rocket-cloud/', location.origin);
                    const id = document.querySelector('.mission.selected')?.dataset.id;
                    if (id) url.searchParams.set('launch', id);
                    if (new URL(location.href).searchParams.get('range') === 'history') url.searchParams.set('range','history');
                    window.webkit.messageHandlers.xingtuNative.postMessage({action:'share', url:url.href});
                });
                toolbar.appendChild(button);
            });
        }
        """
        configuration.userContentController.addUserScript(WKUserScript(source: nativeActions, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? ""
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? ""
        configuration.applicationNameForUserAgent = "Xingtu/ios/\(version)/\(build) GeometryOnly/1"
        let buildLabel = String(format: "%04d", Int(build) ?? 0)
        let versionJSON = String(data: try! JSONSerialization.data(withJSONObject: ["v\(version) \(buildLabel)"]), encoding: .utf8)!
        let versionScript = "if(location.origin==='https://space.bh1jss.net'){document.querySelectorAll('.release-footer strong').forEach(el=>{el.textContent=el.textContent+' · iOS '+\(versionJSON)[0];});}"
        configuration.userContentController.addUserScript(WKUserScript(source: versionScript, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        let compactHeader = """
        if (location.origin === 'https://space.bh1jss.net') {
            const style = document.createElement('style');
            style.textContent = `.brand-slogan{display:none!important}body{padding-bottom:var(--native-bottom,0px)}
            /* Extend to the screen bottom; reserve the home indicator once in CSS. */
            @media(max-width:850px){
                body:has(.mobile-nav){padding-bottom:calc(48px + max(3px,calc(var(--native-bottom,0px) - 8px)))!important}
                .mobile-nav{padding:3px 5px max(3px,calc(var(--native-bottom,0px) - 8px))!important}
                .mobile-nav button{min-height:44px;padding:2px 4px;gap:1px}
                .mobile-nav svg{width:20px;height:20px}
                .map-panel{height:calc(100dvh - var(--mobile-top-height,118px) - 48px - max(3px,calc(var(--native-bottom,0px) - 8px)))!important}
                .site-popover{bottom:58px!important}
            }`;
            document.head.appendChild(style);
        }
        """
        configuration.userContentController.addUserScript(WKUserScript(source: compactHeader, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        web = WKWebView(frame: .zero, configuration: configuration)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.translatesAutoresizingMaskIntoConstraints = false
        // CSS reserves the bottom safe area; do not add automatic scroll insets again.
        web.scrollView.contentInsetAdjustmentBehavior = .never
        status.numberOfLines = 0
        status.font = .preferredFont(forTextStyle: .footnote)
        status.textColor = .secondaryLabel
        status.translatesAutoresizingMaskIntoConstraints = false
        status.backgroundColor = .secondarySystemBackground
        view.addSubview(web)
        retry.setTitle("重新加载", for: .normal)
        retry.addTarget(self, action: #selector(showHome), for: .touchUpInside)
        retry.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
        loadingBar.axis = .horizontal
        loadingBar.spacing = 8
        loadingBar.alignment = .center
        loadingBar.backgroundColor = .secondarySystemBackground
        loadingBar.isLayoutMarginsRelativeArrangement = true
        loadingBar.layoutMargins = UIEdgeInsets(top: 4, left: 12, bottom: 4, right: 12)
        loadingBar.addArrangedSubview(status)
        loadingBar.addArrangedSubview(retry)
        loadingBar.translatesAutoresizingMaskIntoConstraints = false
        loadingBar.isHidden = true
        retry.setContentHuggingPriority(.required, for: .horizontal)
        view.addSubview(loadingBar)
        NSLayoutConstraint.activate([
            web.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            web.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            web.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            loadingBar.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 4),
            loadingBar.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 8),
            loadingBar.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -8)
        ])
        showHome()
    }

    func setForeground(_ active: Bool) {
        web?.evaluateJavaScript("document.dispatchEvent(new CustomEvent('xingtu-visibility',{detail:\(active ? "true" : "false")}))", completionHandler: nil)
    }
    @objc private func showHome() {
        showLoading()
        web.load(URLRequest(url: home))
    }
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        updateSafeArea()
    }
    private func updateSafeArea() {
        web?.evaluateJavaScript("document.documentElement.style.setProperty('--native-bottom', '\(view.safeAreaInsets.bottom)px')", completionHandler: nil)
    }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if url.isFileURL { decisionHandler(.allow); return }
        // Calendar exports are handled by the explicit native bridge above.
        if url.pathExtension == "ics" || url.scheme == "blob" || url.scheme == "webcal" {
            loadingBar.isHidden = false
            retry.isHidden = true
            status.text = "请通过任务的日历导出按钮保存文件；尚未添加日程。"
            decisionHandler(.cancel); return
        }
        guard url.scheme == "https", action.request.httpMethod == nil || action.request.httpMethod == "GET" else {
            decisionHandler(.cancel); return
        }
        let isInternalPath = ["/rocket-cloud", "/launch"].contains { url.path == $0 || url.path.hasPrefix($0 + "/") }
        if url.host == home.host && isInternalPath {
            if action.targetFrame == nil { webView.load(URLRequest(url: url)); decisionHandler(.cancel) }
            else { decisionHandler(.allow) }
            return
        }
        decisionHandler(.cancel)
        if action.navigationType == .linkActivated { UIApplication.shared.open(url) }
    }

    private var preparingCalendar = false

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              message.frameInfo.securityOrigin.protocol == "https",
              message.frameInfo.securityOrigin.host == home.host,
              let page = message.frameInfo.request.url,
              page.path == "/rocket-cloud" || page.path.hasPrefix("/rocket-cloud/"),
              let body = message.body as? [String: String] else { return }
        if body["action"] == "share", let value = body["url"], let url = URL(string: value),
           url.scheme == "https", url.host == home.host, ["/rocket-cloud", "/rocket-cloud/"].contains(url.path) {
            presentShare(items: [url], stateID: nil, cleanup: nil)
            return
        }
        guard body["action"] == "calendar", !preparingCalendar,
              let path = body["path"], let stateID = body["stateID"],
              ["feed-state", "export-state"].contains(stateID),
              path == "/rocket-cloud/api/calendar.ics?days=30" ||
                path.range(of: #"^/rocket-cloud/api/launches/[A-Za-z0-9_-]+\.ics$"#, options: .regularExpression) != nil,
              let url = URL(string: path, relativeTo: home)?.absoluteURL else { return }
        preparingCalendar = true
        var request = URLRequest(url: url)
        request.timeoutInterval = 30
        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                guard let self else { return }
                self.preparingCalendar = false
                guard error == nil, let http = response as? HTTPURLResponse,
                      http.statusCode == 200, http.url?.host == self.home.host,
                      let data, data.count <= 2_000_000,
                      let text = String(data: data, encoding: .utf8),
                      text.hasPrefix("BEGIN:VCALENDAR"), text.contains("END:VCALENDAR") else {
                    self.setExportStatus(stateID, "未导出：无法获取有效日历。请检查网络及任务日期后重试。")
                    return
                }
                do {
                    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
                    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                    let file = directory.appendingPathComponent(stateID == "feed-state" ? "xingtu-30-days.ics" : "xingtu-launch.ics")
                    try data.write(to: file, options: .atomic)
                    self.setExportStatus(stateID, "日历文件已准备，请选择保存位置或分享方式；尚未添加日程。")
                    self.presentShare(items: [file], stateID: stateID, cleanup: directory)
                } catch {
                    self.setExportStatus(stateID, "未导出：日历文件写入失败，请重试。")
                }
            }
        }.resume()
    }

    private func setExportStatus(_ id: String, _ text: String) {
        guard let data = try? JSONSerialization.data(withJSONObject: [id, text]),
              let json = String(data: data, encoding: .utf8) else { return }
        web.evaluateJavaScript("{const v=\(json);const el=document.getElementById(v[0]);if(el)el.textContent=v[1];}", completionHandler: nil)
    }

    private func presentShare(items: [Any], stateID: String?, cleanup: URL?) {
        guard presentedViewController == nil, view.window != nil else {
            if let cleanup { try? FileManager.default.removeItem(at: cleanup) }
            if let stateID { setExportStatus(stateID, "未打开分享，请关闭当前弹窗后重试。") }
            return
        }
        let sheet = UIActivityViewController(activityItems: items, applicationActivities: nil)
        sheet.popoverPresentationController?.sourceView = view
        sheet.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.safeAreaInsets.top + 44, width: 1, height: 1)
        sheet.popoverPresentationController?.permittedArrowDirections = []
        sheet.completionWithItemsHandler = { [weak self] _, completed, _, error in
            if let cleanup { try? FileManager.default.removeItem(at: cleanup) }
            if let stateID {
                self?.setExportStatus(stateID, error != nil ? "未完成分享，请重试。" : completed ? "文件已交给所选应用；是否导入日历请在该应用确认。" : "已取消分享，未添加日程。")
            }
        }
        present(sheet, animated: true)
    }

    private func showLoading() {
        loadingTimeout?.cancel()
        loadingBar.isHidden = false
        retry.isHidden = true
        status.text = "正在加载星途…"
        let timeout = DispatchWorkItem { [weak self] in
            guard let self else { return }
            self.status.text = "加载时间较长，请检查网络或重新加载。"
            self.retry.isHidden = false
        }
        loadingTimeout = timeout
        DispatchQueue.main.asyncAfter(deadline: .now() + 20, execute: timeout)
    }
    private func showLoadError(_ error: Error) {
        guard (error as NSError).code != NSURLErrorCancelled else { return }
        loadingTimeout?.cancel()
        loadingBar.isHidden = false
        retry.isHidden = false
        status.text = "页面未加载，请检查网络后重试。"
    }
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        showLoading()
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        showLoadError(error)
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        showLoadError(error)
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        loadingTimeout?.cancel()
        loadingBar.isHidden = false
        retry.isHidden = false
        status.text = "页面已停止运行，请重新加载。"
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        loadingTimeout?.cancel()
        loadingBar.isHidden = true
        updateSafeArea()
    }
}

// WKUserContentController retains its handlers; keep the view controller weak.
private final class WeakMessageHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(userContentController, didReceive: message)
    }
}
