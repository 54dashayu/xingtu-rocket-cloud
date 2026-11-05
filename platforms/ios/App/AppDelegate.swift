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
final class PreviewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private var web: WKWebView!
    private let status = UILabel()
    private let home = URL(string: "https://space.bh1jss.net/rocket-cloud/")!

    override func viewDidLoad() {
        super.viewDidLoad()
        navigationController?.setNavigationBarHidden(true, animated: false)
        view.backgroundColor = .systemBackground
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        // Prevent the existing web exporter from reporting success when native export is unavailable.
        let exportGuard = """
        document.addEventListener('click', function(event) {
            if (location.origin !== 'https://space.bh1jss.net') return;
            const button = event.target.closest?.('#download-all, #export-event');
            if (!button) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            const state = document.getElementById(button.id === 'download-all' ? 'feed-state' : 'export-state');
            if (state) state.textContent = 'iOS 日历导出尚未开放；未下载文件，也未添加日程。';
        }, true);
        """
        configuration.userContentController.addUserScript(WKUserScript(source: exportGuard, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? ""
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? ""
        configuration.applicationNameForUserAgent = "Xingtu/ios/\(version)/\(build)"
        let buildLabel = String(format: "%04d", Int(build) ?? 0)
        let versionJSON = String(data: try! JSONSerialization.data(withJSONObject: ["v\(version) \(buildLabel)"]), encoding: .utf8)!
        let versionScript = "if(location.origin==='https://space.bh1jss.net'){document.querySelectorAll('.release-footer strong').forEach(el=>el.textContent=\(versionJSON)[0]);}"
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
        status.isHidden = true
        status.translatesAutoresizingMaskIntoConstraints = false
        status.backgroundColor = .secondarySystemBackground
        view.addSubview(web)
        view.addSubview(status)
        NSLayoutConstraint.activate([
            web.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            web.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            web.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            status.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 4),
            status.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 8),
            status.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -8)
        ])
        showHome()
    }

    func setForeground(_ active: Bool) {
        web?.evaluateJavaScript("document.dispatchEvent(new CustomEvent('xingtu-visibility',{detail:\(active ? "true" : "false")}))", completionHandler: nil)
    }
    @objc private func showHome() {
        status.isHidden = true
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
        // ICS/blob exports require the later native calendar adapter. Never mark them saved here.
        if url.pathExtension == "ics" || url.scheme == "blob" || url.scheme == "webcal" {
            status.isHidden = false
            status.text = "日历原生适配待完成；此原型尚未添加日程。"
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
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        status.isHidden = false
        status.text = "页面未加载，请检查网络，或返回首页重试。"
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        status.isHidden = true
        updateSafeArea()
    }
}
